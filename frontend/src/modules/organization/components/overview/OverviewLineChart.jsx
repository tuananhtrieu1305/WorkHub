import Icon from "../Icon";
import {
  buildLinePoints,
  formatNumber,
  getMaxValue,
  pointsToPath,
} from "./overviewDashboardUtils";

const chartWidth = 760;
const chartHeight = 300;
const padding = { bottom: 38, left: 54, right: 24, top: 24 };

const OverviewLineChart = ({ rows = [] }) => {
  const data = rows.length
    ? rows
    : Array.from({ length: 30 }, (_, index) => ({
        key: `empty-${index}`,
        label: "",
        value: 0,
      }));
  const points = buildLinePoints(data, chartWidth, chartHeight, padding);
  const linePath = pointsToPath(points);
  const areaPath = `${linePath} L ${chartWidth - padding.right} ${
    chartHeight - padding.bottom
  } L ${padding.left} ${chartHeight - padding.bottom} Z`;
  const max = getMaxValue(data, ["value"]);
  const gridLines = [0, 25, 50, 75, 100];
  const labelIndexes = [0, 6, 12, 18, 24, 29].filter(
    (index) => index < points.length,
  );

  return (
    <article className="organization-overview-panel rounded-[1.5rem] bg-white p-5 ring-1 ring-slate-200 xl:col-span-7">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
            <Icon name="monitoring" />
            Xu hướng hoạt động
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Tần suất hoạt động quản trị trong 30 ngày gần nhất
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-2xl bg-teal-50 px-3 py-2 text-xs font-black text-teal-700 ring-1 ring-teal-100">
          <Icon name="calendar_month" className="text-base leading-none" />
          30 ngày qua
        </span>
      </div>

      <div className="overflow-hidden rounded-[1.25rem] bg-slate-50 p-3 ring-1 ring-slate-200">
        <svg
          className="organization-line-chart h-auto w-full"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="img"
          aria-label="Biểu đồ đường xu hướng hoạt động"
        >
          <defs>
            <linearGradient id="organizationActivityArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.32" />
              <stop offset="68%" stopColor="#38bdf8" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="organizationActivityLine" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#0f766e" />
              <stop offset="52%" stopColor="#0891b2" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
          </defs>

          {gridLines.map((percent) => {
            const y =
              padding.top +
              (1 - percent / 100) *
                (chartHeight - padding.top - padding.bottom);
            return (
              <g key={percent}>
                <line
                  x1={padding.left}
                  x2={chartWidth - padding.right}
                  y1={y}
                  y2={y}
                  stroke="#dbe3ee"
                  strokeDasharray="6 8"
                />
                <text
                  x={padding.left - 12}
                  y={y + 5}
                  textAnchor="end"
                  className="fill-slate-500 text-[12px] font-bold"
                >
                  {Math.round((percent / 100) * max)}
                </text>
              </g>
            );
          })}

          <path
            className="organization-line-chart-area"
            d={areaPath}
            fill="url(#organizationActivityArea)"
          />
          <path
            className="organization-line-chart-path"
            d={linePath}
            pathLength={1}
          />

          {points.map((point, index) => (
            <circle
              key={point.key}
              className="organization-line-chart-point"
              cx={point.x}
              cy={point.y}
              r={index === points.length - 1 ? 4.5 : 3}
              style={{ "--point-index": index }}
            >
              <title>
                {point.label}: {formatNumber(point.value)} hoạt động
              </title>
            </circle>
          ))}

          {labelIndexes.map((index) => {
            const point = points[index];
            return (
              <text
                key={point.key}
                x={point.x}
                y={chartHeight - 10}
                textAnchor="middle"
                className="fill-slate-500 text-[12px] font-bold"
              >
                {point.label}
              </text>
            );
          })}
        </svg>
      </div>
    </article>
  );
};

export default OverviewLineChart;
