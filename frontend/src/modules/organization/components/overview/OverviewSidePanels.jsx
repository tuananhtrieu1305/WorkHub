import Icon from "../Icon";
import { formatDueDate, formatNumber } from "./overviewDashboardUtils";

const taskStatusLabels = {
  blocked: "Bị chặn",
  cancelled: "Đã hủy",
  done: "Hoàn thành",
  in_progress: "Đang làm",
  review: "Review",
  todo: "Chưa làm",
};

const statusItems = [
  ["todo", "Chưa làm", "bg-slate-500"],
  ["in_progress", "Đang làm", "bg-blue-500"],
  ["review", "Review", "bg-indigo-500"],
  ["blocked", "Bị chặn", "bg-rose-500"],
  ["done", "Hoàn thành", "bg-emerald-500"],
];

const OverviewSidePanels = ({ overview }) => {
  const health = overview?.health || {};
  const taskStatus = overview?.taskStatus || {};
  const statusMax = Math.max(1, ...statusItems.map(([key]) => taskStatus[key] || 0));
  const roles = overview?.roleBreakdown || [];
  const roleMax = Math.max(1, ...roles.map((role) => role.count || 0));
  const focusQueue = overview?.focusQueue || [];

  return (
    <div className="grid gap-5 xl:col-span-5">
      <article className="organization-overview-panel rounded-[1.5rem] bg-white p-5 ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-950">
            <Icon name="speed" />
            Nhịp vận hành
          </h2>
          <span className="rounded-2xl bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
            {health.activityRate || 0}%
          </span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <p className="text-2xl font-black tabular-nums text-slate-950">
              {formatNumber(health.openTasks)}
            </p>
            <p className="mt-1 text-xs font-bold text-slate-500">việc đang mở</p>
          </div>
          <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-100">
            <p className="text-2xl font-black tabular-nums text-amber-700">
              {formatNumber(health.dueSoonTasks)}
            </p>
            <p className="mt-1 text-xs font-bold text-amber-700/70">sắp đến hạn</p>
          </div>
          <div className="rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-100">
            <p className="text-2xl font-black tabular-nums text-rose-700">
              {formatNumber(health.overdueTasks)}
            </p>
            <p className="mt-1 text-xs font-bold text-rose-700/70">quá hạn</p>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
            <p className="text-2xl font-black tabular-nums text-emerald-700">
              {formatNumber(health.completionRate)}%
            </p>
            <p className="mt-1 text-xs font-bold text-emerald-700/70">hoàn thành</p>
          </div>
        </div>
      </article>

      <article className="organization-overview-panel rounded-[1.5rem] bg-white p-5 ring-1 ring-slate-200">
        <h2 className="flex items-center gap-2 text-lg font-black text-slate-950">
          <Icon name="stacked_bar_chart" />
          Trạng thái công việc
        </h2>
        <div className="mt-5 grid gap-3">
          {statusItems.map(([key, label, colorClass]) => {
            const value = Number(taskStatus[key] || 0);
            return (
              <div key={key}>
                <div className="mb-1 flex items-center justify-between text-xs font-black text-slate-500">
                  <span>{label}</span>
                  <span className="tabular-nums">{formatNumber(value)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className={`organization-status-meter block h-full rounded-full ${colorClass}`}
                    style={{
                      "--meter-width": `${Math.max(6, (value / statusMax) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </article>

      <article className="organization-overview-panel rounded-[1.5rem] bg-white p-5 ring-1 ring-slate-200">
        <h2 className="flex items-center gap-2 text-lg font-black text-slate-950">
          <Icon name="group" />
          Phân bổ vai trò
        </h2>
        <div className="mt-5 grid gap-3">
          {roles.length ? (
            roles.map((role) => (
              <div key={role.key} className="grid gap-1.5">
                <div className="flex items-center justify-between gap-3 text-xs font-black text-slate-500">
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: role.color }}
                    />
                    <span className="truncate">{role.label}</span>
                  </span>
                  <span className="tabular-nums">{formatNumber(role.count)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className="organization-status-meter block h-full rounded-full"
                    style={{
                      "--meter-width": `${Math.max(6, (role.count / roleMax) * 100)}%`,
                      backgroundColor: role.color,
                    }}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">
              Chưa có dữ liệu vai trò.
            </p>
          )}
        </div>
      </article>

      <article className="organization-overview-panel rounded-[1.5rem] bg-white p-5 ring-1 ring-slate-200">
        <h2 className="flex items-center gap-2 text-lg font-black text-slate-950">
          <Icon name="flag" />
          Cần chú ý
        </h2>
        <div className="mt-4 grid gap-3">
          {focusQueue.length ? (
            focusQueue.map((task) => (
              <div
                key={task.id}
                className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="line-clamp-2 text-sm font-black text-slate-900">
                    {task.title}
                  </p>
                  <span className="rounded-xl bg-white px-2 py-1 text-[11px] font-black text-slate-500 ring-1 ring-slate-200">
                    {taskStatusLabels[task.status] || task.status}
                  </span>
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-slate-500">
                  <Icon name="event" className="text-sm leading-none" />
                  Hạn {formatDueDate(task.endAt)}
                </p>
              </div>
            ))
          ) : (
            <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700 ring-1 ring-emerald-100">
              Không có việc sắp đến hạn trong tuần này.
            </p>
          )}
        </div>
      </article>
    </div>
  );
};

export default OverviewSidePanels;
