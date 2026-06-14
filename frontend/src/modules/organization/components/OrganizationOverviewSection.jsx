import { formatDate } from "../organizationUtils";
import Icon from "./Icon";
import OrganizationMetricCard from "./OrganizationMetricCard";

const taskLabels = {
  todo: "Chưa làm",
  in_progress: "Đang làm",
  blocked: "Bị chặn",
  review: "Review",
  done: "Hoàn thành",
  cancelled: "Đã hủy",
};

const maxValue = (items) =>
  Math.max(1, ...items.map((item) => Number(item.count || item.value || 0)));

const StatusBars = ({ data = {} }) => {
  const rows = Object.entries(data).map(([key, value]) => ({
    key,
    label: taskLabels[key] || key,
    value,
  }));
  const max = maxValue(rows);

  return (
    <div className="grid gap-3">
      {rows.length ? (
        rows.map((row) => (
          <div key={row.key}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs font-black text-slate-500">
              <span>{row.label}</span>
              <span className="tabular-nums">{row.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <span
                className="block h-full rounded-full bg-blue-600"
                style={{ width: `${Math.max(8, (row.value / max) * 100)}%` }}
              />
            </div>
          </div>
        ))
      ) : (
        <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">
          Chưa có công việc nào trong tổ chức.
        </p>
      )}
    </div>
  );
};

const GrowthChart = ({ rows = [] }) => {
  const max = maxValue(rows);

  return (
    <div className="flex h-52 items-end gap-3 rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200">
      {rows.map((row) => (
        <div key={row.month} className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <span className="text-xs font-black tabular-nums text-slate-500">
            {row.count}
          </span>
          <span
            className="organization-growth-bar w-full rounded-t-2xl bg-blue-600"
            style={{ height: `${Math.max(10, (row.count / max) * 150)}px` }}
          />
          <span className="truncate text-[11px] font-bold text-slate-400">
            {row.month?.slice(5)}
          </span>
        </div>
      ))}
    </div>
  );
};

const OrganizationOverviewSection = ({ isLoading, overview }) => {
  const metrics = overview?.metrics || {};

  if (isLoading && !overview) {
    return (
      <div className="grid gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-40 animate-pulse rounded-3xl bg-white ring-1 ring-slate-200" />
        ))}
      </div>
    );
  }

  return (
    <section className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <OrganizationMetricCard
          icon="groups"
          label="Thành viên"
          value={metrics.members}
          tone="blue"
        />
        <OrganizationMetricCard
          icon="assignment"
          label="Công việc mở"
          value={metrics.openTasks}
          tone="amber"
          detail={`${metrics.tasks || 0} tổng`}
        />
        <OrganizationMetricCard
          icon="folder_shared"
          label="Tài liệu"
          value={metrics.documents}
          tone="emerald"
        />
        <OrganizationMetricCard
          icon="forum"
          label="Cuộc trò chuyện"
          value={metrics.conversations}
          tone="slate"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <article className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-950">
              <Icon name="stacked_bar_chart" />
              Trạng thái công việc
            </h2>
            <span className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
              live
            </span>
          </div>
          <StatusBars data={overview?.taskStatus} />
        </article>

        <article className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="mb-5 flex items-center gap-2 text-lg font-black text-slate-950">
            <Icon name="trending_up" />
            Tăng trưởng thành viên
          </h2>
          <GrowthChart rows={overview?.memberGrowth || []} />
        </article>
      </div>

      <article className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-950">
          <Icon name="history" />
          Hoạt động gần đây
        </h2>
        <div className="divide-y divide-slate-100">
          {(overview?.recentActivities || []).length ? (
            overview.recentActivities.map((activity) => (
              <div key={activity.id} className="flex items-center gap-3 py-3">
                <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <Icon name="bolt" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-slate-900">
                    {activity.action}
                  </p>
                  <p className="text-xs font-bold text-slate-500">
                    {activity.actor?.fullName || "Hệ thống"} ·{" "}
                    {formatDate(activity.createdAt)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">
              Chưa có hoạt động quản trị nào được ghi nhận.
            </p>
          )}
        </div>
      </article>
    </section>
  );
};

export default OrganizationOverviewSection;
