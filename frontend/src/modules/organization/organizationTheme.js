export const DEFAULT_ORGANIZATION_ACCENT = "#2563eb";

export const organizationAccentPresets = [
  { label: "Xanh biển", value: "#1d4ed8" },
  { label: "Chàm", value: "#4338ca" },
  { label: "Tím nho", value: "#7e22ce" },
  { label: "Hồng mận", value: "#be185d" },
  { label: "Đỏ son", value: "#dc2626" },
  { label: "Cam đất", value: "#c2410c" },
  { label: "Hổ phách", value: "#b45309" },
  { label: "Rêu", value: "#4d7c0f" },
  { label: "Ngọc lục", value: "#047857" },
  { label: "Teal", value: "#0f766e" },
  { label: "Cyan sâu", value: "#0e7490" },
  { label: "Xanh trời", value: "#0369a1" },
  { label: "Slate", value: "#475569" },
  { label: "Kẽm", value: "#52525b" },
  { label: "Đá đen", value: "#334155" },
];

export const normalizeAccentColor = (
  value,
  fallback = DEFAULT_ORGANIZATION_ACCENT,
) => {
  const raw = String(value || "").trim();
  const match = raw.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!match) return fallback;

  let hex = match[1].toLowerCase();
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => `${char}${char}`)
      .join("");
  }

  return `#${hex}`;
};

const hexToRgb = (hexColor) => {
  const normalized = normalizeAccentColor(hexColor).replace("#", "");
  const value = Number.parseInt(normalized, 16);

  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
};

const toCssImage = (url) => {
  const safeUrl = String(url || "").replaceAll('"', "%22");
  return safeUrl ? `url("${safeUrl}")` : "none";
};

export const getOrganizationAccentColor = (organization) =>
  normalizeAccentColor(organization?.accentColor);

export const getOrganizationThemeStyle = (organization, bannerUrl = "") => {
  const accentColor = getOrganizationAccentColor(organization);

  return {
    "--organization-accent": accentColor,
    "--organization-accent-rgb": hexToRgb(accentColor),
    "--organization-banner-image": toCssImage(bannerUrl),
  };
};
