import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { getPresenceFields } from "../services/presenceService.js";

// Helper: get io instance
let ioInstance = null;
export const setIo = (io) => {
  ioInstance = io;
};

// Helper: check if user is participant
const isParticipant = (conversation, userId) => {
  return conversation.participants.some(
    (p) => p.userId.toString() === userId.toString()
  );
};

const formatConversationUser = (user, includeEmail = false) => {
  if (!user) return null;

  return {
    _id: user._id,
    id: user._id,
    fullName: user.fullName,
    ...(includeEmail ? { email: user.email } : {}),
    avatar: user.avatar,
    ...getPresenceFields(user),
  };
};

const formatReplyMessage = async (replyTo) => {
  if (!replyTo) return null;

  const replyMessage = await Message.findById(replyTo);
  if (!replyMessage) return null;

  const sender = await User.findById(replyMessage.senderId).select(
    "_id fullName avatar activityStatus activityStatusExpiresAt"
  );

  return {
    id: replyMessage._id,
    sender: formatConversationUser(sender),
    type: replyMessage.type,
    content: replyMessage.content,
    attachments: replyMessage.attachments,
    createdAt: replyMessage.createdAt,
  };
};

const formatMessage = async (message) => {
  const sender = await User.findById(message.senderId).select(
    "_id fullName avatar activityStatus activityStatusExpiresAt"
  );

  return {
    id: message._id,
    conversationId: message.conversationId,
    sender: formatConversationUser(sender),
    type: message.type,
    content: message.content,
    attachments: message.attachments,
    mentions: message.mentions,
    replyTo: await formatReplyMessage(message.replyTo),
    reactions: message.reactions,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
};

// GET /conversations
export const getConversations = async (req, res) => {
  try {
    const { type, page = 1, size = 20 } = req.query;

    const filter = { "participants.userId": req.user._id };
    if (type) filter.type = type;

    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.max(1, parseInt(size));
    const skip = (pageNum - 1) * pageSize;

    const [conversations, totalElements] = await Promise.all([
      Conversation.find(filter).skip(skip).limit(pageSize).sort({ updatedAt: -1 }),
      Conversation.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalElements / pageSize);

    const content = await Promise.all(
      conversations.map(async (conv) => {
        // Populate participant details (basic info only)
        const participantDetails = await Promise.all(
          conv.participants.map(async (p) => {
            const user = await User.findById(p.userId).select(
              "_id fullName avatar activityStatus activityStatusExpiresAt"
            );
            return {
              userId: p.userId,
              user: formatConversationUser(user),
              joinedAt: p.joinedAt,
            };
          })
        );

        return {
          id: conv._id,
          type: conv.type,
          name: conv.name,
          avatar: conv.avatar,
          participants: participantDetails,
          lastMessage: conv.lastMessage,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
        };
      })
    );

    res.status(200).json({ content, totalElements, totalPages, currentPage: pageNum, pageSize });
  } catch (error) {
    console.error("GetConversations error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// POST /conversations
export const createConversation = async (req, res) => {
  try {
    const { type, name, participantIds } = req.body;

    if (!type || !["private", "group"].includes(type)) {
      return res.status(400).json({ message: "type must be 'private' or 'group'" });
    }

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({ message: "participantIds is required" });
    }

    // Ensure current user is included
    const allParticipantIds = [...new Set([req.user._id.toString(), ...participantIds.map(String)])];

    if (type === "private") {
      if (allParticipantIds.length !== 2) {
        return res.status(400).json({ message: "Private conversation requires exactly 2 participants" });
      }

      // Check for existing private conversation between these two users
      const existing = await Conversation.findOne({
        type: "private",
        "participants.userId": { $all: allParticipantIds },
        $expr: { $eq: [{ $size: "$participants" }, 2] },
      });

      if (existing) {
        return res.status(200).json({
          id: existing._id,
          type: existing.type,
          name: existing.name,
          participants: existing.participants,
          lastMessage: existing.lastMessage,
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt,
          message: "Conversation already exists",
        });
      }
    }

    if (type === "group" && !name) {
      return res.status(400).json({ message: "Group conversation requires a name" });
    }

    // Verify all participants exist
    const users = await User.find({ _id: { $in: allParticipantIds } }).select("_id");
    if (users.length !== allParticipantIds.length) {
      return res.status(400).json({ message: "One or more participant IDs are invalid" });
    }

    const participants = allParticipantIds.map((id) => ({
      userId: id,
      joinedAt: new Date(),
    }));

    const conversation = await Conversation.create({
      type,
      name: name || "",
      participants,
      createdBy: req.user._id,
    });

    res.status(201).json({
      id: conversation._id,
      type: conversation.type,
      name: conversation.name,
      avatar: conversation.avatar,
      participants: conversation.participants,
      lastMessage: conversation.lastMessage,
      createdBy: conversation.createdBy,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    });
  } catch (error) {
    console.error("CreateConversation error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// GET /conversations/:id
export const getConversationById = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (!isParticipant(conversation, req.user._id)) {
      return res.status(403).json({ message: "You are not a participant of this conversation" });
    }

    const participantDetails = await Promise.all(
      conversation.participants.map(async (p) => {
        const user = await User.findById(p.userId).select(
          "_id fullName email avatar activityStatus activityStatusExpiresAt"
        );
        return {
          userId: p.userId,
          user: formatConversationUser(user, true),
          joinedAt: p.joinedAt,
          lastReadMessageId: p.lastReadMessageId,
        };
      })
    );

    res.status(200).json({
      id: conversation._id,
      type: conversation.type,
      name: conversation.name,
      avatar: conversation.avatar,
      participants: participantDetails,
      lastMessage: conversation.lastMessage,
      createdBy: conversation.createdBy,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    });
  } catch (error) {
    console.error("GetConversationById error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid conversation ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// PUT /conversations/:id
export const updateConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (!isParticipant(conversation, req.user._id)) {
      return res.status(403).json({ message: "You are not a participant of this conversation" });
    }

    const { name, avatar } = req.body;

    if (name !== undefined) conversation.name = name;
    if (avatar !== undefined) conversation.avatar = avatar;

    await conversation.save();

    res.status(200).json({
      id: conversation._id,
      type: conversation.type,
      name: conversation.name,
      avatar: conversation.avatar,
      participants: conversation.participants,
      lastMessage: conversation.lastMessage,
      createdBy: conversation.createdBy,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    });
  } catch (error) {
    console.error("UpdateConversation error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid conversation ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// DELETE /conversations/:id
export const deleteConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (!isParticipant(conversation, req.user._id)) {
      return res.status(403).json({ message: "You are not a participant of this conversation" });
    }

    // Delete all messages
    await Message.deleteMany({ conversationId: conversation._id });

    await Conversation.findByIdAndDelete(conversation._id);

    res.status(204).send();
  } catch (error) {
    console.error("DeleteConversation error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid conversation ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// POST /conversations/:id/members
export const addConversationMember = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (conversation.type !== "group") {
      return res.status(400).json({ message: "Cannot add members to private conversations" });
    }

    if (!isParticipant(conversation, req.user._id)) {
      return res.status(403).json({ message: "You are not a participant of this conversation" });
    }

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (isParticipant(conversation, userId)) {
      return res.status(400).json({ message: "User is already a participant" });
    }

    conversation.participants.push({ userId, joinedAt: new Date() });
    await conversation.save();

    res.status(200).json({ message: "Member added to conversation successfully" });
  } catch (error) {
    console.error("AddConversationMember error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// DELETE /conversations/:id/members/:userId
export const removeConversationMember = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (conversation.type !== "group") {
      return res.status(400).json({ message: "Cannot remove members from private conversations" });
    }

    if (!isParticipant(conversation, req.user._id)) {
      return res.status(403).json({ message: "You are not a participant of this conversation" });
    }

    const { userId } = req.params;

    const participantIndex = conversation.participants.findIndex(
      (p) => p.userId.toString() === userId.toString()
    );

    if (participantIndex === -1) {
      return res.status(404).json({ message: "User is not a participant of this conversation" });
    }

    conversation.participants.splice(participantIndex, 1);
    await conversation.save();

    res.status(204).send();
  } catch (error) {
    console.error("RemoveConversationMember error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// GET /conversations/:id/messages (cursor-based pagination)
export const getMessages = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (!isParticipant(conversation, req.user._id)) {
      return res.status(403).json({ message: "You are not a participant of this conversation" });
    }

    const { before, limit = 30 } = req.query;
    const messageLimit = Math.min(Math.max(1, parseInt(limit)), 100);

    const filter = { conversationId: conversation._id };
    if (before) {
      filter.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(messageLimit + 1);

    const hasMore = messages.length > messageLimit;
    if (hasMore) messages.pop();

    const content = await Promise.all(messages.map(formatMessage));

    res.status(200).json({ content, hasMore });
  } catch (error) {
    console.error("GetMessages error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid conversation ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// POST /conversations/:id/attachments
export const uploadConversationAttachment = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (!isParticipant(conversation, req.user._id)) {
      return res.status(403).json({ message: "You are not a participant of this conversation" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Attachment file is required" });
    }

    res.status(201).json({
      fileName: req.file.originalname,
      fileUrl: `/uploads/attachments/${req.file.filename}`,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });
  } catch (error) {
    console.error("UploadConversationAttachment error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid conversation ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// POST /conversations/:id/messages
export const sendMessage = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (!isParticipant(conversation, req.user._id)) {
      return res.status(403).json({ message: "You are not a participant of this conversation" });
    }

    const { type, content, attachments, mentions, replyTo } = req.body;

    if (!content && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ message: "Message content or attachments required" });
    }

    if (replyTo) {
      const replyMsg = await Message.findById(replyTo);
      if (!replyMsg || replyMsg.conversationId.toString() !== conversation._id.toString()) {
        return res.status(400).json({ message: "Invalid replyTo message" });
      }
    }

    const message = await Message.create({
      conversationId: conversation._id,
      senderId: req.user._id,
      type: type || "text",
      content: content || "",
      attachments: attachments || [],
      mentions: mentions || [],
      replyTo: replyTo || null,
    });

    // Update lastMessage on conversation
    conversation.lastMessage = {
      content: content || (attachments?.length > 0 ? "[Attachment]" : ""),
      senderId: req.user._id,
      createdAt: message.createdAt,
    };
    await conversation.save();

    const messageData = await formatMessage(message);

    // Emit Socket.IO event
    if (ioInstance) {
      ioInstance.to(`conversation:${conversation._id}`).emit("new_message", messageData);
    }

    res.status(201).json(messageData);
  } catch (error) {
    console.error("SendMessage error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// PUT /conversations/:id/messages/:messageId (sender only)
export const updateMessage = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (!isParticipant(conversation, req.user._id)) {
      return res.status(403).json({ message: "You are not a participant of this conversation" });
    }

    const message = await Message.findById(req.params.messageId);
    if (!message || message.conversationId.toString() !== conversation._id.toString()) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (message.senderId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the sender can edit this message" });
    }

    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ message: "Message content is required" });
    }

    message.content = content;
    await message.save();

    const messageData = await formatMessage(message);

    if (ioInstance) {
      ioInstance.to(`conversation:${conversation._id}`).emit("message_updated", messageData);
    }

    res.status(200).json(messageData);
  } catch (error) {
    console.error("UpdateMessage error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// DELETE /conversations/:id/messages/:messageId (sender only)
export const deleteMessage = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (!isParticipant(conversation, req.user._id)) {
      return res.status(403).json({ message: "You are not a participant of this conversation" });
    }

    const message = await Message.findById(req.params.messageId);
    if (!message || message.conversationId.toString() !== conversation._id.toString()) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (message.senderId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the sender can delete this message" });
    }

    const messageId = message._id;
    await Message.findByIdAndDelete(messageId);

    if (ioInstance) {
      ioInstance.to(`conversation:${conversation._id}`).emit("message_deleted", {
        messageId,
        conversationId: conversation._id,
      });
    }

    res.status(204).send();
  } catch (error) {
    console.error("DeleteMessage error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// POST /conversations/:id/messages/:messageId/reactions
export const addReaction = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (!isParticipant(conversation, req.user._id)) {
      return res.status(403).json({ message: "You are not a participant of this conversation" });
    }

    const message = await Message.findById(req.params.messageId);
    if (!message || message.conversationId.toString() !== conversation._id.toString()) {
      return res.status(404).json({ message: "Message not found" });
    }

    const { reaction } = req.body;
    if (!reaction) {
      return res.status(400).json({ message: "reaction is required" });
    }

    // Check if user already has this reaction
    const existingIndex = message.reactions.findIndex(
      (r) =>
        r.userId.toString() === req.user._id.toString() && r.reaction === reaction
    );

    if (existingIndex !== -1) {
      return res.status(400).json({ message: "You have already reacted with this emoji" });
    }

    message.reactions.push({
      userId: req.user._id,
      reaction,
      createdAt: new Date(),
    });
    await message.save();

    if (ioInstance) {
      ioInstance.to(`conversation:${conversation._id}`).emit("reaction_added", {
        messageId: message._id,
        conversationId: conversation._id,
        userId: req.user._id,
        reaction,
      });
    }

    res.status(200).json({ message: "Reaction added successfully" });
  } catch (error) {
    console.error("AddReaction error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// DELETE /conversations/:id/messages/:messageId/reactions
export const removeReaction = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (!isParticipant(conversation, req.user._id)) {
      return res.status(403).json({ message: "You are not a participant of this conversation" });
    }

    const message = await Message.findById(req.params.messageId);
    if (!message || message.conversationId.toString() !== conversation._id.toString()) {
      return res.status(404).json({ message: "Message not found" });
    }

    const { reaction } = req.body;
    if (!reaction) {
      return res.status(400).json({ message: "reaction is required" });
    }

    const reactionIndex = message.reactions.findIndex(
      (r) =>
        r.userId.toString() === req.user._id.toString() && r.reaction === reaction
    );

    if (reactionIndex === -1) {
      return res.status(404).json({ message: "Reaction not found" });
    }

    message.reactions.splice(reactionIndex, 1);
    await message.save();

    if (ioInstance) {
      ioInstance.to(`conversation:${conversation._id}`).emit("reaction_removed", {
        messageId: message._id,
        conversationId: conversation._id,
        userId: req.user._id,
        reaction,
      });
    }

    res.status(204).send();
  } catch (error) {
    console.error("RemoveReaction error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};
