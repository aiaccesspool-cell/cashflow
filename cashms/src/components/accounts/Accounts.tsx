import * as React from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { API } from "@/services/api";
import usePermissions from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/utils/reporting";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { normalizePaginatedResponse } from "@/utils/pagination";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

interface Account {
  id: number;
  name: string;
  balance: number;
  openingBalance?: number;
}

interface AccountSummary {
  totalAccounts: number;
  totalBalance: number;
  visibleAccounts: number;
}

export default function Accounts() {
  const { can, canAny } = usePermissions();
  const canCreate = can("accounts.create");
  const canEdit = can("accounts.edit");
  const canDelete = can("accounts.delete");
  const canManage = canAny(["accounts.create", "accounts.edit", "accounts.delete"]);

  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [pageSize, setPageSize] = React.useState(10);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [startIndex, setStartIndex] = React.useState(0);
  const [endIndex, setEndIndex] = React.useState(0);
  const [summary, setSummary] = React.useState<AccountSummary>({
    totalAccounts: 0,
    totalBalance: 0,
    visibleAccounts: 0,
  });

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<{ id: number | null; name: string; openingBalance: string }>({
    id: null,
    name: "",
    openingBalance: "0",
  });

  const queryParams = React.useMemo(
    () => ({
      page,
      pageSize,
      search: search.trim() || undefined,
    }),
    [page, pageSize, search]
  );

 const fetchAccounts = React.useCallback(async () => {
  setLoading(true);
  setError("");

  try {
    const response = await API.get("/accounts", { params: queryParams });

    if (Array.isArray(response.data)) {
      const rawAccounts = response.data as Account[];

      const filteredAccounts = rawAccounts.filter((item) => {
        const term = search.trim().toLowerCase();

        return (
          !term ||
          item.name.toLowerCase().includes(term)
        );
      });

      const start = (page - 1) * pageSize;
      const pagedAccounts = filteredAccounts.slice(start, start + pageSize);

      setAccounts(pagedAccounts);
      setTotal(filteredAccounts.length);
      setTotalPages(Math.max(Math.ceil(filteredAccounts.length / pageSize), 1));
      setStartIndex(filteredAccounts.length === 0 ? 0 : start + 1);
      setEndIndex(filteredAccounts.length === 0 ? 0 : start + pagedAccounts.length);

      setSummary({
        totalAccounts: rawAccounts.length,
        totalBalance: rawAccounts.reduce(
          (sum, item) => sum + Number(item.balance || 0),
          0
        ),
        visibleAccounts: filteredAccounts.length,
      });

      return;
    }

    const normalized = normalizePaginatedResponse<Account>(
      response.data,
      page,
      pageSize,
      {
        totalAccounts: 0,
        totalBalance: 0,
        visibleAccounts: 0,
      }
    );

    setAccounts(normalized.data);
    setTotalPages(normalized.totalPages);
    setTotal(normalized.total);
    setStartIndex(normalized.startIndex);
    setEndIndex(normalized.endIndex);
    setSummary(
      normalized.summary as {
        totalAccounts: number;
        totalBalance: number;
        visibleAccounts: number;
      }
    );
  } catch (requestError: any) {
    setError(requestError.response?.data?.error || "Failed to load accounts");
  } finally {
    setLoading(false);
  }
}, [queryParams, page, pageSize, search]);

  React.useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  React.useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  const handleOpenCreate = () => {
    if (!canCreate) return;
    setForm({ id: null, name: "", openingBalance: "0" });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (account: Account) => {
    if (!canEdit) return;
    setForm({
      id: account.id,
      name: account.name,
      openingBalance: String(
        Number.isFinite(Number(account.openingBalance))
          ? Number(account.openingBalance)
          : Number(account.balance || 0)
      ),
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError("Account name is required");
      return;
    }

    const openingBalance = Number(form.openingBalance);
    if (!Number.isFinite(openingBalance)) {
      setError("Opening balance must be a valid number");
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (form.id) {
        await API.put(`/accounts/${form.id}`, {
          name: form.name.trim(),
          openingBalance,
        });
      } else {
        await API.post("/accounts", {
          name: form.name.trim(),
          openingBalance,
        });
      }

      setIsModalOpen(false);
      await fetchAccounts();
    } catch (requestError: any) {
      setError(requestError.response?.data?.error || "Failed to save account");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!canDelete) return;
    if (!window.confirm("Delete this account?")) return;

    setError("");
    try {
      await API.delete(`/accounts/${id}`);
      await fetchAccounts();
    } catch (requestError: any) {
      setError(requestError.response?.data?.error || "Failed to delete account");
    }
  };

  const activeFilterCount = [search.trim() !== ""].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Accounts</h2>
          <p className="text-sm text-muted-foreground">
            Final balance = opening balance + income - expense transactions.
          </p>
        </div>
        {canCreate && (
          <Button onClick={handleOpenCreate} className="w-full sm:w-auto gap-2 h-11 sm:h-10">
            <Plus className="h-4 w-4" />
            Add Account
          </Button>
        )}
      </div>

      {!canManage && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          Read-only access. You can view accounts but cannot modify them.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <Card className="border-none shadow-md ring-1 ring-blue-100 bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-900">Total Balance</CardTitle>
            <Wallet className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-950">{formatCurrency(summary.totalBalance)}</div>
            <p className="text-xs text-blue-700/70 mt-1 font-medium">Across all accounts</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md ring-1 ring-emerald-100 bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-900">Tracked Accounts</CardTitle>
            <Wallet className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-950">{summary.totalAccounts}</div>
            <p className="text-xs text-emerald-700/70 mt-1 font-medium">Available for transactions</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none bg-card/50 backdrop-blur-sm shadow-md">
  <CardContent className="p-5 sm:p-6">
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(320px,1fr)_160px_170px] xl:items-end">
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Search
        </Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search accounts..."
            className="h-11 rounded-xl bg-white pl-10"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Page Size
        </Label>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => setPageSize(Number(value || 10))}
        >
          <SelectTrigger className="h-11 rounded-xl bg-white">
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

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-transparent">
          Action
        </Label>
        <Button
          variant="outline"
          className="h-11 w-full rounded-xl"
          onClick={() => {
            setSearch("");
            setPage(1);
          }}
        >
          Clear Filters
        </Button>
      </div>
    </div>

    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
      <span>
        Showing {startIndex}-{endIndex} of {total} accounts
      </span>
    </div>

    <div className="mt-4 rounded-xl border bg-background/30 overflow-x-auto">
      <div className="min-w-[640px]">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Account Name</TableHead>
              <TableHead className="text-right">Opening</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: Math.min(pageSize, 8) }).map((_, index) => (
                <TableRow key={`account-skeleton-${index}`}>
                  <TableCell><Skeleton className="h-4 w-6" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-24" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-28" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="ml-auto h-8 w-8 rounded-md" /></TableCell>
                </TableRow>
              ))
            ) : accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <EmptyState
                    icon={Wallet}
                    title="No accounts found"
                    description="Create your first account to start tracking balances."
                    actionLabel={canCreate ? "Add Account" : undefined}
                    onAction={canCreate ? handleOpenCreate : undefined}
                    className="border-none rounded-none py-16"
                  />
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((account, index) => (
                <TableRow key={account.id} className="group hover:bg-muted/30 transition-colors">
                  <TableCell>
                    {(startIndex > 0 ? startIndex : (page - 1) * pageSize + 1) + index}
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold">{account.name}</div>
                  </TableCell>
                  <TableCell className="text-right font-medium text-slate-700">
                    {formatCurrency(account.openingBalance || 0)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(account.balance)}
                  </TableCell>
                  <TableCell className="text-right">
                    {(canEdit || canDelete) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuGroup>
                            {canEdit && (
                              <DropdownMenuItem
                                onClick={() => handleOpenEdit(account)}
                                className="gap-2"
                              >
                                <Pencil className="h-4 w-4" />
                                Edit Name
                              </DropdownMenuItem>
                            )}
                            {canEdit && canDelete && <DropdownMenuSeparator />}
                            {canDelete && (
                              <DropdownMenuItem
                                onClick={() => handleDelete(account.id)}
                                className="gap-2 text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete Account
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
    </div>

    <div className="mt-4 flex items-center justify-between">
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
          onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
          disabled={page === totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  </CardContent>
</Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Account" : "Add Account"}</DialogTitle>
            <DialogDescription>
              Set account name and opening balance.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Account Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="e.g. Main Checking"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="opening-balance">Opening Balance</Label>
              <Input
                id="opening-balance"
                type="number"
                step="0.01"
                value={form.openingBalance}
                onChange={(event) =>
                  setForm((current) => ({ ...current, openingBalance: event.target.value }))
                }
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}