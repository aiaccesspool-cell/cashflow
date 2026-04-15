import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from "recharts";

interface CategoryBreakdownChartProps {
  categories: any[];
}

interface CategoryPoint {
  name: string;
  value: number;
}

const COLORS = [
  "oklch(0.6 0.18 250)", // Blue
  "oklch(0.65 0.15 180)", // Teal
  "oklch(0.75 0.12 60)", // Amber
  "oklch(0.5 0.15 300)", // Purple
  "oklch(0.6 0.15 120)", // Green
  "oklch(0.6 0.18 25)", // Rose
];

const bdtFormatter = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function CategoryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: CategoryPoint; value?: number }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload;
  const value = Number(point?.value || payload[0]?.value || 0);

  return (
    <div className="min-w-[170px] rounded-lg border border-slate-300 bg-white px-3 py-2.5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Category
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-900">
        {point?.name || "Unknown"}
      </div>
      <div className="mt-2 text-sm text-slate-700">
        {bdtFormatter.format(Number.isFinite(value) ? value : 0)}
      </div>
    </div>
  );
}

export default function CategoryBreakdownChart({ categories = [] }: CategoryBreakdownChartProps) {
  const safeCategories = Array.isArray(categories) ? categories : [];
  const data = safeCategories.map(c => ({
    name: c.name,
    value: Number(c.total || 0)
  }));
  const hasData = data.some((item) => item.value > 0);

  return (
    <div className="w-full">
      <div className="h-[230px] w-full">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={62}
                outerRadius={86}
                paddingAngle={4}
                dataKey="value"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CategoryTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No category data in this range
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 px-1">
        {data.map((item, index) => (
          <div key={`${item.name}-${index}`} className="flex min-w-[46%] items-start gap-2">
            <span
              className="mt-1 inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className="min-w-0 break-words text-sm leading-5 text-slate-700">
              {item.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
