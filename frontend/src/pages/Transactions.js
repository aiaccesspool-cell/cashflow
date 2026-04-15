import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Col,
  Form,
  Modal,
  Pagination,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";
import { API } from "../services/api";
import usePermissions from "../hooks/usePermissions";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const buildVisiblePages = (currentPage, totalPages, maxVisible = 5) => {
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const halfWindow = Math.floor(maxVisible / 2);
  let start = Math.max(currentPage - halfWindow, 1);
  let end = start + maxVisible - 1;

  if (end > totalPages) {
    end = totalPages;
    start = end - maxVisible + 1;
  }

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

const getBlobErrorMessage = async (err, fallbackMessage) => {
  const blob = err.response?.data;

  if (blob instanceof Blob) {
    try {
      const text = await blob.text();
      const parsed = JSON.parse(text);
      return parsed.error || fallbackMessage;
    } catch (parseError) {
      return fallbackMessage;
    }
  }

  return err.response?.data?.error || fallbackMessage;
};

export default function Transactions() {
  const { can, canAny } = usePermissions();
  const canCreate = can("transactions.create");
  const canEdit = can("transactions.edit");
  const canDelete = can("transactions.delete");
  const canExport = can("transactions.export");
  const canManage = canAny([
    "transactions.create",
    "transactions.edit",
    "transactions.delete",
  ]);
  const canViewCategories = can("categories.view");
  const canViewAccounts = can("accounts.view");

  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState("");
  const [form, setForm] = useState({
    id: null,
    description: "",
    amount: "",
    type: "expense",
    accountId: "",
    categoryId: "",
    date: "",
  });
  const [errors, setErrors] = useState({});
  const [filters, setFilters] = useState({
    search: "",
    type: "",
    fromDate: "",
    toDate: "",
    accountId: "",
    categoryId: "",
    pageSize: 10,
  });
  const [page, setPage] = useState(1);

  const showActions = canEdit || canDelete;

  const queryParams = useMemo(
    () => ({
      page,
      pageSize: filters.pageSize,
      search: filters.search || undefined,
      type: filters.type || undefined,
      fromDate: filters.fromDate || undefined,
      toDate: filters.toDate || undefined,
      accountId: filters.accountId || undefined,
      categoryId: filters.categoryId || undefined,
    }),
    [filters, page]
  );

  const exportParams = useMemo(
    () => ({
      search: filters.search || undefined,
      type: filters.type || undefined,
      fromDate: filters.fromDate || undefined,
      toDate: filters.toDate || undefined,
      accountId: filters.accountId || undefined,
      categoryId: filters.categoryId || undefined,
    }),
    [filters]
  );

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await API.get("/transactions", { params: queryParams });

      setTransactions(res.data.data);
      setTotalPages(res.data.totalPages || 1);
      setTotal(res.data.total || 0);
      setStartIndex(res.data.startIndex || 0);
      setEndIndex(res.data.endIndex || 0);

      if (page > (res.data.totalPages || 1)) {
        setPage(res.data.totalPages || 1);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [page, queryParams]);

  const fetchCategories = async () => {
    try {
      const res = await API.get("/categories");
      setCategories(res.data);
    } catch (err) {
      setError((current) => current || err.response?.data?.error || "Failed to load categories");
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await API.get("/accounts");
      setAccounts(res.data);
    } catch (err) {
      setError((current) => current || err.response?.data?.error || "Failed to load accounts");
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    if (canViewCategories) {
      fetchCategories();
    }

    if (canViewAccounts) {
      fetchAccounts();
    }
  }, [canViewAccounts, canViewCategories]);

  const resetForm = () => {
    setForm({
      id: null,
      description: "",
      amount: "",
      type: "expense",
      categoryId: "",
      accountId: accounts.length ? String(accounts[0].id) : "",
      date: "",
    });
  };

  const updateFilter = (key, value) => {
    setPage(1);
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const applyDatePreset = (preset) => {
    const today = new Date();

    if (preset === "today") {
      const formatted = formatDateInput(today);
      setPage(1);
      setFilters((current) => ({
        ...current,
        fromDate: formatted,
        toDate: formatted,
      }));
      return;
    }

    if (preset === "last7") {
      const start = new Date(today);
      start.setDate(today.getDate() - 6);
      setPage(1);
      setFilters((current) => ({
        ...current,
        fromDate: formatDateInput(start),
        toDate: formatDateInput(today),
      }));
      return;
    }

    if (preset === "month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setPage(1);
      setFilters((current) => ({
        ...current,
        fromDate: formatDateInput(start),
        toDate: formatDateInput(today),
      }));
    }
  };

  const clearFilters = () => {
    setPage(1);
    setFilters({
      search: "",
      type: "",
      fromDate: "",
      toDate: "",
      accountId: "",
      categoryId: "",
      pageSize: filters.pageSize,
    });
  };

  const openCreateModal = () => {
    if (!canCreate) {
      return;
    }

    resetForm();
    setErrors({});
    setShow(true);
  };

  const openEditModal = (transaction) => {
    if (!canEdit) {
      return;
    }

    setForm({
      id: transaction.id,
      description: transaction.description,
      amount: transaction.amount,
      type: transaction.type,
      categoryId: transaction.categoryId || "",
      accountId: transaction.accountId || "",
      date: transaction.transaction_date?.split("T")[0],
    });
    setErrors({});
    setShow(true);
  };

  const handleClose = () => setShow(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const validate = () => {
    const nextErrors = {};

    if (!form.description.trim()) nextErrors.description = "Required";
    if (!form.amount || Number(form.amount) <= 0) nextErrors.amount = "Invalid amount";
    if (!form.date) nextErrors.date = "Required";
    if (canViewAccounts && !form.accountId) nextErrors.accountId = "Select an account";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    if (canViewAccounts && accounts.length === 0) {
      setError("Create at least one account before adding transactions.");
      return;
    }

    const payload = {
      description: form.description.trim(),
      amount: Number(form.amount),
      type: form.type,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      accountId: form.accountId ? Number(form.accountId) : null,
      transaction_date: form.date,
    };

    try {
      if (form.id) {
        if (!canEdit) {
          return;
        }

        await API.put(`/transactions/${form.id}`, payload);
      } else {
        if (!canCreate) {
          return;
        }

        await API.post("/transactions", payload);
      }

      await fetchTransactions();
      handleClose();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save transaction");
    }
  };

  const handleDelete = async (id) => {
    if (!canDelete) {
      return;
    }

    if (!window.confirm("Delete this transaction?")) {
      return;
    }

    try {
      await API.delete(`/transactions/${id}`);
      await fetchTransactions();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete transaction");
    }
  };

  const downloadExport = async (format) => {
    setExporting(format);
    setError("");

    try {
      const res = await API.get(`/transactions/export/${format}`, {
        params: exportParams,
        responseType: "blob",
      });

      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      const extension = format === "csv" ? "csv" : "pdf";
      link.href = blobUrl;
      link.download = `transactions-export.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      const message = await getBlobErrorMessage(
        err,
        `Failed to export ${format.toUpperCase()}`
      );
      setError(message);
    } finally {
      setExporting("");
    }
  };

  const visiblePages = buildVisiblePages(page, Math.max(totalPages, 1));

  return (
    <div className="p-3">
      <Row className="mb-3 align-items-center">
        <Col>
          <h4 className="mb-1">Transactions</h4>
          {!canManage && (
            <div className="text-muted small">
              Read-only access. You can search, filter, and export transactions but cannot change them.
            </div>
          )}
        </Col>
        <Col className="text-end">
          {canExport && (
            <>
              <Button
                variant="outline-secondary"
                className="me-2"
                onClick={() => downloadExport("csv")}
                disabled={exporting !== ""}
              >
                {exporting === "csv" ? "Exporting CSV..." : "Export CSV"}
              </Button>
              <Button
                variant="outline-dark"
                className={canCreate ? "me-2" : ""}
                onClick={() => downloadExport("pdf")}
                disabled={exporting !== ""}
              >
                {exporting === "pdf" ? "Exporting PDF..." : "Export PDF"}
              </Button>
            </>
          )}
          {canCreate && <Button onClick={openCreateModal}>Add</Button>}
        </Col>
      </Row>

      {error && (
        <Alert variant="danger" onClose={() => setError("")} dismissible>
          {error}
        </Alert>
      )}

      <Row className="g-3 mb-3">
        <Col md={4}>
          <Form.Control
            placeholder="Search description"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
          />
        </Col>
        <Col md={2}>
          <Form.Select
            value={filters.type}
            onChange={(event) => updateFilter("type", event.target.value)}
          >
            <option value="">All types</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </Form.Select>
        </Col>
        {canViewAccounts && (
          <Col md={3}>
            <Form.Select
              value={filters.accountId}
              onChange={(event) => updateFilter("accountId", event.target.value)}
            >
              <option value="">All accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Form.Select>
          </Col>
        )}
        {canViewCategories && (
          <Col md={3}>
            <Form.Select
              value={filters.categoryId}
              onChange={(event) => updateFilter("categoryId", event.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Form.Select>
          </Col>
        )}
      </Row>

      <Row className="g-3 mb-3 align-items-end">
        <Col md={3}>
          <Form.Label className="small text-muted">From Date</Form.Label>
          <Form.Control
            type="date"
            value={filters.fromDate}
            onChange={(event) => updateFilter("fromDate", event.target.value)}
          />
        </Col>
        <Col md={3}>
          <Form.Label className="small text-muted">To Date</Form.Label>
          <Form.Control
            type="date"
            value={filters.toDate}
            onChange={(event) => updateFilter("toDate", event.target.value)}
          />
        </Col>
        <Col md={3}>
          <Form.Label className="small text-muted">Page Size</Form.Label>
          <Form.Select
            value={filters.pageSize}
            onChange={(event) => updateFilter("pageSize", Number(event.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </Form.Select>
        </Col>
        <Col md={3}>
          <div className="d-flex flex-wrap gap-2">
            <Button variant="outline-primary" size="sm" onClick={() => applyDatePreset("today")}>
              Today
            </Button>
            <Button variant="outline-primary" size="sm" onClick={() => applyDatePreset("last7")}>
              7 Days
            </Button>
            <Button variant="outline-primary" size="sm" onClick={() => applyDatePreset("month")}>
              This Month
            </Button>
            <Button variant="outline-secondary" size="sm" onClick={clearFilters}>
              Clear
            </Button>
          </div>
        </Col>
      </Row>

      <Row className="mb-2">
        <Col>
          <div className="text-muted small">
            Showing {startIndex}-{endIndex} of {total} transaction{total === 1 ? "" : "s"}
          </div>
        </Col>
      </Row>

      <Table bordered hover responsive>
        <thead>
          <tr>
            <th>ID</th>
            <th>Date</th>
            <th>Description</th>
            <th>Type</th>
            <th>Category</th>
            <th>Account</th>
            <th>Amount</th>
            {showActions && <th>Actions</th>}
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td colSpan={showActions ? 8 : 7} className="text-center">
                <Spinner size="sm" /> Loading...
              </td>
            </tr>
          ) : transactions.length === 0 ? (
            <tr>
              <td colSpan={showActions ? 8 : 7} className="text-center">
                No transactions found
              </td>
            </tr>
          ) : (
            transactions.map((transaction) => (
              <tr key={transaction.id}>
                <td>{transaction.id}</td>
                <td>{new Date(transaction.transaction_date).toLocaleDateString()}</td>
                <td>{transaction.description}</td>
                <td>
                  {transaction.type === "income"
                    ? "Income"
                    : transaction.type === "expense"
                      ? "Expense"
                      : transaction.type}
                </td>
                <td>{transaction.Category?.name || "-"}</td>
                <td>{transaction.Account?.name || "-"}</td>
                <td>{Number(transaction.amount).toFixed(2)}</td>
                {showActions && (
                  <td>
                    {canEdit && (
                      <Button
                        size="sm"
                        onClick={() => openEditModal(transaction)}
                        className="me-2"
                      >
                        Edit
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDelete(transaction.id)}
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

      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div className="text-muted small">
          Page {page} of {Math.max(totalPages, 1)}
        </div>
        <Pagination className="mb-0">
          <Pagination.First onClick={() => setPage(1)} disabled={page === 1} />
          <Pagination.Prev onClick={() => setPage((current) => Math.max(current - 1, 1))} disabled={page === 1} />
          {visiblePages.map((pageNumber) => (
            <Pagination.Item
              key={pageNumber}
              active={pageNumber === page}
              onClick={() => setPage(pageNumber)}
            >
              {pageNumber}
            </Pagination.Item>
          ))}
          <Pagination.Next
            onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
            disabled={page === totalPages}
          />
          <Pagination.Last onClick={() => setPage(totalPages)} disabled={page === totalPages} />
        </Pagination>
      </div>

      <Modal show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>{form.id ? "Edit" : "Add"} Transaction</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form>
            <Form.Control
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              className="mb-2"
            />
            {errors.date && <small className="text-danger">{errors.date}</small>}

            <Form.Control
              name="description"
              value={form.description}
              onChange={handleChange}
              className="mb-2"
              placeholder="Description"
            />
            {errors.description && <small className="text-danger">{errors.description}</small>}

            <Form.Select
              name="type"
              value={form.type}
              onChange={handleChange}
              className="mb-2"
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </Form.Select>

            {canViewCategories && (
              <Form.Select
                name="categoryId"
                value={form.categoryId || ""}
                onChange={handleChange}
                className="mb-2"
              >
                <option value="">Select Category</option>
                {categories
                  .filter((category) => category.type === form.type)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </Form.Select>
            )}

            {canViewAccounts && (
              <Form.Select
                name="accountId"
                value={form.accountId || ""}
                onChange={handleChange}
                className="mb-2"
              >
                <option value="" disabled>
                  {accounts.length ? "Select Account" : "No accounts available"}
                </option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Form.Select>
            )}
            {errors.accountId && <small className="text-danger">{errors.accountId}</small>}

            <Form.Control
              type="number"
              name="amount"
              value={form.amount}
              onChange={handleChange}
            />
            {errors.amount && <small className="text-danger">{errors.amount}</small>}
          </Form>
        </Modal.Body>

        <Modal.Footer>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit}>Save</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
