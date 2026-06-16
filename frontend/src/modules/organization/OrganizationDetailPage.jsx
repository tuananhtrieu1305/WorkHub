import OrganizationAdvancedSection from "./components/OrganizationAdvancedSection";
import OrganizationInviteModal from "./components/OrganizationInviteModal";
import OrganizationInvitesSection from "./components/OrganizationInvitesSection";
import OrganizationJoinPreviewModal from "./components/OrganizationJoinPreviewModal";
import OrganizationJoinRequestModal from "./components/OrganizationJoinRequestModal";
import OrganizationMembersSection from "./components/OrganizationMembersSection";
import OrganizationOverviewSection from "./components/OrganizationOverviewSection";
import OrganizationPauseInvitesModal from "./components/OrganizationPauseInvitesModal";
import OrganizationRoleModal from "./components/OrganizationRoleModal";
import OrganizationRolesSection from "./components/OrganizationRolesSection";
import OrganizationTransferOwnerModal from "./components/OrganizationTransferOwnerModal";
import OrganizationWorkspaceHeader from "./components/OrganizationWorkspaceHeader";
import OrganizationWorkspaceTabs from "./components/OrganizationWorkspaceTabs";
import { useOrganizationWorkspace } from "./hooks/useOrganizationWorkspace";
import { SkeletonBlock } from "../../components/common/Skeleton";

const OrganizationDetailPage = () => {
  const { state, actions } = useOrganizationWorkspace();

  if (state.isLoadingOrganization && !state.activeOrganization) {
    return (
      <main className="organization-page min-h-full px-4 py-5 text-slate-950 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-7xl gap-5">
          <SkeletonBlock className="h-80 rounded-[2rem] ring-1 ring-slate-200" />
          <SkeletonBlock className="h-20 rounded-3xl ring-1 ring-slate-200" />
          <SkeletonBlock className="h-96 rounded-3xl ring-1 ring-slate-200" />
        </div>
      </main>
    );
  }

  return (
    <main className="organization-page min-h-full px-4 py-5 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <OrganizationWorkspaceHeader
          isUpdatingBanner={state.loading.banner}
          onUpdateBanner={actions.updateBannerImage}
          organization={state.activeOrganization}
        />

        <OrganizationWorkspaceTabs
          onSelect={actions.setTab}
          selectedTab={state.selectedTab}
          tabs={state.availableTabs}
        />

        <div key={state.selectedTab} className="organization-tab-panel">
          {state.selectedTab === "overview" && (
            <OrganizationOverviewSection
              isLoading={state.loading.overview}
              overview={state.overview}
            />
          )}

          {state.selectedTab === "members" && (
            <OrganizationMembersSection
              filters={state.memberFilters}
              isLoading={state.loading.members}
              members={state.members}
              onChangeFilters={actions.setMemberFilters}
              onChangeRole={actions.changeMemberRole}
              organization={state.activeOrganization}
              roles={state.roles}
            />
          )}

          {state.selectedTab === "roles" && (
            <OrganizationRolesSection
              isLoading={state.loading.roles}
              onDeleteRole={actions.removeRole}
              onOpenRoleModal={actions.openRoleModal}
              onReorderRoles={actions.reorderRoles}
              organization={state.activeOrganization}
              permissionKeys={state.permissionKeys}
              roles={state.roles}
            />
          )}

          {state.selectedTab === "invites" && (
            <OrganizationInvitesSection
              invites={state.invites}
              isLoading={state.loading.invites}
              isLoadingJoinRequests={state.loading.joinRequests}
              joinRequests={state.joinRequests}
              onCopyInvite={actions.copyInvite}
              onDeleteInvite={actions.deleteInvite}
              onOpenCreateInvite={actions.openInviteModal}
              onOpenJoinRequest={actions.setSelectedJoinRequest}
              onOpenPauseInvites={() => actions.setPauseModalOpen(true)}
              onReviewJoinRequest={actions.reviewJoinRequest}
              onSetInviteStatus={actions.setInviteStatus}
              organization={state.activeOrganization}
            />
          )}

          {state.selectedTab === "advanced" && (
            <OrganizationAdvancedSection
              form={state.advancedForm}
              isLeaving={state.leaving}
              isSaving={state.loading.settings}
              members={state.members}
              onChange={actions.setAdvancedForm}
              onLeave={actions.leaveCurrentOrganization}
              onOpenJoinPreview={() => actions.setJoinPreviewOpen(true)}
              onOpenTransferOwner={() => actions.setTransferModalOpen(true)}
              onSubmit={actions.saveSettings}
              organization={state.activeOrganization}
              roles={state.roles}
            />
          )}
        </div>
      </div>

      <OrganizationRoleModal
        form={state.roleForm}
        mode={state.roleModal}
        onMembersChanged={actions.roleMembersChanged}
        onChange={actions.setRoleForm}
        onClose={actions.closeRoleModal}
        onSubmit={actions.saveRole}
        organizationId={state.activeOrganization?.id}
        permissionKeys={state.permissionKeys}
      />

      <OrganizationInviteModal
        form={state.inviteForm}
        invite={state.createdInvite}
        isSubmitting={state.isCreatingInvite}
        onChange={actions.setInviteForm}
        onClose={actions.closeInviteModal}
        onCopyCode={actions.copyInviteCodeFromModal}
        onSubmit={actions.createInvite}
        open={state.inviteModalOpen}
        organization={state.activeOrganization}
      />

      <OrganizationPauseInvitesModal
        durationHours={state.pauseDurationHours}
        onChangeDuration={actions.setPauseDurationHours}
        onChangeScope={actions.setPauseScope}
        onClose={() => actions.setPauseModalOpen(false)}
        onSubmit={actions.pauseInvites}
        open={state.pauseModalOpen}
        scope={state.pauseScope}
      />

      <OrganizationJoinPreviewModal
        accentColor={state.advancedForm?.accentColor}
        joinMessage={state.advancedForm?.joinMessage}
        onClose={() => actions.setJoinPreviewOpen(false)}
        open={state.joinPreviewOpen}
        organization={state.activeOrganization}
        questions={state.advancedForm?.joinQuestions || []}
      />

      <OrganizationTransferOwnerModal
        isSubmitting={state.isTransferringOwner}
        members={state.members}
        onClose={() => actions.setTransferModalOpen(false)}
        onSubmit={actions.transferOwner}
        open={state.transferModalOpen}
        organization={state.activeOrganization}
      />

      <OrganizationJoinRequestModal
        member={state.selectedJoinRequest}
        onClose={() => actions.setSelectedJoinRequest(null)}
        onReview={actions.reviewJoinRequest}
        open={Boolean(state.selectedJoinRequest)}
        questions={state.joinRequestQuestions}
      />
    </main>
  );
};

export default OrganizationDetailPage;
