import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

interface CashFlowChartProps {
  points: any[];
  grouping: string;
}

interface CashFlowPoint {
  label: string;
  cashIn: number;
  cashOut: number;
  net: number;
}

const bdtFormatter = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatBdt = (value: number) =>
  bdtFormatter.format(Number.isFinite(value) ? value : 0);

function CashFlowTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload as CashFlowPoint | undefined;
  const cashIn = Number(point?.cashIn || 0);
  const cashOut = Number(point?.cashOut || 0);
  const net = Number(point?.net || 0);

  return (
    <div className="min-w-[180px] rounded-lg border border-slate-300 bg-white p-3 shadow-sm">
      <div className="mb-2 text-sm font-semibold text-slate-900">{label}</div>
      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-blue-600">Cash-In</span>
          <span className="font-medium text-slate-800">{formatBdt(cashIn)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-rose-600">Cash-Out</span>
          <span className="font-medium text-slate-800">{formatBdt(cashOut)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-4 border-t border-slate-200 pt-1.5">
          <span className="text-slate-600">Net</span>
          <span className={`font-semibold ${net < 0 ? "text-rose-700" : "text-emerald-700"}`}>
            {formatBdt(net)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function CashFlowChart({ points }: CashFlowChartProps) {
  return (
    <div className="h-[300px] w-full rounded-xl bg-white">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={points}
          style={{ backgroundColor: "#ffffff" }}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis 
            dataKey="label" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "#475569", fontSize: 12 }}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: "#475569", fontSize: 12 }}
            tickFormatter={(value) => `BDT ${value / 1000}k`}
          />
          <Tooltip 
            content={<CashFlowTooltip />}
            cursor={{ fill: "rgba(148, 163, 184, 0.14)" }}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: "12px", paddingTop: "20px", color: "#334155" }}
          />
          <Bar 
            dataKey="cashIn" 
            name="Cash-In" 
            fill="#3B82F6"
            radius={[4, 4, 0, 0]} 
            barSize={20}
          />
          <Bar 
            dataKey="cashOut" 
            name="Cash-Out" 
            fill="#EF4444"
            radius={[4, 4, 0, 0]} 
            barSize={20}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
