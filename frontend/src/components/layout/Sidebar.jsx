import { NavLink, useLocation } from "react-router-dom";
import { navItems } from "./navItems";

const Sidebar = () => {
  const location = useLocation();

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="hidden w-20 flex-shrink-0 flex-col overflow-y-auto border-r border-slate-200/50 bg-slate-50/50 lg:flex">
      <div className="p-3 flex flex-col gap-6 items-center">
        {/* <div className="flex flex-col items-center">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={user?.fullName}
              className="size-10 rounded-full ring-2 ring-blue-500 shadow-lg shadow-blue-500/20 object-cover"
            />
          ) : (
            <div className="size-10 rounded-full ring-2 ring-blue-500 shadow-lg shadow-blue-500/20 bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
              {userInitial}
            </div>
          )}
        </div> */}

        <nav className="flex flex-col gap-3 w-full mt-2">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={`sidebar-nav-link group flex w-14 min-h-[3.75rem] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-center transition-all duration-300 hover:scale-105 ${
                  active
                    ? "sidebar-nav-link--active"
                    : "glass-panel shadow-sm hover:shadow-md"
                }`}
                style={{
                  "--sidebar-color": item.color,
                  "--sidebar-hover-bg": item.hoverBg,
                  "--sidebar-active-bg": item.activeBg,
                  "--sidebar-active-border": item.activeBorder,
                  "--sidebar-active-shadow": item.activeShadow,
                }}
                title={item.label}
              >
                <span
                  className={`material-symbols-outlined text-2xl transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110 ${
                    active && item.iconFill ? "icon-fill" : ""
                  }`}
                >
                  {item.icon}
                </span>
                <span className="w-full text-center text-[10px] font-bold leading-[1.05] tracking-wide">
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </nav>

        <div className="w-full pt-4 mt-2 border-t border-slate-200/50 flex flex-col items-center gap-3">
          <div className="glass-panel w-full flex flex-col items-center p-2 rounded-2xl shadow-sm">
            <span className="material-symbols-outlined text-blue-500 text-xl mb-1">track_changes</span>
            <span className="text-[10px] font-extrabold text-slate-700 text-center leading-tight uppercase tracking-wide">
              Focus
            </span>
            <div className="w-full h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: "65%" }} />
            </div>
          </div>
          <div className="glass-panel w-full flex flex-col items-center p-2 rounded-2xl shadow-sm">
            <span className="material-symbols-outlined text-orange-500 text-xl mb-1">timer</span>
            <span className="text-[11px] font-extrabold text-orange-600 text-center leading-tight">
              25:00
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
