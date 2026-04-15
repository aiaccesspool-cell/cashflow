const { hasPermission } = require("../config/permissions");

module.exports = (...permissions) => {
  const requiredPermissions = permissions.flat().filter(Boolean);

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (
      requiredPermissions.length > 0 &&
      !requiredPermissions.some((permission) => hasPermission(req.user, permission))
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    next();
  };
};
