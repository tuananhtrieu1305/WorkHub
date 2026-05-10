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

const Header = ({ overlay = false }) => {
  const { user, logout, updateCurrentUser } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [hoveredDurationStatus, setHoveredDurationStatus] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [inboxTab, setInboxTab] = useState("all");
  const [notifications, setNotifications] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const dropdownRef = useRef(null);
  const notificationRef = useRef(null);
  const mobileMenuRef = useRef(null);

  const isActiveNavItem = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const loadNotificationPanelData = useCallback(async () => {
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
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setShowMobileMenu(false);
  }, [location.pathname]);

  useEffect(() => {
    loadNotificationPanelData();
  }, [loadNotificationPanelData]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleMeetingCreated = ({ meeting }) => {
      setMeetings((currentMeetings) =>
        upsertActiveMeeting(currentMeetings, meeting).slice(0, 3),
      );
    };
    const handleMeetingEnded = ({ meeting }) => {
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
  }, [socket]);

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
      setHoveredDurationStatus(null);
    }
    setShowMobileMenu(next);
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
      <div className="flex min-w-0 flex-1 items-center gap-3 lg:gap-8">
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

        <nav className="hidden min-w-0 items-center gap-1.5 rounded-2xl border border-slate-200/70 bg-slate-50/80 px-2 py-1.5 shadow-sm md:flex lg:hidden">
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
      </div>

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

          {showMobileMenu && (
            <nav
              className="fixed right-3 top-[4.25rem] z-50 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 text-slate-900 shadow-[0_22px_70px_rgba(15,23,42,0.18)]"
              aria-label="Menu chính"
            >
              {navItems.map((item) => {
                const active = isActiveNavItem(item.path);
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/"}
                    className={`sidebar-nav-link group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-200 ${
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
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative" ref={notificationRef}>
            <button
              type="button"
              className={`relative flex size-10 items-center justify-center rounded-full border transition-colors duration-200 cursor-pointer ${
                showNotificationPanel
                  ? "border-blue-200 bg-blue-50 text-blue-600 shadow-sm"
                  : "border-transparent bg-slate-100 text-slate-600 hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600"
              }`}
              title="Thông báo"
              aria-haspopup="dialog"
              aria-expanded={showNotificationPanel}
              onClick={toggleNotificationPanel}
            >
              <span className="material-symbols-outlined text-xl leading-none">
                notifications
              </span>
              {notificationUnreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-extrabold leading-none text-white ring-2 ring-white">
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
                      {filteredNotifications.length === 0 ? (
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
                      {meetings.length === 0 ? (
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
          <button
            className="hidden items-center justify-center rounded-full size-10 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-purple-600 transition-all duration-300 cursor-pointer lg:flex"
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
                  referrerPolicy={getAvatarReferrerPolicy(avatarUrl)}
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
            <div className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-1rem))] rounded-xl border border-white/10 bg-[#383941] text-white shadow-[0_18px_50px_rgba(15,23,42,0.35)]">
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
