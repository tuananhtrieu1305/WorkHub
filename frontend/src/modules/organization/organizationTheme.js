export const DEFAULT_ORGANIZATION_ACCENT = "#2563eb";

export const organizationAccentPresets = [
  { label: "Xanh biển", value: "#2563eb" },
  { label: "Ngọc lục", value: "#059669" },
  { label: "Hổ phách", value: "#d97706" },
  { label: "San hô", value: "#e11d48" },
  { label: "Tím dịu", value: "#7c3aed" },
  { label: "Xanh cyan", value: "#0891b2" },
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
