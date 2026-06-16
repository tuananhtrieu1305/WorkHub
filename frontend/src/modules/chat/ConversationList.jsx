import { useState } from "react";
import {
  getActivityStatusMeta,
  getEffectiveActivityStatus,
} from "./activityStatus";
import ActivityStatusIcon from "./ActivityStatusIcon";
import {
  getAvatarReferrerPolicy,
  getAvatarUrl,
} from "../../utils/avatar";
import {
  conversationHasUnread,
  getConversationPreview,
  getConversationTabItems,
} from "./conversationListState";
import { ConversationListSkeleton } from "../../components/common/Skeleton";

const filterTabs = [
  { key: "all", label: "Tất cả" },
  { key: "unread", label: "Chưa đọc" },
  { key: "groups", label: "Nhóm" },
];

// Gradient palette for group channel avatars
const channelGradients = [
  "from-blue-500 to-cyan-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-pink-500 to-rose-500",
  "from-indigo-500 to-blue-600",
  "from-violet-500 to-purple-500",
];

const getChannelGradient = (name) => {
  const hash = (name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return channelGradients[hash % channelGradients.length];
};

const ActivityStatusBadge = ({ meta }) => (
  <span
    className={`activity-status-badge activity-status-badge--compact absolute -bottom-0.5 -right-0.5 ${meta.badgeClassName}`}
  >
    <ActivityStatusIcon meta={meta} size="xs" />
  </span>
);

const formatRelativeTime = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Vừa xong";
  if (diffMins < 60) return `${diffMins} phút`;
  if (diffHours < 24) {
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (diffDays === 1) return "Hôm qua";
  if (diffDays < 7) {
    const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    return days[date.getDay()];
  }
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
};

const ConversationList = ({
  conversations = [],
  selectedId,
  isLoading = false,
  onSelect,
  onMarkRead,
  onCreateNew,
  currentUserId,
}) => {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Search filter
  const filterConversation = (conv) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (conv.type === "group") {
      return conv.name?.toLowerCase().includes(q);
    }
    const other = conv.participants?.find(
      (p) => (p.user?._id || p.userId?.toString()) !== currentUserId
    );
    return [conv.currentParticipant?.nickname, other?.user?.fullName]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(q));
  };

  const filteredConversations = getConversationTabItems(
    conversations,
    activeTab,
    currentUserId,
  ).filter(filterConversation);
  const selectedFilterTabIndex = Math.max(
    filterTabs.findIndex((tab) => tab.key === activeTab),
    0
  );

  const getDisplayInfo = (conv) => {
    if (conv.type === "group") {
      return {
        name: conv.name || "Nhóm",
        avatarUrl: getAvatarUrl(conv.avatar),
        initial: (conv.name || "N").charAt(0).toUpperCase(),
        isGroup: true,
      };
    }
    const other = conv.participants?.find(
      (p) => (p.user?._id || p.userId?.toString()) !== currentUserId
    );
    const user = other?.user;
    const nickname = conv.currentParticipant?.nickname || "";
    return {
      name: nickname || user?.fullName || "Người dùng",
      avatarUrl: getAvatarUrl(user?.avatar),
      initial: (nickname || user?.fullName || "N").charAt(0).toUpperCase(),
      isGroup: false,
      activityStatus: user?.activityStatus,
      isOnline: user?.isOnline,
    };
  };

  const renderConversationItem = (conv) => {
    const { name, avatarUrl, initial, isGroup, activityStatus, isOnline } =
      getDisplayInfo(conv);
    const conversationId = conv.id || conv._id;
    const activityStatusMeta = getActivityStatusMeta(
      getEffectiveActivityStatus({ activityStatus, isOnline })
    );
    const isSelected = selectedId === conversationId;
    const lastMsg = conv.lastMessage;
    const hasUnread = conversationHasUnread(conv, currentUserId);
    const preview = getConversationPreview(conv, currentUserId);
    const lastMsgContent = preview.content;
    const lastMsgTime = formatRelativeTime(lastMsg?.createdAt || conv.updatedAt);
    const isMySentMsg = preview.isMine;
    const isPinned = Boolean(conv.currentParticipant?.isPinned);
    const isMuted = Boolean(conv.currentParticipant?.isMuted);
    const handleSelect = () => onSelect?.(conv);
    const handleKeyDown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleSelect();
      }
    };
    const handleMarkRead = (event) => {
      event.stopPropagation();
      onMarkRead?.(conv);
    };

    return (
      <div
        key={conversationId}
        role="button"
        tabIndex={0}
        onClick={handleSelect}
        onKeyDown={handleKeyDown}
        className={`mx-2 my-1 flex w-[calc(100%-1rem)] items-start gap-3 rounded-xl border px-3 py-3 text-left transition-all cursor-pointer ${
          isSelected
            ? "border-blue-200 bg-blue-50 text-slate-950 shadow-[inset_3px_0_0_#3b82f6]"
            : hasUnread
              ? "border-blue-200 bg-blue-50/80 text-slate-950 shadow-sm hover:border-blue-300 hover:bg-blue-50"
            : "border-slate-200 bg-white text-slate-900 hover:border-blue-200 hover:bg-blue-50/80"
        }`}
      >
        {/* Avatar */}
        <div className="relative shrink-0 mt-0.5">
          {isGroup ? (
            <div
              className={`w-10 h-10 bg-gradient-to-br ${getChannelGradient(
                name
              )} rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm`}
            >
              #{initial}
            </div>
          ) : avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              referrerPolicy={getAvatarReferrerPolicy(avatarUrl)}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm"
            />
          ) : (
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ring-2 ring-white shadow-sm ${
                isSelected
                  ? "bg-blue-100 text-blue-700"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {initial}
            </div>
          )}
          {!isGroup && <ActivityStatusBadge meta={activityStatusMeta} />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-baseline mb-0.5">
            <h3
              className={`flex min-w-0 items-center gap-1.5 truncate text-sm font-bold ${
                hasUnread ? "text-blue-950" : "text-slate-950"
              }`}
            >
              {isPinned && (
                <span
                  className="material-symbols-outlined shrink-0 text-[15px] text-amber-600"
                  title="Đã ghim"
                >
                  push_pin
                </span>
              )}
              <span className="truncate">{isGroup ? `# ${name}` : name}</span>
              {isMuted && (
                <span
                  className="material-symbols-outlined shrink-0 text-[15px] text-slate-400"
                  title="Đang tắt thông báo"
                >
                  notifications_off
                </span>
              )}
            </h3>
            <span
              className={`text-[11px] whitespace-nowrap ml-2 ${
                isSelected || hasUnread
                  ? "text-blue-700 font-semibold"
                  : "text-slate-500"
              }`}
            >
              {lastMsgTime}
            </span>
          </div>
          {lastMsgContent && (
            <p
              className={`truncate text-[13px] ${
                hasUnread ? "font-extrabold text-slate-950" : "text-slate-600"
              } ${preview.isDeleted ? "italic" : ""}`}
            >
              {isMySentMsg && (
                <span
                  className={`font-semibold ${
                    isSelected ? "text-blue-800" : "text-slate-800"
                  }`}
                >
                  Bạn:{" "}
                </span>
              )}
              {lastMsgContent}
            </p>
          )}
          {hasUnread && (
            <button
              type="button"
              onClick={handleMarkRead}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-extrabold text-blue-700 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50"
              title="Đánh dấu hội thoại này là đã đọc"
            >
              <span className="h-2 w-2 rounded-full bg-blue-600" />
              Tin nhắn mới chưa đọc
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <aside className="flex h-full w-full max-w-full shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-slate-50">
      {/* Header + Search + Tabs */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 pb-4 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-950">Hội thoại</h1>
          <button
            onClick={onCreateNew}
            className="flex items-center justify-center rounded-lg bg-blue-600 p-2 text-white shadow-sm shadow-blue-900/20 transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 cursor-pointer"
            title="Tạo hội thoại mới"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
          </button>
        </div>

        <div className="relative mb-3">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Lọc hội thoại..."
            className="h-10 w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-9 text-sm font-medium text-slate-900 outline-none transition-colors placeholder:text-slate-500 hover:border-slate-400 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-600/20"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                close
              </span>
            </button>
          )}
        </div>
        <div
          className="workhub-notification-tabs flex rounded-xl bg-slate-100 p-1"
          style={{ "--tab-index": selectedFilterTabIndex }}
        >
          <span
            className="workhub-notification-tab-indicator"
            aria-hidden="true"
          />
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative z-10 flex-1 rounded-lg px-2.5 py-2 text-xs font-extrabold whitespace-nowrap transition-colors duration-300 cursor-pointer ${
                activeTab === tab.key
                  ? "text-blue-700"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto chat-conversations-scroll">
        {isLoading ? (
          <ConversationListSkeleton />
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <span className="material-symbols-outlined mb-3 text-5xl text-slate-300">
              forum
            </span>
            <p className="mb-1 text-sm font-bold text-slate-700">
              Chưa có hội thoại nào
            </p>
            <p className="text-xs font-medium text-slate-500">
              Bấm nút + để bắt đầu trò chuyện
            </p>
          </div>
        ) : (
          <>
            {filteredConversations.length > 0 && (
              <div className="mb-1 mt-1 flex flex-col">
                {filteredConversations.map(renderConversationItem)}
              </div>
            )}

            {/* No results */}
            {filteredConversations.length === 0 &&
              (searchQuery || activeTab !== "all") && (
                <div className="text-center py-10">
                  <span className="material-symbols-outlined mb-2 block text-3xl text-slate-400">
                    search_off
                  </span>
                  <p className="text-xs font-semibold text-slate-600">
                    {activeTab === "unread"
                      ? "Không có hội thoại chưa đọc"
                      : "Không tìm thấy hội thoại"}
                  </p>
                </div>
              )}
          </>
        )}
      </div>
    </aside>
  );
};

export default ConversationList;
