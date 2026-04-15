import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Key,
  MoreHorizontal,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  Users as UsersIcon,
} from "lucide-react";
import { API } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import usePermissions from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { normalizePaginatedResponse } from "@/utils/pagination";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

interface UserRecord {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  permissions: Record<string, boolean>;
  effectivePermissions: string[];
}

interface PermissionOption {
  key: string;
  label: string;
  description: string;
}

interface PermissionGroup {
  key: string;
  label: string;
  permissions: PermissionOption[];
}

interface UserMeta {
  roles: string[];
  rolePermissions: Record<string, string[]>;
  permissionGroups: PermissionGroup[];
}

interface UserSummary {
  totalUsers: number;
  adminCount: number;
  activeCount: number;
  inactiveCount: number;
  visibleUsers: number;
}

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-rose-50 text-rose-700 border-rose-100",
  accountant: "bg-blue-50 text-blue-700 border-blue-100",
  user: "bg-slate-50 text-slate-700 border-slate-200",
};

export default function Users() {
  const { can, canAny } = usePermissions();
  const { user: currentUser, login } = useAuth();
  const canCreateUsers = can("users.create");
  const canEditUsers = can("users.edit");
  const canChangePasswords = can("users.password");
  const canManageUsers = canAny([
    "users.create",
    "users.edit",
    "users.password",
  ]);

  const [users, setUsers] = React.useState<UserRecord[]>([]);
  const [meta, setMeta] = React.useState<UserMeta>({
    roles: [],
    rolePermissions: {},
    permissionGroups: [],
  });
  const [summary, setSummary] = React.useState<UserSummary>({
    totalUsers: 0,
    adminCount: 0,
    activeCount: 0,
    inactiveCount: 0,
    visibleUsers: 0,
  });

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [passwordSaving, setPasswordSaving] = React.useState(false);
  const [statusSavingId, setStatusSavingId] = React.useState<number | null>(
    null,
  );
  const [deleteSavingId, setDeleteSavingId] = React.useState<number | null>(
    null,
  );
  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("all");
  const [pageSize, setPageSize] = React.useState(10);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [startIndex, setStartIndex] = React.useState(0);
  const [endIndex, setEndIndex] = React.useState(0);
  const [error, setError] = React.useState("");

  const [isUserDialogOpen, setIsUserDialogOpen] = React.useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = React.useState(false);

  const [userForm, setUserForm] = React.useState({
    id: null as number | null,
    name: "",
    email: "",
    role: "user",
    isActive: true,
    password: "",
    permissions: {} as Record<string, boolean>,
  });

  const [passwordForm, setPasswordForm] = React.useState({
    id: null as number | null,
    name: "",
    password: "",
    confirmPassword: "",
  });

  const queryParams = React.useMemo(
    () => ({
      page,
      pageSize,
      search: search.trim() || undefined,
      role: roleFilter === "all" ? undefined : roleFilter,
    }),
    [page, pageSize, search, roleFilter],
  );

  const fetchPageData = React.useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [usersResponse, metaResponse] = await Promise.all([
        API.get("/users", { params: queryParams }),
        API.get("/users/meta"),
      ]);

      if (Array.isArray(usersResponse.data)) {
        const rawUsers = usersResponse.data as UserRecord[];

        const filteredUsers = rawUsers.filter((item) => {
          const term = search.trim().toLowerCase();

          const matchesSearch =
            !term ||
            item.name.toLowerCase().includes(term) ||
            item.email.toLowerCase().includes(term);

          const matchesRole = roleFilter === "all" || item.role === roleFilter;

          return matchesSearch && matchesRole;
        });

        const start = (page - 1) * pageSize;
        const pagedUsers = filteredUsers.slice(start, start + pageSize);

        setUsers(pagedUsers);
        setTotal(filteredUsers.length);
        setTotalPages(Math.max(Math.ceil(filteredUsers.length / pageSize), 1));
        setStartIndex(filteredUsers.length === 0 ? 0 : start + 1);
        setEndIndex(filteredUsers.length === 0 ? 0 : start + pagedUsers.length);

        setSummary({
          totalUsers: rawUsers.length,
          adminCount: rawUsers.filter((item) => item.role === "admin").length,
          activeCount: rawUsers.filter((item) => item.isActive).length,
          inactiveCount: rawUsers.filter((item) => !item.isActive).length,
          visibleUsers: filteredUsers.length,
        });

        setMeta(
          metaResponse.data || {
            roles: [],
            rolePermissions: {},
            permissionGroups: [],
          },
        );

        return;
      }

      const normalized = normalizePaginatedResponse<UserRecord>(
        usersResponse.data,
        page,
        pageSize,
        {
          totalUsers: 0,
          adminCount: 0,
          activeCount: 0,
          inactiveCount: 0,
          visibleUsers: 0,
        },
      );

      setUsers(normalized.data);
      setTotalPages(normalized.totalPages);
      setTotal(normalized.total);
      setStartIndex(normalized.startIndex);
      setEndIndex(normalized.endIndex);
      setSummary(
        normalized.summary as {
          totalUsers: number;
          adminCount: number;
          activeCount: number;
          inactiveCount: number;
          visibleUsers: number;
        },
      );

      setMeta(
        metaResponse.data || {
          roles: [],
          rolePermissions: {},
          permissionGroups: [],
        },
      );
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.error ||
          "Failed to load user management data",
      );
    } finally {
      setLoading(false);
    }
  }, [queryParams, page, pageSize, search, roleFilter]);

  React.useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);

  React.useEffect(() => {
    setPage(1);
  }, [search, roleFilter, pageSize]);

  const upsertUser = (nextUser: UserRecord) => {
    setUsers((current) => {
      const exists = current.some((user) => user.id === nextUser.id);
      if (!exists) {
        return [nextUser, ...current];
      }
      return current.map((user) => (user.id === nextUser.id ? nextUser : user));
    });
  };

  const openCreateDialog = () => {
    if (!canCreateUsers) return;
    setUserForm({
      id: null,
      name: "",
      email: "",
      role: meta.roles.includes("user") ? "user" : meta.roles[0] || "user",
      isActive: true,
      password: "",
      permissions: {},
    });
    setIsUserDialogOpen(true);
    setError("");
  };

  const openEditDialog = (selectedUser: UserRecord) => {
    if (!canEditUsers) return;
    setUserForm({
      id: selectedUser.id,
      name: selectedUser.name,
      email: selectedUser.email,
      role: selectedUser.role,
      isActive: selectedUser.isActive,
      password: "",
      permissions: selectedUser.permissions || {},
    });
    setIsUserDialogOpen(true);
    setError("");
  };

  const openPasswordDialog = (selectedUser: UserRecord) => {
    if (!canChangePasswords) return;
    setPasswordForm({
      id: selectedUser.id,
      name: selectedUser.name,
      password: "",
      confirmPassword: "",
    });
    setIsPasswordDialogOpen(true);
    setError("");
  };

  const handleSaveUser = async () => {
    if (!userForm.name.trim() || !userForm.email.trim()) {
      setError("Name and email are required");
      return;
    }

    if (!userForm.id && userForm.password.trim().length < 6) {
      setError("New users must have a password of at least 6 characters");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload: any = {
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        role: userForm.role,
        isActive: userForm.isActive,
        permissions: userForm.permissions || {},
      };

      if (!userForm.id) {
        payload.password = userForm.password;
      }

      const response = userForm.id
        ? await API.put(`/users/${userForm.id}`, payload)
        : await API.post("/users", payload);

      const savedUser = response.data.user as UserRecord;
      upsertUser(savedUser);

      if (currentUser?.id === savedUser.id) {
        login(savedUser);
      }

      setIsUserDialogOpen(false);
      await fetchPageData();
    } catch (requestError: any) {
      setError(requestError.response?.data?.error || "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePassword = async () => {
    if (!passwordForm.id) return;

    if (passwordForm.password.trim().length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (passwordForm.password !== passwordForm.confirmPassword) {
      setError("Password confirmation does not match");
      return;
    }

    setPasswordSaving(true);
    setError("");
    try {
      await API.put(`/users/${passwordForm.id}/password`, {
        password: passwordForm.password,
      });
      setIsPasswordDialogOpen(false);
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.error || "Failed to update password",
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleStatusToggle = async (selectedUser: UserRecord) => {
    if (!canEditUsers) return;
    const nextStatus = !selectedUser.isActive;
    const actionLabel = nextStatus ? "restore" : "disable";
    if (!window.confirm(`Do you want to ${actionLabel} ${selectedUser.name}?`))
      return;

    setStatusSavingId(selectedUser.id);
    setError("");
    try {
      const response = await API.put(`/users/${selectedUser.id}/status`, {
        isActive: nextStatus,
      });
      const updatedUser = response.data.user as UserRecord;
      upsertUser(updatedUser);

      if (currentUser?.id === updatedUser.id) {
        login(updatedUser);
      }

      await fetchPageData();
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.error || "Failed to update user status",
      );
    } finally {
      setStatusSavingId(null);
    }
  };

  const handleDeleteUser = async (selectedUser: UserRecord) => {
    if (!canEditUsers) return;
    if (
      !window.confirm(`Delete ${selectedUser.name}? This action is permanent.`)
    )
      return;

    setDeleteSavingId(selectedUser.id);
    setError("");
    try {
      await API.delete(`/users/${selectedUser.id}`);
      setUsers((current) =>
        current.filter((user) => user.id !== selectedUser.id),
      );
      await fetchPageData();
    } catch (requestError: any) {
      setError(requestError.response?.data?.error || "Failed to delete user");
    } finally {
      setDeleteSavingId(null);
    }
  };

  const roleDefaults = React.useMemo(
    () => meta.rolePermissions?.[userForm.role] || [],
    [meta.rolePermissions, userForm.role],
  );

  const overrideCount = React.useMemo(
    () => Object.keys(userForm.permissions || {}).length,
    [userForm.permissions],
  );

  const getPermissionMode = React.useCallback(
    (permissionKey: string) => {
      if (userForm.permissions?.[permissionKey] === true) return "allow";
      if (userForm.permissions?.[permissionKey] === false) return "deny";
      return "inherit";
    },
    [userForm.permissions],
  );

  const updatePermissionMode = React.useCallback(
    (permissionKey: string, mode: "inherit" | "allow" | "deny") => {
      setUserForm((current) => {
        const nextPermissions = { ...(current.permissions || {}) };

        if (mode === "inherit") {
          delete nextPermissions[permissionKey];
        } else {
          nextPermissions[permissionKey] = mode === "allow";
        }

        return {
          ...current,
          permissions: nextPermissions,
        };
      });
    },
    [],
  );

  const activeFilterCount = [search.trim() !== "", roleFilter !== "all"].filter(
    Boolean,
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            Users
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage users, roles, status, and password resets.
          </p>
        </div>
        {canCreateUsers && (
          <Button
            onClick={openCreateDialog}
            className="w-full sm:w-auto gap-2 h-11 sm:h-10"
          >
            <UserPlus className="h-4 w-4" />
            Add User
          </Button>
        )}
      </div>

      {!canManageUsers && (
        <div className="rounded-lg border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Read-only access. You can view users but cannot change them.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-md ring-1 ring-indigo-100 bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-indigo-900">
              Total Users
            </CardTitle>
            <UsersIcon className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-950">
              {summary.totalUsers}
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md ring-1 ring-blue-100 bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-900">
              Admins
            </CardTitle>
            <Shield className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-950">
              {summary.adminCount}
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md ring-1 ring-emerald-100 bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-900">
              Active
            </CardTitle>
            <UserCheck className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-950">
              {summary.activeCount}
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md ring-1 ring-slate-200 bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-900">
              Inactive
            </CardTitle>
            <UserX className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-950">
              {summary.inactiveCount}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none bg-card/50 backdrop-blur-sm shadow-md">
        <CardContent className="p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(320px,1fr)_180px_150px_170px] xl:items-end">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Search
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  className="h-11 rounded-xl bg-white pl-10"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Role
              </Label>
              <Select
                value={roleFilter}
                onValueChange={(value) => setRoleFilter(value || "all")}
              >
                <SelectTrigger className="h-11 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {(meta.roles.length
                    ? meta.roles
                    : ["admin", "accountant", "user"]
                  ).map((role) => (
                    <SelectItem key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Page Size
              </Label>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => setPageSize(Number(value || 10))}
              >
                <SelectTrigger className="h-11 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size} per page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-transparent">
                Action
              </Label>
              <Button
                variant="outline"
                className="h-11 w-full rounded-xl"
                onClick={() => {
                  setSearch("");
                  setRoleFilter("all");
                  setPage(1);
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Showing {startIndex}-{endIndex} of {total} users
            </span>
            <Badge variant="secondary" className="rounded-full px-3">
              {activeFilterCount} active
            </Badge>
          </div>

          <div className="mt-4 rounded-md border bg-background/50 overflow-x-auto">
            <div className="min-w-[860px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: Math.min(pageSize, 8) }).map(
                      (_, index) => (
                        <TableRow key={`user-skeleton-${index}`}>
                          <TableCell>
                            <Skeleton className="h-4 w-6" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-36" />
                            <Skeleton className="mt-2 h-3 w-44" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-6 w-20 rounded-full" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-6 w-16 rounded-full" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Skeleton className="ml-auto h-8 w-8 rounded-md" />
                          </TableCell>
                        </TableRow>
                      ),
                    )
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="p-0">
                        <EmptyState
                          icon={UsersIcon}
                          title="No users found"
                          description="No users matched your search filters."
                          actionLabel={canCreateUsers ? "Add User" : undefined}
                          onAction={
                            canCreateUsers ? openCreateDialog : undefined
                          }
                          className="border-none rounded-none py-16"
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user, index) => (
                      <TableRow key={user.id} className="group">
                        <TableCell>
                          {(startIndex > 0
                            ? startIndex
                            : (page - 1) * pageSize + 1) + index}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {user.name}
                              {currentUser?.id === user.id && (
                                <Badge variant="outline" className="ml-2">
                                  You
                                </Badge>
                              )}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {user.email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "capitalize font-bold px-2.5 h-6 text-[10px] tracking-wider",
                              ROLE_COLORS[user.role] || ROLE_COLORS.user,
                            )}
                          >
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={user.isActive ? "default" : "secondary"}
                          >
                            {user.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div>
                            {user.effectivePermissions?.length || 0} effective
                            permissions
                          </div>
                          <div className="mt-0.5">
                            {Object.keys(user.permissions || {}).length} custom
                            override
                            {Object.keys(user.permissions || {}).length === 1
                              ? ""
                              : "s"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {(canEditUsers || canChangePasswords) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 p-0"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                }
                              />
                              <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuGroup>
                                  {canEditUsers && (
                                    <DropdownMenuItem
                                      className="gap-2"
                                      onClick={() => openEditDialog(user)}
                                    >
                                      <UserCheck className="h-4 w-4" />
                                      Edit Details
                                    </DropdownMenuItem>
                                  )}
                                  {canEditUsers && (
                                    <DropdownMenuItem
                                      className="gap-2"
                                      onClick={() => handleStatusToggle(user)}
                                      disabled={
                                        statusSavingId === user.id ||
                                        (currentUser?.id === user.id &&
                                          user.isActive)
                                      }
                                    >
                                      <UserX className="h-4 w-4" />
                                      {statusSavingId === user.id
                                        ? "Saving..."
                                        : user.isActive
                                          ? "Disable"
                                          : "Restore"}
                                    </DropdownMenuItem>
                                  )}
                                  {canChangePasswords && (
                                    <DropdownMenuItem
                                      className="gap-2"
                                      onClick={() => openPasswordDialog(user)}
                                    >
                                      <Key className="h-4 w-4" />
                                      Change Password
                                    </DropdownMenuItem>
                                  )}
                                  {canEditUsers && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="gap-2 text-destructive focus:text-destructive"
                                        onClick={() => handleDeleteUser(user)}
                                        disabled={
                                          deleteSavingId === user.id ||
                                          currentUser?.id === user.id
                                        }
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        {deleteSavingId === user.id
                                          ? "Deleting..."
                                          : "Delete User"}
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuGroup>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Page {page} of {Math.max(totalPages, 1)}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((current) => Math.min(current + 1, totalPages))
                }
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden p-0 sm:max-w-[900px]">
          <DialogHeader className="px-6 pb-2 pt-6">
            <DialogTitle>
              {userForm.id ? "Edit User" : "Create User"}
            </DialogTitle>
            <DialogDescription>
              Manage profile, role, status, and fine-grained permission
              overrides.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input
                  value={userForm.name}
                  onChange={(event) =>
                    setUserForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={userForm.email}
                  onChange={(event) =>
                    setUserForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Role</Label>
                <Select
                  value={userForm.role}
                  onValueChange={(value) =>
                    setUserForm((current) => ({
                      ...current,
                      role:
                        value ||
                        (meta.roles.includes("user")
                          ? "user"
                          : meta.roles[0] || "user"),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(meta.roles.length
                      ? meta.roles
                      : ["admin", "accountant", "user"]
                    ).map((role) => (
                      <SelectItem key={role} value={role}>
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={userForm.isActive ? "active" : "inactive"}
                  onValueChange={(value) =>
                    setUserForm((current) => ({
                      ...current,
                      isActive: value === "active",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active account</SelectItem>
                    <SelectItem value="inactive">Inactive account</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!userForm.id && (
                <div className="grid gap-2 md:col-span-2">
                  <Label>Initial Password</Label>
                  <Input
                    type="password"
                    value={userForm.password}
                    onChange={(event) =>
                      setUserForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    placeholder="Minimum 6 characters"
                  />
                </div>
              )}
            </div>

            <Card className="border border-slate-200 bg-slate-50/40 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Access Overrides</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Role defaults allow {roleDefaults.length} permissions. This
                  user has {overrideCount} custom override
                  {overrideCount === 1 ? "" : "s"}.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {meta.permissionGroups.length === 0 ? (
                  <div className="rounded-lg border border-dashed bg-white/70 px-4 py-3 text-sm text-muted-foreground">
                    Permission metadata is unavailable.
                  </div>
                ) : (
                  meta.permissionGroups.map((group) => (
                    <div
                      key={group.key}
                      className="rounded-xl border bg-white/90"
                    >
                      <div className="border-b px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-700">
                        {group.label}
                      </div>
                      <div className="space-y-3 p-4">
                        {group.permissions.map((permission) => {
                          const inherited = roleDefaults.includes(
                            permission.key,
                          );
                          return (
                            <div
                              key={permission.key}
                              className="grid gap-3 rounded-lg border border-slate-200/80 bg-white px-3 py-3 md:grid-cols-[1fr_280px] md:items-center"
                            >
                              <div>
                                <div className="text-sm font-semibold text-slate-900">
                                  {permission.label}
                                </div>
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                  {permission.description}
                                </div>
                                <div className="mt-1 text-[11px] text-slate-500">
                                  Default for {userForm.role}:{" "}
                                  {inherited ? "Allowed" : "Hidden"}
                                </div>
                              </div>
                              <Select
                                value={getPermissionMode(permission.key)}
                                onValueChange={(value) =>
                                  updatePermissionMode(
                                    permission.key,
                                    value as "inherit" | "allow" | "deny",
                                  )
                                }
                              >
                                <SelectTrigger className="w-full bg-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="inherit">
                                    Inherit ({inherited ? "Allowed" : "Hidden"})
                                  </SelectItem>
                                  <SelectItem value="allow">Allow</SelectItem>
                                  <SelectItem value="deny">Deny</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <DialogFooter className="border-t bg-slate-50/70 px-6 py-4 pb-6 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 min-w-[140px] rounded-full"
              onClick={() => setIsUserDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-10 min-w-[140px] rounded-full"
              onClick={handleSaveUser}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isPasswordDialogOpen}
        onOpenChange={setIsPasswordDialogOpen}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Set a new password for {passwordForm.name || "this user"}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={passwordForm.password}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Confirm Password</Label>
              <Input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    confirmPassword: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPasswordDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSavePassword} disabled={passwordSaving}>
              {passwordSaving ? "Updating..." : "Update Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
