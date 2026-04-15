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
  formatPercent,
  getPresetRange,
} from "../utils/reporting";

const REPORT_PRESETS = [
  { key: "today", label: "Today" },
  { key: "7days", label: "7 Days" },
  { key: "thisMonth", label: "This Month" },
  { key: "all", label: "All Time" },
];

const initialReportData = {
  filters: getPresetRange("all"),
  summary: {
    income: 0,
    expense: 0,
    balance: 0,
    totalTransactions: 0,
    averageTransaction: 0,
    totalVolume: 0,
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
  accountSummary: {
    totalAccounts: 0,
    totalBalance: 0,
  },
};

export default function Reports() {
  const { user } = useAuth();
  const canViewAccounts = hasPermission(user, "accounts.view");

  const [filters, setFilters] = useState(getPresetRange("all"));
  const [activePreset, setActivePreset] = useState("all");
  const [reportData, setReportData] = useState(initialReportData);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [refreshIndex, setRefreshIndex] = useState(0);
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    let ignore = false;

    const loadReports = async () => {
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
          setReportData(response.data);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.response?.data?.error || "Failed to load reports.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
          setRefreshing(false);
          hasLoadedOnce.current = true;
        }
      }
    };

    loadReports();

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

  const metricCards = [
    {
      label: "Income",
      value: formatCurrency(reportData.summary.income),
      helper: `${reportData.summary.totalTransactions} transactions in range`,
      tone: "income",
    },
    {
      label: "Expense",
      value: formatCurrency(reportData.summary.expense),
      helper: `${formatCompactCurrency(reportData.summary.totalVolume)} total movement`,
      tone: "expense",
    },
    {
      label: "Net result",
      value: formatCurrency(reportData.summary.balance),
      helper:
        reportData.highlights.marginRate !== null
          ? `${formatPercent(reportData.highlights.marginRate)} margin`
          : "Margin unavailable without income",
      tone: "balance",
    },
    {
      label: canViewAccounts ? "Tracked balance" : "Average transaction",
      value: canViewAccounts
        ? formatCurrency(reportData.accountSummary.totalBalance)
        : formatCurrency(reportData.summary.averageTransaction),
      helper: canViewAccounts
        ? `${reportData.accountSummary.totalAccounts} accounts in snapshot`
        : "Average amount per transaction",
      tone: "neutral",
    },
  ];

  if (loading) {
    return (
      <div className="analytics-page analytics-page-loading">
        <div className="analytics-loading">
          <Spinner animation="border" />
          <span>Loading reports...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-page">
      <div className="analytics-header-row">
        <div>
          <h2 className="analytics-page-title">Reports</h2>
          <p className="analytics-page-subtitle">
            Use the date range below to review cash flow trends, category ranking, and
            reporting highlights in a simpler layout.
          </p>
        </div>

        <div className="analytics-chip-list">
          <span className="analytics-chip">{formatDateRangeLabel(filters)}</span>
          <span className="analytics-chip">
            {reportData.cashFlow.grouping === "day" ? "Daily analysis" : "Monthly analysis"}
          </span>
          <span className="analytics-chip">{reportData.categories.length} ranked categories</span>
        </div>
      </div>

      <Card className="analytics-card analytics-filter-card mb-4">
        <Card.Body>
          <Row className="g-3 align-items-end">
            <Col xl={5}>
              <Form.Label className="analytics-filter-label">Quick range</Form.Label>
              <div className="analytics-preset-group">
                {REPORT_PRESETS.map((preset) => (
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
                <span>{refreshing ? "Refreshing reports..." : "The same range drives all report cards and charts."}</span>
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
        {metricCards.map((card) => (
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
                  <h4>Cash flow over time</h4>
                </div>
                <Badge bg="light" text="dark" className="analytics-soft-badge">
                  {reportData.cashFlow.points.length} points
                </Badge>
              </div>

              <CashFlowChart
                points={reportData.cashFlow.points}
                grouping={reportData.cashFlow.grouping}
              />
            </Card.Body>
          </Card>
        </Col>

        <Col xl={4}>
          <Card className="analytics-card h-100">
            <Card.Body>
              <div className="analytics-card-head">
                <div>
                  <span className="analytics-section-label">Highlights</span>
                  <h4>Reporting signals</h4>
                </div>
              </div>

              <div className="analytics-signal-grid">
                <div className="analytics-signal-item">
                  <span>Top category</span>
                  <strong>{reportData.highlights.topCategory?.name || "No leader yet"}</strong>
                  <small>
                    {reportData.highlights.topCategory
                      ? `${formatCurrency(reportData.highlights.topCategory.total)} across ${reportData.highlights.topCategory.count} transactions`
                      : "More categorized transactions will improve this ranking."}
                  </small>
                </div>

                <div className="analytics-signal-item">
                  <span>Strongest income period</span>
                  <strong>
                    {reportData.highlights.strongestIncomePeriod?.label || "Not available"}
                  </strong>
                  <small>
                    {reportData.highlights.strongestIncomePeriod
                      ? formatCurrency(reportData.highlights.strongestIncomePeriod.income)
                      : "No income inside the selected range."}
                  </small>
                </div>

                <div className="analytics-signal-item">
                  <span>Strongest expense period</span>
                  <strong>
                    {reportData.highlights.strongestExpensePeriod?.label || "Not available"}
                  </strong>
                  <small>
                    {reportData.highlights.strongestExpensePeriod
                      ? formatCurrency(reportData.highlights.strongestExpensePeriod.expense)
                      : "No expense inside the selected range."}
                  </small>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-4 mt-1">
        <Col lg={5}>
          <Card className="analytics-card h-100">
            <Card.Body>
              <div className="analytics-card-head">
                <div>
                  <span className="analytics-section-label">Breakdown</span>
                  <h4>Category share</h4>
                </div>
              </div>

              <CategoryBreakdownChart categories={reportData.categories} />
            </Card.Body>
          </Card>
        </Col>

        <Col lg={7}>
          <Card className="analytics-card h-100">
            <Card.Body>
              <div className="analytics-card-head">
                <div>
                  <span className="analytics-section-label">Ranking</span>
                  <h4>Category performance</h4>
                </div>
                <Badge bg="light" text="dark" className="analytics-soft-badge">
                  Top {reportData.categories.length}
                </Badge>
              </div>

              {reportData.categories.length ? (
                <div className="analytics-table-wrap">
                  <Table hover responsive className="analytics-table analytics-table-tight">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Type</th>
                        <th>Transactions</th>
                        <th>Share</th>
                        <th className="text-end">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.categories.map((category) => (
                        <tr
                          key={`${category.categoryId || "uncategorized"}-${category.type}`}
                        >
                          <td>
                            <strong>{category.name}</strong>
                          </td>
                          <td className="text-capitalize">{category.type}</td>
                          <td>{category.count}</td>
                          <td>{formatPercent(category.share)}</td>
                          <td className="text-end">{formatCurrency(category.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <div className="analytics-empty-state analytics-empty-state-small">
                  <strong>No category performance to show</strong>
                  <span>Category totals appear once filtered transactions are available.</span>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
