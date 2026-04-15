import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { formatCompactCurrency } from "../utils/reporting";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function CashFlowChart({ points = [], grouping = "month" }) {
  if (!points.length) {
    return (
      <div className="analytics-empty-state">
        <strong>No cash flow data</strong>
        <span>Adjust the date range to see income and expense trends.</span>
      </div>
    );
  }

  const chartData = {
    labels: points.map((point) => point.label),
    datasets: [
      {
        label: "Income",
        data: points.map((point) => point.income),
        borderColor: "#167f5d",
        backgroundColor: "rgba(22, 127, 93, 0.16)",
        fill: true,
        tension: 0.35,
        borderWidth: 3,
        pointRadius: 2,
        pointHoverRadius: 5,
      },
      {
        label: "Expense",
        data: points.map((point) => point.expense),
        borderColor: "#d95d39",
        backgroundColor: "rgba(217, 93, 57, 0.14)",
        fill: true,
        tension: 0.35,
        borderWidth: 3,
        pointRadius: 2,
        pointHoverRadius: 5,
      },
      {
        label: "Net",
        data: points.map((point) => point.net),
        borderColor: "#1f3b73",
        backgroundColor: "rgba(31, 59, 115, 0)",
        tension: 0.3,
        borderDash: [6, 6],
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: "index",
    },
    plugins: {
      legend: {
        position: "top",
        labels: {
          usePointStyle: true,
          boxWidth: 10,
          color: "#314265",
          padding: 18,
        },
      },
      tooltip: {
        callbacks: {
          label(context) {
            return `${context.dataset.label}: ${formatCompactCurrency(context.parsed.y)}`;
          },
          title(items) {
            if (!items.length) {
              return "";
            }

            return grouping === "day"
              ? `Day: ${items[0].label}`
              : `Month: ${items[0].label}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: "#6d7b99",
          maxRotation: grouping === "day" ? 0 : 0,
          autoSkip: true,
          maxTicksLimit: grouping === "day" ? 8 : 10,
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: "#6d7b99",
          callback(value) {
            return formatCompactCurrency(value);
          },
        },
        grid: {
          color: "rgba(109, 123, 153, 0.15)",
        },
      },
    },
  };

  return (
    <div className="analytics-chart">
      <Line data={chartData} options={chartOptions} />
    </div>
  );
}
