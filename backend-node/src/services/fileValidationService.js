import path from "node:path";
import { fileTypeFromFile } from "file-type";

export const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".docx",
  ".xlsx",
  ".pptx",
  ".png",
  ".jpg",
  ".jpeg",
  ".txt",
]);

export const BLOCKED_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".svg",
  ".js",
  ".mjs",
  ".exe",
  ".sh",
  ".bat",
  ".cmd",
  ".ps1",
]);

const MIME_BY_EXTENSION = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".txt": "text/plain",
};

export const sanitizeFileName = (fileName) => {
  const baseName = path.basename(fileName || "document");
  return baseName
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 255) || "document";
};

export const getExtension = (fileName) => {
  return path.extname(fileName || "").toLowerCase();
};

export const validateUploadedFile = async (file) => {
  if (!file) {
    return { ok: false, message: "File is required" };
  }

  const safeName = sanitizeFileName(file.originalname);
  const extension = getExtension(safeName);

  if (BLOCKED_EXTENSIONS.has(extension) || !ALLOWED_EXTENSIONS.has(extension)) {
    return { ok: false, message: "File type is not allowed" };
  }

  const detected = await fileTypeFromFile(file.path);
  const expectedMime = MIME_BY_EXTENSION[extension];

  if (extension === ".txt") {
    return {
      ok: true,
      safeName,
      extension,
      detectedMimeType: "text/plain",
      mimeType: expectedMime,
    };
  }

  if (!detected || detected.mime !== expectedMime) {
    return { ok: false, message: "File content does not match its extension" };
  }

  return {
    ok: true,
    safeName,
    extension,
    detectedMimeType: detected.mime,
    mimeType: expectedMime,
  };
};
