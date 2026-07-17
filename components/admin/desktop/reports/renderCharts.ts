import type { AnalyticsResult, RoomsChartMode } from "./types";

type ChartInstance = { destroy: () => void; data: unknown; update: () => void };

type ChartConstructor = new (
  ctx: CanvasRenderingContext2D,
  config: Record<string, unknown>
) => ChartInstance;

function getChart(): ChartConstructor | null {
  if (typeof window === "undefined") return null;
  const Chart = (window as Window & { Chart?: ChartConstructor }).Chart;
  return Chart || null;
}

const BOSO_COLORS = [
  "#556B2F", "#D2B48C", "#2C2C2C", "#8FBC8F", "#BC8F8F",
  "#A9A9A9", "#7C3AED", "#0EA5E9", "#F59E0B", "#EC4899",
];

let roomsChartInstance: ChartInstance | null = null;
let sourceChartInstance: ChartInstance | null = null;
let revenueLineChartInstance: ChartInstance | null = null;

export function destroyReportCharts(): void {
  roomsChartInstance?.destroy();
  sourceChartInstance?.destroy();
  revenueLineChartInstance?.destroy();
  roomsChartInstance = null;
  sourceChartInstance = null;
  revenueLineChartInstance = null;
}

export function renderReportCharts(
  result: AnalyticsResult,
  roomsChartMode: RoomsChartMode
): void {
  const Chart = getChart();
  if (!Chart) return;

  const chartDefaults = (Chart as unknown as {
    defaults?: { font?: { family?: string }; color?: string };
  }).defaults;
  if (chartDefaults) {
    chartDefaults.font = { ...chartDefaults.font, family: "'Inter', sans-serif" };
    chartDefaults.color = "#6B7280";
  }

  const { counts, money, nights } = result.charts.rooms;
  const sourceCounts = result.charts.sources.sources;
  const revenueTimeline = result.charts.revenue.timeline;

  const roomsCanvas = document.getElementById("roomsChart") as HTMLCanvasElement | null;
  if (roomsCanvas) {
    const ctxRooms = roomsCanvas.getContext("2d");
    if (ctxRooms) {
      roomsChartInstance?.destroy();
      let dataArr: number[];
      let labelTxt: string;
      if (roomsChartMode === "count") {
        dataArr = Object.values(counts);
        labelTxt = "Кількість броней";
      } else if (roomsChartMode === "money") {
        dataArr = Object.values(money);
        labelTxt = "Дохід (грн)";
      } else {
        dataArr = Object.values(nights);
        labelTxt = "Продані ночі";
      }
      roomsChartInstance = new Chart(ctxRooms, {
        type: "bar",
        data: {
          labels: Object.keys(counts),
          datasets: [
            {
              label: labelTxt,
              data: dataArr,
              backgroundColor: BOSO_COLORS[0],
              borderRadius: 6,
              borderSkipped: false,
              maxBarThickness: 28,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 20 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: "#111827",
              padding: 12,
              cornerRadius: 8,
              displayColors: false,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { padding: 10, color: "#9CA3AF" },
              grid: { display: false, drawBorder: false },
            },
            x: {
              ticks: { color: "#9CA3AF" },
              grid: { display: false, drawBorder: false },
            },
          },
        },
      });
    }
  }

  const sourceCanvas = document.getElementById("sourceChart") as HTMLCanvasElement | null;
  if (sourceCanvas) {
    const ctxSource = sourceCanvas.getContext("2d");
    if (ctxSource) {
      sourceChartInstance?.destroy();
      const activeSources = Object.keys(sourceCounts).filter((k) => sourceCounts[k] > 0);
      const activeSourceValues = activeSources.map((k) => sourceCounts[k]);
      sourceChartInstance = new Chart(ctxSource, {
        type: "doughnut",
        data: {
          labels: activeSources.length > 0 ? activeSources : ["Немає даних"],
          datasets: [
            {
              data: activeSources.length > 0 ? activeSourceValues : [1],
              backgroundColor: activeSources.length > 0 ? BOSO_COLORS : ["#F3F4F6"],
              borderWidth: 0,
              hoverOffset: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: 15 },
          cutout: "75%",
          plugins: {
            legend: {
              position: "bottom",
              labels: { padding: 20, usePointStyle: true, pointStyle: "circle" },
            },
          },
        },
      });
    }
  }

  const lineCanvas = document.getElementById("revenueLineChart") as HTMLCanvasElement | null;
  if (lineCanvas) {
    const ctxLine = lineCanvas.getContext("2d");
    if (ctxLine) {
      revenueLineChartInstance?.destroy();
      const sortedRawKeys = Object.keys(revenueTimeline).sort();
      const sortedLabels = sortedRawKeys.map((k) => {
        const parts = k.split("-");
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString("uk-UA", { day: "numeric", month: "long" });
      });
      const revenueValues = sortedRawKeys.map((k) => revenueTimeline[k]);
      revenueLineChartInstance = new Chart(ctxLine, {
        type: "line",
        data: {
          labels: sortedLabels,
          datasets: [
            {
              label: "Дохід (грн)",
              data: revenueValues,
              borderColor: "#556B2F",
              backgroundColor: "rgba(85, 107, 47, 0.1)",
              borderWidth: 3,
              fill: true,
              tension: 0.4,
              pointBackgroundColor: "#FFFFFF",
              pointBorderColor: "#556B2F",
              pointBorderWidth: 2,
              pointRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: "#F3F4F6" }, border: { dash: [4, 4] } },
            x: { grid: { display: false } },
          },
        },
      });
    }
  }
}

export function updateRoomsChartMode(mode: RoomsChartMode, result: AnalyticsResult): void {
  if (!roomsChartInstance) return;
  const { counts, money, nights } = result.charts.rooms;
  let dataArr: number[];
  let labelTxt: string;
  if (mode === "count") {
    dataArr = Object.values(counts);
    labelTxt = "Кількість броней";
  } else if (mode === "money") {
    dataArr = Object.values(money);
    labelTxt = "Дохід (грн)";
  } else {
    dataArr = Object.values(nights);
    labelTxt = "Продані ночі";
  }
  const chart = roomsChartInstance as ChartInstance & {
    data: { datasets: Array<{ data: number[]; label: string }> };
  };
  chart.data.datasets[0].data = dataArr;
  chart.data.datasets[0].label = labelTxt;
  roomsChartInstance.update();
}
