import { getOrganizationId } from "../organizationUtils";
import Icon from "./Icon";
import OrganizationLogo from "./OrganizationLogo";
import OrganizationMembersPanel from "./OrganizationMembersPanel";

const OrganizationDetails = ({
  activeMembers,
  canManage,
  editForm,
  isLeavingId,
  isLoadingMembers,
  isRotatingInvite,
  isUpdating,
  isUploadingBanner,
  isUploadingLogo,
  onCopyInvite,
  onLeave,
  onMediaUpload,
  onReviewRequest,
  onRotateInvite,
  onToggleInvite,
  onUpdate,
  organization,
  pendingMembers,
  reviewingMemberId,
  setEditForm,
}) => {
  const organizationId = getOrganizationId(organization);

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      className="organization-detail-panel mt-5 rounded-3xl bg-slate-50 p-4 ring-1 ring-slate-200"
    >
      <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="text-lg font-black text-slate-950">Cài đặt tổ chức</h4>
            <span
              className={`inline-flex w-fit items-center gap-2 rounded-xl px-3 py-2 text-xs font-black ${
                canManage
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                  : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
              }`}
            >
              <Icon
                name={canManage ? "lock_open" : "lock"}
                className="text-base leading-none"
              />
              {canManage ? "Có quyền sửa" : "Chỉ xem"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[220px_1fr]">
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <OrganizationLogo
                organization={organization}
                className="size-24"
                labelClassName="text-2xl"
              />
              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={(event) => onMediaUpload(event, "logo", organization)}
                  disabled={!canManage || isUploadingLogo}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-black text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon
                    name={isUploadingLogo ? "progress_activity" : "upload"}
                    className="text-base leading-none"
                  />
                  Đổi ảnh
                </button>
                <button
                  type="button"
                  onClick={(event) => onMediaUpload(event, "banner", organization)}
                  disabled={!canManage || isUploadingBanner}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-xs font-black text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon
                    name={isUploadingBanner ? "progress_activity" : "panorama"}
                    className="text-base leading-none"
                  />
                  Đổi biểu ngữ
                </button>
              </div>
            </div>

            <form className="grid gap-4" onSubmit={onUpdate}>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Tên tổ chức
                </span>
                <input
                  value={editForm.name}
                  disabled={!canManage}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                  Mô tả
                </span>
                <textarea
                  value={editForm.description}
                  disabled={!canManage}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows={4}
                  className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </label>
              <button
                type="submit"
                disabled={!canManage || !editForm.name.trim() || isUpdating}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Icon name={isUpdating ? "progress_activity" : "save"} />
                Lưu thay đổi
              </button>
            </form>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <h4 className="flex items-center gap-2 text-lg font-black text-slate-950">
              <Icon name="link" />
              Link mời
            </h4>
            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-bold leading-5 text-slate-600 ring-1 ring-slate-200">
              <span className="line-clamp-2 break-all">
                {organization.inviteEnabled === false
                  ? "Link mời đang tắt"
                  : organization.inviteLink || ""}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={(event) => onCopyInvite(event, organization)}
                disabled={!organization.inviteLink || organization.inviteEnabled === false}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-black text-slate-800 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="content_copy" className="text-base leading-none" />
                Copy
              </button>
              <button
                type="button"
                onClick={onToggleInvite}
                disabled={!canManage || isUpdating}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-black text-slate-800 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon
                  name={editForm.inviteEnabled ? "link_off" : "add_link"}
                  className="text-base leading-none"
                />
                {editForm.inviteEnabled ? "Tắt" : "Bật"}
              </button>
              <button
                type="button"
                onClick={onRotateInvite}
                disabled={!canManage || !editForm.inviteEnabled || isRotatingInvite}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-black text-slate-800 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="sync" className="text-base leading-none" />
                Đổi
              </button>
            </div>
          </div>

          <div className="rounded-2xl bg-red-50 p-4 ring-1 ring-red-100">
            <h4 className="flex items-center gap-2 text-lg font-black text-red-800">
              <Icon name="logout" />
              Rời tổ chức
            </h4>
            <button
              type="button"
              onClick={(event) => onLeave(event, organization)}
              disabled={organization.isOwner || isLeavingId === organizationId}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon
                name={
                  isLeavingId === organizationId ? "progress_activity" : "exit_to_app"
                }
              />
              Rời tổ chức này
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <OrganizationMembersPanel
          activeMembers={activeMembers}
          canManage={canManage}
          isLoadingMembers={isLoadingMembers}
          onReviewRequest={onReviewRequest}
          pendingMembers={pendingMembers}
          reviewingMemberId={reviewingMemberId}
        />
      </div>
    </div>
  );
};

export default OrganizationDetails;
