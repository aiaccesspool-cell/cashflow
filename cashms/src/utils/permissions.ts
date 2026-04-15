import type { AuthUser } from "@/context/AuthContext";

export const hasPermission = (
  user: AuthUser | null | undefined,
  permission: string
) => {
  if (!permission) {
    return true;
  }

  return Boolean(user?.effectivePermissions?.includes(permission));
};

export const hasAnyPermission = (
  user: AuthUser | null | undefined,
  permissions: string[] = []
) => {
  if (!permissions.length) {
    return true;
  }

  return permissions.some((permission) => hasPermission(user, permission));
};

