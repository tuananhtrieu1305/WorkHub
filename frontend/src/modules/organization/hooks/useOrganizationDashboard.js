import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { App } from "antd";
import {
  getNotificationSettings,
  updateNotificationSettings,
} from "../../../api/notificationApi";
import {
  getOrganizationMembers,
  reviewOrganizationJoinRequest,
  updateOrganizationFavorite,
} from "../../../api/organizationApi";
import { useAuth } from "../../../context/AuthContext";
import {
  EMPTY_ARRAY,
  getOrganizationId,
  isManager,
  normalizeInviteValue,
} from "../organizationUtils";

const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const sortOrganizations = (organizations, activeOrganizationId) =>
  [...organizations].sort((a, b) => {
    const favoriteDelta =
      Number(Boolean(b.isFavorite)) - Number(Boolean(a.isFavorite));
    if (favoriteDelta) return favoriteDelta;

    const activeDelta =
      Number(getOrganizationId(b) === activeOrganizationId) -
      Number(getOrganizationId(a) === activeOrganizationId);
    if (activeDelta) return activeDelta;

    return String(a.name || "").localeCompare(String(b.name || ""), "vi");
  });

export const useOrganizationDashboard = () => {
  const {
    user,
    createOrganization,
    joinOrganization,
    leaveOrganization,
    switchActiveOrganization,
    refreshOrganizations,
    updateOrganization,
    updateOrganizationLogo,
    updateOrganizationBanner,
  } = useAuth();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const inviteFromUrl = params.inviteCode || searchParams.get("invite") || "";
  const hasAutoJoinedRef = useRef(false);
  const logoInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const uploadTargetRef = useRef({ type: "", organizationId: "" });

  const [inviteLink, setInviteLink] = useState(inviteFromUrl);
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    accentColor: "#2563eb",
    inviteEnabled: true,
  });
  const [actionModal, setActionModal] = useState("");
  const [expandedOrganizationId, setExpandedOrganizationId] = useState("");
  const [openMenuId, setOpenMenuId] = useState("");
  const [detailMembers, setDetailMembers] = useState([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRotatingInvite, setIsRotatingInvite] = useState(false);
  const [isLeavingId, setIsLeavingId] = useState("");
  const [isSwitchingId, setIsSwitchingId] = useState("");
  const [reviewingMemberId, setReviewingMemberId] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState({
    type: "",
    organizationId: "",
  });
  const [dashboardAction, setDashboardAction] = useState({
    type: "",
    organization: null,
  });
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState(null);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [savingNotificationKey, setSavingNotificationKey] = useState("");

  const organizations = user?.organizations || EMPTY_ARRAY;
  const pendingOrganizations = user?.pendingOrganizations || EMPTY_ARRAY;
  const activeOrganization = user?.activeOrganization || null;
  const activeOrganizationId = getOrganizationId(activeOrganization);

  const organizationById = useMemo(() => {
    const entries = organizations.map((organization) => [
      getOrganizationId(organization),
      organization,
    ]);
    return new Map(entries);
  }, [organizations]);

  const sortedOrganizations = useMemo(
    () => sortOrganizations(organizations, activeOrganizationId),
    [activeOrganizationId, organizations],
  );

  const selectedOrganization = expandedOrganizationId
    ? organizationById.get(expandedOrganizationId)
    : null;
  const canManageSelectedOrganization = isManager(selectedOrganization);
  const activeMembers = detailMembers.filter(
    (member) => member.status === "active",
  );
  const pendingMembers = detailMembers.filter(
    (member) => member.status === "pending",
  );
  const activeInviteUrl =
    activeOrganization?.inviteEnabled === false
      ? ""
      : activeOrganization?.inviteLink || "";

  const closeActionModal = useCallback(() => setActionModal(""), []);
  const closeDashboardAction = useCallback(() => {
    setDashboardAction({ type: "", organization: null });
    setNotificationPanelOpen(false);
  }, []);

  const refreshContext = useCallback(async () => {
    try {
      await refreshOrganizations?.();
    } catch (error) {
      console.error("Failed to refresh organizations:", error);
    }
  }, [refreshOrganizations]);

  const loadMembersForOrganization = useCallback(async (organizationId) => {
    if (!organizationId) {
      setDetailMembers([]);
      return;
    }

    setIsLoadingMembers(true);
    try {
      const payload = await getOrganizationMembers(organizationId, {
        status: "all",
      });
      setDetailMembers(payload.content || []);
    } catch (error) {
      console.error("Failed to load organization members:", error);
      setDetailMembers([]);
    } finally {
      setIsLoadingMembers(false);
    }
  }, []);

  const handleJoin = useCallback(
    async (value = inviteLink) => {
      const normalizedInvite = normalizeInviteValue(value);
      if (!normalizedInvite || isJoining) return;

      setIsJoining(true);
      try {
        const context = await joinOrganization(normalizedInvite);
        setInviteLink("");
        closeActionModal();
        const joinedOrganization = context?.organization;
        message.success(
          joinedOrganization?.memberStatus === "pending"
            ? "Đã gửi yêu cầu tham gia"
            : "Đã tham gia tổ chức",
        );
        if (params.inviteCode) navigate("/organization", { replace: true });
      } catch (error) {
        console.error("Failed to join organization:", error);
        message.error(
          error?.response?.data?.message || "Không thể gửi yêu cầu tham gia",
        );
      } finally {
        setIsJoining(false);
      }
    },
    [
      closeActionModal,
      inviteLink,
      isJoining,
      joinOrganization,
      message,
      navigate,
      params.inviteCode,
    ],
  );

  const handleCreate = useCallback(
    async (event) => {
      event.preventDefault();
      if (!createForm.name.trim() || isCreating) return;

      setIsCreating(true);
      try {
        await createOrganization(createForm);
        setCreateForm({ name: "", description: "" });
        closeActionModal();
        message.success("Đã tạo tổ chức mới");
      } catch (error) {
        console.error("Failed to create organization:", error);
        message.error(error?.response?.data?.message || "Không thể tạo tổ chức");
      } finally {
        setIsCreating(false);
      }
    },
    [closeActionModal, createForm, createOrganization, isCreating, message],
  );

  const handleSwitch = useCallback(
    async (event, organizationId) => {
      event?.stopPropagation?.();
      if (!organizationId || organizationId === activeOrganizationId) return;

      setIsSwitchingId(organizationId);
      try {
        await switchActiveOrganization(organizationId);
        message.success("Đã chuyển tổ chức");
      } catch (error) {
        console.error("Failed to switch organization:", error);
        message.error(
          error?.response?.data?.message || "Không thể chuyển tổ chức",
        );
      } finally {
        setIsSwitchingId("");
      }
    },
    [activeOrganizationId, message, switchActiveOrganization],
  );

  const handleCopyInvite = useCallback(
    async (event, organization = activeOrganization) => {
      event?.stopPropagation?.();
      const inviteUrl =
        organization?.inviteEnabled === false ? "" : organization?.inviteLink || "";
      if (!inviteUrl) {
        message.warning("Link mời đang tắt hoặc chưa có sẵn");
        return;
      }

      try {
        await navigator.clipboard.writeText(inviteUrl);
        message.success("Đã sao chép link mời");
      } catch {
        message.error("Không thể sao chép link");
      }
    },
    [activeOrganization, message],
  );

  const handleOpenInviteModal = useCallback(
    (event, organization = activeOrganization) => {
      event?.stopPropagation?.();
      setOpenMenuId("");
      if (!organization) {
        message.warning("Chưa có tổ chức để lấy link mời");
        return;
      }
      setDashboardAction({ type: "invite", organization });
    },
    [activeOrganization, message],
  );

  const handleToggleFavorite = useCallback(
    async (event, organization) => {
      event?.stopPropagation?.();
      const organizationId = getOrganizationId(organization);
      if (!organizationId) return;

      try {
        await updateOrganizationFavorite(organizationId, !organization.isFavorite);
        await refreshContext();
        message.success(
          organization.isFavorite ? "Đã bỏ yêu thích" : "Đã đánh dấu yêu thích",
        );
      } catch (error) {
        console.error("Failed to update favorite organization:", error);
        message.error(
          error?.response?.data?.message || "Không thể cập nhật yêu thích",
        );
      }
    },
    [message, refreshContext],
  );

  const handleLeaveOrganization = useCallback(
    async (event, organization) => {
      event?.stopPropagation?.();
      const organizationId = getOrganizationId(organization);
      if (!organizationId || organization?.role === "owner" || isLeavingId) return;

      setIsLeavingId(organizationId);
      try {
        await leaveOrganization(organizationId);
        if (expandedOrganizationId === organizationId) {
          setExpandedOrganizationId("");
          setDetailMembers([]);
        }
        message.success("Đã rời tổ chức");
        return true;
      } catch (error) {
        console.error("Failed to leave organization:", error);
        message.error(error?.response?.data?.message || "Không thể rời tổ chức");
        return false;
      } finally {
        setIsLeavingId("");
      }
    },
    [expandedOrganizationId, isLeavingId, leaveOrganization, message],
  );

  const handleOpenLeaveModal = useCallback(
    (event, organization) => {
      event?.stopPropagation?.();
      setOpenMenuId("");
      if (!organization || organization.role === "owner") return;
      setDashboardAction({ type: "leave", organization });
    },
    [],
  );

  const handleConfirmLeave = useCallback(async () => {
    if (dashboardAction.type !== "leave" || !dashboardAction.organization) return;

    const didLeave = await handleLeaveOrganization(
      undefined,
      dashboardAction.organization,
    );
    if (didLeave) closeDashboardAction();
  }, [
    closeDashboardAction,
    dashboardAction.organization,
    dashboardAction.type,
    handleLeaveOrganization,
  ]);

  const handleCancelPending = useCallback(
    async (organization) => {
      const organizationId = getOrganizationId(organization);
      if (!organizationId || isLeavingId) return;

      setIsLeavingId(organizationId);
      try {
        await leaveOrganization(organizationId);
        message.success("Đã hủy yêu cầu tham gia");
      } catch (error) {
        console.error("Failed to cancel organization request:", error);
        message.error(error?.response?.data?.message || "Không thể hủy yêu cầu");
      } finally {
        setIsLeavingId("");
      }
    },
    [isLeavingId, leaveOrganization, message],
  );

  const handleOpenDetails = useCallback((organizationId) => {
    if (!organizationId) return;
    setOpenMenuId("");
    navigate(`/organization/${organizationId}`);
  }, [navigate]);

  const handleUpdateSelectedOrganization = useCallback(
    async (event) => {
      event.preventDefault();
      const organizationId = getOrganizationId(selectedOrganization);
      if (
        !organizationId ||
        !canManageSelectedOrganization ||
        !editForm.name.trim() ||
        isUpdating
      ) {
        return;
      }

      setIsUpdating(true);
      try {
        await updateOrganization(organizationId, editForm);
        message.success("Đã cập nhật tổ chức");
      } catch (error) {
        console.error("Failed to update organization:", error);
        message.error(error?.response?.data?.message || "Không thể cập nhật");
      } finally {
        setIsUpdating(false);
      }
    },
    [
      canManageSelectedOrganization,
      editForm,
      isUpdating,
      message,
      selectedOrganization,
      updateOrganization,
    ],
  );

  const handleToggleInvite = useCallback(async () => {
    const organizationId = getOrganizationId(selectedOrganization);
    if (!organizationId || !canManageSelectedOrganization || isUpdating) return;

    const nextInviteEnabled = !editForm.inviteEnabled;
    setIsUpdating(true);
    try {
      await updateOrganization(organizationId, {
        ...editForm,
        inviteEnabled: nextInviteEnabled,
      });
      setEditForm((current) => ({
        ...current,
        inviteEnabled: nextInviteEnabled,
      }));
      message.success(nextInviteEnabled ? "Đã bật link mời" : "Đã tắt link mời");
    } catch (error) {
      console.error("Failed to toggle invite:", error);
      message.error(error?.response?.data?.message || "Không thể cập nhật link");
    } finally {
      setIsUpdating(false);
    }
  }, [
    canManageSelectedOrganization,
    editForm,
    isUpdating,
    message,
    selectedOrganization,
    updateOrganization,
  ]);

  const handleRotateInvite = useCallback(async () => {
    const organizationId = getOrganizationId(selectedOrganization);
    if (!organizationId || !canManageSelectedOrganization || isRotatingInvite) {
      return;
    }

    setIsRotatingInvite(true);
    try {
      await updateOrganization(organizationId, {
        ...editForm,
        rotateInviteCode: true,
      });
      message.success("Đã đổi link mời");
    } catch (error) {
      console.error("Failed to rotate invite:", error);
      message.error(error?.response?.data?.message || "Không thể đổi link mời");
    } finally {
      setIsRotatingInvite(false);
    }
  }, [
    canManageSelectedOrganization,
    editForm,
    isRotatingInvite,
    message,
    selectedOrganization,
    updateOrganization,
  ]);

  const openMediaUpload = useCallback((event, type, organization) => {
    event?.stopPropagation?.();
    const organizationId = getOrganizationId(organization);
    if (!organizationId || !isManager(organization)) return;

    uploadTargetRef.current = { type, organizationId };
    if (type === "banner") {
      bannerInputRef.current?.click();
    } else {
      logoInputRef.current?.click();
    }
  }, []);

  const handleMediaFileChange = useCallback(
    async (event, type) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      const target = uploadTargetRef.current;
      if (!file || target.type !== type || !target.organizationId) return;

      if (!allowedImageTypes.has(file.type)) {
        message.error("Ảnh phải là JPG, PNG, GIF hoặc WebP");
        return;
      }

      const maxSize = type === "banner" ? 8 * 1024 * 1024 : 5 * 1024 * 1024;
      if (file.size > maxSize) {
        message.error(
          type === "banner" ? "Biểu ngữ phải nhỏ hơn 8MB" : "Ảnh phải nhỏ hơn 5MB",
        );
        return;
      }

      setUploadingMedia({ type, organizationId: target.organizationId });
      try {
        if (type === "banner") {
          await updateOrganizationBanner(target.organizationId, file);
          message.success("Đã cập nhật biểu ngữ");
        } else {
          await updateOrganizationLogo(target.organizationId, file);
          message.success("Đã cập nhật ảnh tổ chức");
        }
      } catch (error) {
        console.error("Failed to upload organization media:", error);
        message.error(error?.response?.data?.message || "Không thể tải ảnh lên");
      } finally {
        setUploadingMedia({ type: "", organizationId: "" });
        uploadTargetRef.current = { type: "", organizationId: "" };
      }
    },
    [message, updateOrganizationBanner, updateOrganizationLogo],
  );

  const handleReviewRequest = useCallback(
    async (memberId, action) => {
      const organizationId = getOrganizationId(selectedOrganization);
      if (!organizationId || !memberId || reviewingMemberId) return;

      setReviewingMemberId(`${memberId}:${action}`);
      try {
        await reviewOrganizationJoinRequest(organizationId, memberId, action);
        await Promise.all([
          refreshContext(),
          loadMembersForOrganization(organizationId),
        ]);
        message.success(
          action === "approve" ? "Đã duyệt thành viên" : "Đã từ chối yêu cầu",
        );
      } catch (error) {
        console.error("Failed to review organization request:", error);
        message.error(error?.response?.data?.message || "Không thể xử lý yêu cầu");
      } finally {
        setReviewingMemberId("");
      }
    },
    [
      loadMembersForOrganization,
      message,
      refreshContext,
      reviewingMemberId,
      selectedOrganization,
    ],
  );

  const handleOpenNotificationPanel = useCallback((event) => {
    event?.stopPropagation?.();
    setOpenMenuId("");
    setDashboardAction({ type: "notifications", organization: null });
    setNotificationPanelOpen(true);
  }, []);

  const handleToggleNotificationSetting = useCallback(
    async (key) => {
      if (!notificationSettings || savingNotificationKey) return;

      const previous = notificationSettings;
      const nextValue = !notificationSettings[key];
      setNotificationSettings((current) => ({
        ...current,
        [key]: nextValue,
      }));
      setSavingNotificationKey(key);
      try {
        const saved = await updateNotificationSettings({ [key]: nextValue });
        setNotificationSettings(saved);
        message.success("Đã cập nhật thông báo");
      } catch (error) {
        console.error("Failed to update notification settings:", error);
        setNotificationSettings(previous);
        message.error(
          error?.response?.data?.message || "Không thể cập nhật thông báo",
        );
      } finally {
        setSavingNotificationKey("");
      }
    },
    [message, notificationSettings, savingNotificationKey],
  );

  useEffect(() => {
    refreshContext();
  }, [refreshContext]);

  useEffect(() => {
    if (!inviteFromUrl || hasAutoJoinedRef.current) return;
    hasAutoJoinedRef.current = true;
    setInviteLink(inviteFromUrl);
    handleJoin(inviteFromUrl);
  }, [handleJoin, inviteFromUrl]);

  useEffect(() => {
    if (!expandedOrganizationId) {
      setDetailMembers([]);
      return;
    }

    loadMembersForOrganization(expandedOrganizationId);
  }, [expandedOrganizationId, loadMembersForOrganization]);

  useEffect(() => {
    setEditForm({
      name: selectedOrganization?.name || "",
      description: selectedOrganization?.description || "",
      accentColor: selectedOrganization?.accentColor || "#2563eb",
      inviteEnabled: selectedOrganization?.inviteEnabled !== false,
    });
  }, [
    selectedOrganization?.accentColor,
    selectedOrganization?.description,
    selectedOrganization?.id,
    selectedOrganization?.inviteEnabled,
    selectedOrganization?.name,
  ]);

  useEffect(() => {
    if (!notificationPanelOpen || notificationSettings) return;

    let ignore = false;
    setIsLoadingNotifications(true);
    getNotificationSettings()
      .then((settings) => {
        if (!ignore) setNotificationSettings(settings);
      })
      .catch((error) => {
        console.error("Failed to load notification settings:", error);
        if (!ignore) {
          message.error("Không thể tải cài đặt thông báo");
        }
      })
      .finally(() => {
        if (!ignore) setIsLoadingNotifications(false);
      });

    return () => {
      ignore = true;
    };
  }, [message, notificationPanelOpen, notificationSettings]);

  return {
    refs: {
      logoInputRef,
      bannerInputRef,
    },
    state: {
      activeInviteUrl,
      activeMembers,
      activeOrganization,
      activeOrganizationId,
      actionModal,
      canManageSelectedOrganization,
      createForm,
      detailMembers,
      dashboardAction,
      editForm,
      expandedOrganizationId,
      inviteLink,
      isCreating,
      isJoining,
      isLeavingId,
      isLoadingMembers,
      isLoadingNotifications,
      isRotatingInvite,
      isSwitchingId,
      isUpdating,
      notificationPanelOpen,
      notificationSettings,
      openMenuId,
      organizations,
      pendingMembers,
      pendingOrganizations,
      reviewingMemberId,
      savingNotificationKey,
      selectedOrganization,
      sortedOrganizations,
      uploadingMedia,
    },
    actions: {
      closeActionModal,
      closeDashboardAction,
      handleCancelPending,
      handleConfirmLeave,
      handleCopyInvite,
      handleCreate,
      handleJoin,
      handleLeaveOrganization,
      handleMediaFileChange,
      handleOpenDetails,
      handleOpenInviteModal,
      handleOpenLeaveModal,
      handleOpenNotificationPanel,
      handleReviewRequest,
      handleRotateInvite,
      handleSwitch,
      handleToggleFavorite,
      handleToggleInvite,
      handleToggleNotificationSetting,
      handleUpdateSelectedOrganization,
      openMediaUpload,
      setActionModal,
      setCreateForm,
      setEditForm,
      setInviteLink,
      setNotificationPanelOpen,
      setOpenMenuId,
    },
  };
};
