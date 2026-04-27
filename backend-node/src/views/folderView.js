import express from "express";
import protect from "../middlewares/authMiddleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import { uploadSingleDocument } from "../middlewares/uploadMiddleware.js";
import {
  createFolder,
  deleteFolder,
  getFolder,
  listFolderDocuments,
  listFolders,
  updateFolder,
} from "../presenters/folderPresenter.js";
import { uploadDocumentToFolder } from "../presenters/documentPresenter.js";

const router = express.Router();

router.get("/", protect, asyncHandler(listFolders));
router.post("/", protect, asyncHandler(createFolder));
router.get("/:id", protect, asyncHandler(getFolder));
router.put("/:id", protect, asyncHandler(updateFolder));
router.delete("/:id", protect, asyncHandler(deleteFolder));
router.get("/:id/documents", protect, asyncHandler(listFolderDocuments));
router.post(
  "/:id/documents",
  protect,
  uploadSingleDocument,
  asyncHandler(uploadDocumentToFolder),
);

export default router;
