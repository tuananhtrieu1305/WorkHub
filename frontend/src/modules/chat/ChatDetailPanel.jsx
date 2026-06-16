import {
  getActivityStatusMeta,
  getEffectiveActivityStatus,
} from "./activityStatus";
import ActivityStatusIcon from "./ActivityStatusIcon";
import { getChatDetailDisplay } from "./chatDetailPanelState";
import {
  getAvatarReferrerPolicy,
  getAvatarUrl,
} from "../../utils/avatar";

const ChatDetailPanel = ({
  conversation,
  currentUserId,
  onClose,
  className = "hidden w-80 border-l border-slate-200 bg-white xl:flex",
}) => {
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
    <aside className={`chat-detail-panel h-full shrink-0 flex-col overflow-y-auto ${className}`}>
      {/* Header - Close button */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
          Chi tiết
        </h2>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
          title="Đóng"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      {/* Profile Section */}
      <div className="flex flex-col items-center border-b border-slate-200 bg-slate-50 p-5">
        <div className="relative mb-3">
          {displayAvatar ? (
            <img
              src={displayAvatar}
              alt={displayName}
              referrerPolicy={getAvatarReferrerPolicy(displayAvatar)}
              className="h-20 w-20 rounded-full object-cover ring-4 ring-white shadow-md"
            />
          ) : isPrivate ? (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white ring-4 ring-white shadow-md">
              {displayInitial}
            </div>
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-2xl font-bold text-white ring-4 ring-white shadow-md">
              {displayInitial}
            </div>
          )}
          {/* Online status dot for private chats */}
          {isPrivate && (
            <div
              className={`activity-status-badge activity-status-badge--large absolute bottom-1 right-1 ${activityStatusMeta.badgeClassName}`}
              title={activityStatusMeta.menuLabel}
            >
              <ActivityStatusIcon meta={activityStatusMeta} size="sm" />
            </div>
          )}
        </div>

        <h3 className="text-lg font-bold text-slate-900">{displayName}</h3>

        {isPrivate && email && (
          <p className="mt-0.5 max-w-full break-all text-center text-sm font-medium text-slate-600">
            {email}
          </p>
        )}

        {!isPrivate && (
          <p className="mt-0.5 text-sm font-medium text-slate-600">
            {participantCount} thành viên
          </p>
        )}

        {/* Quick Actions */}
        <div className="mt-4 flex w-full gap-2">
          <button className="flex flex-1 flex-col items-center justify-center rounded-xl border border-slate-300 bg-white py-2.5 text-slate-700 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 cursor-pointer">
            <span className="material-symbols-outlined text-[20px] mb-1">
              person
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Hồ sơ
            </span>
          </button>
          <button className="flex flex-1 flex-col items-center justify-center rounded-xl border border-slate-300 bg-white py-2.5 text-slate-700 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 cursor-pointer">
            <span className="material-symbols-outlined text-[20px] mb-1">
              search
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Tìm kiếm
            </span>
          </button>
          <button className="flex flex-1 flex-col items-center justify-center rounded-xl border border-slate-300 bg-white py-2.5 text-slate-700 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 cursor-pointer">
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
      <div className="border-b border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
            Phương tiện chia sẻ
          </h3>
          <button className="text-xs font-bold text-blue-700 hover:underline cursor-pointer">
            Xem tất cả
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {/* Empty state for shared media */}
          <div className="col-span-3 text-center py-6">
            <span className="material-symbols-outlined mb-2 block text-3xl text-slate-400">
              photo_library
            </span>
            <p className="text-xs font-semibold text-slate-600">
              Chưa có phương tiện
            </p>
          </div>
        </div>
      </div>

      {/* Members (for groups) */}
      {!isPrivate && (
        <div className="border-b border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-blue-500">
                group
              </span>
              Thành viên ({participantCount})
            </h3>
            <button className="rounded-lg p-1 text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 cursor-pointer">
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
                  className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-blue-50 cursor-pointer"
                >
                  {pAvatar ? (
                    <img
                      src={pAvatar}
                      alt={pName}
                      referrerPolicy={getAvatarReferrerPolicy(pAvatar)}
                      className="h-8 w-8 rounded-full object-cover ring-2 ring-white shadow-sm"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-700 ring-2 ring-white shadow-sm">
                      {pName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="truncate text-sm font-semibold text-slate-700">
                    {pName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Derived Tasks */}
      <div className="flex-1 bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-blue-500">
              task_alt
            </span>
            Công việc liên quan
          </h3>
          <button className="rounded-lg p-1 text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">add</span>
          </button>
        </div>
        <div className="space-y-3">
          {/* Empty state */}
          <div className="text-center py-6">
            <span className="material-symbols-outlined mb-2 block text-3xl text-slate-400">
              checklist
            </span>
            <p className="text-xs font-semibold text-slate-600">
              Chưa có công việc nào
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default ChatDetailPanel;
