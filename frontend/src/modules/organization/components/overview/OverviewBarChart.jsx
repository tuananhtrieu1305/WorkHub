import Icon from "../Icon";
import { formatNumber, getMaxValue } from "./overviewDashboardUtils";

const series = [
  { key: "tasks", label: "Tạo việc", className: "bg-blue-500" },
  { key: "completed", label: "Hoàn thành", className: "bg-emerald-500" },
  { key: "documents", label: "Tài liệu", className: "bg-amber-400" },
];

const OverviewBarChart = ({ rows = [] }) => {
  const data = rows.length
    ? rows
    : Array.from({ length: 8 }, (_, index) => ({
        key: `empty-${index}`,
        label: `T${index + 1}`,
        tasks: 0,
        completed: 0,
        documents: 0,
      }));
  const max = getMaxValue(data, series.map((item) => item.key));

  return (
    <article className="organization-overview-panel rounded-[1.5rem] bg-white p-5 ring-1 ring-slate-200 xl:col-span-5">
      <div className="mb-5">
        <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
          <Icon name="bar_chart_4_bars" />
          Nhịp làm việc theo tuần
        </h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          Công việc, hoàn thành và tài liệu mới trong 8 tuần gần đây
        </p>
      </div>

      <div className="flex h-[21.5rem] items-end gap-3 rounded-[1.25rem] bg-slate-50 p-4 ring-1 ring-slate-200">
        {data.map((row, index) => (
          <div key={row.key} className="flex min-w-0 flex-1 flex-col items-center gap-3">
            <div className="flex h-64 w-full items-end justify-center gap-1.5">
              {series.map((item, seriesIndex) => {
                const value = Number(row[item.key] || 0);
                const height = Math.max(8, (value / max) * 230);
                return (
                  <span
                    key={item.key}
                    className={`organization-overview-bar block w-full max-w-4 rounded-t-xl ${item.className}`}
                    style={{
                      "--bar-height": `${height}px`,
                      "--bar-index": index * series.length + seriesIndex,
                    }}
                  >
                    <span className="sr-only">
                      {item.label}: {formatNumber(value)}
                    </span>
                  </span>
                );
              })}
            </div>
            <span className="max-w-20 truncate text-center text-[11px] font-bold text-slate-500">
              {row.label}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {series.map((item) => (
          <span
            key={item.key}
            className="inline-flex items-center gap-2 text-xs font-black text-slate-500"
          >
            <span className={`size-2.5 rounded-full ${item.className}`} />
            {item.label}
          </span>
        ))}
      </div>
    </article>
  );
};

export default OverviewBarChart;
