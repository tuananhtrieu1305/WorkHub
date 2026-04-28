import { useAuth } from "../../context/AuthContext";

const API_URL = import.meta.env.VITE_NODE_API_URL || "http://localhost:5000";
const quickReactions = ["👍", "❤️", "😂", "🎉"];

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
  return String(value);
};

const formatTime = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
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
    /(\*\*([^*]+)\*\*|\*([^*]+)\*|~~([^~]+)~~|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
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
      parts.push(<s key={key}>{match[4]}</s>);
    } else if (match[5]) {
      parts.push(
        <code
          key={key}
          className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.9em]"
        >
          {match[5]}
        </code>
      );
    } else if (match[6]) {
      parts.push(
        <a
          key={key}
          href={sanitizeHref(match[7])}
          target="_blank"
          rel="noreferrer"
          className="font-semibold underline underline-offset-2"
        >
          {match[6]}
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

const ReplyQuote = ({ replyTo, isMine }) => {
  if (!replyTo) return null;

  const senderName = replyTo.sender?.fullName || "Tin nhắn";

  return (
    <div
      className={`border-l-[3px] p-2 rounded-t-lg mb-0 text-sm ${
        isMine
          ? "bg-blue-500/20 border-white/50 text-blue-50"
          : "bg-white border-blue-300 text-slate-600"
      }`}
    >
      <span
        className={`font-bold text-xs block mb-0.5 ${
          isMine ? "text-white" : "text-blue-600"
        }`}
      >
        Trả lời {senderName}
      </span>
      <span
        className={`text-xs line-clamp-1 ${
          isMine ? "text-blue-100" : "text-slate-500"
        }`}
      >
        {replyTo.content || "..."}
      </span>
    </div>
  );
};

const MessageBubble = ({
  message,
  showAvatar = true,
  onReply,
  onEdit,
  onDelete,
  onToggleReaction,
}) => {
  const { user } = useAuth();
  const isMine = message.sender?._id === user?._id;
  const senderName = message.sender?.fullName || "Người dùng";
  const avatarUrl = getAvatarUrl(message.sender?.avatar);
  const senderInitial = senderName.charAt(0).toUpperCase();
  const reactionGroups = [...groupReactions(message.reactions || []).values()];

  const renderAvatar = (className = "") => {
    if (!showAvatar) {
      return <div className="w-9 shrink-0" />;
    }

    return avatarUrl ? (
      <img
        src={avatarUrl}
        alt={senderName}
        className={`w-9 h-9 rounded-full object-cover shadow-sm shrink-0 ${className}`}
      />
    ) : (
      <div
        className={`w-9 h-9 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold shadow-sm shrink-0 ${className}`}
      >
        {senderInitial}
      </div>
    );
  };

  const renderActions = (side) => (
    <div
      className={`chat-message-actions absolute top-1/2 -translate-y-1/2 flex gap-1 ${
        side === "left" ? "-left-28" : "-right-28"
      }`}
    >
      {quickReactions.slice(0, 2).map((reaction) => (
        <button
          key={reaction}
          type="button"
          onClick={() => onToggleReaction?.(message, reaction)}
          className="w-7 h-7 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center text-[13px] hover:bg-blue-50 transition-colors"
          title={`Reaction ${reaction}`}
        >
          {reaction}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onReply?.(message)}
        className="w-7 h-7 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors"
        title="Trả lời"
      >
        <span className="material-symbols-outlined text-[14px]">reply</span>
      </button>
      {isMine && (
        <>
          <button
            type="button"
            onClick={() => onEdit?.(message)}
            className="w-7 h-7 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors"
            title="Sửa tin nhắn"
          >
            <span className="material-symbols-outlined text-[14px]">edit</span>
          </button>
          <button
            type="button"
            onClick={() => onDelete?.(message)}
            className="w-7 h-7 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-600 transition-colors"
            title="Gỡ tin nhắn"
          >
            <span className="material-symbols-outlined text-[14px]">delete</span>
          </button>
        </>
      )}
    </div>
  );

  const renderReactions = (alignClass) =>
    reactionGroups.length > 0 && (
      <div className={`flex flex-wrap gap-1 mt-0.5 ${alignClass}`}>
        {reactionGroups.map((group) => {
          const isActive = group.userIds.includes(getComparableId(user?._id));
          return (
            <button
              key={group.reaction}
              type="button"
              onClick={() => onToggleReaction?.(message, group.reaction)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 border rounded-full text-xs transition-colors ${
                isActive
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "bg-white border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span>{group.reaction}</span>
              <span>{group.count}</span>
            </button>
          );
        })}
      </div>
    );

  if (isMine) {
    return (
      <div className="chat-message-group flex items-start gap-3 justify-end group">
        <div className="flex flex-col gap-1 items-end max-w-[70%]">
          {showAvatar && (
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-slate-400 font-medium">
                {formatTime(message.createdAt)}
              </span>
              <span className="text-sm font-bold text-slate-900">Bạn</span>
            </div>
          )}
          <div className="relative">
            <ReplyQuote replyTo={message.replyTo} isMine />
            <div
              className={`bg-blue-600 text-white px-4 py-2.5 text-[15px] leading-relaxed shadow-sm group-hover:shadow-md transition-shadow w-fit ml-auto ${
                message.replyTo
                  ? "rounded-b-2xl rounded-tr-sm"
                  : "rounded-2xl rounded-tr-sm"
              }`}
            >
              <MessageText content={message.content} />
              <MessageAttachments
                attachments={message.attachments || []}
                isMine
              />
            </div>
            {renderActions("left")}
          </div>
          {renderReactions("justify-end")}
        </div>
        {renderAvatar("mt-1")}
      </div>
    );
  }

  return (
    <div className="chat-message-group flex items-start gap-3 group">
      {renderAvatar("mt-1 cursor-pointer")}
      <div className="flex flex-col gap-1 items-start max-w-[70%]">
        {showAvatar && (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold text-slate-900 cursor-pointer hover:underline">
              {senderName}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {formatTime(message.createdAt)}
            </span>
          </div>
        )}
        <div className="relative">
          <ReplyQuote replyTo={message.replyTo} />
          <div
            className={`bg-slate-100 border border-slate-200/80 text-slate-800 px-4 py-2.5 text-[15px] leading-relaxed shadow-sm w-fit group-hover:shadow-md transition-shadow ${
              message.replyTo
                ? "rounded-b-2xl rounded-tl-sm"
                : "rounded-2xl rounded-tl-sm"
            }`}
          >
            <MessageText content={message.content} />
            <MessageAttachments attachments={message.attachments || []} />
          </div>
          {renderActions("right")}
        </div>
        {renderReactions("")}
      </div>
    </div>
  );
};

export default MessageBubble;
