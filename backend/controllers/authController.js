const db = require("../models");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {
  VALID_ROLES,
  normalizePermissionOverrides,
  serializeUser,
} = require("../config/permissions");
const { writeAuditLog } = require("../services/auditLogService");

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

exports.register = async (req, res) => {
  try {
    const { password } = req.body;
    const payload = buildUserPayload(req.body);

    if (!payload.name || !payload.email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    if (!VALID_ROLES.includes(payload.role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const hash = await bcrypt.hash(req.body.password, 10);
    const user = await db.User.create({
      ...payload,
      password: hash,
    });

    await writeAuditLog({
      req,
      module: "users",
      action: "create",
      entityId: user.id,
      summary: `Registered user "${user.name}" (${user.role})`,
      meta: {
        email: user.email,
        role: user.role,
      },
    });

    res.status(201).json({ user: serializeUser(user) });
  } catch (err) {
    return handleUserWriteError(err, res, "Registration failed");
  }
};

exports.login = async (req, res) => {
  try {
    const email = req.body.email?.trim()?.toLowerCase();
    const password = req.body.password || "";

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await db.User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    if (!user.isActive) {
      return res.status(403).json({ error: "User account is inactive" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({ token, user: serializeUser(user) });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
};

exports.me = async (req, res) => {
  res.json({ user: serializeUser(req.user) });
};

exports.changeMyPassword = async (req, res) => {
  try {
    const currentPassword = req.body.currentPassword || "";
    const newPassword = req.body.newPassword || "";

    if (!currentPassword) {
      return res.status(400).json({ error: "Current password is required" });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const user = await db.User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await user.update({ password: hash });

    await writeAuditLog({
      req,
      module: "auth",
      action: "password_change",
      entityId: user.id,
      summary: `User "${user.name}" changed own password`,
      meta: {
        email: user.email,
      },
    });

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Change my password error:", err);
    res.status(500).json({ error: "Failed to change password" });
  }
};
