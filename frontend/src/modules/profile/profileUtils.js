export const profileThemePresets = [
  {
    id: "aurora",
    label: "Aurora",
    accentColor: "#0f766e",
    backgroundColor: "#ccfbf1",
    textColor: "#134e4a",
  },
  {
    id: "ember",
    label: "Ember",
    accentColor: "#c2410c",
    backgroundColor: "#ffedd5",
    textColor: "#7c2d12",
  },
  {
    id: "orchid",
    label: "Orchid",
    accentColor: "#a21caf",
    backgroundColor: "#fae8ff",
    textColor: "#581c87",
  },
  {
    id: "meadow",
    label: "Meadow",
    accentColor: "#4d7c0f",
    backgroundColor: "#ecfccb",
    textColor: "#365314",
  },
  {
    id: "rosewood",
    label: "Rosewood",
    accentColor: "#be123c",
    backgroundColor: "#ffe4e6",
    textColor: "#881337",
  },
  {
    id: "lagoon",
    label: "Lagoon",
    accentColor: "#0891b2",
    backgroundColor: "#cffafe",
    textColor: "#164e63",
  },
  {
    id: "glacier",
    label: "Glacier",
    accentColor: "#2563eb",
    backgroundColor: "#dbeafe",
    textColor: "#1e3a8a",
  },
  {
    id: "indigo",
    label: "Indigo",
    accentColor: "#4f46e5",
    backgroundColor: "#e0e7ff",
    textColor: "#312e81",
  },
  {
    id: "plum",
    label: "Plum",
    accentColor: "#7c3aed",
    backgroundColor: "#ede9fe",
    textColor: "#4c1d95",
  },
  {
    id: "mulberry",
    label: "Mulberry",
    accentColor: "#be185d",
    backgroundColor: "#fce7f3",
    textColor: "#831843",
  },
  {
    id: "coral",
    label: "Coral",
    accentColor: "#e11d48",
    backgroundColor: "#ffe4e6",
    textColor: "#881337",
  },
  {
    id: "terracotta",
    label: "Terracotta",
    accentColor: "#b45309",
    backgroundColor: "#fef3c7",
    textColor: "#78350f",
  },
  {
    id: "copper",
    label: "Copper",
    accentColor: "#a16207",
    backgroundColor: "#fef9c3",
    textColor: "#713f12",
  },
  {
    id: "forest",
    label: "Forest",
    accentColor: "#15803d",
    backgroundColor: "#dcfce7",
    textColor: "#14532d",
  },
  {
    id: "slate",
    label: "Slate",
    accentColor: "#475569",
    backgroundColor: "#e2e8f0",
    textColor: "#1e293b",
  },
];

export const defaultProfileTheme = {
  useBannerImage: true,
  preset: "aurora",
  accentColor: "#0f766e",
  backgroundColor: "#ccfbf1",
  textColor: "#134e4a",
};

const toProfileObject = (profile) =>
  profile && typeof profile === "object" ? profile : {};

export const getProfileTheme = (profile = {}) => {
  const safeProfile = toProfileObject(profile);
  return {
    ...defaultProfileTheme,
    ...(safeProfile.profileTheme || {}),
  };
};

export const getProfileId = (profile = {}) =>
  String(profile?._id || profile?.id || profile?.userId || "");

export const getProfileInitial = (profile = {}) => {
  const safeProfile = toProfileObject(profile);
  return (safeProfile.fullName || safeProfile.email || "?")
    .charAt(0)
    .toUpperCase();
};

export const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export const formatBirthday = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export const getHostLabel = (url = "") => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export const getLinkIcon = (type = "other") => {
  if (type === "blog") return "article";
  if (type === "portfolio") return "work";
  if (type === "social") return "alternate_email";
  if (type === "app") return "apps";
  if (type === "website") return "language";
  return "link";
};

export const buildProfileBannerStyle = (profile = {}) => {
  const theme = getProfileTheme(profile);
  return {
    color: "var(--profile-text)",
    background: `
      linear-gradient(180deg, rgba(255, 255, 255, 0.74), transparent 38%),
      linear-gradient(135deg, color-mix(in srgb, var(--profile-bg) 88%, #ffffff) 0%, color-mix(in srgb, var(--profile-accent) 30%, var(--profile-bg)) 58%, color-mix(in srgb, var(--profile-bg) 76%, #ffffff) 100%)
    `,
    "--profile-accent": theme.accentColor,
    "--profile-bg": theme.backgroundColor,
    "--profile-text": theme.textColor,
  };
};

export const buildProfileAccentStyle = (profile = {}) => {
  const theme = getProfileTheme(profile);
  return {
    "--profile-accent": theme.accentColor,
    "--profile-bg": theme.backgroundColor,
    "--profile-text": theme.textColor,
    "--profile-accent-muted": `color-mix(in srgb, ${theme.accentColor} 14%, #ffffff)`,
    "--profile-accent-soft": `color-mix(in srgb, ${theme.accentColor} 9%, #ffffff)`,
    "--profile-accent-ring": `color-mix(in srgb, ${theme.accentColor} 34%, #ffffff)`,
  };
};

export const profileLinkTypes = [
  { value: "website", label: "Website" },
  { value: "blog", label: "Blog" },
  { value: "portfolio", label: "Portfolio" },
  { value: "social", label: "Mạng xã hội" },
  { value: "app", label: "Ứng dụng" },
  { value: "other", label: "Khác" },
];
