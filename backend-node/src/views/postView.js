import express from "express";
import {
  getPosts,
  createPost,
  getPostById,
  updatePost,
  deletePost,
  getPostComments,
  addPostComment,
  getPostLikes,
  togglePostLike,
} from "../presenters/postPresenter.js";
import protect from "../middlewares/authMiddleware.js";
import { uploadAttachment } from "../config/multer.js";

const router = express.Router();

router.get("/", protect, getPosts);
router.post("/", protect, uploadAttachment.array("attachments", 10), createPost);
router.get("/:id", protect, getPostById);
router.put("/:id", protect, updatePost);
router.delete("/:id", protect, deletePost);
router.get("/:id/comments", protect, getPostComments);
router.post("/:id/comments", protect, addPostComment);
router.get("/:id/likes", protect, getPostLikes);
router.post("/:id/likes", protect, togglePostLike);

export default router;
