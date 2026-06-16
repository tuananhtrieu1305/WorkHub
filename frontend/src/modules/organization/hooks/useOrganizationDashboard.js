import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  getNotificationSettings,
  updateNotificationSettings,
} from "../../../api/notificationApi";
import {
  createOrganizationInvite,
  getOrganizationMembers,
  previewOrganizationJoin,
  reviewOrganizationJoinRequest,
  updateOrganizationFavorite,
} from "../../../api/organizationApi";
import { useAuth } from "../../../context/AuthContext";
import {
  EMPTY_ARRAY,
  buildShareableInviteLink,
  canBypassInviteApproval,
  copyTextToClipboard,
  getOrganizationId,
  isManager,
  normalizeInviteValue,
} from "../organizationUtils";
import { useWorkHubToast } from "../../../components/feedback/workHubToast";

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

const buildInitialJoinAnswers = (questions = []) =>
  questions.reduce((answers, question) => {
    answers[question.id] = question.type === "rules" ? false : "";
    return answers;
  }, {});

const defaultInviteForm = {
  expiresIn: "7d",
  maxUses: "",
  bypassApproval: false,
};

const inviteExpiryDurations = {
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

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

const hasMissingRequiredJoinAnswer = (questions = [], answers = {}) =>
  questions.some((question) => {
    if (!question.required) return false;
    const value = answers[question.id];
    if (question.type === "rules") return value !== true;
    return !String(value || "").trim();
  });

const getOrganizationName = (organization) =>
  organization?.name || "Tổ chức này";

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
  const message = useWorkHubToast();
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const inviteFromUrl = params.inviteCode || searchParams.get("invite") || "";
  const hasAutoJoinedRef = useRef(false);
  const logoInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const uploadTargetRef = useRef({ type: "", organizationId: "" });

  const [inviteLink, setInviteLink] = useState(inviteFromUrl);
  const [inviteForm, setInviteForm] = useState(defaultInviteForm);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteModalOrganization, setInviteModalOrganization] = useState(null);
  const [createdInvite, setCreatedInvite] = useState(null);
  const [joinAnswers, setJoinAnswers] = useState({});
  const [joinInviteValue, setJoinInviteValue] = useState("");
  const [joinPreview, setJoinPreview] = useState(null);
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
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
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
  const closeActionModal = useCallback(() => setActionModal(""), []);
  const closeJoinQuestions = useCallback(() => {
    setJoinAnswers({});
    setJoinInviteValue("");
    setJoinPreview(null);
  }, []);
  const closeDashboardAction = useCallback(() => {
    setDashboardAction({ type: "", organization: null });
    setNotificationPanelOpen(false);
  }, []);
  const closeInviteModal = useCallback(() => {
    setInviteModalOpen(false);
    setInviteModalOrganization(null);
    setInviteForm(defaultInviteForm);
    setCreatedInvite(null);
  }, []);

  const changeInviteForm = useCallback((nextForm) => {
    setInviteForm(nextForm);
    setCreatedInvite(null);
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
        const preview = await previewOrganizationJoin(normalizedInvite);
        const questions = preview?.joinQuestions || [];
        const memberStatus = preview?.organization?.memberStatus;

        if (questions.length && !["active", "pending"].includes(memberStatus)) {
          setJoinAnswers(buildInitialJoinAnswers(questions));
          setJoinInviteValue(normalizedInvite);
          setJoinPreview(preview);
          closeActionModal();
          return;
        }

        const context = await joinOrganization(normalizedInvite);
        setInviteLink("");
        closeActionModal();
        const joinedOrganization = context?.organization;
        const isPendingJoin = joinedOrganization?.memberStatus === "pending";
        message.success(
          isPendingJoin ? "Đã gửi yêu cầu tham gia" : "Đã tham gia tổ chức",
          {
            description: isPendingJoin
              ? `${getOrganizationName(
                  joinedOrganization,
                )} sẽ xem xét yêu cầu trước khi kích hoạt tài khoản của bạn.`
              : `${getOrganizationName(
                  joinedOrganization,
                )} đã được thêm vào danh sách tổ chức của bạn.`,
          },
        );
        if (params.inviteCode) navigate("/organization", { replace: true });
      } catch (error) {
        console.error("Failed to join organization:", error);
        message.error(
          error?.response?.data?.message || "Không thể gửi yêu cầu tham gia",
          {
            description:
              "Mã mời chưa được chấp nhận. Hãy kiểm tra lại mã hoặc liên hệ quản trị viên tổ chức.",
          },
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

  const handleChangeJoinAnswer = useCallback((questionId, value) => {
    setJoinAnswers((current) => ({ ...current, [questionId]: value }));
  }, []);

  const handleSubmitJoinQuestions = useCallback(
    async (event) => {
      event?.preventDefault?.();
      if (
        !joinInviteValue ||
        isJoining ||
        hasMissingRequiredJoinAnswer(joinPreview?.joinQuestions || [], joinAnswers)
      ) {
        return;
      }

      setIsJoining(true);
      try {
        const context = await joinOrganization(joinInviteValue, {
          answers: joinAnswers,
        });
        setInviteLink("");
        closeJoinQuestions();
        const joinedOrganization = context?.organization;
        const isPendingJoin = joinedOrganization?.memberStatus === "pending";
        message.success(
          isPendingJoin ? "Đã gửi yêu cầu tham gia" : "Đã tham gia tổ chức",
          {
            description: isPendingJoin
              ? `${getOrganizationName(
                  joinedOrganization,
                )} đã nhận câu trả lời tham gia của bạn để xét duyệt.`
              : `${getOrganizationName(
                  joinedOrganization,
                )} đã được thêm vào danh sách tổ chức của bạn.`,
          },
        );
        if (params.inviteCode) navigate("/organization", { replace: true });
      } catch (error) {
        console.error("Failed to submit organization join answers:", error);
        message.error(
          error?.response?.data?.message || "Không thể gửi yêu cầu tham gia",
          {
            description:
              "Câu trả lời tham gia chưa được gửi. Hãy kiểm tra các câu hỏi bắt buộc rồi thử lại.",
          },
        );
      } finally {
        setIsJoining(false);
      }
    },
    [
      closeJoinQuestions,
      isJoining,
      joinAnswers,
      joinInviteValue,
      joinOrganization,
      joinPreview,
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
        const createdName = createForm.name.trim();
        setCreateForm({ name: "", description: "" });
        closeActionModal();
        message.success("Đã tạo tổ chức mới", {
          description: `${createdName} đã sẵn sàng để bạn mời thành viên và thiết lập không gian làm việc.`,
        });
      } catch (error) {
        console.error("Failed to create organization:", error);
        message.error(error?.response?.data?.message || "Không thể tạo tổ chức", {
          description:
            "Tổ chức mới chưa được tạo. Hãy kiểm tra tên tổ chức và thử lại.",
        });
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
        message.success("Đã chuyển tổ chức", {
          description:
            "Bảng điều khiển, lời mời và thông báo sẽ hiển thị theo tổ chức vừa chọn.",
        });
      } catch (error) {
        console.error("Failed to switch organization:", error);
        message.error(
          error?.response?.data?.message || "Không thể chuyển tổ chức",
          {
            description:
              "WorkHub chưa thể đặt tổ chức này làm không gian làm việc hiện tại.",
          },
        );
      } finally {
        setIsSwitchingId("");
      }
    },
    [activeOrganizationId, message, switchActiveOrganization],
  );

  const handleOpenInviteModal = useCallback(
    (event, organization = activeOrganization) => {
      event?.stopPropagation?.();
      setOpenMenuId("");
      if (!organization) {
        message.warning("Chưa có tổ chức để tạo lời mời", {
          description:
            "Bạn cần tạo hoặc tham gia một tổ chức trước khi phát hành mã mời.",
        });
        return;
      }
      setInviteModalOrganization(organization);
      setInviteForm(defaultInviteForm);
      setCreatedInvite(null);
      setInviteModalOpen(true);
    },
    [activeOrganization, message],
  );

  const createInviteForCurrentForm = useCallback(async () => {
    if (createdInvite?.code) return createdInvite;
    if (isCreatingInvite) return null;

    const organization = inviteModalOrganization || activeOrganization;
    const organizationId = getOrganizationId(organization);
    if (!organizationId) return null;

    setIsCreatingInvite(true);
    try {
      const invite = await createOrganizationInvite(
        organizationId,
        buildInvitePayload(inviteForm, {
          canBypassApproval: canBypassInviteApproval(organization),
        }),
      );
      setCreatedInvite(invite);
      refreshContext();
      return invite;
    } finally {
      setIsCreatingInvite(false);
    }
  }, [
    activeOrganization,
    createdInvite,
    inviteForm,
    inviteModalOrganization,
    isCreatingInvite,
    refreshContext,
  ]);

  const handleCopyInviteCode = useCallback(async () => {
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
        error?.response?.data?.message || "Không thể sao chép mã mời",
        {
          description:
            "Mã mời chưa được đưa vào clipboard. Hãy thử bấm Sao chép lại hoặc copy thủ công.",
        },
      );
    }
  }, [createInviteForCurrentForm, createdInvite, message]);

  const handleCreateInvite = useCallback(
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
          error?.response?.data?.message || "Không thể sao chép liên kết mời",
          {
            description:
              "Liên kết mời chưa được đưa vào clipboard. Hãy tạo lại mã hoặc thử sao chép sau.",
          },
        );
      }
    },
    [createdInvite, message],
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
          {
            description: organization.isFavorite
              ? `${getOrganizationName(
                  organization,
                )} đã được bỏ khỏi danh sách ưu tiên.`
              : `${getOrganizationName(
                  organization,
                )} sẽ được ưu tiên hiển thị trong danh sách tổ chức.`,
          },
        );
      } catch (error) {
        console.error("Failed to update favorite organization:", error);
        message.error(
          error?.response?.data?.message || "Không thể cập nhật yêu thích",
          {
            description:
              "Trạng thái yêu thích của tổ chức chưa được lưu. Hãy thử lại sau.",
          },
        );
      }
    },
    [message, refreshContext],
  );

  const handleLeaveOrganization = useCallback(
    async (event, organization) => {
      event?.stopPropagation?.();
      const organizationId = getOrganizationId(organization);
      if (!organizationId || organization?.isOwner || isLeavingId) return;

      setIsLeavingId(organizationId);
      try {
        await leaveOrganization(organizationId);
        if (expandedOrganizationId === organizationId) {
          setExpandedOrganizationId("");
          setDetailMembers([]);
        }
        message.success("Đã rời tổ chức", {
          description: `${getOrganizationName(
            organization,
          )} đã được gỡ khỏi danh sách tổ chức của bạn.`,
        });
        return true;
      } catch (error) {
        console.error("Failed to leave organization:", error);
        message.error(error?.response?.data?.message || "Không thể rời tổ chức", {
          description:
            "Tài khoản của bạn vẫn còn trong tổ chức này. Hãy thử lại hoặc liên hệ quản trị viên.",
        });
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
      if (!organization || organization.isOwner) return;
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
        message.success("Đã hủy yêu cầu tham gia", {
          description: `${getOrganizationName(
            organization,
          )} sẽ không còn thấy yêu cầu chờ duyệt của bạn.`,
        });
      } catch (error) {
        console.error("Failed to cancel organization request:", error);
        message.error(error?.response?.data?.message || "Không thể hủy yêu cầu", {
          description:
            "Yêu cầu tham gia vẫn đang chờ duyệt. Hãy thử hủy lại sau.",
        });
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
        message.success("Đã cập nhật tổ chức", {
          description: `${editForm.name.trim()} đã lưu thay đổi tên, mô tả hoặc màu nhận diện.`,
        });
      } catch (error) {
        console.error("Failed to update organization:", error);
        message.error(error?.response?.data?.message || "Không thể cập nhật", {
          description:
            "Thông tin tổ chức chưa được lưu. Hãy kiểm tra dữ liệu nhập và thử lại.",
        });
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
      message.success(nextInviteEnabled ? "Đã bật link mời" : "Đã tắt link mời", {
        description: nextInviteEnabled
          ? "Thành viên mới có thể dùng link mời hiện tại để gửi yêu cầu tham gia."
          : "Link mời công khai đã bị tắt và không thể dùng để tham gia tổ chức.",
      });
    } catch (error) {
      console.error("Failed to toggle invite:", error);
      message.error(error?.response?.data?.message || "Không thể cập nhật link", {
        description:
          "Trạng thái link mời chưa được thay đổi. Hãy thử lại trong phần quản trị tổ chức.",
      });
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
      message.success("Đã đổi link mời", {
        description:
          "Link mời cũ đã hết hiệu lực. Hãy chia sẻ link mới cho thành viên cần tham gia.",
      });
    } catch (error) {
      console.error("Failed to rotate invite:", error);
      message.error(error?.response?.data?.message || "Không thể đổi link mời", {
        description:
          "Link mời hiện tại vẫn giữ nguyên vì WorkHub chưa tạo được mã mới.",
      });
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
        message.error("Ảnh phải là JPG, PNG, GIF hoặc WebP", {
          description: `${file.name} không thuộc định dạng ảnh được WorkHub hỗ trợ.`,
        });
        return;
      }

      const maxSize = type === "banner" ? 8 * 1024 * 1024 : 5 * 1024 * 1024;
      if (file.size > maxSize) {
        message.error(
          type === "banner" ? "Biểu ngữ phải nhỏ hơn 8MB" : "Ảnh phải nhỏ hơn 5MB",
          {
            description: `${file.name} vượt giới hạn dung lượng cho ${
              type === "banner" ? "biểu ngữ tổ chức" : "ảnh đại diện tổ chức"
            }.`,
          },
        );
        return;
      }

      setUploadingMedia({ type, organizationId: target.organizationId });
      try {
        if (type === "banner") {
          await updateOrganizationBanner(target.organizationId, file);
          message.success("Đã cập nhật biểu ngữ", {
            description:
              "Ảnh biểu ngữ mới đã được áp dụng cho trang tổ chức.",
          });
        } else {
          await updateOrganizationLogo(target.organizationId, file);
          message.success("Đã cập nhật ảnh tổ chức", {
            description:
              "Ảnh đại diện mới đã được áp dụng trong danh sách tổ chức và hồ sơ workspace.",
          });
        }
      } catch (error) {
        console.error("Failed to upload organization media:", error);
        message.error(error?.response?.data?.message || "Không thể tải ảnh lên", {
          description:
            "Ảnh tổ chức chưa được cập nhật. Hãy kiểm tra định dạng, dung lượng hoặc thử lại sau.",
        });
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
          {
            description:
              action === "approve"
                ? "Thành viên mới đã được kích hoạt trong tổ chức."
                : "Yêu cầu tham gia đã bị đóng và không được thêm vào tổ chức.",
          },
        );
      } catch (error) {
        console.error("Failed to review organization request:", error);
        message.error(error?.response?.data?.message || "Không thể xử lý yêu cầu", {
          description:
            "Trạng thái yêu cầu tham gia chưa được cập nhật. Hãy thử duyệt lại sau.",
        });
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
        message.success("Đã cập nhật thông báo", {
          description: message.body({
            text: "Tùy chọn thông báo của tài khoản đã được lưu.",
            rows: [
              { label: "Cài đặt", value: key },
              { label: "Trạng thái", value: nextValue ? "Bật" : "Tắt" },
            ],
          }),
        });
      } catch (error) {
        console.error("Failed to update notification settings:", error);
        setNotificationSettings(previous);
        message.error(
          error?.response?.data?.message || "Không thể cập nhật thông báo",
          {
            description:
              "Tùy chọn thông báo vừa thay đổi đã được hoàn tác trên giao diện.",
          },
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
          message.error("Không thể tải cài đặt thông báo", {
            description:
              "Bảng thông báo chưa có trạng thái bật/tắt mới nhất của tài khoản.",
          });
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
      activeMembers,
      activeOrganization,
      activeOrganizationId,
      actionModal,
      canManageSelectedOrganization,
      createForm,
      createdInvite,
      detailMembers,
      dashboardAction,
      editForm,
      expandedOrganizationId,
      inviteForm,
      inviteLink,
      inviteModalOpen,
      inviteModalOrganization,
      isCreating,
      isCreatingInvite,
      isJoining,
      isLeavingId,
      isLoadingMembers,
      isLoadingNotifications,
      isRotatingInvite,
      isSwitchingId,
      isUpdating,
      joinAnswers,
      joinPreview,
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
      handleCopyInviteCode,
      handleCreateInvite,
      handleCreate,
      handleChangeJoinAnswer,
      handleJoin,
      handleLeaveOrganization,
      handleMediaFileChange,
      handleOpenDetails,
      handleOpenInviteModal,
      handleOpenLeaveModal,
      handleOpenNotificationPanel,
      handleReviewRequest,
      handleRotateInvite,
      handleSubmitJoinQuestions,
      handleSwitch,
      handleToggleFavorite,
      handleToggleInvite,
      handleToggleNotificationSetting,
      handleUpdateSelectedOrganization,
      openMediaUpload,
      closeJoinQuestions,
      closeInviteModal,
      setActionModal,
      setCreateForm,
      setEditForm,
      setInviteForm: changeInviteForm,
      setInviteLink,
      setNotificationPanelOpen,
      setOpenMenuId,
    },
  };
};
