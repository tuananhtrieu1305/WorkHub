import { formatDate, hasPermission } from "../organizationUtils";
import Icon from "./Icon";
import MemberAvatar from "./MemberAvatar";

const statusClasses = {
  active: "bg-emerald-50 text-emerald-700",
  paused: "bg-amber-50 text-amber-700",
  revoked: "bg-red-50 text-red-700",
};

const statusLabels = {
  active: "Đang hoạt động",
  paused: "Đã tạm dừng",
  revoked: "Đã thu hồi",
};

const inviterAsMember = (invite) => ({
  user: invite.inviter || {
    fullName: "Người mời",
    email: "",
  },
});

const OrganizationInvitesSection = ({
  invites,
  isLoading,
  onCopyInvite,
  onOpenCreateInvite,
  onOpenPauseInvites,
  onSetInviteStatus,
  organization,
}) => {
  const canManageInvites = hasPermission(organization, "manageInvites");
  const canCreateInvites =
    hasPermission(organization, "createInvites") || canManageInvites;

  return (
    <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-950">
            <Icon name="mark_email_unread" />
            Lời mời
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Mỗi người có liên kết và mã mời riêng để theo dõi lượt dùng.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenPauseInvites}
            disabled={!hasPermission(organization, "pauseInvites")}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-black text-amber-700 transition hover:bg-amber-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="pause_circle" />
            Tạm dừng lời mời
          </button>
          <button
            type="button"
            onClick={onOpenCreateInvite}
            disabled={!canCreateInvites}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="add_link" />
            Tạo liên kết mời
          </button>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-3xl ring-1 ring-slate-200">
        <div className="hidden grid-cols-[240px_minmax(220px,1fr)_120px_150px_150px] bg-slate-50 px-4 py-3 text-xs font-black uppercase text-slate-400 lg:grid">
          <span>Người mời</span>
          <span>Mã mời</span>
          <span>Số lần dùng</span>
          <span>Thời hạn</span>
          <span className="text-right">Trạng thái</span>
        </div>

        {isLoading ? (
          <div className="grid gap-0 divide-y divide-slate-100">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-20 animate-pulse bg-white" />
            ))}
          </div>
        ) : invites.length ? (
          <div className="divide-y divide-slate-100">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="grid gap-4 px-4 py-4 lg:grid-cols-[240px_minmax(220px,1fr)_120px_150px_150px] lg:items-center"
              >
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
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onCopyInvite(invite)}
                    className="inline-flex max-w-full items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 text-left text-xs font-black text-slate-700 transition hover:bg-slate-200"
                  >
                    <Icon name="content_copy" className="text-base leading-none" />
                    <span className="truncate">{invite.code}</span>
                  </button>
                </div>
                <span className="text-sm font-black tabular-nums text-slate-700">
                  {invite.usesCount}
                  {invite.maxUses ? `/${invite.maxUses}` : ""}
                </span>
                <span className="text-sm font-bold text-slate-600">
                  {invite.expiresAt ? formatDate(invite.expiresAt) : "Không hết hạn"}
                </span>
                <div className="flex items-center justify-start gap-2 lg:justify-end">
                  <span
                    className={`inline-flex rounded-xl px-3 py-1.5 text-xs font-black ${
                      statusClasses[invite.status] || statusClasses.paused
                    }`}
                  >
                    {statusLabels[invite.status] || invite.status}
                  </span>
                  {invite.status === "active" && (
                    <button
                      type="button"
                      onClick={() => onSetInviteStatus(invite, "paused")}
                      className="inline-flex size-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700 transition hover:bg-amber-100"
                      aria-label="Tạm dừng lời mời"
                    >
                      <Icon name="pause" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid place-items-center gap-2 px-4 py-12 text-center">
            <Icon name="link_off" className="text-4xl leading-none text-slate-300" />
            <p className="text-sm font-black text-slate-600">
              Chưa có lời mời nào trong phạm vi bạn có thể xem.
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default OrganizationInvitesSection;
