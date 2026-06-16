import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { getUserById } from "../../api/userApi";
import { useAuth } from "../../context/AuthContext";
import {
  getAvatarReferrerPolicy,
  getAvatarUrl,
} from "../../utils/avatar";
import {
  buildProfileAccentStyle,
  buildProfileBannerStyle,
  formatBirthday,
  getHostLabel,
  getLinkIcon,
  getProfileId,
  getProfileInitial,
  getProfileTheme,
} from "./profileUtils";

const tabs = [
  { key: "overview", label: "Tổng quan", icon: "person" },
  { key: "details", label: "Thông tin", icon: "badge" },
  { key: "links", label: "Liên kết", icon: "link" },
  { key: "roles", label: "Vai trò", icon: "admin_panel_settings" },
];

const roleFallbackLabels = {
  owner: "Chủ sở hữu",
  admin: "Quản trị",
  member: "Thành viên",
};

const loadingProfileStyle = {
  "--profile-accent": "#64748b",
  "--profile-bg": "#e2e8f0",
  "--profile-text": "#334155",
  "--profile-accent-muted": "#f8fafc",
  "--profile-accent-soft": "#f8fafc",
  "--profile-accent-ring": "#cbd5e1",
};

const loadingProfileBannerStyle = {
  ...loadingProfileStyle,
  color: "var(--profile-text)",
  background:
    "linear-gradient(135deg, #e2e8f0 0%, #f8fafc 52%, #e5e7eb 100%)",
};

const InfoRow = ({ icon, label, value, className = "" }) => {
  if (!value) return null;

  return (
    <div className={`profile-info-card flex items-start gap-3 rounded-xl px-4 py-3 ${className}`}>
      <span className="profile-info-icon flex size-9 shrink-0 items-center justify-center rounded-lg">
        <span className="material-symbols-outlined text-[19px]">{icon}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-bold text-slate-500">
          {label}
        </span>
        <span className="mt-0.5 block break-words text-sm font-bold text-slate-950">
          {value}
        </span>
      </span>
    </div>
  );
};

const EmptyState = ({ icon, text }) => (
  <div className="profile-empty-state rounded-2xl px-5 py-8 text-center">
    <span className="material-symbols-outlined mx-auto mb-3 flex size-11 items-center justify-center rounded-xl bg-white text-[26px] text-[var(--profile-accent)] shadow-sm">
      {icon}
    </span>
    <p className="text-sm font-bold text-slate-600">{text}</p>
  </div>
);

const ProfileAvatar = ({ profile }) => {
  const avatarUrl = getAvatarUrl(profile?.avatar);
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={profile?.fullName || "Người dùng"}
        referrerPolicy={getAvatarReferrerPolicy(avatarUrl)}
        className="size-24 rounded-[1.35rem] border-4 border-white object-cover shadow-xl shadow-slate-950/15"
      />
    );
  }

  return (
    <span className="flex size-24 items-center justify-center rounded-[1.35rem] border-4 border-white bg-[var(--profile-text)] text-3xl font-black text-white shadow-xl shadow-slate-950/15">
      {getProfileInitial(profile)}
    </span>
  );
};

const StatPill = ({ label, value }) => (
  <div className="profile-stat-pill rounded-xl px-4 py-3">
    <span className="block text-[11px] font-black uppercase opacity-65">
      {label}
    </span>
    <span className="mt-1 block text-xl font-black leading-none">{value}</span>
  </div>
);

const SkeletonBlock = ({ className = "" }) => (
  <span aria-hidden="true" className={`profile-skeleton block ${className}`} />
);

const ProfileIdentitySkeleton = () => (
  <>
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
        <SkeletonBlock className="size-24 rounded-[1.35rem]" />
        <div className="grid min-w-0 flex-1 gap-2.5">
          <SkeletonBlock className="h-3 w-28 rounded-full" />
          <SkeletonBlock className="h-8 w-64 max-w-full rounded-full" />
          <SkeletonBlock className="h-4 w-80 max-w-full rounded-full" />
          <div className="flex flex-wrap gap-2 pt-1">
            <SkeletonBlock className="h-8 w-24 rounded-full" />
            <SkeletonBlock className="h-8 w-44 rounded-full" />
          </div>
        </div>
      </div>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <SkeletonBlock key={item} className="h-16 rounded-xl" />
      ))}
    </div>
  </>
);

const ProfileTabsSkeleton = () => (
  <div
    className="profile-modal-tabbar mt-4 grid rounded-2xl p-1"
    style={{ "--profile-tab-count": tabs.length }}
  >
    {tabs.map((tab) => (
      <span
        key={tab.key}
        className="flex min-h-11 items-center justify-center px-2"
      >
        <SkeletonBlock className="h-4 w-20 max-w-full rounded-full" />
      </span>
    ))}
  </div>
);

const ProfileContentSkeleton = () => (
  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(17rem,0.95fr)]">
    <div className="profile-info-card rounded-2xl p-5">
      <SkeletonBlock className="mb-4 h-5 w-32 rounded-full" />
      <div className="grid gap-2.5">
        <SkeletonBlock className="h-4 w-full rounded-full" />
        <SkeletonBlock className="h-4 w-11/12 rounded-full" />
        <SkeletonBlock className="h-4 w-3/4 rounded-full" />
      </div>
    </div>
    <div className="profile-info-card rounded-2xl p-4">
      <SkeletonBlock className="mb-4 h-5 w-36 rounded-full" />
      <div className="grid gap-2">
        {[0, 1, 2].map((item) => (
          <SkeletonBlock key={item} className="h-12 rounded-xl" />
        ))}
      </div>
    </div>
  </div>
);

const FactItem = ({ icon, label, value }) => {
  if (!value) return null;

  return (
    <div className="profile-fact-row flex items-center gap-3 rounded-xl px-3 py-2.5">
      <span className="profile-info-icon flex size-9 shrink-0 items-center justify-center rounded-lg">
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] font-bold text-slate-500">{label}</span>
        <span className="block truncate text-sm font-black text-slate-950">
          {value}
        </span>
      </span>
    </div>
  );
};

const formatRoleDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const getDisplayRoles = (profile = {}) => {
  if (Array.isArray(profile.organizationRoles) && profile.organizationRoles.length) {
    return profile.organizationRoles;
  }

  const activeOrganization = profile.activeOrganization;
  if (!activeOrganization?.role) return [];

  return [
    {
      key: activeOrganization.role,
      name:
        activeOrganization.roleLabel ||
        roleFallbackLabels[activeOrganization.role] ||
        activeOrganization.role,
      description: "Vai trò trong tổ chức đang hoạt động.",
      color: activeOrganization.roleColor || "#64748b",
      status: activeOrganization.memberStatus || "active",
      joinedAt: activeOrganization.joinedAt,
    },
  ];
};

const UserProfileModal = ({ open, userId, userPreview = null, onClose }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const currentUserId = getProfileId(user);
  const targetUserId = userId || getProfileId(userPreview);
  const isCurrentUser = currentUserId && currentUserId === targetUserId;

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;

    if (!targetUserId) return;

    let cancelled = false;
    const timerId = window.setTimeout(() => {
      setActiveTab("overview");
      setError("");
      setProfile(null);

      getUserById(targetUserId)
        .then((data) => {
          if (!cancelled) setProfile(data);
        })
        .catch((err) => {
          console.error("Failed to load user profile:", err);
          if (!cancelled) setError("Không thể tải hồ sơ người dùng");
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [open, targetUserId]);

  const loadedProfileId = getProfileId(profile);
  const hasResolvedProfile = Boolean(
    targetUserId && loadedProfileId === targetUserId,
  );
  const isProfileLoading = Boolean(
    open && targetUserId && !error && !hasResolvedProfile,
  );
  const isProfilePlaceholder =
    isProfileLoading || Boolean(error && !hasResolvedProfile);
  const displayProfile = useMemo(
    () => (hasResolvedProfile ? profile || {} : {}),
    [hasResolvedProfile, profile],
  );
  const theme = getProfileTheme(displayProfile);
  const bannerUrl =
    !isProfilePlaceholder && theme.useBannerImage !== false
      ? getAvatarUrl(displayProfile.profileBannerUrl)
      : "";
  const bannerStyle = useMemo(
    () =>
      isProfilePlaceholder
        ? loadingProfileBannerStyle
        : buildProfileBannerStyle(displayProfile),
    [displayProfile, isProfilePlaceholder],
  );
  const tabIndex = Math.max(
    tabs.findIndex((tab) => tab.key === activeTab),
    0,
  );
  const links = displayProfile.socialLinks || [];
  const interests = displayProfile.interests || [];
  const organizationRoles = getDisplayRoles(displayProfile);
  const activeOrganizationName = isCurrentUser
    ? displayProfile.activeOrganization?.name || ""
    : "";
  const modalStyle = useMemo(
    () =>
      isProfilePlaceholder
        ? loadingProfileStyle
        : buildProfileAccentStyle(displayProfile),
    [displayProfile, isProfilePlaceholder],
  );
  const headline = displayProfile.bio || displayProfile.position || "Thành viên WorkHub";
  const summaryChips = [
    displayProfile.position && { icon: "work", label: displayProfile.position },
    displayProfile.location && { icon: "location_on", label: displayProfile.location },
    activeOrganizationName && { icon: "apartment", label: activeOrganizationName },
    displayProfile.email && { icon: "alternate_email", label: displayProfile.email },
  ].filter(Boolean);
  const profileStats = [
    { label: "Liên kết", value: links.length },
    { label: "Sở thích", value: interests.length },
    { label: "Vai trò", value: organizationRoles.length },
  ];

  if (!open || typeof document === "undefined") return null;

  const renderTabContent = () => {
    if (isProfileLoading) {
      return <ProfileContentSkeleton />;
    }

    if (error) {
      return <EmptyState icon="error" text={error} />;
    }

    if (activeTab === "overview") {
      return (
        <div className="profile-overview-grid grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(17rem,0.95fr)]">
          <section className="profile-info-card rounded-2xl p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="profile-info-icon flex size-9 items-center justify-center rounded-lg">
                <span className="material-symbols-outlined text-[19px]">notes</span>
              </span>
              <h3 className="text-sm font-black text-slate-950">Giới thiệu</h3>
            </div>
            {displayProfile.about ? (
              <p className="whitespace-pre-wrap break-words text-sm font-semibold leading-7 text-slate-700">
                {displayProfile.about}
              </p>
            ) : (
              <p className="text-sm font-semibold leading-7 text-slate-500">
                Chưa có phần giới thiệu công khai.
              </p>
            )}
          </section>

          <section className="profile-info-card rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-black text-slate-950">Thông tin nhanh</h3>
              <span className="profile-mini-badge rounded-full px-2.5 py-1 text-[11px] font-black">
                Công khai
              </span>
            </div>
            <div className="grid gap-2">
              <FactItem icon="work" label="Vị trí" value={displayProfile.position} />
              <FactItem icon="location_on" label="Địa điểm" value={displayProfile.location} />
              <FactItem icon="alternate_email" label="Email" value={displayProfile.email} />
              <FactItem
                icon="admin_panel_settings"
                label="Vai trò"
                value={organizationRoles.map((role) => role.name).join(", ")}
              />
            </div>
          </section>

          {interests.length > 0 && (
            <section className="profile-info-card rounded-2xl p-4 lg:col-span-2">
              <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-950">
                <span className="profile-info-icon flex size-9 items-center justify-center rounded-lg">
                  <span className="material-symbols-outlined text-[18px]">
                    interests
                  </span>
                </span>
                Sở thích
              </div>
              <div className="flex flex-wrap gap-2">
                {interests.map((item) => (
                  <span
                    key={item}
                    className="profile-chip rounded-full px-3 py-1.5 text-xs font-black"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      );
    }

    if (activeTab === "details") {
      const detailRows = [
        { icon: "badge", label: "Danh xưng", value: displayProfile.pronouns },
        { icon: "school", label: "Học vấn", value: displayProfile.education },
        {
          icon: "cake",
          label: "Sinh nhật",
          value: formatBirthday(displayProfile.birthday),
        },
        { icon: "call", label: "Điện thoại", value: displayProfile.phone },
      ].filter((item) => item.value);

      if (detailRows.length === 0 && interests.length === 0) {
        return <EmptyState icon="badge" text="Chưa có thông tin bổ sung" />;
      }

      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {detailRows.map((item) => (
            <InfoRow
              key={item.label}
              icon={item.icon}
              label={item.label}
              value={item.value}
            />
          ))}
          {interests.length > 0 ? (
            <div className="profile-info-card rounded-xl px-4 py-4 sm:col-span-2">
              <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-950">
                <span className="profile-info-icon flex size-9 items-center justify-center rounded-lg">
                  <span className="material-symbols-outlined text-[18px]">
                    interests
                  </span>
                </span>
                Sở thích
              </div>
              <div className="flex flex-wrap gap-2">
                {interests.map((item) => (
                  <span
                    key={item}
                    className="profile-chip rounded-full px-3 py-1.5 text-xs font-black"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      );
    }

    if (activeTab === "links") {
      if (links.length === 0) {
        return <EmptyState icon="link_off" text="Chưa có liên kết công khai" />;
      }

      return (
        <div className="grid gap-3">
          {links.map((link) => (
            <a
              key={`${link.type}-${link.url}`}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="profile-info-card flex items-center gap-3 rounded-xl p-4 transition hover:-translate-y-0.5"
            >
              <span className="profile-info-icon flex size-10 shrink-0 items-center justify-center rounded-lg">
                <span className="material-symbols-outlined text-[21px]">
                  {getLinkIcon(link.type)}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-slate-900">
                  {link.label || getHostLabel(link.url)}
                </span>
                <span className="block truncate text-xs font-semibold text-slate-500">
                  {getHostLabel(link.url)}
                </span>
              </span>
              <span className="material-symbols-outlined text-slate-400">
                open_in_new
              </span>
            </a>
          ))}
        </div>
      );
    }

    if (organizationRoles.length === 0) {
      return (
        <EmptyState
          icon="admin_panel_settings"
          text="Chưa có vai trò trong tổ chức hiện tại"
        />
      );
    }

    return (
      <div className="grid gap-3">
        {organizationRoles.map((role) => (
          <article
            key={`${role.key}-${role.name}`}
            className="profile-role-card flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-start gap-3">
              <span
                className="profile-role-swatch mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl"
                style={{ "--role-color": role.color || "var(--profile-accent)" }}
              >
                <span className="material-symbols-outlined text-[21px]">
                  admin_panel_settings
                </span>
              </span>
              <span className="min-w-0">
                <span className="block text-base font-black text-slate-950">
                  {role.name || roleFallbackLabels[role.key] || role.key}
                </span>
                <span className="mt-1 block text-sm font-semibold leading-6 text-slate-600">
                  {role.description || "Vai trò được gán trong tổ chức hiện tại."}
                </span>
              </span>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <span className="profile-chip rounded-full px-3 py-1.5 text-xs font-black">
                {role.status === "active" ? "Đang hoạt động" : role.status || "Thành viên"}
              </span>
              {formatRoleDate(role.joinedAt) && (
                <span className="profile-mini-badge rounded-full px-3 py-1.5 text-xs font-black">
                  Từ {formatRoleDate(role.joinedAt)}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    );
  };

  return createPortal(
    <div
      className="profile-modal-backdrop fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/50 px-3 py-4 backdrop-blur-md sm:px-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Hồ sơ người dùng"
        className="profile-theme-frame profile-modal-shell overflow-hidden rounded-[1.75rem]"
        style={modalStyle}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="profile-modal-scroll overflow-y-auto">
          <div
            className="profile-banner-surface relative h-44 overflow-hidden sm:h-48"
            style={bannerStyle}
          >
            {bannerUrl && (
              <img
                src={bannerUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-slate-950/10 to-white/10" />
            <button
              type="button"
              onClick={onClose}
              className="profile-close-button absolute right-4 top-4 inline-flex size-11 items-center justify-center rounded-full bg-white/92 text-slate-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-white hover:text-slate-950"
              aria-label="Đóng hồ sơ"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          </div>

          <div className="-mt-10 px-4 pb-5 sm:px-6 sm:pb-6">
            <div className="profile-modal-identity relative rounded-2xl p-4 sm:p-5">
              {isProfilePlaceholder ? (
                <ProfileIdentitySkeleton />
              ) : (
                <>
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
                      <ProfileAvatar profile={displayProfile} />
                      <div className="min-w-0">
                        <p className="text-xs font-black text-[var(--profile-accent)]">
                          Hồ sơ thành viên
                        </p>
                        <h2 className="mt-1 truncate text-2xl font-black leading-tight text-slate-950 sm:text-3xl">
                          {displayProfile.fullName || "Người dùng"}
                        </h2>
                        <p className="mt-1 line-clamp-2 max-w-2xl text-sm font-bold leading-6 text-slate-600">
                          {headline}
                        </p>
                        {summaryChips.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {summaryChips.slice(0, 4).map((chip) => (
                              <span
                                key={`${chip.icon}-${chip.label}`}
                                className="profile-chip inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black"
                              >
                                <span className="material-symbols-outlined text-[16px]">
                                  {chip.icon}
                                </span>
                                <span className="truncate">{chip.label}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {isCurrentUser && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose?.();
                          navigate("/profile");
                        }}
                        className="profile-primary-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition"
                      >
                        <span className="material-symbols-outlined text-[19px]">edit</span>
                        Chỉnh sửa
                      </button>
                    )}
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {profileStats.map((item) => (
                      <StatPill key={item.label} label={item.label} value={item.value} />
                    ))}
                  </div>
                </>
              )}
            </div>

            {isProfilePlaceholder ? (
              <ProfileTabsSkeleton />
            ) : (
              <div
                className="profile-modal-tabbar relative mt-4 grid rounded-2xl p-1"
                style={{
                  "--profile-tab-count": tabs.length,
                  "--profile-tab-index": tabIndex,
                }}
              >
                <span className="profile-modal-tab-indicator" aria-hidden="true" />
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`profile-modal-tab relative z-10 flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-black transition ${
                      activeTab === tab.key
                        ? "text-[var(--profile-text)]"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                    aria-pressed={activeTab === tab.key}
                  >
                    <span className="material-symbols-outlined hidden text-[18px] sm:inline">
                      {tab.icon}
                    </span>
                    <span className="truncate">{tab.label}</span>
                  </button>
                ))}
              </div>
            )}

            <div
              className="profile-modal-content mt-4 pb-1"
              aria-busy={isProfileLoading}
            >
              {renderTabContent()}
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
};

export default UserProfileModal;
