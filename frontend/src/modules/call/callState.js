const terminalStatuses = new Set([
  "declined",
  "cancelled",
  "missed",
  "busy",
  "failed",
  "ended",
]);

export const isTerminalCallStatus = (status) => terminalStatuses.has(status);

export const normalizeMediaFailureReason = (error, role, mediaType = "audio") => {
  if (error?.code === "timeout") {
    return `${role}_media_permission_timeout`;
  }

  if (["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(error?.name)) {
    return `${role}_media_permission_denied`;
  }

  if (["NotFoundError", "DevicesNotFoundError"].includes(error?.name)) {
    return mediaType === "video" ? "no_video_input" : "no_audio_input";
  }

  return `${role}_media_permission_denied`;
};

export const shouldCloseIncomingCall = ({
  activeCallId,
  eventCallId,
  currentTabInstanceId,
  answeredByTabInstanceId,
}) => {
  if (!activeCallId || activeCallId !== eventCallId) return false;
  if (!answeredByTabInstanceId) return false;
  return answeredByTabInstanceId !== currentTabInstanceId;
};

export const getCallId = (call) => String(call?.id || call?._id || "");

export const getCallStatusText = (call) => {
  if (!call) return "";
  if (call.status === "preparing") return "Dang chuan bi...";
  if (call.status === "ringing") return "Dang do chuong...";
  if (call.status === "answering") return "Dang kiem tra thiet bi...";
  if (call.status === "connecting") return "Dang ket noi...";
  if (call.status === "active") return "Dang trong cuoc goi";
  if (call.status === "busy") return "May ban";
  if (call.status === "missed") return "Khong nghe may";
  if (call.status === "declined") return "Da tu choi";
  if (call.status === "cancelled") return "Da huy";
  if (call.status === "failed") return "Cuoc goi that bai";
  if (call.status === "ended") return "Da ket thuc";
  return call.status;
};
