const activityStatusMeta = {
  online: {
    value: "online",
    menuLabel: "Trực tuyến",
    label: "Đang hoạt động",
    icon: "circle",
    textClassName: "text-emerald-600",
    badgeClassName: "bg-white text-emerald-500",
    menuIconClassName: "text-emerald-500",
  },
  idle: {
    value: "idle",
    menuLabel: "Chờ",
    label: "Chờ",
    icon: "dark_mode",
    textClassName: "text-amber-600",
    badgeClassName: "bg-white text-amber-500",
    menuIconClassName: "text-amber-500",
  },
  dnd: {
    value: "dnd",
    menuLabel: "Không làm phiền",
    label: "Không làm phiền",
    description: "Bạn sẽ không nhận được thông báo trên màn hình",
    icon: "do_not_disturb_on",
    textClassName: "text-red-600",
    badgeClassName: "bg-white text-red-500",
    menuIconClassName: "text-red-500",
  },
  invisible: {
    value: "invisible",
    menuLabel: "Vô hình",
    label: "",
    description: "Bạn sẽ xuất hiện ngoại tuyến",
    icon: "radio_button_unchecked",
    textClassName: "text-slate-500",
    badgeClassName: "bg-white text-slate-400",
    menuIconClassName: "text-slate-400",
  },
  offline: {
    value: "offline",
    menuLabel: "Ngoại tuyến",
    label: "",
    icon: "offline_ring",
    textClassName: "text-slate-500",
    badgeClassName: "bg-white text-slate-400",
    menuIconClassName: "text-slate-400",
  },
};

export const ACTIVITY_STATUS_DURATIONS = [
  { label: "Trong vòng 15 phút", expiresInMinutes: 15 },
  { label: "Trong vòng 1 giờ", expiresInMinutes: 60 },
  { label: "Trong vòng 8 giờ", expiresInMinutes: 8 * 60 },
  { label: "Trong vòng 24 giờ", expiresInMinutes: 24 * 60 },
  { label: "Trong 3 ngày", expiresInMinutes: 3 * 24 * 60 },
  { label: "Vĩnh viễn", expiresInMinutes: null },
];

export const getDefaultActivityStatusDuration = () => null;

export const ACTIVITY_STATUS_OPTIONS = [
  activityStatusMeta.online,
  activityStatusMeta.idle,
  activityStatusMeta.dnd,
  activityStatusMeta.invisible,
];

export const normalizeActivityStatus = (status) => {
  return activityStatusMeta[status] ? status : "online";
};

export const getEffectiveActivityStatus = ({
  activityStatus,
  isOnline = true,
} = {}) => {
  if (!isOnline) return "offline";
  return normalizeActivityStatus(activityStatus);
};

export const getActivityStatusMeta = (status) => {
  return activityStatusMeta[normalizeActivityStatus(status)];
};
