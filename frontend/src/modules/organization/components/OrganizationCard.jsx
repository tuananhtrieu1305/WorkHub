import { getAvatarUrl } from "../../../utils/avatar";
import {
  getOrganizationId,
  getStat,
  isManager,
} from "../organizationUtils";
import { getOrganizationThemeStyle } from "../organizationTheme";
import Icon from "./Icon";
import OrganizationLogo from "./OrganizationLogo";
import StatTile from "./StatTile";

const getOrganizationRoleLabel = (organization = {}) => {
  const roleNames = (organization.roles || [])
    .map((role) => role.name || role.key)
    .filter(Boolean);
  return roleNames.length ? roleNames.join(", ") : organization.roleLabel || "Thành viên";
};

const OrganizationCard = ({
  activeOrganizationId,
  handlers,
  isLeavingId,
  isSwitchingId,
  openMenuId,
  organization,
  setOpenMenuId,
  uploadingMedia,
}) => {
  const organizationId = getOrganizationId(organization);
  const isActive = organizationId === activeOrganizationId;
  const canManage = isManager(organization);
  const cardBannerUrl = getAvatarUrl(organization.bannerUrl);
  const cardStyle = getOrganizationThemeStyle(organization, cardBannerUrl);
  const isUploadingLogo =
    uploadingMedia?.organizationId === organizationId &&
    uploadingMedia?.type === "logo";
  const isUploadingBanner =
    uploadingMedia?.organizationId === organizationId &&
    uploadingMedia?.type === "banner";

  return (
    <article
      onClick={() => handlers.onOpenDetails(organizationId)}
      className={`organization-card organization-card-themed relative overflow-visible rounded-[1.5rem] p-4 ring-1 transition duration-200 hover:-translate-y-0.5 ${
        openMenuId === organizationId ? "z-30" : "z-0"
      } ${
        isActive
          ? "organization-card-active text-slate-950"
          : "text-slate-950 ring-white/80 hover:ring-slate-200"
      }`}
      style={cardStyle}
    >
      <button
        type="button"
        onClick={(event) => handlers.onToggleFavorite(event, organization)}
        className={`organization-favorite-button absolute right-4 top-4 z-10 inline-flex size-11 items-center justify-center rounded-2xl bg-white/90 ring-1 ring-white/90 backdrop-blur transition hover:bg-white active:scale-95 ${
          organization.isFavorite ? "text-amber-500" : "text-slate-400"
        } ${organization.isFavorite ? "is-favorite" : ""}`}
        aria-label={
          organization.isFavorite
            ? "Bỏ ghim tổ chức yêu thích"
            : "Ghim tổ chức yêu thích"
        }
        aria-pressed={Boolean(organization.isFavorite)}
      >
        <Icon
          name={organization.isFavorite ? "star" : "star_border"}
          className="text-2xl leading-none"
        />
      </button>
      <div
        className="relative overflow-hidden rounded-[1.25rem] bg-white/78 p-4 ring-1 ring-white/80 backdrop-blur"
      >
        <div className="organization-card-banner" aria-hidden="true" />
        <div className="relative flex items-start gap-4 pr-11">
          <OrganizationLogo
            organization={organization}
            className="size-16"
            labelClassName="text-lg"
            active={isActive}
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="truncate text-xl font-black">{organization.name}</h3>
            </div>
            {organization.description && (
              <p className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-slate-600">
                {organization.description}
              </p>
            )}
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-1 gap-3 min-[440px]:grid-cols-3">
          <StatTile
            icon="radio_button_checked"
            value={getStat(organization, "online")}
            label="Online"
            tone="emerald"
          />
          <StatTile
            icon="groups"
            value={getStat(organization, "members")}
            label="Thành viên"
            tone="sky"
          />
          <StatTile
            icon="verified_user"
            value={getOrganizationRoleLabel(organization)}
            label="Vai trò"
            tone="violet"
            valueClassName="text-base leading-tight sm:text-lg"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            handlers.onOpenDetails(organizationId);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-[0.98]"
        >
          <Icon name={canManage ? "tune" : "visibility"} />
          <span className="hidden sm:inline">Xem nhóm</span>
        </button>
        <button
          type="button"
          onClick={(event) => handlers.onSwitch(event, organizationId)}
          disabled={isActive || isSwitchingId === organizationId}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 ${
            isActive
              ? "bg-blue-600 text-white"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          <Icon name={isActive ? "download_done" : "sync_alt"} />
          <span className="hidden sm:inline">
            {isActive ? "Đang dùng" : "Chuyển"}
          </span>
        </button>
        <div className="relative ml-auto">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setOpenMenuId((current) =>
                current === organizationId ? "" : organizationId,
              );
            }}
            className="inline-flex size-11 items-center justify-center rounded-xl bg-white text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-50"
            aria-label="Mở menu tổ chức"
          >
            <Icon name="more_horiz" />
          </button>
          {openMenuId === organizationId && (
            <div
              onClick={(event) => event.stopPropagation()}
              className="organization-card-menu absolute bottom-12 right-0 z-50 w-64 overflow-hidden rounded-2xl bg-white p-2 text-slate-900 shadow-xl ring-1 ring-slate-200"
            >
              <button
                type="button"
                onClick={(event) => {
                  setOpenMenuId("");
                  handlers.onOpenInvite(event, organization);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition hover:bg-slate-100"
              >
                <Icon name="link" />
                Tạo liên kết mời
              </button>
              <button
                type="button"
                onClick={handlers.onOpenNotifications}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition hover:bg-slate-100"
              >
                <Icon name="notifications" />
                Quản lý thông báo
              </button>
              {canManage && (
                <>
                  <button
                    type="button"
                    onClick={(event) => {
                      setOpenMenuId("");
                      handlers.onMediaUpload?.(event, "logo", organization);
                    }}
                    disabled={isUploadingLogo}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Icon name={isUploadingLogo ? "progress_activity" : "upload"} />
                    Đổi ảnh tổ chức
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      setOpenMenuId("");
                      handlers.onMediaUpload?.(event, "banner", organization);
                    }}
                    disabled={isUploadingBanner}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-cyan-700 transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Icon
                      name={isUploadingBanner ? "progress_activity" : "panorama"}
                    />
                    Đổi biểu ngữ
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={(event) => {
                  setOpenMenuId("");
                  handlers.onOpenLeave(event, organization);
                }}
                disabled={organization.isOwner || isLeavingId === organizationId}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-black text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon name="logout" />
                Rời nhóm
              </button>
            </div>
          )}
        </div>
      </div>

    </article>
  );
};

export default OrganizationCard;
