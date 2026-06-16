import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { updateMyActivityStatus } from "../../api/userApi";
import {
  deleteNotification,
  getNotifications,
  markAllAsRead,
  markAsRead,
} from "../../api/notificationApi";
import { listMeetings } from "../../services/meetingService";
import {
  ACTIVITY_STATUS_OPTIONS,
  ACTIVITY_STATUS_DURATIONS,
  getDefaultActivityStatusDuration,
  getActivityStatusMeta,
} from "../../modules/chat/activityStatus";
import ActivityStatusIcon from "../../modules/chat/ActivityStatusIcon";
import {
  removeMeetingById,
  upsertActiveMeeting,
} from "../../modules/meeting/meetingListState";
import workHubLogo from "../../assets/WorkHub_logo_blue_background.png";
import {
  getAvatarReferrerPolicy,
  getAvatarUrl,
} from "../../utils/avatar";
import { getProfileTheme } from "../../modules/profile/profileUtils";
import { navItems } from "./navItems";
import {
  buildMeetingPath,
  filterNotificationsByTab,
  formatMeetingDateTime,
  getNotificationId,
  isNotificationUnread,
  markNotificationReadLocally,
  markNotificationsReadLocally,
  removeNotificationById,
} from "./notificationPanelState";
import { NotificationPanelSkeleton } from "../common/Skeleton";

const inboxTabs = [
  { key: "all", label: "Tất cả" },
  { key: "unread", label: "Chưa đọc" },
  { key: "mentions", label: "@Đề cập" },
];

const getNotificationIcon = (notification) => {
  const type = `${notification?.type || ""} ${notification?.entityType || ""}`.toLowerCase();

  if (type.includes("task")) return "task_alt";
  if (type.includes("document")) return "description";
  if (type.includes("admin")) return "admin_panel_settings";
  if (type.includes("mention")) return "alternate_email";
  return "notifications";
};

const formatTime = (dateStr) => {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
};

const toComparableId = (value) => {
  if (value == null) return "";
  return String(value._id || value.id || value);
};

const OrganizationLogoMark = ({
  organization,
  className = "size-8 rounded-full",
  textClassName = "text-xs",
}) => {
  const logoUrl = getAvatarUrl(organization?.logoUrl);
  const initial = organization?.name?.charAt(0)?.toUpperCase() || "O";

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={organization?.name || "Tổ chức"}
        referrerPolicy={getAvatarReferrerPolicy(logoUrl)}
        className={`${className} shrink-0 object-cover ring-1 ring-slate-200`}
      />
    );
  }

  return (
    <span
      className={`${className} ${textClassName} flex shrink-0 items-center justify-center bg-slate-900 font-black text-white ring-1 ring-slate-200`}
    >
      {initial}
    </span>
  );
};

const Header = ({ overlay = false }) => {
  const { user, logout, updateCurrentUser, switchActiveOrganization } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showOrganizationMenu, setShowOrganizationMenu] = useState(false);
  const [hoveredDurationStatus, setHoveredDurationStatus] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [inboxTab, setInboxTab] = useState("all");
  const [notifications, setNotifications] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoadingPanelData, setIsLoadingPanelData] = useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const dropdownRef = useRef(null);
  const notificationRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const organizationRef = useRef(null);
  const organizations = user?.organizations || [];
  const activeOrganization = user?.activeOrganization || null;
  const activeOrganizationId = toComparableId(
    activeOrganization?.id || activeOrganization?._id || user?.activeOrganizationId,
  );

  const isActiveNavItem = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const loadNotificationPanelData = useCallback(async () => {
    setIsLoadingPanelData(true);
    try {
      const [notifRes, meetingRes] = await Promise.allSettled([
        getNotifications({ page: 1, size: 20 }),
        listMeetings({ page: 1, size: 3, status: "active" }),
      ]);

      if (notifRes.status === "fulfilled") {
        const payload = notifRes.value || {};
        const nextNotifications = Array.isArray(payload)
          ? payload
          : payload.content || [];
        setNotifications(nextNotifications);
        setUnreadCount(
          Number(payload.unreadCount) ||
            nextNotifications.filter(isNotificationUnread).length,
        );
      }

      if (meetingRes.status === "fulfilled") {
        const payload = meetingRes.value || {};
        setMeetings(Array.isArray(payload) ? payload : payload.content || []);
      }
    } catch (error) {
      console.error("Failed to load notification panel data:", error);
    } finally {
      setIsLoadingPanelData(false);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
        setHoveredDurationStatus(null);
      }
      if (
        notificationRef.current &&
        !notificationRef.current.contains(e.target)
      ) {
        setShowNotificationPanel(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) {
        setShowMobileMenu(false);
      }
      if (
        organizationRef.current &&
        !organizationRef.current.contains(e.target)
      ) {
        setShowOrganizationMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setShowMobileMenu(false);
    setShowOrganizationMenu(false);
  }, [location.pathname]);

  useEffect(() => {
    setNotifications([]);
    setUnreadCount(0);
    setMeetings([]);
    loadNotificationPanelData();
  }, [activeOrganizationId, loadNotificationPanelData]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleMeetingCreated = ({ meeting }) => {
      if (
        activeOrganizationId &&
        toComparableId(meeting?.organizationId) !== activeOrganizationId
      ) {
        return;
      }
      setMeetings((currentMeetings) =>
        upsertActiveMeeting(currentMeetings, meeting).slice(0, 3),
      );
    };
    const handleMeetingEnded = ({ meeting }) => {
      if (
        activeOrganizationId &&
        toComparableId(meeting?.organizationId) !== activeOrganizationId
      ) {
        return;
      }
      setMeetings((currentMeetings) =>
        removeMeetingById(currentMeetings, meeting?.id || meeting?._id),
      );
    };

    socket.on("meeting_created", handleMeetingCreated);
    socket.on("meeting_ended", handleMeetingEnded);

    return () => {
      socket.off("meeting_created", handleMeetingCreated);
      socket.off("meeting_ended", handleMeetingEnded);
    };
  }, [activeOrganizationId, socket]);

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
  const profileTheme = getProfileTheme(user || {});
  const profileThemeVars = {
    "--header-profile-accent": profileTheme.accentColor,
    "--header-profile-bg": profileTheme.backgroundColor,
    "--header-profile-text": profileTheme.textColor,
  };

  const avatarUrl = getAvatarUrl(user?.avatar);
  const filteredNotifications = filterNotificationsByTab(notifications, inboxTab);
  const loadedUnreadCount = notifications.filter(isNotificationUnread).length;
  const notificationUnreadCount = Math.max(unreadCount, loadedUnreadCount);
  const selectedInboxTabIndex = Math.max(
    inboxTabs.findIndex((tab) => tab.key === inboxTab),
    0,
  );

  const toggleDropdown = () => {
    const next = !showDropdown;
    if (next) {
      setShowNotificationPanel(false);
      setShowMobileMenu(false);
      setShowOrganizationMenu(false);
    } else {
      setHoveredDurationStatus(null);
    }
    setShowDropdown(next);
  };

  const toggleNotificationPanel = () => {
    const next = !showNotificationPanel;
    if (next) {
      setShowDropdown(false);
      setShowMobileMenu(false);
      setShowOrganizationMenu(false);
      setHoveredDurationStatus(null);
      loadNotificationPanelData();
    }
    setShowNotificationPanel(next);
  };

  const toggleMobileMenu = () => {
    const next = !showMobileMenu;
    if (next) {
      setShowDropdown(false);
      setShowNotificationPanel(false);
      setShowOrganizationMenu(false);
      setHoveredDurationStatus(null);
    }
    setShowMobileMenu(next);
  };

  const toggleOrganizationMenu = () => {
    const next = !showOrganizationMenu;
    if (next) {
      setShowDropdown(false);
      setShowNotificationPanel(false);
      setShowMobileMenu(false);
      setHoveredDurationStatus(null);
    }
    setShowOrganizationMenu(next);
  };

  const handleSwitchOrganization = async (organizationId) => {
    if (!organizationId || organizationId === activeOrganizationId) return;

    try {
      await switchActiveOrganization?.(organizationId);
      setShowOrganizationMenu(false);
    } catch (error) {
      console.error("Failed to switch organization:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (isMarkingAllRead) return;

    setIsMarkingAllRead(true);
    try {
      await markAllAsRead();
      setNotifications((currentNotifications) =>
        markNotificationsReadLocally(currentNotifications),
      );
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark notifications as read:", error);
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const handleNotificationClick = async (notification) => {
    const notificationId = getNotificationId(notification);
    if (!notificationId || !isNotificationUnread(notification)) return;

    const readAt = new Date().toISOString();
    setNotifications((currentNotifications) =>
      markNotificationReadLocally(
        currentNotifications,
        notificationId,
        readAt,
      ),
    );
    setUnreadCount((currentCount) => Math.max(currentCount - 1, 0));

    try {
      await markAsRead(notificationId);
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      loadNotificationPanelData();
    }
  };

  const handleDeleteNotification = async (notification) => {
    const notificationId = getNotificationId(notification);
    if (!notificationId) return;

    const wasUnread = isNotificationUnread(notification);
    setNotifications((currentNotifications) =>
      removeNotificationById(currentNotifications, notificationId),
    );
    if (wasUnread) {
      setUnreadCount((currentCount) => Math.max(currentCount - 1, 0));
    }

    try {
      await deleteNotification(notificationId);
    } catch (error) {
      console.error("Failed to delete notification:", error);
      loadNotificationPanelData();
    }
  };

  const handleMeetingClick = (meeting) => {
    navigate(buildMeetingPath(meeting));
    setShowNotificationPanel(false);
  };

  return (
    <header
      className={`top-0 z-50 flex min-h-16 shrink-0 items-center justify-between gap-2 whitespace-nowrap px-3 py-2.5 sm:px-4 lg:px-6 ${
        overlay
          ? "absolute left-0 right-0 border-b border-transparent bg-transparent"
          : "sticky border-b border-solid border-slate-200/50 bg-white/80 backdrop-blur-md"
      }`}
    >
      <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3 lg:min-w-[22rem] lg:flex-1">
        <NavLink
          to="/"
          className="flex shrink-0 items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          aria-label="Về bảng tin"
        >
          <img
            src={workHubLogo}
            alt="WorkHub"
            className="w-9 h-9 rounded-lg object-cover shadow-sm"
          />
        </NavLink>

        <button
          type="button"
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors duration-200 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 lg:hidden"
          title="Tìm kiếm"
          aria-label="Tìm kiếm"
        >
          <span className="material-symbols-outlined text-[21px] leading-none">
            search
          </span>
        </button>

        <label className="hidden h-10 w-[min(18rem,32vw)] min-w-0 items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-3 text-slate-500 shadow-sm transition-colors duration-200 focus-within:border-blue-300 focus-within:bg-white focus-within:text-blue-600 lg:flex">
          <span className="material-symbols-outlined text-[20px] leading-none">
            search
          </span>
          <input
            type="search"
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
            placeholder="Tìm kiếm trong WorkHub"
            aria-label="Tìm kiếm trong WorkHub"
          />
        </label>
      </div>

      <nav className="absolute left-1/2 top-1/2 hidden w-[min(28rem,48vw)] -translate-x-1/2 -translate-y-1/2 items-center justify-between rounded-2xl border border-slate-200/70 bg-slate-50/80 px-2.5 py-1.5 shadow-sm md:flex lg:hidden">
        {navItems.map((item) => {
          const active = isActiveNavItem(item.path);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              aria-label={item.label}
              title={item.label}
              className={`sidebar-nav-link group flex size-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                active
                  ? "sidebar-nav-link--active"
                  : "bg-white/70 hover:shadow-sm"
              }`}
              style={{
                "--sidebar-color": item.color,
                "--sidebar-hover-bg": item.hoverBg,
                "--sidebar-active-bg": item.activeBg,
                "--sidebar-active-border": item.activeBorder,
                "--sidebar-active-shadow": item.activeShadow,
              }}
            >
              <span
                className={`material-symbols-outlined text-[22px] leading-none transition-transform duration-200 group-hover:-translate-y-0.5 ${
                  active && item.iconFill ? "icon-fill" : ""
                }`}
              >
                {item.icon}
              </span>
            </NavLink>
          );
        })}
      </nav>

      <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-3">
        <div className="relative md:hidden" ref={mobileMenuRef}>
          <button
            type="button"
            className={`flex size-10 items-center justify-center rounded-full border transition-colors duration-200 ${
              showMobileMenu
                ? "border-blue-200 bg-blue-50 text-blue-600 shadow-sm"
                : "border-transparent bg-slate-100 text-slate-600 hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
            }`}
            aria-label="Mở menu chính"
            aria-haspopup="menu"
            aria-expanded={showMobileMenu}
            onClick={toggleMobileMenu}
          >
            <span className="material-symbols-outlined text-[23px] leading-none">
              {showMobileMenu ? "close" : "menu"}
            </span>
          </button>

          <nav
            className={`fixed right-4 top-[4.25rem] z-50 w-[min(13.75rem,calc(100vw-6rem))] origin-top-right overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 text-slate-900 shadow-[0_22px_70px_rgba(15,23,42,0.18)] transition-[opacity,transform,visibility] duration-300 ease-out ${
              showMobileMenu
                ? "visible pointer-events-auto translate-y-0 scale-100 opacity-100"
                : "invisible pointer-events-none -translate-y-2 scale-95 opacity-0"
            }`}
            aria-label="Menu chính"
            aria-hidden={!showMobileMenu}
          >
            {navItems.map((item) => {
              const active = isActiveNavItem(item.path);
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === "/"}
                  tabIndex={showMobileMenu ? 0 : -1}
                  className={`sidebar-nav-link group flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 ${
                    active
                      ? "sidebar-nav-link--active"
                      : "hover:bg-slate-50"
                  }`}
                  style={{
                    "--sidebar-color": item.color,
                    "--sidebar-hover-bg": item.hoverBg,
                    "--sidebar-active-bg": item.activeBg,
                    "--sidebar-active-border": item.activeBorder,
                    "--sidebar-active-shadow": item.activeShadow,
                  }}
                >
                  <span
                    className={`material-symbols-outlined text-[22px] leading-none ${
                      active && item.iconFill ? "icon-fill" : ""
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="min-w-0 truncate">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative hidden sm:block" ref={organizationRef}>
            <button
              type="button"
              className={`flex h-10 max-w-[13rem] items-center gap-2 rounded-full border px-2.5 pr-3 text-left transition-colors duration-200 ${
                showOrganizationMenu
                  ? "border-indigo-200 bg-indigo-50 text-indigo-700 shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 shadow-sm hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
              }`}
              aria-haspopup="menu"
              aria-expanded={showOrganizationMenu}
              title={activeOrganization?.name || "Quản lý tổ chức"}
              onClick={toggleOrganizationMenu}
            >
              <OrganizationLogoMark
                organization={activeOrganization}
                className="size-7 rounded-full"
                textClassName="text-[11px]"
              />
              <span className="hidden min-w-0 flex-1 sm:block">
                <span className="block truncate text-xs font-black leading-4">
                  {activeOrganization?.name || "Tổ chức"}
                </span>
                <span className="block truncate text-[10px] font-bold uppercase leading-3 text-slate-400">
                  {activeOrganization?.role || "Chưa tham gia"}
                </span>
              </span>
              <span className="material-symbols-outlined text-lg leading-none">
                expand_more
              </span>
            </button>

            {showOrganizationMenu && (
              <div
                className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-[0_22px_70px_rgba(15,23,42,0.18)]"
                role="menu"
              >
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-black text-slate-950">
                    Không gian tổ chức
                  </p>
                  <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
                    Dữ liệu bảng tin, tin nhắn, tài liệu và công việc sẽ đổi theo
                    tổ chức đang chọn.
                  </p>
                </div>

                <div className="max-h-72 overflow-y-auto p-2">
                  {organizations.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
                      <span className="material-symbols-outlined text-3xl leading-none text-slate-300">
                        domain_add
                      </span>
                      <p className="mt-2 text-sm font-bold text-slate-500">
                        Bạn chưa có tổ chức nào
                      </p>
                    </div>
                  ) : (
                    organizations.map((organization) => {
                      const organizationId = organization.id || organization._id;
                      const isActive = organizationId === activeOrganizationId;

                      return (
                        <button
                          key={organizationId}
                          type="button"
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-200 ${
                            isActive
                              ? "bg-indigo-50 text-indigo-700"
                              : "hover:bg-slate-50"
                          }`}
                          disabled={isActive}
                          onClick={() => handleSwitchOrganization(organizationId)}
                          role="menuitem"
                        >
                          <OrganizationLogoMark
                            organization={organization}
                            className="size-9 rounded-xl"
                            textClassName="text-sm"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-black">
                              {organization.name}
                            </span>
                            <span className="block truncate text-xs font-semibold text-slate-500">
                              {organization.role || "member"}
                            </span>
                          </span>
                          <span className="material-symbols-outlined text-xl leading-none">
                            {isActive ? "check_circle" : "sync_alt"}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="border-t border-slate-100 p-2">
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-slate-800"
                    onClick={() => {
                      navigate("/organization");
                      setShowOrganizationMenu(false);
                    }}
                  >
                    <span className="material-symbols-outlined text-xl leading-none">
                      settings
                    </span>
                    Quản lý tổ chức
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={notificationRef}>
            <button
              type="button"
              className={`header-notification-button relative flex size-10 items-center justify-center rounded-full border cursor-pointer ${
                showNotificationPanel ? "is-open" : ""
              } ${notificationUnreadCount > 0 ? "has-unread" : ""}`}
              style={profileThemeVars}
              title="Thông báo"
              aria-haspopup="dialog"
              aria-expanded={showNotificationPanel}
              onClick={toggleNotificationPanel}
            >
              <span className="material-symbols-outlined text-xl leading-none">
                notifications
              </span>
              {notificationUnreadCount > 0 && (
                <span className="header-notification-badge absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-extrabold leading-none text-white ring-2 ring-white">
                  {notificationUnreadCount > 9 ? "9+" : notificationUnreadCount}
                </span>
              )}
            </button>

            {showNotificationPanel && (
              <div className="workhub-notification-panel fixed right-3 top-[4.25rem] z-50 flex max-h-[calc(100dvh-5rem)] w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-[0_22px_70px_rgba(15,23,42,0.18)] sm:right-6 sm:top-[4.75rem] sm:max-h-[calc(100dvh-5.5rem)] sm:w-[25rem] xl:w-[26rem]">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-extrabold uppercase tracking-wide text-slate-900">
                      Thông báo
                    </h2>
                    <span className="mt-0.5 block text-xs font-medium text-slate-500">
                      {notificationUnreadCount > 0
                        ? `${notificationUnreadCount} mục chưa đọc`
                        : "Bạn đã xem hết thông báo"}
                    </span>
                  </div>
                  <div className="group relative shrink-0">
                    <button
                      type="button"
                      className={`flex size-10 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors duration-200 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 ${
                        isMarkingAllRead ? "opacity-70" : ""
                      }`}
                      onClick={handleMarkAllAsRead}
                      title="Đánh dấu đã đọc tất cả"
                      aria-label="Đánh dấu đã đọc tất cả"
                    >
                      {isMarkingAllRead ? (
                        <span className="h-4 w-4 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
                      ) : (
                        <span className="material-symbols-outlined text-[21px] leading-none">
                          done_all
                        </span>
                      )}
                    </button>
                    <span className="pointer-events-none absolute right-0 top-[calc(100%+0.5rem)] z-[70] whitespace-nowrap rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                      Đánh dấu đã đọc tất cả
                    </span>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                  <section>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-slate-900">
                        <span className="material-symbols-outlined rounded-lg bg-blue-100 p-1 text-xl leading-none text-blue-600">
                          mail
                        </span>
                        Hộp thư đến
                      </h3>
                    </div>

                    <div
                      className="workhub-notification-tabs mb-3 flex rounded-xl bg-slate-100 p-1"
                      style={{ "--tab-index": selectedInboxTabIndex }}
                    >
                      <span
                        className="workhub-notification-tab-indicator"
                        aria-hidden="true"
                      />
                      {inboxTabs.map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setInboxTab(tab.key)}
                          className={`relative z-10 flex-1 rounded-lg px-2.5 py-2 text-xs font-extrabold transition-colors duration-300 ${
                            inboxTab === tab.key
                              ? "text-blue-700"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-2">
                      {isLoadingPanelData && notifications.length === 0 ? (
                        <NotificationPanelSkeleton />
                      ) : filteredNotifications.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-7 text-center">
                          <span className="material-symbols-outlined mb-2 block text-3xl leading-none text-slate-300">
                            mark_email_read
                          </span>
                          <p className="text-xs font-semibold text-slate-500">
                            Không có thông báo phù hợp
                          </p>
                        </div>
                      ) : (
                        filteredNotifications.map((notification, idx) => {
                          const senderAvatar = getAvatarUrl(notification.sender?.avatar);
                          const isUnread = isNotificationUnread(notification);

                          return (
                            <article
                              key={getNotificationId(notification) || idx}
                              className={`group/notification relative flex w-full items-start gap-3 rounded-xl border p-3 pr-20 text-left transition-colors duration-200 ${
                                isUnread
                                  ? "border-blue-100 bg-blue-50/70 hover:bg-blue-50"
                                  : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              <div className="absolute right-2 top-2 flex items-center gap-1">
                                <div className="group/action relative">
                                  <button
                                    type="button"
                                    className="flex size-7 cursor-pointer items-center justify-center rounded-full border border-blue-100 bg-white text-blue-600 transition-colors duration-200 hover:border-blue-200 hover:bg-blue-50"
                                    onClick={() => handleNotificationClick(notification)}
                                    aria-label="Đánh dấu đã đọc"
                                  >
                                    <span className="material-symbols-outlined text-[16px] leading-none">
                                      done
                                    </span>
                                  </button>
                                  <span className="pointer-events-none absolute right-0 top-[calc(100%+0.35rem)] z-[80] whitespace-nowrap rounded-md bg-slate-950 px-2.5 py-1.5 text-[11px] font-bold text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover/action:opacity-100 group-focus-within/action:opacity-100">
                                    Đánh dấu đã đọc
                                  </span>
                                </div>
                                <div className="group/action relative">
                                  <button
                                    type="button"
                                    className="flex size-7 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors duration-200 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                                    onClick={() => handleDeleteNotification(notification)}
                                    aria-label="Xóa thông báo"
                                  >
                                    <span className="material-symbols-outlined text-[16px] leading-none">
                                      close
                                    </span>
                                  </button>
                                  <span className="pointer-events-none absolute right-0 top-[calc(100%+0.35rem)] z-[80] whitespace-nowrap rounded-md bg-slate-950 px-2.5 py-1.5 text-[11px] font-bold text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover/action:opacity-100 group-focus-within/action:opacity-100">
                                    Xóa thông báo
                                  </span>
                                </div>
                              </div>
                              {senderAvatar ? (
                                <img
                                  src={senderAvatar}
                                  alt=""
                                  referrerPolicy={getAvatarReferrerPolicy(senderAvatar)}
                                  className="size-9 shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm"
                                />
                              ) : (
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-blue-600 ring-1 ring-slate-200">
                                  <span className="material-symbols-outlined text-[18px] leading-none">
                                    {getNotificationIcon(notification)}
                                  </span>
                                </span>
                              )}
                              <span className="min-w-0 flex-1">
                                <span className="flex items-start gap-2">
                                  <span className="line-clamp-2 flex-1 text-sm font-bold leading-5 text-slate-900">
                                    {notification.message ||
                                      notification.title ||
                                      "Thông báo mới"}
                                  </span>
                                  {isUnread && (
                                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-600" />
                                  )}
                                </span>
                                <span className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                                  <span className="material-symbols-outlined text-sm leading-none">
                                    schedule
                                  </span>
                                  {formatTime(notification.createdAt)}
                                </span>
                              </span>
                            </article>
                          );
                        })
                      )}
                    </div>
                  </section>

                  <hr className="my-4 border-slate-200/80" />

                  <section>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-slate-900">
                      <span className="material-symbols-outlined rounded-lg bg-purple-100 p-1 text-xl leading-none text-purple-600">
                        video_camera_front
                      </span>
                      Cuộc họp sắp tới
                    </h3>

                    <div className="space-y-2">
                      {isLoadingPanelData && meetings.length === 0 ? (
                        <NotificationPanelSkeleton count={2} />
                      ) : meetings.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-7 text-center">
                          <span className="material-symbols-outlined mb-2 block text-3xl leading-none text-slate-300">
                            event_available
                          </span>
                          <p className="text-xs font-semibold text-slate-500">
                            Không có cuộc họp nào
                          </p>
                        </div>
                      ) : (
                        meetings.slice(0, 3).map((meeting, idx) => (
                          <button
                            key={meeting.id || meeting._id || idx}
                            type="button"
                            onClick={() => handleMeetingClick(meeting)}
                            className="flex w-full items-center gap-3 rounded-xl border border-purple-100 bg-purple-50/70 p-3 text-left transition-colors duration-200 hover:border-purple-200 hover:bg-purple-50"
                          >
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-purple-600 ring-1 ring-purple-100">
                              <span className="material-symbols-outlined text-xl leading-none">
                                video_call
                              </span>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-extrabold text-slate-900">
                                {meeting.title || "Cuộc họp"}
                              </span>
                              <span className="mt-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-purple-600">
                                <span className="material-symbols-outlined text-sm leading-none">
                                  calendar_month
                                </span>
                                {formatMeetingDateTime(
                                  meeting.startTime || meeting.scheduledAt || meeting.createdAt,
                                )}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-purple-700 ring-1 ring-purple-100">
                              <span className="material-symbols-outlined text-sm leading-none">
                                login
                              </span>
                              Tham gia
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </section>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            className="flex items-center gap-2 cursor-pointer"
            aria-label="Mở menu tài khoản"
            aria-haspopup="menu"
            aria-expanded={showDropdown}
            onClick={toggleDropdown}
          >
            <span className="relative inline-flex">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={user?.fullName}
                  referrerPolicy={getAvatarReferrerPolicy(avatarUrl)}
                  className="size-10 rounded-full object-cover shadow-sm"
                />
              ) : (
                <span className="size-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shadow-sm">
                  {userInitial}
                </span>
              )}
              <span
                className={`activity-status-badge activity-status-badge--header absolute -bottom-0.5 -right-0.5 ${currentStatusMeta.badgeClassName}`}
              >
                <ActivityStatusIcon
                  meta={currentStatusMeta}
                  size={currentStatusMeta.value === "online" ? "headerOnline" : "xs"}
                />
              </span>
            </span>
          </button>

          {showDropdown && (
            <div
              className="header-profile-menu absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-1rem))] rounded-2xl border"
              style={profileThemeVars}
            >
              <div className="header-profile-menu-identity p-4">
                <p className="truncate text-sm font-black">
                  {user?.fullName}
                </p>
                <p className="header-profile-muted mt-0.5 truncate text-xs font-semibold">
                  {user?.email}
                </p>
              </div>
              <div className="header-profile-menu-section px-3 py-3">
                <p className="header-profile-label px-2 pb-2 text-[11px] font-black uppercase tracking-wider">
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
                          className={`header-profile-status-option grid w-full grid-cols-[1.25rem_1fr_1.25rem] items-center gap-4 rounded-xl px-3 py-3 text-left transition cursor-pointer ${
                            isActive ? "is-active" : ""
                          } disabled:cursor-not-allowed disabled:opacity-70`}
                        >
                          <span className="flex h-5 w-5 items-center justify-center">
                            <ActivityStatusIcon
                              meta={option}
                              size="md"
                            />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-black leading-5">
                              {option.menuLabel}
                            </span>
                            {option.description && (
                              <span className="header-profile-muted mt-1 block whitespace-normal text-xs font-semibold leading-snug">
                                {option.description}
                              </span>
                            )}
                          </span>
                          {isOnlineOption ? (
                            isActive && (
                              <span className="material-symbols-outlined text-lg text-[var(--header-profile-accent)]">
                                check
                              </span>
                            )
                          ) : (
                            <span className="material-symbols-outlined header-profile-muted text-xl">
                              chevron_right
                            </span>
                          )}
                        </button>

                        {showDurationFlyout && (
                          <div className="absolute right-full top-0 z-[60] pr-2" style={{ minWidth: '13rem' }}>
                            <div
                              className="header-profile-duration-menu flex flex-col rounded-xl border py-1"
                              style={profileThemeVars}
                            >
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
                                  className="header-profile-duration-option block w-full whitespace-nowrap px-5 py-2.5 text-left text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer"
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
                  className="header-profile-menu-action flex w-full items-center gap-3 px-4 py-2.5 text-sm font-bold transition cursor-pointer"
                  onClick={() => {
                    navigate("/profile/me");
                    setShowDropdown(false);
                  }}
                >
                  <span className="material-symbols-outlined text-lg">person</span>
                  Trang cá nhân
                </button>
              </div>
              <div className="header-profile-menu-footer py-1">
                <button
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-bold text-red-500 transition hover:bg-red-50 cursor-pointer"
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
