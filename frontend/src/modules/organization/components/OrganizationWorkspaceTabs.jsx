import Icon from "./Icon";

const OrganizationWorkspaceTabs = ({ selectedTab, tabs, onSelect }) => (
  <nav className="rounded-3xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
    <div className="flex gap-2 overflow-x-auto">
      {tabs.map((tab) => {
        const active = selectedTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            className={`inline-flex min-w-fit items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition active:scale-[0.98] ${
              active
                ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
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

export default OrganizationWorkspaceTabs;
