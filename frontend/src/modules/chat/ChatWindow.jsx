import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import { useAuth } from "../../context/AuthContext";
import {
  getActivityStatusMeta,
  getEffectiveActivityStatus,
} from "./activityStatus";
import ActivityStatusIcon from "./ActivityStatusIcon";

const API_URL = import.meta.env.VITE_NODE_API_URL || "http://localhost:5000";

const getAvatarUrl = (avatar) => {
  if (!avatar) return null;
  return avatar.startsWith("http") ? avatar : `${API_URL}${avatar}`;
};

const ActivityStatusBadge = ({ meta }) => (
  <span
    className={`absolute bottom-0 right-0 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white ${meta.badgeClassName}`}
  >
    <ActivityStatusIcon meta={meta} size="xs" />
  </span>
);

const ChatWindow = ({
  conversation,
  messages = [],
  onSendMessage,
  onUploadAttachment,
  onTypingChange,
  onReplyMessage,
  onEditMessage,
  onDeleteMessage,
  onToggleReaction,
  onCancelDraft,
  onBack,
  onToggleDetail,
  replyToMessage = null,
  editingMessage = null,
  typingUsers = [],
  isLoadingMessages = false,
  isSending = false,
}) => {
  const { user } = useAuth();

  // Empty state - no conversation selected
  if (!conversation) {
    return (
      <main className="flex-1 flex flex-col h-full bg-white items-center justify-center">
        <div className="text-center px-6">
          <div className="w-24 h-24 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-5xl text-blue-400">
              chat
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Chào mừng đến với Tin nhắn
          </h2>
          <p className="text-sm text-slate-500 max-w-sm">
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
  const activityStatusMeta = getActivityStatusMeta(
    getEffectiveActivityStatus(otherParticipant)
  );
  const shouldShowActivityStatus = isPrivate && activityStatusMeta.label;

  const participantCount = conversation.participants?.length || 0;

  return (
    <main className="flex-1 flex flex-col h-full bg-white min-w-0">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200/50 bg-white/80 backdrop-blur-md shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3 min-w-0">
          {/* Back button for mobile */}
          <button
            onClick={onBack}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors md:hidden"
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
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold ring-2 ring-white shadow-sm">
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
            <h2 className="text-base font-bold leading-tight truncate">
              {isPrivate ? displayName : `# ${displayName}`}
            </h2>
            {shouldShowActivityStatus ? (
              <p
                className={`text-xs font-medium truncate ${activityStatusMeta.textClassName}`}
              >
                {activityStatusMeta.label}
              </p>
            ) : !isPrivate ? (
              <p className="text-xs text-slate-500 truncate">
                {participantCount} thành viên
              </p>
            ) : null}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
            title="Gọi thoại"
          >
            <span className="material-symbols-outlined text-[18px]">call</span>
            <span className="hidden lg:inline">Gọi</span>
          </button>
          <button
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
            title="Gọi video"
          >
            <span className="material-symbols-outlined text-[18px]">
              videocam
            </span>
            <span className="hidden lg:inline">Họp</span>
          </button>
          <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />
          <button
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Tìm trong cuộc hội thoại"
          >
            <span className="material-symbols-outlined text-[20px]">
              search
            </span>
          </button>
          <button
            onClick={onToggleDetail}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Thông tin hội thoại"
          >
            <span className="material-symbols-outlined text-[20px]">info</span>
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4 flex flex-col chat-messages-scroll">
        {isLoadingMessages ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="route-loading-spinner mb-3" />
            <p className="text-sm text-slate-400 font-medium">
              Đang tải tin nhắn...
            </p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-3xl text-slate-300">
                waving_hand
              </span>
            </div>
            <p className="text-sm text-slate-400 font-medium">
              Hãy bắt đầu cuộc trò chuyện!
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Gửi tin nhắn đầu tiên bên dưới.
            </p>
          </div>
        ) : (
          <>
            {/* Date separator - example */}
            <div className="flex items-center justify-center my-2">
              <div className="bg-slate-100 text-slate-500 text-xs font-semibold px-4 py-1.5 rounded-full shadow-sm">
                Hôm nay
              </div>
            </div>

            {/* Messages */}
            {messages.map((msg, idx) => {
              const prevMsg = idx > 0 ? messages[idx - 1] : null;
              const showAvatar =
                !prevMsg ||
                prevMsg.sender?._id !== msg.sender?._id ||
                new Date(msg.createdAt) - new Date(prevMsg.createdAt) > 300000;

              return (
                <MessageBubble
                  key={msg.id || idx}
                  message={msg}
                  showAvatar={showAvatar}
                  onReply={onReplyMessage}
                  onEdit={onEditMessage}
                  onDelete={onDeleteMessage}
                  onToggleReaction={onToggleReaction}
                />
              );
            })}
          </>
        )}
      </div>

      {/* Typing Indicator */}
      {typingUsers.length > 0 && (
        <div className="px-6 pb-1">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium italic">
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
      {(replyToMessage || editingMessage) && (
        <div className="px-6 py-2 border-t border-slate-100 bg-slate-50/80">
          <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-blue-600">
                {editingMessage
                  ? "Đang sửa tin nhắn"
                  : `Trả lời ${replyToMessage?.sender?.fullName || "tin nhắn"}`}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {(editingMessage || replyToMessage)?.content || "..."}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancelDraft}
              className="p-1 text-slate-400 hover:text-slate-700 rounded"
              title="Hủy"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
      )}
      <ChatInput
        key={editingMessage?.id || replyToMessage?.id || "new-message"}
        onSend={onSendMessage}
        onUploadAttachment={onUploadAttachment}
        onTypingChange={onTypingChange}
        onCancelDraft={onCancelDraft}
        initialContent={editingMessage?.content || ""}
        mode={editingMessage ? "edit" : replyToMessage ? "reply" : "send"}
        disabled={isSending}
        placeholder={`Trả lời ${isPrivate ? displayName : `# ${displayName}`}...`}
      />
    </main>
  );
};

export default ChatWindow;
