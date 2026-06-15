import Icon from "./Icon";

const OrganizationWorkspaceTabs = ({ selectedTab, tabs, onSelect }) => {
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === selectedTab),
  );

  return (
    <nav
      className="organization-workspace-tabs rounded-[1.25rem] bg-white p-1.5 shadow-sm ring-1 ring-slate-200/70"
      style={{
        "--organization-tab-count": tabs.length,
        "--organization-tab-index": activeIndex,
      }}
      aria-label="Chức năng tổ chức"
    >
      <div className="organization-workspace-tabs-track relative grid min-w-max gap-1 overflow-hidden rounded-2xl bg-white p-1 sm:min-w-0">
        <span className="organization-workspace-tab-indicator" aria-hidden="true" />
        {tabs.map((tab) => {
          const active = selectedTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelect(tab.id)}
              aria-current={active ? "page" : undefined}
              className={`organization-workspace-tab relative z-10 inline-flex min-w-[9.5rem] items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition focus:outline-none active:scale-[0.98] sm:min-w-0 ${
                active
                  ? "text-blue-700"
                  : "text-slate-500 hover:bg-blue-50/70 hover:text-blue-700"
              }`}
            >
              <Icon name={tab.icon} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default OrganizationWorkspaceTabs;
