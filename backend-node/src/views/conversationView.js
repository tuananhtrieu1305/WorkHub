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
  sendMessage,
  updateMessage,
  deleteMessage,
  addReaction,
  removeReaction,
} from "../presenters/conversationPresenter.js";
import protect from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getConversations);
router.post("/", protect, createConversation);
router.get("/:id", protect, getConversationById);
router.put("/:id", protect, updateConversation);
router.delete("/:id", protect, deleteConversation);
router.post("/:id/members", protect, addConversationMember);
router.delete("/:id/members/:userId", protect, removeConversationMember);
router.get("/:id/messages", protect, getMessages);
router.post("/:id/messages", protect, sendMessage);
router.put("/:id/messages/:messageId", protect, updateMessage);
router.delete("/:id/messages/:messageId", protect, deleteMessage);
router.post("/:id/messages/:messageId/reactions", protect, addReaction);
router.delete("/:id/messages/:messageId/reactions", protect, removeReaction);

export default router;
