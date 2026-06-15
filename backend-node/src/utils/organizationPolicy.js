export const ORGANIZATION_ROLES = ["owner", "admin", "member"];

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
];

export const DEFAULT_ORGANIZATION_ACCENT_COLOR = "#2563eb";

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

export const DEFAULT_ORGANIZATION_ROLES = [
  {
    key: "owner",
    name: "Chủ sở hữu",
    description: "Toàn quyền quản trị tổ chức, thành viên, vai trò và lời mời.",
    color: "#0f172a",
    sortOrder: 1,
    isSystem: true,
    permissions: {
      viewOverview: true,
      viewMembers: true,
      manageOrganization: true,
      manageMembers: true,
      manageRoles: true,
      manageInvites: true,
      manageSettings: true,
      createInvites: true,
      pauseInvites: true,
    },
  },
  {
    key: "admin",
    name: "Quản trị",
    description: "Có thể điều phối thành viên, lời mời và cài đặt vận hành.",
    color: "#2563eb",
    sortOrder: 2,
    isSystem: true,
    permissions: {
      viewOverview: true,
      viewMembers: true,
      manageOrganization: true,
      manageMembers: true,
      manageRoles: false,
      manageInvites: true,
      manageSettings: true,
      createInvites: true,
      pauseInvites: true,
    },
  },
  {
    key: "member",
    name: "Thành viên",
    description: "Có thể xem danh sách thành viên và tạo lời mời cá nhân.",
    color: "#64748b",
    sortOrder: 3,
    isSystem: true,
    isDefault: true,
    permissions: {
      viewOverview: false,
      viewMembers: true,
      manageOrganization: false,
      manageMembers: false,
      manageRoles: false,
      manageInvites: false,
      manageSettings: false,
      createInvites: true,
      pauseInvites: false,
    },
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

export const normalizeRolePermissions = (roleKey = "member", permissions = {}) => {
  const defaultRole =
    DEFAULT_ORGANIZATION_ROLES.find((role) => role.key === roleKey) ||
    DEFAULT_ORGANIZATION_ROLES.find((role) => role.key === "member");
  const merged = { ...(defaultRole?.permissions || {}) };

  ORGANIZATION_PERMISSION_KEYS.forEach((key) => {
    if (permissions?.[key] !== undefined) {
      merged[key] = Boolean(permissions[key]);
    }
  });

  return merged;
};

export const canManageOrganization = (membership) =>
  ["owner", "admin"].includes(membership?.role) ||
  Boolean(membership?.permissions?.manageOrganization);

export const hasOrganizationPermission = (membership, permissionKey) => {
  if (membership?.role === "owner") return true;
  if (!ORGANIZATION_PERMISSION_KEYS.includes(permissionKey)) return false;
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
