import { useState } from "react";
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

const filterTabs = [
  { key: "all", label: "Tất cả" },
  { key: "unread", label: "Chưa đọc" },
  { key: "mentions", label: "Đề cập" },
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
    className={`absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white ${meta.badgeClassName}`}
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
  onSelect,
  onCreateNew,
  currentUserId,
}) => {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [channelsExpanded, setChannelsExpanded] = useState(true);
  const [dmsExpanded, setDmsExpanded] = useState(true);

  // Split into groups (channels) and private (DMs)
  const channels = conversations.filter((c) => c.type === "group");
  const directMessages = conversations.filter((c) => c.type === "private");

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
    return other?.user?.fullName?.toLowerCase().includes(q);
  };

  const filteredChannels = channels.filter(filterConversation);
  const filteredDms = directMessages.filter(filterConversation);

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
    return {
      name: user?.fullName || "Người dùng",
      avatarUrl: getAvatarUrl(user?.avatar),
      initial: (user?.fullName || "N").charAt(0).toUpperCase(),
      isGroup: false,
      activityStatus: user?.activityStatus,
      isOnline: user?.isOnline,
    };
  };

  const renderConversationItem = (conv) => {
    const { name, avatarUrl, initial, isGroup, activityStatus, isOnline } =
      getDisplayInfo(conv);
    const activityStatusMeta = getActivityStatusMeta(
      getEffectiveActivityStatus({ activityStatus, isOnline })
    );
    const isSelected = selectedId === conv.id;
    const lastMsg = conv.lastMessage;
    const lastMsgContent = lastMsg?.content || "";
    const lastMsgTime = formatRelativeTime(lastMsg?.createdAt || conv.updatedAt);
    const isMySentMsg = lastMsg?.senderId === currentUserId;

    return (
      <button
        key={conv.id}
        onClick={() => onSelect?.(conv)}
        className={`flex items-start gap-3 p-3 w-full text-left transition-colors border-l-4 cursor-pointer ${
          isSelected
            ? "bg-blue-50 border-blue-600"
            : "border-transparent hover:bg-slate-50"
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
              className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold ring-2 ring-white shadow-sm">
              {initial}
            </div>
          )}
          {!isGroup && <ActivityStatusBadge meta={activityStatusMeta} />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-baseline mb-0.5">
            <h3
              className={`text-sm font-bold truncate ${
                isSelected ? "text-blue-700" : "text-slate-900"
              }`}
            >
              {isGroup ? `# ${name}` : name}
            </h3>
            <span
              className={`text-[11px] whitespace-nowrap ml-2 ${
                isSelected ? "text-blue-600 font-medium" : "text-slate-400"
              }`}
            >
              {lastMsgTime}
            </span>
          </div>
          {lastMsgContent && (
            <p className="text-[13px] text-slate-500 truncate">
              {isMySentMsg && (
                <span className="font-medium text-slate-700">Bạn: </span>
              )}
              {lastMsgContent}
            </p>
          )}
        </div>
      </button>
    );
  };

  return (
    <aside className="w-[22rem] max-w-[calc(100vw-5rem)] flex flex-col bg-white border-r border-slate-200/50 shrink-0 h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-200/50 flex justify-between items-center shrink-0">
        <h1 className="text-lg font-bold text-slate-900">Hội thoại</h1>
        <button
          onClick={onCreateNew}
          className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors shadow-sm flex items-center justify-center cursor-pointer"
          title="Tạo hội thoại mới"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
        </button>
      </div>

      {/* Search + Tabs */}
      <div className="p-3 border-b border-slate-200/50 shrink-0">
        <div className="relative mb-3">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Lọc hội thoại..."
            className="w-full bg-slate-100 border-none rounded-lg h-9 pl-9 pr-3 text-sm focus:ring-2 focus:ring-blue-500/30 focus:bg-white transition-colors outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                close
              </span>
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === tab.key
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto chat-conversations-scroll">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <span className="material-symbols-outlined text-5xl text-slate-200 mb-3">
              forum
            </span>
            <p className="text-sm font-bold text-slate-400 mb-1">
              Chưa có hội thoại nào
            </p>
            <p className="text-xs text-slate-400">
              Bấm nút + để bắt đầu trò chuyện
            </p>
          </div>
        ) : (
          <>
            {/* Channels Section */}
            {filteredChannels.length > 0 && (
              <div className="mb-1 mt-1">
                <button
                  onClick={() => setChannelsExpanded(!channelsExpanded)}
                  className="flex items-center justify-between px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider hover:bg-slate-50 w-full transition-colors cursor-pointer"
                >
                  <span>Kênh</span>
                  <span
                    className={`material-symbols-outlined text-[16px] transition-transform ${
                      channelsExpanded ? "" : "-rotate-90"
                    }`}
                  >
                    expand_more
                  </span>
                </button>
                {channelsExpanded && (
                  <div className="flex flex-col">
                    {filteredChannels.map(renderConversationItem)}
                  </div>
                )}
              </div>
            )}

            {/* Direct Messages Section */}
            {filteredDms.length > 0 && (
              <div className="mb-1">
                <button
                  onClick={() => setDmsExpanded(!dmsExpanded)}
                  className="flex items-center justify-between px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider hover:bg-slate-50 w-full transition-colors cursor-pointer"
                >
                  <span>Tin nhắn riêng</span>
                  <span
                    className={`material-symbols-outlined text-[16px] transition-transform ${
                      dmsExpanded ? "" : "-rotate-90"
                    }`}
                  >
                    expand_more
                  </span>
                </button>
                {dmsExpanded && (
                  <div className="flex flex-col">
                    {filteredDms.map(renderConversationItem)}
                  </div>
                )}
              </div>
            )}

            {/* No results */}
            {filteredChannels.length === 0 &&
              filteredDms.length === 0 &&
              searchQuery && (
                <div className="text-center py-10">
                  <span className="material-symbols-outlined text-3xl text-slate-300 mb-2 block">
                    search_off
                  </span>
                  <p className="text-xs text-slate-400 font-medium">
                    Không tìm thấy hội thoại
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
