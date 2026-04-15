const { Op } = require("sequelize");
const db = require("../models");
const { hasPermission } = require("../config/permissions");
const { serializeCashflowRecord } = require("../utils/cashflowTypes");

const CATEGORY_LIMIT = 8;
const RECENT_TRANSACTION_LIMIT = 6;
const ACCOUNT_SNAPSHOT_LIMIT = 6;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const categoryInclude = {
  model: db.Category,
  attributes: ["id", "name", "type"],
};

const recentTransactionInclude = [
  categoryInclude,
  {
    model: db.Account,
    attributes: ["id", "name"],
  },
  {
    model: db.Source,
    attributes: ["id", "name", "type"],
  },
];

const roundAmount = (value) => Number((Number(value || 0)).toFixed(2));

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildDateBoundary = (value, endOfDay = false) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const parseDateRange = (query = {}) => {
  const filters = {
    fromDate: typeof query.fromDate === "string" ? query.fromDate : "",
    toDate: typeof query.toDate === "string" ? query.toDate : "",
  };

  if (!filters.fromDate && !filters.toDate) {
    return {
      where: {},
      filters,
      startDate: null,
      endDate: null,
    };
  }

  const startDate = filters.fromDate ? buildDateBoundary(filters.fromDate, false) : null;
  const endDate = filters.toDate ? buildDateBoundary(filters.toDate, true) : null;

  if ((filters.fromDate && !startDate) || (filters.toDate && !endDate)) {
    return { error: "Invalid date filter" };
  }

  if (startDate && endDate && startDate > endDate) {
    return { error: "From date must be before to date" };
  }

  const where = {
    transaction_date: {},
  };

  if (startDate) {
    where.transaction_date[Op.gte] = startDate;
  }

  if (endDate) {
    where.transaction_date[Op.lte] = endDate;
  }

  return {
    where,
    filters,
    startDate,
    endDate,
  };
};

const serializeTransaction = (transaction) => {
  const values = serializeCashflowRecord(transaction);

  return {
    ...values,
    amount: roundAmount(values.amount),
  };
};

const parseLimit = (value, fallback, max = fallback) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
};

const fetchReportTransactions = async (range) =>
  db.Transaction.findAll({
    where: range.where,
    include: [categoryInclude],
    order: [["transaction_date", "ASC"], ["id", "ASC"]],
  });

const calculateSummary = (transactions = []) => {
  const summary = transactions.reduce(
    (accumulator, transaction) => {
      const normalizedTransaction = serializeTransaction(transaction);
      const amount = toNumber(normalizedTransaction.amount);

      if (normalizedTransaction.type === "cash-in") {
        accumulator.cashIn += amount;
      } else if (normalizedTransaction.type === "cash-out") {
        accumulator.cashOut += amount;
      }

      accumulator.totalTransactions += 1;
      accumulator.totalVolume += amount;
      return accumulator;
    },
    {
      cashIn: 0,
      cashOut: 0,
      balance: 0,
      totalTransactions: 0,
      totalVolume: 0,
      averageTransaction: 0,
    }
  );

  summary.balance = summary.cashIn - summary.cashOut;
  summary.averageTransaction =
    summary.totalTransactions > 0 ? summary.totalVolume / summary.totalTransactions : 0;

  return {
    cashIn: roundAmount(summary.cashIn),
    cashOut: roundAmount(summary.cashOut),
    balance: roundAmount(summary.balance),
    totalTransactions: summary.totalTransactions,
    totalVolume: roundAmount(summary.totalVolume),
    averageTransaction: roundAmount(summary.averageTransaction),
  };
};

const calculateCategoryBreakdown = (transactions = [], limit = CATEGORY_LIMIT) => {
  const grouped = transactions.reduce((accumulator, transaction) => {
    const normalizedTransaction = serializeTransaction(transaction);
    const categoryId = normalizedTransaction.categoryId || null;
    const categoryType = normalizedTransaction.Category?.type || normalizedTransaction.type;
    const key = categoryId ? `category-${categoryId}` : `uncategorized-${categoryType}`;

    if (!accumulator.has(key)) {
      accumulator.set(key, {
        categoryId,
        name:
          normalizedTransaction.Category?.name ||
          `Uncategorized ${categoryType === "cash-in" ? "Cash In" : "Cash Out"}`,
        type: categoryType,
        total: 0,
        count: 0,
      });
    }

    const currentValue = accumulator.get(key);
    currentValue.total += toNumber(normalizedTransaction.amount);
    currentValue.count += 1;

    return accumulator;
  }, new Map());

  const categories = [...grouped.values()].sort((first, second) => second.total - first.total);
  const totalAmount = categories.reduce((sum, item) => sum + item.total, 0);

  return categories.slice(0, limit).map((item) => ({
    ...item,
    total: roundAmount(item.total),
    share: totalAmount > 0 ? Number((item.total / totalAmount).toFixed(4)) : 0,
  }));
};

const getDateKey = (value, grouping) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return grouping === "month" ? `${year}-${month}-01` : `${year}-${month}-${day}`;
};

const formatPeriodLabel = (key, grouping) => {
  const date = new Date(`${key}T00:00:00`);

  if (grouping === "month") {
    return date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

const getGrouping = (transactions = [], range) => {
  const start = range.startDate || (transactions[0] ? new Date(transactions[0].transaction_date) : null);
  const end =
    range.endDate ||
    (transactions[transactions.length - 1]
      ? new Date(transactions[transactions.length - 1].transaction_date)
      : null);

  if (!start || !end) {
    return "month";
  }

  const differenceInDays = Math.floor((end.getTime() - start.getTime()) / DAY_IN_MS);
  return differenceInDays <= 62 ? "day" : "month";
};

const buildPeriodRange = (startDate, endDate, grouping) => {
  if (!startDate || !endDate) {
    return [];
  }

  const periods = [];
  const cursor =
    grouping === "month"
      ? new Date(startDate.getFullYear(), startDate.getMonth(), 1)
      : new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const finalDate =
    grouping === "month"
      ? new Date(endDate.getFullYear(), endDate.getMonth(), 1)
      : new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  while (cursor <= finalDate) {
    periods.push(getDateKey(cursor, grouping));

    if (grouping === "month") {
      cursor.setMonth(cursor.getMonth() + 1);
    } else {
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return periods;
};

const calculateCashFlow = (transactions = [], range) => {
  const grouping = getGrouping(transactions, range);
  const grouped = transactions.reduce((accumulator, transaction) => {
    const normalizedTransaction = serializeTransaction(transaction);
    const key = getDateKey(normalizedTransaction.transaction_date, grouping);

    if (!accumulator.has(key)) {
      accumulator.set(key, {
        period: key,
        cashIn: 0,
        cashOut: 0,
      });
    }

    const currentValue = accumulator.get(key);
    const amount = toNumber(normalizedTransaction.amount);

    if (normalizedTransaction.type === "cash-in") {
      currentValue.cashIn += amount;
    } else if (normalizedTransaction.type === "cash-out") {
      currentValue.cashOut += amount;
    }

    return accumulator;
  }, new Map());

  const keys = buildPeriodRange(range.startDate, range.endDate, grouping);
  const sortedKeys = keys.length ? keys : [...grouped.keys()].sort();

  return {
    grouping,
    points: sortedKeys.map((key) => {
      const item = grouped.get(key) || { cashIn: 0, cashOut: 0 };
      const cashIn = roundAmount(item.cashIn);
      const cashOut = roundAmount(item.cashOut);

      return {
        period: key,
        label: formatPeriodLabel(key, grouping),
        cashIn,
        cashOut,
        net: roundAmount(cashIn - cashOut),
      };
    }),
  };
};

const fetchRecentTransactions = async (range, limit = RECENT_TRANSACTION_LIMIT) => {
  const transactions = await db.Transaction.findAll({
    where: range.where,
    include: recentTransactionInclude,
    order: [["transaction_date", "DESC"], ["id", "DESC"]],
    limit,
  });

  return transactions.map(serializeTransaction);
};

const fetchAccountSnapshot = async (limit = ACCOUNT_SNAPSHOT_LIMIT) => {
  const accounts = await db.Account.findAll({
    order: [["balance", "DESC"], ["name", "ASC"]],
  });

  const allAccounts = accounts.map((account) => {
    const values = account.get({ plain: true });

    return {
      id: values.id,
      name: values.name,
      balance: roundAmount(values.balance),
    };
  });

  return {
    items: allAccounts.slice(0, limit),
    totalAccounts: allAccounts.length,
    totalBalance: roundAmount(
      allAccounts.reduce((total, account) => total + toNumber(account.balance), 0)
    ),
  };
};

const buildHighlights = (summary, categories, cashFlow) => {
  const strongestIncomePeriod = cashFlow.points.reduce((current, point) => {
    if (!current || point.cashIn > current.cashIn) {
      return point;
    }

    return current;
  }, null);

  const strongestExpensePeriod = cashFlow.points.reduce((current, point) => {
    if (!current || point.cashOut > current.cashOut) {
      return point;
    }

    return current;
  }, null);

  return {
    topCategory: categories[0] || null,
    strongestIncomePeriod:
      strongestIncomePeriod && strongestIncomePeriod.cashIn > 0 ? strongestIncomePeriod : null,
    strongestExpensePeriod:
      strongestExpensePeriod && strongestExpensePeriod.cashOut > 0 ? strongestExpensePeriod : null,
    marginRate:
      summary.cashIn > 0 ? Number((summary.balance / summary.cashIn).toFixed(4)) : null,
  };
};

const handleReportError = (err, res, fallbackMessage) => {
  console.error(err);
  return res.status(500).json({ error: fallbackMessage });
};

const getDashboardPayload = async (range, user) => {
  const reportTransactions = await fetchReportTransactions(range);
  const summary = calculateSummary(reportTransactions);
  const categories = calculateCategoryBreakdown(reportTransactions, CATEGORY_LIMIT);
  const cashFlow = calculateCashFlow(reportTransactions, range);
  const highlights = buildHighlights(summary, categories, cashFlow);

  const [recentTransactions, accountSnapshot] = await Promise.all([
    hasPermission(user, "transactions.view") ? fetchRecentTransactions(range) : Promise.resolve([]),
    hasPermission(user, "accounts.view")
      ? fetchAccountSnapshot()
      : Promise.resolve({ items: [], totalBalance: 0 }),
  ]);

  return {
    filters: range.filters,
    summary,
    cashFlow,
    categories,
    highlights,
    recentTransactions,
    accounts: accountSnapshot.items,
    accountSummary: {
      totalAccounts: accountSnapshot.totalAccounts,
      totalBalance: accountSnapshot.totalBalance,
    },
  };
};

exports.monthlySummary = async (req, res) => {
  const range = parseDateRange(req.query);

  if (range.error) {
    return res.status(400).json({ error: range.error });
  }

  try {
    const transactions = await fetchReportTransactions(range);
    const summary = calculateSummary(transactions);

    return res.json({
      ...summary,
      filters: range.filters,
    });
  } catch (err) {
    return handleReportError(err, res, "Summary report failed");
  }
};

exports.categoryReport = async (req, res) => {
  const range = parseDateRange(req.query);

  if (range.error) {
    return res.status(400).json({ error: range.error });
  }

  try {
    const transactions = await fetchReportTransactions(range);
    const categories = calculateCategoryBreakdown(
      transactions,
      parseLimit(req.query.limit, CATEGORY_LIMIT, 20)
    );

    return res.json({
      categories,
      filters: range.filters,
    });
  } catch (err) {
    return handleReportError(err, res, "Category report failed");
  }
};

exports.cashFlow = async (req, res) => {
  const range = parseDateRange(req.query);

  if (range.error) {
    return res.status(400).json({ error: range.error });
  }

  try {
    const transactions = await fetchReportTransactions(range);
    const cashFlow = calculateCashFlow(transactions, range);

    return res.json({
      ...cashFlow,
      filters: range.filters,
    });
  } catch (err) {
    return handleReportError(err, res, "Cashflow report failed");
  }
};

exports.dashboardSnapshot = async (req, res) => {
  const range = parseDateRange(req.query);

  if (range.error) {
    return res.status(400).json({ error: range.error });
  }

  try {
    const payload = await getDashboardPayload(range, req.user);
    return res.json(payload);
  } catch (err) {
    return handleReportError(err, res, "Dashboard report failed");
  }
};
