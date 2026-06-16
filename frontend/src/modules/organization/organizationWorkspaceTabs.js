export const workspaceTabs = [
  {
    id: "overview",
    label: "Tổng quan",
    icon: "dashboard",
    managerOnly: true,
    permission: "viewOverview",
  },
  {
    id: "members",
    label: "Thành viên",
    icon: "groups",
    permission: "viewMembers",
  },
  {
    id: "roles",
    label: "Vai trò",
    icon: "admin_panel_settings",
    managerOnly: true,
    permission: "manageRoles",
  },
  {
    id: "invites",
    label: "Lời mời",
    icon: "mark_email_unread",
    permission: "createInvites",
  },
  {
    id: "advanced",
    label: "Nâng cao",
    icon: "tune",
  },
];

const fallbackTabIds = new Set(["members", "invites", "advanced"]);

const hasTabPermission = (organization, permissionKey) =>
  Boolean(organization?.permissions?.[permissionKey]);

export const getAvailableWorkspaceTabs = (
  organization,
  { canManage = false } = {},
) => {
  const tabs = workspaceTabs.filter((tab) => {
    if (tab.permission) {
      if (tab.id === "invites" && !canManage) return true;
      return hasTabPermission(organization, tab.permission);
    }

    if (tab.managerOnly && !canManage) return false;
    return true;
  });

  return tabs.length
    ? tabs
    : workspaceTabs.filter((tab) => fallbackTabIds.has(tab.id));
};
