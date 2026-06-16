export const ORGANIZATION_PERMISSION_KEYS = [
  "viewOverview",
  "viewMembers",
  "manageOrganization",
  "manageMembers",
  "manageRoles",
  "manageInvites",
  "manageSettings",
  "createInvites",
  "pauseInvites",
  "viewDocumentInsights",
  "manageDocuments",
  "manageDocumentFolders",
  "shareDocuments",
];

export const DEFAULT_ORGANIZATION_ACCENT_COLOR = "#2563eb";
export const DEFAULT_MEMBER_ROLE_KEY = "thanh-vien";
export const LEGACY_ORGANIZATION_ROLE_KEYS = ["owner", "admin", "member"];

export const normalizeOrganizationAccentColor = (
  value,
  fallback = DEFAULT_ORGANIZATION_ACCENT_COLOR,
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

export const OWNER_ORGANIZATION_PERMISSIONS = ORGANIZATION_PERMISSION_KEYS.reduce(
  (permissions, key) => ({
    ...permissions,
    [key]: true,
  }),
  {},
);

const MANAGER_ORGANIZATION_PERMISSIONS = ORGANIZATION_PERMISSION_KEYS.reduce(
  (permissions, key) => ({
    ...permissions,
    [key]: true,
  }),
  {},
);

const MEMBER_ORGANIZATION_PERMISSIONS = {
  viewOverview: false,
  viewMembers: true,
  manageOrganization: false,
  manageMembers: false,
  manageRoles: false,
  manageInvites: false,
  manageSettings: false,
  createInvites: true,
  pauseInvites: false,
  viewDocumentInsights: false,
  manageDocuments: false,
  manageDocumentFolders: false,
  shareDocuments: false,
};

export const DEFAULT_ORGANIZATION_ROLES = [
  {
    key: DEFAULT_MEMBER_ROLE_KEY,
    name: "Thành viên",
    description: "Có thể xem danh sách thành viên và tạo lời mời cá nhân.",
    color: "#64748b",
    sortOrder: 1,
    isSystem: false,
    isDefault: true,
    permissions: MEMBER_ORGANIZATION_PERMISSIONS,
  },
];

export const normalizeOrganizationName = (name) =>
  String(name || "").trim().replace(/\s+/g, " ").slice(0, 120);

export const createOrganizationSlug = (name, fallback = "organization") => {
  const base = normalizeOrganizationName(name)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return base || fallback;
};

export const normalizeInviteCode = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const parsedUrl = new URL(raw);
    const inviteParam = parsedUrl.searchParams.get("invite");
    if (inviteParam) return normalizeInviteCode(inviteParam);

    const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
    const joinIndex = pathParts.findIndex((part) => part === "join");
    if (joinIndex !== -1 && pathParts[joinIndex + 1]) {
      return normalizeInviteCode(pathParts[joinIndex + 1]);
    }

    return normalizeInviteCode(pathParts.at(-1) || "");
  } catch {
    return raw.replace(/^#+/, "").replace(/[^\w-]/g, "").slice(0, 80);
  }
};

export const normalizeRoleKey = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

export const normalizeRolePermissions = (
  roleKey = DEFAULT_MEMBER_ROLE_KEY,
  permissions = {},
) => {
  const normalizedRoleKey = normalizeRoleKey(roleKey) || DEFAULT_MEMBER_ROLE_KEY;
  const defaultRole =
    DEFAULT_ORGANIZATION_ROLES.find((role) => role.key === normalizedRoleKey) ||
    DEFAULT_ORGANIZATION_ROLES.find((role) => role.key === DEFAULT_MEMBER_ROLE_KEY);
  const merged = { ...(defaultRole?.permissions || {}) };

  ORGANIZATION_PERMISSION_KEYS.forEach((key) => {
    if (permissions?.[key] !== undefined) {
      merged[key] = Boolean(permissions[key]);
    }
  });

  return merged.manageOrganization
    ? { ...MANAGER_ORGANIZATION_PERMISSIONS, manageOrganization: true }
    : merged;
};

export const canManageOrganization = (membership) =>
  Boolean(membership?.isOwner || membership?.isOrganizationOwner) ||
  Boolean(membership?.permissions?.manageOrganization);

export const hasOrganizationPermission = (membership, permissionKey) => {
  if (membership?.isOwner || membership?.isOrganizationOwner) return true;
  if (!ORGANIZATION_PERMISSION_KEYS.includes(permissionKey)) return false;
  if (membership?.permissions?.manageOrganization) return true;
  return Boolean(membership?.permissions?.[permissionKey]);
};

export const hasOrganizationMembership = (memberships, organizationId) => {
  const targetId = String(organizationId || "");
  return (memberships || []).some(
    (membership) =>
      membership?.status === "active" &&
      String(membership.organizationId?._id || membership.organizationId) ===
        targetId,
  );
};
