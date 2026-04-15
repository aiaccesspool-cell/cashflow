import { useEffect, useState } from "react";
import {
  Alert,
  Table,
  Button,
  Form,
  Modal,
  Row,
  Col,
  Pagination,
  Spinner,
} from "react-bootstrap";
import { API } from "../services/api";
import usePermissions from "../hooks/usePermissions";

export default function Accounts() {
  const { can, canAny } = usePermissions();
  const canCreate = can("accounts.create");
  const canEdit = can("accounts.edit");
  const canDelete = can("accounts.delete");
  const canManage = canAny([
    "accounts.create",
    "accounts.edit",
    "accounts.delete",
  ]);

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    id: null,
    name: "",
    openingBalance: "0",
  });

  const [page, setPage] = useState(1);
  const pageSize = 5;

  const fetchAccounts = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await API.get("/accounts");
      setAccounts(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const openCreateModal = () => {
    if (!canCreate) {
      return;
    }

    setForm({ id: null, name: "", openingBalance: "0" });
    setShow(true);
  };

  const openEditModal = (account) => {
    if (!canEdit) {
      return;
    }

    setForm({
      id: account.id,
      name: account.name,
      openingBalance:
        account.openingBalance !== undefined && account.openingBalance !== null
          ? String(account.openingBalance)
          : String(account.balance || 0),
    });
    setShow(true);
  };

  const handleClose = () => setShow(false);

  const handleChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError("Account name is required");
      return;
    }

    const openingBalance = Number(form.openingBalance);
    if (!Number.isFinite(openingBalance)) {
      setError("Opening balance must be a valid number");
      return;
    }

    try {
      if (form.id) {
        if (!canEdit) {
          return;
        }

        await API.put(`/accounts/${form.id}`, {
          name: form.name.trim(),
          openingBalance,
        });
      } else {
        if (!canCreate) {
          return;
        }

        await API.post("/accounts", {
          name: form.name.trim(),
          openingBalance,
        });
      }

      await fetchAccounts();
      handleClose();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save account");
    }
  };

  const handleDelete = async (id) => {
    if (!canDelete) {
      return;
    }

    if (!window.confirm("Delete this account?")) {
      return;
    }

    try {
      await API.delete(`/accounts/${id}`);
      await fetchAccounts();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete account");
    }
  };

  const totalPages = Math.max(Math.ceil(accounts.length / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const paginated = accounts.slice((safePage - 1) * pageSize, safePage * pageSize);
  const showActions = canEdit || canDelete;

  return (
    <div className="p-3">
      <Row className="mb-3 align-items-center">
        <Col>
          <h4 className="mb-1">Accounts</h4>
          <div className="text-muted small">
            Final balance = opening balance + income - expense transactions.
          </div>
          {!canManage && (
            <div className="text-muted small">
              Read-only access. You can view accounts but cannot change them.
            </div>
          )}
        </Col>
        {canCreate && (
          <Col className="text-end">
            <Button onClick={openCreateModal}>Add</Button>
          </Col>
        )}
      </Row>

      {error && (
        <Alert variant="danger" onClose={() => setError("")} dismissible>
          {error}
        </Alert>
      )}

      <Table bordered hover>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Opening</th>
            <th>Balance</th>
            {showActions && <th>Actions</th>}
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td colSpan={showActions ? 5 : 4} className="text-center">
                <Spinner size="sm" /> Loading...
              </td>
            </tr>
          ) : paginated.length === 0 ? (
            <tr>
              <td colSpan={showActions ? 5 : 4} className="text-center">
                No accounts found
              </td>
            </tr>
          ) : (
            paginated.map((account) => (
              <tr key={account.id}>
                <td>{account.id}</td>
                <td>{account.name}</td>
                <td>{Number(account.openingBalance || 0).toFixed(2)}</td>
                <td>{Number(account.balance || 0).toFixed(2)}</td>
                {showActions && (
                  <td>
                    {canEdit && (
                      <Button
                        size="sm"
                        onClick={() => openEditModal(account)}
                        className="me-2"
                      >
                        Edit
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDelete(account.id)}
                      >
                        Delete
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </Table>

      <Pagination>
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

      <Modal show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>{form.id ? "Edit" : "Add"} Account</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form>
            <Form.Control
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Account name"
              className="mb-2"
            />
            <Form.Control
              name="openingBalance"
              type="number"
              step="0.01"
              value={form.openingBalance}
              onChange={handleChange}
              placeholder="Opening balance"
            />
          </Form>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Save</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
