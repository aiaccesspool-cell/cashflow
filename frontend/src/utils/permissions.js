export const hasPermission = (user, permission) => {
  if (!permission) {
    return true;
  }

  return Boolean(user?.effectivePermissions?.includes(permission));
};

export const hasAnyPermission = (user, permissions = []) => {
  if (!permissions.length) {
    return true;
  }

  return permissions.some((permission) => hasPermission(user, permission));
};
