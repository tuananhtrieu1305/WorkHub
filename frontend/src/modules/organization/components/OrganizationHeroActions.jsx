import Icon from "./Icon";

const baseButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black shadow-sm transition duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55";

const OrganizationHeroActions = ({
  activeOrganization,
  onOpenInvite,
  onOpenNotifications,
}) => {
  return (
    <div className="flex flex-wrap justify-start gap-3 lg:justify-end">
      <button
        type="button"
        onClick={(event) => onOpenInvite(event, activeOrganization)}
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
