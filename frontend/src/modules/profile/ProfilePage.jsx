import { useEffect, useMemo, useRef, useState } from "react";
import { App } from "antd";
import {
  deleteMyProfileBanner,
  getMyProfile,
  updateMyAvatar,
  updateMyProfile,
  updateMyProfileBanner,
} from "../../api/userApi";
import { useAuth } from "../../context/AuthContext";
import {
  getAvatarReferrerPolicy,
  getAvatarUrl,
} from "../../utils/avatar";
import {
  buildProfileAccentStyle,
  buildProfileBannerStyle,
  defaultProfileTheme,
  getProfileInitial,
  getProfileTheme,
  profileLinkTypes,
  profileThemePresets,
  toDateInputValue,
} from "./profileUtils";

const emptyLink = { label: "", url: "", type: "website" };

const toProfileForm = (profile = {}) => ({
  fullName: profile.fullName || "",
  bio: profile.bio || "",
  about: profile.about || "",
  phone: profile.phone || "",
  position: profile.position || "",
  location: profile.location || "",
  birthday: toDateInputValue(profile.birthday),
  pronouns: profile.pronouns || "",
  education: profile.education || "",
  interests: Array.isArray(profile.interests) ? profile.interests : [],
  socialLinks: Array.isArray(profile.socialLinks) ? profile.socialLinks : [],
  profileBannerUrl: profile.profileBannerUrl || "",
  profileTheme: getProfileTheme(profile),
});

const toProfilePayload = (form) => ({
  fullName: form.fullName,
  bio: form.bio,
  about: form.about,
  phone: form.phone,
  position: form.position,
  location: form.location,
  birthday: form.birthday || null,
  pronouns: form.pronouns,
  education: form.education,
  interests: form.interests,
  socialLinks: form.socialLinks,
  profileTheme: form.profileTheme,
});

const Section = ({ title, icon, children, aside }) => (
    <section className="profile-edit-section grid gap-5 overflow-hidden rounded-[1.5rem] p-4 backdrop-blur lg:grid-cols-[13rem_1fr] lg:p-5">
      <div className="profile-section-rail rounded-2xl p-3">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined profile-section-icon rounded-xl p-2 text-[21px]"
          >
            {icon}
          </span>
          <h2 className="text-base font-black text-[var(--profile-text)]">
            {title}
          </h2>
        </div>
      {aside}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
);

const TextInput = ({ label, className = "", ...props }) => (
  <label className={`grid gap-1.5 ${className}`}>
    <span className="text-xs font-black uppercase text-slate-500">{label}</span>
    <input
      {...props}
      className="profile-input rounded-xl px-3.5 py-2.5 text-sm font-semibold"
    />
  </label>
);

const TextArea = ({ label, className = "", ...props }) => (
  <label className={`grid gap-1.5 ${className}`}>
    <span className="text-xs font-black uppercase text-slate-500">{label}</span>
    <textarea
      {...props}
      className="profile-input min-h-32 resize-y rounded-xl px-3.5 py-3 text-sm font-semibold leading-6"
    />
  </label>
);

const AvatarPreview = ({ profile, onPickAvatar, isUploading }) => {
  const avatarUrl = getAvatarUrl(profile?.avatar);

  return (
    <button
      type="button"
      onClick={onPickAvatar}
      disabled={isUploading}
      className="group relative size-28 shrink-0 overflow-hidden rounded-[1.75rem] border-4 border-white bg-[var(--profile-text)] text-white shadow-xl transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-70"
      title="Đổi avatar"
      aria-label="Đổi avatar"
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={profile?.fullName || "Avatar"}
          referrerPolicy={getAvatarReferrerPolicy(avatarUrl)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-4xl font-black">
          {getProfileInitial(profile)}
        </span>
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-slate-950/50 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
        <span className="material-symbols-outlined">
          {isUploading ? "progress_activity" : "photo_camera"}
        </span>
      </span>
    </button>
  );
};

const ProfilePage = () => {
  const { message } = App.useApp();
  const { user, updateCurrentUser } = useAuth();
  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const [profile, setProfile] = useState(user || null);
  const [form, setForm] = useState(() => toProfileForm(user || {}));
  const [interestDraft, setInterestDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState({ avatar: false, banner: false });

  const previewProfile = useMemo(
    () => ({
      ...(profile || {}),
      ...form,
      profileTheme: form.profileTheme,
    }),
    [form, profile],
  );
  const theme = form.profileTheme || defaultProfileTheme;
  const bannerUrl =
    theme.useBannerImage !== false ? getAvatarUrl(form.profileBannerUrl) : "";

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const setTheme = (nextTheme) => {
    setForm((current) => ({
      ...current,
      profileTheme: {
        ...current.profileTheme,
        ...nextTheme,
      },
    }));
  };

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getMyProfile()
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        setForm(toProfileForm(data));
        updateCurrentUser?.(data);
      })
      .catch((error) => {
        console.error("Failed to load profile:", error);
        if (!cancelled) message.error("Không thể tải hồ sơ cá nhân");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [message, updateCurrentUser]);

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const formData = new FormData();
    formData.append("avatar", file);
    setUploading((current) => ({ ...current, avatar: true }));
    try {
      const result = await updateMyAvatar(formData);
      const nextAvatar = result.avatarUrl || result.avatar || "";
      setProfile((current) => ({ ...(current || {}), avatar: nextAvatar }));
      updateCurrentUser?.({ avatar: nextAvatar });
      message.success("Đã cập nhật avatar");
    } catch (error) {
      console.error("Failed to update avatar:", error);
      message.error(error?.response?.data?.message || "Không thể cập nhật avatar");
    } finally {
      setUploading((current) => ({ ...current, avatar: false }));
    }
  };

  const handleBannerChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading((current) => ({ ...current, banner: true }));
    try {
      const result = await updateMyProfileBanner(file);
      const nextBanner = result.profileBannerUrl || result.bannerUrl || "";
      const nextTheme = result.profileTheme || {
        ...form.profileTheme,
        useBannerImage: true,
      };
      setField("profileBannerUrl", nextBanner);
      setTheme(nextTheme);
      setProfile((current) => ({
        ...(current || {}),
        profileBannerUrl: nextBanner,
        profileTheme: nextTheme,
      }));
      updateCurrentUser?.({
        profileBannerUrl: nextBanner,
        profileTheme: nextTheme,
      });
      message.success("Đã cập nhật ảnh biểu ngữ");
    } catch (error) {
      console.error("Failed to update profile banner:", error);
      message.error(
        error?.response?.data?.message || "Không thể cập nhật ảnh biểu ngữ",
      );
    } finally {
      setUploading((current) => ({ ...current, banner: false }));
    }
  };

  const handleRemoveBanner = async () => {
    setUploading((current) => ({ ...current, banner: true }));
    try {
      const result = await deleteMyProfileBanner();
      const nextTheme = result.profileTheme || {
        ...form.profileTheme,
        useBannerImage: false,
      };
      setField("profileBannerUrl", "");
      setTheme(nextTheme);
      setProfile((current) => ({
        ...(current || {}),
        profileBannerUrl: "",
        profileTheme: nextTheme,
      }));
      updateCurrentUser?.({ profileBannerUrl: "", profileTheme: nextTheme });
      message.success("Đã chuyển sang bảng màu profile");
    } catch (error) {
      console.error("Failed to remove profile banner:", error);
      message.error("Không thể gỡ ảnh biểu ngữ");
    } finally {
      setUploading((current) => ({ ...current, banner: false }));
    }
  };

  const handleAddInterest = () => {
    const value = interestDraft.trim().replace(/\s+/g, " ");
    if (!value) return;
    setForm((current) => ({
      ...current,
      interests: [...new Set([...current.interests, value])].slice(0, 20),
    }));
    setInterestDraft("");
  };

  const handleInterestKeyDown = (event) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      handleAddInterest();
    }
  };

  const updateLink = (index, patch) => {
    setForm((current) => ({
      ...current,
      socialLinks: current.socialLinks.map((link, itemIndex) =>
        itemIndex === index ? { ...link, ...patch } : link,
      ),
    }));
  };

  const removeLink = (index) => {
    setForm((current) => ({
      ...current,
      socialLinks: current.socialLinks.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const saved = await updateMyProfile(toProfilePayload(form));
      setProfile(saved);
      setForm(toProfileForm(saved));
      updateCurrentUser?.(saved);
      message.success("Đã lưu hồ sơ cá nhân");
    } catch (error) {
      console.error("Failed to save profile:", error);
      message.error(error?.response?.data?.message || "Không thể lưu hồ sơ");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main
      className="profile-theme-frame profile-page-shell min-h-full"
      style={buildProfileAccentStyle(previewProfile)}
    >
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
        className="sr-only"
        onChange={handleAvatarChange}
      />
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
        className="sr-only"
        onChange={handleBannerChange}
      />

      <form onSubmit={handleSave} className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="profile-hero-card overflow-hidden rounded-[1.75rem] backdrop-blur">
          <div
            className="profile-banner-surface relative h-56 overflow-hidden"
            style={buildProfileBannerStyle(previewProfile)}
          >
            {bannerUrl && (
              <img
                src={bannerUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/45 via-slate-950/5 to-transparent" />
            <div className="absolute right-4 top-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                disabled={uploading.banner}
                className="profile-secondary-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black backdrop-blur disabled:translate-y-0 disabled:opacity-70"
              >
                <span className="material-symbols-outlined text-[19px]">
                  {uploading.banner ? "progress_activity" : "wallpaper"}
                </span>
                Ảnh biểu ngữ
              </button>
              {form.profileBannerUrl && (
                <button
                  type="button"
                  onClick={handleRemoveBanner}
                  disabled={uploading.banner}
                  className="profile-danger-soft-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black shadow-lg shadow-rose-900/10 backdrop-blur disabled:translate-y-0 disabled:opacity-70"
                >
                  <span className="material-symbols-outlined text-[19px]">
                    palette
                  </span>
                  Dùng bảng màu
                </button>
              )}
            </div>
          </div>

          <div className="-mt-14 flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
              <AvatarPreview
                profile={previewProfile}
                isUploading={uploading.avatar}
                onPickAvatar={() => avatarInputRef.current?.click()}
              />
              <div className="min-w-0 pb-1">
                <p className="text-sm font-black uppercase text-[var(--profile-accent)]">
                  Hồ sơ cá nhân
                </p>
                <h1 className="mt-1 truncate text-3xl font-black text-slate-950">
                  {form.fullName || user?.fullName || "Người dùng WorkHub"}
                </h1>
                <p className="mt-1 line-clamp-2 text-sm font-bold text-slate-500">
                  {form.bio || form.position || user?.email}
                </p>
              </div>
            </div>
            <button
              type="submit"
              disabled={isSaving || isLoading}
              className="profile-primary-button inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition disabled:translate-y-0 disabled:bg-stone-300 disabled:shadow-none"
            >
              <span className="material-symbols-outlined text-[20px]">
                {isSaving ? "progress_activity" : "save"}
              </span>
              {isSaving ? "Đang lưu..." : "Lưu hồ sơ"}
            </button>
          </div>
        </header>

        <Section title="Nhận diện" icon="person" tone="identity">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput
              label="Tên hiển thị"
              value={form.fullName}
              maxLength={50}
              onChange={(event) => setField("fullName", event.target.value)}
              required
            />
            <TextInput
              label="Danh xưng"
              value={form.pronouns}
              maxLength={80}
              placeholder="he/him, she/her, họ/tên..."
              onChange={(event) => setField("pronouns", event.target.value)}
            />
            <TextInput
              label="Vị trí"
              value={form.position}
              maxLength={120}
              placeholder="Frontend Developer, Product Owner..."
              onChange={(event) => setField("position", event.target.value)}
            />
            <TextInput
              label="Tiểu sử ngắn"
              value={form.bio}
              maxLength={160}
              placeholder="Một dòng nổi bật trên hồ sơ"
              onChange={(event) => setField("bio", event.target.value)}
            />
          </div>
        </Section>

        <Section title="Giới thiệu" icon="notes" tone="story">
          <TextArea
            label="Mô tả / giới thiệu"
            value={form.about}
            maxLength={1500}
            placeholder="Chia sẻ cách bạn làm việc, lĩnh vực quan tâm hoặc điều người khác nên biết khi cộng tác."
            onChange={(event) => setField("about", event.target.value)}
          />
        </Section>

        <Section title="Thông tin cá nhân" icon="badge" tone="personal">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput
              label="Địa điểm"
              value={form.location}
              maxLength={120}
              placeholder="Hà Nội, Remote..."
              onChange={(event) => setField("location", event.target.value)}
            />
            <TextInput
              label="Sinh nhật"
              type="date"
              value={form.birthday}
              onChange={(event) => setField("birthday", event.target.value)}
            />
            <TextInput
              label="Trình độ học vấn"
              value={form.education}
              maxLength={300}
              placeholder="Đại học, chứng chỉ, chuyên ngành..."
              onChange={(event) => setField("education", event.target.value)}
            />
            <TextInput
              label="Số điện thoại"
              value={form.phone}
              maxLength={30}
              inputMode="tel"
              onChange={(event) => setField("phone", event.target.value)}
            />
          </div>
        </Section>

        <Section title="Sở thích" icon="interests" tone="interests">
          <div className="grid gap-3">
            <div className="flex gap-2">
              <input
                value={interestDraft}
                maxLength={60}
                onChange={(event) => setInterestDraft(event.target.value)}
                onKeyDown={handleInterestKeyDown}
                className="profile-input min-w-0 flex-1 rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                placeholder="Thiết kế, AI, đọc sách..."
              />
              <button
                type="button"
                onClick={handleAddInterest}
                className="profile-primary-button inline-flex size-11 shrink-0 items-center justify-center rounded-xl transition"
                title="Thêm sở thích"
                aria-label="Thêm sở thích"
              >
                <span className="material-symbols-outlined">add</span>
              </button>
            </div>
            <div className="flex min-h-12 flex-wrap gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3">
              {form.interests.length === 0 ? (
                <span className="text-sm font-bold text-slate-400">
                  Chưa có sở thích
                </span>
              ) : (
                form.interests.map((interest) => (
                  <span
                    key={interest}
                    className="profile-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black"
                  >
                    {interest}
                    <button
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          interests: current.interests.filter((item) => item !== interest),
                        }))
                      }
                      className="inline-flex size-5 items-center justify-center rounded-full hover:bg-white/70"
                      aria-label={`Xóa ${interest}`}
                    >
                      <span className="material-symbols-outlined text-[15px]">
                        close
                      </span>
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        </Section>

        <Section title="Liên kết" icon="link" tone="links">
          <div className="grid gap-3">
            {form.socialLinks.map((link, index) => (
              <div
                key={`${index}-${link.url}`}
                className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[9rem_1fr_1.2fr_auto]"
              >
                <label className="grid gap-1.5">
                  <span className="text-xs font-black uppercase text-slate-500">
                    Loại
                  </span>
                  <select
                    value={link.type}
                    onChange={(event) => updateLink(index, { type: event.target.value })}
                    className="profile-input rounded-xl px-3 py-2.5 text-sm font-bold"
                  >
                    {profileLinkTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>
                <TextInput
                  label="Tên hiển thị"
                  value={link.label}
                  maxLength={80}
                  onChange={(event) => updateLink(index, { label: event.target.value })}
                />
                <TextInput
                  label="URL"
                  value={link.url}
                  type="url"
                  placeholder="https://..."
                  onChange={(event) => updateLink(index, { url: event.target.value })}
                />
                <button
                  type="button"
                  onClick={() => removeLink(index)}
                  className="inline-flex h-11 items-center justify-center self-end rounded-xl bg-red-50 px-3 text-red-600 transition hover:bg-red-100"
                  title="Xóa liên kết"
                  aria-label="Xóa liên kết"
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  socialLinks: [...current.socialLinks, emptyLink].slice(0, 10),
                }))
              }
              disabled={form.socialLinks.length >= 10}
              className="profile-primary-button inline-flex w-fit items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition disabled:translate-y-0 disabled:bg-stone-300"
            >
              <span className="material-symbols-outlined text-[19px]">add_link</span>
              Thêm liên kết
            </button>
          </div>
        </Section>

        <Section title="Giao diện profile" icon="palette" tone="theme">
          <div className="grid gap-4">
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span>
                <span className="block text-sm font-black text-slate-950">
                  Hiển thị ảnh biểu ngữ
                </span>
                <span className="block text-xs font-semibold text-slate-500">
                  Tắt để dùng bảng màu đã chọn
                </span>
              </span>
              <input
                type="checkbox"
                checked={theme.useBannerImage !== false}
                onChange={(event) =>
                  setTheme({ useBannerImage: event.target.checked })
                }
                className="h-5 w-5"
                style={{ accentColor: "var(--profile-accent)" }}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {profileThemePresets.map((preset) => {
                const active = theme.preset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      setTheme({
                        ...preset,
                        preset: preset.id,
                        useBannerImage: false,
                      })
                    }
                    className={`profile-theme-option rounded-2xl p-3 text-left ${
                      active ? "is-active" : ""
                    }`}
                  >
                    <span
                      className="mb-3 block h-14 rounded-xl"
                      style={{
                        background: `linear-gradient(135deg, ${preset.backgroundColor}, ${preset.accentColor})`,
                      }}
                    />
                    <span className="block text-sm font-black text-slate-900">
                      {preset.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </Section>
      </form>
    </main>
  );
};

export default ProfilePage;
