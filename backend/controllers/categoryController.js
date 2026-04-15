// controllers/categoryController.js
const db = require("../models");
const { Op } = require("sequelize");
const {
  normalizeCashflowType,
  serializeCashflowRecord,
} = require("../utils/cashflowTypes");

const serializeCategory = (category) => serializeCashflowRecord(category);

const handleCategoryError = (err, res, fallbackMessage) => {
  if (err.name === "SequelizeValidationError") {
    return res
      .status(400)
      .json({ error: err.errors[0]?.message || fallbackMessage });
  }

  console.error(fallbackMessage, err);
  return res.status(500).json({ error: fallbackMessage });
};

const buildCategoryFilters = (query = {}) => {
  const { search = "", type } = query;
  const where = {};
  const normalizedSearch = search.trim();
  const normalizedType =
    type && type !== "all" ? normalizeCashflowType(type) : "";

  if (normalizedSearch) {
    where.name = { [Op.iLike]: `%${normalizedSearch}%` };
  }

  if (type && type !== "all" && !normalizedType) {
    return { error: "Invalid category type filter" };
  }

  if (normalizedType) {
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

// GET paginated categories
exports.getCategories = async (req, res) => {
  try {
    const filterResult = buildCategoryFilters(req.query);

    if (filterResult.error) {
      return res.status(400).json({ error: filterResult.error });
    }

    const currentPage = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.max(Number(req.query.pageSize) || 10, 1);
    const offset = (currentPage - 1) * limit;

    const { rows, count } = await db.Category.findAndCountAll({
      where: filterResult.where,
      order: [["name", "ASC"]],
      limit,
      offset,
    });

    const [totalCategories, incomeCategories, expenseCategories] =
      await Promise.all([
        db.Category.count(),
        db.Category.count({ where: { type: "cash-in" } }),
        db.Category.count({ where: { type: "cash-out" } }),
      ]);

    const startIndex = count === 0 ? 0 : offset + 1;
    const endIndex = count === 0 ? 0 : offset + rows.length;

    res.json({
      data: rows.map(serializeCategory),
      total: count,
      totalPages: Math.max(Math.ceil(count / limit), 1),
      page: currentPage,
      pageSize: limit,
      countOnPage: rows.length,
      startIndex,
      endIndex,
      filters: filterResult.filters,
      summary: {
        totalCategories,
        incomeCategories,
        expenseCategories,
        visibleCategories: count,
      },
    });
  } catch (err) {
    console.error("Get categories error:", err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
};

// CREATE category
exports.createCategory = async (req, res) => {
  try {
    const name = req.body.name?.trim();
    const type = normalizeCashflowType(req.body.type);

    if (!name || !type) {
      return res.status(400).json({ error: "Valid name and type are required" });
    }

    const category = await db.Category.create({ name, type });
    res.status(201).json(serializeCategory(category));
  } catch (err) {
    return handleCategoryError(err, res, "Failed to create category");
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const cat = await db.Category.findByPk(req.params.id);
    if (!cat) return res.status(404).json({ error: "Not found" });

    const name = req.body.name?.trim() ?? cat.name;
    const type = normalizeCashflowType(req.body.type ?? cat.type);

    if (!name || !type) {
      return res.status(400).json({ error: "Valid name and type are required" });
    }

    await cat.update({ name, type });
    res.json(serializeCategory(cat));
  } catch (err) {
    return handleCategoryError(err, res, "Failed to update category");
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const cat = await db.Category.findByPk(req.params.id);
    if (!cat) return res.status(404).json({ error: "Not found" });

    await cat.destroy();
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("Delete category error:", err);
    res.status(500).json({ error: "Failed to delete category" });
  }
};