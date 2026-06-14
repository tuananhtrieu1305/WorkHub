import { useNavigate } from "react-router-dom";
import { getAvatarUrl } from "../../../utils/avatar";
import { getStat, roleLabels } from "../organizationUtils";
import Icon from "./Icon";
import OrganizationLogo from "./OrganizationLogo";
import StatTile from "./StatTile";

const OrganizationWorkspaceHeader = ({ organization }) => {
  const navigate = useNavigate();
  const bannerUrl = getAvatarUrl(organization?.bannerUrl);

  return (
    <section className="organization-hero-surface overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-blue-100">
      <div className="relative min-h-[300px] p-6 sm:p-8 lg:p-9">
        <div
          className="absolute inset-y-0 right-0 hidden w-1/2 opacity-80 lg:block"
          style={
            bannerUrl
              ? {
                  backgroundImage: `linear-gradient(90deg, rgba(255,255,255,0.94), rgba(255,255,255,0.55)), url("${bannerUrl}")`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => navigate("/organization")}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-200 active:scale-[0.98]"
            >
              <Icon name="arrow_back" />
              Tất cả tổ chức
            </button>
            <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center">
              <OrganizationLogo
                organization={organization}
                className="size-20"
                labelClassName="text-2xl"
                active
              />
              <div className="min-w-0">
                <p className="inline-flex w-fit items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 ring-1 ring-blue-100">
                  <Icon name="workspaces" className="text-base leading-none" />
                  Không gian làm việc
                </p>
                <h1 className="mt-3 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
                  {organization?.name || "Tổ chức"}
                </h1>
                <p className="mt-2 inline-flex w-fit items-center gap-2 rounded-xl bg-white px-3 py-1.5 text-xs font-black text-slate-700 ring-1 ring-slate-200">
                  <Icon name="verified_user" className="text-base leading-none" />
                  {organization?.roleLabel ||
                    roleLabels[organization?.role] ||
                    organization?.role ||
                    "Thành viên"}
                </p>
              </div>
            </div>
            {organization?.description && (
              <p className="mt-5 max-w-3xl text-sm font-semibold leading-6 text-slate-600 sm:text-base">
                {organization.description}
              </p>
            )}
          </div>

          <aside className="relative grid content-end gap-3">
            <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
              <StatTile
                icon="radio_button_checked"
                value={getStat(organization, "online")}
                label="Online"
                active
              />
              <StatTile
                icon="groups"
                value={getStat(organization, "members")}
                label="Thành viên"
                active
              />
              <StatTile
                icon="hourglass_top"
                value={getStat(organization, "pending")}
                label="Chờ duyệt"
                active
              />
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
};

export default OrganizationWorkspaceHeader;
