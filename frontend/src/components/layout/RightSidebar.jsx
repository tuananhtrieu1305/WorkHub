import { useState, useEffect } from "react";
import { getNotifications } from "../../api/notificationApi";
import { getMeetings } from "../../api/meetingApi";

const API_URL = import.meta.env.VITE_NODE_API_URL || "http://localhost:5000";

const RightSidebar = () => {
  const [inboxTab, setInboxTab] = useState("all");
  const [notifications, setNotifications] = useState([]);
  const [meetings, setMeetings] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [notifRes, meetingRes] = await Promise.allSettled([
          getNotifications({ page: 1, size: 5 }),
          getMeetings({ page: 1, size: 3 }),
        ]);
        if (notifRes.status === "fulfilled") {
          setNotifications(notifRes.value?.content || notifRes.value || []);
        }
        if (meetingRes.status === "fulfilled") {
          setMeetings(meetingRes.value?.content || meetingRes.value || []);
        }
      } catch {
        // Silently handle – sidebar data is non-critical
      }
    };
    fetchData();
  }, []);

  const inboxTabs = [
    { key: "all", label: "Tất cả" },
    { key: "unread", label: "Chưa đọc" },
    { key: "mentions", label: "@Đề cập" },
  ];

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Vừa xong";
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h trước`;
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
  };

  const getAvatarUrl = (avatar) => {
    if (!avatar) return null;
    return avatar.startsWith("http") ? avatar : `${API_URL}${avatar}`;
  };

  const formatMeetingTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <aside className="w-80 border-l border-slate-200/50 bg-white/50 backdrop-blur-sm hidden lg:flex flex-col flex-shrink-0 overflow-y-auto p-5 gap-6">
      {/* Smart Inbox */}
      <div>
        <h3 className="text-sm font-extrabold text-slate-900 mb-4 flex items-center gap-2 uppercase tracking-wide">
          <span className="material-symbols-outlined text-blue-500 text-xl bg-blue-100 p-1 rounded-lg">
            inbox
          </span>
          Hộp thư thông minh
        </h3>
        <div className="flex flex-col gap-3">
          <div className="flex gap-4 border-b border-slate-200 pb-2 mb-1">
            {inboxTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setInboxTab(tab.key)}
                className={`text-xs font-bold pb-1.5 transition-colors ${
                  inboxTab === tab.key
                    ? "text-blue-600 border-b-2 border-blue-500"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {notifications.length === 0 ? (
            <div className="text-center py-6">
              <span className="material-symbols-outlined text-3xl text-slate-300 mb-2 block">
                mark_email_read
              </span>
              <p className="text-xs text-slate-400 font-medium">
                Không có thông báo mới
              </p>
            </div>
          ) : (
            notifications.slice(0, 4).map((notif, idx) => {
              const senderAvatar = getAvatarUrl(notif.sender?.avatar);
              return (
                <div
                  key={notif.id || notif._id || idx}
                  className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all duration-300 ${
                    !notif.isRead
                      ? "bg-white shadow-sm hover:shadow-md border-l-4 border-blue-500"
                      : "hover:bg-white hover:shadow-sm border border-transparent"
                  }`}
                >
                  {senderAvatar ? (
                    <img
                      src={senderAvatar}
                      alt=""
                      className="w-9 h-9 rounded-full ring-2 ring-white shadow-sm shrink-0 object-cover"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-base">
                        notifications
                      </span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 line-clamp-2">
                      {notif.message || notif.title || "Thông báo mới"}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">
                      {formatTime(notif.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <hr className="border-slate-200/60" />

      {/* Upcoming Meetings */}
      <div>
        <h3 className="text-sm font-extrabold text-slate-900 mb-4 flex items-center gap-2 uppercase tracking-wide">
          <span className="material-symbols-outlined text-purple-500 text-xl bg-purple-100 p-1 rounded-lg">
            event
          </span>
          Cuộc họp sắp tới
        </h3>
        <div className="flex flex-col gap-3">
          {meetings.length === 0 ? (
            <div className="text-center py-6">
              <span className="material-symbols-outlined text-3xl text-slate-300 mb-2 block">
                event_available
              </span>
              <p className="text-xs text-slate-400 font-medium">
                Không có cuộc họp nào
              </p>
            </div>
          ) : (
            meetings.slice(0, 3).map((meeting, idx) => (
              <div
                key={meeting.id || meeting._id || idx}
                className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <p className="text-xs text-purple-600 font-extrabold mb-1.5 uppercase tracking-wider">
                  {formatMeetingTime(meeting.startTime || meeting.scheduledAt)}
                </p>
                <p className="text-sm font-bold text-slate-900">
                  {meeting.title || "Cuộc họp"}
                </p>
                {meeting.participants && meeting.participants.length > 0 && (
                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex -space-x-2">
                      {meeting.participants.slice(0, 3).map((p, pIdx) => {
                        const pAvatar = getAvatarUrl(p.avatar);
                        return pAvatar ? (
                          <img
                            key={pIdx}
                            src={pAvatar}
                            alt=""
                            className="w-7 h-7 rounded-full border-2 border-white shadow-sm object-cover"
                          />
                        ) : (
                          <div
                            key={pIdx}
                            className="w-7 h-7 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-sm"
                          >
                            {p.fullName?.charAt(0) || "?"}
                          </div>
                        );
                      })}
                      {meeting.participants.length > 3 && (
                        <div className="w-7 h-7 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-sm">
                          +{meeting.participants.length - 3}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <hr className="border-slate-200/60" />

      {/* Online Colleagues - placeholder */}
      <div>
        <h3 className="text-sm font-extrabold text-slate-900 mb-4 flex items-center gap-2 uppercase tracking-wide">
          <span className="material-symbols-outlined text-green-500 text-xl bg-green-100 p-1 rounded-lg">
            group
          </span>
          Đồng nghiệp trực tuyến
        </h3>
        <div className="flex flex-col gap-3">
          <div className="text-center py-6">
            <span className="material-symbols-outlined text-3xl text-slate-300 mb-2 block">
              people
            </span>
            <p className="text-xs text-slate-400 font-medium">
              Đang tải...
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default RightSidebar;
