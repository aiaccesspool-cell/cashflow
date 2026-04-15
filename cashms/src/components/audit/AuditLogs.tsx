import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileClock,
  Search,
  ShieldAlert,
} from "lucide-react";
import { API } from "@/services/api";
import { normalizePaginatedResponse } from "@/utils/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AuditLogRecord {
  id: number;
  module: string;
  action: string;
  entityId: string | null;
  summary: string;
  actorUserId: number | null;
  actorName: string | null;
  actorRole: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

const MODULE_OPTIONS = [
  { value: "all", label: "All Modules" },
  { value: "transactions", label: "Transactions" },
  { value: "accounts", label: "Accounts" },
  { value: "sources", label: "Sources" },
  { value: "users", label: "Users" },
  { value: "auth", label: "Auth" },
];

const ACTION_OPTIONS = [
  { value: "all", label: "All Actions" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
  { value: "disable", label: "Disable" },
  { value: "restore", label: "Restore" },
  { value: "password_change", label: "Password Change" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const MODULE_BADGE: Record<string, string> = {
  transactions: "bg-blue-50 text-blue-700 border-blue-100",
  accounts: "bg-emerald-50 text-emerald-700 border-emerald-100",
  sources: "bg-amber-50 text-amber-700 border-amber-100",
  users: "bg-violet-50 text-violet-700 border-violet-100",
  auth: "bg-slate-50 text-slate-700 border-slate-200",
};

const ACTION_BADGE: Record<string, string> = {
  create: "bg-emerald-50 text-emerald-700 border-emerald-100",
  update: "bg-blue-50 text-blue-700 border-blue-100",
  delete: "bg-rose-50 text-rose-700 border-rose-100",
  disable: "bg-rose-50 text-rose-700 border-rose-100",
  restore: "bg-emerald-50 text-emerald-700 border-emerald-100",
  password_change: "bg-amber-50 text-amber-700 border-amber-100",
};

const formatLabel = (value?: string | null) => {
  const normalized = (value || "").trim();
  if (!normalized) return "-";
  return normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString();
};

export default function AuditLogs() {
  const [logs, setLogs] = React.useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const [search, setSearch] = React.useState("");
  const [moduleFilter, setModuleFilter] = React.useState("all");
  const [actionFilter, setActionFilter] = React.useState("all");
  const [pageSize, setPageSize] = React.useState(20);
  const [page, setPage] = React.useState(1);

  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [startIndex, setStartIndex] = React.useState(0);
  const [endIndex, setEndIndex] = React.useState(0);

  const queryParams = React.useMemo(
    () => ({
      page,
      pageSize,
      search: search.trim() || undefined,
      module: moduleFilter === "all" ? undefined : moduleFilter,
      action: actionFilter === "all" ? undefined : actionFilter,
    }),
    [page, pageSize, search, moduleFilter, actionFilter],
  );

  const fetchLogs = React.useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await API.get("/audit-logs", { params: queryParams });
      const normalized = normalizePaginatedResponse<AuditLogRecord>(
        response.data,
        page,
        pageSize,
      );

      setLogs(normalized.data);
      setTotal(normalized.total);
      setTotalPages(normalized.totalPages);
      setStartIndex(normalized.startIndex);
      setEndIndex(normalized.endIndex);
    } catch (requestError: any) {
      setLogs([]);
      setTotal(0);
      setTotalPages(1);
      setStartIndex(0);
      setEndIndex(0);
      setError(
        requestError.response?.data?.error || "Failed to load audit logs",
      );
    } finally {
      setLoading(false);
    }
  }, [queryParams, page, pageSize]);

  React.useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  React.useEffect(() => {
    setPage(1);
  }, [search, moduleFilter, actionFilter, pageSize]);

  const todayCount = React.useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();

    return logs.filter((item) => {
      const parsed = new Date(item.createdAt);
      return (
        parsed.getFullYear() === year &&
        parsed.getMonth() === month &&
        parsed.getDate() === day
      );
    }).length;
  }, [logs]);

  const activeFilterCount = [
    Boolean(search.trim()),
    moduleFilter !== "all",
    actionFilter !== "all",
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Audit Logs</h2>
        <p className="text-sm text-muted-foreground">
          Minimal activity history for sensitive actions.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-none shadow-md ring-1 ring-slate-200 bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-900">
              Total Matches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-950">{total}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md ring-1 ring-blue-100 bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-900">
              On This Page
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-950">{logs.length}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md ring-1 ring-amber-100 bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-900">
              Today (Page)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-950">{todayCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none bg-card/50 backdrop-blur-sm shadow-md">
        <CardContent className="p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(320px,1fr)_200px_200px_150px] xl:items-end">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Search
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-11 rounded-xl bg-white pl-10"
                  placeholder="Search summary or actor..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Module
              </Label>
              <Select
                value={moduleFilter}
                onValueChange={(value) => setModuleFilter(value || "all")}
              >
                <SelectTrigger className="h-11 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODULE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Action
              </Label>
              <Select
                value={actionFilter}
                onValueChange={(value) => setActionFilter(value || "all")}
              >
                <SelectTrigger className="h-11 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Page Size
              </Label>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => setPageSize(Number(value || 20))}
              >
                <SelectTrigger className="h-11 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex}-{endIndex} of {total} logs
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{activeFilterCount} active</Badge>
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setModuleFilter("all");
                  setActionFilter("all");
                  setPage(1);
                }}
              >
                Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none bg-card/50 backdrop-blur-sm shadow-md">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-16">#</TableHead>
                  <TableHead className="min-w-[170px]">Time</TableHead>
                  <TableHead className="min-w-[120px]">Module</TableHead>
                  <TableHead className="min-w-[140px]">Action</TableHead>
                  <TableHead className="min-w-[320px]">Summary</TableHead>
                  <TableHead className="min-w-[180px]">Actor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, rowIndex) => (
                    <TableRow key={`audit-skeleton-${rowIndex}`}>
                      <TableCell>
                        <Skeleton className="h-4 w-8" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-36" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-20 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-20 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-full max-w-[280px]" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-0">
                      <EmptyState
                        icon={FileClock}
                        title="No audit logs found"
                        description="No records matched your current filters."
                        className="border-none rounded-none py-16"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log, index) => (
                    <TableRow key={log.id} className={index % 2 ? "bg-slate-50/40" : ""}>
                      <TableCell className="text-muted-foreground">
                        {(startIndex > 0
                          ? startIndex
                          : (page - 1) * pageSize + 1) + index}
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {formatDateTime(log.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={MODULE_BADGE[log.module] || "bg-slate-50 text-slate-700 border-slate-200"}
                        >
                          {formatLabel(log.module)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={ACTION_BADGE[log.action] || "bg-slate-50 text-slate-700 border-slate-200"}
                        >
                          {formatLabel(log.action)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900">{log.summary}</div>
                        <div className="text-xs text-muted-foreground">
                          Entity: {log.entityId || "-"} | IP: {log.ipAddress || "-"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900">
                          {log.actorName || "System"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatLabel(log.actorRole)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between border-t px-4 py-4">
            <span className="text-sm text-muted-foreground">
              Page {page} of {Math.max(totalPages, 1)}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((current) => Math.min(current + 1, Math.max(totalPages, 1)))
                }
                disabled={page >= Math.max(totalPages, 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border bg-amber-50/70 px-4 py-3 text-xs text-amber-900">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldAlert className="h-4 w-4" />
          Security Note
        </div>
        <div className="mt-1">
          This is a minimal immutable trail for critical actions only.
        </div>
      </div>
    </div>
  );
}
