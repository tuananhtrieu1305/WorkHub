export const isAudioAttachment = (attachment = {}) => {
  const mimeType = String(attachment.mimeType || "").toLowerCase();
  return (
    attachment.kind === "voice" ||
    attachment.kind === "audio" ||
    mimeType.startsWith("audio/")
  );
};

export const formatAudioDuration = (seconds) => {
  const totalSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
};

export const getMessagePreviewText = (
  message,
  { emptyText = "..." } = {},
) => {
  if (!message) return emptyText;
  if (message.deletedAt) return "Tin nhắn đã được thu hồi";
  if (message.content) return message.content.replace(/\s+/g, " ").trim();

  const attachments = message.attachments || [];
  const firstAttachment = attachments[0];
  const firstMimeType = String(firstAttachment?.mimeType || "").toLowerCase();

  if (message.type === "audio" || attachments.some(isAudioAttachment)) {
    return "Tin nhắn thoại";
  }

  if (firstMimeType.startsWith("image/")) return "Ảnh";
  if (firstMimeType.startsWith("video/")) return "Video";
  if (firstAttachment?.fileName) return firstAttachment.fileName;
  if (attachments.length) return "Tệp đính kèm";
  return emptyText;
};
