import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { updateMyActivityStatus } from "../../api/userApi";
import {
  deleteNotification,
  getNotifications,
  getUnreadCount,
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
import workHubLogo from "../../assets/WorkHub_logo.png";
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
  sortNotificationsByRecentActivity,
  upsertNotification,
} from "./notificationPanelState";
import { NotificationPanelSkeleton } from "../common/Skeleton";

const inboxTabs = [
  { key: "all", label: "Tất cả" },
  { key: "unread", label: "Chưa đọc" },
  { key: "mentions", label: "Đề cập" },
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

const getUnreadCountFromPayload = (payload, fallback = 0) => {
  const nextCount = Number(payload?.unreadCount);
  return Number.isFinite(nextCount)
    ? Math.max(Math.trunc(nextCount), 0)
    : fallback;
};

const roleLabelFallbacks = {
  owner: "Chủ sở hữu",
  "chu-so-huu": "Chủ sở hữu",
  admin: "Quản trị viên",
  manager: "Quản lý",
  "quan-ly": "Quản lý",
  member: "Thành viên",
  "thanh-vien": "Thành viên",
  thanhvien: "Thành viên",
};

const formatOrganizationRoleLabel = (value) => {
  if (!value) return "";

  const normalizedValue = String(value).trim();
  if (!normalizedValue) return "";

  const normalizedKey = normalizedValue
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");

  return roleLabelFallbacks[normalizedKey] || normalizedValue;
};

const getOrganizationRoleLabel = (organization = {}) => {
  const roleNames = (Array.isArray(organization.roles)
    ? organization.roles
    : []
  )
    .map((role) =>
      formatOrganizationRoleLabel(
        role?.name || role?.displayName || role?.label || role?.key,
      ),
    )
    .filter(Boolean);

  if (roleNames.length) return roleNames.join(", ");

  const candidates = [
    organization.roleLabel,
    organization.roleName,
    organization.roleDisplayName,
    organization.activeRole?.name,
    organization.membership?.roleLabel,
    organization.membership?.roleName,
    organization.role,
  ];

  return (
    candidates.map(formatOrganizationRoleLabel).find(Boolean) || "Thành viên"
  );
};

const isMeaningfulOrganizationValue = (value) => {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && value !== "";
};

const mergeOrganizationForDisplay = (...sources) => {
  const merged = sources.reduce((result, source) => {
    if (!source) return result;

    Object.entries(source).forEach(([key, value]) => {
      if (isMeaningfulOrganizationValue(value)) {
        result[key] = value;
      }
    });

    return result;
  }, {});

  return Object.keys(merged).length ? merged : null;
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
        className={`${className} header-organization-logo-image shrink-0 object-cover`}
      />
    );
  }

  return (
    <span
      className={`${className} ${textClassName} header-organization-logo-mark flex shrink-0 items-center justify-center font-black`}
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
  const organizationMenuRef = useRef(null);
  const organizations = user?.organizations || [];
  const activeOrganizationPayload = user?.activeOrganization || null;
  const activeOrganizationId = toComparableId(
    activeOrganizationPayload?.id ||
      activeOrganizationPayload?._id ||
      user?.activeOrganizationId,
  );
  const activeOrganizationFromList = organizations.find(
    (organization) =>
      toComparableId(organization?.id || organization?._id) === activeOrganizationId,
  );
  const activeOrganization = mergeOrganizationForDisplay(
    activeOrganizationFromList,
    activeOrganizationPayload,
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
        setNotifications(sortNotificationsByRecentActivity(nextNotifications));
        setUnreadCount(
          getUnreadCountFromPayload(
            payload,
            nextNotifications.filter(isNotificationUnread).length,
          ),
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

  const refreshUnreadCount = useCallback(async () => {
    try {
      const payload = await getUnreadCount();
      setUnreadCount((currentCount) =>
        getUnreadCountFromPayload(payload, currentCount),
      );
    } catch (error) {
      console.error("Failed to refresh notification unread count:", error);
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
        !organizationRef.current.contains(e.target) &&
        !organizationMenuRef.current?.contains(e.target)
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

    const isActiveNotification = (notification) => {
      const notificationOrganizationId = toComparableId(
        notification?.organizationId || notification?.data?.organizationId,
      );
      if (!activeOrganizationId) return !notificationOrganizationId;
      return notificationOrganizationId === activeOrganizationId;
    };

    const handleNotificationCreated = (notification) => {
      if (!isActiveNotification(notification)) return;

      const nextUnreadCount = getUnreadCountFromPayload(notification, null);
      setNotifications((currentNotifications) => {
        const notificationId = getNotificationId(notification);
        const existingNotification = currentNotifications.find(
          (item) => getNotificationId(item) === notificationId,
        );
        const wasUnread =
          existingNotification && isNotificationUnread(existingNotification);
        const isUnread = isNotificationUnread(notification);

        if (nextUnreadCount === null) {
          setUnreadCount((currentCount) =>
            Math.max(
              currentCount +
                (isUnread ? 1 : 0) -
                (wasUnread ? 1 : 0),
              0,
            ),
          );
        }

        return upsertNotification(currentNotifications, notification);
      });
      if (nextUnreadCount !== null) {
        setUnreadCount(nextUnreadCount);
      }
    };

    const handleNotificationRead = (notification) => {
      if (!isActiveNotification(notification)) return;

      const nextUnreadCount = getUnreadCountFromPayload(notification, null);
      setNotifications((currentNotifications) => {
        const notificationId = getNotificationId(notification);
        const existingNotification = currentNotifications.find(
          (item) => getNotificationId(item) === notificationId,
        );
        if (
          nextUnreadCount === null &&
          existingNotification &&
          isNotificationUnread(existingNotification)
        ) {
          setUnreadCount((currentCount) => Math.max(currentCount - 1, 0));
        }
        return markNotificationReadLocally(
          currentNotifications,
          notificationId,
          notification?.readAt,
        );
      });
      if (nextUnreadCount !== null) {
        setUnreadCount(nextUnreadCount);
      }
    };

    const handleNotificationsReadAll = (event) => {
      const eventOrganizationId = toComparableId(event?.organizationId);
      if (activeOrganizationId && eventOrganizationId !== activeOrganizationId) {
        return;
      }
      setNotifications((currentNotifications) =>
        markNotificationsReadLocally(currentNotifications),
      );
      setUnreadCount(0);
    };

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

    socket.on("notification_created", handleNotificationCreated);
    socket.on("notification_read", handleNotificationRead);
    socket.on("notifications_read_all", handleNotificationsReadAll);
    socket.on("meeting_created", handleMeetingCreated);
    socket.on("meeting_ended", handleMeetingEnded);
    socket.on("connect", refreshUnreadCount);

    if (socket.connected) {
      refreshUnreadCount();
    }

    return () => {
      socket.off("notification_created", handleNotificationCreated);
      socket.off("notification_read", handleNotificationRead);
      socket.off("notifications_read_all", handleNotificationsReadAll);
      socket.off("meeting_created", handleMeetingCreated);
      socket.off("meeting_ended", handleMeetingEnded);
      socket.off("connect", refreshUnreadCount);
    };
  }, [activeOrganizationId, refreshUnreadCount, socket]);

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
  const activeOrganizationRoleLabel = activeOrganization
    ? getOrganizationRoleLabel(activeOrganization)
    : "Chưa tham gia";
  const organizationThemeVars = {
    "--header-organization-accent": profileTheme.accentColor,
    "--header-organization-bg": profileTheme.backgroundColor,
    "--header-organization-text": profileTheme.textColor,
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

  const organizationMenu = showOrganizationMenu ? (
    <div
      ref={organizationMenuRef}
      className="header-organization-menu"
      style={organizationThemeVars}
      role="menu"
    >
      <div className="header-organization-menu-header">
        <div className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="header-organization-eyebrow">
              <span className="material-symbols-outlined text-base leading-none">
                domain
              </span>
              Không gian tổ chức
            </span>
            <span className="header-organization-description mt-2 block text-xs font-semibold leading-5">
              Bảng tin, tin nhắn, tài liệu và công việc sẽ đổi theo tổ chức
              đang chọn.
            </span>
          </span>
          <span className="header-organization-count">
            {organizations.length || 0}
          </span>
        </div>
      </div>

      <div className="header-organization-list">
        {organizations.length === 0 ? (
          <div className="header-organization-empty rounded-xl border border-dashed px-4 py-6 text-center">
            <span className="material-symbols-outlined text-3xl leading-none">
              domain_add
            </span>
            <p className="mt-2 text-sm font-bold">Bạn chưa có tổ chức nào</p>
          </div>
        ) : (
          organizations.map((organization) => {
            const organizationId = toComparableId(
              organization.id || organization._id,
            );
            const isActive = organizationId === activeOrganizationId;

            return (
              <button
                key={organizationId}
                type="button"
                className={`header-organization-option ${
                  isActive ? "is-active" : ""
                }`}
                aria-current={isActive ? "true" : undefined}
                onClick={() => {
                  if (isActive) {
                    setShowOrganizationMenu(false);
                    return;
                  }
                  handleSwitchOrganization(organizationId);
                }}
                role="menuitem"
              >
                <OrganizationLogoMark
                  organization={organization}
                  className="size-9 rounded-xl"
                  textClassName="text-sm"
                />
                <span className="min-w-0 flex-1">
                  <span className="header-organization-option-name">
                    {organization.name}
                  </span>
                  <span className="header-organization-option-role">
                    {getOrganizationRoleLabel(organization)}
                  </span>
                </span>
                <span
                  className={`header-organization-option-status ${
                    isActive ? "is-active" : ""
                  }`}
                >
                  {isActive ? (
                    <>
                      <span className="material-symbols-outlined text-base leading-none">
                        check
                      </span>
                      <span className="hidden sm:inline">Đang chọn</span>
                    </>
                  ) : (
                    <span className="material-symbols-outlined text-xl leading-none">
                      sync_alt
                    </span>
                  )}
                </span>
              </button>
            );
          })
        )}
      </div>

      <div className="header-organization-menu-footer">
        <button
          type="button"
          className="header-organization-manage-button"
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
  ) : null;

  return (
    <>
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
            className="h-10 w-10 rounded-lg object-cover shadow-sm"
          />
        </NavLink>

        <div className="hidden min-w-0 select-none items-center lg:flex">
          <span className="relative inline-flex items-end drop-shadow-[0_4px_14px_rgba(37,99,235,0.16)]">
            <span className="relative inline-flex pb-1.5">
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-[1.35rem] font-black leading-none text-transparent">
                Work
              </span>
              <span
                className="absolute bottom-0 left-0 h-1.5 w-[calc(100%+0.18rem)] rounded-l-full rounded-r-[2px] bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500"
                aria-hidden="true"
              />
            </span>
            <span className="ml-0.5 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 bg-clip-text text-[1.62rem] font-black leading-[0.88] text-transparent">
              Hub
            </span>
            <span
              className="absolute -right-3 top-0 size-2 rounded-full bg-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.8)]"
              aria-hidden="true"
            />
          </span>
        </div>
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
          <div
            className="relative"
            ref={organizationRef}
            style={organizationThemeVars}
          >
            <button
              type="button"
              className={`header-organization-trigger ${
                showOrganizationMenu ? "is-open" : ""
              }`}
              aria-haspopup="menu"
              aria-expanded={showOrganizationMenu}
              title={
                activeOrganization
                  ? `${activeOrganization.name || "Tổ chức"} - ${activeOrganizationRoleLabel}`
                  : "Chọn không gian tổ chức"
              }
              aria-label="Chọn không gian tổ chức"
              onClick={toggleOrganizationMenu}
            >
              <OrganizationLogoMark
                organization={activeOrganization}
                className="size-7 rounded-full"
                textClassName="text-[11px]"
              />
              <span className="header-organization-copy">
                <span className="header-organization-name">
                  {activeOrganization?.name || "Tổ chức"}
                </span>
                <span className="header-organization-role">
                  {activeOrganizationRoleLabel}
                </span>
              </span>
              <span className="material-symbols-outlined header-organization-chevron">
                expand_more
              </span>
            </button>

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
              <div className="workhub-notification-panel">
                <div className="workhub-notification-header">
                  <div className="min-w-0">
                    <h2 className="text-base font-black text-slate-950">
                      Thông báo
                    </h2>
                    <span className="mt-0.5 block text-xs font-semibold text-slate-500">
                      {notificationUnreadCount > 0
                        ? `${notificationUnreadCount} mục chưa đọc`
                        : "Bạn đã xem hết thông báo"}
                    </span>
                  </div>
                  <div className="group relative shrink-0">
                    <button
                      type="button"
                      className={`workhub-notification-mark-all ${
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

                <div className="workhub-notification-body">
                  <section>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="flex items-center gap-2 text-sm font-black text-slate-950">
                        <span className="material-symbols-outlined rounded-xl bg-blue-100 p-1.5 text-xl leading-none text-blue-600">
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
                          const notificationTitle =
                            notification.title ||
                            notification.message ||
                            "Thông báo mới";
                          const notificationBody = [
                            notification.message,
                            notification.content,
                          ].find(
                            (item) =>
                              item &&
                              String(item).trim() &&
                              item !== notificationTitle,
                          );

                          return (
                            <article
                              key={getNotificationId(notification) || idx}
                              className={`workhub-notification-item ${
                                isUnread ? "is-unread" : ""
                              }`}
                            >
                              {senderAvatar ? (
                                <img
                                  src={senderAvatar}
                                  alt=""
                                  referrerPolicy={getAvatarReferrerPolicy(senderAvatar)}
                                  className="workhub-notification-avatar object-cover"
                                />
                              ) : (
                                <span className="workhub-notification-avatar bg-white text-blue-600 ring-1 ring-slate-200">
                                  <span className="material-symbols-outlined text-[18px] leading-none">
                                    {getNotificationIcon(notification)}
                                  </span>
                                </span>
                              )}
                              <span className="workhub-notification-content">
                                <span className="flex items-start gap-2">
                                  <span className="workhub-notification-title">
                                    {notificationTitle}
                                  </span>
                                  {isUnread && (
                                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-600" />
                                  )}
                                </span>
                                {notificationBody && (
                                  <span className="workhub-notification-copy">
                                    {notificationBody}
                                  </span>
                                )}
                                <span className="workhub-notification-meta">
                                  <span className="material-symbols-outlined text-sm leading-none">
                                    schedule
                                  </span>
                                  {formatTime(notification.createdAt)}
                                </span>
                              </span>
                              <span className="workhub-notification-actions">
                                <span className="group/action relative">
                                  <button
                                    type="button"
                                    className="workhub-notification-action workhub-notification-action--read"
                                    onClick={() => handleNotificationClick(notification)}
                                    aria-label="Đánh dấu đã đọc"
                                    disabled={!isUnread}
                                  >
                                    <span className="material-symbols-outlined text-[16px] leading-none">
                                      done
                                    </span>
                                  </button>
                                  <span className="pointer-events-none absolute right-0 top-[calc(100%+0.35rem)] z-[80] whitespace-nowrap rounded-md bg-slate-950 px-2.5 py-1.5 text-[11px] font-bold text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover/action:opacity-100 group-focus-within/action:opacity-100">
                                    Đánh dấu đã đọc
                                  </span>
                                </span>
                                <span className="group/action relative">
                                  <button
                                    type="button"
                                    className="workhub-notification-action workhub-notification-action--delete"
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
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-950">
                      <span className="material-symbols-outlined rounded-xl bg-purple-100 p-1.5 text-xl leading-none text-purple-600">
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
      {organizationMenu}
    </>
  );
};

export default Header;
