import { getAvatarUrl } from "../../../utils/avatar";
import { getOrganizationThemeStyle } from "../organizationTheme";
import Icon from "./Icon";
import OrganizationHeroActions from "./OrganizationHeroActions";
import OrganizationHeroStats from "./OrganizationHeroStats";
import OrganizationLogo from "./OrganizationLogo";

const OrganizationHero = ({
  activeOrganization,
  onOpenInvite,
  onOpenNotifications,
}) => {
  const heroBannerUrl = getAvatarUrl(activeOrganization?.bannerUrl);
  const heroStyle = getOrganizationThemeStyle(activeOrganization, heroBannerUrl);
  const roleLabel =
    activeOrganization?.roleLabel ||
    "Thành viên";

  return (
    <section
      className="organization-hero-surface organization-hero-themed overflow-hidden rounded-[1.75rem] shadow-sm ring-1 ring-white/80"
      style={heroStyle}
    >
      <div className="organization-hero-banner" aria-hidden="true" />
      <div className="relative grid min-h-[238px] gap-5 p-5 sm:p-6 lg:p-7">
          {activeOrganization ? (
            <>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-black text-slate-700 ring-1 ring-white/80 backdrop-blur">
                    <Icon name="sweep" />
                    Đang sử dụng
                  </div>
                  <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
                    <OrganizationLogo
                      organization={activeOrganization}
                      className="size-16 sm:size-[4.5rem]"
                      labelClassName="text-xl"
                      active
                    />
                    <div className="min-w-0">
                      <h1 className="text-2xl font-black leading-tight text-slate-950 sm:text-3xl lg:text-4xl">
                        {activeOrganization.name}
                      </h1>
                    </div>
                  </div>
                  {activeOrganization.description && (
                    <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-slate-600 sm:text-base">
                      {activeOrganization.description}
                    </p>
                  )}
                </div>
                <OrganizationHeroActions
                  activeOrganization={activeOrganization}
                  onOpenInvite={onOpenInvite}
                  onOpenNotifications={onOpenNotifications}
                />
              </div>

              <OrganizationHeroStats
                organization={activeOrganization}
                roleLabel={roleLabel}
              />
            </>
          ) : (
            <div className="flex h-full max-w-6xl flex-col justify-center">
              <div className="max-w-6xl">
                <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/85 px-3 py-1.5 text-xs font-black text-blue-700 ring-1 ring-white/80 backdrop-blur">
                  <Icon name="domain_add" />
                  WorkHub Organization
                </div>
                <h1 className="mt-5 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
                  Bạn chưa tham gia tổ chức nào
                </h1>
                <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-slate-600 sm:text-base">
                  Tổ chức giúp gom thành viên, dự án, bài viết và thông báo vào
                  cùng một không gian làm việc.
                </p>
                <div className="mt-5 flex w-full max-w-6xl items-center gap-3 rounded-[1.25rem] bg-white/76 px-4 py-4 text-sm font-bold leading-5 text-slate-700 ring-1 ring-white/85 backdrop-blur">
                  <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                    <Icon name="info" />
                  </span>
                  <span className="xl:whitespace-nowrap">
                    Hướng dẫn: chọn một thẻ hành động bên dưới để tạo tổ chức
                    mới, hoặc tham gia bằng link mời/mã invite nếu bạn đã được
                    mời.
                  </span>
                </div>
              </div>
            </div>
          )}
      </div>
    </section>
  );
};

export default OrganizationHero;
