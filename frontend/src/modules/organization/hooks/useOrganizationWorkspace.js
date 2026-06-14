import { useCallback, useEffect, useMemo, useState } from "react";
import { App } from "antd";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  createOrganizationInvite,
  createOrganizationRole,
  deleteOrganizationRole,
  getOrganizationDetail,
  getOrganizationInvites,
  getOrganizationMembers,
  getOrganizationOverview,
  getOrganizationRoles,
  pauseOrganizationInvites,
  updateOrganizationInvite,
  updateOrganizationMember,
  updateOrganizationRole,
  updateOrganizationSettings,
} from "../../../api/organizationApi";
import { useAuth } from "../../../context/AuthContext";
import {
  EMPTY_ARRAY,
  getOrganizationId,
  hasPermission,
  isManager,
} from "../organizationUtils";

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

const defaultRoleForm = {
  id: "",
  key: "",
  name: "",
  description: "",
  color: "#2563eb",
  permissions: {},
};

const defaultInviteForm = {
  expiresIn: "7",
  maxUses: "",
  note: "",
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || fallback;

const buildInvitePayload = (form) => {
  const days = Number(form.expiresIn);
  const expiresAt =
    Number.isFinite(days) && days > 0
      ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      : null;

  return {
    expiresAt,
    maxUses: form.maxUses ? Number(form.maxUses) : null,
    note: form.note,
  };
};

export const useOrganizationWorkspace = () => {
  const { organizationId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { message } = App.useApp();
  const { user, refreshOrganizations, leaveOrganization } = useAuth();

  const [organization, setOrganization] = useState(null);
  const [isLoadingOrganization, setIsLoadingOrganization] = useState(true);
  const [overview, setOverview] = useState(null);
  const [members, setMembers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissionKeys, setPermissionKeys] = useState([]);
  const [invites, setInvites] = useState([]);
  const [memberFilters, setMemberFilters] = useState({
    search: "",
    status: "all",
    role: "",
  });
  const [loading, setLoading] = useState({
    overview: false,
    members: false,
    roles: false,
    invites: false,
    settings: false,
  });
  const [roleModal, setRoleModal] = useState(null);
  const [roleForm, setRoleForm] = useState(defaultRoleForm);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState(defaultInviteForm);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [pauseScope, setPauseScope] = useState("all");
  const [advancedForm, setAdvancedForm] = useState(null);
  const [leaving, setLeaving] = useState(false);

  const fallbackOrganization = useMemo(
    () =>
      (user?.organizations || EMPTY_ARRAY).find(
        (item) => getOrganizationId(item) === organizationId,
      ) || null,
    [organizationId, user?.organizations],
  );

  const activeOrganization = organization || fallbackOrganization;
  const activeTab = searchParams.get("tab") || "";
  const canManage = isManager(activeOrganization);

  const availableTabs = useMemo(() => {
    const tabs = workspaceTabs.filter((tab) => {
      if (tab.managerOnly && !canManage) return false;
      if (!tab.permission) return true;
      if (tab.id === "invites" && !canManage) return true;
      return hasPermission(activeOrganization, tab.permission);
    });

    return tabs.length
      ? tabs
      : workspaceTabs.filter((tab) => ["members", "invites", "advanced"].includes(tab.id));
  }, [activeOrganization, canManage]);

  const selectedTab = availableTabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : availableTabs[0]?.id || "members";

  const setTab = useCallback(
    (tabId) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set("tab", tabId);
        return next;
      });
    },
    [setSearchParams],
  );

  const refreshOrganization = useCallback(async () => {
    if (!organizationId) return null;

    setIsLoadingOrganization(true);
    try {
      const detail = await getOrganizationDetail(organizationId);
      setOrganization(detail);
      setAdvancedForm({
        requireApproval: detail.settings?.requireApproval !== false,
        allowMemberInvites: detail.settings?.allowMemberInvites !== false,
        memberDirectoryVisible: detail.settings?.memberDirectoryVisible !== false,
        defaultRoleKey: detail.settings?.defaultRoleKey || "member",
        joinMessage: detail.settings?.joinMessage || "",
      });
      return detail;
    } catch (error) {
      console.error("Failed to load organization detail:", error);
      message.error(getErrorMessage(error, "Không thể tải tổ chức"));
      navigate("/organization", { replace: true });
      return null;
    } finally {
      setIsLoadingOrganization(false);
    }
  }, [message, navigate, organizationId]);

  const loadOverview = useCallback(async () => {
    if (!organizationId || !hasPermission(activeOrganization, "viewOverview")) return;

    setLoading((current) => ({ ...current, overview: true }));
    try {
      setOverview(await getOrganizationOverview(organizationId));
    } catch (error) {
      console.error("Failed to load organization overview:", error);
      message.error(getErrorMessage(error, "Không thể tải tổng quan"));
    } finally {
      setLoading((current) => ({ ...current, overview: false }));
    }
  }, [activeOrganization, message, organizationId]);

  const loadMembers = useCallback(async () => {
    if (!organizationId) return;

    setLoading((current) => ({ ...current, members: true }));
    try {
      const payload = await getOrganizationMembers(organizationId, memberFilters);
      setMembers(payload.content || []);
    } catch (error) {
      console.error("Failed to load organization members:", error);
      message.error(getErrorMessage(error, "Không thể tải thành viên"));
      setMembers([]);
    } finally {
      setLoading((current) => ({ ...current, members: false }));
    }
  }, [memberFilters, message, organizationId]);

  const loadRoles = useCallback(async () => {
    if (!organizationId) return;

    setLoading((current) => ({ ...current, roles: true }));
    try {
      const payload = await getOrganizationRoles(organizationId);
      setRoles(payload.content || []);
      setPermissionKeys(payload.permissionKeys || []);
    } catch (error) {
      console.error("Failed to load organization roles:", error);
      message.error(getErrorMessage(error, "Không thể tải vai trò"));
      setRoles([]);
    } finally {
      setLoading((current) => ({ ...current, roles: false }));
    }
  }, [message, organizationId]);

  const loadInvites = useCallback(async () => {
    if (!organizationId) return;

    setLoading((current) => ({ ...current, invites: true }));
    try {
      const payload = await getOrganizationInvites(organizationId, {
        status: "all",
      });
      setInvites(payload.content || []);
    } catch (error) {
      console.error("Failed to load organization invites:", error);
      message.error(getErrorMessage(error, "Không thể tải lời mời"));
      setInvites([]);
    } finally {
      setLoading((current) => ({ ...current, invites: false }));
    }
  }, [message, organizationId]);

  const openRoleModal = useCallback((role = null) => {
    setRoleModal(role ? "edit" : "create");
    setRoleForm(
      role
        ? {
            id: role.id,
            key: role.key,
            name: role.name,
            description: role.description || "",
            color: role.color || "#2563eb",
            permissions: { ...(role.permissions || {}) },
          }
        : defaultRoleForm,
    );
  }, []);

  const closeRoleModal = useCallback(() => {
    setRoleModal(null);
    setRoleForm(defaultRoleForm);
  }, []);

  const saveRole = useCallback(
    async (event) => {
      event.preventDefault();
      if (!organizationId || !roleForm.name.trim()) return;

      try {
        if (roleModal === "edit" && roleForm.id) {
          await updateOrganizationRole(organizationId, roleForm.id, roleForm);
          message.success("Đã cập nhật vai trò");
        } else {
          await createOrganizationRole(organizationId, roleForm);
          message.success("Đã tạo vai trò");
        }
        closeRoleModal();
        loadRoles();
        refreshOrganization();
      } catch (error) {
        console.error("Failed to save organization role:", error);
        message.error(getErrorMessage(error, "Không thể lưu vai trò"));
      }
    },
    [
      closeRoleModal,
      loadRoles,
      message,
      organizationId,
      refreshOrganization,
      roleForm,
      roleModal,
    ],
  );

  const removeRole = useCallback(
    async (role) => {
      if (!organizationId || !role?.id || role.isSystem) return;

      try {
        await deleteOrganizationRole(organizationId, role.id);
        message.success("Đã xóa vai trò");
        loadRoles();
      } catch (error) {
        console.error("Failed to delete organization role:", error);
        message.error(getErrorMessage(error, "Không thể xóa vai trò"));
      }
    },
    [loadRoles, message, organizationId],
  );

  const changeMemberRole = useCallback(
    async (member, roleKey) => {
      if (!organizationId || !member?.id || !roleKey) return;

      try {
        await updateOrganizationMember(organizationId, member.id, { role: roleKey });
        message.success("Đã cập nhật vai trò thành viên");
        loadMembers();
      } catch (error) {
        console.error("Failed to update member role:", error);
        message.error(getErrorMessage(error, "Không thể cập nhật thành viên"));
      }
    },
    [loadMembers, message, organizationId],
  );

  const createInvite = useCallback(
    async (event) => {
      event.preventDefault();
      if (!organizationId) return;

      try {
        const invite = await createOrganizationInvite(
          organizationId,
          buildInvitePayload(inviteForm),
        );
        setInviteModalOpen(false);
        setInviteForm(defaultInviteForm);
        await navigator.clipboard?.writeText(invite.inviteLink);
        message.success("Đã tạo và sao chép liên kết mời");
        loadInvites();
        refreshOrganization();
      } catch (error) {
        console.error("Failed to create organization invite:", error);
        message.error(getErrorMessage(error, "Không thể tạo lời mời"));
      }
    },
    [inviteForm, loadInvites, message, organizationId, refreshOrganization],
  );

  const copyInvite = useCallback(
    async (invite) => {
      if (!invite?.inviteLink) return;

      try {
        await navigator.clipboard.writeText(invite.inviteLink);
        message.success("Đã sao chép liên kết mời");
      } catch {
        message.error("Không thể sao chép liên kết");
      }
    },
    [message],
  );

  const setInviteStatus = useCallback(
    async (invite, status) => {
      if (!organizationId || !invite?.id) return;

      try {
        await updateOrganizationInvite(organizationId, invite.id, { status });
        message.success(status === "paused" ? "Đã tạm dừng lời mời" : "Đã cập nhật lời mời");
        loadInvites();
      } catch (error) {
        console.error("Failed to update invite:", error);
        message.error(getErrorMessage(error, "Không thể cập nhật lời mời"));
      }
    },
    [loadInvites, message, organizationId],
  );

  const pauseInvites = useCallback(
    async (event) => {
      event.preventDefault();
      if (!organizationId) return;

      try {
        const result = await pauseOrganizationInvites(organizationId, {
          scope: pauseScope,
        });
        setPauseModalOpen(false);
        message.success(`Đã tạm dừng ${result.pausedCount || 0} lời mời`);
        loadInvites();
        refreshOrganization();
      } catch (error) {
        console.error("Failed to pause organization invites:", error);
        message.error(getErrorMessage(error, "Không thể tạm dừng lời mời"));
      }
    },
    [loadInvites, message, organizationId, pauseScope, refreshOrganization],
  );

  const saveSettings = useCallback(
    async (event) => {
      event.preventDefault();
      if (!organizationId || !advancedForm) return;

      setLoading((current) => ({ ...current, settings: true }));
      try {
        const saved = await updateOrganizationSettings(organizationId, advancedForm);
        setOrganization(saved);
        refreshOrganizations?.();
        message.success("Đã cập nhật cài đặt nâng cao");
      } catch (error) {
        console.error("Failed to update organization settings:", error);
        message.error(getErrorMessage(error, "Không thể lưu cài đặt"));
      } finally {
        setLoading((current) => ({ ...current, settings: false }));
      }
    },
    [advancedForm, message, organizationId, refreshOrganizations],
  );

  const leaveCurrentOrganization = useCallback(async () => {
    if (!organizationId || activeOrganization?.role === "owner" || leaving) return;

    setLeaving(true);
    try {
      await leaveOrganization(organizationId);
      message.success("Đã rời tổ chức");
      navigate("/organization", { replace: true });
    } catch (error) {
      console.error("Failed to leave organization:", error);
      message.error(getErrorMessage(error, "Không thể rời tổ chức"));
    } finally {
      setLeaving(false);
    }
  }, [
    activeOrganization?.role,
    leaving,
    leaveOrganization,
    message,
    navigate,
    organizationId,
  ]);

  useEffect(() => {
    refreshOrganization();
  }, [refreshOrganization]);

  useEffect(() => {
    if (!activeOrganization || activeTab) return;
    setTab(selectedTab);
  }, [activeOrganization, activeTab, selectedTab, setTab]);

  useEffect(() => {
    if (selectedTab === "overview") loadOverview();
  }, [loadOverview, selectedTab]);

  useEffect(() => {
    if (selectedTab === "members") loadMembers();
  }, [loadMembers, selectedTab]);

  useEffect(() => {
    if (selectedTab === "roles" || selectedTab === "members" || selectedTab === "advanced") {
      loadRoles();
    }
  }, [loadRoles, selectedTab]);

  useEffect(() => {
    if (selectedTab === "invites") loadInvites();
  }, [loadInvites, selectedTab]);

  return {
    state: {
      activeOrganization,
      advancedForm,
      availableTabs,
      canManage,
      inviteForm,
      inviteModalOpen,
      invites,
      isLoadingOrganization,
      leaving,
      loading,
      memberFilters,
      members,
      overview,
      pauseModalOpen,
      pauseScope,
      permissionKeys,
      roleForm,
      roleModal,
      roles,
      selectedTab,
    },
    actions: {
      changeMemberRole,
      closeRoleModal,
      copyInvite,
      createInvite,
      leaveCurrentOrganization,
      loadInvites,
      loadMembers,
      loadOverview,
      loadRoles,
      openRoleModal,
      pauseInvites,
      refreshOrganization,
      removeRole,
      saveRole,
      saveSettings,
      setAdvancedForm,
      setInviteForm,
      setInviteModalOpen,
      setInviteStatus,
      setMemberFilters,
      setPauseModalOpen,
      setPauseScope,
      setRoleForm,
      setTab,
    },
  };
};
