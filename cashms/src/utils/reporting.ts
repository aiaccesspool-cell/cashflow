const currencyFormatter = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  maximumFractionDigits: 2,
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  notation: "compact",
  maximumFractionDigits: 1,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

const padValue = (value: number) => String(value).padStart(2, "0");

export const toInputDate = (value: Date | string | number = new Date()) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${padValue(date.getMonth() + 1)}-${padValue(
    date.getDate()
  )}`;
};

export const getPresetRange = (preset: string) => {
  const today = new Date();
  const endDate = toInputDate(today);

  if (preset === "today") {
    return { fromDate: endDate, toDate: endDate };
  }

  if (preset === "7days") {
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 6);
    return {
      fromDate: toInputDate(startDate),
      toDate: endDate,
    };
  }

  if (preset === "thisMonth") {
    return {
      fromDate: `${today.getFullYear()}-${padValue(today.getMonth() + 1)}-01`,
      toDate: endDate,
    };
  }

  return {
    fromDate: "",
    toDate: "",
  };
};

export const buildReportQuery = (filters: {
  fromDate?: string;
  toDate?: string;
}) => {
  const params = new URLSearchParams();

  if (filters.fromDate) {
    params.set("fromDate", filters.fromDate);
  }

  if (filters.toDate) {
    params.set("toDate", filters.toDate);
  }

  return params.toString();
};

export const formatCurrency = (value: number) =>
  currencyFormatter.format(Number(value || 0));

export const formatCompactCurrency = (value: number) =>
  compactCurrencyFormatter.format(Number(value || 0));

export const formatPercent = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }

  return percentFormatter.format(Number(value));
};

export const formatLongDate = (value: string) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const formatDateRangeLabel = (filters: {
  fromDate?: string;
  toDate?: string;
}) => {
  if (!filters.fromDate && !filters.toDate) {
    return "All time";
  }

  if (
    filters.fromDate &&
    filters.toDate &&
    filters.fromDate === filters.toDate
  ) {
    return formatLongDate(filters.fromDate);
  }

  return `${filters.fromDate ? formatLongDate(filters.fromDate) : "Start"} - ${
    filters.toDate ? formatLongDate(filters.toDate) : "Now"
  }`;
};

