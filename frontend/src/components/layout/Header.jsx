import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import workHubLogo from "../../assets/WorkHub_logo_blue_background.png";

const API_URL = import.meta.env.VITE_NODE_API_URL || "http://localhost:5000";

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const userInitial = user?.fullName?.charAt(0)?.toUpperCase() || "U";

  const avatarUrl = user?.avatar
    ? user.avatar.startsWith("http")
      ? user.avatar
      : `${API_URL}${user.avatar}`
    : null;

  return (
    <header className="relative flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200/50 bg-white/80 backdrop-blur-md px-10 py-3 sticky top-0 z-50">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3">
          <img
            src={workHubLogo}
            alt="WorkHub"
            className="w-9 h-9 rounded-lg object-cover shadow-sm"
          />
          <h2 className="text-2xl font-extrabold leading-tight tracking-tight text-blue-600 hidden sm:block">
            WorkHub
          </h2>
        </div>
      </div>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md hidden md:block">
        <label className="flex flex-col w-full h-11 shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-full transition-shadow duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
          <div className="flex w-full flex-1 items-stretch rounded-full h-full bg-white border border-slate-100">
            <div className="text-slate-400 flex items-center justify-center pl-5 rounded-l-full">
              <span className="material-symbols-outlined text-xl">search</span>
            </div>
            <input
              className="flex w-full min-w-0 flex-1 resize-none overflow-hidden text-slate-900 focus:outline-0 focus:ring-0 border-none bg-transparent h-full placeholder:text-slate-400 px-4 pl-3 rounded-r-full text-base font-medium leading-normal"
              placeholder="Tìm kiếm..."
            />
          </div>
        </label>
      </div>

      <div className="flex flex-1 justify-end gap-6">
        <div className="flex gap-3">
          <button
            className="flex items-center justify-center rounded-full size-10 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-blue-600 transition-all duration-300"
            title="Thông báo"
          >
            <span className="material-symbols-outlined text-xl">notifications</span>
          </button>
          <button
            className="flex items-center justify-center rounded-full size-10 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-purple-600 transition-all duration-300"
            title="Trợ giúp"
          >
            <span className="material-symbols-outlined text-xl">help</span>
          </button>
        </div>

        <div className="relative" ref={dropdownRef}>
          <button
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={user?.fullName}
                className="size-10 rounded-full ring-2 ring-white shadow-md object-cover"
              />
            ) : (
              <div className="size-10 rounded-full ring-2 ring-white shadow-md bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                {userInitial}
              </div>
            )}
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.12)] border border-slate-100 overflow-hidden z-50">
              <div className="p-4 border-b border-slate-100">
                <p className="text-sm font-bold text-slate-900 truncate">
                  {user?.fullName}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {user?.email}
                </p>
              </div>
              <div className="py-1">
                <button
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors font-medium"
                  onClick={() => {
                    navigate("/profile/me");
                    setShowDropdown(false);
                  }}
                >
                  <span className="material-symbols-outlined text-lg text-slate-400">person</span>
                  Trang cá nhân
                </button>
                <button
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors font-medium"
                  onClick={() => {
                    navigate("/settings");
                    setShowDropdown(false);
                  }}
                >
                  <span className="material-symbols-outlined text-lg text-slate-400">settings</span>
                  Cài đặt
                </button>
              </div>
              <div className="border-t border-slate-100 py-1">
                <button
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors font-medium"
                  onClick={handleLogout}
                >
                  <span className="material-symbols-outlined text-lg">logout</span>
                  Đăng xuất
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
