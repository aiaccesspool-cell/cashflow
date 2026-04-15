const PDFDocument = require("pdfkit");
const db = require("../models");
const { Op } = require("sequelize");
const {
  recalculateAccountBalances,
} = require("../services/accountBalanceService");
const {
  pickChangedFields,
  toPlainObject,
  writeAuditLog,
} = require("../services/auditLogService");
const {
  getCashflowTypeFilter,
  normalizeCashflowType,
  serializeCashflowRecord,
} = require("../utils/cashflowTypes");

const transactionInclude = [
  {
    model: db.Category,
    attributes: ["id", "name", "type"],
  },
  {
    model: db.Account,
    attributes: ["id", "name"],
  },
  {
    model: db.Source,
    attributes: ["id", "name", "type"],
  },
];

const serializeTransaction = (transaction) =>
  serializeCashflowRecord(transaction);

const transactionAuditFields = (transaction = {}) => ({
  description: transaction.description || null,
  amount: Number(transaction.amount || 0),
  type: transaction.type || null,
  accountId: transaction.accountId ?? null,
  categoryId: transaction.categoryId ?? null,
  sourceId: transaction.sourceId ?? null,
  transaction_date: transaction.transaction_date || null,
});

const parseNullableId = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return NaN;
  }

  return parsed;
};

const buildTransactionPayload = (body = {}, existingTransaction = {}) => {
  const type = normalizeCashflowType(body.type ?? existingTransaction.type);
  const hasCategoryId = Object.prototype.hasOwnProperty.call(
    body,
    "categoryId",
  );
  const hasAccountId = Object.prototype.hasOwnProperty.call(body, "accountId");
  const hasSourceId = Object.prototype.hasOwnProperty.call(body, "sourceId");

  return {
    description: body.description?.trim() ?? existingTransaction.description,
    amount:
      body.amount !== undefined
        ? Number(body.amount)
        : existingTransaction.amount,
    type,
    categoryId: hasCategoryId
      ? parseNullableId(body.categoryId)
      : (existingTransaction.categoryId ?? null),
    accountId: hasAccountId
      ? parseNullableId(body.accountId)
      : (existingTransaction.accountId ?? null),
    sourceId: hasSourceId
      ? parseNullableId(body.sourceId)
      : (existingTransaction.sourceId ?? null),
    transaction_date:
      body.transaction_date ??
      body.date ??
      existingTransaction.transaction_date,
  };
};

const validateTransactionPayload = async (payload, options = {}) => {
  const errors = {};

  if (!payload.description || !payload.description.trim()) {
    errors.description = "Description is required.";
  }

  if (!payload.type) {
    errors.type = "Valid transaction type is required.";
  }

  if (Number.isNaN(payload.categoryId)) {
    errors.categoryId = "Invalid category selected.";
  }

  if (Number.isNaN(payload.accountId) || payload.accountId === null) {
    errors.accountId = "Account is required.";
  }

  if (Number.isNaN(payload.sourceId)) {
    errors.sourceId = "Invalid source selected.";
  }

  if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
    errors.amount = "Valid amount is required.";
  }

  if (!payload.transaction_date) {
    errors.date = "Transaction date is required.";
  }

  if (Object.keys(errors).length > 0) {
    return errors;
  }

  const account = await db.Account.findByPk(payload.accountId, {
    attributes: ["id", "name", "balance"],
    transaction: options.transaction,
  });

  if (!account) {
    return {
      accountId: "Selected account was not found.",
    };
  }

  if (payload.sourceId !== null) {
    const source = await db.Source.findByPk(payload.sourceId, {
      attributes: ["id", "name", "type"],
      transaction: options.transaction,
    });

    if (!source) {
      return {
        sourceId: "Selected source was not found.",
      };
    }
  }

  if (
    payload.type === "cash-out" &&
    Number(payload.amount) > Number(account.balance || 0)
  ) {
    return {
      amount: `Insufficient balance. You have ${Number(
        account.balance || 0,
      ).toFixed(2)} Tk in ${account.name}.`,
    };
  }

  return null;
};

const handleTransactionError = (err, res, fallbackMessage) => {
  if (err.status && err.message) {
    return res.status(err.status).json({ error: err.message });
  }

  if (err.name === "SequelizeForeignKeyConstraintError") {
    return res.status(400).json({ error: "Invalid category, account, or source" });
  }

  if (err.name === "SequelizeValidationError") {
    return res
      .status(400)
      .json({ error: err.errors[0]?.message || fallbackMessage });
  }

  console.error(err);
  return res.status(500).json({ error: fallbackMessage });
};

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const buildDateBoundary = (value, endOfDay = false) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(
    `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`,
  );

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

const parsePositiveInteger = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const buildTransactionFilters = (query = {}) => {
  const { search = "", type, fromDate, toDate, accountId, categoryId, sourceId } = query;

  const where = {};
  const normalizedSearch = search.trim();

  if (normalizedSearch) {
    where.description = { [Op.iLike]: `%${normalizedSearch}%` };
  }

  if (type) {
    const typeFilter = getCashflowTypeFilter(type);

    if (!typeFilter.length) {
      return { error: "Invalid transaction type filter" };
    }

    where.type = { [Op.in]: typeFilter };
  }

  if (fromDate || toDate) {
    const startDate = fromDate ? buildDateBoundary(fromDate, false) : null;
    const endDate = toDate ? buildDateBoundary(toDate, true) : null;

    if ((fromDate && !startDate) || (toDate && !endDate)) {
      return { error: "Invalid date filter" };
    }

    where.transaction_date = {};
    if (startDate) {
      where.transaction_date[Op.gte] = startDate;
    }
    if (endDate) {
      where.transaction_date[Op.lte] = endDate;
    }
  }

  const parsedAccountId = parsePositiveInteger(accountId);
  if (accountId !== undefined && accountId !== "" && !parsedAccountId) {
    return { error: "Invalid account filter" };
  }

  if (parsedAccountId) {
    where.accountId = parsedAccountId;
  }

  const parsedCategoryId = parsePositiveInteger(categoryId);
  if (categoryId !== undefined && categoryId !== "" && !parsedCategoryId) {
    return { error: "Invalid category filter" };
  }

  if (parsedCategoryId) {
    where.categoryId = parsedCategoryId;
  }

  const parsedSourceId = parsePositiveInteger(sourceId);
  if (sourceId !== undefined && sourceId !== "" && !parsedSourceId) {
    return { error: "Invalid source filter" };
  }

  if (parsedSourceId) {
    where.sourceId = parsedSourceId;
  }

  return {
    where,
    filters: {
      search: normalizedSearch,
      type: normalizeCashflowType(type) || "",
      fromDate: fromDate || "",
      toDate: toDate || "",
      accountId: parsedAccountId || "",
      categoryId: parsedCategoryId || "",
      sourceId: parsedSourceId || "",
    },
  };
};

const fetchTransactionsWithFilters = async (query = {}, options = {}) => {
  const { paginate = true } = options;
  const filterResult = buildTransactionFilters(query);

  if (filterResult.error) {
    return { error: filterResult.error };
  }

  const baseOptions = {
    where: filterResult.where,
    include: transactionInclude,
    order: [
      ["transaction_date", "DESC"],
      ["id", "DESC"],
    ],
  };

  if (!paginate) {
    const rows = await db.Transaction.findAll(baseOptions);

    return {
      rows,
      filters: filterResult.filters,
    };
  }

  const currentPage = Math.max(Number(query.page) || 1, 1);
  const limit = Math.max(Number(query.pageSize) || 5, 1);
  const offset = (currentPage - 1) * limit;

  const { rows, count } = await db.Transaction.findAndCountAll({
    ...baseOptions,
    limit,
    offset,
  });

  return {
    rows,
    count,
    currentPage,
    pageSize: limit,
    totalPages: Math.max(Math.ceil(count / limit), 1),
    filters: filterResult.filters,
  };
};

const escapeCsvValue = (value) => {
  const stringValue =
    value === null || value === undefined ? "" : String(value);

  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
};

const formatExportDate = (value) => {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleDateString("en-CA");
};

const formatExportAmount = (value) => Number(value || 0).toFixed(2);

const buildFilterSummaryLines = (filters = {}) => {
  const lines = [];

  if (filters.search) {
    lines.push(`Search: ${filters.search}`);
  }

  if (filters.type) {
    lines.push(`Type: ${filters.type}`);
  }

  if (filters.fromDate || filters.toDate) {
    lines.push(
      `Date: ${filters.fromDate || "Any"} to ${filters.toDate || "Any"}`,
    );
  }

  if (filters.accountId) {
    lines.push(`Account ID: ${filters.accountId}`);
  }

  if (filters.categoryId) {
    lines.push(`Category ID: ${filters.categoryId}`);
  }

  if (filters.sourceId) {
    lines.push(`Source ID: ${filters.sourceId}`);
  }

  return lines.length ? lines : ["Filters: none"];
};

const buildExportRows = (rows = []) =>
  rows.map((row) => {
    const transaction = serializeTransaction(row);

    return {
      date: formatExportDate(transaction.transaction_date),
      description: transaction.description,
      type: transaction.type === "cash-in" ? "Cash In" : "Cash Out",
      category: transaction.Category?.name || "-",
      account: transaction.Account?.name || "-",
      source: transaction.Source?.name || "-",
      amount: formatExportAmount(transaction.amount),
    };
  });

const drawPdfTableHeader = (doc, y) => {
  const columns = [
    { label: "Date", x: 40, width: 60 },
    { label: "Description", x: 100, width: 145 },
    { label: "Type", x: 245, width: 55 },
    { label: "Category", x: 300, width: 80 },
    { label: "Account", x: 380, width: 75 },
    { label: "Source", x: 455, width: 70 },
    { label: "Amount", x: 525, width: 45, align: "right" },
  ];

  doc.font("Helvetica-Bold").fontSize(9);
  columns.forEach((column) => {
    doc.text(column.label, column.x, y, {
      width: column.width,
      align: column.align || "left",
    });
  });

  doc
    .moveTo(40, y + 14)
    .lineTo(570, y + 14)
    .strokeColor("#999999")
    .stroke();

  return y + 20;
};

const drawPdfRows = (doc, rows) => {
  const columns = [
    { key: "date", x: 40, width: 60 },
    { key: "description", x: 100, width: 145 },
    { key: "type", x: 245, width: 55 },
    { key: "category", x: 300, width: 80 },
    { key: "account", x: 380, width: 75 },
    { key: "source", x: 455, width: 70 },
    { key: "amount", x: 525, width: 45, align: "right" },
  ];

  let y = drawPdfTableHeader(doc, doc.y);

  doc.font("Helvetica").fontSize(8).fillColor("black");

  rows.forEach((row) => {
    if (y > 740) {
      doc.addPage();
      y = drawPdfTableHeader(doc, 40);
      doc.font("Helvetica").fontSize(8).fillColor("black");
    }

    columns.forEach((column) => {
      const value = row[column.key] || "";
      doc.text(value, column.x, y, {
        width: column.width,
        align: column.align || "left",
        ellipsis: true,
      });
    });

    y += 16;
  });
};

exports.createTransaction = async (req, res) => {
  try {
    const payload = buildTransactionPayload(req.body);

    const validationErrors = await validateTransactionPayload(payload);

    if (validationErrors) {
      return res.status(400).json({
        error: "Validation failed",
        errors: validationErrors,
      });
    }

    const transaction = await db.sequelize.transaction(
      async (sequelizeTransaction) => {
        const createdTransaction = await db.Transaction.create(payload, {
          transaction: sequelizeTransaction,
        });

        await recalculateAccountBalances([createdTransaction.accountId], {
          transaction: sequelizeTransaction,
        });

        const savedTransaction = await db.Transaction.findByPk(
          createdTransaction.id,
          {
            include: transactionInclude,
            transaction: sequelizeTransaction,
          },
        );

        await writeAuditLog({
          req,
          module: "transactions",
          action: "create",
          entityId: createdTransaction.id,
          summary: `Created ${payload.type} transaction "${payload.description}"`,
          meta: transactionAuditFields(savedTransaction),
          transaction: sequelizeTransaction,
        });

        return savedTransaction;
      },
    );

    res.status(201).json(serializeTransaction(transaction));
  } catch (err) {
    return handleTransactionError(err, res, "Create failed");
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const result = await fetchTransactionsWithFilters(req.query, {
      paginate: true,
    });

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    const startIndex =
      result.count === 0 ? 0 : (result.currentPage - 1) * result.pageSize + 1;
    const endIndex =
      result.count === 0 ? 0 : startIndex + result.rows.length - 1;

    res.json({
      data: result.rows.map(serializeTransaction),
      total: result.count,
      totalPages: result.totalPages,
      page: result.currentPage,
      pageSize: result.pageSize,
      countOnPage: result.rows.length,
      startIndex,
      endIndex,
      filters: result.filters,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fetch failed" });
  }
};

exports.exportTransactionsCsv = async (req, res) => {
  try {
    const result = await fetchTransactionsWithFilters(req.query, {
      paginate: false,
    });

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    const exportRows = buildExportRows(result.rows);
    const lines = [
      ["Date", "Description", "Type", "Category", "Account", "Source", "Amount"].join(
        ",",
      ),
      ...exportRows.map((row) =>
        [
          escapeCsvValue(row.date),
          escapeCsvValue(row.description),
          escapeCsvValue(row.type),
          escapeCsvValue(row.category),
          escapeCsvValue(row.account),
          escapeCsvValue(row.source),
          escapeCsvValue(row.amount),
        ].join(","),
      ),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="transactions-${Date.now()}.csv"`,
    );

    res.send(lines.join("\n"));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "CSV export failed" });
  }
};

exports.exportTransactionsPdf = async (req, res) => {
  try {
    const result = await fetchTransactionsWithFilters(req.query, {
      paginate: false,
    });

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    const exportRows = buildExportRows(result.rows);
    const incomeTotal = exportRows
      .filter((row) => row.type === "cash-in")
      .reduce((total, row) => total + Number(row.amount), 0);
    const expenseTotal = exportRows
      .filter((row) => row.type === "cash-out")
      .reduce((total, row) => total + Number(row.amount), 0);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="transactions-${Date.now()}.pdf"`,
    );

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    doc.pipe(res);

    doc.font("Helvetica-Bold").fontSize(16).text("Transactions Export");
    doc.moveDown(0.5);
    doc
      .font("Helvetica")
      .fontSize(10)
      .text(`Generated: ${new Date().toLocaleString()}`);
    doc.text(`Records: ${exportRows.length}`);
    doc.text(`Income Total: ${incomeTotal.toFixed(2)}`);
    doc.text(`Expense Total: ${expenseTotal.toFixed(2)}`);
    doc.moveDown(0.5);

    buildFilterSummaryLines(result.filters).forEach((line) => {
      doc.text(line);
    });

    doc.moveDown();

    if (exportRows.length === 0) {
      doc.text("No transactions matched the selected filters.");
    } else {
      drawPdfRows(doc, exportRows);
    }

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "PDF export failed" });
  }
};

exports.updateTransaction = async (req, res) => {
  try {
    const transaction = await db.sequelize.transaction(
      async (sequelizeTransaction) => {
        const existingTransaction = await db.Transaction.findByPk(
          req.params.id,
          {
            transaction: sequelizeTransaction,
          },
        );

        if (!existingTransaction) {
          throw createHttpError(404, "Not found");
        }

        const previousAccountId = existingTransaction.accountId;
        const before = toPlainObject(existingTransaction);

        const payload = buildTransactionPayload(
          req.body,
          existingTransaction.get({ plain: true }),
        );

        const validationErrors = await validateTransactionPayload(payload, {
          transaction: sequelizeTransaction,
        });

        if (validationErrors) {
          const error = new Error("Validation failed");
          error.status = 400;
          error.validationErrors = validationErrors;
          throw error;
        }

        await existingTransaction.update(payload, {
          transaction: sequelizeTransaction,
        });

        await recalculateAccountBalances(
          [previousAccountId, existingTransaction.accountId],
          { transaction: sequelizeTransaction },
        );

        const after = toPlainObject(existingTransaction);

        await writeAuditLog({
          req,
          module: "transactions",
          action: "update",
          entityId: existingTransaction.id,
          summary: `Updated ${existingTransaction.type} transaction "${existingTransaction.description}"`,
          meta: {
            changedFields: pickChangedFields(
              transactionAuditFields(before),
              transactionAuditFields(after),
            ),
            before: transactionAuditFields(before),
            after: transactionAuditFields(after),
          },
          transaction: sequelizeTransaction,
        });

        return existingTransaction;
      },
    );

    res.json(serializeTransaction(transaction));
  } catch (err) {
    if (err.validationErrors) {
      return res.status(400).json({
        error: "Validation failed",
        errors: err.validationErrors,
      });
    }

    return handleTransactionError(err, res, "Update failed");
  }
};

exports.deleteTransaction = async (req, res) => {
  try {
    await db.sequelize.transaction(async (sequelizeTransaction) => {
      const transaction = await db.Transaction.findByPk(req.params.id, {
        transaction: sequelizeTransaction,
      });

      if (!transaction) {
        throw createHttpError(404, "Not found");
      }

      const accountId = transaction.accountId;
      const snapshot = toPlainObject(transaction);

      await transaction.destroy({
        transaction: sequelizeTransaction,
      });

      await recalculateAccountBalances([accountId], {
        transaction: sequelizeTransaction,
      });

      await writeAuditLog({
        req,
        module: "transactions",
        action: "delete",
        entityId: snapshot.id,
        summary: `Deleted ${snapshot.type} transaction "${snapshot.description}"`,
        meta: transactionAuditFields(snapshot),
        transaction: sequelizeTransaction,
      });
    });

    res.json({ message: "Deleted" });
  } catch (err) {
    return handleTransactionError(err, res, "Delete failed");
  }
};
