const db = require("../models");
const isAuditEnabled = () => process.env.AUDIT_LOG_ENABLED !== "false";

const getIpAddress = (req) => {
  const forwarded = req?.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return req?.ip || req?.socket?.remoteAddress || null;
};

const toPlainObject = (value) => {
  if (!value || typeof value !== "object") {
    return {};
  }

  if (typeof value.get === "function") {
    return value.get({ plain: true });
  }

  return value;
};

const pickChangedFields = (before = {}, after = {}) => {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return Array.from(keys).filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])
  );
};

const writeAuditLog = async ({
  req,
  module,
  action,
  entityId = null,
  summary = "",
  meta = {},
  transaction,
}) => {
  if (!module || !action || !summary) {
    return;
  }

  if (!isAuditEnabled()) {
    return;
  }

  const actor = req?.user || {};

  try {
    await db.AuditLog.create(
      {
        module,
        action,
        entityId: entityId === null || entityId === undefined ? null : String(entityId),
        summary,
        actorUserId: Number.isInteger(Number(actor.id)) ? Number(actor.id) : null,
        actorName: actor.name || null,
        actorRole: actor.role || null,
        ipAddress: getIpAddress(req),
        userAgent: req?.headers?.["user-agent"] || null,
        meta: meta && typeof meta === "object" ? meta : {},
      },
      transaction ? { transaction } : undefined
    );
  } catch (err) {
    console.error("Audit log write failed:", err.message);
  }
};

module.exports = {
  toPlainObject,
  pickChangedFields,
  writeAuditLog,
};
