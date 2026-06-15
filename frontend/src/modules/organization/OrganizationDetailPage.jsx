import OrganizationAdvancedSection from "./components/OrganizationAdvancedSection";
import OrganizationInviteModal from "./components/OrganizationInviteModal";
import OrganizationInvitesSection from "./components/OrganizationInvitesSection";
import OrganizationMembersSection from "./components/OrganizationMembersSection";
import OrganizationOverviewSection from "./components/OrganizationOverviewSection";
import OrganizationPauseInvitesModal from "./components/OrganizationPauseInvitesModal";
import OrganizationRoleModal from "./components/OrganizationRoleModal";
import OrganizationRolesSection from "./components/OrganizationRolesSection";
import OrganizationWorkspaceHeader from "./components/OrganizationWorkspaceHeader";
import OrganizationWorkspaceTabs from "./components/OrganizationWorkspaceTabs";
import { useOrganizationWorkspace } from "./hooks/useOrganizationWorkspace";

const OrganizationDetailPage = () => {
  const { state, actions } = useOrganizationWorkspace();

  if (state.isLoadingOrganization && !state.activeOrganization) {
    return (
      <main className="organization-page min-h-full px-4 py-5 text-slate-950 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-7xl gap-5">
          <div className="h-80 animate-pulse rounded-[2rem] bg-white ring-1 ring-slate-200" />
          <div className="h-20 animate-pulse rounded-3xl bg-white ring-1 ring-slate-200" />
          <div className="h-96 animate-pulse rounded-3xl bg-white ring-1 ring-slate-200" />
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
              organization={state.activeOrganization}
              permissionKeys={state.permissionKeys}
              roles={state.roles}
            />
          )}

          {state.selectedTab === "invites" && (
            <OrganizationInvitesSection
              invites={state.invites}
              isLoading={state.loading.invites}
              onCopyInvite={actions.copyInvite}
              onOpenCreateInvite={() => actions.setInviteModalOpen(true)}
              onOpenPauseInvites={() => actions.setPauseModalOpen(true)}
              onSetInviteStatus={actions.setInviteStatus}
              organization={state.activeOrganization}
            />
          )}

          {state.selectedTab === "advanced" && (
            <OrganizationAdvancedSection
              form={state.advancedForm}
              isLeaving={state.leaving}
              isSaving={state.loading.settings}
              onChange={actions.setAdvancedForm}
              onLeave={actions.leaveCurrentOrganization}
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
        onChange={actions.setRoleForm}
        onClose={actions.closeRoleModal}
        onSubmit={actions.saveRole}
        permissionKeys={state.permissionKeys}
      />

      <OrganizationInviteModal
        form={state.inviteForm}
        onChange={actions.setInviteForm}
        onClose={() => actions.setInviteModalOpen(false)}
        onSubmit={actions.createInvite}
        open={state.inviteModalOpen}
      />

      <OrganizationPauseInvitesModal
        onChangeScope={actions.setPauseScope}
        onClose={() => actions.setPauseModalOpen(false)}
        onSubmit={actions.pauseInvites}
        open={state.pauseModalOpen}
        scope={state.pauseScope}
      />
    </main>
  );
};

export default OrganizationDetailPage;
