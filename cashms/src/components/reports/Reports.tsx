import * as React from "react";
import { useEffect, useRef, useState } from "react";
import {
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart as PieChartIcon,
  RefreshCcw,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Zap,
  Filter
} from "lucide-react";
import { API } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { hasPermission } from "@/utils/permissions";
import {
  buildReportQuery,
  formatCompactCurrency,
  formatCurrency,
  formatDateRangeLabel,
  formatPercent,
  getPresetRange,
} from "@/utils/reporting";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import CashFlowChart from "./CashFlowChart";
import CategoryBreakdownChart from "./CategoryBreakdownChart";
import { motion } from "motion/react";

const REPORT_PRESETS = [
  { key: "today", label: "Today" },
  { key: "7days", label: "7 Days" },
  { key: "thisMonth", label: "This Month" },
  { key: "all", label: "All Time" },
];

const initialReportData = {
  filters: getPresetRange("all"),
  summary: {
    "cash-in": 0,
    "cash-out": 0,
    balance: 0,
    totalTransactions: 0,
    averageTransaction: 0,
    totalVolume: 0,
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
  accountSummary: {
    totalAccounts: 0,
    totalBalance: 0,
  },
};

export default function Reports() {
  const { user } = useAuth();
  const canViewAccounts = hasPermission(user, "accounts.view");

  const [filters, setFilters] = useState(getPresetRange("all"));
  const [activePreset, setActivePreset] = useState("all");
  const [reportData, setReportData] = useState(initialReportData);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    let ignore = false;

    const loadReports = async () => {
      if (!hasLoadedOnce.current) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const query = buildReportQuery(filters);
        const endpoint = query ? `/reports/dashboard?${query}` : "/reports/dashboard";
        const response = await API.get(endpoint);

        if (!ignore) {
          setReportData(response.data as any);
        }
      } catch (err) {
        console.error("Failed to load reports", err);
      } finally {
        if (!ignore) {
          setLoading(false);
          setRefreshing(false);
          hasLoadedOnce.current = true;
        }
      }
    };

    loadReports();

    return () => {
      ignore = true;
    };
  }, [filters, refreshIndex]);

  const applyPreset = (preset: string) => {
    setActivePreset(preset);
    setFilters(getPresetRange(preset));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setActivePreset("custom");
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  if (loading) {
    return <ReportsSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Financial Reports</h2>
          <p className="text-muted-foreground">
            Deep dive into your cash flow, category spending, and performance metrics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="px-4 h-9 gap-2 bg-indigo-50 text-indigo-700 border-indigo-100 shadow-sm shadow-indigo-50 rounded-full font-medium">
            <CalendarIcon className="h-4 w-4" />
            {formatDateRangeLabel(filters)}
          </Badge>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setRefreshIndex(i => i + 1)}
            disabled={refreshing}
            className="rounded-full"
          >
            <RefreshCcw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
        </div>
      </div>

      {/* Filters Card */}
      <Card className="border-none bg-card/50 backdrop-blur-sm shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end">
            <div className="flex-1 space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Quick Select</Label>
              <div className="flex flex-wrap gap-2">
                {REPORT_PRESETS.map((p) => (
                  <Button
                    key={p.key}
                    variant={activePreset === p.key ? "default" : "outline"}
                    size="sm"
                    onClick={() => applyPreset(p.key)}
                    className="rounded-full px-4"
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 lg:w-96">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">From</Label>
                <Input 
                  type="date" 
                  name="fromDate" 
                  value={filters.fromDate} 
                  onChange={handleDateChange}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">To</Label>
                <Input 
                  type="date" 
                  name="toDate" 
                  value={filters.toDate} 
                  onChange={handleDateChange}
                  className="bg-background/50"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard 
          label="Total Income" 
          value={formatCurrency(reportData.summary["cash-in"])}
          subtext={`${reportData.summary.totalTransactions} transactions`}
          icon={ArrowUpRight}
          trend="up"
          className="bg-white ring-1 ring-emerald-100"
        />
        <MetricCard 
          label="Total Expense" 
          value={formatCurrency(reportData.summary["cash-out"])}
          subtext={`${formatCompactCurrency(reportData.summary.totalVolume)} volume`}
          icon={ArrowDownRight}
          trend="down"
          className="bg-white ring-1 ring-rose-100"
        />
        <MetricCard 
          label="Net Balance" 
          value={formatCurrency(reportData.summary.balance)}
          subtext={reportData.highlights.marginRate ? `${formatPercent(reportData.highlights.marginRate)} margin` : "N/A"}
          icon={TrendingUp}
          trend="neutral"
          className="bg-white ring-1 ring-blue-100"
        />
        <MetricCard 
          label={canViewAccounts ? "Account Assets" : "Avg. Transaction"} 
          value={canViewAccounts ? formatCurrency(reportData.accountSummary.totalBalance) : formatCurrency(reportData.summary.averageTransaction)}
          subtext={canViewAccounts ? `${reportData.accountSummary.totalAccounts} accounts` : "Per operation"}
          icon={BarChart3}
          trend="neutral"
          className="bg-white ring-1 ring-indigo-100"
        />
      </div>

      {/* Main Charts Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-none bg-card/50 backdrop-blur-sm shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Cash Flow Trend</CardTitle>
                <CardDescription>Income vs Expenses over the selected period.</CardDescription>
              </div>
              <Badge variant="outline" className="font-mono bg-white/50 px-3 h-7 rounded-full border-slate-200 text-slate-600">
                {reportData.cashFlow.points.length} data points
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <CashFlowChart points={reportData.cashFlow.points} grouping={reportData.cashFlow.grouping} />
          </CardContent>
        </Card>

        <Card className="border-none bg-card/50 backdrop-blur-sm shadow-xl">
          <CardHeader>
            <CardTitle>Insights & Signals</CardTitle>
            <CardDescription>Automated financial highlights.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <SignalItem 
              label="Top Spending Category" 
              value={reportData.highlights.topCategory?.name || "None"} 
              subtext={reportData.highlights.topCategory ? `${formatCurrency(reportData.highlights.topCategory.total)} total` : "No data available"}
              icon={Target}
            />
            <Separator className="opacity-50" />
            <SignalItem 
              label="Strongest Income Period" 
              value={reportData.highlights.strongestIncomePeriod?.label || "None"} 
              subtext={reportData.highlights.strongestIncomePeriod ? formatCurrency(reportData.highlights.strongestIncomePeriod.income) : "No data available"}
              icon={Zap}
            />
            <Separator className="opacity-50" />
            <SignalItem 
              label="Strongest Expense Period" 
              value={reportData.highlights.strongestExpensePeriod?.label || "None"} 
              subtext={reportData.highlights.strongestExpensePeriod ? formatCurrency(reportData.highlights.strongestExpensePeriod.expense) : "No data available"}
              icon={TrendingDown}
            />
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section: Breakdown & Ranking */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-4 xl:col-span-4 border-none bg-card/50 backdrop-blur-sm shadow-xl">
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
            <CardDescription>Distribution of expenses by category.</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryBreakdownChart categories={reportData.categories} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-8 xl:col-span-8 border-none bg-card/50 backdrop-blur-sm shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Category Performance</CardTitle>
                <CardDescription>Detailed ranking by transaction volume.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border bg-background/30">
                <Table className="table-fixed">
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[30%] font-bold">Category</TableHead>
                    <TableHead className="w-[15%] font-bold">Type</TableHead>
                    <TableHead className="w-[14%] font-bold">Transactions</TableHead>
                    <TableHead className="w-[13%] font-bold">Share</TableHead>
                    <TableHead className="w-[28%] text-right font-bold">Total Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.categories.map((c) => (
                    <TableRow key={`${c.categoryId}-${c.type}`} className="group hover:bg-muted/30 transition-colors border-b last:border-0">
                      <TableCell className="font-bold text-slate-900 whitespace-normal break-words">
                        {c.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn(
                          "text-[10px] uppercase tracking-wider font-bold px-2 h-5 rounded-md",
                          c.type === "income" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100"
                        )}>
                          {c.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.count}</TableCell>
                      <TableCell className="font-medium">{formatPercent(c.share)}</TableCell>
                      <TableCell className="text-right font-bold text-slate-900">
                        {formatCurrency(c.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-56 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </div>

      <Card className="border-none bg-card/50 backdrop-blur-sm shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-9 w-16 rounded-full" />
                <Skeleton className="h-9 w-20 rounded-full" />
                <Skeleton className="h-9 w-24 rounded-full" />
                <Skeleton className="h-9 w-20 rounded-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 lg:w-96">
              <div className="space-y-2">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-8" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="border-none backdrop-blur-sm shadow-md overflow-hidden bg-white ring-1 ring-slate-200">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <Skeleton className="h-1 w-8 rounded-full" />
              </div>
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-2 h-8 w-36" />
              <Skeleton className="mt-2 h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-none bg-card/50 backdrop-blur-sm shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
              <Skeleton className="h-7 w-24 rounded-full" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full rounded-xl" />
          </CardContent>
        </Card>

        <Card className="border-none bg-card/50 backdrop-blur-sm shadow-xl">
          <CardHeader>
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-44" />
          </CardHeader>
          <CardContent className="space-y-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <React.Fragment key={index}>
                <div className="flex items-start gap-4">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="w-full space-y-2">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
                {index < 2 && <div className="h-px w-full bg-border/60" />}
              </React.Fragment>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-4 xl:col-span-4 border-none bg-card/50 backdrop-blur-sm shadow-xl">
          <CardHeader>
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[310px] w-full rounded-xl" />
          </CardContent>
        </Card>

        <Card className="lg:col-span-8 xl:col-span-8 border-none bg-card/50 backdrop-blur-sm shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-56" />
              </div>
              <Skeleton className="h-9 w-20 rounded-lg" />
            </div>
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
      </div>
    </div>
  );
}

function MetricCard({ label, value, subtext, icon: Icon, trend, className }: any) {
  return (
    <Card className={cn("border-none backdrop-blur-sm shadow-md overflow-hidden group", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn(
            "p-2 rounded-lg transition-colors",
            trend === "up" ? "bg-emerald-500/10 text-emerald-600" : 
            trend === "down" ? "bg-rose-500/10 text-rose-600" : 
            "bg-indigo-500/10 text-indigo-600"
          )}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="h-1 w-8 rounded-full bg-muted group-hover:bg-primary/30 transition-colors" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
          <h3 className="text-2xl font-bold tracking-tight">{value}</h3>
          <p className="text-[10px] text-muted-foreground font-medium">{subtext}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SignalItem({ label, value, subtext, icon: Icon }: any) {
  return (
    <div className="flex items-start gap-4 group">
      <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
        <Icon className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="font-semibold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground">{subtext}</p>
      </div>
    </div>
  );
}

function Label({ children, className }: any) {
  return <label className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)}>{children}</label>;
}
