import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const uploadsDir = path.resolve(__dirname, "../uploads");
export const legacyUploadsDir = path.resolve(__dirname, "../../uploads");

export const documentUploadsDir = path.join(uploadsDir, "documents");
export const attachmentUploadsDir = path.join(uploadsDir, "attachments");
export const legacyAttachmentUploadsDir = path.join(
  legacyUploadsDir,
  "attachments"
);
