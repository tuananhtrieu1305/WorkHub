import express from "express";
import protect from "../middlewares/authMiddleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import { uploadSingleDocument } from "../middlewares/uploadMiddleware.js";
import {
  createDocumentShare,
  deleteDocument,
  downloadDocument,
  downloadSharedDocument,
  getDocument,
  listDocumentVersions,
  previewDocument,
  previewDocumentVersion,
  previewSharedDocument,
  updateDocument,
  uploadDocumentVersion,
} from "../presenters/documentPresenter.js";

const router = express.Router();
const shareRouter = express.Router();

router.get("/:id", protect, asyncHandler(getDocument));
router.put("/:id", protect, asyncHandler(updateDocument));
router.delete("/:id", protect, asyncHandler(deleteDocument));
router.post(
  "/:id/versions",
  protect,
  uploadSingleDocument,
  asyncHandler(uploadDocumentVersion),
);
router.get("/:id/versions", protect, asyncHandler(listDocumentVersions));
router.get("/:id/download", protect, asyncHandler(downloadDocument));
router.get("/:id/preview", protect, asyncHandler(previewDocument));
router.get(
  "/:id/versions/:versionId/preview",
  protect,
  asyncHandler(previewDocumentVersion),
);
router.post("/:id/share", protect, asyncHandler(createDocumentShare));

shareRouter.get(
  "/documents/:token/preview",
  asyncHandler(previewSharedDocument),
);
shareRouter.get(
  "/documents/:token/download",
  asyncHandler(downloadSharedDocument),
);

export { shareRouter };
export default router;
