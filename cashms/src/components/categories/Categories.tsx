import * as React from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Tags,
  Trash2,
} from "lucide-react";
import { API } from "@/services/api";
import usePermissions from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { normalizePaginatedResponse } from "@/utils/pagination";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

interface Category {
  id: number;
  name: string;
  // type: "income" | "expense";
  type: "cash-in" | "cash-out";
}

interface CategorySummary {
  totalCategories: number;
  incomeCategories: number;
  expenseCategories: number;
  visibleCategories: number;
}

export default function Categories() {
  const { can, canAny } = usePermissions();
  const canCreate = can("categories.create");
  const canEdit = can("categories.edit");
  const canDelete = can("categories.delete");
  const canManage = canAny(["categories.create", "categories.edit", "categories.delete"]);

  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [activeType, setActiveType] = React.useState("all");
  const [pageSize, setPageSize] = React.useState(10);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [startIndex, setStartIndex] = React.useState(0);
  const [endIndex, setEndIndex] = React.useState(0);
  const [summary, setSummary] = React.useState<CategorySummary>({
    totalCategories: 0,
    incomeCategories: 0,
    expenseCategories: 0,
    visibleCategories: 0,
  });

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<{
    id: number | null;
    name: string;
    type: "cash-in" | "cash-out";
  }>({
    id: null,
    name: "",
    type: "cash-out",
  });

  const queryParams = React.useMemo(
    () => ({
      page,
      pageSize,
      search: search.trim() || undefined,
      type: activeType === "all" ? undefined : activeType,
    }),
    [page, pageSize, search, activeType]
  );

  const fetchCategories = React.useCallback(async () => {
  setLoading(true);
  setError("");

  try {
    const response = await API.get("/categories", { params: queryParams });

    if (Array.isArray(response.data)) {
      const rawCategories = response.data as Category[];

      const filteredCategories = rawCategories.filter((item) => {
        const matchesSearch = !search.trim()
          || item.name.toLowerCase().includes(search.trim().toLowerCase());

        const matchesType =
          activeType === "all" || item.type === activeType;

        return matchesSearch && matchesType;
      });

      const start = (page - 1) * pageSize;
      const pagedCategories = filteredCategories.slice(start, start + pageSize);

      setCategories(pagedCategories);
      setTotal(filteredCategories.length);
      setTotalPages(Math.max(Math.ceil(filteredCategories.length / pageSize), 1));
      setStartIndex(filteredCategories.length === 0 ? 0 : start + 1);
      setEndIndex(filteredCategories.length === 0 ? 0 : start + pagedCategories.length);

      setSummary({
        totalCategories: rawCategories.length,
        incomeCategories: rawCategories.filter((item) => item.type === "cash-in").length,
        expenseCategories: rawCategories.filter((item) => item.type === "cash-out").length,
        visibleCategories: filteredCategories.length,
      });

      return;
    }

    const normalized = normalizePaginatedResponse<Category>(
      response.data,
      page,
      pageSize,
      {
        totalCategories: 0,
        incomeCategories: 0,
        expenseCategories: 0,
        visibleCategories: 0,
      }
    );

    setCategories(normalized.data);
    setTotalPages(normalized.totalPages);
    setTotal(normalized.total);
    setStartIndex(normalized.startIndex);
    setEndIndex(normalized.endIndex);
    setSummary(
      normalized.summary as {
        totalCategories: number;
        incomeCategories: number;
        expenseCategories: number;
        visibleCategories: number;
      }
    );
  } catch (requestError: any) {
    setError(requestError.response?.data?.error || "Failed to load categories");
  } finally {
    setLoading(false);
  }
}, [queryParams, page, pageSize, search, activeType]);

  React.useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  React.useEffect(() => {
    setPage(1);
  }, [search, activeType, pageSize]);

  const handleOpenCreate = () => {
    if (!canCreate) return;
    setForm({ id: null, name: "", type: "cash-out" });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (category: Category) => {
    if (!canEdit) return;
    setForm({ id: category.id, name: category.name, type: category.type });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Category name is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = { name: form.name.trim(), type: form.type };
      if (form.id) {
        await API.put(`/categories/${form.id}`, payload);
      } else {
        await API.post("/categories", payload);
      }

      setIsModalOpen(false);
      await fetchCategories();
    } catch (requestError: any) {
      setError(requestError.response?.data?.error || "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!canDelete) return;
    if (!window.confirm("Delete this category?")) return;

    setError("");
    try {
      await API.delete(`/categories/${id}`);
      await fetchCategories();
    } catch (requestError: any) {
      setError(requestError.response?.data?.error || "Failed to delete category");
    }
  };

  const activeFilterCount = [
    search.trim() !== "",
    activeType !== "all",
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-sm text-muted-foreground">
            Organize transactions into income and expense groups.
          </p>
        </div>
        {canCreate && (
          <Button onClick={handleOpenCreate} className="w-full sm:w-auto gap-2 h-11 sm:h-10">
            <Plus className="h-4 w-4" />
            New Category
          </Button>
        )}
      </div>

      {!canManage && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          Read-only access. You can view categories but cannot modify them.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Categories" value={summary.totalCategories} tone="neutral" />
        <MetricCard label="Cash-In Categories" value={summary.incomeCategories} tone="cash-in" />
        <MetricCard label="Cash-Out Categories" value={summary.expenseCategories} tone="cash-out" />
        <MetricCard label="Visible Now" value={summary.visibleCategories} tone="neutral" />
      </div>

      <Card className="border-none bg-card/50 backdrop-blur-sm shadow-md">
  <CardContent className="p-5 sm:p-6">
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(320px,1fr)_180px_150px_190px] xl:items-end">
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Search
        </Label>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search categories..."
            className="h-11 rounded-xl bg-white pl-10"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Type
        </Label>
        <Select
          value={activeType}
          onValueChange={(value) => setActiveType(value || "all")}
        >
          <SelectTrigger className="h-11 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="cash-in">Cash-In</SelectItem>
            <SelectItem value="cash-out">Cash-Out</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Page Size
        </Label>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => setPageSize(Number(value || 10))}
        >
          <SelectTrigger className="h-11 bg-white">
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
            setActiveType("all");
            setPage(1);
          }}
        >
          Clear Filters
        </Button>
      </div>
    </div>

    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
      <span>
        Showing {startIndex}-{endIndex} of {total} categories
      </span>
      <Badge variant="secondary" className="rounded-full px-3">
        {activeFilterCount} active
      </Badge>
    </div>
  </CardContent>
</Card>

      <Card className="border-none bg-card/50 backdrop-blur-sm shadow-md">
        <CardHeader>
          <CardTitle>Category List</CardTitle>
          <CardDescription>All categories currently available for transactions.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border bg-background/30 overflow-x-auto">
            <div className="min-w-[600px]">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Category Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: Math.min(pageSize, 8) }).map((_, index) => (
                      <TableRow key={`category-skeleton-${index}`}>
                        <TableCell className="py-2"><Skeleton className="h-4 w-6" /></TableCell>
                        <TableCell className="py-2">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="mt-2 h-3 w-32" />
                        </TableCell>
                        <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="ml-auto h-8 w-8 rounded-md" /></TableCell>
                      </TableRow>
                    ))
                  ) : categories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="p-0">
                        <EmptyState
                          icon={Tags}
                          title="No categories found"
                          description="Create a category to group similar transactions."
                          actionLabel={canCreate ? "New Category" : undefined}
                          onAction={canCreate ? handleOpenCreate : undefined}
                          className="border-none rounded-none py-16"
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    categories.map((category, index) => (
                      <TableRow
                        key={category.id}
                        className={cn(
                          "group transition-colors hover:bg-muted/30",
                          index % 2 === 0 ? "bg-white" : "bg-slate-50/45"
                        )}
                      >
                        <TableCell className="py-2 text-muted-foreground">
                          {(startIndex > 0 ? startIndex : (page - 1) * pageSize + 1) + index}
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="font-semibold">{category.name}</div>
                          <div className="text-xs text-muted-foreground">Transaction grouping tag</div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "h-6 border px-2.5 text-[11px] font-bold uppercase tracking-wider",
                              category.type === "cash-in"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                : "bg-rose-50 text-rose-700 border-rose-100"
                            )}
                          >
                            {category.type}
                          </Badge>
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
                              <DropdownMenuContent align="end">
                                <DropdownMenuGroup>
                                  {canEdit && (
                                    <DropdownMenuItem
                                      onClick={() => handleOpenEdit(category)}
                                      className="gap-2"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                      Edit
                                    </DropdownMenuItem>
                                  )}
                                  {canEdit && canDelete && <DropdownMenuSeparator />}
                                  {canDelete && (
                                    <DropdownMenuItem
                                      onClick={() => handleDelete(category.id)}
                                      className="gap-2 text-destructive focus:text-destructive"
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
            <DialogTitle>{form.id ? "Edit Category" : "New Category"}</DialogTitle>
            <DialogDescription>
              Define category name and whether it is income or expense.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="e.g. Rent"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={form.type}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    type: value === "cash-in" ? "cash-in" : "cash-out",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash-out">Cash-Out</SelectItem>
                  <SelectItem value="cash-in">Cash-In</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "cash-in" | "cash-out" | "neutral";
}) {
  const toneClass =
    tone === "cash-in"
      ? "ring-emerald-100"
      : tone === "cash-out"
        ? "ring-rose-100"
        : "ring-slate-200";

  const valueClass =
    tone === "cash-in"
      ? "text-emerald-700"
      : tone === "cash-out"
        ? "text-rose-700"
        : "text-slate-900";

  return (
    <Card className={`border-none bg-white shadow-sm ring-1 ${toneClass}`}>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className={`text-3xl font-semibold leading-none ${valueClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}