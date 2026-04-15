import { useAuth } from "../context/AuthContext";
import { hasAnyPermission, hasPermission } from "../utils/permissions";

export default function usePermissions() {
  const { user } = useAuth();

  return {
    user,
    can: (permission) => hasPermission(user, permission),
    canAny: (permissions = []) => hasAnyPermission(user, permissions),
  };
}
