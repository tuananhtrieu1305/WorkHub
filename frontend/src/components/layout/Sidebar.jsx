import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  getAvatarReferrerPolicy,
  getAvatarUrl,
} from "../../utils/avatar";
import { navItems } from "./navItems";

const Sidebar = () => {
  const location = useLocation();
  const { user } = useAuth();
  const avatarUrl = getAvatarUrl(user?.avatar);
  const userInitial =
    (user?.fullName || user?.email || "U").charAt(0).toUpperCase();

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const profileActive = isActive("/profile");

  return (
    <aside className="hidden w-20 flex-shrink-0 flex-col overflow-y-auto border-r border-slate-200/50 bg-slate-50/50 lg:flex">
      <div className="p-3 flex flex-col gap-6 items-center">
        <NavLink
          to="/profile/me"
          className={`sidebar-profile-link group mt-1 flex size-14 items-center justify-center rounded-full transition-all duration-300 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 focus-visible:ring-offset-2 ${
            profileActive ? "sidebar-profile-link--active" : "glass-panel shadow-sm"
          }`}
          title="Trang hồ sơ cá nhân"
          aria-label="Trang hồ sơ cá nhân"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={user?.fullName || "Avatar"}
              referrerPolicy={getAvatarReferrerPolicy(avatarUrl)}
              className="size-12 rounded-full object-cover ring-2 ring-white transition group-hover:scale-[1.03]"
            />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-full bg-teal-700 text-base font-black text-white ring-2 ring-white transition group-hover:scale-[1.03]">
              {userInitial}
            </span>
          )}
        </NavLink>

        <nav className="flex flex-col gap-3 w-full">
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

      </div>
    </aside>
  );
};

export default Sidebar;
