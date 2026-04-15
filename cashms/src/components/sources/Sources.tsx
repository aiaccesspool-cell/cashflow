import * as React from "react";
import {
  AlertCircle,
  Building2,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Smartphone,
  Trash2,
  Wallet,
} from "lucide-react";
import { API } from "@/services/api";
import usePermissions from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { normalizePaginatedResponse } from "@/utils/pagination";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

const SOURCE_TYPES = ["bank", "mfs", "cash"] as const;
type SourceType = (typeof SOURCE_TYPES)[number];

type SourceFilterType = "all" | SourceType;

interface Source {
  id: number;
  name: string;
  type: SourceType;
}

interface SourceSummary {
  totalSources: number;
  bankCount: number;
  mfsCount: number;
  cashCount: number;
  visibleSources: number;
}

const TYPE_LABEL: Record<SourceType, string> = {
  bank: "Bank",
  mfs: "MFS",
  cash: "Cash",
};

const TYPE_PLACEHOLDER: Record<SourceType, string> = {
  bank: "Bank Name",
  mfs: "MFS Name",
  cash: "Cash Name",
};

export default function Sources() {
  const { can, canAny } = usePermissions();
  const canCreate = can("sources.create");
  const canEdit = can("sources.edit");
  const canDelete = can("sources.delete");
  const canManage = canAny(["sources.create", "sources.edit", "sources.delete"]);

  const [sources, setSources] = React.useState<Source[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [activeType, setActiveType] = React.useState<SourceFilterType>("all");
  const [pageSize, setPageSize] = React.useState(10);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [startIndex, setStartIndex] = React.useState(0);
  const [endIndex, setEndIndex] = React.useState(0);
  const [summary, setSummary] = React.useState<SourceSummary>({
    totalSources: 0,
    bankCount: 0,
    mfsCount: 0,
    cashCount: 0,
    visibleSources: 0,
  });

  const [saving, setSaving] = React.useState(false);
  const [createType, setCreateType] = React.useState<SourceType>("bank");
  const [createName, setCreateName] = React.useState("");

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editForm, setEditForm] = React.useState<{
    id: number | null;
    name: string;
    type: SourceType;
  }>({
    id: null,
    name: "",
    type: "bank",
  });

  const queryParams = React.useMemo(
    () => ({
      page,
      pageSize,
      search: search.trim() || undefined,
      type: activeType === "all" ? undefined : activeType,
    }),
    [page, pageSize, search, activeType],
  );

  const fetchSources = React.useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await API.get("/sources", { params: queryParams });

      if (Array.isArray(response.data)) {
        const rawSources = response.data as Source[];
        const term = search.trim().toLowerCase();

        const filtered = rawSources.filter((item) => {
          const matchesSearch = !term || item.name.toLowerCase().includes(term);
          const matchesType = activeType === "all" || item.type === activeType;
          return matchesSearch && matchesType;
        });

        const start = (page - 1) * pageSize;
        const paged = filtered.slice(start, start + pageSize);

        setSources(paged);
        setTotal(filtered.length);
        setTotalPages(Math.max(Math.ceil(filtered.length / pageSize), 1));
        setStartIndex(filtered.length === 0 ? 0 : start + 1);
        setEndIndex(filtered.length === 0 ? 0 : start + paged.length);

        setSummary({
          totalSources: rawSources.length,
          bankCount: rawSources.filter((item) => item.type === "bank").length,
          mfsCount: rawSources.filter((item) => item.type === "mfs").length,
          cashCount: rawSources.filter((item) => item.type === "cash").length,
          visibleSources: filtered.length,
        });

        return;
      }

      const normalized = normalizePaginatedResponse<Source>(
        response.data,
        page,
        pageSize,
        {
          totalSources: 0,
          bankCount: 0,
          mfsCount: 0,
          cashCount: 0,
          visibleSources: 0,
        },
      );

      setSources(normalized.data);
      setTotal(normalized.total);
      setTotalPages(normalized.totalPages);
      setStartIndex(normalized.startIndex);
      setEndIndex(normalized.endIndex);
      setSummary(
        normalized.summary as {
          totalSources: number;
          bankCount: number;
          mfsCount: number;
          cashCount: number;
          visibleSources: number;
        },
      );
    } catch (requestError: any) {
      setError(requestError.response?.data?.error || "Failed to load sources");
    } finally {
      setLoading(false);
    }
  }, [queryParams, page, pageSize, search, activeType]);

  React.useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  React.useEffect(() => {
    setPage(1);
  }, [search, activeType, pageSize]);

  const handleCreate = async () => {
    const normalizedName = createName.trim();

    if (!canCreate) {
      return;
    }

    if (!normalizedName) {
      setError(`${TYPE_PLACEHOLDER[createType]} is required`);
      return;
    }

    setSaving(true);
    setError("");

    try {
      await API.post("/sources", {
        name: normalizedName,
        type: createType,
      });

      setCreateName("");
      await fetchSources();
    } catch (requestError: any) {
      setError(requestError.response?.data?.error || "Failed to create source");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (source: Source) => {
    if (!canEdit) {
      return;
    }

    setEditForm({
      id: source.id,
      name: source.name,
      type: source.type,
    });
    setIsModalOpen(true);
  };

  const handleUpdate = async () => {
    const normalizedName = editForm.name.trim();

    if (!canEdit || !editForm.id) {
      return;
    }

    if (!normalizedName) {
      setError("Source name is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await API.put(`/sources/${editForm.id}`, {
        name: normalizedName,
        type: editForm.type,
      });

      setIsModalOpen(false);
      await fetchSources();
    } catch (requestError: any) {
      setError(requestError.response?.data?.error || "Failed to update source");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!canDelete) {
      return;
    }

    if (!window.confirm("Delete this source?")) {
      return;
    }

    setError("");

    try {
      await API.delete(`/sources/${id}`);
      await fetchSources();
    } catch (requestError: any) {
      setError(requestError.response?.data?.error || "Failed to delete source");
    }
  };

  const activeFilterCount = [search.trim() !== "", activeType !== "all"].filter(Boolean)
    .length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Sources</h1>
        <p className="text-sm text-muted-foreground">
          Manage transaction sources (Bank, MFS, and Cash) for cleaner tracking.
        </p>
      </div>

      {!canManage && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          Read-only access. You can view sources but cannot modify them.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Sources" value={summary.totalSources} tone="neutral" />
        <MetricCard label="Bank" value={summary.bankCount} tone="bank" />
        <MetricCard label="MFS" value={summary.mfsCount} tone="mfs" />
        <MetricCard label="Cash" value={summary.cashCount} tone="cash" />
      </div>

      <Card className="border-none bg-card/50 backdrop-blur-sm shadow-md">
        <CardHeader>
          <CardTitle>Source Setup</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-[1fr_2fr_auto] md:items-end">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Source Type
              </Label>
              <div className="flex flex-wrap gap-2">
                {SOURCE_TYPES.map((type) => (
                  <Button
                    key={type}
                    type="button"
                    variant={createType === type ? "default" : "outline"}
                    className="rounded-full"
                    onClick={() => setCreateType(type)}
                    disabled={!canCreate}
                  >
                    {TYPE_LABEL[type]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {TYPE_PLACEHOLDER[createType]}
              </Label>
              <Input
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                placeholder={`Enter ${TYPE_PLACEHOLDER[createType]}`}
                className="h-11 bg-white"
                disabled={!canCreate}
              />
            </div>

            <Button
              className="h-11 gap-2"
              onClick={handleCreate}
              disabled={!canCreate || saving}
            >
              <Plus className="h-4 w-4" />
              Save
            </Button>
          </div>
        </CardContent>
      </Card>

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
                  placeholder="Search sources..."
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
                onValueChange={(value) =>
                  setActiveType((value as SourceFilterType) || "all")
                }
              >
                <SelectTrigger className="h-11 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="mfs">MFS</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
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
              Showing {startIndex}-{endIndex} of {total} sources
            </span>
            <Badge variant="secondary" className="rounded-full px-3">
              {activeFilterCount} active
            </Badge>
          </div>

          <div className="mt-4 rounded-xl border bg-background/30 overflow-x-auto">
            <div className="min-w-[620px]">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: Math.min(pageSize, 8) }).map((_, index) => (
                      <TableRow key={`source-skeleton-${index}`}>
                        <TableCell><Skeleton className="h-4 w-6" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-44" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="ml-auto h-8 w-8 rounded-md" /></TableCell>
                      </TableRow>
                    ))
                  ) : sources.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="p-0">
                        <EmptyState
                          icon={Wallet}
                          title="No sources found"
                          description="Create a source to map transactions by Bank, MFS, or Cash."
                          className="border-none rounded-none py-16"
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    sources.map((source, index) => (
                      <TableRow key={source.id} className="group hover:bg-muted/30 transition-colors">
                        <TableCell>
                          {(startIndex > 0 ? startIndex : (page - 1) * pageSize + 1) + index}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold">{source.name}</div>
                        </TableCell>
                        <TableCell>
                          <TypeBadge type={source.type} />
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
                                    <DropdownMenuItem className="gap-2" onClick={() => openEdit(source)}>
                                      <Pencil className="h-3.5 w-3.5" />
                                      Edit
                                    </DropdownMenuItem>
                                  )}
                                  {canEdit && canDelete && <DropdownMenuSeparator />}
                                  {canDelete && (
                                    <DropdownMenuItem
                                      className="gap-2 text-destructive focus:text-destructive"
                                      onClick={() => handleDelete(source.id)}
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
            <DialogTitle>Edit Source</DialogTitle>
            <DialogDescription>
              Update source type and source name.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select
                value={editForm.type}
                onValueChange={(value) =>
                  setEditForm((current) => ({
                    ...current,
                    type: (value as SourceType) || "bank",
                  }))
                }
              >
                <SelectTrigger>
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
              <Label>{TYPE_PLACEHOLDER[editForm.type]}</Label>
              <Input
                value={editForm.name}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder={`Enter ${TYPE_PLACEHOLDER[editForm.type]}`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
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
  tone: "bank" | "mfs" | "cash" | "neutral";
}) {
  const toneClass =
    tone === "bank"
      ? "ring-blue-100"
      : tone === "mfs"
        ? "ring-violet-100"
        : tone === "cash"
          ? "ring-emerald-100"
          : "ring-slate-200";

  const valueClass =
    tone === "bank"
      ? "text-blue-700"
      : tone === "mfs"
        ? "text-violet-700"
        : tone === "cash"
          ? "text-emerald-700"
          : "text-slate-900";

  const icon =
    tone === "bank" ? (
      <Building2 className="h-4 w-4 text-blue-600" />
    ) : tone === "mfs" ? (
      <Smartphone className="h-4 w-4 text-violet-600" />
    ) : tone === "cash" ? (
      <Wallet className="h-4 w-4 text-emerald-600" />
    ) : (
      <Wallet className="h-4 w-4 text-slate-600" />
    );

  return (
    <Card className={`border-none bg-white shadow-sm ring-1 ${toneClass}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="pt-0">
        <div className={`text-3xl font-semibold leading-none ${valueClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function TypeBadge({ type }: { type: SourceType }) {
  if (type === "bank") {
    return <Badge className="bg-blue-50 text-blue-700 border border-blue-100">Bank</Badge>;
  }

  if (type === "mfs") {
    return <Badge className="bg-violet-50 text-violet-700 border border-violet-100">MFS</Badge>;
  }

  return <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100">Cash</Badge>;
}
