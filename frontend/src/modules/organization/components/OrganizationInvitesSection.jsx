import { useEffect, useMemo, useState } from "react";
import { hasPermission } from "../organizationUtils";
import Icon from "./Icon";
import MemberAvatar from "./MemberAvatar";

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const statusClasses = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  exhausted: "bg-slate-100 text-slate-600 ring-slate-200",
  paused: "bg-amber-50 text-amber-700 ring-amber-100",
  revoked: "bg-red-50 text-red-700 ring-red-100",
};

const inviterAsMember = (invite) => ({
  user: invite.inviter || {
    fullName: "Người mời",
    email: "",
  },
});

const toTime = (value) => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

const formatCountdown = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / SECOND_MS));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [days, hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
};

const getEffectiveStatus = (invite, now) => {
  const maxUses = invite.maxUses ?? null;
  if (maxUses && Number(invite.usesCount || 0) >= maxUses) return "exhausted";

  const pausedUntil = toTime(invite.pausedUntil);
  if (invite.status === "paused" && now !== null && pausedUntil && pausedUntil <= now) {
    return "active";
  }

  return invite.status || "active";
};

const getStatusLabel = (invite, now) => {
  const status = getEffectiveStatus(invite, now);
  if (status === "paused") {
    const pausedUntil = toTime(invite.pausedUntil);
    return pausedUntil && now !== null
      ? `Tạm dừng ${formatCountdown(pausedUntil - now)}`
      : "Đã tạm dừng";
  }
  if (status === "exhausted") return "Đã hết lượt";
  if (status === "revoked") return "Đã thu hồi";
  return "Đang hoạt động";
};

const OrganizationInvitesSection = ({
  invites = [],
  isLoading,
  onCopyInvite,
  onDeleteInvite,
  onOpenCreateInvite,
  onOpenPauseInvites,
  onSetInviteStatus,
  organization,
}) => {
  const [now, setNow] = useState(null);
  const canManageInvites = hasPermission(organization, "manageInvites");
  const canCreateInvites =
    hasPermission(organization, "createInvites") || canManageInvites;

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const initialTimer = window.setTimeout(tick, 0);
    const intervalTimer = window.setInterval(tick, SECOND_MS);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalTimer);
    };
  }, []);

  const visibleInvites = useMemo(
    () =>
      invites.filter((invite) => {
        if (now === null) return true;
        const expiresAt = toTime(invite.expiresAt);
        return !expiresAt || expiresAt > now;
      }),
    [invites, now],
  );

  const handleDeleteInvite = (invite) => {
    if (!invite?.canDelete && !canManageInvites) return;
    if (!window.confirm("Xóa lời mời này khỏi bảng?")) return;
    onDeleteInvite?.(invite);
  };

  return (
    <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
            <Icon name="mark_email_unread" />
            Lời mời
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Mỗi mã mời có thời hạn, số lượt dùng và người tạo riêng.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenPauseInvites}
            disabled={!hasPermission(organization, "pauseInvites")}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-black text-amber-700 transition hover:-translate-y-0.5 hover:bg-amber-100 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="pause_circle" />
            Tạm dừng lời mời
          </button>
          <button
            type="button"
            onClick={onOpenCreateInvite}
            disabled={!canCreateInvites}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-200/60 transition hover:-translate-y-0.5 hover:bg-blue-700 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="add_link" />
            Tạo liên kết mời
          </button>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-3xl ring-1 ring-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[230px]" />
              <col className="w-[230px]" />
              <col className="w-[130px]" />
              <col className="w-[170px]" />
              <col className="w-[190px]" />
              <col className="w-[90px]" />
            </colgroup>
            <thead>
              <tr className="text-xs font-black uppercase">
                <th className="bg-blue-50 px-4 py-3 text-blue-700">Người mời</th>
                <th className="bg-cyan-50 px-4 py-3 text-cyan-700">Mã mời</th>
                <th className="bg-emerald-50 px-4 py-3 text-emerald-700">
                  Số lần dùng
                </th>
                <th className="bg-violet-50 px-4 py-3 text-violet-700">
                  Thời hạn
                </th>
                <th className="bg-amber-50 px-4 py-3 text-amber-700">
                  Trạng thái
                </th>
                <th className="bg-rose-50 px-4 py-3 text-right text-rose-700">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                [0, 1, 2].map((item) => (
                  <tr key={item}>
                    <td colSpan={6} className="h-20 animate-pulse bg-slate-50" />
                  </tr>
                ))
              ) : visibleInvites.length ? (
                visibleInvites.map((invite) => {
                  const expiresAt = toTime(invite.expiresAt);
                  const status = getEffectiveStatus(invite, now);
                  const canDelete = Boolean(invite.canDelete || canManageInvites);
                  const canUpdate = Boolean(invite.canUpdate || canManageInvites);

                  return (
                    <tr
                      key={invite.id}
                      className="align-middle transition hover:bg-slate-50/80"
                    >
                      <td className="px-4 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <MemberAvatar member={inviterAsMember(invite)} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-950">
                              {invite.inviter?.fullName || "Người mời"}
                            </p>
                            <p className="truncate text-xs font-semibold text-slate-500">
                              {invite.inviter?.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => onCopyInvite(invite)}
                          className="inline-flex max-w-full items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 text-left text-xs font-black text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
                          title="Sao chép mã mời"
                        >
                          <Icon
                            name="content_copy"
                            className="text-base leading-none"
                          />
                          <span className="truncate font-mono tracking-normal">
                            {invite.code}
                          </span>
                        </button>
                        {invite.note && (
                          <p className="mt-1 truncate text-xs font-semibold text-slate-400">
                            {invite.note}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-mono text-sm font-black tabular-nums text-slate-800">
                          {Number(invite.usesCount || 0)}
                          {invite.maxUses ? `/${invite.maxUses}` : ""}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-mono text-sm font-black tabular-nums text-slate-700">
                          {expiresAt
                            ? now === null
                              ? "--:--:--:--"
                              : formatCountdown(expiresAt - now)
                            : "Vĩnh viễn"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex max-w-full rounded-xl px-3 py-1.5 text-xs font-black ring-1 ${
                            statusClasses[status] || statusClasses.paused
                          }`}
                        >
                          <span className="truncate">
                            {getStatusLabel(invite, now)}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          {canUpdate && status === "paused" && (
                            <button
                              type="button"
                              onClick={() => onSetInviteStatus(invite, "active")}
                              className="inline-flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
                              aria-label="Kích hoạt lại lời mời"
                              title="Kích hoạt lại"
                            >
                              <Icon name="play_arrow" />
                            </button>
                          )}
                          {canUpdate && status === "active" && (
                            <button
                              type="button"
                              onClick={() => onSetInviteStatus(invite, "paused")}
                              className="inline-flex size-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700 transition hover:bg-amber-100"
                              aria-label="Tạm dừng lời mời"
                              title="Tạm dừng 1 giờ"
                            >
                              <Icon name="pause" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDeleteInvite(invite)}
                              className="inline-flex size-9 items-center justify-center rounded-xl bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                              aria-label="Xóa lời mời"
                              title="Xóa lời mời"
                            >
                              <Icon name="delete" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6}>
                    <div className="grid place-items-center gap-2 px-4 py-12 text-center">
                      <Icon
                        name="link_off"
                        className="text-4xl leading-none text-slate-300"
                      />
                      <p className="text-sm font-black text-slate-600">
                        Chưa có lời mời nào trong phạm vi bạn có thể xem.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default OrganizationInvitesSection;
