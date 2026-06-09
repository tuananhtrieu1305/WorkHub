import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EmojiPickerButton } from "../../components/emoji";
import { useAuth } from "../../context/AuthContext";
import {
  formatMessageTimestamp,
  getHoverTimestampPlacement,
} from "./messageTimeline";

const API_URL = import.meta.env.VITE_NODE_API_URL || "http://localhost:5000";

const getAvatarUrl = (avatar) => {
  if (!avatar) return null;
  return avatar.startsWith("http") ? avatar : `${API_URL}${avatar}`;
};

const getFileUrl = (url) => {
  if (!url) return "#";
  return url.startsWith("http") ? url : `${API_URL}${url}`;
};

const getComparableId = (value) => {
  if (value == null) return "";
  if (typeof value === "object") {
    return String(value.id || value._id || "");
  }
  return String(value);
};

const getUserId = (value) => getComparableId(value?._id || value?.id || value);

const getMessageId = (message) => getComparableId(message?.id || message?._id);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getMessagePreviewText = (message) => {
  if (!message) return "...";
  if (message.deletedAt) return "Tin nhắn đã được thu hồi";
  if (message.content) return message.content.replace(/\s+/g, " ").trim();
  const firstAttachment = message.attachments?.[0];
  if (firstAttachment?.mimeType?.startsWith("image/")) return "Ảnh";
  if (firstAttachment?.mimeType?.startsWith("video/")) return "Video";
  if (firstAttachment?.fileName) return firstAttachment.fileName;
  if (message.attachments?.length) return "Tệp đính kèm";
  return "...";
};

const getReplyPreviewAttachment = (message) => {
  if (message?.deletedAt) return null;
  return (
    message?.attachments?.find(
      (attachment) =>
        attachment.mimeType?.startsWith("image/") ||
        attachment.mimeType?.startsWith("video/"),
    ) ||
    message?.attachments?.[0] ||
    null
  );
};

const getReplyParticipantName = (
  participant,
  fallback,
  currentUserId,
  { selfLabel = "Bạn" } = {},
) => {
  const participantId = getUserId(participant);
  if (participantId && participantId === currentUserId) return selfLabel;
  return participant?.fullName || fallback;
};

const getMenuItems = ({ isMine, isDeleted, isPinned }) => {
  if (isDeleted) return [];

  const pinItem = {
    key: isPinned ? "unpin" : "pin",
    icon: "push_pin",
    label: isPinned ? "Bỏ ghim tin nhắn" : "Ghim tin nhắn",
  };

  if (!isMine) {
    return [
      { key: "copy", icon: "content_copy", label: "Sao chép tin nhắn" },
      pinItem,
    ];
  }

  return [
    { key: "copy", icon: "content_copy", label: "Sao chép tin nhắn" },
    { key: "edit", icon: "edit", label: "Chỉnh sửa tin nhắn" },
    pinItem,
    { key: "recall", icon: "delete", label: "Thu hồi tin nhắn", danger: true },
  ];
};

const groupReactions = (reactions = []) => {
  return reactions.reduce((groups, reaction) => {
    const key = reaction.reaction;
    const current = groups.get(key) || {
      reaction: key,
      count: 0,
      userIds: [],
    };
    current.count += 1;
    current.userIds.push(getComparableId(reaction.userId));
    groups.set(key, current);
    return groups;
  }, new Map());
};

const formatFileSize = (size) => {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const sanitizeHref = (href) => {
  if (!href) return "#";
  return /^(https?:|mailto:)/i.test(href) ? href : "#";
};

const renderInlineMarkdown = (text) => {
  const pattern =
    /(\*\*([^*]+)\*\*|\*([^*]+)\*|<u>([^<]+)<\/u>|~~([^~]+)~~|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const key = `${match.index}-${match[0]}`;
    if (match[2]) {
      parts.push(<strong key={key}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={key}>{match[3]}</em>);
    } else if (match[4]) {
      parts.push(<u key={key}>{match[4]}</u>);
    } else if (match[5]) {
      parts.push(<s key={key}>{match[5]}</s>);
    } else if (match[6]) {
      parts.push(
        <code
          key={key}
          className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.9em]"
        >
          {match[6]}
        </code>
      );
    } else if (match[7]) {
      parts.push(
        <a
          key={key}
          href={sanitizeHref(match[8])}
          target="_blank"
          rel="noreferrer"
          className="font-semibold underline underline-offset-2"
        >
          {match[7]}
        </a>
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
};

const MessageText = ({ content }) => {
  if (!content) return null;

  const lines = content.split(/\r?\n/);
  const isList =
    lines.length > 1 && lines.every((line) => line.trim().startsWith("- "));
  const isOrderedList =
    lines.length > 1 && lines.every((line) => /^\d+\.\s/.test(line.trim()));

  if (isList) {
    return (
      <ul className="list-disc space-y-1 pl-4">
        {lines.map((line, index) => (
          <li key={`${line}-${index}`}>
            {renderInlineMarkdown(line.trim().slice(2))}
          </li>
        ))}
      </ul>
    );
  }

  if (isOrderedList) {
    return (
      <ol className="list-decimal space-y-1 pl-4">
        {lines.map((line, index) => (
          <li key={`${line}-${index}`}>
            {renderInlineMarkdown(line.trim().replace(/^\d+\.\s/, ""))}
          </li>
        ))}
      </ol>
    );
  }

  return (
    <span className="whitespace-pre-wrap break-words">
      {lines.map((line, index) => (
        <span key={`${line}-${index}`}>
          {index > 0 ? "\n" : ""}
          {renderInlineMarkdown(line)}
        </span>
      ))}
    </span>
  );
};

const MessageAttachments = ({ attachments = [], isMine }) => {
  if (!attachments.length) return null;

  return (
    <div className="mt-2 flex flex-col gap-2">
      {attachments.map((attachment, index) => {
        const fileName = attachment.fileName || "Tệp đính kèm";
        const fileUrl = getFileUrl(attachment.fileUrl);
        const isImage = attachment.mimeType?.startsWith("image/");

        if (isImage) {
          return (
            <a
              key={`${attachment.fileUrl || fileName}-${index}`}
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-xl border border-white/20"
              title={fileName}
            >
              <img
                src={fileUrl}
                alt={fileName}
                className="max-h-64 max-w-full object-cover"
                loading="lazy"
              />
            </a>
          );
        }

        return (
          <a
            key={`${attachment.fileUrl || fileName}-${index}`}
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
              isMine
                ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              attach_file
            </span>
            <span className="min-w-0">
              <span className="block max-w-56 truncate font-semibold">
                {fileName}
              </span>
              {attachment.fileSize ? (
                <span
                  className={`block text-xs ${
                    isMine ? "text-blue-100" : "text-slate-400"
                  }`}
                >
                  {formatFileSize(attachment.fileSize)}
                </span>
              ) : null}
            </span>
          </a>
        );
      })}
    </div>
  );
};

const ReplyMediaThumbnail = ({ attachment }) => {
  if (!attachment) return null;

  const fileName = attachment.fileName || "Tệp đính kèm";
  const fileUrl = getFileUrl(attachment.fileUrl);
  const isImage = attachment.mimeType?.startsWith("image/");
  const isVideo = attachment.mimeType?.startsWith("video/");

  if (isImage) {
    return (
      <span className="chat-reply-preview-media" aria-hidden="true">
        <img src={fileUrl} alt="" loading="lazy" />
      </span>
    );
  }

  if (isVideo) {
    return (
      <span className="chat-reply-preview-media" aria-hidden="true">
        <video src={fileUrl} muted playsInline preload="metadata" />
        <span className="chat-reply-preview-play material-symbols-outlined">
          play_arrow
        </span>
      </span>
    );
  }

  return (
    <span
      className="chat-reply-preview-media chat-reply-preview-file"
      aria-hidden="true"
      title={fileName}
    >
      <span className="material-symbols-outlined">attach_file</span>
    </span>
  );
};

const ReplyQuote = ({
  message,
  replyTo,
  isMine,
  currentUserId,
  onJumpToMessage,
}) => {
  if (!replyTo) return null;

  const replyToId = getMessageId(replyTo);
  const actorName = getReplyParticipantName(
    message.sender,
    "Người dùng",
    currentUserId,
  );
  const targetName = getReplyParticipantName(
    replyTo.sender,
    "tin nhắn",
    currentUserId,
    { selfLabel: "bạn" },
  );
  const previewText = getMessagePreviewText(replyTo);
  const previewAttachment = getReplyPreviewAttachment(replyTo);
  const canJump = Boolean(replyToId && onJumpToMessage);

  return (
    <div
      className={`chat-reply-context ${
        isMine ? "chat-reply-context-mine" : "chat-reply-context-other"
      }`}
    >
      <div className="chat-reply-context-title">
        <span className="material-symbols-outlined">reply</span>
        <span>{actorName} đã trả lời {targetName}</span>
      </div>
      <button
        type="button"
        className="chat-reply-preview-button"
        onClick={() => onJumpToMessage?.(replyTo)}
        disabled={!canJump}
        title={canJump ? "Đi đến tin nhắn được trả lời" : previewText}
      >
        <ReplyMediaThumbnail attachment={previewAttachment} />
        <span className="chat-reply-preview-text" title={previewText}>
          {previewText}
        </span>
      </button>
    </div>
  );
};

const callEventMeta = {
  call_ended: { icon: "call_end", label: "Cuoc goi da ket thuc" },
  call_missed: { icon: "phone_missed", label: "Cuoc goi nho" },
  call_declined: { icon: "phone_disabled", label: "Cuoc goi da bi tu choi" },
  call_cancelled: { icon: "call_end", label: "Cuoc goi da bi huy" },
  call_failed: { icon: "error", label: "Cuoc goi that bai" },
  call_busy: { icon: "phone_paused", label: "May ban" },
};

const formatDuration = (seconds) => {
  if (!seconds) return "";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
};

const CallSystemMessage = ({ message }) => {
  const eventType = message.metadata?.eventType;
  const meta = callEventMeta[eventType] || callEventMeta.call_failed;
  const duration = formatDuration(message.metadata?.durationSeconds);

  return (
    <div className="flex justify-center">
      <div className="inline-flex max-w-[80%] items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm">
        <span className="material-symbols-outlined text-[16px] text-blue-500">
          {meta.icon}
        </span>
        <span>{message.content || meta.label}</span>
        {duration && <span className="text-slate-400">{duration}</span>}
      </div>
    </div>
  );
};

const MessageBubble = ({
  message,
  showAvatar = true,
  showSenderHeader = true,
  timestampLabel = "",
  isTightGroup = false,
  hasTightNext = false,
  isHighlighted = false,
  onReply,
  onEdit,
  onDelete,
  onCopy,
  onTogglePin,
  onToggleReaction,
  onJumpToMessage,
}) => {
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuLayout, setMenuLayout] = useState({
    placement: "bottom",
    style: undefined,
  });
  const menuRootRef = useRef(null);
  const menuButtonRef = useRef(null);
  const menuPopoverRef = useRef(null);
  const stackRef = useRef(null);
  const bubbleRef = useRef(null);
  const [hoverTimePosition, setHoverTimePosition] = useState(null);
  const currentUserId = getComparableId(user?._id || user?.id);
  const isMine =
    getUserId(message.sender) === currentUserId;
  const senderName = message.sender?.fullName || "Người dùng";
  const avatarUrl = getAvatarUrl(message.sender?.avatar);
  const senderInitial = senderName.charAt(0).toUpperCase();
  const reactionGroups = [...groupReactions(message.reactions || []).values()];
  const isDeleted = Boolean(message.deletedAt);
  const menuItems = getMenuItems({
    isMine,
    isDeleted,
    isPinned: message.isPinned,
  });
  const deletedById = getComparableId(message.deletedBy || message.sender?._id);
  const deletedByName =
    deletedById === getComparableId(user?._id || user?.id)
      ? "Bạn"
      : message.deletedBy?.fullName || senderName;
  const deletedMessageText =
    deletedById === getComparableId(user?._id || user?.id)
      ? "Bạn đã gỡ tin nhắn này"
      : `${deletedByName} đã gỡ tin nhắn này`;
  const bubbleClassName = [
    "chat-message-bubble",
    isMine ? "chat-message-bubble-mine" : "chat-message-bubble-other",
    isDeleted ? "chat-message-bubble-deleted" : "",
    !isDeleted && showAvatar ? "chat-message-bubble-avatar-anchor" : "",
    !isDeleted && isTightGroup ? "chat-message-bubble-linked-before" : "",
    !isDeleted && hasTightNext ? "chat-message-bubble-linked-after" : "",
    !isDeleted && message.replyTo ? "chat-message-bubble-with-reply" : "",
    !isDeleted && isHighlighted ? "chat-message-bubble-highlighted" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const messageTimestamp =
    timestampLabel || formatMessageTimestamp(message.createdAt);
  const hoverTimestampPlacement = getHoverTimestampPlacement(isMine);
  const shouldShowSenderHeader = showSenderHeader && !message.replyTo;

  const updateHoverTimePosition = useCallback(() => {
    if (!messageTimestamp || !bubbleRef.current) {
      setHoverTimePosition(null);
      return;
    }

    const rect = bubbleRef.current.getBoundingClientRect();
    setHoverTimePosition({
      anchorX:
        hoverTimestampPlacement === "right" ? rect.right + 12 : rect.left - 12,
      placement: hoverTimestampPlacement,
      top: rect.top + rect.height / 2,
    });
  }, [hoverTimestampPlacement, messageTimestamp]);

  const hideHoverTime = useCallback(() => {
    setHoverTimePosition(null);
  }, []);

  const getMenuLayout = useCallback(() => {
    if (!menuButtonRef.current || typeof window === "undefined") {
      return { placement: "bottom", style: undefined };
    }

    const margin = 12;
    const gap = 8;
    const buttonRect = menuButtonRef.current.getBoundingClientRect();
    const width = Math.min(224, window.innerWidth - margin * 2);
    const menuHeight =
      menuPopoverRef.current?.offsetHeight ||
      Math.min(56 + menuItems.length * 40, window.innerHeight - margin * 2);
    const spaceBelow = window.innerHeight - margin - buttonRect.bottom - gap;
    const spaceAbove = buttonRect.top - margin - gap;
    const placement =
      spaceBelow >= menuHeight || spaceBelow >= spaceAbove ? "bottom" : "top";
    const maxHeight = Math.max(
      0,
      placement === "bottom" ? spaceBelow : spaceAbove
    );
    const preferredLeft = isMine ? buttonRect.right - width : buttonRect.left;
    const left = clamp(
      preferredLeft,
      margin,
      window.innerWidth - width - margin
    );

    return {
      placement,
      style: {
        left,
        width,
        maxHeight,
        ...(placement === "bottom"
          ? { top: buttonRect.bottom + gap }
          : { bottom: window.innerHeight - buttonRect.top + gap }),
      },
    };
  }, [isMine, menuItems.length]);

  const updateMenuLayout = useCallback(() => {
    setMenuLayout(getMenuLayout());
  }, [getMenuLayout]);

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (
        !menuRootRef.current?.contains(event.target) &&
        !menuPopoverRef.current?.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    const frameId = window.requestAnimationFrame(updateMenuLayout);
    window.addEventListener("resize", updateMenuLayout);
    window.addEventListener("scroll", updateMenuLayout, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updateMenuLayout);
      window.removeEventListener("scroll", updateMenuLayout, true);
    };
  }, [isMenuOpen, updateMenuLayout]);

  useEffect(() => {
    if (!hoverTimePosition) return undefined;

    window.addEventListener("resize", updateHoverTimePosition);
    window.addEventListener("scroll", hideHoverTime, true);

    return () => {
      window.removeEventListener("resize", updateHoverTimePosition);
      window.removeEventListener("scroll", hideHoverTime, true);
    };
  }, [hideHoverTime, hoverTimePosition, updateHoverTimePosition]);

  if (message.type === "system" && message.metadata?.eventType?.startsWith("call_")) {
    return <CallSystemMessage message={message} />;
  }

  const renderAvatar = (className = "") => {
    if (!showAvatar) {
      return <div className="chat-message-avatar-slot" aria-hidden="true" />;
    }

    return avatarUrl ? (
      <div className="chat-message-avatar-slot">
        <img
          src={avatarUrl}
          alt={senderName}
          className={`chat-message-avatar w-9 h-9 rounded-full object-cover shadow-sm ${className}`}
        />
      </div>
    ) : (
      <div className="chat-message-avatar-slot">
        <div
          className={`chat-message-avatar flex w-9 h-9 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600 shadow-sm ${className}`}
        >
          {senderInitial}
        </div>
      </div>
    );
  };

  const handleMenuAction = (action) => {
    setIsMenuOpen(false);

    if (action === "copy") {
      onCopy?.(message);
      return;
    }
    if (action === "edit") {
      onEdit?.(message);
      return;
    }
    if (action === "recall") {
      onDelete?.(message);
      return;
    }
    if (action === "pin" || action === "unpin") {
      onTogglePin?.(message);
    }
  };

  const renderActions = () => (
    <div
      className={`chat-message-actions ${
        isMine ? "chat-message-actions-mine" : "chat-message-actions-other"
      } flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 p-1 shadow-lg shadow-slate-900/10 backdrop-blur ${
        isMenuOpen ? "is-open" : ""
      }`}
    >
      <EmojiPickerButton
        align={isMine ? "right" : "left"}
        buttonClassName="chat-message-action-button chat-message-emoji-action"
        label="React cảm xúc"
        onEmojiSelect={(emoji) => onToggleReaction?.(message, emoji)}
        placement="bottom"
        popoverMode="fixed"
        popoverClassName="chat-message-emoji-popover"
      />
      <button
        type="button"
        onClick={() => onReply?.(message)}
        className="chat-message-action-button text-slate-500 hover:bg-blue-50 hover:text-blue-700"
        title="Trả lời"
        aria-label="Trả lời tin nhắn"
      >
        <span className="material-symbols-outlined text-[18px]">reply</span>
      </button>
      <span ref={menuRootRef} className="relative inline-flex">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => {
            if (!isMenuOpen) {
              setMenuLayout(getMenuLayout());
            }
            setIsMenuOpen((open) => !open);
          }}
          className="chat-message-action-button text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          title="Hành động khác"
          aria-label="Hành động khác"
          aria-expanded={isMenuOpen}
        >
          <span className="material-symbols-outlined text-[18px]">
            more_horiz
          </span>
        </button>
        {isMenuOpen && typeof document !== "undefined" && createPortal(
          <span
            ref={menuPopoverRef}
            className="chat-message-more-menu-portal"
            data-placement={menuLayout.placement}
            style={menuLayout.style}
          >
            {menuItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => handleMenuAction(item.key)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold transition-colors ${
                  item.danger
                    ? "text-red-600 hover:bg-red-50"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </span>,
          document.body,
        )}
      </span>
    </div>
  );

  const renderHoverTimestamp = () => {
    if (
      !hoverTimePosition ||
      !messageTimestamp ||
      typeof document === "undefined"
    ) {
      return null;
    }

    return createPortal(
      <span
        className={`chat-message-hover-time-portal chat-message-hover-time-${hoverTimePosition.placement}`}
        style={{
          left: hoverTimePosition.anchorX,
          top: hoverTimePosition.top,
        }}
      >
        {messageTimestamp}
      </span>,
      document.body,
    );
  };

  const renderReactions = () =>
    reactionGroups.length > 0 && (
      <div
        className={`chat-message-reaction-corner absolute -bottom-2 flex max-w-[92%] flex-wrap gap-1 ${
          isMine ? "right-2 justify-end" : "left-2"
        }`}
      >
        {reactionGroups.map((group) => {
          const isActive = group.userIds.includes(
            getComparableId(user?._id || user?.id)
          );
          return (
            <button
              key={group.reaction}
              type="button"
              onClick={() => onToggleReaction?.(message, group.reaction)}
              className={`inline-flex h-6 items-center gap-1 rounded-full border px-1.5 text-xs shadow-sm transition-colors ${
                isActive
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              title={`${group.reaction} (${group.count})`}
            >
              <span className="text-[13px] leading-none">{group.reaction}</span>
              {group.count > 1 && <span>{group.count}</span>}
            </button>
          );
        })}
      </div>
    );

  if (isMine) {
    return (
      <>
        <div
          className={`chat-message-group flex items-end gap-2.5 justify-end group ${
            isTightGroup ? "chat-message-group-tight" : ""
          }`}
          onPointerLeave={() => {
            hideHoverTime();
          }}
        >
        <div className="flex max-w-[82%] flex-col items-end gap-1 sm:max-w-[70%]">
        {shouldShowSenderHeader && (
          <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold text-slate-900">Bạn</span>
            </div>
          )}
          <div
            ref={stackRef}
            className={`chat-message-stack relative ${
              reactionGroups.length ? "pb-4" : ""
            }`}
          >
            {!isDeleted && (
              <ReplyQuote
                message={message}
                replyTo={message.replyTo}
                isMine
                currentUserId={currentUserId}
                onJumpToMessage={onJumpToMessage}
              />
            )}
            <div
              ref={bubbleRef}
              className={`${bubbleClassName} ml-auto w-fit px-4 py-2.5 text-[15px] font-medium leading-relaxed transition-colors ${
                isDeleted
                  ? "rounded-2xl border border-slate-200 bg-slate-100 text-slate-500 italic shadow-none"
                  : "rounded-2xl bg-blue-600 text-white"
              }`}
              onPointerLeave={hideHoverTime}
              onPointerMove={updateHoverTimePosition}
            >
              {isDeleted ? (
                <span>{deletedMessageText}</span>
              ) : (
                <>
                  {message.isPinned && (
                    <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold text-blue-50">
                      <span className="material-symbols-outlined text-[13px]">
                        push_pin
                      </span>
                      Đã ghim
                    </span>
                  )}
                  <MessageText content={message.content} />
                  <MessageAttachments
                    attachments={message.attachments || []}
                    isMine
                  />
                  {message.editedAt && (
                    <span className="mt-1 block text-[11px] font-semibold text-blue-100">
                      Đã chỉnh sửa
                    </span>
                  )}
                </>
              )}
            </div>
            {!isDeleted && renderActions()}
            {!isDeleted && renderReactions()}
          </div>
        </div>
        {renderAvatar()}
        </div>
        {renderHoverTimestamp()}
      </>
    );
  }

  return (
    <>
      <div
        className={`chat-message-group flex items-end gap-2.5 group ${
          isTightGroup ? "chat-message-group-tight" : ""
        }`}
        onPointerLeave={() => {
          hideHoverTime();
        }}
      >
        {renderAvatar("cursor-pointer")}
        <div className="flex max-w-[82%] flex-col items-start gap-1 sm:max-w-[70%]">
        {shouldShowSenderHeader && (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold text-slate-900 cursor-pointer hover:underline">
              {senderName}
            </span>
          </div>
        )}
        <div
          ref={stackRef}
          className={`chat-message-stack relative ${
            reactionGroups.length ? "pb-4" : ""
          }`}
        >
          {!isDeleted && (
            <ReplyQuote
              message={message}
              replyTo={message.replyTo}
              currentUserId={currentUserId}
              onJumpToMessage={onJumpToMessage}
            />
          )}
          <div
            ref={bubbleRef}
            className={`${bubbleClassName} w-fit border px-4 py-2.5 text-[15px] font-medium leading-relaxed transition-colors ${
              isDeleted
                ? "rounded-2xl border-slate-200 bg-slate-100 text-slate-500 italic shadow-none"
                : "rounded-2xl border-slate-300 bg-white text-slate-900"
            }`}
            onPointerLeave={hideHoverTime}
            onPointerMove={updateHoverTimePosition}
          >
            {isDeleted ? (
              <span>{deletedMessageText}</span>
            ) : (
              <>
                {message.isPinned && (
                  <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                    <span className="material-symbols-outlined text-[13px]">
                      push_pin
                    </span>
                    Đã ghim
                  </span>
                )}
                <MessageText content={message.content} />
                <MessageAttachments attachments={message.attachments || []} />
                {message.editedAt && (
                  <span className="mt-1 block text-[11px] font-semibold text-slate-500">
                    Đã chỉnh sửa
                  </span>
                )}
              </>
            )}
          </div>
          {!isDeleted && renderActions()}
          {!isDeleted && renderReactions()}
        </div>
      </div>
      </div>
      {renderHoverTimestamp()}
    </>
  );
};

export default MessageBubble;
