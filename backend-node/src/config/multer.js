import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    cb(null, path.join(__dirname, "../uploads"));
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
    cb(null, path.join(__dirname, "../uploads/documents"));
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

// --- Attachment upload for posts (20MB, images + documents, no video) ---
const attachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads/attachments"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const slug = generateSlug(file.originalname);
    cb(null, `${slug}-${Date.now()}${ext}`);
  },
});

export const uploadAttachment = multer({
  storage: attachmentStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (videoMimes.includes(file.mimetype)) {
      cb(new Error("Video files are not allowed for post attachments"), false);
    } else {
      cb(null, true);
    }
  },
});

export default upload;
