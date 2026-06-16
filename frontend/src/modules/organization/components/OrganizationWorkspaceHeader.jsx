import { useNavigate } from "react-router-dom";
import { getAvatarUrl } from "../../../utils/avatar";
import { getOrganizationThemeStyle } from "../organizationTheme";
import Icon from "./Icon";
import OrganizationHeroStats from "./OrganizationHeroStats";
import OrganizationLogo from "./OrganizationLogo";
import OrganizationBannerUploader from "./banner/OrganizationBannerUploader";

const OrganizationWorkspaceHeader = ({
  isUpdatingBanner = false,
  onUpdateBanner,
  organization,
}) => {
  const navigate = useNavigate();
  const bannerUrl = getAvatarUrl(organization?.bannerUrl);
  const headerStyle = getOrganizationThemeStyle(organization, bannerUrl);
  const roleLabel =
    organization?.roleLabel ||
    "Thành viên";

  return (
    <section
      className="organization-hero-surface organization-hero-themed overflow-hidden rounded-[1.75rem] shadow-sm ring-1 ring-white/80"
      style={headerStyle}
    >
      <div className="organization-hero-banner" aria-hidden="true" />
      <OrganizationBannerUploader
        isSaving={isUpdatingBanner}
        onSave={onUpdateBanner}
        organization={organization}
      />
      <div className="organization-hero-content pointer-events-none relative z-10 grid min-h-[248px] content-between gap-7 p-5 sm:p-6 lg:p-7">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => navigate("/organization")}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-2xl bg-white/82 px-3 py-2 text-sm font-black text-slate-700 ring-1 ring-white/80 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 active:translate-y-0 active:scale-[0.98]"
          >
            <Icon name="arrow_back" />
            Tất cả tổ chức
          </button>
          <div className="mt-6 flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-end">
            <OrganizationLogo
              organization={organization}
              className="size-16 sm:size-[4.5rem]"
              labelClassName="text-xl"
              active
            />
            <div className="min-w-0 pb-1">
              <h1 className="text-3xl font-black leading-tight text-slate-950 sm:text-4xl lg:text-5xl">
                {organization?.name || "Tổ chức"}
              </h1>
              {organization?.description && (
                <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-600 sm:text-base">
                  {organization.description}
                </p>
              )}
            </div>
          </div>
        </div>

        <OrganizationHeroStats organization={organization} roleLabel={roleLabel} />
      </div>
    </section>
  );
};

export default OrganizationWorkspaceHeader;
