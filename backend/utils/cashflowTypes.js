const TYPE_NORMALIZATION_MAP = {
  "cash-in": "cash-in",
  "cash-out": "cash-out",
  income: "cash-in",
  credit: "cash-in",
  expense: "cash-out",
  debit: "cash-out",
};

const TYPE_FILTER_MAP = {
  "cash-in": ["cash-in", "income", "credit"],
  "cash-out": ["cash-out", "expense", "debit"],
};

const normalizeCashflowType = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  return TYPE_NORMALIZATION_MAP[value.trim().toLowerCase()] || null;
};

const getCashflowTypeFilter = (value) => {
  const normalized = normalizeCashflowType(value);
  return normalized ? [...TYPE_FILTER_MAP[normalized]] : [];
};

const serializeCashflowRecord = (record) => {
  if (!record) {
    return record;
  }

  const values =
    typeof record.get === "function" ? record.get({ plain: true }) : record;

  return {
    ...values,
    type: normalizeCashflowType(values.type) || values.type,
  };
};

module.exports = {
  normalizeCashflowType,
  getCashflowTypeFilter,
  serializeCashflowRecord,
};