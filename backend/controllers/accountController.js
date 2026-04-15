// controllers/accountController.js
const db = require("../models");
const { Op } = require("sequelize");
const { recalculateAccountBalances } = require("../services/accountBalanceService");
const {
  pickChangedFields,
  toPlainObject,
  writeAuditLog,
} = require("../services/auditLogService");

const normalizeName = (value) =>
  typeof value === "string" ? value.trim() : "";

const parseOpeningBalance = (value, fallback = 0) => {
  if (value === undefined || value === null || value === "") {
    return Number(fallback || 0);
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const handleAccountWriteError = (err, res, fallbackMessage) => {
  if (err.name === "SequelizeValidationError") {
    return res.status(400).json({ error: err.errors[0]?.message || fallbackMessage });
  }

  console.error(fallbackMessage, err);
  return res.status(500).json({ error: fallbackMessage });
};

const buildAccountFilters = (query = {}) => {
  const { search = "" } = query;
  const where = {};
  const normalizedSearch = search.trim();

  if (normalizedSearch) {
    where.name = { [Op.iLike]: `%${normalizedSearch}%` };
  }

  return {
    where,
    filters: {
      search: normalizedSearch,
    },
  };
};

// GET paginated accounts
exports.getAccounts = async (req, res) => {
  try {
    const filterResult = buildAccountFilters(req.query);
    const currentPage = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.max(Number(req.query.pageSize) || 10, 1);
    const offset = (currentPage - 1) * limit;

    const { rows, count } = await db.Account.findAndCountAll({
      where: filterResult.where,
      attributes: ["id", "name", "openingBalance", "balance"],
      order: [["name", "ASC"]],
      limit,
      offset,
    });

    const allAccounts = await db.Account.findAll({
      attributes: ["balance"],
    });

    const totalBalance = allAccounts.reduce(
      (sum, account) => sum + Number(account.balance || 0),
      0
    );

    const startIndex = count === 0 ? 0 : offset + 1;
    const endIndex = count === 0 ? 0 : offset + rows.length;

    res.json({
      data: rows,
      total: count,
      totalPages: Math.max(Math.ceil(count / limit), 1),
      page: currentPage,
      pageSize: limit,
      countOnPage: rows.length,
      startIndex,
      endIndex,
      filters: filterResult.filters,
      summary: {
        totalAccounts: allAccounts.length,
        totalBalance,
        visibleAccounts: count,
      },
    });
  } catch (err) {
    console.error("Get accounts error:", err);
    res.status(500).json({ error: "Failed to fetch accounts" });
  }
};

// CREATE account
exports.createAccount = async (req, res) => {
  try {
    const name = normalizeName(req.body.name);
    const openingBalance = parseOpeningBalance(req.body.openingBalance ?? req.body.balance, 0);

    if (!name) {
      return res.status(400).json({ error: "Account name is required" });
    }

    if (!Number.isFinite(openingBalance)) {
      return res.status(400).json({ error: "Opening balance must be a valid number" });
    }

    const account = await db.Account.create({
      name,
      openingBalance,
      balance: openingBalance,
    });

    await writeAuditLog({
      req,
      module: "accounts",
      action: "create",
      entityId: account.id,
      summary: `Created account "${account.name}"`,
      meta: {
        openingBalance: Number(account.openingBalance || 0),
        balance: Number(account.balance || 0),
      },
    });

    res.status(201).json(account);
  } catch (err) {
    return handleAccountWriteError(err, res, "Failed to create account");
  }
};

exports.updateAccount = async (req, res) => {
  try {
    const account = await db.Account.findByPk(req.params.id);
    if (!account) return res.status(404).json({ error: "Not found" });

    const before = toPlainObject(account);

    const name = normalizeName(req.body.name ?? account.name);
    const openingBalance = parseOpeningBalance(
      req.body.openingBalance ?? req.body.balance,
      account.openingBalance
    );

    if (!name) {
      return res.status(400).json({ error: "Account name is required" });
    }

    if (!Number.isFinite(openingBalance)) {
      return res.status(400).json({ error: "Opening balance must be a valid number" });
    }

    await account.update({ name, openingBalance });
    await recalculateAccountBalances([account.id]);
    await account.reload();

    const after = toPlainObject(account);

    await writeAuditLog({
      req,
      module: "accounts",
      action: "update",
      entityId: account.id,
      summary: `Updated account "${account.name}"`,
      meta: {
        changedFields: pickChangedFields(
          {
            name: before.name,
            openingBalance: Number(before.openingBalance || 0),
            balance: Number(before.balance || 0),
          },
          {
            name: after.name,
            openingBalance: Number(after.openingBalance || 0),
            balance: Number(after.balance || 0),
          }
        ),
        before: {
          name: before.name,
          openingBalance: Number(before.openingBalance || 0),
          balance: Number(before.balance || 0),
        },
        after: {
          name: after.name,
          openingBalance: Number(after.openingBalance || 0),
          balance: Number(after.balance || 0),
        },
      },
    });

    res.json(account);
  } catch (err) {
    return handleAccountWriteError(err, res, "Failed to update account");
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const account = await db.Account.findByPk(req.params.id);
    if (!account) return res.status(404).json({ error: "Not found" });

    const snapshot = toPlainObject(account);

    await account.destroy();

    await writeAuditLog({
      req,
      module: "accounts",
      action: "delete",
      entityId: snapshot.id,
      summary: `Deleted account "${snapshot.name}"`,
      meta: {
        openingBalance: Number(snapshot.openingBalance || 0),
        finalBalance: Number(snapshot.balance || 0),
      },
    });

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("Delete account error:", err);
    res.status(500).json({ error: "Failed to delete account" });
  }
};
