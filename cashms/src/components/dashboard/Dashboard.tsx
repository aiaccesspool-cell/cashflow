import * as React from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  RefreshCcw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { API } from "@/services/api";
import usePermissions from "@/hooks/usePermissions";
import {
  buildReportQuery,
  formatCompactCurrency,
  formatCurrency,
  formatLongDate,
  formatPercent,
  getPresetRange,
} from "@/utils/reporting";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import CashFlowChart from "@/components/reports/CashFlowChart";
import CategoryBreakdownChart from "@/components/reports/CategoryBreakdownChart";

const PRESETS = [
  { key: "today", label: "Today" },
  { key: "7days", label: "7 Days" },
  { key: "thisMonth", label: "This Month" },
  { key: "all", label: "All Time" },
];

const INITIAL_DATA = {
  filters: getPresetRange("thisMonth"),
  summary: {
    "cash-in": 0,
    "cash-out": 0,
    balance: 0,
    totalTransactions: 0,
    averageTransaction: 0,
  },
  cashFlow: {
    grouping: "month",
    points: [],
  },
  categories: [],
  highlights: {
    topCategory: null,
    strongestIncomePeriod: null,
    strongestExpensePeriod: null,
    marginRate: null,
  },
  recentTransactions: [],
  accounts: [],
  accountSummary: {
    totalAccounts: 0,
    totalBalance: 0,
  },
};

export function Dashboard() {
  const { can } = usePermissions();
  const canViewTransactions = can("transactions.view");
  const canViewAccounts = can("accounts.view");

  const [filters, setFilters] = React.useState(getPresetRange("thisMonth"));
  const [activePreset, setActivePreset] = React.useState("thisMonth");
  const [data, setData] = React.useState<any>(INITIAL_DATA);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState("");
  const [refreshIndex, setRefreshIndex] = React.useState(0);
  const hasLoadedOnce = React.useRef(false);

  React.useEffect(() => {
    let ignore = false;

    const load = async () => {
      if (!hasLoadedOnce.current) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");
      try {
        const query = buildReportQuery(filters);
        const endpoint = query ? `/reports/dashboard?${query}` : "/reports/dashboard";
        const response = await API.get(endpoint);
        if (!ignore) {
          setData(response.data);
        }
      } catch (requestError: any) {
        if (!ignore) {
          setError(requestError.response?.data?.error || "Failed to load dashboard data");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
          setRefreshing(false);
          hasLoadedOnce.current = true;
        }
      }
    };

    load();

    return () => {
      ignore = true;
    };
  }, [filters, refreshIndex]);

  const applyPreset = (preset: string) => {
    setActivePreset(preset);
    setFilters(getPresetRange(preset));
  };

  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setActivePreset("custom");
    setFilters((current: any) => ({ ...current, [name]: value }));
  };

  if (loading) return <DashboardSkeleton canViewTransactions={canViewTransactions} canViewAccounts={canViewAccounts} />;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="border-none bg-card/50 backdrop-blur-sm shadow-md">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex-1 space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Quick Range
              </Label>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset) => (
                  <Button
                    key={preset.key}
                    variant={activePreset === preset.key ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => applyPreset(preset.key)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:w-[560px] lg:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">From</Label>
                <Input
                  type="date"
                  name="fromDate"
                  value={filters.fromDate}
                  onChange={handleDateChange}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">To</Label>
                <Input
                  type="date"
                  name="toDate"
                  value={filters.toDate}
                  onChange={handleDateChange}
                />
              </div>

              <div className="flex items-end justify-start gap-2 sm:col-span-2 lg:col-span-1 lg:justify-end">
                <Badge variant="secondary" className="h-9 rounded-full px-4 whitespace-nowrap">
                  {data.summary.totalTransactions} transactions
                </Badge>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setRefreshIndex((value) => value + 1)}
                  disabled={refreshing}
                >
                  <RefreshCcw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Income"
          value={formatCurrency(data.summary.income)}
          rawValue={Number(data.summary.income)}
          subtext={
            data.highlights.strongestIncomePeriod
              ? `Peak: ${data.highlights.strongestIncomePeriod.label}`
              : "No income in range"
          }
          icon={ArrowUpRight}
          tone="cash-in"
        />
        <MetricCard
          label="Cash-Out"
          value={formatCurrency(data.summary["cash-out"])}
          rawValue={Number(data.summary["cash-out"])}
          subtext={
            data.highlights.topCategory
              ? `Top category: ${data.highlights.topCategory.name}`
              : "No dominant category"
          }
          icon={ArrowDownRight}
          tone="cash-out"
        />
        <MetricCard
          label="Net Balance"
          value={formatCurrency(data.summary.balance)}
          rawValue={Number(data.summary.balance)}
          subtext={
            data.highlights.marginRate !== null
              ? `Margin ${formatPercent(data.highlights.marginRate)}`
              : "Margin unavailable"
          }
          icon={Number(data.summary.balance) < 0 ? TrendingDown : TrendingUp}
          tone="net"
        />
        <MetricCard
          label={canViewAccounts ? "Total Balance" : "Avg Transaction"}
          value={
            canViewAccounts
              ? formatCurrency(data.accountSummary.totalBalance)
              : formatCurrency(data.summary.averageTransaction)
          }
          rawValue={
            canViewAccounts
              ? Number(data.accountSummary.totalBalance)
              : Number(data.summary.averageTransaction)
          }
          subtext={
            canViewAccounts
              ? `${data.accountSummary.totalAccounts} accounts`
              : `${data.summary.totalTransactions} records`
          }
          icon={Wallet}
          tone="neutral"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-none bg-card/50 backdrop-blur-sm shadow-md">
          <CardHeader>
            <CardTitle>Cash Flow Trend</CardTitle>
            <CardDescription>
              {data.cashFlow.grouping === "day" ? "Daily" : "Monthly"} cash-in vs cash-out
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CashFlowChart points={data.cashFlow.points} grouping={data.cashFlow.grouping} />
          </CardContent>
        </Card>

        <Card className="border-none bg-card/50 backdrop-blur-sm shadow-md">
          <CardHeader>
            <CardTitle>Category Mix</CardTitle>
            <CardDescription>Breakdown by category share</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryBreakdownChart categories={data.categories} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        {canViewTransactions && (
          <Card className="lg:col-span-5 border-none bg-card/50 backdrop-blur-sm shadow-md">
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Latest activity within the selected range</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border bg-background/30 overflow-x-auto">
                <div className="min-w-[640px]">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recentTransactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No transactions in this range
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.recentTransactions.map((transaction: any, index: number) => (
                          <TableRow
                            key={transaction.id}
                            className={index % 2 === 0 ? "bg-white" : "bg-slate-50/45"}
                          >
                            <TableCell className="py-1.5">{formatLongDate(transaction.transaction_date)}</TableCell>
                            <TableCell className="py-1.5">
                              <div className="font-medium">{transaction.description}</div>
                              <div className="text-xs text-muted-foreground">
                                {transaction.Account?.name || "No account"}
                              </div>
                            </TableCell>
                            <TableCell className="py-1.5">{transaction.Category?.name || "Uncategorized"}</TableCell>
                            <TableCell className="py-1.5">
                              <span
                                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold lowercase ${
                                  transaction.type === "income"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-rose-200 bg-rose-50 text-rose-700"
                                }`}
                              >
                                {transaction.type}
                              </span>
                            </TableCell>
                            <TableCell className="py-1.5 text-right font-semibold">
                              {formatCurrency(transaction.amount)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className={`${canViewTransactions ? "lg:col-span-2" : "lg:col-span-7"} border-none bg-card/50 backdrop-blur-sm shadow-md`}>
          <CardHeader>
            <CardTitle>Highlights</CardTitle>
            <CardDescription>Key signals and account summary</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5 pt-1">
            <div className="rounded-xl border border-slate-200 bg-white/90 px-5 py-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Top category</div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="text-2xl font-semibold leading-none text-slate-900">
                  {data.highlights.topCategory?.name || "No data"}
                </div>
                <div className="text-sm font-medium text-slate-600">
                  {data.highlights.topCategory
                    ? formatCompactCurrency(data.highlights.topCategory.total)
                    : "-"}
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {data.highlights.topCategory ? "Highest category in this range" : "Needs more transactions"}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white/90 px-5 py-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Peak expense period</div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div className="text-2xl font-semibold leading-none text-slate-900">
                  {data.highlights.strongestExpensePeriod?.label || "Not available"}
                </div>
                <div className="text-sm font-medium text-slate-600">
                  {data.highlights.strongestExpensePeriod
                    ? formatCurrency(data.highlights.strongestExpensePeriod.expense)
                    : "-"}
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {data.highlights.strongestExpensePeriod ? "Strongest expense spike in range" : "No expense in range"}
              </div>
            </div>

            {canViewAccounts && (
              <div className="rounded-xl border border-slate-200 bg-white/90 px-5 py-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Accounts tracked</div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="text-2xl font-semibold leading-none text-slate-900">
                    {data.accountSummary.totalAccounts}
                  </div>
                  <div className="text-sm font-medium text-slate-600">
                    {formatCurrency(data.accountSummary.totalBalance)}
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Total balance across visible accounts
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton({
  canViewTransactions,
  canViewAccounts,
}: {
  canViewTransactions: boolean;
  canViewAccounts: boolean;
}) {
  return (
    <div className="space-y-6">
      <Card className="border-none bg-card/50 backdrop-blur-sm shadow-md">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-9 w-16 rounded-full" />
                <Skeleton className="h-9 w-20 rounded-full" />
                <Skeleton className="h-9 w-24 rounded-full" />
                <Skeleton className="h-9 w-20 rounded-full" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:w-[560px] lg:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-2">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-8" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="flex items-end justify-start gap-2 sm:col-span-2 lg:col-span-1 lg:justify-end">
                <Skeleton className="h-9 w-36 rounded-full" />
                <Skeleton className="h-9 w-9 rounded-lg" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="border-none shadow-sm ring-1 bg-white ring-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-40" />
              <Skeleton className="mt-2 h-3 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-none bg-card/50 backdrop-blur-sm shadow-md">
          <CardHeader>
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full rounded-xl" />
          </CardContent>
        </Card>
        <Card className="border-none bg-card/50 backdrop-blur-sm shadow-md">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-44" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full rounded-xl" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        {canViewTransactions && (
          <Card className="lg:col-span-5 border-none bg-card/50 backdrop-blur-sm shadow-md">
            <CardHeader>
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border bg-background/30 p-4">
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-10 w-full" />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className={`${canViewTransactions ? "lg:col-span-2" : "lg:col-span-7"} border-none bg-card/50 backdrop-blur-sm shadow-md`}>
          <CardHeader>
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-52" />
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5 pt-1">
            {Array.from({ length: canViewAccounts ? 3 : 2 }).map((_, index) => (
              <div key={index} className="rounded-xl border border-slate-200 bg-white/90 px-5 py-4">
                <Skeleton className="h-3 w-24" />
                <div className="mt-3 flex items-end justify-between gap-3">
                  <Skeleton className="h-7 w-28" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="mt-3 h-3 w-40" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  rawValue,
  subtext,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  rawValue?: number;
  subtext: string;
  icon: React.ElementType;
  tone: "cash-in" | "cash-out" | "neutral" | "net";
}) {
  const toneClass =
    tone === "cash-in"
      ? "ring-emerald-100 text-emerald-700"
      : tone === "cash-out"
        ? "ring-rose-100 text-rose-700"
        : "ring-indigo-100 text-indigo-700";

  const valueClass =
    tone === "cash-in"
      ? "text-emerald-700"
      : tone === "cash-out"
        ? "text-rose-700"
        : tone === "net" && Number(rawValue || 0) < 0
          ? "text-rose-700"
          : "text-slate-900";

  return (
    <Card className={`border-none shadow-sm ring-1 bg-white ${toneClass}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{subtext}</div>
      </CardContent>
    </Card>
  );
}
