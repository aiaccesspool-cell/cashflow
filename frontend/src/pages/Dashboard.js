import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";
import CashFlowChart from "../components/CashFlowChart";
import CategoryBreakdownChart from "../components/CategoryBreakdownChart";
import { useAuth } from "../context/AuthContext";
import { API } from "../services/api";
import { hasPermission } from "../utils/permissions";
import {
  buildReportQuery,
  formatCompactCurrency,
  formatCurrency,
  formatDateRangeLabel,
  formatLongDate,
  formatPercent,
  getPresetRange,
} from "../utils/reporting";

const DASHBOARD_PRESETS = [
  { key: "today", label: "Today" },
  { key: "7days", label: "7 Days" },
  { key: "thisMonth", label: "This Month" },
  { key: "all", label: "All Time" },
];

const initialDashboardData = {
  filters: getPresetRange("thisMonth"),
  summary: {
    income: 0,
    expense: 0,
    balance: 0,
    totalTransactions: 0,
    averageTransaction: 0,
  },
  cashFlow: {
    grouping: "month",
    points: [],
  },
  categories: [],
  highlights: {
    topCategory: null,
    strongestIncomePeriod: null,
    strongestExpensePeriod: null,
    marginRate: null,
  },
  recentTransactions: [],
  accounts: [],
  accountSummary: {
    totalAccounts: 0,
    totalBalance: 0,
  },
};

export default function Dashboard() {
  const { user } = useAuth();
  const canViewTransactions = hasPermission(user, "transactions.view");
  const canViewAccounts = hasPermission(user, "accounts.view");

  const [filters, setFilters] = useState(getPresetRange("thisMonth"));
  const [activePreset, setActivePreset] = useState("thisMonth");
  const [dashboard, setDashboard] = useState(initialDashboardData);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [refreshIndex, setRefreshIndex] = useState(0);
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    let ignore = false;

    const loadDashboard = async () => {
      if (!hasLoadedOnce.current) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      try {
        const query = buildReportQuery(filters);
        const endpoint = query ? `/reports/dashboard?${query}` : "/reports/dashboard";
        const response = await API.get(endpoint);

        if (!ignore) {
          setDashboard(response.data);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.error || "Failed to load dashboard data.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
          setRefreshing(false);
          hasLoadedOnce.current = true;
        }
      }
    };

    loadDashboard();

    return () => {
      ignore = true;
    };
  }, [filters, refreshIndex]);

  const applyPreset = (preset) => {
    setActivePreset(preset);
    setFilters(getPresetRange(preset));
  };

  const handleDateChange = (event) => {
    const { name, value } = event.target;
    setActivePreset("custom");
    setFilters((currentFilters) => ({
      ...currentFilters,
      [name]: value,
    }));
  };

  const summaryCards = [
    {
      label: "Total income",
      value: formatCurrency(dashboard.summary.income),
      tone: "income",
      helper:
        dashboard.highlights.strongestIncomePeriod?.income > 0
          ? `Best period: ${dashboard.highlights.strongestIncomePeriod.label}`
          : "No income recorded in the selected range",
    },
    {
      label: "Total expense",
      value: formatCurrency(dashboard.summary.expense),
      tone: "expense",
      helper:
        dashboard.highlights.topCategory?.name
          ? `Top category: ${dashboard.highlights.topCategory.name}`
          : "No strong category pattern yet",
    },
    {
      label: "Net position",
      value: formatCurrency(dashboard.summary.balance),
      tone: "balance",
      helper:
        dashboard.highlights.marginRate !== null
          ? `Margin: ${formatPercent(dashboard.highlights.marginRate)}`
          : "Margin appears after income is recorded",
    },
    {
      label: "Transactions",
      value: `${dashboard.summary.totalTransactions}`,
      tone: "neutral",
      helper: `Average ${formatCurrency(dashboard.summary.averageTransaction)} each`,
    },
  ];

  if (loading) {
    return (
      <div className="analytics-page analytics-page-loading">
        <div className="analytics-loading">
          <Spinner animation="border" />
          <span>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-page">
      <div className="analytics-header-row">
        <div>
          <h2 className="analytics-page-title">Dashboard</h2>
    
        </div>

        <div className="analytics-chip-list">
          <span className="analytics-chip">{formatDateRangeLabel(filters)}</span>
          <span className="analytics-chip">
            {dashboard.cashFlow.grouping === "day" ? "Daily trend" : "Monthly trend"}
          </span>
          <span className="analytics-chip">
            {dashboard.summary.totalTransactions} transactions
          </span>
        </div>
      </div>

      <Card className="analytics-card analytics-filter-card mb-4">
        <Card.Body>
          <Row className="g-3 align-items-end">
            <Col xl={5}>
              <Form.Label className="analytics-filter-label">Quick range</Form.Label>
              <div className="analytics-preset-group">
                {DASHBOARD_PRESETS.map((preset) => (
                  <Button
                    key={preset.key}
                    type="button"
                    variant={activePreset === preset.key ? "dark" : "outline-secondary"}
                    size="sm"
                    onClick={() => applyPreset(preset.key)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </Col>

            <Col md={6} xl={2}>
              <Form.Label className="analytics-filter-label">From</Form.Label>
              <Form.Control
                type="date"
                name="fromDate"
                value={filters.fromDate}
                onChange={handleDateChange}
              />
            </Col>

            <Col md={6} xl={2}>
              <Form.Label className="analytics-filter-label">To</Form.Label>
              <Form.Control
                type="date"
                name="toDate"
                value={filters.toDate}
                onChange={handleDateChange}
              />
            </Col>

            <Col xl={3}>
              <div className="analytics-filter-actions">
                <Button variant="dark" onClick={() => setRefreshIndex((value) => value + 1)}>
                  Refresh
                </Button>
                <span>{refreshing ? "Refreshing data..." : "Filters apply to all report widgets."}</span>
              </div>
            </Col>
          </Row>

          {error && (
            <Alert variant="danger" className="analytics-inline-alert mb-0 mt-3">
              {error}
            </Alert>
          )}
        </Card.Body>
      </Card>

      <Row className="g-4">
        {summaryCards.map((card) => (
          <Col key={card.label} md={6} xl={3}>
            <Card className={`analytics-card metric-card metric-card-${card.tone}`}>
              <Card.Body>
                <span className="metric-card-label">{card.label}</span>
                <strong className="metric-card-value">{card.value}</strong>
                <span className="metric-card-helper">{card.helper}</span>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      <Row className="g-4 mt-1">
        <Col xl={8}>
          <Card className="analytics-card h-100">
            <Card.Body>
              <div className="analytics-card-head">
                <div>
                  <span className="analytics-section-label">Trend</span>
                  <h4>Income vs expense</h4>
                </div>
                <Badge bg="light" text="dark" className="analytics-soft-badge">
                  {dashboard.cashFlow.grouping === "day" ? "Daily" : "Monthly"}
                </Badge>
              </div>

              <CashFlowChart
                points={dashboard.cashFlow.points}
                grouping={dashboard.cashFlow.grouping}
              />
            </Card.Body>
          </Card>
        </Col>

        <Col xl={4}>
          <Card className="analytics-card h-100">
            <Card.Body>
              <div className="analytics-card-head">
                <div>
                  <span className="analytics-section-label">Breakdown</span>
                  <h4>Category mix</h4>
                </div>
                <Badge bg="light" text="dark" className="analytics-soft-badge">
                  {dashboard.categories.length} items
                </Badge>
              </div>

              <CategoryBreakdownChart categories={dashboard.categories} />
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-4 mt-1">
        {canViewTransactions && (
          <Col xl={7}>
            <Card className="analytics-card h-100">
              <Card.Body>
                <div className="analytics-card-head">
                  <div>
                    <span className="analytics-section-label">Recent activity</span>
                    <h4>Transactions</h4>
                  </div>
                  <Badge bg="light" text="dark" className="analytics-soft-badge">
                    {dashboard.recentTransactions.length} shown
                  </Badge>
                </div>

                {dashboard.recentTransactions.length ? (
                  <div className="analytics-table-wrap">
                    <Table hover responsive className="analytics-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Description</th>
                          <th>Category</th>
                          <th>Type</th>
                          <th className="text-end">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.recentTransactions.map((transaction) => (
                          <tr key={transaction.id}>
                            <td>{formatLongDate(transaction.transaction_date)}</td>
                            <td>
                              <strong>{transaction.description}</strong>
                              <div className="analytics-muted">
                                {transaction.Account?.name || "No account"}
                              </div>
                            </td>
                            <td>{transaction.Category?.name || "Uncategorized"}</td>
                            <td>
                              <Badge
                                bg={transaction.type === "income" ? "success" : "danger"}
                                pill
                              >
                                {transaction.type}
                              </Badge>
                            </td>
                            <td className="text-end">{formatCurrency(transaction.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                ) : (
                  <div className="analytics-empty-state analytics-empty-state-small">
                    <strong>No transactions in this range</strong>
                    <span>Activity will appear here once transactions are recorded.</span>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        )}

        <Col xl={canViewTransactions ? 5 : 12}>
          <Row className="g-4">
            {canViewAccounts && (
              <Col xs={12}>
                <Card className="analytics-card">
                  <Card.Body>
                    <div className="analytics-card-head">
                      <div>
                        <span className="analytics-section-label">Accounts</span>
                        <h4>Balance snapshot</h4>
                      </div>
                      <Badge bg="light" text="dark" className="analytics-soft-badge">
                        {dashboard.accountSummary.totalAccounts} tracked
                      </Badge>
                    </div>

                    <div className="analytics-account-total">
                      <span>Total tracked balance</span>
                      <strong>{formatCurrency(dashboard.accountSummary.totalBalance)}</strong>
                    </div>

                    {dashboard.accounts.length ? (
                      <div className="analytics-stack-list">
                        {dashboard.accounts.map((account) => (
                          <div key={account.id} className="analytics-stack-list-item">
                            <div>
                              <strong>{account.name}</strong>
                              <span>Current balance</span>
                            </div>
                            <strong>{formatCurrency(account.balance)}</strong>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="analytics-empty-state analytics-empty-state-small">
                        <strong>No accounts to show</strong>
                        <span>Create accounts to surface a balance snapshot.</span>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            )}

            <Col xs={12}>
              <Card className="analytics-card h-100">
                <Card.Body>
                  <div className="analytics-card-head">
                    <div>
                      <span className="analytics-section-label">Highlights</span>
                      <h4>Key signals</h4>
                    </div>
                  </div>

                  <div className="analytics-signal-grid">
                    <div className="analytics-signal-item">
                      <span>Top category</span>
                      <strong>{dashboard.highlights.topCategory?.name || "No clear leader"}</strong>
                      <small>
                        {dashboard.highlights.topCategory
                          ? formatCompactCurrency(dashboard.highlights.topCategory.total)
                          : "Needs more categorized data"}
                      </small>
                    </div>

                    <div className="analytics-signal-item">
                      <span>Peak income period</span>
                      <strong>
                        {dashboard.highlights.strongestIncomePeriod?.label || "Not available"}
                      </strong>
                      <small>
                        {dashboard.highlights.strongestIncomePeriod
                          ? formatCurrency(dashboard.highlights.strongestIncomePeriod.income)
                          : "No income in selected range"}
                      </small>
                    </div>

                    <div className="analytics-signal-item">
                      <span>Peak expense period</span>
                      <strong>
                        {dashboard.highlights.strongestExpensePeriod?.label || "Not available"}
                      </strong>
                      <small>
                        {dashboard.highlights.strongestExpensePeriod
                          ? formatCurrency(dashboard.highlights.strongestExpensePeriod.expense)
                          : "No expense in selected range"}
                      </small>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>
    </div>
  );
}
