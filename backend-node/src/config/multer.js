import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Hàm tạo slug từ tên file (viết liền, loại bỏ dấu cách và ký tự đặc biệt)
const generateSlug = (filename) => {
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  
  // Loại bỏ dấu cách, chuyển về chữ thường, gữ giữ chữ, số
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "") // Loại bỏ dấu cách
    .replace(/[^\w\u0100-\uFFFF]/g, "") // Giữ chữ, số, ký tự unicode
    .substring(0, 20); // Giới hạn 20 ký tự
};

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const slug = generateSlug(file.originalname);
    const timestamp = Date.now();
    // Tên file: slug-timestamp.ext
    cb(null, `${slug}-${timestamp}${ext}`);
  },
});

// Multer configuration
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error("Only image files (JPEG, PNG, GIF, WebP) are allowed"),
        false,
      );
    }
  },
});

export default upload;
