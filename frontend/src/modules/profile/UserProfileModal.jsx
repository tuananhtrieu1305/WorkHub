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
  { key: "work", label: "Công việc", icon: "workspaces" },
];

const InfoRow = ({ icon, label, value, className = "" }) => {
  if (!value) return null;

  return (
    <div className={`profile-info-card flex items-start gap-3 rounded-2xl px-4 py-3 ${className}`}>
      <span className="profile-info-icon flex size-10 shrink-0 items-center justify-center rounded-xl">
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-black uppercase text-slate-500">
          {label}
        </span>
        <span className="mt-1 block break-words text-sm font-black text-slate-900">
          {value}
        </span>
      </span>
    </div>
  );
};

const EmptyState = ({ icon, text }) => (
  <div className="profile-empty-state rounded-3xl px-5 py-10 text-center">
    <span className="material-symbols-outlined mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-white text-3xl text-[var(--profile-accent)] shadow-sm">
      {icon}
    </span>
    <p className="text-sm font-black text-slate-600">{text}</p>
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
        className="size-28 rounded-[1.75rem] border-4 border-white object-cover shadow-xl shadow-slate-950/15"
      />
    );
  }

  return (
    <span className="flex size-28 items-center justify-center rounded-[1.75rem] border-4 border-white bg-[var(--profile-text)] text-3xl font-black text-white shadow-xl shadow-slate-950/15">
      {getProfileInitial(profile)}
    </span>
  );
};

const StatPill = ({ label, value }) => (
  <div className="profile-chip rounded-2xl px-4 py-3">
    <span className="block text-[11px] font-black uppercase opacity-70">
      {label}
    </span>
    <span className="mt-0.5 block text-lg font-black leading-none">{value}</span>
  </div>
);

const UserProfileModal = ({ open, userId, userPreview = null, onClose }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(userPreview);
  const [isLoading, setIsLoading] = useState(false);
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
      setIsLoading(true);

      getUserById(targetUserId)
        .then((data) => {
          if (!cancelled) setProfile(data);
        })
        .catch((err) => {
          console.error("Failed to load user profile:", err);
          if (!cancelled) setError("Không thể tải hồ sơ người dùng");
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [open, targetUserId]);

  const displayProfile = useMemo(() => {
    const loadedProfileId = getProfileId(profile);
    return targetUserId && loadedProfileId === targetUserId
      ? profile || {}
      : userPreview || {};
  }, [profile, targetUserId, userPreview]);
  const theme = getProfileTheme(displayProfile);
  const bannerUrl =
    theme.useBannerImage !== false
      ? getAvatarUrl(displayProfile.profileBannerUrl)
      : "";
  const tabIndex = Math.max(
    tabs.findIndex((tab) => tab.key === activeTab),
    0,
  );
  const organizations = displayProfile.organizations || [];
  const links = displayProfile.socialLinks || [];
  const interests = displayProfile.interests || [];
  const projects = displayProfile.projects || [];
  const activeOrganizationName = displayProfile.activeOrganization?.name || "";
  const modalStyle = useMemo(
    () => buildProfileAccentStyle(displayProfile),
    [displayProfile],
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
    { label: "Dự án", value: projects.length },
  ];

  if (!open || typeof document === "undefined") return null;

  const renderTabContent = () => {
    if (isLoading && !profile) {
      return (
        <div className="grid gap-3">
          {[0, 1, 2].map((item) => (
            <span
              key={item}
              className="h-16 animate-pulse rounded-2xl bg-slate-100"
            />
          ))}
        </div>
      );
    }

    if (error) {
      return <EmptyState icon="error" text={error} />;
    }

    if (activeTab === "overview") {
      return (
        <div className="grid gap-4">
          {displayProfile.about ? (
            <section className="profile-info-card rounded-3xl p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="profile-info-icon flex size-9 items-center justify-center rounded-xl">
                  <span className="material-symbols-outlined text-[20px]">notes</span>
                </span>
                <h3 className="text-sm font-black text-slate-950">
                  Giới thiệu
                </h3>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm font-semibold leading-7 text-slate-700">
                {displayProfile.about}
              </p>
            </section>
          ) : (
            <EmptyState icon="notes" text="Chưa có phần giới thiệu" />
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            {profileStats.map((item) => (
              <StatPill key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow
              icon="work"
              label="Vị trí"
              value={displayProfile.position}
            />
            <InfoRow
              icon="location_on"
              label="Địa điểm"
              value={displayProfile.location}
            />
            <InfoRow
              icon="apartment"
              label="Tổ chức"
              value={activeOrganizationName}
            />
            <InfoRow
              icon="alternate_email"
              label="Email"
              value={displayProfile.email}
            />
          </div>
        </div>
      );
    }

    if (activeTab === "details") {
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow icon="badge" label="Danh xưng" value={displayProfile.pronouns} />
          <InfoRow
            icon="school"
            label="Học vấn"
            value={displayProfile.education}
          />
          <InfoRow
            icon="cake"
            label="Sinh nhật"
            value={formatBirthday(displayProfile.birthday)}
          />
          <InfoRow icon="call" label="Điện thoại" value={displayProfile.phone} />
          {interests.length > 0 ? (
            <div className="profile-info-card rounded-2xl px-4 py-4 sm:col-span-2">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase text-slate-500">
                <span className="profile-info-icon flex size-9 items-center justify-center rounded-xl">
                  <span className="material-symbols-outlined text-[18px]">
                    interests
                  </span>
                </span>
                <span>Sở thích</span>
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
              className="profile-info-card flex items-center gap-3 rounded-2xl p-4 transition hover:-translate-y-0.5"
            >
              <span className="profile-info-icon flex size-11 shrink-0 items-center justify-center rounded-xl">
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

    if (projects.length === 0 && organizations.length === 0) {
      return <EmptyState icon="workspaces" text="Chưa có hoạt động công việc" />;
    }

    return (
      <div className="grid gap-4">
        {organizations.length > 0 && (
          <section>
            <h4 className="mb-2 text-sm font-black text-slate-950">Tổ chức</h4>
            <div className="grid gap-2">
              {organizations.slice(0, 4).map((organization) => (
                <div
                  key={organization.id}
                  className="profile-info-card flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-slate-900">
                      {organization.name}
                    </span>
                    <span className="block truncate text-xs font-bold text-slate-500">
                      {organization.roleLabel || organization.role || "Thành viên"}
                    </span>
                  </span>
                  {organization.id === displayProfile.activeOrganizationId && (
                    <span className="profile-chip shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black">
                      Đang hoạt động
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
        {projects.length > 0 && (
          <section>
            <h4 className="mb-2 text-sm font-black text-slate-950">Dự án</h4>
            <div className="grid gap-2">
              {projects.slice(0, 5).map((project) => (
                <div
                  key={project.id}
                  className="profile-info-card rounded-2xl px-4 py-3"
                >
                  <p className="truncate text-sm font-black text-slate-900">
                    {project.name}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">
                    {project.description || project.status}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
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
        className="profile-theme-frame profile-modal-shell overflow-hidden rounded-[2rem]"
        style={modalStyle}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="profile-modal-scroll overflow-y-auto">
          <div
            className="profile-banner-surface relative h-60 overflow-hidden sm:h-64"
            style={buildProfileBannerStyle(displayProfile)}
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
              className="absolute right-4 top-4 inline-flex size-11 items-center justify-center rounded-full bg-white/92 text-slate-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-white hover:text-slate-950"
              aria-label="Đóng hồ sơ"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          </div>

          <div className="-mt-16 px-4 pb-5 sm:px-6 sm:pb-6">
            <div className="profile-modal-identity relative rounded-[1.75rem] p-4 sm:p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
                  <ProfileAvatar profile={displayProfile} />
                  <div className="min-w-0 pb-1">
                    <p className="text-xs font-black uppercase text-[var(--profile-accent)]">
                      Hồ sơ thành viên
                    </p>
                    <h2 className="mt-1 truncate text-3xl font-black text-slate-950">
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
            </div>

            <div
              className="profile-modal-tabbar workhub-notification-tabs mt-5 flex rounded-2xl p-1"
              style={{
                "--tab-count": tabs.length,
                "--tab-index": tabIndex,
                "--tab-indicator-bg": "color-mix(in srgb, var(--profile-bg) 72%, #ffffff)",
                "--tab-indicator-border": "color-mix(in srgb, var(--profile-accent) 36%, #ffffff)",
                "--tab-indicator-glow": "color-mix(in srgb, var(--profile-accent) 18%, transparent)",
              }}
            >
              <span className="workhub-notification-tab-indicator" aria-hidden="true" />
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative z-10 flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-black transition-colors ${
                    activeTab === tab.key
                      ? "text-[var(--profile-text)]"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span className="material-symbols-outlined hidden text-[18px] sm:inline">
                    {tab.icon}
                  </span>
                  <span className="truncate">{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 min-h-[18rem] pb-1">{renderTabContent()}</div>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
};

export default UserProfileModal;
