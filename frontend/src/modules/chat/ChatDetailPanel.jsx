import {
  getActivityStatusMeta,
  getEffectiveActivityStatus,
} from "./activityStatus";
import ActivityStatusIcon from "./ActivityStatusIcon";
import { getChatDetailDisplay } from "./chatDetailPanelState";

const API_URL = import.meta.env.VITE_NODE_API_URL || "http://localhost:5000";

const getAvatarUrl = (avatar) => {
  if (!avatar) return null;
  return avatar.startsWith("http") ? avatar : `${API_URL}${avatar}`;
};

const ChatDetailPanel = ({ conversation, currentUserId, onClose }) => {
  if (!conversation) return null;

  const display = getChatDetailDisplay(conversation, currentUserId);
  const {
    isPrivate,
    participantCount,
    displayName,
    displayInitial,
    email,
    avatar,
    activityStatus,
    isOnline,
  } = display;
  const displayAvatar = getAvatarUrl(avatar);
  const activityStatusMeta = getActivityStatusMeta(
    getEffectiveActivityStatus({ activityStatus, isOnline }),
  );

  return (
    <aside className="w-80 bg-slate-50/50 border-l border-slate-200/50 flex flex-col h-full overflow-y-auto shrink-0 hidden xl:flex">
      {/* Header - Close button */}
      <div className="flex items-center justify-end p-4 border-b border-slate-200/50">
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Đóng"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      {/* Profile Section */}
      <div className="p-5 border-b border-slate-200/50 flex flex-col items-center">
        <div className="relative mb-3">
          {displayAvatar ? (
            <img
              src={displayAvatar}
              alt={displayName}
              className="w-20 h-20 rounded-full object-cover ring-4 ring-white shadow-md"
            />
          ) : isPrivate ? (
            <div className="w-20 h-20 rounded-full ring-4 ring-white shadow-md bg-blue-600 text-white flex items-center justify-center text-2xl font-bold">
              {displayInitial}
            </div>
          ) : (
            <div className="w-20 h-20 rounded-xl ring-4 ring-white shadow-md bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center text-2xl font-bold">
              {displayInitial}
            </div>
          )}
          {/* Online status dot for private chats */}
          {isPrivate && (
            <div
              className={`absolute bottom-1 right-1 flex w-5 h-5 items-center justify-center rounded-full border-2 border-white ${activityStatusMeta.badgeClassName}`}
              title={activityStatusMeta.menuLabel}
            >
              <ActivityStatusIcon meta={activityStatusMeta} size="xs" />
            </div>
          )}
        </div>

        <h3 className="text-lg font-bold text-slate-900">{displayName}</h3>

        {isPrivate && email && (
          <p className="text-sm text-slate-500 mt-0.5">
            {email}
          </p>
        )}

        {!isPrivate && (
          <p className="text-sm text-slate-500 mt-0.5">
            {participantCount} thành viên
          </p>
        )}

        {/* Quick Actions */}
        <div className="flex gap-2 w-full mt-4">
          <button className="flex-1 flex flex-col items-center justify-center py-2.5 bg-white border border-slate-200 rounded-xl hover:border-blue-500/50 hover:text-blue-600 transition-colors text-slate-600 cursor-pointer">
            <span className="material-symbols-outlined text-[20px] mb-1">
              person
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Hồ sơ
            </span>
          </button>
          <button className="flex-1 flex flex-col items-center justify-center py-2.5 bg-white border border-slate-200 rounded-xl hover:border-blue-500/50 hover:text-blue-600 transition-colors text-slate-600 cursor-pointer">
            <span className="material-symbols-outlined text-[20px] mb-1">
              search
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Tìm kiếm
            </span>
          </button>
          <button className="flex-1 flex flex-col items-center justify-center py-2.5 bg-white border border-slate-200 rounded-xl hover:border-blue-500/50 hover:text-blue-600 transition-colors text-slate-600 cursor-pointer">
            <span className="material-symbols-outlined text-[20px] mb-1">
              more_horiz
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Khác
            </span>
          </button>
        </div>
      </div>

      {/* Shared Media */}
      <div className="p-5 border-b border-slate-200/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
            Phương tiện chia sẻ
          </h3>
          <button className="text-blue-600 text-xs font-semibold hover:underline cursor-pointer">
            Xem tất cả
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {/* Empty state for shared media */}
          <div className="col-span-3 text-center py-6">
            <span className="material-symbols-outlined text-3xl text-slate-300 mb-2 block">
              photo_library
            </span>
            <p className="text-xs text-slate-400 font-medium">
              Chưa có phương tiện
            </p>
          </div>
        </div>
      </div>

      {/* Members (for groups) */}
      {!isPrivate && (
        <div className="p-5 border-b border-slate-200/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-blue-500">
                group
              </span>
              Thành viên ({participantCount})
            </h3>
            <button className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">
                person_add
              </span>
            </button>
          </div>
          <div className="space-y-2">
            {(conversation.participants || []).map((p, idx) => {
              const pUser = p.user;
              const pAvatar = getAvatarUrl(pUser?.avatar);
              const pName = pUser?.fullName || "Người dùng";
              return (
                <div
                  key={pUser?._id || idx}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-white transition-colors cursor-pointer"
                >
                  {pAvatar ? (
                    <img
                      src={pAvatar}
                      alt={pName}
                      className="w-8 h-8 rounded-full object-cover ring-2 ring-white shadow-sm"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold ring-2 ring-white shadow-sm">
                      {pName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-medium text-slate-700 truncate">
                    {pName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Derived Tasks */}
      <div className="p-5 flex-1">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-blue-500">
              task_alt
            </span>
            Công việc liên quan
          </h3>
          <button className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">add</span>
          </button>
        </div>
        <div className="space-y-3">
          {/* Empty state */}
          <div className="text-center py-6">
            <span className="material-symbols-outlined text-3xl text-slate-300 mb-2 block">
              checklist
            </span>
            <p className="text-xs text-slate-400 font-medium">
              Chưa có công việc nào
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default ChatDetailPanel;
