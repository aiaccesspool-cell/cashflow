import { useEffect, useState } from "react";
import {
  Accordion,
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Modal,
  Pagination,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";
import { API } from "../services/api";
import { useAuth } from "../context/AuthContext";
import usePermissions from "../hooks/usePermissions";

const EMPTY_FORM = {
  id: null,
  name: "",
  email: "",
  role: "user",
  isActive: true,
  password: "",
  permissions: {},
};

const EMPTY_PASSWORD_FORM = {
  id: null,
  name: "",
  password: "",
  confirmPassword: "",
};

const ROLE_BADGES = {
  admin: "danger",
  accountant: "primary",
  user: "secondary",
};

export default function Users() {
  const { can, canAny } = usePermissions();
  const { user: currentUser, login } = useAuth();
  const canCreateUsers = can("users.create");
  const canEditUsers = can("users.edit");
  const canChangePasswords = can("users.password");
  const canManageUsers = canAny(["users.create", "users.edit", "users.password"]);
  const showUserActions = canEditUsers || canChangePasswords;

  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState({
    roles: [],
    rolePermissions: {},
    permissionGroups: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [statusSavingId, setStatusSavingId] = useState(null);
  const [deleteSavingId, setDeleteSavingId] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD_FORM);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [flash, setFlash] = useState(null);

  const pageSize = 6;

  const fetchPageData = async () => {
    setLoading(true);
    try {
      const [usersRes, metaRes] = await Promise.all([
        API.get("/users"),
        API.get("/users/meta"),
      ]);

      setUsers(usersRes.data);
      setMeta(metaRes.data);
    } catch (err) {
      setFlash({
        variant: "danger",
        message: err.response?.data?.error || "Failed to load user management data",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPageData();
  }, []);

  const filteredUsers = users.filter((item) => {
    const term = search.trim().toLowerCase();
    const matchesSearch =
      !term ||
      item.name.toLowerCase().includes(term) ||
      item.email.toLowerCase().includes(term);
    const matchesRole = !roleFilter || item.role === roleFilter;
    const matchesStatus =
      !statusFilter ||
      (statusFilter === "active" && item.isActive) ||
      (statusFilter === "inactive" && !item.isActive);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const totalPages = Math.max(Math.ceil(filteredUsers.length / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const paginatedUsers = filteredUsers.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const summary = {
    total: users.length,
    admins: users.filter((item) => item.role === "admin").length,
    accountants: users.filter((item) => item.role === "accountant").length,
    inactive: users.filter((item) => !item.isActive).length,
  };

  const resetFlash = () => setFlash(null);

  const openCreateModal = () => {
    if (!canCreateUsers) {
      return;
    }

    setForm({
      ...EMPTY_FORM,
      role: meta.roles.includes("user") ? "user" : meta.roles[0] || "user",
    });
    setShowUserModal(true);
    resetFlash();
  };

  const openEditModal = (selectedUser) => {
    if (!canEditUsers) {
      return;
    }

    setForm({
      id: selectedUser.id,
      name: selectedUser.name,
      email: selectedUser.email,
      role: selectedUser.role,
      isActive: selectedUser.isActive,
      password: "",
      permissions: selectedUser.permissions || {},
    });
    setShowUserModal(true);
    resetFlash();
  };

  const closeUserModal = () => {
    setShowUserModal(false);
    setForm(EMPTY_FORM);
  };

  const openPasswordModal = (selectedUser) => {
    if (!canChangePasswords) {
      return;
    }

    setPasswordForm({
      id: selectedUser.id,
      name: selectedUser.name,
      password: "",
      confirmPassword: "",
    });
    setShowPasswordModal(true);
    resetFlash();
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordForm(EMPTY_PASSWORD_FORM);
  };

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const getPermissionMode = (permissionKey) => {
    if (form.permissions?.[permissionKey] === true) {
      return "allow";
    }

    if (form.permissions?.[permissionKey] === false) {
      return "deny";
    }

    return "inherit";
  };

  const updatePermissionMode = (permissionKey, mode) => {
    setForm((prev) => {
      const nextPermissions = { ...(prev.permissions || {}) };

      if (mode === "inherit") {
        delete nextPermissions[permissionKey];
      } else {
        nextPermissions[permissionKey] = mode === "allow";
      }

      return {
        ...prev,
        permissions: nextPermissions,
      };
    });
  };

  const upsertUser = (nextUser) => {
    setUsers((prev) => {
      const exists = prev.some((item) => item.id === nextUser.id);
      if (!exists) {
        return [nextUser, ...prev];
      }

      return prev.map((item) => (item.id === nextUser.id ? nextUser : item));
    });
  };

  const handleSaveUser = async () => {
    resetFlash();

    if (!form.name.trim() || !form.email.trim()) {
      setFlash({
        variant: "danger",
        message: "Name and email are required",
      });
      return;
    }

    if (!form.id && form.password.trim().length < 6) {
      setFlash({
        variant: "danger",
        message: "New users must have a password of at least 6 characters",
      });
      return;
    }

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
      isActive: form.isActive,
      permissions: form.permissions,
    };

    if (!form.id) {
      payload.password = form.password;
    }

    setSaving(true);
    try {
      if (form.id && !canEditUsers) {
        return;
      }

      if (!form.id && !canCreateUsers) {
        return;
      }

      const res = form.id
        ? await API.put(`/users/${form.id}`, payload)
        : await API.post("/users", payload);

      const savedUser = res.data.user;
      upsertUser(savedUser);

      if (currentUser?.id === savedUser.id) {
        login(savedUser);
      }

      setFlash({
        variant: "success",
        message: form.id ? "User updated successfully" : "User created successfully",
      });
      closeUserModal();
    } catch (err) {
      setFlash({
        variant: "danger",
        message: err.response?.data?.error || "Failed to save user",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSave = async () => {
    resetFlash();

    if (passwordForm.password.trim().length < 6) {
      setFlash({
        variant: "danger",
        message: "Password must be at least 6 characters",
      });
      return;
    }

    if (passwordForm.password !== passwordForm.confirmPassword) {
      setFlash({
        variant: "danger",
        message: "Password confirmation does not match",
      });
      return;
    }

    setPasswordSaving(true);
    try {
      if (!canChangePasswords) {
        return;
      }

      const res = await API.put(`/users/${passwordForm.id}/password`, {
        password: passwordForm.password,
      });
      setFlash({
        variant: "success",
        message: res.data.message || "Password updated successfully",
      });
      closePasswordModal();
    } catch (err) {
      setFlash({
        variant: "danger",
        message: err.response?.data?.error || "Failed to update password",
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleStatusToggle = async (selectedUser) => {
    if (!canEditUsers) {
      return;
    }

    const nextStatus = !selectedUser.isActive;
    const actionLabel = nextStatus ? "restore" : "disable";

    if (!window.confirm(`Do you want to ${actionLabel} ${selectedUser.name}?`)) {
      return;
    }

    setStatusSavingId(selectedUser.id);
    resetFlash();

    try {
      const res = await API.put(`/users/${selectedUser.id}/status`, {
        isActive: nextStatus,
      });

      const updatedUser = res.data.user;
      upsertUser(updatedUser);

      if (currentUser?.id === updatedUser.id) {
        login(updatedUser);
      }

      setFlash({
        variant: "success",
        message: res.data.message || `User ${actionLabel}d successfully`,
      });
    } catch (err) {
      setFlash({
        variant: "danger",
        message: err.response?.data?.error || "Failed to update user status",
      });
    } finally {
      setStatusSavingId(null);
    }
  };

  const handleDeleteUser = async (selectedUser) => {
    if (!canEditUsers) {
      return;
    }

    if (
      !window.confirm(
        `Delete ${selectedUser.name}? This removes the user record permanently.`
      )
    ) {
      return;
    }

    setDeleteSavingId(selectedUser.id);
    resetFlash();

    try {
      const res = await API.delete(`/users/${selectedUser.id}`);
      setUsers((prev) => prev.filter((item) => item.id !== selectedUser.id));
      setFlash({
        variant: "success",
        message: res.data.message || "User deleted successfully",
      });
    } catch (err) {
      setFlash({
        variant: "danger",
        message: err.response?.data?.error || "Failed to delete user",
      });
    } finally {
      setDeleteSavingId(null);
    }
  };

  const roleDefaults = meta.rolePermissions?.[form.role] || [];
  const overrideCount = Object.keys(form.permissions || {}).length;

  return (
    <div className="p-4">
      <Row className="align-items-center mb-4">
        <Col>
          <h3 className="mb-1">User Management</h3>
          <p className="text-muted mb-0">
            Admins can create users, disable or restore access, delete accounts when needed,
            change passwords, and override access per user.
          </p>
          {!canManageUsers && (
            <div className="text-muted small mt-1">
              Read-only access. You can review users and permissions but cannot change them.
            </div>
          )}
        </Col>
        {canCreateUsers && (
          <Col className="text-end">
            <Button onClick={openCreateModal}>Create User</Button>
          </Col>
        )}
      </Row>

      {flash && (
        <Alert variant={flash.variant} onClose={resetFlash} dismissible>
          {flash.message}
        </Alert>
      )}

      <Row className="g-3 mb-4">
        <Col md={3}>
          <Card className="shadow-sm">
            <Card.Body>
              <div className="text-muted small">Total Users</div>
              <h3 className="mb-0">{summary.total}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="shadow-sm">
            <Card.Body>
              <div className="text-muted small">Admins</div>
              <h3 className="mb-0">{summary.admins}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="shadow-sm">
            <Card.Body>
              <div className="text-muted small">Accountants</div>
              <h3 className="mb-0">{summary.accountants}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="shadow-sm">
            <Card.Body>
              <div className="text-muted small">Inactive</div>
              <h3 className="mb-0">{summary.inactive}</h3>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="shadow-sm">
        <Card.Body>
          <Row className="g-3 mb-3">
            <Col md={5}>
              <Form.Control
                placeholder="Search by name or email"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </Col>
            <Col md={3}>
              <Form.Select
                value={roleFilter}
                onChange={(event) => {
                  setRoleFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All roles</option>
                {meta.roles.map((role) => (
                  <option key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Form.Select>
            </Col>
            <Col md={2} className="text-md-end">
              <div className="text-muted small pt-2">
                Showing {filteredUsers.length} user{filteredUsers.length === 1 ? "" : "s"}
              </div>
            </Col>
          </Row>

          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
            </div>
          ) : (
            <>
              <Table responsive bordered hover>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Access</th>
                    {showUserActions && <th className="text-end">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={showUserActions ? 6 : 5} className="text-center py-4">
                        No users found for the current filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedUsers.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="fw-semibold">
                            {item.name}
                            {currentUser?.id === item.id && (
                              <Badge bg="light" text="dark" className="ms-2">
                                You
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td>{item.email}</td>
                        <td>
                          <Badge bg={ROLE_BADGES[item.role] || "secondary"} className="text-capitalize">
                            {item.role}
                          </Badge>
                        </td>
                        <td>
                          <Badge bg={item.isActive ? "success" : "secondary"}>
                            {item.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td>
                          <div>{item.effectivePermissions.length} effective permissions</div>
                          <small className="text-muted">
                            {Object.keys(item.permissions || {}).length} custom override
                            {Object.keys(item.permissions || {}).length === 1 ? "" : "s"}
                          </small>
                        </td>
                        {showUserActions && (
                          <td className="text-end">
                            {canEditUsers && (
                              <Button
                                size="sm"
                                variant="outline-primary"
                                className="me-2"
                                onClick={() => openEditModal(item)}
                              >
                                Edit
                              </Button>
                            )}
                            {canEditUsers && (
                              <Button
                                size="sm"
                                variant={item.isActive ? "outline-warning" : "outline-success"}
                                className={canChangePasswords ? "me-2" : ""}
                                onClick={() => handleStatusToggle(item)}
                                disabled={
                                  statusSavingId === item.id ||
                                  (currentUser?.id === item.id && item.isActive)
                                }
                              >
                                {statusSavingId === item.id
                                  ? "Saving..."
                                  : item.isActive
                                    ? "Disable"
                                    : "Restore"}
                              </Button>
                            )}
                            {canEditUsers && (
                              <Button
                                size="sm"
                                variant="outline-danger"
                                className={canChangePasswords ? "me-2" : ""}
                                onClick={() => handleDeleteUser(item)}
                                disabled={
                                  deleteSavingId === item.id || currentUser?.id === item.id
                                }
                              >
                                {deleteSavingId === item.id ? "Deleting..." : "Delete"}
                              </Button>
                            )}
                            {canChangePasswords && (
                              <Button
                                size="sm"
                                variant="outline-dark"
                                onClick={() => openPasswordModal(item)}
                              >
                                Password
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>

              <Pagination className="mb-0">
                {[...Array(totalPages)].map((_, index) => (
                  <Pagination.Item
                    key={index}
                    active={index + 1 === safePage}
                    onClick={() => setPage(index + 1)}
                  >
                    {index + 1}
                  </Pagination.Item>
                ))}
              </Pagination>
            </>
          )}
        </Card.Body>
      </Card>

      <Modal
        show={showUserModal}
        onHide={closeUserModal}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>{form.id ? "Edit User" : "Create User"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-3 mb-3">
            <Col md={6}>
              <Form.Label>Name</Form.Label>
              <Form.Control
                name="name"
                value={form.name}
                onChange={handleFormChange}
                placeholder="Full name"
              />
            </Col>
            <Col md={6}>
              <Form.Label>Email</Form.Label>
              <Form.Control
                name="email"
                type="email"
                value={form.email}
                onChange={handleFormChange}
                placeholder="Email address"
              />
            </Col>
            <Col md={6}>
              <Form.Label>Role</Form.Label>
              <Form.Select name="role" value={form.role} onChange={handleFormChange}>
                {meta.roles.map((role) => (
                  <option key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={6}>
              <Form.Label>Status</Form.Label>
              <div className="border rounded px-3 py-2">
                <Form.Check
                  type="switch"
                  id="user-active-switch"
                  name="isActive"
                  label={form.isActive ? "Active account" : "Inactive account"}
                  checked={form.isActive}
                  onChange={handleFormChange}
                />
              </div>
            </Col>
            {!form.id && (
              <Col md={12}>
                <Form.Label>Initial Password</Form.Label>
                <Form.Control
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleFormChange}
                  placeholder="Minimum 6 characters"
                />
              </Col>
            )}
          </Row>

          <Card className="bg-light border-0">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div>
                  <div className="fw-semibold">Access Overrides</div>
                  <small className="text-muted">
                    Role defaults grant {roleDefaults.length} permissions. You have {overrideCount} custom override
                    {overrideCount === 1 ? "" : "s"} on this user.
                  </small>
                </div>
              </div>

              <Accordion alwaysOpen>
                {meta.permissionGroups.map((group, index) => (
                  <Accordion.Item eventKey={String(index)} key={group.key}>
                    <Accordion.Header>{group.label}</Accordion.Header>
                    <Accordion.Body>
                      {group.permissions.map((permission) => {
                        const inherited = roleDefaults.includes(permission.key);
                        return (
                          <Row className="align-items-center g-3 mb-3" key={permission.key}>
                            <Col md={6}>
                              <div className="fw-semibold">{permission.label}</div>
                              <small className="text-muted d-block">{permission.description}</small>
                              <small className="text-muted">
                                Default for {form.role}: {inherited ? "Allowed" : "Hidden"}
                              </small>
                            </Col>
                            <Col md={6}>
                              <Form.Select
                                value={getPermissionMode(permission.key)}
                                onChange={(event) =>
                                  updatePermissionMode(permission.key, event.target.value)
                                }
                              >
                                <option value="inherit">
                                  Inherit role default ({inherited ? "Allowed" : "Hidden"})
                                </option>
                                <option value="allow">Force allow</option>
                                <option value="deny">Force deny</option>
                              </Form.Select>
                            </Col>
                          </Row>
                        );
                      })}
                    </Accordion.Body>
                  </Accordion.Item>
                ))}
              </Accordion>
            </Card.Body>
          </Card>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeUserModal}>
            Cancel
          </Button>
          <Button onClick={handleSaveUser} disabled={saving}>
            {saving ? "Saving..." : "Save User"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showPasswordModal}
        onHide={closePasswordModal}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Change Password</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted">
            Set a new password for <span className="fw-semibold">{passwordForm.name}</span>.
          </p>
          <Form.Group className="mb-3">
            <Form.Label>New Password</Form.Label>
            <Form.Control
              type="password"
              name="password"
              value={passwordForm.password}
              onChange={handlePasswordChange}
              placeholder="Minimum 6 characters"
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Confirm Password</Form.Label>
            <Form.Control
              type="password"
              name="confirmPassword"
              value={passwordForm.confirmPassword}
              onChange={handlePasswordChange}
              placeholder="Repeat the password"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closePasswordModal}>
            Cancel
          </Button>
          <Button onClick={handlePasswordSave} disabled={passwordSaving}>
            {passwordSaving ? "Updating..." : "Update Password"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
