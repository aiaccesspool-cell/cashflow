const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
const db = require("../models");
const {
  ALL_PERMISSIONS,
  PERMISSION_DETAILS,
  ROLE_PERMISSIONS,
  VALID_ROLES,
  normalizePermissionOverrides,
  serializeUser,
} = require("../config/permissions");
const {
  pickChangedFields,
  toPlainObject,
  writeAuditLog,
} = require("../services/auditLogService");

const buildUserPayload = (body = {}, existingUser = {}) => {
  const role = body.role ?? existingUser.role ?? "user";
  const normalizedRole = typeof role === "string" ? role.trim().toLowerCase() : role;

  return {
    name: body.name?.trim() ?? existingUser.name,
    email: body.email?.trim()?.toLowerCase() ?? existingUser.email,
    role: normalizedRole,
    isActive: body.isActive ?? existingUser.isActive ?? true,
    permissions: normalizePermissionOverrides(body.permissions ?? existingUser.permissions),
  };
};

const handleUserWriteError = (err, res, fallbackMessage) => {
  if (err.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({ error: "Email already exists" });
  }

  if (err.name === "SequelizeValidationError") {
    return res.status(400).json({ error: err.errors[0]?.message || fallbackMessage });
  }

  console.error(fallbackMessage, err);
  return res.status(500).json({ error: fallbackMessage });
};

const validatePassword = (password) => {
  if (!password || typeof password !== "string" || password.trim().length < 6) {
    return "Password must be at least 6 characters";
  }

  return null;
};

const ensureAdminSafety = async ({ currentUserId, targetUser, payload }) => {
  const targetIsAdmin = targetUser.role === "admin";
  const removingAdminRole = payload.role !== "admin";
  const deactivatingAdmin = payload.isActive === false;

  if (currentUserId === targetUser.id && (removingAdminRole || deactivatingAdmin)) {
    return "You cannot deactivate or demote your own admin account";
  }

  if (!targetIsAdmin || (!removingAdminRole && !deactivatingAdmin)) {
    return null;
  }

  const otherActiveAdmins = await db.User.count({
    where: {
      id: { [Op.ne]: targetUser.id },
      role: "admin",
      isActive: true,
    },
  });

  if (otherActiveAdmins === 0) {
    return "At least one active admin must remain in the system";
  }

  return null;
};

const ensureUserDeletionSafety = async ({ currentUserId, targetUser }) => {
  if (currentUserId === targetUser.id) {
    return "You cannot delete your own account";
  }

  if (targetUser.role !== "admin" || targetUser.isActive === false) {
    return null;
  }

  const otherActiveAdmins = await db.User.count({
    where: {
      id: { [Op.ne]: targetUser.id },
      role: "admin",
      isActive: true,
    },
  });

  if (otherActiveAdmins === 0) {
    return "At least one active admin must remain in the system";
  }

  return null;
};

const buildPermissionGroups = () => {
  return Object.entries(PERMISSION_DETAILS).reduce((groups, [key, detail]) => {
    const existingGroup = groups[detail.group] || {
      key: detail.group,
      label: detail.group.charAt(0).toUpperCase() + detail.group.slice(1),
      permissions: [],
    };

    existingGroup.permissions.push({
      key,
      label: detail.label,
      description: detail.description,
    });

    groups[detail.group] = existingGroup;
    return groups;
  }, {});
};

exports.getUserMeta = async (req, res) => {
  const permissionGroups = Object.values(buildPermissionGroups()).sort((a, b) =>
    a.label.localeCompare(b.label)
  );

  res.json({
    roles: VALID_ROLES,
    allPermissions: ALL_PERMISSIONS,
    rolePermissions: ROLE_PERMISSIONS,
    permissionGroups,
  });
};

exports.getUsers = async (req, res) => {
  try {
    const { search = "", role = "all" } = req.query;
    const currentPage = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.max(Number(req.query.pageSize) || 10, 1);
    const offset = (currentPage - 1) * limit;

    const where = {};
    const normalizedSearch = String(search || "").trim().toLowerCase();

    if (normalizedSearch) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${normalizedSearch}%` } },
        { email: { [Op.iLike]: `%${normalizedSearch}%` } },
      ];
    }

    if (role && role !== "all") {
      where.role = role;
    }

    const { rows, count } = await db.User.findAndCountAll({
      where,
      attributes: ["id", "name", "email", "role", "isActive", "permissions", "createdAt", "updatedAt"],
      order: [
        ["role", "ASC"],
        ["name", "ASC"],
      ],
      limit,
      offset,
    });

    const [totalUsers, adminCount, activeCount, inactiveCount] = await Promise.all([
      db.User.count(),
      db.User.count({ where: { role: "admin" } }),
      db.User.count({ where: { isActive: true } }),
      db.User.count({ where: { isActive: false } }),
    ]);

    const startIndex = count === 0 ? 0 : offset + 1;
    const endIndex = count === 0 ? 0 : offset + rows.length;

    res.json({
      data: rows.map(serializeUser),
      total: count,
      totalPages: Math.max(Math.ceil(count / limit), 1),
      page: currentPage,
      pageSize: limit,
      countOnPage: rows.length,
      startIndex,
      endIndex,
      filters: {
        search: normalizedSearch,
        role: role || "all",
      },
      summary: {
        totalUsers,
        adminCount,
        activeCount,
        inactiveCount,
        visibleUsers: count,
      },
    });
  } catch (err) {
    console.error("Fetch users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

exports.createUser = async (req, res) => {
  try {
    const payload = buildUserPayload(req.body);
    const password = req.body.password;

    if (!payload.name || !payload.email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    if (!VALID_ROLES.includes(payload.role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await db.User.create({
      ...payload,
      password: hash,
    });

    await writeAuditLog({
      req,
      module: "users",
      action: "create",
      entityId: user.id,
      summary: `Created user "${user.name}" (${user.role})`,
      meta: {
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });

    res.status(201).json({ user: serializeUser(user) });
  } catch (err) {
    return handleUserWriteError(err, res, "Failed to create user");
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await db.User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const before = toPlainObject(user);

    const payload = buildUserPayload(req.body, user.get({ plain: true }));

    if (!payload.name || !payload.email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    if (!VALID_ROLES.includes(payload.role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const adminSafetyError = await ensureAdminSafety({
      currentUserId: req.user.id,
      targetUser: user,
      payload,
    });

    if (adminSafetyError) {
      return res.status(400).json({ error: adminSafetyError });
    }

    await user.update(payload);

    const after = toPlainObject(user);

    await writeAuditLog({
      req,
      module: "users",
      action: "update",
      entityId: user.id,
      summary: `Updated user "${user.name}"`,
      meta: {
        changedFields: pickChangedFields(
          {
            name: before.name,
            email: before.email,
            role: before.role,
            isActive: before.isActive,
            permissions: before.permissions || {},
          },
          {
            name: after.name,
            email: after.email,
            role: after.role,
            isActive: after.isActive,
            permissions: after.permissions || {},
          }
        ),
      },
    });

    res.json({ user: serializeUser(user) });
  } catch (err) {
    return handleUserWriteError(err, res, "Failed to update user");
  }
};

exports.changePassword = async (req, res) => {
  try {
    const user = await db.User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const password = req.body.password;
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const hash = await bcrypt.hash(password, 10);
    await user.update({ password: hash });

    await writeAuditLog({
      req,
      module: "users",
      action: "password_change",
      entityId: user.id,
      summary: `Changed password for "${user.name}"`,
      meta: {
        targetUserEmail: user.email,
      },
    });

    res.json({ message: `Password updated for ${user.name}` });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Failed to change password" });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const user = await db.User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (typeof req.body.isActive !== "boolean") {
      return res.status(400).json({ error: "Valid status is required" });
    }

    const payload = {
      role: user.role,
      isActive: req.body.isActive,
    };

    const adminSafetyError = await ensureAdminSafety({
      currentUserId: req.user.id,
      targetUser: user,
      payload,
    });

    if (adminSafetyError) {
      return res.status(400).json({ error: adminSafetyError });
    }

    await user.update({ isActive: req.body.isActive });

    await writeAuditLog({
      req,
      module: "users",
      action: req.body.isActive ? "restore" : "disable",
      entityId: user.id,
      summary: `${req.body.isActive ? "Restored" : "Disabled"} user "${user.name}"`,
      meta: {
        isActive: req.body.isActive,
        role: user.role,
      },
    });

    res.json({
      message: req.body.isActive
        ? `${user.name} has been restored`
        : `${user.name} has been disabled`,
      user: serializeUser(user),
    });
  } catch (err) {
    console.error("Update user status error:", err);
    res.status(500).json({ error: "Failed to update user status" });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await db.User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const deletionSafetyError = await ensureUserDeletionSafety({
      currentUserId: req.user.id,
      targetUser: user,
    });

    if (deletionSafetyError) {
      return res.status(400).json({ error: deletionSafetyError });
    }

    const userName = user.name;
    const snapshot = toPlainObject(user);
    await user.destroy();

    await writeAuditLog({
      req,
      module: "users",
      action: "delete",
      entityId: snapshot.id,
      summary: `Deleted user "${snapshot.name}"`,
      meta: {
        email: snapshot.email,
        role: snapshot.role,
        isActive: snapshot.isActive,
      },
    });

    res.json({ message: `${userName} has been deleted` });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
};
