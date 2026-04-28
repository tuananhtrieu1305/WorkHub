const DEFAULT_API_URL = "http://localhost:5000";

const IMAGE_EXTENSIONS = new Set(["avif", "gif", "jpeg", "jpg", "png", "webp"]);
const VIDEO_EXTENSIONS = new Set(["avi", "m4v", "mkv", "mov", "mp4", "mpeg", "ogg", "webm"]);
const WORD_EXTENSIONS = new Set(["doc", "docx", "odt"]);
const SHEET_EXTENSIONS = new Set(["csv", "ods", "xls", "xlsx"]);
const PRESENTATION_EXTENSIONS = new Set(["odp", "ppt", "pptx"]);
const ARCHIVE_EXTENSIONS = new Set(["7z", "gz", "rar", "tar", "zip"]);
const TEXT_EXTENSIONS = new Set(["log", "md", "rtf", "txt"]);

export const getFeedApiUrl = () =>
  import.meta.env?.VITE_NODE_API_URL || DEFAULT_API_URL;

export const getFileExtension = (fileName = "") => {
  const normalized = String(fileName).trim().toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");
  return dotIndex >= 0 ? normalized.slice(dotIndex + 1) : "";
};

export const getAttachmentType = (attachment = {}) => {
  const mimeType = attachment.mimeType || attachment.type || "";
  const fileName = attachment.fileName || attachment.name || "";
  const extension = getFileExtension(fileName);

  if (mimeType.startsWith("image/") || IMAGE_EXTENSIONS.has(extension)) {
    return "image";
  }

  if (mimeType.startsWith("video/") || VIDEO_EXTENSIONS.has(extension)) {
    return "video";
  }

  return "file";
};

export const isPreviewableMedia = (attachment) => {
  const type = getAttachmentType(attachment);
  return type === "image" || type === "video";
};

const toAbsoluteUrl = (url, apiUrl = getFeedApiUrl()) => {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const base = apiUrl.replace(/\/$/, "");
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${base}${path}`;
};

export const getAttachmentUrl = (attachment = {}, apiUrl) =>
  toAbsoluteUrl(attachment.fileUrl || attachment.url, apiUrl);

export const getAttachmentDownloadUrl = (attachment = {}, apiUrl) =>
  toAbsoluteUrl(attachment.downloadUrl || attachment.fileUrl || attachment.url, apiUrl);

export const formatFileSize = (bytes) => {
  if (!bytes || Number.isNaN(Number(bytes))) return "";
  const size = Number(bytes);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

export const getAttachmentIcon = (attachment = {}) => {
  const mimeType = attachment.mimeType || attachment.type || "";
  const extension = getFileExtension(attachment.fileName || attachment.name || "");

  if (getAttachmentType(attachment) === "image") return "image";
  if (getAttachmentType(attachment) === "video") return "movie";
  if (mimeType.includes("pdf") || extension === "pdf") return "picture_as_pdf";
  if (
    mimeType.includes("word") ||
    mimeType.includes("document") ||
    WORD_EXTENSIONS.has(extension)
  ) {
    return "description";
  }
  if (
    mimeType.includes("sheet") ||
    mimeType.includes("excel") ||
    SHEET_EXTENSIONS.has(extension)
  ) {
    return "table_chart";
  }
  if (
    mimeType.includes("presentation") ||
    mimeType.includes("powerpoint") ||
    PRESENTATION_EXTENSIONS.has(extension)
  ) {
    return "slideshow";
  }
  if (ARCHIVE_EXTENSIONS.has(extension)) return "folder_zip";
  if (mimeType.startsWith("text/") || TEXT_EXTENSIONS.has(extension)) return "article";
  return "insert_drive_file";
};

export const getAttachmentIconClass = (attachment = {}) => {
  const mimeType = attachment.mimeType || attachment.type || "";
  const extension = getFileExtension(attachment.fileName || attachment.name || "");
  const type = getAttachmentType(attachment);

  if (type === "image") return "bg-sky-100/80 text-sky-600";
  if (type === "video") return "bg-violet-100/80 text-violet-600";
  if (mimeType.includes("pdf") || extension === "pdf") return "bg-red-100/80 text-red-600";
  if (mimeType.includes("word") || WORD_EXTENSIONS.has(extension)) {
    return "bg-blue-100/80 text-blue-600";
  }
  if (mimeType.includes("sheet") || mimeType.includes("excel") || SHEET_EXTENSIONS.has(extension)) {
    return "bg-green-100/80 text-green-600";
  }
  if (ARCHIVE_EXTENSIONS.has(extension)) return "bg-amber-100/80 text-amber-700";
  return "bg-slate-100/80 text-slate-600";
};
