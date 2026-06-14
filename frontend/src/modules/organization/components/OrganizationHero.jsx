import { getAvatarUrl } from "../../../utils/avatar";
import {
  getStat,
  roleLabels,
} from "../organizationUtils";
import Icon from "./Icon";
import OrganizationLogo from "./OrganizationLogo";
import StatTile from "./StatTile";

const OrganizationHero = ({
  activeInviteUrl,
  activeOrganization,
  onCopyInvite,
  onOpenCreate,
  onOpenJoin,
  onOpenNotifications,
}) => {
  const heroBannerUrl = getAvatarUrl(activeOrganization?.bannerUrl);

  return (
    <section className="organization-hero-surface overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-blue-100">
      <div className="relative grid min-h-[320px] gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-9">
        <div
          className="absolute inset-y-0 right-0 hidden w-1/2 opacity-80 lg:block"
          style={
            heroBannerUrl
              ? {
                  backgroundImage: `linear-gradient(90deg, rgba(255,255,255,0.92), rgba(255,255,255,0.52)), url("${heroBannerUrl}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        />

        <div className="relative flex min-w-0 flex-col justify-between gap-8">
          {activeOrganization ? (
            <>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 ring-1 ring-blue-100">
                  <Icon name="workspaces" />
                  Đang sử dụng
                </div>
                <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
                  <OrganizationLogo
                    organization={activeOrganization}
                    className="size-20"
                    labelClassName="text-2xl"
                    active
                  />
                  <div className="min-w-0">
                    <h1 className="text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
                      {activeOrganization.name}
                    </h1>
                    <p className="mt-2 inline-flex w-fit items-center gap-2 rounded-xl bg-white px-3 py-1.5 text-xs font-black text-slate-700 ring-1 ring-slate-200">
                      <Icon name="verified_user" className="text-base leading-none" />
                      {roleLabels[activeOrganization.role] ||
                        activeOrganization.role ||
                        "Thành viên"}
                    </p>
                  </div>
                </div>
                {activeOrganization.description && (
                  <p className="mt-5 max-w-3xl text-sm font-semibold leading-6 text-slate-600 sm:text-base">
                    {activeOrganization.description}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={(event) => onCopyInvite(event, activeOrganization)}
                  disabled={!activeInviteUrl}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon name="person_add" />
                  Mời thành viên
                </button>
                <button
                  type="button"
                  onClick={onOpenNotifications}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-[0.98]"
                >
                  <Icon name="notifications_active" />
                  Cài đặt thông báo
                </button>
              </div>
            </>
          ) : (
            <div className="flex h-full max-w-2xl flex-col justify-center">
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 ring-1 ring-blue-100">
                <Icon name="domain_add" />
                WorkHub Organization
              </div>
              <h1 className="mt-6 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
                Tạo không gian làm việc cho nhóm của bạn
              </h1>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onOpenCreate}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 active:scale-[0.98]"
                >
                  <Icon name="add_business" />
                  Tạo tổ chức
                </button>
                <button
                  type="button"
                  onClick={onOpenJoin}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-[0.98]"
                >
                  <Icon name="group_add" />
                  Tham gia
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="relative grid content-end gap-3">
          <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
            <StatTile
              icon="radio_button_checked"
              value={getStat(activeOrganization, "online")}
              label="Online"
              active
            />
            <StatTile
              icon="groups"
              value={getStat(activeOrganization, "members")}
              label="Thành viên"
              active
            />
            <StatTile
              icon="hourglass_top"
              value={getStat(activeOrganization, "pending")}
              label="Chờ duyệt"
              active
            />
          </div>
        </aside>
      </div>
    </section>
  );
};

export default OrganizationHero;
