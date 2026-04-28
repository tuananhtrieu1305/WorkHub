import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const API_URL = import.meta.env.VITE_NODE_API_URL || "http://localhost:5000";

const navItems = [
  {
    label: "Bảng tin",
    path: "/",
    icon: "home",
    activeClass: "bg-blue-600 text-white shadow-lg shadow-blue-500/30",
    textClass: "text-blue-600",
    hoverBg: "#eff6ff",
    iconFill: true,
  },
  {
    label: "Tin nhắn",
    path: "/messages",
    icon: "chat",
    activeClass: "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30",
    textClass: "text-emerald-600",
    hoverBg: "#ecfdf5",
    iconFill: false,
  },
  {
    label: "Cuộc gọi",
    path: "/meetings",
    icon: "call",
    activeClass: "bg-amber-500 text-white shadow-lg shadow-amber-500/30",
    textClass: "text-amber-500",
    hoverBg: "#fffbeb",
    iconFill: false,
  },
  {
    label: "Công việc",
    path: "/tasks",
    icon: "task_alt",
    activeClass: "bg-purple-600 text-white shadow-lg shadow-purple-500/30",
    textClass: "text-purple-600",
    hoverBg: "#faf5ff",
    iconFill: false,
  },
  {
    label: "Lịch",
    path: "/calendar",
    icon: "calendar_today",
    activeClass: "bg-pink-500 text-white shadow-lg shadow-pink-500/30",
    textClass: "text-pink-500",
    hoverBg: "#fdf2f8",
    iconFill: false,
  },
  {
    label: "Tài liệu",
    path: "/docs",
    icon: "description",
    activeClass: "bg-cyan-600 text-white shadow-lg shadow-cyan-500/30",
    textClass: "text-cyan-600",
    hoverBg: "#ecfeff",
    iconFill: false,
  },
  {
    label: "Nhóm",
    path: "/departments",
    icon: "groups",
    activeClass: "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30",
    textClass: "text-indigo-500",
    hoverBg: "#eef2ff",
    iconFill: false,
  },
];

const Sidebar = () => {
  const location = useLocation();
  const { user } = useAuth();

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const userInitial = user?.fullName?.charAt(0)?.toUpperCase() || "U";
  const avatarUrl = user?.avatar
    ? user.avatar.startsWith("http")
      ? user.avatar
      : `${API_URL}${user.avatar}`
    : null;

  return (
    <aside className="w-20 border-r border-slate-200/50 bg-slate-50/50 hidden md:flex flex-col flex-shrink-0 overflow-y-auto">
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
                className={`sidebar-nav-link group flex w-14 min-h-[3.75rem] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-center transition-[background-color,box-shadow,color] duration-300 ${
                  active
                    ? item.activeClass
                    : `glass-panel shadow-sm hover:shadow-md ${item.textClass}`
                }`}
                style={active ? undefined : { "--sidebar-hover-bg": item.hoverBg }}
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
