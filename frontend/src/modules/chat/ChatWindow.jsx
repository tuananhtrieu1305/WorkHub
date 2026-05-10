import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import { App } from "antd";
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
  const conversationId = conversation.id || conversation._id;
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
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => handleStartCall("audio")}
            disabled={!canAttemptPrivateCall}
            aria-label="Gọi thoại"
            className="hidden items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex"
          >
            <span className="material-symbols-outlined text-[18px]">call</span>
            <span className="hidden lg:inline">Gọi</span>
          </button>
          <button
            onClick={() => handleStartCall("video")}
            disabled={!canAttemptPrivateCall}
            aria-label="Gọi video"
            className="hidden items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm shadow-blue-900/20 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex"
          >
            <span className="material-symbols-outlined text-[18px]">
              videocam
            </span>
            <span className="hidden lg:inline">Họp</span>
          </button>
          <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />
          <button
            className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            title="Tìm trong cuộc hội thoại"
          >
            <span className="material-symbols-outlined text-[20px]">
              search
            </span>
          </button>
          <button
            onClick={onToggleDetail}
            className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
            title="Thông tin hội thoại"
          >
            <span className="material-symbols-outlined text-[20px]">info</span>
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="chat-messages-pane chat-messages-scroll flex flex-1 flex-col space-y-4 overflow-y-auto px-4 py-6 sm:px-6">
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
          <>
            {/* Date separator - example */}
            <div className="flex items-center justify-center my-2">
              <div className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
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
      {(replyToMessage || editingMessage) && (
        <div className="border-t border-slate-200 bg-white px-4 py-2 sm:px-6">
          <div className="flex items-start justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-blue-600">
                {editingMessage
                  ? "Đang sửa tin nhắn"
                  : `Trả lời ${replyToMessage?.sender?.fullName || "tin nhắn"}`}
              </p>
              <p className="truncate text-xs font-medium text-slate-600">
                {(editingMessage || replyToMessage)?.content || "..."}
              </p>
            </div>
            <button
              type="button"
              onClick={onCancelDraft}
              className="rounded p-1 text-slate-500 hover:bg-white hover:text-slate-900"
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
