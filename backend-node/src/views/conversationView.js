import express from "express";
import {
  getConversations,
  createConversation,
  getConversationById,
  updateConversation,
  deleteConversation,
  addConversationMember,
  removeConversationMember,
  getMessages,
  getPinnedMessages,
  markConversationAsRead,
  uploadConversationAttachment,
  downloadConversationAttachment,
  sendMessage,
  updateMessage,
  deleteMessage,
  updateMessagePin,
  votePoll,
  addPollOptionToMessage,
  addReaction,
  removeReaction,
} from "../presenters/conversationPresenter.js";
import protect from "../middlewares/authMiddleware.js";
import { uploadAttachment } from "../config/multer.js";

const router = express.Router();

router.get("/", protect, getConversations);
router.post("/", protect, createConversation);
router.get("/:id", protect, getConversationById);
router.put("/:id", protect, updateConversation);
router.delete("/:id", protect, deleteConversation);
router.post("/:id/members", protect, addConversationMember);
router.delete("/:id/members/:userId", protect, removeConversationMember);
router.post("/:id/read", protect, markConversationAsRead);
router.get("/:id/pinned-messages", protect, getPinnedMessages);
router.get("/:id/messages", protect, getMessages);
router.get(
  "/:id/attachments/download",
  protect,
  downloadConversationAttachment,
);
router.post(
  "/:id/attachments",
  protect,
  uploadAttachment.single("file"),
  uploadConversationAttachment,
);
router.post("/:id/messages", protect, sendMessage);
router.put("/:id/messages/:messageId", protect, updateMessage);
router.delete("/:id/messages/:messageId", protect, deleteMessage);
router.patch("/:id/messages/:messageId/pin", protect, updateMessagePin);
router.post("/:id/messages/:messageId/poll/votes", protect, votePoll);
router.post(
  "/:id/messages/:messageId/poll/options",
  protect,
  addPollOptionToMessage,
);
router.post("/:id/messages/:messageId/reactions", protect, addReaction);
router.delete("/:id/messages/:messageId/reactions", protect, removeReaction);

export default router;
