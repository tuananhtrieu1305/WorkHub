import { useEffect } from "react";
import { getOrganizationId } from "../organizationUtils";
import Icon from "./Icon";
import NotificationSettingsPanel from "./NotificationSettingsPanel";

const modalMeta = {
  invite: {
    icon: "link",
    label: "Liên kết mời",
    title: "Lấy liên kết mời",
    description:
      "Sao chép liên kết để gửi cho thành viên mới. Link chỉ hoạt động khi lời mời của tổ chức đang được bật.",
  },
  leave: {
    icon: "logout",
    label: "Rời nhóm",
    title: "Xác nhận rời tổ chức",
    description:
      "Bạn sẽ mất quyền truy cập vào dữ liệu, kênh trao đổi và công việc của tổ chức này.",
  },
  notifications: {
    icon: "notifications_active",
    label: "Thông báo",
    title: "Cài đặt thông báo",
    description:
      "Tùy chỉnh các loại thông báo bạn muốn nhận trong WorkHub.",
  },
};

const OrganizationDashboardActionModal = ({
  action,
  inviteOrganization,
  isLeavingId,
  isLoadingNotifications,
  notificationSettings,
  onClose,
  onConfirmLeave,
  onCopyInvite,
  onToggleNotificationSetting,
  savingNotificationKey,
}) => {
  useEffect(() => {
    if (!action) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [action, onClose]);

  if (!action) return null;

  const meta = modalMeta[action] || modalMeta.invite;
  const organizationId = getOrganizationId(inviteOrganization);
  const inviteUrl =
    inviteOrganization?.inviteEnabled === false
      ? ""
      : inviteOrganization?.inviteLink || "";
  const isOwner = inviteOrganization?.role === "owner";
  const isLeaving = isLeavingId === organizationId;

  return (
    <div className="organization-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <section className="organization-modal-card relative z-10 max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-slate-900/18 ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 sm:px-7">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 ring-1 ring-blue-100">
              <Icon name={meta.icon} />
              {meta.label}
            </div>
            <h2 className="mt-4 text-2xl font-black text-slate-950 sm:text-3xl">
              {meta.title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
              {meta.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 transition hover:bg-slate-200 active:scale-95"
            aria-label="Đóng"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="max-h-[calc(90vh-9rem)] overflow-y-auto px-6 py-6 sm:px-7">
          {action === "notifications" && (
            <NotificationSettingsPanel
              isLoading={isLoadingNotifications}
              notificationSettings={notificationSettings}
              onToggle={onToggleNotificationSetting}
              savingKey={savingNotificationKey}
            />
          )}

          {action === "invite" && (
            <div className="grid gap-5">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Tổ chức
                </p>
                <p className="mt-1 text-lg font-black text-slate-950">
                  {inviteOrganization?.name || "Tổ chức"}
                </p>
              </div>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Link mời
                </span>
                <input
                  readOnly
                  value={inviteUrl || "Link mời đang tắt hoặc chưa có sẵn"}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none"
                />
              </label>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={(event) => onCopyInvite(event, inviteOrganization)}
                  disabled={!inviteUrl}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Icon name="content_copy" />
                  Sao chép link
                </button>
              </div>
            </div>
          )}

          {action === "leave" && (
            <div className="grid gap-5">
              <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold leading-6 text-red-800 ring-1 ring-red-100">
                {isOwner
                  ? "Chủ sở hữu không thể rời tổ chức. Hãy chuyển quyền sở hữu trước khi rời nhóm."
                  : `Bạn đang chuẩn bị rời khỏi ${
                      inviteOrganization?.name || "tổ chức này"
                    }.`}
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-200"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={onConfirmLeave}
                  disabled={isOwner || isLeaving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-sm shadow-red-600/20 transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Icon name={isLeaving ? "progress_activity" : "logout"} />
                  Rời nhóm
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default OrganizationDashboardActionModal;
