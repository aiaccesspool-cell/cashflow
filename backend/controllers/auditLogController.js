const { Op } = require("sequelize");
const db = require("../models");

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

exports.getAuditLogs = async (req, res) => {
  try {
    const currentPage = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.max(Number(req.query.pageSize) || 20, 1);
    const offset = (currentPage - 1) * limit;

    const moduleFilter = normalizeText(req.query.module).toLowerCase();
    const actionFilter = normalizeText(req.query.action).toLowerCase();
    const search = normalizeText(req.query.search);

    const where = {};

    if (moduleFilter) {
      where.module = moduleFilter;
    }

    if (actionFilter) {
      where.action = actionFilter;
    }

    if (search) {
      where[Op.or] = [
        { summary: { [Op.iLike]: `%${search}%` } },
        { actorName: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { rows, count } = await db.AuditLog.findAndCountAll({
      where,
      order: [["createdAt", "DESC"], ["id", "DESC"]],
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
      filters: {
        module: moduleFilter || "",
        action: actionFilter || "",
        search,
      },
    });
  } catch (err) {
    console.error("Get audit logs error:", err);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
};
