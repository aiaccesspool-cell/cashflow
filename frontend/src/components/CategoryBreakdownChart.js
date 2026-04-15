import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { formatCompactCurrency, formatPercent } from "../utils/reporting";

ChartJS.register(ArcElement, Tooltip, Legend);

const CHART_COLORS = [
  "#1f3b73",
  "#167f5d",
  "#d95d39",
  "#f0a202",
  "#6847b7",
  "#2f8f9d",
  "#c4496c",
  "#7a8b99",
];

export default function CategoryBreakdownChart({ categories = [] }) {
  if (!categories.length) {
    return (
      <div className="analytics-empty-state">
        <strong>No category activity</strong>
        <span>Transactions in the selected range will appear here.</span>
      </div>
    );
  }

  const chartData = {
    labels: categories.map((category) => category.name),
    datasets: [
      {
        data: categories.map((category) => category.total),
        backgroundColor: categories.map(
          (_, index) => CHART_COLORS[index % CHART_COLORS.length]
        ),
        borderWidth: 0,
        hoverOffset: 10,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "68%",
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label(context) {
            const category = categories[context.dataIndex];
            return `${category.name}: ${formatCompactCurrency(category.total)} (${formatPercent(
              category.share
            )})`;
          },
        },
      },
    },
  };

  return (
    <div className="category-chart-shell">
      <div className="analytics-chart analytics-chart-doughnut">
        <Doughnut data={chartData} options={options} />
      </div>

      <div className="category-chart-legend">
        {categories.map((category, index) => (
          <div
            key={`${category.categoryId || "uncategorized"}-${category.type}`}
            className="category-chart-legend-item"
          >
            <span
              className="category-chart-legend-swatch"
              style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
            />
            <div>
              <strong>{category.name}</strong>
              <span>
                {formatCompactCurrency(category.total)} | {formatPercent(category.share)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
