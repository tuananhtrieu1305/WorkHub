export const EMPTY_ARRAY = [];

export const roleLabels = {
  owner: "Chủ sở hữu",
  admin: "Quản trị",
  member: "Thành viên",
};

export const permissionLabels = {
  viewOverview: "Xem tổng quan",
  viewMembers: "Xem thành viên",
  manageOrganization: "Quản lý tổ chức",
  manageMembers: "Quản lý thành viên",
  manageRoles: "Quản lý vai trò",
  manageInvites: "Quản lý lời mời",
  manageSettings: "Cài đặt nâng cao",
  createInvites: "Tạo lời mời",
  pauseInvites: "Tạm dừng lời mời",
};

export const notificationOptions = [
  ["inAppEnabled", "Thông báo trong app", "notifications"],
  ["emailEnabled", "Email", "alternate_email"],
  ["pushEnabled", "Push", "notifications_active"],
  ["taskAssigned", "Giao việc", "assignment_ind"],
  ["taskUpdated", "Cập nhật công việc", "task_alt"],
  ["taskDueSoon", "Sắp đến hạn", "schedule"],
  ["documentShared", "Chia sẻ tài liệu", "folder_shared"],
  ["documentVersionAdded", "Phiên bản tài liệu", "history"],
  ["adminActions", "Hoạt động quản trị", "admin_panel_settings"],
];

export const normalizeInviteValue = (value) => String(value || "").trim();

export const getOrganizationId = (organization) =>
  organization?.id || organization?._id || "";

export const getInitials = (value = "") => {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "WH";

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
};

export const getStat = (organization, key) => {
  if (!organization) return 0;

  if (key === "members") {
    return organization.memberCount ?? organization.stats?.members ?? 0;
  }

  if (key === "online") {
    return organization.onlineCount ?? organization.stats?.online ?? 0;
  }

  if (key === "pending") {
    return organization.pendingCount ?? organization.stats?.pending ?? 0;
  }

  return 0;
};

export const isManager = (organization) =>
  Boolean(organization?.permissions?.manageOrganization) ||
  ["owner", "admin"].includes(organization?.role);

export const hasPermission = (organization, permissionKey) =>
  Boolean(organization?.permissions?.[permissionKey]) ||
  (organization?.role === "owner" && Boolean(permissionKey));

export const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";

  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};
