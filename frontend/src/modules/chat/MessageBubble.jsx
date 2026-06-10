import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EmojiPickerButton } from "../../components/emoji";
import { downloadConversationAttachmentBlob } from "../../api/conversationApi";
import { useAuth } from "../../context/AuthContext";
import {
  formatMessageTimestamp,
  getHoverTimestampPlacement,
  isPollActivityEventType,
  isReminderActivityEventType,
} from "./messageTimeline";
import {
  formatAudioDuration,
  getMessagePreviewText,
  isAudioAttachment,
} from "./chatMessagePreview";
import { getAvatarUrl } from "../../utils/avatar";
import { API_URL } from "../../config/api";
import PollMessage, { PollDetailModal } from "./PollMessage";
import ReminderMessage, { ReminderDetailModal } from "./ReminderMessage";

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

const getReplyPreviewAttachment = (message) => {
  if (message?.deletedAt) return null;
  return (
    message?.attachments?.find(
      (attachment) =>
        attachment.mimeType?.startsWith("image/") ||
        attachment.mimeType?.startsWith("video/") ||
        isAudioAttachment(attachment),
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

const getMenuItems = ({
  isMine,
  isDeleted,
  isPinned,
  isStructured = false,
}) => {
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
    ...(!isStructured
      ? [{ key: "edit", icon: "edit", label: "Chỉnh sửa tin nhắn" }]
      : []),
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

const voiceWaveformBars = [
  34, 56, 28, 72, 48, 88, 60, 42, 76, 96, 52, 68, 84, 44, 62, 30,
];

const voicePlaybackRates = [1, 1.5, 2, 0.5];

const getNextVoicePlaybackRate = (currentRate) => {
  const currentIndex = voicePlaybackRates.indexOf(currentRate);
  return voicePlaybackRates[(currentIndex + 1) % voicePlaybackRates.length];
};

const formatVoicePlaybackRate = (rate) => `${rate}x`;

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
    fileUrl !== "#" &&
    (isInternalApiFileUrl(rawFileUrl) || isInternalApiFileUrl(fileUrl));
  const [objectUrl, setObjectUrl] = useState("");
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let nextObjectUrl = "";

    setObjectUrl("");
    setHasError(false);

    if (!needsBlob) {
      return undefined;
    }

    const loadAttachment = async () => {
      try {
        const blob = await downloadConversationAttachmentBlob(
          rawFileUrl || fileUrl,
        );
        if (!blob?.size || typeof URL.createObjectURL !== "function") {
          throw new Error("Attachment is empty or unsupported");
        }
        nextObjectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL?.(nextObjectUrl);
          return;
        }
        setObjectUrl(nextObjectUrl);
      } catch (error) {
        console.error("Failed to load attachment:", error);
        if (!cancelled) setHasError(true);
      }
    };

    loadAttachment();

    return () => {
      cancelled = true;
      if (nextObjectUrl) {
        URL.revokeObjectURL?.(nextObjectUrl);
      }
    };
  }, [fileUrl, needsBlob, rawFileUrl]);

  return {
    src: needsBlob ? objectUrl : fileUrl,
    isLoading: needsBlob && !objectUrl && !hasError,
    hasError,
  };
};

const triggerAttachmentDownload = async (attachment, fileName) => {
  const rawFileUrl = attachment?.fileUrl || "";
  const fileUrl = getFileUrl(rawFileUrl);
  if (!fileUrl || fileUrl === "#") return;

  if (!isInternalApiFileUrl(rawFileUrl) && !isInternalApiFileUrl(fileUrl)) {
    window.open(fileUrl, "_blank", "noopener,noreferrer");
    return;
  }

  const blob = await downloadConversationAttachmentBlob(rawFileUrl || fileUrl);
  if (!blob?.size || typeof URL.createObjectURL !== "function") {
    throw new Error("Attachment is empty or unsupported");
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName || "attachment";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL?.(objectUrl), 0);
};

const AttachmentImagePreview = ({
  attachment,
  fileName,
  isMine = false,
  standalone = false,
}) => {
  const { src, isLoading, hasError } = useAttachmentObjectUrl(attachment);
  const toneClassName =
    isMine && !standalone
      ? "chat-attachment-media-frame-mine"
      : "chat-attachment-media-frame-other";

  if (hasError) {
    return (
      <div
        className={`chat-attachment-error ${toneClassName} rounded-xl border px-3 py-2 text-xs`}
      >
        Không thể tải ảnh
      </div>
    );
  }

  return (
    <a
      href={src || "#"}
      target="_blank"
      rel="noreferrer"
      className={`chat-attachment-media-frame ${toneClassName}`}
      title={fileName}
      aria-busy={isLoading}
    >
      <img
        src={src || undefined}
        alt={fileName}
        className="chat-attachment-media"
        loading="lazy"
      />
    </a>
  );
};

const AttachmentVideoPreview = ({
  attachment,
  fileName,
  isMine = false,
  standalone = false,
}) => {
  const { src, isLoading, hasError } = useAttachmentObjectUrl(attachment);
  const toneClassName =
    isMine && !standalone
      ? "chat-attachment-media-frame-mine"
      : "chat-attachment-media-frame-other";

  if (hasError) {
    return (
      <div
        className={`chat-attachment-error ${toneClassName} rounded-xl border px-3 py-2 text-xs`}
      >
        Không thể tải video
      </div>
    );
  }

  return (
    <video
      src={src || undefined}
      controls
      preload="metadata"
      className={`chat-attachment-media-frame chat-attachment-media ${toneClassName}`}
      title={fileName}
      aria-busy={isLoading}
    />
  );
};

const AttachmentFileLink = ({
  attachment,
  fileName,
  isMine,
  standalone = false,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const rawFileUrl = attachment.fileUrl || "";
  const fileUrl = getFileUrl(rawFileUrl);
  const isInternal =
    isInternalApiFileUrl(rawFileUrl) || isInternalApiFileUrl(fileUrl);
  const usesMineTone = isMine && !standalone;
  const className = `flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
    usesMineTone
      ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
  }`;
  const content = (
    <>
      <span className="material-symbols-outlined text-base">attach_file</span>
      <span className="min-w-0 flex-1 truncate">
        {downloadError ? "Không thể tải tệp" : fileName}
        {attachment.fileSize ? (
          <span
            className={`ml-2 text-xs ${
              usesMineTone ? "text-blue-100" : "text-slate-400"
            }`}
          >
            {formatFileSize(attachment.fileSize)}
          </span>
        ) : null}
      </span>
    </>
  );

  if (!isInternal) {
    return (
      <a href={fileUrl} target="_blank" rel="noreferrer" className={className}>
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={className}
      disabled={isDownloading}
      onClick={async () => {
        setIsDownloading(true);
        setDownloadError(false);
        try {
          await triggerAttachmentDownload(attachment, fileName);
        } catch (error) {
          console.error("Failed to download attachment:", error);
          setDownloadError(true);
        } finally {
          setIsDownloading(false);
        }
      }}
    >
      {content}
    </button>
  );
};

const ReplyImageThumbnail = ({ attachment }) => {
  const { src } = useAttachmentObjectUrl(attachment);

  return (
    <span className="chat-reply-preview-media" aria-hidden="true">
      <img src={src || undefined} alt="" loading="lazy" />
    </span>
  );
};

const ReplyVideoThumbnail = ({ attachment }) => {
  const { src } = useAttachmentObjectUrl(attachment);

  return (
    <span className="chat-reply-preview-media" aria-hidden="true">
      <video src={src || undefined} muted playsInline preload="metadata" />
      <span className="chat-reply-preview-play material-symbols-outlined">
        play_arrow
      </span>
    </span>
  );
};

const AudioAttachmentPlayer = ({ attachment, isMine }) => {
  const audioRef = useRef(null);
  const objectUrlRef = useRef("");
  const sourceLoadPromiseRef = useRef(null);
  const sourceVersionRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const [duration, setDuration] = useState(
    Number(attachment.durationSeconds) || 0,
  );
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const rawFileUrl = attachment.fileUrl || "";
  const fileUrl = getFileUrl(rawFileUrl);
  const requiresBlobAudio =
    isInternalApiFileUrl(rawFileUrl) || isInternalApiFileUrl(fileUrl);
  const [audioSrc, setAudioSrc] = useState(
    requiresBlobAudio ? "" : fileUrl,
  );
  const displayDuration = duration || Number(attachment.durationSeconds) || 0;
  const progress = displayDuration
    ? Math.min(100, (currentTime / displayDuration) * 100)
    : 0;
  const displayedTime =
    isPlaying || currentTime > 0 ? currentTime : displayDuration;
  const playbackRateLabel = formatVoicePlaybackRate(playbackRate);

  const releaseObjectUrl = useCallback(() => {
    if (!objectUrlRef.current) return;
    URL.revokeObjectURL?.(objectUrlRef.current);
    objectUrlRef.current = "";
  }, []);

  const loadAudioSource = useCallback(async () => {
    if (audioSrc) return audioSrc;
    if (!fileUrl || fileUrl === "#") return "";
    if (sourceLoadPromiseRef.current) return sourceLoadPromiseRef.current;

    const requestVersion = sourceVersionRef.current;

    setIsLoadingAudio(true);
    setPlaybackError(false);

    const loadPromise = (async () => {
      let nextAudioSrc = fileUrl;
      let createdObjectUrl = "";

      try {
        if (requiresBlobAudio) {
          const blob = await downloadConversationAttachmentBlob(
            rawFileUrl || fileUrl,
          );
          if (!blob?.size) {
            throw new Error("Voice attachment is empty");
          }
          if (typeof URL.createObjectURL !== "function") {
            throw new Error("Browser does not support local audio URLs");
          }
          createdObjectUrl = URL.createObjectURL(blob);
          nextAudioSrc = createdObjectUrl;
        }

        if (sourceVersionRef.current !== requestVersion) {
          if (createdObjectUrl) {
            URL.revokeObjectURL?.(createdObjectUrl);
          }
          return "";
        }

        if (createdObjectUrl) {
          releaseObjectUrl();
          objectUrlRef.current = createdObjectUrl;
        }

        setAudioSrc(nextAudioSrc);
        return nextAudioSrc;
      } catch (error) {
        if (createdObjectUrl) {
          URL.revokeObjectURL?.(createdObjectUrl);
        }
        if (sourceVersionRef.current === requestVersion) {
          console.error("Failed to load voice message:", error);
          setPlaybackError(true);
        }
        return "";
      } finally {
        if (sourceVersionRef.current === requestVersion) {
          sourceLoadPromiseRef.current = null;
          setIsLoadingAudio(false);
        }
      }
    })();

    sourceLoadPromiseRef.current = loadPromise;
    return loadPromise;
  }, [
    audioSrc,
    fileUrl,
    rawFileUrl,
    releaseObjectUrl,
    requiresBlobAudio,
  ]);

  const handleTogglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || isLoadingAudio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    try {
      const nextAudioSrc = await loadAudioSource();
      if (!nextAudioSrc) return;
      setPlaybackError(false);
      if (audio.src !== nextAudioSrc) {
        audio.src = nextAudioSrc;
        audio.load();
      }
      audio.playbackRate = playbackRate;
      await audio.play();
      setIsPlaying(true);
    } catch (error) {
      console.error("Failed to play voice message:", error);
      setIsPlaying(false);
      setPlaybackError(true);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    sourceVersionRef.current += 1;
    sourceLoadPromiseRef.current = null;

    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }

    setIsPlaying(false);
    setIsLoadingAudio(false);
    setPlaybackError(false);
    setCurrentTime(0);
    setDuration(Number(attachment.durationSeconds) || 0);
    releaseObjectUrl();
    setAudioSrc(requiresBlobAudio ? "" : fileUrl);
    setPlaybackRate(1);
  }, [
    attachment.durationSeconds,
    fileUrl,
    rawFileUrl,
    releaseObjectUrl,
    requiresBlobAudio,
  ]);

  useEffect(() => {
    if (!requiresBlobAudio || audioSrc || playbackError) return undefined;

    void loadAudioSource();
    return undefined;
  }, [audioSrc, loadAudioSource, playbackError, requiresBlobAudio]);

  useEffect(() => {
    return () => {
      sourceVersionRef.current += 1;
      sourceLoadPromiseRef.current = null;
      releaseObjectUrl();
    };
  }, [releaseObjectUrl]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const handlePlaybackRateClick = () => {
    setPlaybackRate((currentRate) => getNextVoicePlaybackRate(currentRate));
  };

  return (
    <div
      className={`chat-voice-player ${
        isMine ? "chat-voice-player-mine" : "chat-voice-player-other"
      } ${isPlaying ? "is-playing" : ""} ${
        isLoadingAudio ? "is-loading" : ""
      } ${playbackError ? "has-error" : ""}`}
      style={{ "--voice-progress": `${progress}%` }}
    >
      <button
        type="button"
        onClick={handleTogglePlay}
        disabled={isLoadingAudio}
        className="chat-voice-player-button"
        aria-label={
          playbackError
            ? "Không thể phát voice"
            : isPlaying
              ? "Tạm dừng voice"
              : "Phát voice"
        }
        title={
          playbackError
            ? "Không thể phát voice"
            : isPlaying
              ? "Tạm dừng"
              : "Phát voice"
        }
      >
        <span className="material-symbols-outlined">
          {playbackError
            ? "error"
            : isLoadingAudio
              ? "progress_activity"
              : isPlaying
                ? "pause"
                : "play_arrow"}
        </span>
      </button>
      <span className="chat-voice-player-divider" aria-hidden="true" />
      <span className="chat-voice-player-waveform" aria-hidden="true">
        {voiceWaveformBars.map((height, index) => (
          <span
            key={`${height}-${index}`}
            style={{
              "--bar-height": `${height}%`,
              "--bar-index": index,
            }}
          />
        ))}
      </span>
      <span className="chat-voice-player-meta">
        <span className="chat-voice-player-duration">
          {formatAudioDuration(displayedTime)}
        </span>
        <button
          type="button"
          className="chat-voice-player-speed"
          onClick={handlePlaybackRateClick}
          title={`Tốc độ phát: ${playbackRateLabel}`}
          aria-label={`Đổi tốc độ phát voice, hiện tại ${playbackRateLabel}`}
        >
          {playbackRateLabel}
        </button>
      </span>
      <audio
        ref={audioRef}
        src={audioSrc || undefined}
        preload="auto"
        onLoadedMetadata={(event) => {
          const nextDuration = event.currentTarget.duration;
          if (Number.isFinite(nextDuration)) {
            setDuration(nextDuration);
          }
        }}
        onTimeUpdate={(event) => {
          setCurrentTime(event.currentTarget.currentTime || 0);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onError={(event) => {
          if (!event.currentTarget.currentSrc) return;
          setIsPlaying(false);
          setPlaybackError(true);
        }}
      />
    </div>
  );
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
  const blocks = [];
  let textLines = [];
  let listLines = [];
  let listType = "";

  const flushText = () => {
    if (!textLines.length) return;

    const blockLines = textLines;
    const blockIndex = blocks.length;
    blocks.push(
      <span
        key={`text-${blockIndex}`}
        className="whitespace-pre-wrap break-words"
      >
        {blockLines.map((line, index) => (
          <span key={`${line}-${index}`}>
            {index > 0 ? "\n" : ""}
            {renderInlineMarkdown(line)}
          </span>
        ))}
      </span>,
    );
    textLines = [];
  };

  const flushList = () => {
    if (!listLines.length) return;

    const ListTag = listType === "ordered" ? "ol" : "ul";
    const listClassName =
      listType === "ordered"
        ? "list-decimal space-y-1 pl-4"
        : "list-disc space-y-1 pl-4";
    const markerPattern = listType === "ordered" ? /^\d+\.\s/ : /^-\s/;
    const blockIndex = blocks.length;

    blocks.push(
      <ListTag key={`${listType}-${blockIndex}`} className={listClassName}>
        {listLines.map((line, index) => (
          <li key={`${line}-${index}`}>
            {renderInlineMarkdown(line.trim().replace(markerPattern, ""))}
          </li>
        ))}
      </ListTag>,
    );
    listLines = [];
    listType = "";
  };

  lines.forEach((line) => {
    const trimmedLine = line.trim();
    const nextListType = trimmedLine.startsWith("- ")
      ? "bullet"
      : /^\d+\.\s/.test(trimmedLine)
        ? "ordered"
        : "";

    if (!nextListType) {
      flushList();
      textLines.push(line);
      return;
    }

    flushText();

    if (listType && listType !== nextListType) {
      flushList();
    }

    listType = nextListType;
    listLines.push(line);
  });

  flushText();
  flushList();

  if (blocks.length === 1) return blocks[0];

  return <div className="space-y-1">{blocks}</div>;
};

const MessageAttachments = ({
  attachments = [],
  isMine,
  hasContent = false,
  standalone = false,
}) => {
  if (!attachments.length) return null;

  return (
    <div
      className={`chat-message-attachments ${
        hasContent ? "chat-message-attachments-after-text" : ""
      } ${standalone ? "chat-message-attachments-standalone" : "chat-message-attachments-in-bubble"} ${
        isMine ? "chat-message-attachments-mine" : "chat-message-attachments-other"
      }`}
    >
      {attachments.map((attachment, index) => {
        const fileName = attachment.fileName || "Tệp đính kèm";
        const isImage = attachment.mimeType?.startsWith("image/");
        const isVideo = attachment.mimeType?.startsWith("video/");

        if (isAudioAttachment(attachment)) {
          return (
            <AudioAttachmentPlayer
              key={`${attachment.fileUrl || fileName}-${index}`}
              attachment={attachment}
              isMine={isMine}
            />
          );
        }

        if (isImage) {
          return (
            <AttachmentImagePreview
              key={`${attachment.fileUrl || fileName}-${index}`}
              attachment={attachment}
              fileName={fileName}
              isMine={isMine}
              standalone={standalone}
            />
          );
        }

        if (isVideo) {
          return (
            <AttachmentVideoPreview
              key={`${attachment.fileUrl || fileName}-${index}`}
              attachment={attachment}
              fileName={fileName}
              isMine={isMine}
              standalone={standalone}
            />
          );
        }

        return (
          <AttachmentFileLink
            key={`${attachment.fileUrl || fileName}-${index}`}
            attachment={attachment}
            fileName={fileName}
            isMine={isMine}
            standalone={standalone}
          />
        );
      })}
    </div>
  );
};

const ReplyMediaThumbnail = ({ attachment }) => {
  if (!attachment) return null;

  const fileName = attachment.fileName || "Tệp đính kèm";
  const isImage = attachment.mimeType?.startsWith("image/");
  const isVideo = attachment.mimeType?.startsWith("video/");

  if (isImage) {
    return <ReplyImageThumbnail attachment={attachment} />;
  }

  if (isVideo) {
    return <ReplyVideoThumbnail attachment={attachment} />;
  }

  if (isAudioAttachment(attachment)) {
    return (
      <span
        className="chat-reply-preview-media chat-reply-preview-audio"
        aria-hidden="true"
        title={fileName}
      >
        <span className="material-symbols-outlined">graphic_eq</span>
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

const pinSystemEventTypes = new Set(["message_pinned", "message_unpinned"]);

const getPinSystemActorName = (sender, currentUserId) => {
  const senderId = getUserId(sender);
  if (senderId && senderId === currentUserId) return "Bạn";
  return sender?.fullName || "";
};

const PinSystemMessage = ({ message, currentUserId, onOpenPinnedList }) => {
  const isUnpin = message.metadata?.eventType === "message_unpinned";
  const actorName = getPinSystemActorName(message.sender, currentUserId);
  const noticeText =
    actorName || !message.content
      ? `${actorName || "Người dùng"} ${
          isUnpin ? "đã bỏ ghim một tin nhắn" : "đã ghim một tin nhắn."
        }`
      : message.content;

  return (
    <div className="chat-pin-system-notice my-3 flex justify-center px-3">
      <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-y-1 text-center text-xs font-semibold text-slate-500">
        <span className="min-w-0 truncate">{noticeText}</span>
        {!isUnpin && (
          <button
            type="button"
            onClick={onOpenPinnedList}
            className="ml-1 font-bold text-blue-600 transition-colors hover:text-blue-700 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Xem tất cả
          </button>
        )}
      </div>
    </div>
  );
};

const PollActivitySystemMessage = ({
  message,
  currentUserId,
  onVotePoll,
  onAddPollOption,
  onTogglePin,
  onSharePoll,
  onClosePoll,
  showPollCard = false,
}) => {
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const pollMessage = message.metadata?.pollMessage;
  const actorName = getPinSystemActorName(message.sender, currentUserId);
  const pollQuestion =
    message.metadata?.pollQuestion ||
    pollMessage?.poll?.question ||
    pollMessage?.content ||
    "Bình chọn";
  const pollEventType = message.metadata?.eventType;
  const isPollCreated = pollEventType === "poll_created";
  const isOptionAdded = pollEventType === "poll_option_added";
  const isPollShared = pollEventType === "poll_shared";
  const isPollClosed = pollEventType === "poll_closed";
  const pollOptionText = message.metadata?.pollOptionText || "";
  const noticeIcon = isPollClosed
    ? "lock"
    : isPollCreated
      ? "add_chart"
      : "bar_chart";

  const renderNoticeText = () => {
    if (isPollCreated) {
      return (
        <>
          <strong>{actorName || "Người dùng"}</strong> đã tạo cuộc bình chọn
          mới: <strong>{pollQuestion}</strong>
        </>
      );
    }

    if (isPollClosed) {
      return (
        <>
          <strong>{actorName || "Người dùng"}</strong> đã khóa bình chọn:{" "}
          <strong>{pollQuestion}</strong>
        </>
      );
    }

    if (isPollShared) {
      return (
        <>
          <strong>{actorName || "Người dùng"}</strong> đã gửi bình chọn vào
          nhóm: <strong>{pollQuestion}</strong>
        </>
      );
    }

    if (isOptionAdded) {
      return (
        <>
          <strong>{actorName || "Người dùng"}</strong> đã thêm lựa chọn{" "}
          {pollOptionText ? <strong>{pollOptionText}</strong> : "mới"} vào cuộc
          bình chọn: <strong>{pollQuestion}</strong>
        </>
      );
    }

    return (
      <>
        <strong>{actorName || "Người dùng"}</strong> tham gia cuộc bình chọn:{" "}
        <strong>{pollQuestion}</strong>
      </>
    );
  };

  if (!pollMessage?.poll) {
    return (
      <div className="chat-poll-activity my-3 flex justify-center px-3">
        <div className="chat-poll-activity-notice">
          <span className="material-symbols-outlined" aria-hidden="true">
            {noticeIcon}
          </span>
          <span>{message.content}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-poll-activity my-3 flex flex-col items-center gap-3 px-3">
      <div className="chat-poll-activity-notice">
        <span className="material-symbols-outlined" aria-hidden="true">
          {noticeIcon}
        </span>
        <span className="min-w-0 truncate">{renderNoticeText()}</span>
        <button
          type="button"
          onClick={() => setIsDetailOpen(true)}
          className="chat-poll-activity-detail-button"
        >
          Xem
        </button>
      </div>

      {showPollCard && (
        <div className="chat-message-poll-surface chat-poll-activity-surface">
          <PollMessage
            message={pollMessage}
            isMine={false}
            onVote={onVotePoll}
            onAddOption={onAddPollOption}
            onTogglePin={onTogglePin}
            onSharePoll={onSharePoll}
            onClosePoll={onClosePoll}
          />
        </div>
      )}

      {isDetailOpen && (
        <PollDetailModal
          message={pollMessage}
          poll={pollMessage.poll}
          onVote={onVotePoll}
          onAddOption={onAddPollOption}
          onTogglePin={onTogglePin}
          onSharePoll={onSharePoll}
          onClosePoll={onClosePoll}
          onClose={() => setIsDetailOpen(false)}
        />
      )}
    </div>
  );
};

const ReminderActivitySystemMessage = ({
  message,
  currentUserId,
  onRespondReminder,
  onCancelReminder,
  onEditReminder,
  showReminderCard = false,
}) => {
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const reminderMessage = message.metadata?.reminderMessage;
  const actorName = getPinSystemActorName(message.sender, currentUserId);
  const reminderTitle =
    message.metadata?.reminderTitle ||
    reminderMessage?.reminder?.title ||
    reminderMessage?.content ||
    "Nhắc hẹn";
  const reminderEventType = message.metadata?.eventType;
  const isCreated = reminderEventType === "reminder_created";
  const isDue = reminderEventType === "reminder_due";
  const isCancelled = reminderEventType === "reminder_cancelled";
  const isResponse = reminderEventType === "reminder_response";
  const isDeclinedResponse =
    message.metadata?.reminderResponseStatus === "declined";
  const noticeIcon = isCancelled
    ? "event_busy"
    : isDue
      ? "alarm"
      : isResponse
        ? isDeclinedResponse
          ? "event_busy"
          : "event_available"
        : "alarm_add";

  const renderNoticeText = () => {
    if (isDue) {
      return (
        <>
          Đến giờ nhắc hẹn: <strong>{reminderTitle}</strong>
        </>
      );
    }

    if (isCancelled) {
      return (
        <>
          <strong>{actorName || "Người dùng"}</strong> đã hủy nhắc hẹn:{" "}
          <strong>{reminderTitle}</strong>
        </>
      );
    }

    if (isCreated) {
      return (
        <>
          <strong>{actorName || "Người dùng"}</strong> đã tạo nhắc hẹn mới:{" "}
          <strong>{reminderTitle}</strong>
        </>
      );
    }

    if (isResponse) {
      return (
        <>
          <strong>{actorName || "Người dùng"}</strong> xác nhận:{" "}
          {isDeclinedResponse ? "không tham gia" : "tham gia"}{" "}
          <strong>{reminderTitle}</strong>.
        </>
      );
    }

    return <span>{message.content}</span>;
  };

  if (!reminderMessage?.reminder) {
    return (
      <div className="chat-reminder-activity my-3 flex justify-center px-3">
        <div className="chat-reminder-activity-notice">
          <span className="material-symbols-outlined" aria-hidden="true">
            {noticeIcon}
          </span>
          <span>{message.content}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-reminder-activity my-3 flex flex-col items-center gap-3 px-3">
      <div className="chat-reminder-activity-notice">
        <span className="material-symbols-outlined" aria-hidden="true">
          {noticeIcon}
        </span>
        <span className="min-w-0 truncate">{renderNoticeText()}</span>
        <button
          type="button"
          onClick={() => setIsDetailOpen(true)}
          className="chat-reminder-activity-detail-button"
        >
          Xem
        </button>
      </div>

      {showReminderCard && (
        <div className="chat-message-reminder-surface chat-reminder-activity-surface">
          <ReminderMessage
            message={reminderMessage}
            onRespond={onRespondReminder}
            onCancelReminder={onCancelReminder}
            onEditReminder={onEditReminder}
          />
        </div>
      )}

      {isDetailOpen && (
        <ReminderDetailModal
          message={reminderMessage}
          reminder={reminderMessage.reminder}
          onRespond={onRespondReminder}
          onCancelReminder={onCancelReminder}
          onEditReminder={onEditReminder}
          onClose={() => setIsDetailOpen(false)}
        />
      )}
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
  showPollActivityCard = false,
  showReminderActivityCard = false,
  onReply,
  onEdit,
  onDelete,
  onCopy,
  onTogglePin,
  onToggleReaction,
  onVotePoll,
  onAddPollOption,
  onSharePoll,
  onClosePoll,
  onRespondReminder,
  onCancelReminder,
  onEditReminder,
  onJumpToMessage,
  onOpenPinnedList,
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
  const isPollMessage = !isDeleted && message.type === "poll" && message.poll;
  const isReminderMessage =
    !isDeleted && message.type === "reminder" && message.reminder;
  const isStructuredMessage = isPollMessage || isReminderMessage;
  const messageAttachments = isStructuredMessage ? [] : message.attachments || [];
  const hasMessageContent = !isStructuredMessage && Boolean(message.content);
  const hasMessageAttachments = messageAttachments.length > 0;
  const hasMixedContent = hasMessageContent && hasMessageAttachments;
  const isAttachmentOnlyMessage =
    !isDeleted && !hasMessageContent && hasMessageAttachments;
  const menuItems = getMenuItems({
    isMine,
    isDeleted,
    isPinned: message.isPinned,
    isStructured: isStructuredMessage,
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
    !isDeleted && hasMixedContent ? "chat-message-bubble-with-attachments" : "",
    !isDeleted && showAvatar ? "chat-message-bubble-avatar-anchor" : "",
    !isDeleted && isTightGroup && !message.isPinned
      ? "chat-message-bubble-linked-before"
      : "",
    !isDeleted && hasTightNext ? "chat-message-bubble-linked-after" : "",
    !isDeleted && message.replyTo ? "chat-message-bubble-with-reply" : "",
    !isDeleted && isHighlighted ? "chat-message-bubble-highlighted" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const getMessageSurfaceClassName = (mine) => {
    if (isPollMessage || isReminderMessage) {
      return [
        isPollMessage ? "chat-message-poll-surface" : "chat-message-reminder-surface",
        mine ? "ml-auto" : "",
        isHighlighted
          ? isPollMessage
            ? "chat-message-poll-surface-highlighted"
            : "chat-message-reminder-surface-highlighted"
          : "",
      ]
        .filter(Boolean)
        .join(" ");
    }

    if (isAttachmentOnlyMessage) {
      return [
        "chat-message-attachment-surface",
        mine
          ? "chat-message-attachment-surface-mine ml-auto"
          : "chat-message-attachment-surface-other",
        isHighlighted ? "chat-message-attachment-surface-highlighted" : "",
        "w-fit",
      ]
        .filter(Boolean)
        .join(" ");
    }

    return `${bubbleClassName} ${
      mine ? "ml-auto " : ""
    }w-fit ${mine ? "" : "border "}px-4 py-2.5 text-[15px] font-medium leading-relaxed transition-colors ${
      isDeleted
        ? mine
          ? "rounded-2xl border border-slate-200 bg-slate-100 text-slate-500 italic shadow-none"
          : "rounded-2xl border-slate-200 bg-slate-100 text-slate-500 italic shadow-none"
        : mine
          ? "rounded-2xl bg-blue-600 text-white"
          : "rounded-2xl border-slate-300 bg-white text-slate-900"
    }`;
  };
  const editedLabelClassName = isAttachmentOnlyMessage
    ? "mt-1 block text-[11px] font-semibold text-slate-500"
    : isMine
      ? "mt-1 block text-[11px] font-semibold text-blue-100"
      : "mt-1 block text-[11px] font-semibold text-slate-500";
  const messageTimestamp =
    timestampLabel || formatMessageTimestamp(message.createdAt);
  const hoverTimestampPlacement = getHoverTimestampPlacement(isMine);
  const shouldShowSenderHeader =
    showSenderHeader || (!isDeleted && message.isPinned);

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

  if (message.type === "system") {
    const systemEventType = message.metadata?.eventType;

    if (systemEventType?.startsWith("call_")) {
      return <CallSystemMessage message={message} />;
    }

    if (pinSystemEventTypes.has(systemEventType)) {
      return (
        <PinSystemMessage
          message={message}
          currentUserId={currentUserId}
          onOpenPinnedList={onOpenPinnedList}
        />
      );
    }

    if (isPollActivityEventType(systemEventType)) {
      return (
        <PollActivitySystemMessage
          message={message}
          currentUserId={currentUserId}
          onVotePoll={onVotePoll}
          onAddPollOption={onAddPollOption}
          onTogglePin={onTogglePin}
          onSharePoll={onSharePoll}
          onClosePoll={onClosePoll}
          showPollCard={showPollActivityCard}
        />
      );
    }

    if (isReminderActivityEventType(systemEventType)) {
      return (
        <ReminderActivitySystemMessage
          message={message}
          currentUserId={currentUserId}
          onRespondReminder={onRespondReminder}
          onCancelReminder={onCancelReminder}
          onEditReminder={onEditReminder}
          showReminderCard={showReminderActivityCard}
        />
      );
    }
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

  const renderPinnedLabel = () =>
    !isDeleted &&
    message.isPinned && (
      <span className="chat-message-pinned-label">Đã ghim</span>
    );

  const renderPinMarker = () =>
    !isDeleted &&
    message.isPinned && (
      <span className="chat-message-pin-marker" aria-hidden="true">
        <span className="material-symbols-outlined">push_pin</span>
      </span>
    );

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

  if (isPollMessage) {
    return (
      <>
        <div
          className={`chat-message-group chat-poll-message-group my-3 flex justify-center px-3 group ${
            isTightGroup ? "chat-message-group-tight" : ""
          }`}
          onPointerLeave={() => {
            hideHoverTime();
          }}
        >
          <div className="chat-poll-message-frame flex w-full flex-col items-center gap-1">
            {shouldShowSenderHeader && (
              <div className="chat-poll-message-author">
                <span>{isMine ? "Bạn" : senderName}</span>
                {renderPinnedLabel()}
              </div>
            )}
            <div
              ref={stackRef}
              className={`chat-message-stack relative ${
                reactionGroups.length ? "pb-4" : ""
              }`}
            >
              <div
                ref={bubbleRef}
                className={getMessageSurfaceClassName(false)}
                onPointerLeave={hideHoverTime}
                onPointerMove={updateHoverTimePosition}
              >
                {renderPinMarker()}
                <PollMessage
                  message={message}
                  isMine={false}
                  onVote={onVotePoll}
                  onAddOption={onAddPollOption}
                  onTogglePin={onTogglePin}
                  onSharePoll={onSharePoll}
                  onClosePoll={onClosePoll}
                />
              </div>
              {renderActions()}
              {renderReactions()}
            </div>
          </div>
        </div>
        {renderHoverTimestamp()}
      </>
    );
  }

  if (isReminderMessage) {
    return (
      <>
        <div
          className={`chat-message-group chat-reminder-message-group my-3 flex justify-center px-3 group ${
            isTightGroup ? "chat-message-group-tight" : ""
          }`}
          onPointerLeave={() => {
            hideHoverTime();
          }}
        >
          <div className="chat-reminder-message-frame flex w-full flex-col items-center gap-1">
            {shouldShowSenderHeader && (
              <div className="chat-reminder-message-author">
                <span>{isMine ? "Bạn" : senderName}</span>
                {renderPinnedLabel()}
              </div>
            )}
            <div
              ref={stackRef}
              className={`chat-message-stack relative ${
                reactionGroups.length ? "pb-4" : ""
              }`}
            >
              <div
                ref={bubbleRef}
                className={getMessageSurfaceClassName(false)}
                onPointerLeave={hideHoverTime}
                onPointerMove={updateHoverTimePosition}
              >
                {renderPinMarker()}
                <ReminderMessage
                  message={message}
                  onRespond={onRespondReminder}
                  onCancelReminder={onCancelReminder}
                  onEditReminder={onEditReminder}
                />
              </div>
              {renderActions()}
              {renderReactions()}
            </div>
          </div>
        </div>
        {renderHoverTimestamp()}
      </>
    );
  }

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
              {renderPinnedLabel()}
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
              className={getMessageSurfaceClassName(true)}
              onPointerLeave={hideHoverTime}
              onPointerMove={updateHoverTimePosition}
            >
              {renderPinMarker()}
              {isDeleted ? (
                <span>{deletedMessageText}</span>
              ) : isPollMessage ? (
                <PollMessage
                  message={message}
                  isMine
                  onVote={onVotePoll}
                  onAddOption={onAddPollOption}
                  onTogglePin={onTogglePin}
                  onSharePoll={onSharePoll}
                  onClosePoll={onClosePoll}
                />
              ) : (
                <>
                  <MessageText content={message.content} />
                  <MessageAttachments
                    attachments={messageAttachments}
                    isMine
                    hasContent={hasMessageContent}
                    standalone={isAttachmentOnlyMessage}
                  />
                  {message.editedAt && (
                    <span className={editedLabelClassName}>
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
            {renderPinnedLabel()}
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
            className={getMessageSurfaceClassName(false)}
            onPointerLeave={hideHoverTime}
            onPointerMove={updateHoverTimePosition}
          >
            {renderPinMarker()}
            {isDeleted ? (
              <span>{deletedMessageText}</span>
            ) : isPollMessage ? (
              <PollMessage
                message={message}
                isMine={false}
                onVote={onVotePoll}
                onAddOption={onAddPollOption}
                onTogglePin={onTogglePin}
                onSharePoll={onSharePoll}
                onClosePoll={onClosePoll}
              />
            ) : (
              <>
                <MessageText content={message.content} />
                <MessageAttachments
                  attachments={messageAttachments}
                  isMine={false}
                  hasContent={hasMessageContent}
                  standalone={isAttachmentOnlyMessage}
                />
                {message.editedAt && (
                  <span className={editedLabelClassName}>
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
