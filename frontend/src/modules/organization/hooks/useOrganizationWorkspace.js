import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  createOrganizationInvite,
  createOrganizationRole,
  deleteOrganizationInvite,
  deleteOrganizationRole,
  getOrganizationDetail,
  getOrganizationInvites,
  getOrganizationJoinRequests,
  getOrganizationMembers,
  getOrganizationOverview,
  getOrganizationRoles,
  pauseOrganizationInvites,
  reviewOrganizationJoinRequest,
  transferOrganizationOwnership,
  updateOrganizationInvite,
  updateOrganizationMember,
  updateOrganization,
  updateOrganizationRole,
  updateOrganizationSettings,
} from "../../../api/organizationApi";
import { useAuth } from "../../../context/AuthContext";
import {
  EMPTY_ARRAY,
  buildShareableInviteLink,
  canBypassInviteApproval,
  copyTextToClipboard,
  getOrganizationId,
  hasPermission,
  isManager,
} from "../organizationUtils";
import { DEFAULT_ORGANIZATION_ACCENT } from "../organizationTheme";
import { useWorkHubToast } from "../../../components/feedback/workHubToast";

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
  expiresIn: "7d",
  maxUses: "",
  bypassApproval: false,
};

const defaultJoinQuestion = (type = "short_text") => ({
  id: `question-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  type,
  label:
    type === "rules"
      ? "Vui lòng đọc và đồng ý với quy định tổ chức"
      : "Tại sao bạn muốn tham gia tổ chức của chúng tôi?",
  description: "",
  required: true,
  options:
    type === "multiple_choice"
      ? [
          { id: `option-${Date.now()}-1`, label: "Lựa chọn A" },
          { id: `option-${Date.now()}-2`, label: "Lựa chọn B" },
        ]
      : [],
});

const inviteExpiryDurations = {
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || fallback;

const getOrganizationName = (organization) =>
  organization?.name || "Tổ chức này";

const getMemberName = (member) =>
  member?.user?.fullName ||
  member?.user?.name ||
  member?.fullName ||
  member?.name ||
  "Thành viên";

const getInviteCode = (invite) => invite?.code || "Mã mời";

const buildInvitePayload = (form, { canBypassApproval = false } = {}) => {
  const duration = inviteExpiryDurations[form.expiresIn];
  const expiresAt =
    Number.isFinite(duration) && duration > 0
      ? new Date(Date.now() + duration).toISOString()
      : null;

  return {
    expiresAt,
    maxUses: form.maxUses ? Number(form.maxUses) : null,
    bypassApproval: canBypassApproval && Boolean(form.bypassApproval),
  };
};

export const useOrganizationWorkspace = () => {
  const { organizationId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const message = useWorkHubToast();
  const {
    user,
    refreshOrganizations,
    leaveOrganization,
    updateOrganizationBanner,
  } = useAuth();

  const [organization, setOrganization] = useState(null);
  const [isLoadingOrganization, setIsLoadingOrganization] = useState(true);
  const [overview, setOverview] = useState(null);
  const [members, setMembers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissionKeys, setPermissionKeys] = useState([]);
  const [invites, setInvites] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [joinRequestQuestions, setJoinRequestQuestions] = useState([]);
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
    joinRequests: false,
    settings: false,
    banner: false,
  });
  const [roleModal, setRoleModal] = useState(null);
  const [roleForm, setRoleForm] = useState(defaultRoleForm);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState(defaultInviteForm);
  const [createdInvite, setCreatedInvite] = useState(null);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [pauseScope, setPauseScope] = useState("all");
  const [pauseDurationHours, setPauseDurationHours] = useState("1");
  const [advancedForm, setAdvancedForm] = useState(null);
  const [joinPreviewOpen, setJoinPreviewOpen] = useState(false);
  const [selectedJoinRequest, setSelectedJoinRequest] = useState(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [isTransferringOwner, setIsTransferringOwner] = useState(false);
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
        accentColor: detail.accentColor || DEFAULT_ORGANIZATION_ACCENT,
        requireApproval: detail.settings?.requireApproval !== false,
        allowMemberInvites: detail.settings?.allowMemberInvites !== false,
        memberDirectoryVisible: detail.settings?.memberDirectoryVisible !== false,
        defaultRoleKey: detail.settings?.defaultRoleKey || "member",
        joinMessage: detail.settings?.joinMessage || "",
        joinQuestions:
          detail.settings?.joinQuestions?.length > 0
            ? detail.settings.joinQuestions
            : [defaultJoinQuestion("short_text")],
      });
      return detail;
    } catch (error) {
      console.error("Failed to load organization detail:", error);
      message.error(getErrorMessage(error, "Không thể tải tổ chức"), {
        description:
          "Trang quản trị chưa nhận được thông tin tổ chức. Bạn sẽ được đưa về danh sách tổ chức.",
      });
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
      message.error(getErrorMessage(error, "Không thể tải tổng quan"), {
        description:
          "Các chỉ số hoạt động của tổ chức chưa được tải cho tab Tổng quan.",
      });
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
      message.error(getErrorMessage(error, "Không thể tải thành viên"), {
        description:
          "Danh sách thành viên chưa được tải theo bộ lọc hiện tại.",
      });
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
      message.error(getErrorMessage(error, "Không thể tải vai trò"), {
        description:
          "Danh sách vai trò và quyền hạn chưa được tải cho tổ chức này.",
      });
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
      message.error(getErrorMessage(error, "Không thể tải lời mời"), {
        description:
          "Danh sách mã mời hiện tại chưa được tải trong tab Lời mời.",
      });
      setInvites([]);
    } finally {
      setLoading((current) => ({ ...current, invites: false }));
    }
  }, [message, organizationId]);

  const loadJoinRequests = useCallback(async () => {
    if (!organizationId || !hasPermission(activeOrganization, "manageMembers")) {
      setJoinRequests([]);
      setJoinRequestQuestions([]);
      return;
    }

    setLoading((current) => ({ ...current, joinRequests: true }));
    try {
      const payload = await getOrganizationJoinRequests(organizationId);
      setJoinRequests(payload.content || []);
      setJoinRequestQuestions(payload.joinQuestions || []);
    } catch (error) {
      console.error("Failed to load organization join requests:", error);
      message.error(getErrorMessage(error, "Không thể tải yêu cầu tham gia"), {
        description:
          "Danh sách người đang chờ duyệt chưa được tải cho tổ chức này.",
      });
      setJoinRequests([]);
      setJoinRequestQuestions([]);
    } finally {
      setLoading((current) => ({ ...current, joinRequests: false }));
    }
  }, [activeOrganization, message, organizationId]);

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

  const openInviteModal = useCallback(() => {
    setInviteForm(defaultInviteForm);
    setCreatedInvite(null);
    setInviteModalOpen(true);
  }, []);

  const closeInviteModal = useCallback(() => {
    setInviteModalOpen(false);
    setInviteForm(defaultInviteForm);
    setCreatedInvite(null);
  }, []);

  const changeInviteForm = useCallback((nextForm) => {
    setInviteForm(nextForm);
    setCreatedInvite(null);
  }, []);

  const saveRole = useCallback(
    async (event) => {
      event.preventDefault();
      if (!organizationId || !roleForm.name.trim()) return;

      try {
        if (roleModal === "edit" && roleForm.id) {
          await updateOrganizationRole(organizationId, roleForm.id, roleForm);
          message.success("Đã cập nhật vai trò", {
            description: `${roleForm.name.trim()} đã lưu tên, màu hoặc bộ quyền mới.`,
          });
        } else {
          await createOrganizationRole(organizationId, roleForm);
          message.success("Đã tạo vai trò", {
            description: `${roleForm.name.trim()} đã sẵn sàng để gán cho thành viên.`,
          });
        }
        closeRoleModal();
        loadRoles();
        refreshOrganization();
      } catch (error) {
        console.error("Failed to save organization role:", error);
        message.error(getErrorMessage(error, "Không thể lưu vai trò"), {
          description:
            "Vai trò chưa được lưu. Hãy kiểm tra tên vai trò và bộ quyền đã chọn.",
        });
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
        message.success("Đã xóa vai trò", {
          description: `${role.name || "Vai trò này"} đã được gỡ khỏi danh sách vai trò tùy chỉnh.`,
        });
        loadRoles();
      } catch (error) {
        console.error("Failed to delete organization role:", error);
        message.error(getErrorMessage(error, "Không thể xóa vai trò"), {
          description:
            "Vai trò vẫn còn trong tổ chức. Hãy kiểm tra thành viên đang dùng vai trò này.",
        });
      }
    },
    [loadRoles, message, organizationId],
  );

  const changeMemberRole = useCallback(
    async (member, roleKey) => {
      if (!organizationId || !member?.id || !roleKey) return;

      try {
        await updateOrganizationMember(organizationId, member.id, { role: roleKey });
        message.success("Đã cập nhật vai trò thành viên", {
          description: `${getMemberName(member)} đã được gán vai trò ${roleKey}.`,
        });
        loadMembers();
      } catch (error) {
        console.error("Failed to update member role:", error);
        message.error(getErrorMessage(error, "Không thể cập nhật thành viên"), {
          description:
            "Vai trò của thành viên chưa được thay đổi. Hãy kiểm tra quyền quản trị của bạn.",
        });
      }
    },
    [loadMembers, message, organizationId],
  );

  const createInviteForCurrentForm = useCallback(async () => {
    if (createdInvite?.code) return createdInvite;
    if (!organizationId || isCreatingInvite) return null;

    setIsCreatingInvite(true);
    try {
      const invite = await createOrganizationInvite(
        organizationId,
        buildInvitePayload(inviteForm, {
          canBypassApproval: canBypassInviteApproval(activeOrganization),
        }),
      );
      setCreatedInvite(invite);
      loadInvites();
      refreshOrganization();
      return invite;
    } finally {
      setIsCreatingInvite(false);
    }
  }, [
    activeOrganization,
    createdInvite,
    inviteForm,
    isCreatingInvite,
    loadInvites,
    organizationId,
    refreshOrganization,
  ]);

  const copyInviteCodeFromModal = useCallback(async () => {
    try {
      if (!createdInvite?.code) {
        const invite = await createInviteForCurrentForm();
        if (!invite?.code) return;

        message.success("Đã tạo mã mời", {
          description: message.body({
            text: "Mã mời mới đã được tạo cho tổ chức này.",
            rows: [{ label: "Mã mời", value: invite.code }],
          }),
          action: {
            label: "Sao chép mã",
            onClick: () => copyTextToClipboard(invite.code),
            successLabel: "Đã sao chép",
          },
        });
        return;
      }

      await copyTextToClipboard(createdInvite.code);
      message.copySuccess("Đã sao chép mã mời", createdInvite.code, {
        label: "Mã mời",
        text: "Mã mời đã nằm trong clipboard để gửi cho thành viên mới.",
      });
    } catch (error) {
      console.error("Failed to copy organization invite code:", error);
      message.error(
        error?.response
          ? getErrorMessage(error, "Không thể tạo lời mời")
          : "Không thể sao chép mã mời",
        {
          description:
            "Mã mời chưa được đưa vào clipboard. Hãy thử sao chép lại hoặc copy thủ công.",
        },
      );
    }
  }, [createInviteForCurrentForm, createdInvite, message]);

  const createInvite = useCallback(
    async (event) => {
      event.preventDefault();

      try {
        const shareLink = buildShareableInviteLink(createdInvite);
        if (!shareLink) return;

        await copyTextToClipboard(shareLink);
        message.copySuccess("Đã sao chép liên kết mời", shareLink, {
          label: "Link",
          text: "Liên kết mời đã sẵn sàng để gửi cho thành viên mới.",
        });
      } catch (error) {
        console.error("Failed to create organization invite:", error);
        message.error(
          error?.response
            ? getErrorMessage(error, "Không thể tạo lời mời")
            : "Không thể sao chép liên kết mời",
          {
            description:
              "Liên kết mời chưa được đưa vào clipboard. Hãy tạo lại mã hoặc thử sao chép sau.",
          },
        );
      }
    },
    [createdInvite, message],
  );

  const copyInvite = useCallback(
    async (invite) => {
      if (!invite?.code) return;

      try {
        await navigator.clipboard.writeText(invite.code);
        message.copySuccess("Đã sao chép mã mời", invite.code, {
          label: "Mã mời",
          text: `${getInviteCode(invite)} đã sẵn sàng để gửi cho thành viên mới.`,
        });
      } catch {
        message.error("Không thể sao chép mã mời", {
          description:
            "Trình duyệt chưa cho phép ghi vào clipboard. Hãy copy mã trực tiếp trong bảng lời mời.",
        });
      }
    },
    [message],
  );

  const setInviteStatus = useCallback(
    async (invite, status) => {
      if (!organizationId || !invite?.id) return;

      try {
        await updateOrganizationInvite(organizationId, invite.id, {
          status,
          durationHours: status === "paused" ? 1 : undefined,
        });
        message.success(status === "paused" ? "Đã tạm dừng lời mời" : "Đã cập nhật lời mời", {
          description:
            status === "paused"
              ? `${getInviteCode(invite)} sẽ tạm ngưng nhận thành viên mới trong 1 giờ.`
              : `${getInviteCode(invite)} đã được cập nhật trạng thái mới.`,
        });
        loadInvites();
      } catch (error) {
        console.error("Failed to update invite:", error);
        message.error(getErrorMessage(error, "Không thể cập nhật lời mời"), {
          description:
            "Trạng thái mã mời chưa được lưu. Hãy thử lại trong bảng lời mời.",
        });
      }
    },
    [loadInvites, message, organizationId],
  );

  const deleteInvite = useCallback(
    async (invite) => {
      if (!organizationId || !invite?.id) return;

      try {
        await deleteOrganizationInvite(organizationId, invite.id);
        message.success("Đã xóa lời mời", {
          description: `${getInviteCode(invite)} đã được gỡ khỏi danh sách mã mời.`,
        });
        loadInvites();
        refreshOrganization();
      } catch (error) {
        console.error("Failed to delete invite:", error);
        message.error(getErrorMessage(error, "Không thể xóa lời mời"), {
          description:
            "Mã mời vẫn còn hiệu lực trong danh sách. Hãy thử xóa lại sau.",
        });
      }
    },
    [loadInvites, message, organizationId, refreshOrganization],
  );

  const pauseInvites = useCallback(
    async (event) => {
      event.preventDefault();
      if (!organizationId) return;

      try {
        const result = await pauseOrganizationInvites(organizationId, {
          scope: pauseScope,
          durationHours: Number(pauseDurationHours),
        });
        setPauseModalOpen(false);
        message.success(`Đã tạm dừng ${result.pausedCount || 0} lời mời`, {
          description: `Các mã mời đã chọn sẽ tạm dừng trong ${pauseDurationHours} giờ.`,
        });
        loadInvites();
        refreshOrganization();
      } catch (error) {
        console.error("Failed to pause organization invites:", error);
        message.error(getErrorMessage(error, "Không thể tạm dừng lời mời"), {
          description:
            "Các mã mời đã chọn vẫn giữ trạng thái cũ. Hãy kiểm tra phạm vi tạm dừng và thử lại.",
        });
      }
    },
    [
      loadInvites,
      message,
      organizationId,
      pauseDurationHours,
      pauseScope,
      refreshOrganization,
    ],
  );

  const saveSettings = useCallback(
    async (event) => {
      event?.preventDefault?.();
      if (!organizationId || !advancedForm) return;

      const canUpdateSettings = hasPermission(activeOrganization, "manageSettings");
      const canUpdateAppearance = hasPermission(
        activeOrganization,
        "manageOrganization",
      );
      if (!canUpdateSettings && !canUpdateAppearance) return;

      setLoading((current) => ({ ...current, settings: true }));
      try {
        let saved = activeOrganization;

        if (canUpdateSettings) {
          saved = await updateOrganizationSettings(organizationId, {
            requireApproval: advancedForm.requireApproval,
            allowMemberInvites: advancedForm.allowMemberInvites,
            memberDirectoryVisible: advancedForm.memberDirectoryVisible,
            defaultRoleKey: advancedForm.defaultRoleKey,
            joinMessage: advancedForm.joinMessage,
            joinQuestions: advancedForm.joinQuestions || [],
          });
        }

        if (
          canUpdateAppearance &&
          advancedForm.accentColor &&
          advancedForm.accentColor !== activeOrganization?.accentColor
        ) {
          saved = await updateOrganization(organizationId, {
            accentColor: advancedForm.accentColor,
          });
        }

        setOrganization(saved);
        refreshOrganizations?.();
        message.success("Đã cập nhật cài đặt nâng cao", {
          description:
            "Quy tắc tham gia, quyền mời thành viên và giao diện tổ chức đã được lưu.",
        });
      } catch (error) {
        console.error("Failed to update organization settings:", error);
        message.error(getErrorMessage(error, "Không thể lưu cài đặt"), {
          description:
            "Cài đặt nâng cao chưa được lưu. Hãy kiểm tra quyền quản trị và thử lại.",
        });
      } finally {
        setLoading((current) => ({ ...current, settings: false }));
      }
    },
    [activeOrganization, advancedForm, message, organizationId, refreshOrganizations],
  );

  const reviewJoinRequest = useCallback(
    async (member, action) => {
      if (!organizationId || !member?.id || !action) return;

      try {
        await reviewOrganizationJoinRequest(organizationId, member.id, action);
        message.success(
          action === "approve"
            ? "Đã duyệt yêu cầu tham gia"
            : "Đã từ chối yêu cầu tham gia",
          {
            description:
              action === "approve"
                ? `${getMemberName(member)} đã được thêm vào danh sách thành viên.`
                : `Yêu cầu tham gia của ${getMemberName(member)} đã bị đóng.`,
          },
        );
        setSelectedJoinRequest(null);
        loadJoinRequests();
        loadMembers();
        refreshOrganization();
        refreshOrganizations?.();
      } catch (error) {
        console.error("Failed to review join request:", error);
        message.error(getErrorMessage(error, "Không thể xử lý yêu cầu"), {
          description:
            "Trạng thái yêu cầu tham gia chưa được cập nhật. Hãy thử lại trong tab Lời mời.",
        });
      }
    },
    [
      loadJoinRequests,
      loadMembers,
      message,
      organizationId,
      refreshOrganization,
      refreshOrganizations,
    ],
  );

  const transferOwner = useCallback(
    async (member) => {
      if (!organizationId || !member?.id || isTransferringOwner) return;

      setIsTransferringOwner(true);
      try {
        const payload = await transferOrganizationOwnership(organizationId, {
          memberId: member.id,
        });
        setOrganization(payload.organization);
        setTransferModalOpen(false);
        message.success("Đã chuyển quyền sở hữu tổ chức", {
          description: `${getMemberName(member)} hiện là chủ sở hữu mới của tổ chức.`,
        });
        loadMembers();
        refreshOrganizations?.();
      } catch (error) {
        console.error("Failed to transfer organization ownership:", error);
        message.error(getErrorMessage(error, "Không thể chuyển quyền sở hữu"), {
          description:
            "Quyền sở hữu vẫn chưa thay đổi. Hãy kiểm tra thành viên nhận quyền và thử lại.",
        });
      } finally {
        setIsTransferringOwner(false);
      }
    },
    [
      isTransferringOwner,
      loadMembers,
      message,
      organizationId,
      refreshOrganizations,
    ],
  );

  const updateBannerImage = useCallback(
    async (file) => {
      if (!organizationId || !file) return null;
      if (!hasPermission(activeOrganization, "manageOrganization")) {
        message.error("Bạn không có quyền cập nhật ảnh biểu ngữ", {
          description:
            "Chỉ chủ sở hữu hoặc thành viên có quyền quản lý tổ chức mới được đổi biểu ngữ.",
        });
        return null;
      }

      setLoading((current) => ({ ...current, banner: true }));
      try {
        const updatedOrganization = await updateOrganizationBanner(organizationId, file);
        setOrganization(updatedOrganization);
        message.success("Đã cập nhật ảnh biểu ngữ", {
          description: `${getOrganizationName(
            updatedOrganization,
          )} đã áp dụng ảnh biểu ngữ mới.`,
        });
        return updatedOrganization;
      } catch (error) {
        console.error("Failed to update organization banner:", error);
        message.error(getErrorMessage(error, "Không thể cập nhật ảnh biểu ngữ"), {
          description:
            "Ảnh biểu ngữ chưa được lưu. Hãy kiểm tra định dạng, dung lượng hoặc thử lại sau.",
        });
        return null;
      } finally {
        setLoading((current) => ({ ...current, banner: false }));
      }
    },
    [activeOrganization, message, organizationId, updateOrganizationBanner],
  );

  const leaveCurrentOrganization = useCallback(async () => {
    if (!organizationId || activeOrganization?.role === "owner" || leaving) return;

    setLeaving(true);
    try {
      await leaveOrganization(organizationId);
      message.success("Đã rời tổ chức", {
        description: `${getOrganizationName(
          activeOrganization,
        )} đã được gỡ khỏi danh sách tổ chức của bạn.`,
      });
      navigate("/organization", { replace: true });
    } catch (error) {
      console.error("Failed to leave organization:", error);
      message.error(getErrorMessage(error, "Không thể rời tổ chức"), {
        description:
          "Tài khoản của bạn vẫn còn trong tổ chức này. Hãy thử lại hoặc liên hệ chủ sở hữu.",
      });
    } finally {
      setLeaving(false);
    }
  }, [
    activeOrganization,
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
    if (selectedTab === "advanced") loadMembers();
  }, [loadMembers, selectedTab]);

  useEffect(() => {
    if (selectedTab === "roles" || selectedTab === "members" || selectedTab === "advanced") {
      loadRoles();
    }
  }, [loadRoles, selectedTab]);

  useEffect(() => {
    if (selectedTab === "invites") loadInvites();
  }, [loadInvites, selectedTab]);

  useEffect(() => {
    if (selectedTab === "invites") loadJoinRequests();
  }, [loadJoinRequests, selectedTab]);

  return {
    state: {
      activeOrganization,
      advancedForm,
      availableTabs,
      canManage,
      createdInvite,
      inviteForm,
      inviteModalOpen,
      invites,
      isCreatingInvite,
      isLoadingOrganization,
      isTransferringOwner,
      joinPreviewOpen,
      joinRequestQuestions,
      joinRequests,
      leaving,
      loading,
      memberFilters,
      members,
      overview,
      pauseDurationHours,
      pauseModalOpen,
      pauseScope,
      permissionKeys,
      roleForm,
      roleModal,
      roles,
      selectedTab,
      selectedJoinRequest,
      transferModalOpen,
    },
    actions: {
      changeMemberRole,
      closeRoleModal,
      closeInviteModal,
      copyInvite,
      copyInviteCodeFromModal,
      createInvite,
      deleteInvite,
      leaveCurrentOrganization,
      loadInvites,
      loadJoinRequests,
      loadMembers,
      loadOverview,
      loadRoles,
      openRoleModal,
      openInviteModal,
      pauseInvites,
      refreshOrganization,
      removeRole,
      saveRole,
      saveSettings,
      setAdvancedForm,
      setInviteForm: changeInviteForm,
      setInviteModalOpen,
      setJoinPreviewOpen,
      setPauseDurationHours,
      setInviteStatus,
      setMemberFilters,
      setPauseModalOpen,
      setPauseScope,
      setRoleForm,
      setSelectedJoinRequest,
      setTab,
      setTransferModalOpen,
      reviewJoinRequest,
      transferOwner,
      updateBannerImage,
    },
  };
};
