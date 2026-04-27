import os from "node:os";
import path from "node:path";
import multer from "multer";

const maxUploadSizeMb = Number(process.env.MAX_UPLOAD_SIZE_MB || 50);

const upload = multer({
  dest: path.join(os.tmpdir(), "workhub-uploads"),
  limits: {
    fileSize: maxUploadSizeMb * 1024 * 1024,
    files: 1,
  },
});

export const uploadSingleDocument = upload.single("file");

export default upload;
