export const EMPTY_ARRAY = [];

export const permissionLabels = {
  viewOverview: "Xem tổng quan",
  viewMembers: "Xem thành viên",
  manageOrganization: "Người quản lý",
  manageMembers: "Quản lý thành viên",
  manageRoles: "Quản lý vai trò",
  manageInvites: "Quản lý lời mời",
  manageSettings: "Cài đặt nâng cao",
  createInvites: "Tạo lời mời",
  pauseInvites: "Tạm dừng lời mời",
  viewDocumentInsights: "Xem thống kê tài liệu",
  manageDocuments: "Quản lý mọi tài liệu",
  manageDocumentFolders: "Quản lý thư mục tài liệu",
  shareDocuments: "Tạo liên kết chia sẻ tài liệu",
  viewAssignedTasks: "Xem việc được giao",
  viewOrganizationTasks: "Xem mọi việc tổ chức",
  createTasks: "Tạo công việc",
  manageTasks: "Quản lý công việc",
  assignTasks: "Giao việc",
  deleteTasks: "Xóa công việc",
  viewTaskInsights: "Xem thống kê công việc",
};

export const permissionDescriptions = {
  viewOverview: "Cho phép mở tab Tổng quan và xem các chỉ số hoạt động của tổ chức.",
  viewMembers: "Cho phép xem danh sách thành viên, trạng thái và vai trò hiện tại.",
  manageOrganization:
    "Gần như có toàn quyền trong tổ chức như chủ sở hữu, ngoại trừ các thao tác bắt buộc chỉ chủ sở hữu mới được làm.",
  manageMembers:
    "Cho phép duyệt, cập nhật và điều phối thành viên trong phạm vi role thấp hơn role cao nhất của họ.",
  manageRoles:
    "Cho phép tạo role mới, chỉnh sửa, xóa hoặc sắp xếp các role nằm bên dưới role cao nhất của họ.",
  manageInvites: "Cho phép xem, chỉnh sửa và thu hồi các lời mời trong tổ chức.",
  manageSettings: "Cho phép thay đổi cài đặt tham gia, role mặc định và quy tắc tổ chức.",
  createInvites: "Cho phép tự tạo mã mời hoặc liên kết mời thành viên mới.",
  pauseInvites: "Cho phép tạm dừng lời mời đang hoạt động trong một khoảng thời gian.",
  viewDocumentInsights: "Cho phép xem thống kê và tín hiệu hoạt động của tài liệu.",
  manageDocuments: "Cho phép quản trị mọi tài liệu trong không gian tổ chức.",
  manageDocumentFolders: "Cho phép tạo, sửa, di chuyển và quản lý thư mục tài liệu.",
  shareDocuments: "Cho phép tạo liên kết chia sẻ tài liệu cho người khác.",
  viewAssignedTasks:
    "Cho phép mở trang công việc và xem các task do chính họ tạo, sở hữu hoặc được giao.",
  viewOrganizationTasks: "Cho phép xem toàn bộ task trong tổ chức đang hoạt động.",
  createTasks: "Cho phép tạo task mới trong bảng công việc của tổ chức.",
  manageTasks: "Cho phép chỉnh sửa nội dung, ưu tiên, hạn và trạng thái của mọi task.",
  assignTasks: "Cho phép giao hoặc gỡ người phụ trách task cho các thành viên trong tổ chức.",
  deleteTasks: "Cho phép xóa task trong tổ chức.",
  viewTaskInsights: "Cho phép xem số liệu, phân bổ trạng thái, ưu tiên và tải việc nhóm.",
};

export const permissionSections = [
  {
    id: "general",
    title: "Quyền tổng quát tổ chức",
    description: "Các quyền mở tab và vận hành cấp tổ chức.",
    icon: "domain",
    keys: ["viewOverview", "manageRoles", "manageSettings"],
  },
  {
    id: "members",
    title: "Quyền thành viên",
    description: "Kiểm soát khả năng xem và điều phối thành viên.",
    icon: "groups",
    keys: ["viewMembers", "manageMembers"],
  },
  {
    id: "invites",
    title: "Quyền lời mời",
    description: "Quản lý cách thành viên mới được mời vào tổ chức.",
    icon: "mark_email_unread",
    keys: ["createInvites", "manageInvites", "pauseInvites"],
  },
  {
    id: "documents",
    title: "Quyền tài liệu",
    description: "Các quyền liên quan đến tài liệu và thư mục dùng chung.",
    icon: "folder_managed",
    keys: [
      "viewDocumentInsights",
      "manageDocuments",
      "manageDocumentFolders",
      "shareDocuments",
    ],
  },
  {
    id: "tasks",
    title: "Quản lý quyền công việc",
    description: "Điều khiển quyền xem board, tạo, giao việc và xem thống kê task.",
    icon: "task_alt",
    keys: [
      "viewAssignedTasks",
      "viewOrganizationTasks",
      "createTasks",
      "manageTasks",
      "assignTasks",
      "deleteTasks",
      "viewTaskInsights",
    ],
  },
  {
    id: "advanced",
    title: "Quyền nâng cao",
    description: "Quyền quản lý rộng, chỉ nên cấp cho người thật sự tin cậy.",
    icon: "admin_panel_settings",
    keys: ["manageOrganization"],
  },
];

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
  Boolean(organization?.permissions?.manageOrganization);

export const hasPermission = (organization, permissionKey) =>
  Boolean(organization?.permissions?.[permissionKey]);

export const canBypassInviteApproval = (organization) =>
  hasPermission(organization, "manageInvites") ||
  hasPermission(organization, "manageMembers") ||
  hasPermission(organization, "manageSettings");

export const buildShareableInviteLink = (invite) => {
  const rawLink =
    invite?.inviteLink ||
    (invite?.code ? `/organization/join/${invite.code}` : "");
  if (!rawLink) return "";
  if (/^https?:\/\//i.test(rawLink)) return rawLink;

  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "";
  if (!origin) return rawLink;

  try {
    return new URL(rawLink, origin).toString();
  } catch {
    return `${origin}${rawLink.startsWith("/") ? "" : "/"}${rawLink}`;
  }
};

export const copyTextToClipboard = async (text) => {
  const value = String(text || "");
  if (!value) throw new Error("Nothing to copy");

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();

  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textArea);
  }
};

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
