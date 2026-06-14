export const ORGANIZATION_ROLES = ["owner", "admin", "member"];

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

export const canManageOrganization = (membership) =>
  ["owner", "admin"].includes(membership?.role);

export const hasOrganizationMembership = (memberships, organizationId) => {
  const targetId = String(organizationId || "");
  return (memberships || []).some(
    (membership) =>
      membership?.status === "active" &&
      String(membership.organizationId?._id || membership.organizationId) ===
        targetId,
  );
};
