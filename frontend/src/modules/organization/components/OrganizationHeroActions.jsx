import Icon from "./Icon";

const baseButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black shadow-sm transition duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55";

const OrganizationHeroActions = ({
  activeInviteUrl,
  activeOrganization,
  onCopyInvite,
  onOpenCreate,
  onOpenJoin,
  onOpenNotifications,
}) => {
  if (!activeOrganization) {
    return (
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onOpenCreate}
          className={`${baseButtonClass} bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/20`}
        >
          <Icon name="add_business" />
          Tạo tổ chức mới
        </button>
        <button
          type="button"
          onClick={onOpenJoin}
          className={`${baseButtonClass} bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/20`}
        >
          <Icon name="group_add" />
          Tham gia tổ chức
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-start gap-3 lg:justify-end">
      <button
        type="button"
        onClick={(event) => onCopyInvite(event, activeOrganization)}
        disabled={!activeInviteUrl}
        className={`${baseButtonClass} organization-hero-primary-action text-white`}
      >
        <Icon name="person_add" />
        Mời thành viên
      </button>
      <button
        type="button"
        onClick={onOpenNotifications}
        className={`${baseButtonClass} bg-white/90 text-slate-800 ring-1 ring-white/80 hover:bg-white hover:shadow-lg hover:shadow-slate-300/30`}
      >
        <Icon name="notifications_active" />
        Cài đặt thông báo
      </button>
    </div>
  );
};

export default OrganizationHeroActions;
