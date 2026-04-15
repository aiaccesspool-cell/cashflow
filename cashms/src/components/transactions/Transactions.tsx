import * as React from "react";
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit2,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { API } from "@/services/api";
import usePermissions from "@/hooks/usePermissions";
import { useTransaction } from "@/context/TransactionContext";
import { formatCurrency } from "@/utils/reporting";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

interface Category {
  id: number;
  name: string;
  type: "cash-in" | "cash-out";
}

interface Account {
  id: number;
  name: string;
  balance: number;
}

interface Source {
  id: number;
  name: string;
  type: "bank" | "mfs" | "cash";
}

type FormErrors = {
  description?: string;
  amount?: string;
  type?: string;
  accountId?: string;
  sourceId?: string;
  categoryId?: string;
  date?: string;
};

interface Transaction {
  id: number;
  description: string;
  type: "cash-in" | "cash-out";
  amount: number;
  transaction_date: string;
  categoryId: number | null;
  accountId: number | null;
  sourceId: number | null;
  Category?: { id: number; name: string; type: string } | null;
  Account?: { id: number; name: string } | null;
  Source?: { id: number; name: string; type: string } | null;
}

const getBlobErrorMessage = async (error: any, fallbackMessage: string) => {
  const blob = error.response?.data;

  if (blob instanceof Blob) {
    try {
      const text = await blob.text();
      const parsed = JSON.parse(text);
      return parsed.error || fallbackMessage;
    } catch {
      return fallbackMessage;
    }
  }

  return error.response?.data?.error || fallbackMessage;
};

const toInputDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function Transactions() {
  const { can, canAny } = usePermissions();
  const { setRefreshCallback } = useTransaction();
  const canCreate = can("transactions.create");
  const canEdit = can("transactions.edit");
  const canDelete = can("transactions.delete");
  const canExport = can("transactions.export");
  const canManage = canAny([
    "transactions.create",
    "transactions.edit",
    "transactions.delete",
  ]);
  const canViewCategories = can("categories.view");
  const canViewAccounts = can("accounts.view");
  const canViewSources = can("sources.view");

  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [sources, setSources] = React.useState<Source[]>([]);
  const [fieldErrors, setFieldErrors] = React.useState<FormErrors>({});
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [startIndex, setStartIndex] = React.useState(0);
  const [endIndex, setEndIndex] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [exporting, setExporting] = React.useState<"csv" | "pdf" | "">("");
  const [showModal, setShowModal] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [form, setForm] = React.useState({
    id: null as number | null,
    description: "",
    amount: "",
    type: "cash-out" as "cash-in" | "cash-out",
    accountId: "",
    sourceType: "bank" as "bank" | "mfs" | "cash",
    sourceId: "",
    categoryId: "",
    date: "",
  });

  const [filters, setFilters] = React.useState({
    search: "",
    type: "all",
    fromDate: "",
    toDate: "",
    accountId: "all",
    sourceId: "all",
    categoryId: "all",
    pageSize: 10,
  });
  const [page, setPage] = React.useState(1);

  const queryParams = React.useMemo(
    () => ({
      page,
      pageSize: filters.pageSize,
      search: filters.search || undefined,
      type: filters.type === "all" ? undefined : filters.type,
      fromDate: filters.fromDate || undefined,
      toDate: filters.toDate || undefined,
      accountId: filters.accountId === "all" ? undefined : filters.accountId,
      sourceId: filters.sourceId === "all" ? undefined : filters.sourceId,
      categoryId: filters.categoryId === "all" ? undefined : filters.categoryId,
    }),
    [filters, page],
  );

  const exportParams = React.useMemo(
    () => ({
      search: filters.search || undefined,
      type: filters.type === "all" ? undefined : filters.type,
      fromDate: filters.fromDate || undefined,
      toDate: filters.toDate || undefined,
      accountId: filters.accountId === "all" ? undefined : filters.accountId,
      sourceId: filters.sourceId === "all" ? undefined : filters.sourceId,
      categoryId: filters.categoryId === "all" ? undefined : filters.categoryId,
    }),
    [filters],
  );

  const fetchTransactions = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await API.get("/transactions", { params: queryParams });
      setTransactions(response.data.data || []);
      setTotalPages(response.data.totalPages || 1);
      setTotal(response.data.total || 0);
      setStartIndex(response.data.startIndex || 0);
      setEndIndex(response.data.endIndex || 0);
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.error || "Failed to load transactions",
      );
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  const fetchCategories = React.useCallback(async () => {
  if (!canViewCategories) return;

  try {
    const response = await API.get("/categories", {
      params: {
        page: 1,
        pageSize: 1000,
      },
    });

    const categoryData = Array.isArray(response.data)
      ? response.data
      : Array.isArray(response.data?.data)
        ? response.data.data
        : [];

    setCategories(categoryData);
  } catch {
    setCategories([]);
  }
}, [canViewCategories]);

const fetchAccounts = React.useCallback(async () => {
  if (!canViewAccounts) return;

  try {
    const response = await API.get("/accounts", {
      params: {
        page: 1,
        pageSize: 1000,
      },
    });

    const accountData = Array.isArray(response.data)
      ? response.data
      : Array.isArray(response.data?.data)
        ? response.data.data
        : [];

    setAccounts(accountData);
  } catch {
    setAccounts([]);
  }
}, [canViewAccounts]);

const fetchSources = React.useCallback(async () => {
  if (!canViewSources) return;

  try {
    const response = await API.get("/sources", {
      params: {
        page: 1,
        pageSize: 1000,
      },
    });

    const sourceData = Array.isArray(response.data)
      ? response.data
      : Array.isArray(response.data?.data)
        ? response.data.data
        : [];

    setSources(sourceData);
  } catch {
    setSources([]);
  }
}, [canViewSources]);

  React.useEffect(() => {
    fetchTransactions();
    setRefreshCallback(fetchTransactions);
  }, [fetchTransactions, setRefreshCallback]);

  React.useEffect(() => {
    fetchCategories();
    fetchAccounts();
    fetchSources();
  }, [fetchCategories, fetchAccounts, fetchSources]);

  const updateFilter = (key: string, value: string | number) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const applyDatePreset = (preset: "today" | "last7" | "month" | "all") => {
    const today = new Date();

    if (preset === "all") {
      setPage(1);
      setFilters((current) => ({
        ...current,
        fromDate: "",
        toDate: "",
      }));
      return;
    }

    if (preset === "today") {
      const formatted = toInputDate(today);
      setPage(1);
      setFilters((current) => ({
        ...current,
        fromDate: formatted,
        toDate: formatted,
      }));
      return;
    }

    if (preset === "last7") {
      const start = new Date(today);
      start.setDate(today.getDate() - 6);
      setPage(1);
      setFilters((current) => ({
        ...current,
        fromDate: toInputDate(start),
        toDate: toInputDate(today),
      }));
      return;
    }

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    setPage(1);
    setFilters((current) => ({
      ...current,
      fromDate: toInputDate(monthStart),
      toDate: toInputDate(today),
    }));
  };

  const activeFilterCount = [
    filters.search.trim() !== "",
    filters.type !== "all",
    filters.accountId !== "all",
    filters.sourceId !== "all",
    filters.categoryId !== "all",
    filters.fromDate !== "",
    filters.toDate !== "",
  ].filter(Boolean).length;

  const accountLabels = React.useMemo(
    () =>
      Object.fromEntries(
        accounts.map((account) => [String(account.id), account.name]),
      ),
    [accounts],
  );

  const categoryLabels = React.useMemo(
    () =>
      Object.fromEntries(
        categories.map((category) => [String(category.id), category.name]),
      ),
    [categories],
  );

  const sourceLabels = React.useMemo(
    () =>
      Object.fromEntries(
        sources.map((source) => [String(source.id), source.name]),
      ),
    [sources],
  );

  const selectedAccount = React.useMemo(
    () =>
      accounts.find(
        (account) => String(account.id) === String(form.accountId),
      ) || null,
    [accounts, form.accountId],
  );

  const filteredSources = React.useMemo(
    () => sources.filter((source) => source.type === form.sourceType),
    [sources, form.sourceType],
  );

  const availableBalance = Number(selectedAccount?.balance || 0);
  const enteredAmount = Number(form.amount || 0);
  const isExpense = form.type === "cash-out";
  const isOverBalance =
    isExpense &&
    form.amount !== "" &&
    Number.isFinite(enteredAmount) &&
    enteredAmount > availableBalance;

  const formatBalance = (value: number) =>
    `${Number(value || 0).toLocaleString("en-BD", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} Tk`;

  const getAccountLabel = React.useCallback(
    (value: unknown, fallback: string) => {
      const normalized = value == null ? "" : String(value);
      if (
        !normalized ||
        normalized === "none" ||
        normalized === "all" ||
        normalized === "select-account"
      ) {
        return fallback;
      }
      return accountLabels[normalized] || fallback;
    },
    [accountLabels],
  );

  const getCategoryLabel = React.useCallback(
    (value: unknown, fallback: string) => {
      const normalized = value == null ? "" : String(value);
      if (!normalized || normalized === "none" || normalized === "all") {
        return fallback;
      }
      return categoryLabels[normalized] || fallback;
    },
    [categoryLabels],
  );

  const getSourceLabel = React.useCallback(
    (value: unknown, fallback: string) => {
      const normalized = value == null ? "" : String(value);
      if (
        !normalized ||
        normalized === "none" ||
        normalized === "all" ||
        normalized === "select-source"
      ) {
        return fallback;
      }
      return sourceLabels[normalized] || fallback;
    },
    [sourceLabels],
  );

  const openCreateModal = () => {
    if (!canCreate) return;
    setFieldErrors({});
    setError("");
    const firstSource = sources[0] || null;
    setForm({
      id: null,
      description: "",
      amount: "",
      type: "cash-out",
      accountId: accounts.length ? String(accounts[0].id) : "",
      sourceType: firstSource?.type || "bank",
      sourceId: firstSource ? String(firstSource.id) : "",
      categoryId: "",
      date: new Date().toISOString().split("T")[0],
    });
    setShowModal(true);
  };
  const openEditModal = (transaction: Transaction) => {
    if (!canEdit) return;
    setFieldErrors({});
    setError("");
    setForm({
      id: transaction.id,
      description: transaction.description,
      amount: String(transaction.amount),
      type: transaction.type,
      accountId: transaction.accountId ? String(transaction.accountId) : "",
      sourceType:
        (transaction.Source?.type as "bank" | "mfs" | "cash" | undefined) ||
        (sources.find((source) => source.id === transaction.sourceId)?.type ?? "bank"),
      sourceId: transaction.sourceId ? String(transaction.sourceId) : "",
      categoryId: transaction.categoryId ? String(transaction.categoryId) : "",
      date: transaction.transaction_date.split("T")[0],
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    const nextErrors: FormErrors = {};

    setError("");
    setFieldErrors({});

    if (!form.description.trim()) {
      nextErrors.description = "Description is required.";
    }

    if (!form.date) {
      nextErrors.date = "Date is required.";
    }

    if (
      !form.amount ||
      !Number.isFinite(Number(form.amount)) ||
      Number(form.amount) <= 0
    ) {
      nextErrors.amount = "Valid amount is required.";
    }

    if (canViewAccounts && !form.accountId) {
      nextErrors.accountId = "Please select an account.";
    }

    if (canViewAccounts && accounts.length === 0) {
      nextErrors.accountId =
        "Create at least one account before adding transactions.";
    }

    if (canViewSources && !form.sourceId) {
      nextErrors.sourceId = "Please select a source.";
    }

    if (canViewSources && sources.length === 0) {
      nextErrors.sourceId =
        "Create at least one source before adding transactions.";
    }

    if (
      form.type === "cash-out" &&
      form.accountId &&
      Number.isFinite(Number(form.amount)) &&
      Number(form.amount) > availableBalance
    ) {
      nextErrors.amount = `Insufficient balance. You have ${formatBalance(
        availableBalance,
      )} in ${selectedAccount?.name || "this account"}.`;
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setSaving(true);

    try {
      const payload = {
        description: form.description.trim(),
        amount: Number(form.amount),
        type: form.type,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        accountId: form.accountId ? Number(form.accountId) : null,
        sourceId: form.sourceId ? Number(form.sourceId) : null,
        transaction_date: form.date,
      };

      if (form.id) {
        await API.put(`/transactions/${form.id}`, payload);
      } else {
        await API.post("/transactions", payload);
      }

      setShowModal(false);
      setFieldErrors({});
      await fetchTransactions();
    } catch (requestError: any) {
      const responseData = requestError.response?.data;

      if (responseData?.errors && typeof responseData.errors === "object") {
        setFieldErrors(responseData.errors);
      } else {
        const message = responseData?.error || "Failed to save transaction";

        if (
          message.toLowerCase().includes("balance") ||
          message.toLowerCase().includes("insufficient")
        ) {
          setFieldErrors({ amount: message });
        } else if (message.toLowerCase().includes("description")) {
          setFieldErrors({ description: message });
        } else if (message.toLowerCase().includes("account")) {
          setFieldErrors({ accountId: message });
        } else if (message.toLowerCase().includes("source")) {
          setFieldErrors({ sourceId: message });
        } else if (message.toLowerCase().includes("date")) {
          setFieldErrors({ date: message });
        } else {
          setError(message);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!canDelete) return;
    if (!window.confirm("Delete this transaction?")) return;
    setError("");

    try {
      await API.delete(`/transactions/${id}`);
      await fetchTransactions();
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.error || "Failed to delete transaction",
      );
    }
  };

  const handleExport = async (format: "csv" | "pdf") => {
    setExporting(format);
    setError("");
    try {
      const response = await API.get(`/transactions/export/${format}`, {
        params: exportParams,
        responseType: "blob",
      });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `transactions-export.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (requestError: any) {
      setError(
        await getBlobErrorMessage(
          requestError,
          `Failed to export ${format.toUpperCase()}`,
        ),
      );
    } finally {
      setExporting("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">
            Manage and track all financial activity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canExport && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    className="gap-2"
                    onClick={() => handleExport("csv")}
                    disabled={exporting !== ""}
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    {exporting === "csv" ? "Exporting CSV..." : "Export as CSV"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2"
                    onClick={() => handleExport("pdf")}
                    disabled={exporting !== ""}
                  >
                    <FileText className="h-4 w-4 text-rose-600" />
                    {exporting === "pdf" ? "Exporting PDF..." : "Export as PDF"}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {canCreate && (
            <Button onClick={openCreateModal} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Transaction
            </Button>
          )}
        </div>
      </div>

      {!canManage && (
        <div className="rounded-lg border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Read-only access. You can search and export but cannot modify
          transactions.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="border-none bg-card/50 backdrop-blur-sm shadow-md">
        <CardContent className="p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
            <div className="space-y-2 xl:col-span-4">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Search
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={filters.search}
                  onChange={(event) =>
                    updateFilter("search", event.target.value)
                  }
                  className="h-11 bg-white pl-10"
                  placeholder="Search description"
                />
              </div>
            </div>

            <div className="space-y-2 xl:col-span-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Type
              </Label>
              <Select
                value={filters.type}
                onValueChange={(value) => updateFilter("type", value || "all")}
              >
                <SelectTrigger className="h-11 w-full min-w-[150px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="cash-in">Cash In</SelectItem>
                  <SelectItem value="cash-out">Cash Out</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {canViewAccounts && (
              <div className="space-y-2 xl:col-span-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Account
                </Label>
                <Select
                  value={filters.accountId}
                  onValueChange={(value) =>
                    updateFilter("accountId", value || "all")
                  }
                >
                  <SelectTrigger className="h-11 w-full min-w-[170px] bg-white">
                    <SelectValue>
                      {(value) => getAccountLabel(value, "All Accounts")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={String(account.id)}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {canViewCategories && (
              <div className="space-y-2 xl:col-span-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Category
                </Label>
                <Select
                  value={filters.categoryId}
                  onValueChange={(value) =>
                    updateFilter("categoryId", value || "all")
                  }
                >
                  <SelectTrigger className="h-11 w-full min-w-[170px] bg-white">
                    <SelectValue>
                      {(value) => getCategoryLabel(value, "All Categories")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={String(category.id)}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {canViewSources && (
              <div className="space-y-2 xl:col-span-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Source
                </Label>
                <Select
                  value={filters.sourceId}
                  onValueChange={(value) =>
                    updateFilter("sourceId", value || "all")
                  }
                >
                  <SelectTrigger className="h-11 w-full min-w-[170px] bg-white">
                    <SelectValue>
                      {(value) => getSourceLabel(value, "All Sources")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    {sources.map((source) => (
                      <SelectItem key={source.id} value={String(source.id)}>
                        {source.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2 xl:col-span-2 2xl:col-span-1">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Page Size
              </Label>
              <Select
                value={String(filters.pageSize)}
                onValueChange={(value) =>
                  updateFilter("pageSize", Number(value))
                }
              >
                <SelectTrigger className="h-11 w-full min-w-0 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size} per page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 xl:col-span-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                From Date
              </Label>
              <Input
                type="date"
                className="h-11 max-w-[340px] bg-white"
                value={filters.fromDate}
                onChange={(event) =>
                  updateFilter("fromDate", event.target.value)
                }
              />
            </div>

            <div className="space-y-2 xl:col-span-3">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                To Date
              </Label>
              <Input
                type="date"
                className="h-11 max-w-[340px] bg-white"
                value={filters.toDate}
                onChange={(event) => updateFilter("toDate", event.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => applyDatePreset("today")}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => applyDatePreset("last7")}
              >
                7 Days
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => applyDatePreset("month")}
              >
                This Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => applyDatePreset("all")}
              >
                All Time
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <span className="text-sm text-muted-foreground">
                Showing {startIndex}-{endIndex} of {total}
              </span>
              <Badge variant="secondary" className="h-8 rounded-full px-3">
                {activeFilterCount} active
              </Badge>
              <Button
                variant="outline"
                onClick={() =>
                  setFilters({
                    search: "",
                    type: "all",
                    fromDate: "",
                    toDate: "",
                    accountId: "all",
                    sourceId: "all",
                    categoryId: "all",
                    pageSize: filters.pageSize,
                  })
                }
                className="gap-2 rounded-full"
              >
                <Filter className="h-4 w-4" />
                Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
        <div className="min-w-[1020px]">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: Math.min(filters.pageSize, 8) }).map(
                  (_, index) => (
                    <TableRow key={`transaction-skeleton-${index}`}>
                      <TableCell>
                        <Skeleton className="h-4 w-6" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-36" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-20 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="ml-auto h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-8 w-8 rounded-md" />
                      </TableCell>
                    </TableRow>
                  ),
                )
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="p-0">
                    <EmptyState
                      icon={ArrowLeftRight}
                      title="No transactions found"
                      description="No records matched the active filters."
                      actionLabel={canCreate ? "Add Transaction" : undefined}
                      onAction={canCreate ? openCreateModal : undefined}
                      className="border-none rounded-none py-16"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((transaction, index) => (
                  <TableRow
                    key={transaction.id}
                    className="group hover:bg-muted/30 transition-colors"
                  >
                    <TableCell>
                      {(startIndex > 0
                        ? startIndex
                        : (page - 1) * filters.pageSize + 1) + index}
                    </TableCell>
                    <TableCell>
                      {new Date(
                        transaction.transaction_date,
                      ).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{transaction.description}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold lowercase ${
                          transaction.type === "cash-in"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-rose-200 bg-rose-50 text-rose-700"
                        }`}
                      >
                        {transaction.type}
                      </span>
                    </TableCell>
                    <TableCell>{transaction.Category?.name || "-"}</TableCell>
                    <TableCell>{transaction.Account?.name || "-"}</TableCell>
                    <TableCell>
                      {transaction.Source?.name || "-"}
                      {transaction.Source?.type ? (
                        <div className="text-xs text-muted-foreground uppercase">
                          {transaction.Source.type}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(transaction.amount)}
                    </TableCell>
                    <TableCell>
                      {(canEdit || canDelete) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            <DropdownMenuGroup>
                              {canEdit && (
                                <DropdownMenuItem
                                  className="gap-2"
                                  onClick={() => openEditModal(transaction)}
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              {canEdit && canDelete && (
                                <DropdownMenuSeparator />
                              )}
                              {canDelete && (
                                <DropdownMenuItem
                                  className="gap-2 text-destructive focus:text-destructive"
                                  onClick={() => handleDelete(transaction.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between border-t bg-muted/10 px-4 py-4">
          <span className="text-sm text-muted-foreground">
            Page {page} of {Math.max(totalPages, 1)}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPage((current) => Math.min(current + 1, totalPages))
              }
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-[640px]">
          <DialogHeader className="px-6 pb-2 pt-6">
            <DialogTitle className="text-2xl font-semibold tracking-tight">
              {form.id ? "Edit Transaction" : "Add Transaction"}
            </DialogTitle>
            <DialogDescription className="text-sm">
              Record transaction details clearly for accurate tracking and
              reporting.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-6 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Date
                </Label>
                <Input
                  type="date"
                  className="h-11 rounded-xl bg-slate-50/70"
                  value={form.date}
                  onChange={(event) => {
                    setForm((current) => ({
                      ...current,
                      date: event.target.value,
                    }));
                    setFieldErrors((current) => ({
                      ...current,
                      date: undefined,
                    }));
                  }}
                />
                {fieldErrors.date && (
                  <p className="text-xs text-destructive">{fieldErrors.date}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Type
                </Label>
                <Select
                  value={form.type}
                  onValueChange={(value) => {
                    const nextType = value === "cash-in" ? "cash-in" : "cash-out";

                    setForm((current) => ({
                      ...current,
                      type: nextType,
                      categoryId: "",
                    }));

                    setFieldErrors((current) => ({
                      ...current,
                      type: undefined,
                      categoryId: undefined,
                      amount: undefined,
                    }));
                  }}
                >
                  <SelectTrigger className="h-11 w-full rounded-xl bg-slate-50/70">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash-out">Cash Out</SelectItem>
                    <SelectItem value="cash-in">Cash In</SelectItem>
                  </SelectContent>
                </Select>
                {fieldErrors.type && (
                  <p className="text-xs text-destructive">{fieldErrors.type}</p>
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Description
              </Label>
              <Input
                className="h-11 rounded-xl bg-slate-50/70"
                value={form.description}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }));
                  setFieldErrors((current) => ({
                    ...current,
                    description: undefined,
                  }));
                }}
                placeholder="e.g. Office internet bill, client payment, fuel refill"
              />
              {fieldErrors.description && (
                <p className="text-xs text-destructive">
                  {fieldErrors.description}
                </p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {canViewCategories && (
                <div className="grid gap-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Category
                  </Label>
                  <Select
                    value={form.categoryId || "none"}
                    onValueChange={(value) => {
                      const nextCategoryId =
                        !value || value === "none" ? "" : value;

                      setForm((current) => ({
                        ...current,
                        categoryId: nextCategoryId,
                      }));

                      setFieldErrors((current) => ({
                        ...current,
                        categoryId: undefined,
                      }));
                    }}
                  >
                    <SelectTrigger className="h-11 w-full rounded-xl bg-slate-50/70">
                      <SelectValue>
                        {(value) => getCategoryLabel(value, "No Category")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Category</SelectItem>
                      {categories
                        .filter((category) => category.type === form.type)
                        .map((category) => (
                          <SelectItem
                            key={category.id}
                            value={String(category.id)}
                          >
                            {category.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.categoryId && (
                    <p className="text-xs text-destructive">
                      {fieldErrors.categoryId}
                    </p>
                  )}
                </div>
              )}

              {canViewAccounts && (
                <div className="grid gap-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Account
                  </Label>
                  <Select
                    value={form.accountId || "select-account"}
                    onValueChange={(value) => {
                      const nextAccountId =
                        !value || value === "select-account" ? "" : value;

                      setForm((current) => ({
                        ...current,
                        accountId: nextAccountId,
                      }));

                      setFieldErrors((current) => ({
                        ...current,
                        accountId: undefined,
                        amount: undefined,
                      }));
                    }}
                  >
                    <SelectTrigger className="h-11 w-full rounded-xl bg-slate-50/70">
                      <SelectValue>
                        {(value) => getAccountLabel(value, "Select account")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="select-account" disabled>
                        Select account
                      </SelectItem>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={String(account.id)}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {fieldErrors.accountId && (
                    <p className="text-xs text-destructive">
                      {fieldErrors.accountId}
                    </p>
                  )}
                </div>
              )}
            </div>

            {canViewSources && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Source Type
                  </Label>
                  <Select
                    value={form.sourceType}
                    onValueChange={(value) => {
                      const nextSourceType =
                        value === "bank" || value === "mfs" || value === "cash"
                          ? value
                          : "bank";

                      const nextSourceOptions = sources.filter(
                        (source) => source.type === nextSourceType,
                      );

                      setForm((current) => ({
                        ...current,
                        sourceType: nextSourceType,
                        sourceId: nextSourceOptions.length
                          ? String(nextSourceOptions[0].id)
                          : "",
                      }));

                      setFieldErrors((current) => ({
                        ...current,
                        sourceId: undefined,
                      }));
                    }}
                  >
                    <SelectTrigger className="h-11 w-full rounded-xl bg-slate-50/70">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank">Bank</SelectItem>
                      <SelectItem value="mfs">MFS</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Source
                  </Label>
                  <Select
                    value={form.sourceId || "select-source"}
                    onValueChange={(value) => {
                      const nextSourceId =
                        !value || value === "select-source" ? "" : value;

                      setForm((current) => ({
                        ...current,
                        sourceId: nextSourceId,
                      }));

                      setFieldErrors((current) => ({
                        ...current,
                        sourceId: undefined,
                      }));
                    }}
                  >
                    <SelectTrigger className="h-11 w-full rounded-xl bg-slate-50/70">
                      <SelectValue>
                        {(value) => getSourceLabel(value, "Select source")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="select-source" disabled>
                        Select source
                      </SelectItem>
                      {filteredSources.map((source) => (
                        <SelectItem key={source.id} value={String(source.id)}>
                          {source.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.sourceId && (
                    <p className="text-xs text-destructive">
                      {fieldErrors.sourceId}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Amount
                </Label>

                {selectedAccount && form.type === "cash-out" && (
                  <span className="text-xs font-medium text-amber-700">
                    Available: {formatBalance(selectedAccount.balance)}
                  </span>
                )}
              </div>

              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  BDT
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="h-11 rounded-xl bg-slate-50/70 pl-14"
                  value={form.amount}
                  onChange={(event) => {
                    const value = event.target.value;

                    setForm((current) => ({ ...current, amount: value }));

                    if (
                      form.type === "cash-out" &&
                      selectedAccount &&
                      value !== "" &&
                      Number(value) > Number(selectedAccount.balance)
                    ) {
                      setFieldErrors((current) => ({
                        ...current,
                        amount: `Insufficient balance. You have ${formatBalance(
                          selectedAccount.balance,
                        )} in ${selectedAccount.name}.`,
                      }));
                    } else {
                      setFieldErrors((current) => ({
                        ...current,
                        amount: undefined,
                      }));
                    }
                  }}
                  placeholder="0.00"
                />
              </div>

              {fieldErrors.amount && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {fieldErrors.amount}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mx-0 mb-0 border-t bg-slate-50/80 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
            <Button
              variant="outline"
              className="h-10 min-w-[150px] rounded-full"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="h-10 min-w-[150px] rounded-full"
              onClick={handleSave}
              disabled={
                saving ||
                (form.type === "cash-out" &&
                  !!form.amount &&
                  Number.isFinite(Number(form.amount)) &&
                  Number(form.amount) > availableBalance)
              }
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
