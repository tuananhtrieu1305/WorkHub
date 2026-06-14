import { getAvatarUrl } from "../../../utils/avatar";
import {
  getOrganizationId,
  getStat,
  isManager,
} from "../organizationUtils";
import Icon from "./Icon";
import OrganizationLogo from "./OrganizationLogo";
import StatTile from "./StatTile";

const OrganizationCard = ({
  activeOrganizationId,
  handlers,
  isLeavingId,
  isSwitchingId,
  openMenuId,
  organization,
  setOpenMenuId,
}) => {
  const organizationId = getOrganizationId(organization);
  const isActive = organizationId === activeOrganizationId;
  const canManage = isManager(organization);
  const cardBannerUrl = getAvatarUrl(organization.bannerUrl);

  return (
    <article
      onClick={() => handlers.onOpenDetails(organizationId)}
      className={`organization-card relative overflow-visible rounded-[1.75rem] p-4 ring-1 transition ${
        isActive
          ? "bg-blue-50 text-slate-950 ring-blue-200"
          : "bg-white text-slate-950 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      <div
        className={`relative overflow-hidden rounded-3xl p-4 ${
          isActive ? "bg-white" : "bg-slate-50"
        }`}
      >
        <div
          className="absolute inset-0 opacity-70"
          style={
            cardBannerUrl
              ? {
                  backgroundImage: `linear-gradient(90deg, rgba(255,255,255,0.96), rgba(255,255,255,0.58)), url("${cardBannerUrl}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        />
        <div className="relative flex items-start gap-4">
          <OrganizationLogo
            organization={organization}
            className="size-16"
            labelClassName="text-lg"
            active={isActive}
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="truncate text-xl font-black">{organization.name}</h3>
              {organization.isFavorite && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-1 text-xs font-black text-amber-700">
                  <Icon name="star" className="text-sm leading-none" />
                  Yêu thích
                </span>
              )}
              {isActive && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2 py-1 text-xs font-black text-white">
                  <Icon name="check" className="text-sm leading-none" />
                  Đang dùng
                </span>
              )}
            </div>
            {organization.description && (
              <p className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-slate-600">
                {organization.description}
              </p>
            )}
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-3 gap-3">
          <StatTile
            icon="radio_button_checked"
            value={getStat(organization, "online")}
            label="Online"
            active={isActive}
          />
          <StatTile
            icon="groups"
            value={getStat(organization, "members")}
            label="Thành viên"
            active={isActive}
          />
          <StatTile
            icon="hourglass_top"
            value={getStat(organization, "pending")}
            label="Chờ duyệt"
            active={isActive}
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
          <Icon name={canManage ? "tune" : "groups"} />
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
          <Icon name={isActive ? "done_all" : "sync_alt"} />
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
              className="absolute right-0 top-12 z-20 w-64 overflow-hidden rounded-2xl bg-white p-2 text-slate-900 shadow-xl ring-1 ring-slate-200"
            >
              <button
                type="button"
                onClick={(event) => {
                  setOpenMenuId("");
                  handlers.onCopyInvite(event, organization);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition hover:bg-slate-100"
              >
                <Icon name="link" />
                Lấy liên kết mời
              </button>
              <button
                type="button"
                onClick={handlers.onOpenNotifications}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition hover:bg-slate-100"
              >
                <Icon name="notifications" />
                Quản lý thông báo
              </button>
              <button
                type="button"
                onClick={(event) => {
                  setOpenMenuId("");
                  handlers.onToggleFavorite(event, organization);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-black text-amber-700 transition hover:bg-amber-50"
              >
                <Icon name={organization.isFavorite ? "star" : "star_border"} />
                {organization.isFavorite ? "Bỏ yêu thích" : "Yêu thích"}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  setOpenMenuId("");
                  handlers.onLeave(event, organization);
                }}
                disabled={organization.role === "owner" || isLeavingId === organizationId}
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
