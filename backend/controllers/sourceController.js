const { Op } = require("sequelize");
const db = require("../models");
const {
  pickChangedFields,
  toPlainObject,
  writeAuditLog,
} = require("../services/auditLogService");

const SOURCE_TYPES = ["bank", "mfs", "cash"];

const normalizeName = (value) => (typeof value === "string" ? value.trim() : "");

const normalizeType = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
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

const buildSourceFilters = (query = {}) => {
  const { search = "", type = "all" } = query;
  const where = {};
  const normalizedSearch = normalizeName(search);
  const normalizedType = normalizeType(type);

  if (normalizedSearch) {
    where.name = { [Op.iLike]: `%${normalizedSearch}%` };
  }

  if (normalizedType && normalizedType !== "all") {
    if (!SOURCE_TYPES.includes(normalizedType)) {
      return { error: "Invalid source type filter" };
    }

    where.type = normalizedType;
  }

  return {
    where,
    filters: {
      search: normalizedSearch,
      type: normalizedType || "all",
    },
  };
};

const calculateSummary = async (where) => {
  const [totalSources, bankCount, mfsCount, cashCount, visibleSources] =
    await Promise.all([
      db.Source.count(),
      db.Source.count({ where: { type: "bank" } }),
      db.Source.count({ where: { type: "mfs" } }),
      db.Source.count({ where: { type: "cash" } }),
      db.Source.count({ where }),
    ]);

  return {
    totalSources,
    bankCount,
    mfsCount,
    cashCount,
    visibleSources,
  };
};

const handleSourceWriteError = (err, res, fallbackMessage) => {
  if (err.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({ error: "Source name already exists for this type" });
  }

  if (err.name === "SequelizeValidationError") {
    return res.status(400).json({ error: err.errors[0]?.message || fallbackMessage });
  }

  console.error(fallbackMessage, err);
  return res.status(500).json({ error: fallbackMessage });
};

exports.getSources = async (req, res) => {
  try {
    const filterResult = buildSourceFilters(req.query);

    if (filterResult.error) {
      return res.status(400).json({ error: filterResult.error });
    }

    const currentPage = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.max(Number(req.query.pageSize) || 10, 1);
    const offset = (currentPage - 1) * limit;

    const { rows, count } = await db.Source.findAndCountAll({
      where: filterResult.where,
      order: [["type", "ASC"], ["name", "ASC"]],
      limit,
      offset,
    });

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
      summary: await calculateSummary(filterResult.where),
    });
  } catch (err) {
    console.error("Get sources error:", err);
    res.status(500).json({ error: "Failed to fetch sources" });
  }
};

exports.createSource = async (req, res) => {
  try {
    const name = normalizeName(req.body.name);
    const type = normalizeType(req.body.type);

    if (!name) {
      return res.status(400).json({ error: "Source name is required" });
    }

    if (!SOURCE_TYPES.includes(type)) {
      return res.status(400).json({ error: "Valid source type is required" });
    }

    const source = await db.Source.create({ name, type });

    await writeAuditLog({
      req,
      module: "sources",
      action: "create",
      entityId: source.id,
      summary: `Created source "${source.name}" (${source.type})`,
      meta: {
        type: source.type,
      },
    });

    res.status(201).json(source);
  } catch (err) {
    return handleSourceWriteError(err, res, "Failed to create source");
  }
};

exports.updateSource = async (req, res) => {
  try {
    const sourceId = parsePositiveInteger(req.params.id);

    if (!sourceId) {
      return res.status(400).json({ error: "Invalid source id" });
    }

    const source = await db.Source.findByPk(sourceId);
    if (!source) {
      return res.status(404).json({ error: "Source not found" });
    }

    const before = toPlainObject(source);

    const name = normalizeName(req.body.name ?? source.name);
    const type = normalizeType(req.body.type ?? source.type);

    if (!name) {
      return res.status(400).json({ error: "Source name is required" });
    }

    if (!SOURCE_TYPES.includes(type)) {
      return res.status(400).json({ error: "Valid source type is required" });
    }

    await source.update({ name, type });

    const after = toPlainObject(source);

    await writeAuditLog({
      req,
      module: "sources",
      action: "update",
      entityId: source.id,
      summary: `Updated source "${source.name}"`,
      meta: {
        changedFields: pickChangedFields(
          { name: before.name, type: before.type },
          { name: after.name, type: after.type }
        ),
        before: { name: before.name, type: before.type },
        after: { name: after.name, type: after.type },
      },
    });

    res.json(source);
  } catch (err) {
    return handleSourceWriteError(err, res, "Failed to update source");
  }
};

exports.deleteSource = async (req, res) => {
  try {
    const sourceId = parsePositiveInteger(req.params.id);

    if (!sourceId) {
      return res.status(400).json({ error: "Invalid source id" });
    }

    const source = await db.Source.findByPk(sourceId);
    if (!source) {
      return res.status(404).json({ error: "Source not found" });
    }

    const snapshot = toPlainObject(source);

    const transactionsUsingSource = await db.Transaction.count({
      where: { sourceId },
    });

    if (transactionsUsingSource > 0) {
      return res.status(400).json({
        error: "Source is in use by transactions and cannot be deleted",
      });
    }

    await source.destroy();

    await writeAuditLog({
      req,
      module: "sources",
      action: "delete",
      entityId: snapshot.id,
      summary: `Deleted source "${snapshot.name}" (${snapshot.type})`,
      meta: {
        type: snapshot.type,
      },
    });

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("Delete source error:", err);
    res.status(500).json({ error: "Failed to delete source" });
  }
};
