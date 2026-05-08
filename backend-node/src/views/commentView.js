import express from "express";
import {
  getCommentById,
  updateComment,
  deleteComment,
  getCommentReplies,
  addCommentReply,
  toggleCommentLike,
} from "../presenters/commentPresenter.js";
import protect from "../middlewares/authMiddleware.js";
import { uploadCommentImages } from "../config/multer.js";

const router = express.Router();

router.get("/:id", protect, getCommentById);
router.put("/:id", protect, updateComment);
router.delete("/:id", protect, deleteComment);
router.get("/:id/replies", protect, getCommentReplies);
router.post("/:id/replies", protect, uploadCommentImages.array("attachments", 4), addCommentReply);
router.post("/:id/likes", protect, toggleCommentLike);

export default router;
