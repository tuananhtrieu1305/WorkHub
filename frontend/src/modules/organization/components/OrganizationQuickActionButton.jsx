import Icon from "./Icon";

const variantClasses = {
  create:
    "organization-quick-action-create text-blue-950 shadow-blue-300/28 hover:border-blue-400",
  join:
    "organization-quick-action-join text-emerald-950 shadow-emerald-300/28 hover:border-emerald-400",
};

const variantIcons = {
  create: "add_business",
  join: "group_add",
};

const OrganizationQuickActionButton = ({
  description,
  label,
  onClick,
  variant = "create",
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`organization-quick-action group flex min-h-24 items-center justify-between gap-4 overflow-hidden rounded-[1.5rem] border px-5 py-4 text-left shadow-md transition duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.99] ${variantClasses[variant]}`}
  >
    <span className="flex min-w-0 items-center gap-4">
      <span className="organization-quick-action-icon grid size-12 shrink-0 place-items-center rounded-2xl bg-white/82 ring-1 ring-white/95 backdrop-blur">
        <Icon name={variantIcons[variant]} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-base font-black sm:text-lg">
          {label}
        </span>
        {description && (
          <span className="mt-1 block truncate text-sm font-bold opacity-75">
            {description}
          </span>
        )}
      </span>
    </span>
    <Icon
      name="arrow_forward"
      className="shrink-0 text-2xl leading-none opacity-70 transition group-hover:translate-x-1"
    />
  </button>
);

export default OrganizationQuickActionButton;
