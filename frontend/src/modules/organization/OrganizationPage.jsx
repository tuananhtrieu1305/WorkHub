import OrganizationActionModal from "./components/OrganizationActionModal";
import OrganizationActionSection from "./components/OrganizationActionSection";
import OrganizationDashboardActionModal from "./components/OrganizationDashboardActionModal";
import OrganizationHero from "./components/OrganizationHero";
import OrganizationInviteModal from "./components/OrganizationInviteModal";
import OrganizationJoinQuestionsModal from "./components/OrganizationJoinQuestionsModal";
import OrganizationListSection from "./components/OrganizationListSection";
import PendingOrganizationSection from "./components/PendingOrganizationSection";
import { useOrganizationDashboard } from "./hooks/useOrganizationDashboard";

const OrganizationPage = () => {
  const { refs, state, actions } = useOrganizationDashboard();
  const { logoInputRef, bannerInputRef } = refs;

  const cardHandlers = {
    onOpenInvite: actions.handleOpenInviteModal,
    onOpenLeave: actions.handleOpenLeaveModal,
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
          activeOrganization={state.activeOrganization}
          onOpenInvite={actions.handleOpenInviteModal}
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
      <OrganizationDashboardActionModal
        action={state.dashboardAction.type}
        inviteOrganization={state.dashboardAction.organization}
        isLeavingId={state.isLeavingId}
        isLoadingNotifications={state.isLoadingNotifications}
        notificationSettings={state.notificationSettings}
        onClose={actions.closeDashboardAction}
        onConfirmLeave={actions.handleConfirmLeave}
        onToggleNotificationSetting={actions.handleToggleNotificationSetting}
        savingNotificationKey={state.savingNotificationKey}
      />
      <OrganizationInviteModal
        form={state.inviteForm}
        invite={state.createdInvite}
        isSubmitting={state.isCreatingInvite}
        onChange={actions.setInviteForm}
        onClose={actions.closeInviteModal}
        onCopyCode={actions.handleCopyInviteCode}
        onSubmit={actions.handleCreateInvite}
        open={state.inviteModalOpen}
        organization={state.inviteModalOrganization || state.activeOrganization}
      />
      <OrganizationJoinQuestionsModal
        answers={state.joinAnswers}
        isSubmitting={state.isJoining}
        onChangeAnswer={actions.handleChangeJoinAnswer}
        onClose={actions.closeJoinQuestions}
        onSubmit={actions.handleSubmitJoinQuestions}
        open={Boolean(state.joinPreview)}
        preview={state.joinPreview}
      />
    </main>
  );
};

export default OrganizationPage;
