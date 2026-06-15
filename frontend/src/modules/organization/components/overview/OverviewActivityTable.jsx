import Icon from "../Icon";
import { formatDateTime } from "./overviewDashboardUtils";

const toneClasses = {
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  cyan: "bg-cyan-50 text-cyan-700 ring-cyan-100",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  rose: "bg-rose-50 text-rose-700 ring-rose-100",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
};

const OverviewActivityTable = ({ rows = [] }) => (
  <article className="organization-overview-panel overflow-hidden rounded-[1.5rem] bg-white ring-1 ring-slate-200 xl:col-span-7">
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
          <Icon name="history" />
          Hoạt động tổ chức gần đây
        </h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          Các thay đổi đáng chú ý từ thành viên quản trị
        </p>
      </div>
      <span className="hidden rounded-2xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 ring-1 ring-blue-100 sm:inline-flex">
        Xem tất cả
      </span>
    </div>

    <div className="overflow-x-auto">
      <table className="min-w-full text-left">
        <thead className="bg-slate-50 text-sm font-black text-slate-500">
          <tr>
            <th className="px-5 py-3">Hoạt động</th>
            <th className="px-5 py-3">Người thực hiện</th>
            <th className="px-5 py-3">Thời gian</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length ? (
            rows.map((activity) => (
              <tr key={activity.id} className="transition hover:bg-slate-50">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex size-10 shrink-0 items-center justify-center rounded-2xl ring-1 ${
                        toneClasses[activity.tone] || toneClasses.slate
                      }`}
                    >
                      <Icon name={activity.icon || "bolt"} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">
                        {activity.action}
                      </p>
                      <p className="text-xs font-semibold text-slate-400">
                        {activity.entityType || "system"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-sm font-bold text-slate-600">
                  {activity.actor?.fullName || "Hệ thống"}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-sm font-bold tabular-nums text-slate-500">
                  {formatDateTime(activity.createdAt)}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={3} className="px-5 py-8">
                <div className="rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500 ring-1 ring-slate-200">
                  Chưa có hoạt động quản trị nào được ghi nhận.
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </article>
);

export default OverviewActivityTable;
