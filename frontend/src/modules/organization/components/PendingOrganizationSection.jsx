import { formatDate, getOrganizationId, getStat } from "../organizationUtils";
import Icon from "./Icon";
import OrganizationLogo from "./OrganizationLogo";
import SectionShell from "./SectionShell";

const PendingOrganizationSection = ({
  isLeavingId,
  onCancelPending,
  pendingOrganizations,
}) => {
  if (!pendingOrganizations.length) return null;

  return (
    <SectionShell>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-2xl font-black text-slate-950">
          Tổ chức đang chờ phê duyệt
        </h2>
        <span className="inline-flex w-fit items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-700 ring-1 ring-amber-100">
          <Icon name="hourglass_top" className="text-base leading-none" />
          {pendingOrganizations.length} đang chờ
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {pendingOrganizations.map((organization) => {
          const organizationId = getOrganizationId(organization);
          const submittedAt = formatDate(
            organization.updatedAt || organization.joinedAt,
          );

          return (
            <article
              key={organizationId}
              className="rounded-3xl bg-amber-50 p-4 ring-1 ring-amber-100"
            >
              <div className="flex gap-4">
                <OrganizationLogo
                  organization={organization}
                  className="size-16"
                  labelClassName="text-lg"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-black text-slate-950">
                    {organization.name}
                  </h3>
                  {organization.description && (
                    <p className="mt-1 line-clamp-2 text-sm font-medium leading-6 text-slate-600">
                      {organization.description}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {submittedAt && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-black text-amber-700 ring-1 ring-amber-100">
                        <Icon name="schedule" className="text-base leading-none" />
                        {submittedAt}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">
                      <Icon name="groups" className="text-base leading-none" />
                      {getStat(organization, "members")} thành viên
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onCancelPending(organization)}
                disabled={isLeavingId === organizationId}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-red-700 ring-1 ring-red-100 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Icon
                  name={
                    isLeavingId === organizationId ? "progress_activity" : "close"
                  }
                />
                Hủy yêu cầu
              </button>
            </article>
          );
        })}
      </div>
    </SectionShell>
  );
};

export default PendingOrganizationSection;
