import OrganizationActionModal from "./components/OrganizationActionModal";
import OrganizationActionSection from "./components/OrganizationActionSection";
import OrganizationHero from "./components/OrganizationHero";
import OrganizationListSection from "./components/OrganizationListSection";
import NotificationSettingsPanel from "./components/NotificationSettingsPanel";
import PendingOrganizationSection from "./components/PendingOrganizationSection";
import { useOrganizationDashboard } from "./hooks/useOrganizationDashboard";

const OrganizationPage = () => {
  const { refs, state, actions } = useOrganizationDashboard();
  const { logoInputRef, bannerInputRef } = refs;

  const cardHandlers = {
    onCopyInvite: actions.handleCopyInvite,
    onLeave: actions.handleLeaveOrganization,
    onMediaUpload: actions.openMediaUpload,
    onOpenDetails: actions.handleOpenDetails,
    onOpenNotifications: actions.handleOpenNotificationPanel,
    onReviewRequest: actions.handleReviewRequest,
    onRotateInvite: actions.handleRotateInvite,
    onSwitch: actions.handleSwitch,
    onToggleFavorite: actions.handleToggleFavorite,
    onToggleInvite: actions.handleToggleInvite,
    onUpdate: actions.handleUpdateSelectedOrganization,
  };

  return (
    <main className="organization-page min-h-full px-4 py-5 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <OrganizationHero
          activeInviteUrl={state.activeInviteUrl}
          activeOrganization={state.activeOrganization}
          onCopyInvite={actions.handleCopyInvite}
          onOpenCreate={() => actions.setActionModal("create")}
          onOpenJoin={() => actions.setActionModal("join")}
          onOpenNotifications={actions.handleOpenNotificationPanel}
        />

        <input
          ref={logoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={(event) => actions.handleMediaFileChange(event, "logo")}
        />
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={(event) => actions.handleMediaFileChange(event, "banner")}
        />

        {state.notificationPanelOpen && (
          <NotificationSettingsPanel
            isLoading={state.isLoadingNotifications}
            notificationSettings={state.notificationSettings}
            onClose={() => actions.setNotificationPanelOpen(false)}
            onToggle={actions.handleToggleNotificationSetting}
            savingKey={state.savingNotificationKey}
          />
        )}

        <OrganizationActionSection
          onOpenCreate={() => actions.setActionModal("create")}
          onOpenJoin={() => actions.setActionModal("join")}
        />

        <OrganizationListSection
          activeMembers={state.activeMembers}
          activeOrganizationId={state.activeOrganizationId}
          editForm={state.editForm}
          expandedOrganizationId={state.expandedOrganizationId}
          handlers={cardHandlers}
          isLeavingId={state.isLeavingId}
          isLoadingMembers={state.isLoadingMembers}
          isRotatingInvite={state.isRotatingInvite}
          isSwitchingId={state.isSwitchingId}
          isUpdating={state.isUpdating}
          openMenuId={state.openMenuId}
          organizations={state.sortedOrganizations}
          pendingMembers={state.pendingMembers}
          reviewingMemberId={state.reviewingMemberId}
          setEditForm={actions.setEditForm}
          setOpenMenuId={actions.setOpenMenuId}
          uploadingMedia={state.uploadingMedia}
        />

        <PendingOrganizationSection
          isLeavingId={state.isLeavingId}
          onCancelPending={actions.handleCancelPending}
          pendingOrganizations={state.pendingOrganizations}
        />
      </div>

      <OrganizationActionModal
        action={state.actionModal}
        createForm={state.createForm}
        inviteLink={state.inviteLink}
        isCreating={state.isCreating}
        isJoining={state.isJoining}
        onClose={actions.closeActionModal}
        onCreate={actions.handleCreate}
        onJoin={actions.handleJoin}
        setCreateForm={actions.setCreateForm}
        setInviteLink={actions.setInviteLink}
      />
    </main>
  );
};

export default OrganizationPage;
