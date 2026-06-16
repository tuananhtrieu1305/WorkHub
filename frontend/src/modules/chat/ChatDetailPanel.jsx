import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addConversationMember,
  downloadConversationAttachmentBlob,
  getConversationDetail,
  updateConversation,
  updateConversationSettings,
  uploadConversationAttachment,
} from "../../api/conversationApi";
import { searchUsers } from "../../api/userApi";
import {
  getActivityStatusMeta,
  getEffectiveActivityStatus,
} from "./activityStatus";
import ActivityStatusIcon from "./ActivityStatusIcon";
import { getChatDetailDisplay } from "./chatDetailPanelState";
import { PollDetailModal } from "./PollMessage";
import { ReminderDetailModal } from "./ReminderMessage";
import UserProfileModal from "../profile/UserProfileModal";
import {
  getAvatarReferrerPolicy,
  getAvatarUrl,
} from "../../utils/avatar";

const API_URL = import.meta.env.VITE_NODE_API_URL || "http://localhost:5000";

const toComparableId = (value) => {
  if (value == null) return "";
  if (typeof value === "object") return String(value.id || value._id || "");
  return String(value);
};

const getConversationId = (conversation) =>
  toComparableId(conversation?.id || conversation?._id);

const getMessageId = (message) =>
  toComparableId(message?.id || message?._id || message?.messageId);

const getParticipantUser = (participant = {}) =>
  participant.user || participant.userId || participant;

const getParticipantUserId = (participant = {}) =>
  toComparableId(
    participant.user?.id ||
      participant.user?._id ||
      participant.userId?.id ||
      participant.userId?._id ||
      participant.userId,
  );

const isNonEmptyArray = (value) => Array.isArray(value) && value.length > 0;

const normalizeDetailPayload = (payload = {}) => ({
  conversation: payload.conversation || null,
  board: {
    reminders: Array.isArray(payload.board?.reminders)
      ? payload.board.reminders
      : Array.isArray(payload.reminders)
        ? payload.reminders
        : [],
    polls: Array.isArray(payload.board?.polls)
      ? payload.board.polls
      : Array.isArray(payload.polls)
        ? payload.polls
        : [],
    pinnedMessages: Array.isArray(payload.board?.pinnedMessages)
      ? payload.board.pinnedMessages
      : Array.isArray(payload.pinnedMessages)
        ? payload.pinnedMessages
        : [],
  },
  shared: {
    media: Array.isArray(payload.shared?.media)
      ? payload.shared.media
      : Array.isArray(payload.media)
        ? payload.media
        : [],
    files: Array.isArray(payload.shared?.files)
      ? payload.shared.files
      : Array.isArray(payload.files)
        ? payload.files
        : [],
    links: Array.isArray(payload.shared?.links)
      ? payload.shared.links
      : Array.isArray(payload.links)
        ? payload.links
        : [],
  },
});

const findMessageInDetail = (detail, messageId) => {
  const targetId = toComparableId(messageId);
  if (!targetId) return null;

  const board = detail?.board || {};
  return [
    ...(board.reminders || []),
    ...(board.polls || []),
    ...(board.pinnedMessages || []),
  ].find((message) => getMessageId(message) === targetId);
};

const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
};

const formatFileSize = (value) => {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const getFileUrl = (url) => {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${API_URL}${path}`;
};

const isInternalApiFileUrl = (url = "") => {
  const rawUrl = String(url || "");
  if (rawUrl.startsWith("/api/")) return true;
  if (!rawUrl.startsWith("http")) return false;

  try {
    const parsedUrl = new URL(rawUrl);
    const parsedApiUrl = new URL(API_URL);
    return (
      parsedUrl.origin === parsedApiUrl.origin &&
      parsedUrl.pathname.startsWith("/api/")
    );
  } catch {
    return false;
  }
};

const useAttachmentObjectUrl = (attachment, enabled = true) => {
  const rawFileUrl = attachment?.fileUrl || "";
  const fileUrl = getFileUrl(rawFileUrl);
  const needsBlob =
    enabled &&
    Boolean(fileUrl) &&
    (isInternalApiFileUrl(rawFileUrl) || isInternalApiFileUrl(fileUrl));
  const [objectUrl, setObjectUrl] = useState("");
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let nextObjectUrl = "";

    setObjectUrl("");
    setHasError(false);

    if (!needsBlob) return undefined;

    const loadAttachment = async () => {
      try {
        const blob = await downloadConversationAttachmentBlob(
          rawFileUrl || fileUrl,
        );
        if (!blob?.size || typeof URL.createObjectURL !== "function") {
          throw new Error("Attachment blob is empty");
        }

        nextObjectUrl = URL.createObjectURL(blob);
        if (!cancelled) setObjectUrl(nextObjectUrl);
      } catch (error) {
        console.error("Failed to load conversation detail media:", error);
        if (!cancelled) setHasError(true);
      }
    };

    loadAttachment();

    return () => {
      cancelled = true;
      if (nextObjectUrl) URL.revokeObjectURL?.(nextObjectUrl);
    };
  }, [fileUrl, needsBlob, rawFileUrl]);

  return {
    src: needsBlob ? objectUrl : fileUrl,
    isLoading: needsBlob && !objectUrl && !hasError,
    hasError,
  };
};

const triggerAttachmentDownload = async (attachment = {}) => {
  const rawFileUrl = attachment.fileUrl || "";
  const fileUrl = getFileUrl(rawFileUrl);
  const fileName = attachment.fileName || "attachment";

  if (!fileUrl || typeof document === "undefined") {
    throw new Error("Attachment URL is missing");
  }

  if (!isInternalApiFileUrl(rawFileUrl) && !isInternalApiFileUrl(fileUrl)) {
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = fileName;
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }

  const blob = await downloadConversationAttachmentBlob(rawFileUrl || fileUrl);
  if (!blob?.size || typeof URL.createObjectURL !== "function") {
    throw new Error("Attachment is empty or unsupported");
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL?.(objectUrl), 1000);
};

const muteDurations = [
  { key: "1h", label: "1 giờ" },
  { key: "8h", label: "8 giờ" },
  { key: "24h", label: "24 giờ" },
  { key: "7d", label: "7 ngày" },
  { key: "forever", label: "Luôn tắt" },
];

const sectionShellClass =
  "chat-detail-section border-b border-slate-200/80 bg-white/85 px-4 py-4 last:border-b-0";

const iconButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm shadow-slate-900/[0.03] transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:translate-y-0";

const EmptySection = ({ icon, text }) => (
  <div className="flex min-h-[5.25rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/85 px-3 py-4 text-center">
    <span className="material-symbols-outlined mb-1 text-2xl text-slate-400">
      {icon}
    </span>
    <p className="text-xs font-bold leading-5 text-slate-500">{text}</p>
  </div>
);

const SectionHeader = ({
  icon,
  title,
  count,
  accent = "blue",
  action,
  collapseButton,
}) => {
  const accentClassName =
    accent === "emerald"
      ? "bg-emerald-50 text-emerald-600"
      : accent === "amber"
        ? "bg-amber-50 text-amber-600"
        : accent === "rose"
          ? "bg-rose-50 text-rose-600"
          : accent === "violet"
            ? "bg-violet-50 text-violet-600"
            : "bg-blue-50 text-blue-600";

  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="flex min-w-0 items-center gap-2 text-sm font-black text-slate-900">
        <span
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${accentClassName}`}
        >
          <span className="material-symbols-outlined text-[18px]">{icon}</span>
        </span>
        <span className="truncate">{title}</span>
        {typeof count === "number" && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">
            {count}
          </span>
        )}
      </h3>
      {(collapseButton || action) && (
        <div className="flex shrink-0 items-center gap-1.5">
          {collapseButton}
          {action}
        </div>
      )}
    </div>
  );
};

const getMessageTitle = (message) =>
  message?.poll?.question ||
  message?.reminder?.title ||
  message?.content ||
  (isNonEmptyArray(message?.attachments) ? "Tệp đính kèm" : "Tin nhắn");

const getPinnedMeta = (message) =>
  message?.pinnedAt
    ? `Ghim lúc ${formatDateTime(message.pinnedAt)}`
    : `${message?.sender?.fullName || "Người dùng"} · ${formatDateTime(
        message?.createdAt,
      )}`;

const MessageMiniRow = ({ message, icon, title, meta, tone = "blue", onClick }) => {
  const toneClassName =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-600"
      : tone === "amber"
        ? "bg-amber-50 text-amber-600"
        : tone === "rose"
          ? "bg-rose-50 text-rose-600"
          : tone === "violet"
            ? "bg-violet-50 text-violet-600"
            : "bg-blue-50 text-blue-600";
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`group flex w-full min-w-0 gap-2.5 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm shadow-slate-900/[0.03] transition-all duration-200 ${
        onClick
          ? "hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/25"
          : ""
      }`}
    >
      <span
        className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneClassName}`}
      >
        <span className="material-symbols-outlined text-[19px]">{icon}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-extrabold leading-snug text-slate-950">
          {title || getMessageTitle(message)}
        </span>
        <span className="mt-1 block truncate text-[11px] font-bold text-slate-500">
          {meta ||
            `${message?.sender?.fullName || "Người dùng"} · ${formatDateTime(
              message?.createdAt,
            )}`}
        </span>
      </span>
      {onClick && (
        <span className="material-symbols-outlined mt-1 text-[18px] text-slate-300 transition-colors group-hover:text-blue-500">
          chevron_right
        </span>
      )}
    </Wrapper>
  );
};

const DetailMediaTile = ({ item }) => {
  const { src, isLoading, hasError } = useAttachmentObjectUrl(item);
  const isVideo =
    String(item.mimeType || "").startsWith("video/") || item.kind === "video";

  const handleOpen = () => {
    const targetUrl = src || getFileUrl(item.fileUrl || "");
    if (targetUrl) window.open(targetUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="group relative aspect-square overflow-hidden rounded-2xl bg-slate-100 text-left shadow-sm ring-1 ring-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
      title={item.fileName || "Media"}
    >
      {isLoading ? (
        <span className="absolute inset-0 animate-pulse bg-slate-200" />
      ) : hasError || !src ? (
        <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-slate-50 px-2 text-center text-[11px] font-black text-slate-400">
          <span className="material-symbols-outlined text-[24px]">
            broken_image
          </span>
          Không tải được
        </span>
      ) : isVideo ? (
        <>
          <video
            src={src}
            className="h-full w-full object-cover"
            muted
            playsInline
            preload="metadata"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-slate-950/20 text-white">
            <span className="material-symbols-outlined text-[34px]">
              play_circle
            </span>
          </span>
        </>
      ) : (
        <img
          src={src}
          alt={item.fileName || "Ảnh đã chia sẻ"}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          loading="lazy"
        />
      )}
    </button>
  );
};

const FileRow = ({ item, isDownloading, hasError, onDownload }) => (
  <button
    type="button"
    onClick={onDownload}
    disabled={isDownloading}
    className="group flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm shadow-slate-900/[0.03] transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/25 disabled:cursor-wait disabled:opacity-70"
  >
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-white">
      <span className="material-symbols-outlined text-[22px]">
        {isDownloading ? "progress_activity" : "description"}
      </span>
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-black text-slate-950">
        {hasError ? "Không thể tải tệp" : item.fileName || "Tệp đã chia sẻ"}
      </span>
      <span className="block text-[11px] font-bold text-slate-500">
        {formatFileSize(item.fileSize) || formatDateTime(item.createdAt)}
      </span>
    </span>
    <span className="material-symbols-outlined text-[20px] text-slate-300 transition-colors group-hover:text-blue-600">
      download
    </span>
  </button>
);

const ChatDetailPanel = ({
  conversation,
  currentUserId,
  onConversationUpdated,
  onJumpToMessage,
  onRespondReminder,
  onCancelReminder,
  onEditReminder,
  onVotePoll,
  onAddPollOption,
  onTogglePinMessage,
  onSharePoll,
  onClosePoll,
  className = "hidden w-80 border-l border-slate-200 bg-white xl:flex",
}) => {
  const conversationId = getConversationId(conversation);
  const conversationDetailVersion = [
    conversationId,
    conversation?.lastActivityAt,
    conversation?.updatedAt,
    conversation?.lastMessage?.createdAt,
  ].join("|");
  const avatarInputRef = useRef(null);
  const [detail, setDetail] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [showMuteChoices, setShowMuteChoices] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [isMembersCollapsed, setIsMembersCollapsed] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberCandidates, setMemberCandidates] = useState([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isAddingMemberId, setIsAddingMemberId] = useState("");
  const [downloadingFileId, setDownloadingFileId] = useState("");
  const [downloadErrorId, setDownloadErrorId] = useState("");
  const [activeReminderMessage, setActiveReminderMessage] = useState(null);
  const [activePollMessage, setActivePollMessage] = useState(null);
  const [profileModalUser, setProfileModalUser] = useState(null);
  const [errorText, setErrorText] = useState("");

  const syncActiveMessagesFromDetail = useCallback((nextDetail) => {
    setActiveReminderMessage((current) =>
      current
        ? findMessageInDetail(nextDetail, getMessageId(current)) || current
        : current,
    );
    setActivePollMessage((current) =>
      current
        ? findMessageInDetail(nextDetail, getMessageId(current)) || current
        : current,
    );
  }, []);

  const loadConversationDetail = useCallback(
    async ({ silent = false, ignoreRef } = {}) => {
      if (!conversationId) {
        setDetail(null);
        return null;
      }

      if (!silent) {
        setIsLoadingDetail(true);
        setErrorText("");
      }

      try {
        const payload = await getConversationDetail(conversationId);
        if (ignoreRef?.current) return null;

        const normalizedPayload = normalizeDetailPayload(payload);
        setDetail(normalizedPayload);
        syncActiveMessagesFromDetail(normalizedPayload);
        if (normalizedPayload.conversation) {
          onConversationUpdated?.(normalizedPayload.conversation);
        }
        return normalizedPayload;
      } catch (error) {
        if (!ignoreRef?.current) {
          console.error("Failed to load conversation detail:", error);
          setErrorText("Không thể tải chi tiết hội thoại");
        }
        return null;
      } finally {
        if (!silent && !ignoreRef?.current) setIsLoadingDetail(false);
      }
    },
    [conversationId, onConversationUpdated, syncActiveMessagesFromDetail],
  );

  useEffect(() => {
    const ignoreRef = { current: false };
    loadConversationDetail({ ignoreRef });
    return () => {
      ignoreRef.current = true;
    };
  }, [conversationDetailVersion, loadConversationDetail]);

  const activeConversation = detail?.conversation || conversation;
  const display = getChatDetailDisplay(activeConversation, currentUserId);
  const {
    isPrivate,
    participantCount,
    displayName,
    displayInitial,
    originalName,
    email,
    avatar,
    activityStatus,
    isOnline,
  } = display || {};
  const displayAvatar = getAvatarUrl(avatar);
  const settings = activeConversation?.currentParticipant || {};
  const isPinned = Boolean(settings.isPinned);
  const isMuted = Boolean(settings.isMuted);
  const board = detail?.board || {};
  const shared = detail?.shared || {};
  const participants = useMemo(
    () => activeConversation?.participants || [],
    [activeConversation?.participants],
  );
  const memberIds = useMemo(
    () =>
      new Set(
        participants.map((participant) =>
          toComparableId(participant.userId || participant.user),
        ),
      ),
    [participants],
  );
  const visibleCandidates = memberCandidates.filter(
    (item) => !memberIds.has(toComparableId(item.id || item._id)),
  );
  const activityStatusMeta = getActivityStatusMeta(
    getEffectiveActivityStatus({ activityStatus, isOnline }),
  );

  useEffect(() => {
    setNameDraft(displayName || "");
    setEditingName(false);
    setShowMuteChoices(false);
    setShowMemberPicker(false);
    setMemberQuery("");
    setMemberCandidates([]);
    setDownloadErrorId("");
    setActiveReminderMessage(null);
    setActivePollMessage(null);
    setProfileModalUser(null);
  }, [conversationId, displayName]);

  useEffect(() => {
    if (!showMemberPicker) return undefined;

    let ignore = false;
    setIsLoadingMembers(true);
    searchUsers({ keyword: memberQuery, size: 12 })
      .then((payload) => {
        if (!ignore) setMemberCandidates(payload.content || []);
      })
      .catch((error) => {
        if (!ignore) {
          console.error("Failed to search members:", error);
          setMemberCandidates([]);
        }
      })
      .finally(() => {
        if (!ignore) setIsLoadingMembers(false);
      });

    return () => {
      ignore = true;
    };
  }, [showMemberPicker, memberQuery]);

  const mergeConversation = (updatedConversation) => {
    if (!updatedConversation) return;
    setDetail((prev) => ({
      ...(prev || {}),
      conversation: updatedConversation,
    }));
    onConversationUpdated?.(updatedConversation);
  };

  const mergeBoardMessage = useCallback((updatedMessage) => {
    const updatedMessageId = getMessageId(updatedMessage);
    if (!updatedMessageId) return;

    const mergeList = (items = []) =>
      items.map((item) =>
        getMessageId(item) === updatedMessageId ? { ...item, ...updatedMessage } : item,
      );

    setDetail((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        board: {
          ...(prev.board || {}),
          reminders: mergeList(prev.board?.reminders),
          polls: mergeList(prev.board?.polls),
          pinnedMessages: mergeList(prev.board?.pinnedMessages),
        },
      };
    });
    setActiveReminderMessage((current) =>
      getMessageId(current) === updatedMessageId
        ? { ...current, ...updatedMessage }
        : current,
    );
    setActivePollMessage((current) =>
      getMessageId(current) === updatedMessageId
        ? { ...current, ...updatedMessage }
        : current,
    );
  }, []);

  const handleSaveName = async (event) => {
    event?.preventDefault?.();
    if (!conversationId) return;
    const trimmedName = nameDraft.trim();
    if (!isPrivate && !trimmedName) return;

    setIsSavingName(true);
    setErrorText("");
    try {
      const payload = isPrivate
        ? await updateConversationSettings(conversationId, {
            nickname: trimmedName,
          })
        : await updateConversation(conversationId, {
            name: trimmedName,
          });
      mergeConversation(payload);
      setEditingName(false);
    } catch (error) {
      console.error("Failed to update conversation name:", error);
      setErrorText("Không thể lưu tên hội thoại");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleAvatarFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !conversationId || isPrivate) return;

    if (!file.type.startsWith("image/")) {
      setErrorText("Ảnh đoạn chat phải là tệp hình ảnh");
      return;
    }

    setIsSavingAvatar(true);
    setErrorText("");
    try {
      const uploaded = await uploadConversationAttachment(conversationId, file, {
        purpose: "avatar",
      });
      const payload = await updateConversation(conversationId, {
        avatar: uploaded.fileUrl,
      });
      mergeConversation(payload);
    } catch (error) {
      console.error("Failed to update conversation avatar:", error);
      setErrorText("Không thể đổi ảnh đoạn chat");
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleSettingsUpdate = async (payload) => {
    if (!conversationId) return;
    setIsSavingSettings(true);
    setErrorText("");
    try {
      const updatedConversation = await updateConversationSettings(
        conversationId,
        payload,
      );
      mergeConversation(updatedConversation);
      setShowMuteChoices(false);
    } catch (error) {
      console.error("Failed to update conversation settings:", error);
      setErrorText("Không thể cập nhật thiết lập hội thoại");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleAddMember = async (userId) => {
    if (!conversationId || !userId) return;
    setIsAddingMemberId(toComparableId(userId));
    setErrorText("");
    try {
      const updatedConversation = await addConversationMember(
        conversationId,
        userId,
      );
      mergeConversation(updatedConversation);
      setMemberQuery("");
      setShowMemberPicker(false);
      setIsMembersCollapsed(false);
    } catch (error) {
      console.error("Failed to add member:", error);
      setErrorText("Không thể thêm thành viên vào nhóm");
    } finally {
      setIsAddingMemberId("");
    }
  };

  const handleDownloadFile = async (item) => {
    const itemId = item.id || item.fileUrl || item.fileName;
    setDownloadingFileId(itemId);
    setDownloadErrorId("");
    try {
      await triggerAttachmentDownload(item);
    } catch (error) {
      console.error("Failed to download conversation detail file:", error);
      setDownloadErrorId(itemId);
    } finally {
      setDownloadingFileId("");
    }
  };

  const runMessageAction = async (action) => {
    const updatedMessage = await action();
    if (updatedMessage) mergeBoardMessage(updatedMessage);
    await loadConversationDetail({ silent: true });
    return updatedMessage;
  };

  const handleReminderRespond = (message, status) =>
    runMessageAction(() => onRespondReminder?.(message, status));

  const handleReminderCancel = (message) =>
    runMessageAction(() => onCancelReminder?.(message));

  const handleReminderEdit = (message, reminder) =>
    runMessageAction(() => onEditReminder?.(message, reminder));

  const handlePollVote = (message, optionIds) =>
    runMessageAction(() => onVotePoll?.(message, optionIds));

  const handlePollAddOption = (message, text) =>
    runMessageAction(() => onAddPollOption?.(message, text));

  const handlePollTogglePin = (message) =>
    runMessageAction(() => onTogglePinMessage?.(message));

  const handlePollShare = (message) =>
    runMessageAction(() => onSharePoll?.(message));

  const handlePollClose = (message) =>
    runMessageAction(() => onClosePoll?.(message));

  if (!activeConversation || !display) return null;

  return (
    <aside
      className={`chat-detail-panel h-full shrink-0 flex-col overflow-hidden ${className}`}
    >
      <div className="chat-conversations-scroll min-h-0 flex-1 overflow-y-auto bg-slate-50/80">
        <section className="relative overflow-hidden border-b border-slate-200/80 bg-white px-4 py-5">
          <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_24%_10%,rgba(37,99,235,0.15),transparent_42%),radial-gradient(circle_at_86%_16%,rgba(16,185,129,0.13),transparent_36%)]" />
          <div className="relative flex flex-col items-center text-center">
            <button
              type="button"
              className={`relative rounded-3xl ${
                isPrivate ? "cursor-default" : "cursor-pointer"
              }`}
              onClick={() => {
                if (!isPrivate) avatarInputRef.current?.click();
              }}
              title={isPrivate ? originalName || displayName : "Đổi ảnh đoạn chat"}
              disabled={isSavingAvatar}
            >
              {displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt={displayName}
                  referrerPolicy={getAvatarReferrerPolicy(displayAvatar)}
                  className={`h-24 w-24 object-cover shadow-xl shadow-slate-950/15 ring-4 ring-white ${
                    isPrivate ? "rounded-full" : "rounded-3xl"
                  }`}
                />
              ) : (
                <div
                  className={`flex h-24 w-24 items-center justify-center bg-gradient-to-br from-blue-600 via-cyan-500 to-emerald-400 text-3xl font-black text-white shadow-xl shadow-blue-900/20 ring-4 ring-white ${
                    isPrivate ? "rounded-full" : "rounded-3xl"
                  }`}
                >
                  {displayInitial}
                </div>
              )}
              {isPrivate && (
                <div
                  className={`activity-status-badge activity-status-badge--large absolute bottom-1 right-1 ${activityStatusMeta.badgeClassName}`}
                  title={activityStatusMeta.menuLabel}
                >
                  <ActivityStatusIcon meta={activityStatusMeta} size="sm" />
                </div>
              )}
              {!isPrivate && (
                <span className="absolute -bottom-1 -right-1 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-blue-700 shadow-lg shadow-slate-900/10 transition hover:bg-blue-50">
                  <span className="material-symbols-outlined text-[19px]">
                    photo_camera
                  </span>
                </span>
              )}
              {isSavingAvatar && (
                <span className="absolute inset-0 inline-flex items-center justify-center rounded-3xl bg-slate-950/45 text-xs font-black text-white backdrop-blur-sm">
                  Đang lưu
                </span>
              )}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFileChange}
            />

            <form className="mt-4 w-full" onSubmit={handleSaveName}>
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    value={nameDraft}
                    onChange={(event) => setNameDraft(event.target.value)}
                    className="min-w-0 flex-1 rounded-xl border border-blue-200 bg-white px-3 py-2 text-center text-base font-black text-slate-950 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                    autoFocus
                    maxLength={isPrivate ? 80 : 120}
                  />
                  <button
                    type="submit"
                    className={iconButtonClass}
                    disabled={isSavingName}
                    title="Lưu tên"
                  >
                    <span className="material-symbols-outlined text-[19px]">
                      check
                    </span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="group inline-flex max-w-full items-center justify-center gap-1.5 rounded-xl px-2 py-1 text-lg font-black text-slate-950 transition-colors hover:bg-blue-50 hover:text-blue-700"
                  onClick={() => {
                    setNameDraft(displayName);
                    setEditingName(true);
                  }}
                  title={isPrivate ? "Đổi tên gợi nhớ" : "Đổi tên đoạn chat"}
                >
                  <span className="truncate">{displayName}</span>
                  <span className="material-symbols-outlined text-[17px] text-slate-400 group-hover:text-blue-600">
                    edit
                  </span>
                </button>
              )}
            </form>

            {isPrivate && email && (
              <p className="mt-1 max-w-full break-all text-xs font-bold text-slate-500">
                {originalName !== displayName
                  ? `${originalName} · ${email}`
                  : email}
              </p>
            )}

            {!isPrivate && (
              <p className="mt-1 text-xs font-bold text-slate-500">
                {participantCount} thành viên trong nhóm
              </p>
            )}

            {errorText && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                {errorText}
              </p>
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-black shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 ${
                isMuted
                  ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              }`}
              disabled={isSavingSettings}
              onClick={() =>
                isMuted
                  ? handleSettingsUpdate({ muteDuration: "off" })
                  : setShowMuteChoices((value) => !value)
              }
            >
              <span className="material-symbols-outlined text-[19px]">
                {isMuted ? "notifications_off" : "notifications"}
              </span>
              {isMuted ? "Bật thông báo" : "Tắt thông báo"}
            </button>
            <button
              type="button"
              className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-black shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 ${
                isPinned
                  ? "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100"
                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              }`}
              disabled={isSavingSettings}
              onClick={() => handleSettingsUpdate({ isPinned: !isPinned })}
            >
              <span className="material-symbols-outlined text-[19px]">
                push_pin
              </span>
              {isPinned ? "Bỏ ghim" : "Ghim hội thoại"}
            </button>
          </div>

          {showMuteChoices && !isMuted && (
            <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg shadow-slate-900/[0.06]">
              {muteDurations.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  disabled={isSavingSettings}
                  onClick={() => handleSettingsUpdate({ muteDuration: item.key })}
                  className="rounded-xl px-2 py-2 text-xs font-black text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </section>

        {!isPrivate && (
          <section className={sectionShellClass}>
            <SectionHeader
              icon="groups"
              title="Thành viên"
              count={participantCount}
              accent="emerald"
              collapseButton={
                <button
                  type="button"
                  className={iconButtonClass}
                  onClick={() => setIsMembersCollapsed((value) => !value)}
                  title={isMembersCollapsed ? "Mở danh sách" : "Thu gọn"}
                  aria-expanded={!isMembersCollapsed}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {isMembersCollapsed ? "expand_more" : "expand_less"}
                  </span>
                </button>
              }
              action={
                <button
                  type="button"
                  className={iconButtonClass}
                  onClick={() => {
                    setIsMembersCollapsed(false);
                    setShowMemberPicker((value) => !value);
                  }}
                  title="Thêm thành viên"
                >
                  <span className="material-symbols-outlined text-[19px]">
                    person_add
                  </span>
                </button>
              }
            />

            {!isMembersCollapsed && (
              <>
                {showMemberPicker && (
                  <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 p-2.5">
                    <input
                      value={memberQuery}
                      onChange={(event) => setMemberQuery(event.target.value)}
                      placeholder="Tìm thành viên..."
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                    />
                    <div className="mt-2 grid gap-1.5">
                      {isLoadingMembers ? (
                        <p className="py-2 text-center text-xs font-bold text-slate-500">
                          Đang tìm...
                        </p>
                      ) : visibleCandidates.length === 0 ? (
                        <p className="py-2 text-center text-xs font-bold text-slate-500">
                          Không có thành viên phù hợp
                        </p>
                      ) : (
                        visibleCandidates.map((candidate) => {
                          const candidateId = toComparableId(
                            candidate.id || candidate._id,
                          );
                          const avatarUrl = getAvatarUrl(candidate.avatar);
                          return (
                            <button
                              key={candidateId}
                              type="button"
                              onClick={() => handleAddMember(candidateId)}
                              disabled={isAddingMemberId === candidateId}
                              className="flex items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white"
                            >
                              {avatarUrl ? (
                                <img
                                  src={avatarUrl}
                                  alt={candidate.fullName}
                                  referrerPolicy={getAvatarReferrerPolicy(
                                    avatarUrl,
                                  )}
                                  className="h-9 w-9 rounded-xl object-cover"
                                />
                              ) : (
                                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-xs font-black text-blue-700">
                                  {(candidate.fullName || "N")
                                    .charAt(0)
                                    .toUpperCase()}
                                </span>
                              )}
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-black text-slate-900">
                                  {candidate.fullName || "Người dùng"}
                                </span>
                                <span className="block truncate text-[11px] font-bold text-slate-500">
                                  {candidate.email}
                                </span>
                              </span>
                              <span className="material-symbols-outlined text-[18px] text-blue-600">
                                add
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                <div className="grid gap-2">
                  {participants.map((participant, idx) => {
                    const user = getParticipantUser(participant);
                    const userId = getParticipantUserId(participant);
                    const name = user?.fullName || "Người dùng";
                    const avatarUrl = getAvatarUrl(user?.avatar);
                    const isCurrentUser =
                      userId && userId === toComparableId(currentUserId);
                    return (
                      <button
                        type="button"
                        key={userId || idx}
                        onClick={() => {
                          if (!isCurrentUser) setProfileModalUser(user);
                        }}
                        className="group flex items-center gap-2.5 rounded-2xl bg-slate-50 px-2.5 py-2 text-left transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={name}
                            referrerPolicy={getAvatarReferrerPolicy(avatarUrl)}
                            className="h-10 w-10 rounded-xl object-cover"
                          />
                        ) : (
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200 text-sm font-black text-slate-700">
                            {name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-black text-slate-900">
                            {isCurrentUser ? "Bạn" : name}
                          </span>
                          <span className="block truncate text-[11px] font-bold text-slate-500">
                            {user?.email || "Thành viên nhóm"}
                          </span>
                        </span>
                        {!isCurrentUser && (
                          <span className="material-symbols-outlined text-[18px] text-slate-300 transition-colors group-hover:text-blue-500">
                            badge
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        )}

        <section className={sectionShellClass}>
          <SectionHeader
            icon="event"
            title="Nhắc hẹn"
            count={(board.reminders || []).length}
            accent="amber"
          />
          {isLoadingDetail ? (
            <EmptySection icon="sync" text="Đang tải nhắc hẹn..." />
          ) : isNonEmptyArray(board.reminders) ? (
            <div className="grid gap-2">
              {board.reminders.map((message) => (
                <MessageMiniRow
                  key={getMessageId(message)}
                  message={message}
                  icon="event"
                  tone="amber"
                  title={message.reminder?.title || message.content}
                  meta={formatDateTime(
                    message.reminder?.scheduledAt || message.createdAt,
                  )}
                  onClick={() => setActiveReminderMessage(message)}
                />
              ))}
            </div>
          ) : (
            <EmptySection icon="event_busy" text="Chưa có nhắc hẹn" />
          )}
        </section>

        {!isPrivate && (
          <section className={sectionShellClass}>
            <SectionHeader
              icon="poll"
              title="Bình chọn"
              count={(board.polls || []).length}
              accent="violet"
            />
            {isLoadingDetail ? (
              <EmptySection icon="sync" text="Đang tải bình chọn..." />
            ) : isNonEmptyArray(board.polls) ? (
              <div className="grid gap-2">
                {board.polls.map((message) => (
                  <MessageMiniRow
                    key={getMessageId(message)}
                    message={message}
                    icon="poll"
                    tone="violet"
                    title={message.poll?.question || message.content}
                    meta={`${message.poll?.totalVoters ?? 0} người đã bình chọn`}
                    onClick={() => setActivePollMessage(message)}
                  />
                ))}
              </div>
            ) : (
              <EmptySection icon="ballot" text="Chưa có bình chọn" />
            )}
          </section>
        )}

        <section className={sectionShellClass}>
          <SectionHeader
            icon="push_pin"
            title="Tin nhắn được ghim"
            count={(board.pinnedMessages || []).length}
            accent="rose"
          />
          {isLoadingDetail ? (
            <EmptySection icon="sync" text="Đang tải tin ghim..." />
          ) : isNonEmptyArray(board.pinnedMessages) ? (
            <div className="grid gap-2">
              {board.pinnedMessages.map((message) => (
                <MessageMiniRow
                  key={getMessageId(message)}
                  message={message}
                  icon="push_pin"
                  tone="rose"
                  title={getMessageTitle(message)}
                  meta={getPinnedMeta(message)}
                  onClick={() => onJumpToMessage?.(message)}
                />
              ))}
            </div>
          ) : (
            <EmptySection icon="keep_off" text="Chưa ghim tin nhắn" />
          )}
        </section>

        <section className={sectionShellClass}>
          <SectionHeader
            icon="photo_library"
            title="Ảnh/Video"
            count={(shared.media || []).length}
            accent="blue"
          />
          {isNonEmptyArray(shared.media) ? (
            <div className="grid grid-cols-3 gap-2">
              {shared.media.map((item, index) => (
                <DetailMediaTile
                  key={item.id || `${item.fileUrl}-${index}`}
                  item={item}
                />
              ))}
            </div>
          ) : (
            <EmptySection icon="perm_media" text="Chưa có ảnh hoặc video" />
          )}
        </section>

        <section className={sectionShellClass}>
          <SectionHeader
            icon="folder"
            title="File"
            count={(shared.files || []).length}
            accent="emerald"
          />
          {isNonEmptyArray(shared.files) ? (
            <div className="grid gap-2">
              {shared.files.map((item, index) => {
                const itemId = item.id || item.fileUrl || `${item.fileName}-${index}`;
                return (
                  <FileRow
                    key={itemId}
                    item={item}
                    isDownloading={downloadingFileId === itemId}
                    hasError={downloadErrorId === itemId}
                    onDownload={() => handleDownloadFile(item)}
                  />
                );
              })}
            </div>
          ) : (
            <EmptySection icon="draft" text="Chưa có file" />
          )}
        </section>

        <section className={sectionShellClass}>
          <SectionHeader
            icon="link"
            title="Link"
            count={(shared.links || []).length}
            accent="violet"
          />
          {isNonEmptyArray(shared.links) ? (
            <div className="grid gap-2">
              {shared.links.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group block min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-900/[0.03] transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/25"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-blue-600">
                      open_in_new
                    </span>
                    <span className="block truncate text-sm font-black text-blue-700">
                      {item.title}
                    </span>
                  </span>
                  <span className="mt-1 line-clamp-2 text-[11px] font-bold text-slate-500">
                    {item.contentPreview || formatDateTime(item.createdAt)}
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <EmptySection icon="link_off" text="Chưa có link" />
          )}
        </section>
      </div>

      <UserProfileModal
        open={Boolean(profileModalUser)}
        userId={profileModalUser?._id || profileModalUser?.id}
        userPreview={profileModalUser}
        onClose={() => setProfileModalUser(null)}
      />

      <ReminderDetailModal
        message={activeReminderMessage}
        reminder={activeReminderMessage?.reminder}
        onClose={() => setActiveReminderMessage(null)}
        onRespond={handleReminderRespond}
        onCancelReminder={handleReminderCancel}
        onEditReminder={handleReminderEdit}
      />

      <PollDetailModal
        message={activePollMessage}
        poll={activePollMessage?.poll}
        onClose={() => setActivePollMessage(null)}
        onVote={handlePollVote}
        onAddOption={handlePollAddOption}
        onTogglePin={handlePollTogglePin}
        onSharePoll={handlePollShare}
        onClosePoll={handlePollClose}
      />
    </aside>
  );
};

export default ChatDetailPanel;
