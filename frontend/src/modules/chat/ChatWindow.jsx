import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import { App } from "antd";
import { useAuth } from "../../context/AuthContext";
import { getAvatarReferrerPolicy, getAvatarUrl } from "../../utils/avatar";
import {
  getActivityStatusMeta,
  getEffectiveActivityStatus,
} from "./activityStatus";
import ActivityStatusIcon from "./ActivityStatusIcon";
import { buildMessageTimeline } from "./messageTimeline";
import { getMessagePreviewText } from "./chatMessagePreview";

const getComparableId = (value) => {
  if (value == null) return "";
  if (typeof value === "object") {
    return String(value._id || value.id || "");
  }
  return String(value);
};

const getMessageSenderId = (message) =>
  getComparableId(message?.sender?._id || message?.sender?.id || message?.sender);

const getDraftPreviewText = (message) => {
  return getMessagePreviewText(message);
};

const getPinnedMessagePreviewText = (message) => {
  return getMessagePreviewText(message);
};

const getPinnedSenderName = (message, currentUserId) => {
  const senderId = getMessageSenderId(message);
  if (senderId && senderId === currentUserId) return "Bạn";
  return message?.sender?.fullName || "Người dùng";
};

const formatPinnedMessageDate = (dateValue) => {
  if (!dateValue) return "";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const PinnedSenderAvatar = ({ message, senderName }) => {
  const avatarUrl = getAvatarUrl(message?.sender?.avatar);
  const senderInitial = (senderName || "N").charAt(0).toUpperCase();

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={senderName}
        referrerPolicy={getAvatarReferrerPolicy(avatarUrl)}
        className="h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-white shadow-md shadow-slate-900/10"
        loading="lazy"
      />
    );
  }

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-sm font-extrabold text-slate-700 ring-2 ring-white shadow-md shadow-slate-900/10">
      {senderInitial}
    </span>
  );
};

const waitForMessageRender = () =>
  new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    });
  });

const ActivityStatusBadge = ({ meta }) => (
  <span
    className={`absolute bottom-0 right-0 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white ${meta.badgeClassName}`}
  >
    <ActivityStatusIcon meta={meta} size="xs" />
  </span>
);

const PinnedMessageBar = ({ pinnedMessages, currentUserId, onOpen }) => {
  const pinnedMessage = pinnedMessages[0];
  if (!pinnedMessage) return null;

  const senderName = getPinnedSenderName(pinnedMessage, currentUserId);
  const previewText = getPinnedMessagePreviewText(pinnedMessage);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="chat-pinned-summary flex w-full shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:px-6"
      aria-label="Mở danh sách tin nhắn đã ghim"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <span className="material-symbols-outlined text-[20px]">push_pin</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-bold text-slate-900">
            {senderName}
          </span>
          {pinnedMessages.length > 1 && (
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
              {pinnedMessages.length}
            </span>
          )}
        </span>
        <span className="block truncate text-sm font-semibold text-slate-600">
          {previewText}
        </span>
      </span>
      <span className="material-symbols-outlined shrink-0 text-[22px] text-slate-500">
        keyboard_arrow_down
      </span>
    </button>
  );
};

const PinnedMessagesModal = ({
  isOpen,
  pinnedMessages,
  currentUserId,
  onClose,
  onJumpToMessage,
  onUnpinMessage,
}) => {
  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="chat-pinned-modal-backdrop fixed inset-0 z-[10020] flex items-center justify-center bg-slate-950/50 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        className="chat-pinned-modal flex max-h-[min(42rem,calc(100dvh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl shadow-slate-950/25"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-pinned-modal-title"
      >
        <div className="grid shrink-0 grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-5">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-amber-600"
            aria-hidden="true"
          >
            <span className="material-symbols-outlined text-[20px]">
              push_pin
            </span>
          </span>
          <h3
            id="chat-pinned-modal-title"
            className="truncate text-center text-lg font-extrabold text-slate-950"
          >
            Tin nhắn đã ghim
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-all duration-200 hover:bg-slate-200 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-95"
            aria-label="Đóng danh sách tin nhắn đã ghim"
          >
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>
        <div className="chat-pinned-modal-body min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
          {pinnedMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="material-symbols-outlined mb-2 text-4xl text-slate-300">
                push_pin
              </span>
              <p className="text-sm font-bold text-slate-600">
                Chưa có tin nhắn đã ghim
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pinnedMessages.map((pinnedMessage) => {
                const pinnedMessageId =
                  pinnedMessage.id || pinnedMessage._id || pinnedMessage.pinnedAt;
                const senderName = getPinnedSenderName(
                  pinnedMessage,
                  currentUserId,
                );
                const previewText = getPinnedMessagePreviewText(pinnedMessage);
                const originalDate = formatPinnedMessageDate(pinnedMessage.createdAt);

                return (
                  <article
                    key={pinnedMessageId}
                    className="chat-pinned-item grid gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-900/[0.04] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-4"
                  >
                    <div className="flex min-w-0 gap-3">
                      <PinnedSenderAvatar
                        message={pinnedMessage}
                        senderName={senderName}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <span className="truncate text-sm font-extrabold text-slate-950">
                            {senderName}
                          </span>
                          {originalDate && (
                            <span className="inline-flex min-w-0 items-center gap-1 text-xs font-semibold text-slate-500">
                              <span
                                className="material-symbols-outlined text-[15px] text-blue-500"
                                aria-hidden="true"
                              >
                                schedule
                              </span>
                              <span className="truncate">
                                {originalDate}
                              </span>
                            </span>
                          )}
                        </div>
                        <p
                          className="chat-pinned-preview mt-2 text-sm font-semibold leading-6 text-slate-700"
                          title={previewText}
                        >
                          {previewText}
                        </p>
                      </div>
                    </div>
                    <div className="chat-pinned-item-actions flex shrink-0 flex-wrap gap-2 sm:justify-end">
                      <button
                        type="button"
                        onClick={() => onJumpToMessage?.(pinnedMessage)}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-bold text-blue-700 transition-all duration-200 hover:border-blue-300 hover:bg-blue-100 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-[0.98]"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          subdirectory_arrow_right
                        </span>
                        <span className="truncate">Đi tới chat</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onUnpinMessage?.(pinnedMessage)}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 text-sm font-bold text-white shadow-sm shadow-slate-900/15 transition-all duration-200 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 active:scale-[0.98]"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          keep_off
                        </span>
                        <span className="truncate">Bỏ ghim</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
};

const messageSpacingClassNames = {
  "after-separator": "mt-2",
  tight: "mt-0.5",
  relaxed: "mt-2",
  default: "mt-3",
};

const SCROLL_BOTTOM_THRESHOLD_PX = 48;

const isViewingLatestMessage = (pane) => {
  if (!pane) return true;

  return (
    pane.scrollHeight - pane.scrollTop - pane.clientHeight <=
    SCROLL_BOTTOM_THRESHOLD_PX
  );
};

const ChatWindow = ({
  conversation,
  messages = [],
  pinnedMessages = [],
  onSendMessage,
  onUploadAttachment,
  onCreatePoll,
  onTypingChange,
  onReplyMessage,
  onEditMessage,
  onDeleteMessage,
  onCopyMessage,
  onTogglePinMessage,
  onEnsureMessageLoaded,
  onToggleReaction,
  onVotePoll,
  onAddPollOption,
  onSharePoll,
  onClosePoll,
  onCancelDraft,
  onStartCall,
  onBack,
  onToggleDetail,
  replyToMessage = null,
  editingMessage = null,
  typingUsers = [],
  isLoadingMessages = false,
  isSending = false,
}) => {
  const { user } = useAuth();
  const { message } = App.useApp();
  const messagesPaneRef = useRef(null);
  const messagesContentRef = useRef(null);
  const messageNodeRefs = useRef(new Map());
  const highlightTimeoutRef = useRef(null);
  const isViewingLatestMessageRef = useRef(true);
  const shouldStickToLatestMessageRef = useRef(true);
  const programmaticScrollUntilRef = useRef(0);
  const previousConversationIdRef = useRef("");
  const [highlightedMessageId, setHighlightedMessageId] = useState("");
  const [showScrollToBottomButton, setShowScrollToBottomButton] =
    useState(false);
  const [isPinnedListOpen, setIsPinnedListOpen] = useState(false);
  const conversationId = conversation?.id || conversation?._id;
  const latestMessage = messages[messages.length - 1];
  const latestMessageKey =
    latestMessage?.id || latestMessage?._id || latestMessage?.createdAt || "";
  const currentUserId = getComparableId(user?._id || user?.id);
  const latestMessageSenderId = getMessageSenderId(latestMessage);
  const isLatestMessageFromCurrentUser =
    Boolean(currentUserId) &&
    Boolean(latestMessageSenderId) &&
    latestMessageSenderId === currentUserId;

  const updateScrollToBottomVisibility = useCallback(() => {
    const pane = messagesPaneRef.current;
    if (!pane || isLoadingMessages || messages.length === 0) {
      isViewingLatestMessageRef.current = true;
      shouldStickToLatestMessageRef.current = true;
      setShowScrollToBottomButton(false);
      return;
    }

    const isViewingLatest = isViewingLatestMessage(pane);
    const isProgrammaticScroll =
      typeof Date !== "undefined" &&
      Date.now() < programmaticScrollUntilRef.current;
    isViewingLatestMessageRef.current = isViewingLatest;
    if (isViewingLatest) {
      shouldStickToLatestMessageRef.current = true;
      setShowScrollToBottomButton(false);
      return;
    }

    if (!isProgrammaticScroll) {
      shouldStickToLatestMessageRef.current = false;
    } else {
      setShowScrollToBottomButton(false);
      return;
    }

    setShowScrollToBottomButton((isVisible) =>
      isVisible === !isViewingLatest ? isVisible : !isViewingLatest,
    );
  }, [isLoadingMessages, messages.length]);

  const scrollPaneToLatestMessage = useCallback((behavior = "auto") => {
    const pane = messagesPaneRef.current;
    if (!pane) return;

    shouldStickToLatestMessageRef.current = true;
    programmaticScrollUntilRef.current =
      Date.now() + (behavior === "smooth" ? 600 : 160);

    if (behavior === "smooth" && typeof pane.scrollTo === "function") {
      pane.scrollTo({
        top: pane.scrollHeight,
        behavior: "smooth",
      });
    } else {
      pane.scrollTop = pane.scrollHeight;
    }

    isViewingLatestMessageRef.current = true;
  }, []);

  const scrollToLatestMessage = useCallback((behavior = "auto") => {
    scrollPaneToLatestMessage(behavior);
    setShowScrollToBottomButton(false);
  }, [scrollPaneToLatestMessage]);

  useLayoutEffect(() => {
    if (!conversationId || isLoadingMessages || messages.length === 0) {
      previousConversationIdRef.current = conversationId || "";
      isViewingLatestMessageRef.current = true;
      shouldStickToLatestMessageRef.current = true;
      return;
    }

    const pane = messagesPaneRef.current;
    if (!pane) return;

    const didConversationChange =
      previousConversationIdRef.current !== conversationId;
    previousConversationIdRef.current = conversationId;
    const shouldScrollToBottom =
      didConversationChange ||
      shouldStickToLatestMessageRef.current ||
      isViewingLatestMessageRef.current ||
      isLatestMessageFromCurrentUser;

    if (didConversationChange) {
      shouldStickToLatestMessageRef.current = true;
    }

    if (!shouldScrollToBottom) {
      if (typeof window === "undefined") {
        return;
      }

      const frameId = window.requestAnimationFrame(
        updateScrollToBottomVisibility,
      );

      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }

    scrollPaneToLatestMessage();

    if (typeof window === "undefined") return;

    const frameId = window.requestAnimationFrame(scrollPaneToLatestMessage);
    const hideButtonFrameId = window.requestAnimationFrame(() => {
      setShowScrollToBottomButton(false);
    });
    const timeoutId = window.setTimeout(scrollPaneToLatestMessage, 0);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.cancelAnimationFrame(hideButtonFrameId);
      window.clearTimeout(timeoutId);
    };
  }, [
    conversationId,
    isLoadingMessages,
    latestMessageKey,
    isLatestMessageFromCurrentUser,
    messages.length,
    scrollPaneToLatestMessage,
    updateScrollToBottomVisibility,
  ]);

  useEffect(() => {
    const pane = messagesPaneRef.current;
    const content = messagesContentRef.current;

    if (
      !pane ||
      !content ||
      isLoadingMessages ||
      messages.length === 0 ||
      typeof window === "undefined"
    ) {
      return undefined;
    }

    let frameId = 0;
    const keepLatestMessagePinned = () => {
      if (!shouldStickToLatestMessageRef.current) return;

      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        if (shouldStickToLatestMessageRef.current) {
          scrollToLatestMessage();
        }
      });
    };

    const resizeObserver =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(keepLatestMessagePinned)
        : null;

    resizeObserver?.observe(content);
    resizeObserver?.observe(pane);
    pane.addEventListener("load", keepLatestMessagePinned, true);
    pane.addEventListener("loadedmetadata", keepLatestMessagePinned, true);
    pane.addEventListener("loadeddata", keepLatestMessagePinned, true);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      resizeObserver?.disconnect();
      pane.removeEventListener("load", keepLatestMessagePinned, true);
      pane.removeEventListener("loadedmetadata", keepLatestMessagePinned, true);
      pane.removeEventListener("loadeddata", keepLatestMessagePinned, true);
    };
  }, [
    conversationId,
    isLoadingMessages,
    messages.length,
    scrollToLatestMessage,
  ]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  const registerMessageNode = useCallback((messageId, node) => {
    const normalizedMessageId = getComparableId(messageId);
    if (!normalizedMessageId) return;

    if (node) {
      messageNodeRefs.current.set(normalizedMessageId, node);
      return;
    }

    messageNodeRefs.current.delete(normalizedMessageId);
  }, []);

  const handleJumpToMessage = useCallback(
    async (targetMessage) => {
      const targetMessageId = getComparableId(
        targetMessage?.id || targetMessage?._id,
      );
      if (!targetMessageId) return;

      let targetNode = messageNodeRefs.current.get(targetMessageId);
      if (!targetNode && onEnsureMessageLoaded) {
        const didLoadMessage = await onEnsureMessageLoaded(targetMessage);
        if (didLoadMessage) {
          await waitForMessageRender();
          targetNode = messageNodeRefs.current.get(targetMessageId);
        }
      }

      if (!targetNode) {
        message.warning("Tin nhắn chưa có trong danh sách hiện tại");
        return;
      }

      targetNode.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      setHighlightedMessageId(targetMessageId);

      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
      }

      highlightTimeoutRef.current = window.setTimeout(() => {
        setHighlightedMessageId((currentId) =>
          currentId === targetMessageId ? "" : currentId,
        );
      }, 1800);
    },
    [message, onEnsureMessageLoaded],
  );

  const handleScrollToBottom = useCallback(() => {
    scrollToLatestMessage("smooth");
  }, [scrollToLatestMessage]);

  // Empty state - no conversation selected
  if (!conversation) {
    return (
      <main className="flex h-full flex-1 flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 shadow-sm md:rounded-2xl">
        <div className="text-center px-6">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 shadow-sm">
            <span className="material-symbols-outlined text-5xl text-blue-600">
              chat
            </span>
          </div>
          <h2 className="mb-2 text-xl font-bold text-slate-950">
            Chào mừng đến với Tin nhắn
          </h2>
          <p className="max-w-sm text-sm font-medium leading-6 text-slate-600">
            Chọn một hội thoại từ danh sách bên trái hoặc tạo hội thoại mới để
            bắt đầu trò chuyện.
          </p>
        </div>
      </main>
    );
  }

  const isPrivate = conversation.type === "private";

  // Get display info for the other participant (private) or group
  const otherParticipant = isPrivate
    ? conversation.participants?.find(
        (p) => (p.user?._id || p.userId?.toString()) !== user?._id
      )?.user
    : null;

  const displayName = isPrivate
    ? otherParticipant?.fullName || "Người dùng"
    : conversation.name || "Nhóm";

  const displayAvatar = isPrivate
    ? getAvatarUrl(otherParticipant?.avatar)
    : getAvatarUrl(conversation.avatar);

  const displayInitial = displayName.charAt(0).toUpperCase();
  const effectiveActivityStatus = getEffectiveActivityStatus(otherParticipant);
  const activityStatusMeta = getActivityStatusMeta(effectiveActivityStatus);
  const shouldShowActivityStatus = isPrivate && activityStatusMeta.label;

  const participantCount = conversation.participants?.length || 0;
  const timelineItems = buildMessageTimeline(messages);
  const calleeUserId = otherParticipant?._id || otherParticipant?.id;
  const isCalleeAvailableForCall = !["offline", "invisible"].includes(
    effectiveActivityStatus,
  );
  const canAttemptPrivateCall = isPrivate && Boolean(calleeUserId);
  const handleStartCall = (mediaType) => {
    if (!canAttemptPrivateCall) return;
    if (!isCalleeAvailableForCall) {
      message.warning("Người dùng đang ngoại tuyến");
      return;
    }
    onStartCall?.({
      conversationId,
      calleeUserId,
      mediaType,
      callee: otherParticipant,
    });
  };
  const activeDraftMessage = editingMessage || replyToMessage;
  const replySenderId = getMessageSenderId(replyToMessage);
  const isReplyingToSelf =
    !editingMessage &&
    Boolean(replySenderId) &&
    Boolean(currentUserId) &&
    replySenderId === currentUserId;
  const draftPreview = activeDraftMessage
    ? {
        id:
          activeDraftMessage.id ||
          activeDraftMessage._id ||
          `${editingMessage ? "edit" : "reply"}-draft`,
        icon: editingMessage ? "edit" : "reply",
        title: editingMessage
          ? "Đang chỉnh sửa tin nhắn"
          : isReplyingToSelf
            ? "Đang trả lời chính mình"
            : `Đang trả lời ${replyToMessage?.sender?.fullName || "tin nhắn"}`,
        text: getDraftPreviewText(activeDraftMessage),
        variant: editingMessage ? "edit" : "reply",
      }
    : null;

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm md:rounded-2xl">
      {/* Chat Header */}
      <div className="z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          {/* Back button for mobile */}
          <button
            onClick={onBack}
            className="rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 md:hidden"
          >
            <span className="material-symbols-outlined text-[22px]">
              arrow_back
            </span>
          </button>

          {/* Avatar */}
          <div className="relative shrink-0">
            {isPrivate ? (
              displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt={displayName}
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-white shadow-sm"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-700 ring-2 ring-white shadow-sm">
                  {displayInitial}
                </div>
              )
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center text-sm font-bold shadow-sm">
                #{displayInitial}
              </div>
            )}
            {/* Online indicator - for private chats */}
            {isPrivate && <ActivityStatusBadge meta={activityStatusMeta} />}
          </div>

          {/* Info */}
          <div className="flex min-h-10 flex-col justify-center min-w-0">
            <h2 className="truncate text-base font-bold leading-tight text-slate-950">
              {isPrivate ? displayName : `# ${displayName}`}
            </h2>
            {shouldShowActivityStatus ? (
              <p
                className={`text-xs font-medium truncate ${activityStatusMeta.textClassName}`}
              >
                {activityStatusMeta.label}
              </p>
            ) : !isPrivate ? (
              <p className="truncate text-xs font-medium text-slate-600">
                {participantCount} thành viên
              </p>
            ) : null}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleStartCall("audio")}
            disabled={!canAttemptPrivateCall}
            aria-label="Gọi thoại"
            title="Gọi thoại"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-blue-500 transition-colors hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="chat-conversation-action-icon material-symbols-outlined text-[22px]">
              call
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleStartCall("video")}
            disabled={!canAttemptPrivateCall}
            aria-label="Gọi video"
            title="Gọi video"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-blue-500 transition-colors hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="chat-conversation-action-icon material-symbols-outlined text-[22px]">
              videocam
            </span>
          </button>
          <button
            type="button"
            onClick={onToggleDetail}
            aria-label="Thông tin hội thoại"
            title="Thông tin hội thoại"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-blue-500 transition-colors hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
          >
            <span className="chat-conversation-action-icon material-symbols-outlined text-[22px]">
              info
            </span>
          </button>
        </div>
      </div>

      <PinnedMessageBar
        pinnedMessages={pinnedMessages}
        currentUserId={currentUserId}
        onOpen={() => setIsPinnedListOpen(true)}
      />

      {/* Messages Area */}
      <div
        ref={messagesPaneRef}
        onScroll={updateScrollToBottomVisibility}
        className="chat-messages-pane chat-messages-scroll flex flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6"
      >
        {isLoadingMessages ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="route-loading-spinner mb-3" />
            <p className="text-sm font-semibold text-slate-600">
              Đang tải tin nhắn...
            </p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
              <span className="material-symbols-outlined text-3xl text-slate-500">
                waving_hand
              </span>
            </div>
            <p className="text-sm font-bold text-slate-700">
              Hãy bắt đầu cuộc trò chuyện!
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Gửi tin nhắn đầu tiên bên dưới.
            </p>
          </div>
        ) : (
          <div
            ref={messagesContentRef}
            className="chat-messages-content flex w-full flex-col"
          >
            {timelineItems.map((item) => {
              if (item.type === "separator") {
                return (
                  <div
                    key={item.id}
                    className="chat-time-separator my-4 flex items-center justify-center"
                  >
                    <div className="chat-time-separator-label rounded-full border border-slate-200 bg-white/95 px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-sm shadow-slate-900/5 backdrop-blur">
                      {item.label}
                    </div>
                  </div>
                );
              }

              const itemMessageId = getComparableId(
                item.message?.id || item.message?._id,
              );
              const pollActivityTargetMessageId = item.showPollActivityCard
                ? getComparableId(item.pollActivityTargetMessageId)
                : "";
              const registerTimelineNode = (node) => {
                registerMessageNode(itemMessageId, node);
                if (
                  pollActivityTargetMessageId &&
                  pollActivityTargetMessageId !== itemMessageId
                ) {
                  registerMessageNode(pollActivityTargetMessageId, node);
                }
              };

              return (
                <div
                  key={item.id}
                  ref={registerTimelineNode}
                  data-message-id={itemMessageId}
                  className={
                    messageSpacingClassNames[item.spacing] ||
                    messageSpacingClassNames.default
                  }
                >
                  <MessageBubble
                    message={item.message}
                    showAvatar={item.showAvatar}
                    showSenderHeader={item.showSenderHeader}
                    timestampLabel={item.timestampLabel}
                    isTightGroup={item.spacing === "tight"}
                    hasTightNext={item.hasTightNext}
                    isHighlighted={highlightedMessageId === itemMessageId}
                    showPollActivityCard={item.showPollActivityCard}
                    onReply={onReplyMessage}
                    onEdit={onEditMessage}
                    onDelete={onDeleteMessage}
                    onCopy={onCopyMessage}
                    onTogglePin={onTogglePinMessage}
                    onToggleReaction={onToggleReaction}
                    onVotePoll={onVotePoll}
                    onAddPollOption={onAddPollOption}
                    onSharePoll={onSharePoll}
                    onClosePoll={onClosePoll}
                    onJumpToMessage={handleJumpToMessage}
                    onOpenPinnedList={() => setIsPinnedListOpen(true)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Typing Indicator */}
      {typingUsers.length > 0 && (
        <div className="bg-slate-50 px-6 pb-1">
          <div className="flex items-center gap-2 text-xs font-semibold italic text-slate-600">
            <span className="flex gap-1 items-center">
              <span className="chat-typing-dot" />
              <span className="chat-typing-dot" />
              <span className="chat-typing-dot" />
            </span>
            {typingUsers.map((u) => u.fullName).join(", ")} đang nhập...
          </div>
        </div>
      )}

      {/* Chat Input */}
      <div className="relative shrink-0">
        {showScrollToBottomButton && !isLoadingMessages && messages.length > 0 && (
          <button
            type="button"
            onClick={handleScrollToBottom}
            className="chat-scroll-to-bottom-button absolute left-1/2 top-0 z-20 inline-flex h-10 w-10 -translate-x-1/2 -translate-y-[calc(100%+0.75rem)] items-center justify-center rounded-full border border-slate-200 bg-white text-blue-600 shadow-lg shadow-slate-900/15 transition-colors hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            title="Cuộn xuống tin nhắn mới nhất"
            aria-label="Cuộn xuống tin nhắn mới nhất"
          >
            <span
              className="material-symbols-outlined text-[24px]"
              aria-hidden="true"
            >
              keyboard_arrow_down
            </span>
          </button>
        )}
        <ChatInput
          onSend={onSendMessage}
          onUploadAttachment={onUploadAttachment}
          onCreatePoll={onCreatePoll}
          onTypingChange={onTypingChange}
          onCancelDraft={onCancelDraft}
          initialContent={editingMessage?.content || ""}
          mode={editingMessage ? "edit" : replyToMessage ? "reply" : "send"}
          draftPreview={draftPreview}
          disabled={isSending}
          placeholder={`Trả lời ${isPrivate ? displayName : `# ${displayName}`}...`}
        />
      </div>
      <PinnedMessagesModal
        isOpen={isPinnedListOpen && pinnedMessages.length > 0}
        pinnedMessages={pinnedMessages}
        currentUserId={currentUserId}
        onClose={() => setIsPinnedListOpen(false)}
        onJumpToMessage={(pinnedMessage) => {
          setIsPinnedListOpen(false);
          handleJumpToMessage(pinnedMessage);
        }}
        onUnpinMessage={onTogglePinMessage}
      />
    </main>
  );
};

export default ChatWindow;
