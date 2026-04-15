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

export default function Categories() {
  const { can, canAny } = usePermissions();
  const canCreate = can("categories.create");
  const canEdit = can("categories.edit");
  const canDelete = can("categories.delete");
  const canManage = canAny([
    "categories.create",
    "categories.edit",
    "categories.delete",
  ]);

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    id: null,
    name: "",
    type: "expense",
  });

  const [page, setPage] = useState(1);
  const pageSize = 5;

  const fetchCategories = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await API.get("/categories");
      setCategories(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openCreateModal = () => {
    if (!canCreate) {
      return;
    }

    setForm({ id: null, name: "", type: "expense" });
    setShow(true);
  };

  const openEditModal = (category) => {
    if (!canEdit) {
      return;
    }

    setForm(category);
    setShow(true);
  };

  const handleClose = () => setShow(false);

  const handleChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError("Category name is required");
      return;
    }

    try {
      if (form.id) {
        if (!canEdit) {
          return;
        }
        await API.put(`/categories/${form.id}`, {
          name: form.name.trim(),
          type: form.type,
        });
      } else {
        if (!canCreate) {
          return;
        }
        await API.post("/categories", {
          name: form.name.trim(),
          type: form.type,
        });
      }

      await fetchCategories();
      handleClose();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save category");
    }
  };

  const handleDelete = async (id) => {
    if (!canDelete) {
      return;
    }

    if (!window.confirm("Delete this category?")) {
      return;
    }

    try {
      await API.delete(`/categories/${id}`);
      await fetchCategories();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete category");
    }
  };

  const totalPages = Math.max(Math.ceil(categories.length / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const paginated = categories.slice((safePage - 1) * pageSize, safePage * pageSize);
  const showActions = canEdit || canDelete;

  return (
    <div className="p-3">
      <Row className="mb-3 align-items-center">
        <Col>
          <h4 className="mb-1">Categories</h4>
          {!canManage && (
            <div className="text-muted small">
              Read-only access. You can view categories but cannot change them.
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
            <th>Type</th>
            {showActions && <th>Actions</th>}
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td colSpan={showActions ? 4 : 3} className="text-center">
                <Spinner size="sm" /> Loading...
              </td>
            </tr>
          ) : paginated.length === 0 ? (
            <tr>
              <td colSpan={showActions ? 4 : 3} className="text-center">
                No categories found
              </td>
            </tr>
          ) : (
            paginated.map((category) => (
              <tr key={category.id}>
                <td>{category.id}</td>
                <td>{category.name}</td>
                <td>
                  {category.type === "income"
                    ? "Income"
                    : category.type === "expense"
                      ? "Expense"
                      : category.type}
                </td>
                {showActions && (
                  <td>
                    {canEdit && (
                      <Button
                        size="sm"
                        onClick={() => openEditModal(category)}
                        className="me-2"
                      >
                        Edit
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDelete(category.id)}
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
          <Modal.Title>{form.id ? "Edit" : "Add"} Category</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form>
            <Form.Control
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Category name"
              className="mb-2"
            />

            <Form.Select
              name="type"
              value={form.type}
              onChange={handleChange}
              className="mb-2"
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </Form.Select>
          </Form>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Save
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
