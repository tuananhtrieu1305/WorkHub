import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { updateMyActivityStatus } from "../../api/userApi";
import {
  ACTIVITY_STATUS_OPTIONS,
  ACTIVITY_STATUS_DURATIONS,
  getDefaultActivityStatusDuration,
  getActivityStatusMeta,
} from "../../modules/chat/activityStatus";
import ActivityStatusIcon from "../../modules/chat/ActivityStatusIcon";
import workHubLogo from "../../assets/WorkHub_logo_blue_background.png";

const API_URL = import.meta.env.VITE_NODE_API_URL || "http://localhost:5000";

const Header = ({ overlay = false }) => {
  const { user, logout, updateCurrentUser } = useAuth();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [hoveredDurationStatus, setHoveredDurationStatus] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
        setHoveredDurationStatus(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user?.activityStatusExpiresAt) return undefined;

    const expiresAt = new Date(user.activityStatusExpiresAt).getTime();
    const delay = expiresAt - Date.now();

    if (!Number.isFinite(delay) || delay <= 0) {
      updateCurrentUser?.({
        activityStatus: "online",
        activityStatusExpiresAt: null,
      });
      return undefined;
    }

    const timer = setTimeout(() => {
      updateCurrentUser?.({
        activityStatus: "online",
        activityStatusExpiresAt: null,
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [updateCurrentUser, user?.activityStatusExpiresAt]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleActivityStatusChange = async (
    activityStatus,
    expiresInMinutes = null
  ) => {
    if (isUpdatingStatus) return;

    setIsUpdatingStatus(true);
    try {
      const updatedUser = await updateMyActivityStatus(activityStatus, {
        expiresInMinutes,
      });
      updateCurrentUser?.(updatedUser);
      setShowDropdown(false);
      setHoveredDurationStatus(null);
    } catch (error) {
      console.error("Failed to update activity status:", error);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const userInitial = user?.fullName?.charAt(0)?.toUpperCase() || "U";
  const currentStatusMeta = getActivityStatusMeta(user?.activityStatus);

  const avatarUrl = user?.avatar
    ? user.avatar.startsWith("http")
      ? user.avatar
      : `${API_URL}${user.avatar}`
    : null;

  const toggleDropdown = () => {
    setShowDropdown((prev) => {
      if (prev) setHoveredDurationStatus(null);
      return !prev;
    });
  };

  return (
    <header
      className={`flex shrink-0 items-center justify-between whitespace-nowrap px-4 py-2.5 sm:px-6 top-0 z-50 ${
        overlay
          ? "absolute left-0 right-0 border-b border-transparent bg-transparent"
          : "sticky border-b border-solid border-slate-200/50 bg-white/80 backdrop-blur-md"
      }`}
    >
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3">
          <img
            src={workHubLogo}
            alt="WorkHub"
            className="w-9 h-9 rounded-lg object-cover shadow-sm"
          />
        </div>
      </div>

      <div className="flex flex-1 justify-end gap-4">
        <div className="flex gap-3">
          <button
            className="flex items-center justify-center rounded-full size-10 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-blue-600 transition-all duration-300 cursor-pointer"
            title="Thông báo"
          >
            <span className="material-symbols-outlined text-xl">notifications</span>
          </button>
          <button
            className="flex items-center justify-center rounded-full size-10 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-purple-600 transition-all duration-300 cursor-pointer"
            title="Trợ giúp"
          >
            <span className="material-symbols-outlined text-xl">help</span>
          </button>
        </div>

        <div className="relative" ref={dropdownRef}>
          <button
            className="flex items-center gap-2 cursor-pointer"
            onClick={toggleDropdown}
          >
            <span className="relative inline-flex">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={user?.fullName}
                  className="size-10 rounded-full ring-2 ring-white shadow-md object-cover"
                />
              ) : (
                <span className="size-10 rounded-full ring-2 ring-white shadow-md bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                  {userInitial}
                </span>
              )}
              <span
                className={`absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border-2 border-white ${currentStatusMeta.badgeClassName}`}
              >
                <ActivityStatusIcon meta={currentStatusMeta} size="xs" />
              </span>
            </span>
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-white/10 bg-[#383941] text-white shadow-[0_18px_50px_rgba(15,23,42,0.35)]">
              <div className="p-4 border-b border-white/10">
                <p className="text-sm font-bold text-white truncate">
                  {user?.fullName}
                </p>
                <p className="text-xs text-slate-300 mt-0.5 truncate">
                  {user?.email}
                </p>
              </div>
              <div className="border-b border-white/10 px-3 py-3">
                <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Trạng thái hoạt động
                </p>
                <div className="space-y-1">
                  {ACTIVITY_STATUS_OPTIONS.map((option) => {
                    const isOnlineOption = option.value === "online";
                    const isActive = option.value === currentStatusMeta.value;
                    const showDurationFlyout =
                      !isOnlineOption && hoveredDurationStatus === option.value;

                    return (
                      <div
                        key={option.value}
                        className="relative"
                        onMouseEnter={() => {
                          if (!isOnlineOption) setHoveredDurationStatus(option.value);
                        }}
                        onMouseLeave={() => {
                          if (!isOnlineOption) setHoveredDurationStatus(null);
                        }}
                      >
                        <button
                          type="button"
                          disabled={isUpdatingStatus}
                          onClick={() =>
                            handleActivityStatusChange(
                              option.value,
                              getDefaultActivityStatusDuration(),
                            )
                          }
                          className={`grid w-full grid-cols-[1.25rem_1fr_1.25rem] items-center gap-4 rounded-lg px-3 py-3 text-left transition-colors cursor-pointer ${
                            isActive ? "bg-white/10" : "hover:bg-white/5"
                          } disabled:cursor-not-allowed disabled:opacity-70`}
                        >
                          <span className="flex h-5 w-5 items-center justify-center">
                            <ActivityStatusIcon
                              meta={option}
                              size="md"
                            />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold leading-5 text-white">
                              {option.menuLabel}
                            </span>
                            {option.description && (
                              <span className="mt-1 block whitespace-normal text-xs leading-snug text-slate-300">
                                {option.description}
                              </span>
                            )}
                          </span>
                          {isOnlineOption ? (
                            isActive && (
                              <span className="material-symbols-outlined text-lg text-blue-300">
                                check
                              </span>
                            )
                          ) : (
                            <span className="material-symbols-outlined text-xl text-slate-300">
                              chevron_right
                            </span>
                          )}
                        </button>

                        {showDurationFlyout && (
                          <div className="absolute right-full top-0 z-[60] pr-2" style={{ minWidth: '13rem' }}>
                            <div className="flex flex-col rounded-xl border border-white/10 bg-[#383941] py-1 shadow-[0_18px_50px_rgba(15,23,42,0.35)]">
                              {ACTIVITY_STATUS_DURATIONS.map((duration) => (
                                <button
                                  key={duration.label}
                                  type="button"
                                  disabled={isUpdatingStatus}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleActivityStatusChange(
                                      option.value,
                                      duration.expiresInMinutes,
                                    );
                                  }}
                                  className="block w-full whitespace-nowrap px-5 py-2.5 text-left text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer"
                                >
                                  {duration.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="py-1">
                <button
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-slate-100 hover:bg-white/10 transition-colors font-medium cursor-pointer"
                  onClick={() => {
                    navigate("/profile/me");
                    setShowDropdown(false);
                  }}
                >
                  <span className="material-symbols-outlined text-lg text-slate-300">person</span>
                  Trang cá nhân
                </button>
                <button
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-slate-100 hover:bg-white/10 transition-colors font-medium cursor-pointer"
                  onClick={() => {
                    navigate("/settings");
                    setShowDropdown(false);
                  }}
                >
                  <span className="material-symbols-outlined text-lg text-slate-300">settings</span>
                  Cài đặt
                </button>
              </div>
              <div className="border-t border-white/10 py-1">
                <button
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-300 hover:bg-red-500/10 transition-colors font-medium cursor-pointer"
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
