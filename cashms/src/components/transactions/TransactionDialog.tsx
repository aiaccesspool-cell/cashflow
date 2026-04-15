import * as React from "react";
import { format } from "date-fns";
import { Loader2, Wallet } from "lucide-react";
import { API } from "@/services/api";
import usePermissions from "@/hooks/usePermissions";
import { useTransaction } from "@/context/TransactionContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Label } from "@/components/ui/label";

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

const formatCurrency = (value: number) =>
  `${Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} Tk`;

export function TransactionDialog() {
  const { can } = usePermissions();
  const canViewCategories = can("categories.view");
  const canViewAccounts = can("accounts.view");
  const canViewSources = can("sources.view");
  const { isAddModalOpen, closeAddModal, refreshTransactions } =
    useTransaction();

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [sources, setSources] = React.useState<Source[]>([]);
  const [fieldErrors, setFieldErrors] = React.useState<FormErrors>({});

  const [form, setForm] = React.useState({
    description: "",
    amount: "",
    type: "cash-out" as "cash-in" | "cash-out",
    accountId: "",
    sourceType: "bank" as "bank" | "mfs" | "cash",
    sourceId: "",
    categoryId: "",
    date: format(new Date(), "yyyy-MM-dd"),
  });

  React.useEffect(() => {
    if (!isAddModalOpen) return;

    const bootstrap = async () => {
      setError("");
      setFieldErrors({});

      try {
        const [categoriesResponse, accountsResponse, sourcesResponse] = await Promise.all([
          canViewCategories
            ? API.get("/categories")
            : Promise.resolve({ data: [] }),
          canViewAccounts
            ? API.get("/accounts")
            : Promise.resolve({ data: [] }),
          canViewSources
            ? API.get("/sources", { params: { page: 1, pageSize: 1000 } })
            : Promise.resolve({ data: [] }),
        ]);

        const loadedCategories = Array.isArray(categoriesResponse.data)
          ? categoriesResponse.data
          : Array.isArray(categoriesResponse.data?.data)
            ? categoriesResponse.data.data
            : [];

        const loadedAccounts = Array.isArray(accountsResponse.data)
          ? accountsResponse.data
          : Array.isArray(accountsResponse.data?.data)
            ? accountsResponse.data.data
            : [];

        const loadedSources = Array.isArray(sourcesResponse.data)
          ? sourcesResponse.data
          : Array.isArray(sourcesResponse.data?.data)
            ? sourcesResponse.data.data
            : [];

        setCategories(loadedCategories);
        setAccounts(loadedAccounts);
        setSources(loadedSources);

        const initialSource = loadedSources[0] || null;

        setForm({
          description: "",
          amount: "",
          type: "cash-out",
          accountId: loadedAccounts.length ? String(loadedAccounts[0].id) : "",
          sourceType: initialSource?.type || "bank",
          sourceId: initialSource ? String(initialSource.id) : "",
          categoryId: "",
          date: format(new Date(), "yyyy-MM-dd"),
        });
      } catch {
        setError("Failed to load form options.");
      }
    };

    bootstrap();
  }, [isAddModalOpen, canViewAccounts, canViewCategories, canViewSources]);

  const selectedAccount = React.useMemo(() => {
    return (
      accounts.find(
        (account) => String(account.id) === String(form.accountId),
      ) || null
    );
  }, [accounts, form.accountId]);

  const availableBalance = Number(selectedAccount?.balance || 0);
  const enteredAmount = Number(form.amount || 0);

  const isExpense = form.type === "cash-out";
  const isExpenseOverBalance =
    isExpense &&
    form.amount !== "" &&
    Number.isFinite(enteredAmount) &&
    enteredAmount > availableBalance;

  const filteredCategories = React.useMemo(
    () => categories.filter((category) => category.type === form.type),
    [categories, form.type],
  );

  const filteredSources = React.useMemo(
    () => sources.filter((source) => source.type === form.sourceType),
    [sources, form.sourceType],
  );

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

  const getAccountLabel = React.useCallback(
    (value: unknown) => {
      const normalized = value == null ? "" : String(value);
      if (!normalized || normalized === "select-account")
        return "Select Account";
      return accountLabels[normalized] || "Select Account";
    },
    [accountLabels],
  );

  const getCategoryLabel = React.useCallback(
    (value: unknown) => {
      const normalized = value == null ? "" : String(value);
      if (!normalized || normalized === "none") return "No Category";
      return categoryLabels[normalized] || "No Category";
    },
    [categoryLabels],
  );

  const getSourceLabel = React.useCallback(
    (value: unknown) => {
      const normalized = value == null ? "" : String(value);
      if (!normalized || normalized === "select-source") return "Select Source";
      return sourceLabels[normalized] || "Select Source";
    },
    [sourceLabels],
  );

  const setSingleFieldError = (field: keyof FormErrors, message?: string) => {
    setFieldErrors((current) => ({
      ...current,
      [field]: message,
    }));
  };

  const handleTextFieldChange = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setSingleFieldError(key as keyof FormErrors, undefined);
  };

  const handleAmountChange = (value: string) => {
    if (value === "") {
      setForm((current) => ({ ...current, amount: "" }));
      setSingleFieldError("amount", undefined);
      return;
    }

    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return;
    }

    if (numericValue < 0) {
      return;
    }

    if (isExpense && selectedAccount && numericValue > availableBalance) {
      setForm((current) => ({
        ...current,
        amount: String(availableBalance > 0 ? availableBalance : ""),
      }));
      setSingleFieldError(
        "amount",
        `Insufficient balance. You have ${formatCurrency(
          availableBalance,
        )} in ${selectedAccount.name}.`,
      );
      return;
    }

    setForm((current) => ({ ...current, amount: value }));
    setSingleFieldError("amount", undefined);
  };

  const validateForm = () => {
    const nextErrors: FormErrors = {};

    if (!form.description.trim()) {
      nextErrors.description = "Description is required.";
    }

    if (!form.date) {
      nextErrors.date = "Transaction date is required.";
    }

    if (
      !form.amount ||
      !Number.isFinite(Number(form.amount)) ||
      Number(form.amount) <= 0
    ) {
      nextErrors.amount = "Please enter a valid amount greater than 0.";
    }

    if (canViewAccounts && !form.accountId) {
      nextErrors.accountId = "Please select an account.";
    }

    if (canViewAccounts && accounts.length === 0) {
      nextErrors.accountId =
        "Create at least one account before adding a transaction.";
    }

    if (canViewSources && !form.sourceId) {
      nextErrors.sourceId = "Please select a source.";
    }

    if (canViewSources && sources.length === 0) {
      nextErrors.sourceId =
        "Create at least one source before adding a transaction.";
    }

    if (
      form.type === "cash-out" &&
      form.accountId &&
      Number.isFinite(Number(form.amount)) &&
      Number(form.amount) > availableBalance
    ) {
      nextErrors.amount = `Insufficient balance. You have ${formatCurrency(
        availableBalance,
      )} in ${selectedAccount?.name || "this account"}.`;
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setFieldErrors({});

    if (!validateForm()) {
      setLoading(false);
      return;
    }

    try {
      await API.post("/transactions", {
        description: form.description.trim(),
        amount: Number(form.amount),
        type: form.type,
        transaction_date: form.date,
        accountId: form.accountId ? Number(form.accountId) : null,
        sourceId: form.sourceId ? Number(form.sourceId) : null,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
      });

      refreshTransactions();
      closeAddModal();
    } catch (requestError: any) {
      const responseData = requestError?.response?.data;

      if (responseData?.errors && typeof responseData.errors === "object") {
        setFieldErrors(responseData.errors);
      } else {
        const message = responseData?.error || "Failed to save transaction.";

        if (message.toLowerCase().includes("description")) {
          setFieldErrors({ description: message });
        } else if (
          message.toLowerCase().includes("balance") ||
          message.toLowerCase().includes("insufficient")
        ) {
          setFieldErrors({ amount: message });
        } else if (message.toLowerCase().includes("account")) {
          setFieldErrors({ accountId: message });
        } else if (message.toLowerCase().includes("source")) {
          setFieldErrors({ sourceId: message });
        } else {
          setError(message);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={isAddModalOpen}
      onOpenChange={(open) => !open && closeAddModal()}
    >
      <DialogContent className="overflow-hidden p-0 sm:max-w-[640px]">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader className="px-6 pb-2 pt-6">
            <DialogTitle className="text-2xl font-semibold tracking-tight">
              Add Transaction
            </DialogTitle>
            <DialogDescription className="text-sm">
              Record transaction details clearly for accurate tracking and
              reporting.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="mx-6 mt-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

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
                  onChange={(event) =>
                    handleTextFieldChange("date", event.target.value)
                  }
                  aria-invalid={!!fieldErrors.date}
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
                      amount:
                        nextType === "cash-in"
                          ? current.amount
                          : Number(current.amount || 0) > availableBalance
                            ? ""
                            : current.amount,
                    }));

                    setFieldErrors((current) => ({
                      ...current,
                      type: undefined,
                      categoryId: undefined,
                      amount: undefined,
                    }));
                  }}
                >
                  <SelectTrigger
                    className="h-11 w-full rounded-xl bg-slate-50/70"
                    aria-invalid={!!fieldErrors.type}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash-out">Cash-Out</SelectItem>
                    <SelectItem value="cash-in">Cash-In</SelectItem>
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
                onChange={(event) =>
                  handleTextFieldChange("description", event.target.value)
                }
                placeholder="e.g. Office internet bill, client payment, fuel refill"
                aria-invalid={!!fieldErrors.description}
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

                      setSingleFieldError("categoryId", undefined);
                    }}
                  >
                    <SelectTrigger
                      className="h-11 w-full rounded-xl bg-slate-50/70"
                      aria-invalid={!!fieldErrors.categoryId}
                    >
                      <SelectValue>
                        {(value) => getCategoryLabel(value)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Category</SelectItem>
                      {filteredCategories.map((category) => (
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

                      const nextAccount =
                        accounts.find(
                          (account) => String(account.id) === nextAccountId,
                        ) || null;

                      setForm((current) => {
                        const currentAmount = Number(current.amount || 0);
                        const nextBalance = Number(nextAccount?.balance || 0);
                        const shouldClearAmount =
                          current.type === "cash-out" &&
                          current.amount !== "" &&
                          currentAmount > nextBalance;

                        return {
                          ...current,
                          accountId: nextAccountId,
                          amount: shouldClearAmount ? "" : current.amount,
                        };
                      });

                      setFieldErrors((current) => ({
                        ...current,
                        accountId: undefined,
                        amount: undefined,
                      }));
                    }}
                  >
                    <SelectTrigger
                      className="h-11 w-full rounded-xl bg-slate-50/70"
                      aria-invalid={!!fieldErrors.accountId}
                    >
                      <SelectValue>
                        {(value) => getAccountLabel(value)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="select-account" disabled>
                        Select Account
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
                      <SelectValue>{(value) => getSourceLabel(value)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="select-source" disabled>
                        Select Source
                      </SelectItem>
                      {filteredSources.map((source) => (
                        <SelectItem key={source.id} value={String(source.id)}>
                          {source.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldErrors.sourceId && (
                    <p className="text-xs text-destructive">{fieldErrors.sourceId}</p>
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
                    Available: {formatCurrency(selectedAccount.balance)}
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
                  onChange={(event) => handleAmountChange(event.target.value)}
                  placeholder="0.00"
                  aria-invalid={!!fieldErrors.amount}
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
              type="button"
              variant="outline"
              className="h-10 min-w-[150px] rounded-full"
              onClick={closeAddModal}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-10 min-w-[150px] rounded-full bg-emerald-600 hover:bg-emerald-700"
              disabled={
                loading ||
                (isExpense &&
                  !!form.amount &&
                  Number.isFinite(Number(form.amount)) &&
                  Number(form.amount) > availableBalance)
              }
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Transaction
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
