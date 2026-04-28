import multer from "multer";
import fs from "fs";
import path from "path";
import {
  attachmentUploadsDir,
  documentUploadsDir,
  uploadsDir,
} from "./uploadPaths.js";

export const POST_ATTACHMENT_FILE_SIZE_LIMIT = 100 * 1024 * 1024;

const ensureUploadDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const generateSlug = (filename) => {
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^\w\u0100-\uFFFF]/g, "")
    .substring(0, 20);
};

// --- Avatar upload (5MB, images only) ---
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, ensureUploadDir(uploadsDir));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const slug = generateSlug(file.originalname);
    cb(null, `${slug}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (JPEG, PNG, GIF, WebP) are allowed"), false);
    }
  },
});

// --- Document upload (20MB, all files except video) ---
const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, ensureUploadDir(documentUploadsDir));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const slug = generateSlug(file.originalname);
    cb(null, `${slug}-${Date.now()}${ext}`);
  },
});

const videoMimes = [
  "video/mp4", "video/mpeg", "video/webm", "video/ogg",
  "video/avi", "video/quicktime", "video/x-msvideo",
  "video/x-matroska", "video/x-flv",
];

export const uploadDocument = multer({
  storage: documentStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (videoMimes.includes(file.mimetype)) {
      cb(new Error("Video files are not allowed"), false);
    } else {
      cb(null, true);
    }
  },
});

// --- Attachment upload for posts (20MB, images + videos + documents) ---
const attachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, ensureUploadDir(attachmentUploadsDir));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const slug = generateSlug(file.originalname);
    cb(null, `${slug}-${Date.now()}${ext}`);
  },
});

export const postAttachmentFileFilter = (req, file, cb) => {
  cb(null, true);
};

export const uploadAttachment = multer({
  storage: attachmentStorage,
  limits: { fileSize: POST_ATTACHMENT_FILE_SIZE_LIMIT },
  fileFilter: postAttachmentFileFilter,
});

export default upload;
