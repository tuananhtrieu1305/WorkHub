import Icon from "./Icon";
import OrganizationCard from "./OrganizationCard";
import SectionShell from "./SectionShell";

const OrganizationListSection = ({
  activeMembers,
  activeOrganizationId,
  editForm,
  expandedOrganizationId,
  handlers,
  isLeavingId,
  isLoadingMembers,
  isRotatingInvite,
  isSwitchingId,
  isUpdating,
  openMenuId,
  organizations,
  pendingMembers,
  reviewingMemberId,
  setEditForm,
  setOpenMenuId,
  uploadingMedia,
}) => (
  <SectionShell>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <h2 className="text-2xl font-black text-slate-950">
        Tổ chức đã tham gia
      </h2>
      <span className="inline-flex w-fit items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 ring-1 ring-blue-100">
        <Icon name="business" className="text-base leading-none" />
        {organizations.length} tổ chức
      </span>
    </div>

    {organizations.length > 0 ? (
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {organizations.map((organization) => (
          <OrganizationCard
            key={organization.id || organization._id}
            activeMembers={activeMembers}
            activeOrganizationId={activeOrganizationId}
            editForm={editForm}
            expandedOrganizationId={expandedOrganizationId}
            handlers={handlers}
            isLeavingId={isLeavingId}
            isLoadingMembers={isLoadingMembers}
            isRotatingInvite={isRotatingInvite}
            isSwitchingId={isSwitchingId}
            isUpdating={isUpdating}
            openMenuId={openMenuId}
            organization={organization}
            pendingMembers={pendingMembers}
            reviewingMemberId={reviewingMemberId}
            setEditForm={setEditForm}
            setOpenMenuId={setOpenMenuId}
            uploadingMedia={uploadingMedia}
          />
        ))}
      </div>
    ) : (
      <div className="mt-5 h-28 rounded-3xl border border-dashed border-slate-300 bg-slate-50" />
    )}
  </SectionShell>
);

export default OrganizationListSection;
