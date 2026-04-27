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

const router = express.Router();

router.get("/:id", protect, getCommentById);
router.put("/:id", protect, updateComment);
router.delete("/:id", protect, deleteComment);
router.get("/:id/replies", protect, getCommentReplies);
router.post("/:id/replies", protect, addCommentReply);
router.post("/:id/likes", protect, toggleCommentLike);

export default router;
