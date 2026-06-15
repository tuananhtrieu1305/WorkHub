import { useNavigate } from "react-router-dom";
import { getAvatarUrl } from "../../../utils/avatar";
import { roleLabels } from "../organizationUtils";
import { getOrganizationThemeStyle } from "../organizationTheme";
import Icon from "./Icon";
import OrganizationHeroStats from "./OrganizationHeroStats";
import OrganizationLogo from "./OrganizationLogo";

const OrganizationWorkspaceHeader = ({ organization }) => {
  const navigate = useNavigate();
  const bannerUrl = getAvatarUrl(organization?.bannerUrl);
  const headerStyle = getOrganizationThemeStyle(organization, bannerUrl);
  const roleLabel =
    organization?.roleLabel ||
    roleLabels[organization?.role] ||
    organization?.role ||
    "Thành viên";

  return (
    <section
      className="organization-hero-surface organization-hero-themed overflow-hidden rounded-[1.75rem] shadow-sm ring-1 ring-white/80"
      style={headerStyle}
    >
      <div className="organization-hero-banner" aria-hidden="true" />
      <div className="relative grid min-h-[248px] gap-5 p-5 sm:p-6 lg:p-7">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => navigate("/organization")}
              className="inline-flex items-center gap-2 rounded-2xl bg-white/82 px-3 py-2 text-sm font-black text-slate-700 ring-1 ring-white/80 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white active:translate-y-0 active:scale-[0.98]"
            >
              <Icon name="arrow_back" />
              Tất cả tổ chức
            </button>
            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
              <OrganizationLogo
                organization={organization}
                className="size-16 sm:size-[4.5rem]"
                labelClassName="text-xl"
                active
              />
              <div className="min-w-0">
                <p className="inline-flex w-fit items-center gap-2 rounded-full bg-white/82 px-3 py-1.5 text-xs font-black text-blue-700 ring-1 ring-white/80 backdrop-blur">
                  <Icon name="workspaces" className="text-base leading-none" />
                  Không gian làm việc
                </p>
                <h1 className="mt-3 text-2xl font-black leading-tight text-slate-950 sm:text-3xl lg:text-4xl">
                  {organization?.name || "Tổ chức"}
                </h1>
              </div>
            </div>
            {organization?.description && (
              <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-slate-600 sm:text-base">
                {organization.description}
              </p>
            )}
          </div>

          <OrganizationHeroStats organization={organization} roleLabel={roleLabel} />
      </div>
    </section>
  );
};

export default OrganizationWorkspaceHeader;
