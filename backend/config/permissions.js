const VALID_ROLES = ["admin", "accountant", "user"];

const PERMISSION_DETAILS = {
  "users.view": {
    label: "View Users",
    description: "Open the user directory and see access details.",
    group: "users",
  },
  "users.create": {
    label: "Create Users",
    description: "Create new users and assign roles.",
    group: "users",
  },
  "users.edit": {
    label: "Edit Users",
    description: "Update user profile, role, status, and access overrides.",
    group: "users",
  },
  "users.password": {
    label: "Change Passwords",
    description: "Reset or change passwords for other users.",
    group: "users",
  },
  "categories.view": {
    label: "View Categories",
    description: "Open the category list.",
    group: "categories",
  },
  "categories.create": {
    label: "Create Categories",
    description: "Add new categories.",
    group: "categories",
  },
  "categories.edit": {
    label: "Edit Categories",
    description: "Modify existing categories.",
    group: "categories",
  },
  "categories.delete": {
    label: "Delete Categories",
    description: "Remove categories from the system.",
    group: "categories",
  },
  "accounts.view": {
    label: "View Accounts",
    description: "Open and review account records.",
    group: "accounts",
  },
  "accounts.create": {
    label: "Create Accounts",
    description: "Add new accounts.",
    group: "accounts",
  },
  "accounts.edit": {
    label: "Edit Accounts",
    description: "Update account details.",
    group: "accounts",
  },
  "accounts.delete": {
    label: "Delete Accounts",
    description: "Remove accounts.",
    group: "accounts",
  },
  "sources.view": {
    label: "View Sources",
    description: "Open and review transaction sources.",
    group: "sources",
  },
  "sources.create": {
    label: "Create Sources",
    description: "Add new sources such as bank, MFS, or cash.",
    group: "sources",
  },
  "sources.edit": {
    label: "Edit Sources",
    description: "Update source names or types.",
    group: "sources",
  },
  "sources.delete": {
    label: "Delete Sources",
    description: "Remove sources that are no longer used.",
    group: "sources",
  },
  "transactions.view": {
    label: "View Transactions",
    description: "Open the transaction ledger.",
    group: "transactions",
  },
  "transactions.create": {
    label: "Create Transactions",
    description: "Add new transactions.",
    group: "transactions",
  },
  "transactions.edit": {
    label: "Edit Transactions",
    description: "Modify existing transactions.",
    group: "transactions",
  },
  "transactions.delete": {
    label: "Delete Transactions",
    description: "Remove transactions.",
    group: "transactions",
  },
  "transactions.export": {
    label: "Export Transactions",
    description: "Download transaction data.",
    group: "transactions",
  },
  "reports.view": {
    label: "View Reports",
    description: "Open reporting screens and summaries.",
    group: "reports",
  },
  "dashboard.view": {
    label: "View Dashboard",
    description: "Open the main dashboard.",
    group: "dashboard",
  },
};

const ALL_PERMISSIONS = Object.keys(PERMISSION_DETAILS);

const ROLE_PERMISSIONS = {
  admin: ALL_PERMISSIONS,
  accountant: [
    "categories.view",
    "categories.create",
    "categories.edit",
    "categories.delete",
    "accounts.view",
    "accounts.create",
    "accounts.edit",
    "accounts.delete",
    "sources.view",
    "sources.create",
    "sources.edit",
    "sources.delete",
    "transactions.view",
    "transactions.create",
    "transactions.edit",
    "transactions.delete",
    "transactions.export",
    "reports.view",
    "dashboard.view",
  ],
  user: [
    "accounts.view",
    "transactions.view",
    "reports.view",
    "dashboard.view",
  ],
};

const ALL_PERMISSION_SET = new Set(ALL_PERMISSIONS);

const normalizePermissionOverrides = (permissions) => {
  if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) {
    return {};
  }

  return Object.entries(permissions).reduce((accumulator, [key, value]) => {
    if (ALL_PERMISSION_SET.has(key) && typeof value === "boolean") {
      accumulator[key] = value;
    }

    return accumulator;
  }, {});
};

const getRolePermissions = (role = "user") => {
  if (role === "admin") {
    return [...ALL_PERMISSIONS];
  }

  return [...(ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.user)];
};

const resolvePermissions = (user = {}) => {
  if (user.role === "admin") {
    return [...ALL_PERMISSIONS];
  }

  const resolved = new Set(getRolePermissions(user.role));
  const overrides = normalizePermissionOverrides(user.permissions);

  Object.entries(overrides).forEach(([permission, allowed]) => {
    if (allowed) {
      resolved.add(permission);
      return;
    }

    resolved.delete(permission);
  });

  return [...resolved];
};

const hasPermission = (user, permission) => {
  if (!permission) {
    return true;
  }

  return resolvePermissions(user).includes(permission);
};

const serializeUser = (user) => {
  if (!user) {
    return null;
  }

  const values = typeof user.get === "function" ? user.get({ plain: true }) : user;
  const overrides = normalizePermissionOverrides(values.permissions);

  return {
    id: values.id,
    name: values.name,
    email: values.email,
    role: values.role,
    isActive: values.isActive !== false,
    permissions: overrides,
    effectivePermissions: resolvePermissions({
      role: values.role,
      permissions: overrides,
    }),
  };
};

module.exports = {
  ALL_PERMISSIONS,
  PERMISSION_DETAILS,
  ROLE_PERMISSIONS,
  VALID_ROLES,
  getRolePermissions,
  normalizePermissionOverrides,
  resolvePermissions,
  hasPermission,
  serializeUser,
};
