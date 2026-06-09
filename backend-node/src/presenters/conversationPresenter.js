import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { getPresenceFields } from "../services/presenceService.js";
import {
  getConversationRealtimeRoomNames,
  joinParticipantSocketsToConversationRoom,
} from "../utils/conversationRealtime.js";
import {
  getUniqueParticipantIds,
  hasMinimumGroupParticipantCount,
} from "../utils/conversationRules.js";
import {
  buildR2AttachmentKey,
  buildR2PublicUrl,
  getR2StorageService,
} from "../services/r2StorageService.js";
import { normalizePinnedState } from "../utils/messageActionPolicy.js";

// Helper: get io instance
let ioInstance = null;
export const setIo = (io) => {
  ioInstance = io;
};

// Helper: check if user is participant
const isParticipant = (conversation, userId) => {
  return conversation.participants.some(
    (p) => p.userId.toString() === userId.toString(),
  );
};

const toComparableId = (value) => {
  if (!value) return "";
  return String(value._id || value.id || value);
};

const getCurrentParticipant = (conversation, userId) => {
  const currentUserId = toComparableId(userId);
  return conversation.participants.find(
    (participant) => toComparableId(participant.userId) === currentUserId,
  );
};

const getConversationActivityAt = (conversation) => {
  return conversation.lastMessage?.createdAt || conversation.createdAt;
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
    "_id fullName avatar activityStatus activityStatusExpiresAt",
  );
  const deletedBy = replyMessage.deletedBy
    ? await User.findById(replyMessage.deletedBy).select(
        "_id fullName avatar activityStatus activityStatusExpiresAt",
      )
    : null;
  const pinnedBy = replyMessage.pinnedBy
    ? await User.findById(replyMessage.pinnedBy).select(
        "_id fullName avatar activityStatus activityStatusExpiresAt",
      )
    : null;
  const isDeleted = Boolean(replyMessage.deletedAt);

  return {
    id: replyMessage._id,
    sender: formatConversationUser(sender),
    type: replyMessage.type,
    content: isDeleted ? "" : replyMessage.content,
    metadata: isDeleted ? {} : replyMessage.metadata || {},
    attachments: isDeleted ? [] : replyMessage.attachments,
    editedAt: replyMessage.editedAt,
    isPinned: isDeleted ? false : Boolean(replyMessage.isPinned),
    pinnedAt: isDeleted ? null : replyMessage.pinnedAt,
    pinnedBy: isDeleted ? null : formatConversationUser(pinnedBy),
    deletedAt: replyMessage.deletedAt,
    deletedBy: formatConversationUser(deletedBy),
    createdAt: replyMessage.createdAt,
  };
};

const formatMessage = async (message) => {
  const sender = await User.findById(message.senderId).select(
    "_id fullName avatar activityStatus activityStatusExpiresAt",
  );
  const deletedBy = message.deletedBy
    ? await User.findById(message.deletedBy).select(
        "_id fullName avatar activityStatus activityStatusExpiresAt",
      )
    : null;
  const pinnedBy = message.pinnedBy
    ? await User.findById(message.pinnedBy).select(
        "_id fullName avatar activityStatus activityStatusExpiresAt",
      )
    : null;
  const isDeleted = Boolean(message.deletedAt);

  return {
    id: message._id,
    conversationId: message.conversationId,
    sender: formatConversationUser(sender),
    type: message.type,
    content: isDeleted ? "" : message.content,
    metadata: isDeleted ? {} : message.metadata || {},
    attachments: isDeleted ? [] : message.attachments,
    mentions: isDeleted ? [] : message.mentions,
    replyTo: await formatReplyMessage(message.replyTo),
    reactions: isDeleted ? [] : message.reactions,
    editedAt: message.editedAt,
    isPinned: isDeleted ? false : Boolean(message.isPinned),
    pinnedAt: isDeleted ? null : message.pinnedAt,
    pinnedBy: isDeleted ? null : formatConversationUser(pinnedBy),
    deletedAt: message.deletedAt,
    deletedBy: formatConversationUser(deletedBy),
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
};

const formatConversation = async (
  conversation,
  { includeEmail = false, includeLastRead = false, currentUserId = null } = {},
) => {
  const participantDetails = await Promise.all(
    conversation.participants.map(async (p) => {
      const user = await User.findById(p.userId).select(
        `_id fullName${includeEmail ? " email" : ""} avatar activityStatus activityStatusExpiresAt`,
      );
      return {
        userId: p.userId,
        user: formatConversationUser(user, includeEmail),
        joinedAt: p.joinedAt,
        ...(includeLastRead ? { lastReadMessageId: p.lastReadMessageId } : {}),
      };
    }),
  );
  const unreadState = currentUserId
    ? await getConversationUnreadState(conversation, currentUserId)
    : { hasUnread: false, lastMessageId: null };
  const preview =
    conversation.lastMessage?.toObject?.() || conversation.lastMessage || {};
  const lastMessageId =
    unreadState.lastMessageId || toComparableId(preview.messageId);

  return {
    id: conversation._id,
    type: conversation.type,
    name: conversation.name,
    avatar: conversation.avatar,
    participants: participantDetails,
    lastMessage: lastMessageId
      ? { ...preview, id: lastMessageId, messageId: lastMessageId }
      : preview,
    hasUnread: unreadState.hasUnread,
    createdBy: conversation.createdBy,
    createdAt: conversation.createdAt,
    lastActivityAt: getConversationActivityAt(conversation),
    updatedAt: conversation.updatedAt,
  };
};

const getConversationUnreadState = async (conversation, userId) => {
  const currentParticipant = getCurrentParticipant(conversation, userId);
  if (!currentParticipant) {
    return { hasUnread: false, lastMessageId: null };
  }

  const latestMessage =
    (conversation.lastMessage?.messageId &&
      (await Message.findById(conversation.lastMessage.messageId).select(
        "_id senderId createdAt",
      ))) ||
    (await Message.findOne({ conversationId: conversation._id })
      .sort({ createdAt: -1 })
      .select("_id senderId createdAt"));

  if (!latestMessage) {
    return { hasUnread: false, lastMessageId: null };
  }

  const latestMessageId = toComparableId(latestMessage._id);
  const senderId = toComparableId(latestMessage.senderId);
  if (!senderId || senderId === toComparableId(userId)) {
    return { hasUnread: false, lastMessageId: latestMessageId };
  }

  const lastReadMessageId = toComparableId(
    currentParticipant.lastReadMessageId,
  );
  if (lastReadMessageId === latestMessageId) {
    return { hasUnread: false, lastMessageId: latestMessageId };
  }

  if (!lastReadMessageId) {
    return { hasUnread: true, lastMessageId: latestMessageId };
  }

  const lastReadMessage =
    await Message.findById(lastReadMessageId).select("createdAt");

  return {
    hasUnread:
      !lastReadMessage || lastReadMessage.createdAt < latestMessage.createdAt,
    lastMessageId: latestMessageId,
  };
};

const markConversationRead = async (conversation, userId, messageId) => {
  if (!messageId) return;

  const currentParticipant = getCurrentParticipant(conversation, userId);
  if (!currentParticipant) return;

  if (
    toComparableId(currentParticipant.lastReadMessageId) ===
    toComparableId(messageId)
  ) {
    return;
  }

  currentParticipant.lastReadMessageId = messageId;
  await conversation.save({ timestamps: false });
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
      Conversation.find(filter)
        .sort({ "lastMessage.createdAt": -1, createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(pageSize),
      Conversation.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalElements / pageSize);

    const content = await Promise.all(
      conversations.map((conv) =>
        formatConversation(conv, { currentUserId: req.user._id }),
      ),
    );

    res
      .status(200)
      .json({
        content,
        totalElements,
        totalPages,
        currentPage: pageNum,
        pageSize,
      });
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
      return res
        .status(400)
        .json({ message: "type must be 'private' or 'group'" });
    }

    if (
      !participantIds ||
      !Array.isArray(participantIds) ||
      participantIds.length === 0
    ) {
      return res.status(400).json({ message: "participantIds is required" });
    }

    // Ensure current user is included
    const allParticipantIds = getUniqueParticipantIds(
      req.user._id,
      participantIds,
    );
    const groupName = typeof name === "string" ? name.trim() : "";

    if (type === "private") {
      if (allParticipantIds.length !== 2) {
        return res
          .status(400)
          .json({
            message: "Private conversation requires exactly 2 participants",
          });
      }

      // Check for existing private conversation between these two users
      const existing = await Conversation.findOne({
        type: "private",
        "participants.userId": { $all: allParticipantIds },
        $expr: { $eq: [{ $size: "$participants" }, 2] },
      });

      if (existing) {
        const conversationData = await formatConversation(existing, {
          currentUserId: req.user._id,
        });
        return res.status(200).json({
          ...conversationData,
          message: "Conversation already exists",
        });
      }
    }

    if (type === "group") {
      if (!hasMinimumGroupParticipantCount(allParticipantIds)) {
        return res.status(400).json({
          message: "Group conversation requires at least 3 participants",
        });
      }
    }

    // Verify all participants exist
    const users = await User.find({ _id: { $in: allParticipantIds } }).select(
      "_id fullName email",
    );
    if (users.length !== allParticipantIds.length) {
      return res
        .status(400)
        .json({ message: "One or more participant IDs are invalid" });
    }
    const fallbackGroupName = users
      .map((user) => user.fullName || user.email)
      .filter(Boolean)
      .slice(0, 3)
      .join(", ");

    const participants = allParticipantIds.map((id) => ({
      userId: id,
      joinedAt: new Date(),
    }));

    const conversation = await Conversation.create({
      type,
      name:
        type === "group" ? groupName || fallbackGroupName || "Nhóm mới" : "",
      participants,
      createdBy: req.user._id,
    });

    const conversationData = await formatConversation(conversation, {
      currentUserId: req.user._id,
    });

    if (ioInstance) {
      joinParticipantSocketsToConversationRoom(ioInstance, conversation);
    }

    res.status(201).json(conversationData);
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
      return res
        .status(403)
        .json({ message: "You are not a participant of this conversation" });
    }

    res.status(200).json(
      await formatConversation(conversation, {
        includeEmail: true,
        includeLastRead: true,
        currentUserId: req.user._id,
      }),
    );
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
      return res
        .status(403)
        .json({ message: "You are not a participant of this conversation" });
    }

    const { name, avatar } = req.body;

    if (name !== undefined) conversation.name = name;
    if (avatar !== undefined) conversation.avatar = avatar;

    await conversation.save();

    res
      .status(200)
      .json(
        await formatConversation(conversation, { currentUserId: req.user._id }),
      );
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
      return res
        .status(403)
        .json({ message: "You are not a participant of this conversation" });
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
      return res
        .status(400)
        .json({ message: "Cannot add members to private conversations" });
    }

    if (!isParticipant(conversation, req.user._id)) {
      return res
        .status(403)
        .json({ message: "You are not a participant of this conversation" });
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

    res
      .status(200)
      .json({ message: "Member added to conversation successfully" });
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
      return res
        .status(400)
        .json({ message: "Cannot remove members from private conversations" });
    }

    if (!isParticipant(conversation, req.user._id)) {
      return res
        .status(403)
        .json({ message: "You are not a participant of this conversation" });
    }

    const { userId } = req.params;

    const participantIndex = conversation.participants.findIndex(
      (p) => p.userId.toString() === userId.toString(),
    );

    if (participantIndex === -1) {
      return res
        .status(404)
        .json({ message: "User is not a participant of this conversation" });
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
      return res
        .status(403)
        .json({ message: "You are not a participant of this conversation" });
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

    if (!before && messages.length > 0) {
      await markConversationRead(conversation, req.user._id, messages[0]._id);
    }

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

// POST /conversations/:id/read
export const markConversationAsRead = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (!isParticipant(conversation, req.user._id)) {
      return res
        .status(403)
        .json({ message: "You are not a participant of this conversation" });
    }

    const latestMessage =
      (conversation.lastMessage?.messageId &&
        (await Message.findById(conversation.lastMessage.messageId).select(
          "_id",
        ))) ||
      (await Message.findOne({ conversationId: conversation._id })
        .sort({ createdAt: -1 })
        .select("_id"));

    if (latestMessage?._id) {
      await markConversationRead(conversation, req.user._id, latestMessage._id);
    }

    res.status(200).json(
      await formatConversation(conversation, {
        includeEmail: true,
        includeLastRead: true,
        currentUserId: req.user._id,
      }),
    );
  } catch (error) {
    console.error("MarkConversationAsRead error:", error.message);
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
      return res
        .status(403)
        .json({ message: "You are not a participant of this conversation" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Attachment file is required" });
    }

    // Upload to R2
    const storage = getR2StorageService();
    const storageKey = buildR2AttachmentKey(
      "conversations",
      req.file.originalname,
    );

    await storage.putObject({
      key: storageKey,
      body: req.file.buffer,
      contentType: req.file.mimetype,
      contentLength: req.file.size,
    });

    // Build R2 URL
    const r2Url = buildR2PublicUrl(storageKey);

    res.status(201).json({
      fileName: req.file.originalname,
      fileUrl: r2Url,
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
      return res
        .status(403)
        .json({ message: "You are not a participant of this conversation" });
    }

    const { type, content, attachments, mentions, replyTo, metadata } =
      req.body;

    if (!content && (!attachments || attachments.length === 0)) {
      return res
        .status(400)
        .json({ message: "Message content or attachments required" });
    }

    if (replyTo) {
      const replyMsg = await Message.findById(replyTo);
      if (
        !replyMsg ||
        replyMsg.conversationId.toString() !== conversation._id.toString()
      ) {
        return res.status(400).json({ message: "Invalid replyTo message" });
      }
    }

    const message = await Message.create({
      conversationId: conversation._id,
      senderId: req.user._id,
      type: type || "text",
      content: content || "",
      metadata: metadata || {},
      attachments: attachments || [],
      mentions: mentions || [],
      replyTo: replyTo || null,
    });

    // Update lastMessage on conversation
    conversation.lastMessage = {
      messageId: message._id,
      content: content || (attachments?.length > 0 ? "[Attachment]" : ""),
      senderId: req.user._id,
      createdAt: message.createdAt,
      deletedAt: null,
      deletedBy: null,
    };
    await conversation.save();

    const [messageData, conversationData] = await Promise.all([
      formatMessage(message),
      formatConversation(conversation, { currentUserId: req.user._id }),
    ]);

    // Emit Socket.IO event
    if (ioInstance) {
      joinParticipantSocketsToConversationRoom(ioInstance, conversation);
      ioInstance
        .to(getConversationRealtimeRoomNames(conversation))
        .emit("new_message", {
          ...messageData,
          conversation: conversationData,
        });
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
      return res
        .status(403)
        .json({ message: "You are not a participant of this conversation" });
    }

    const message = await Message.findById(req.params.messageId);
    if (
      !message ||
      message.conversationId.toString() !== conversation._id.toString()
    ) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (message.senderId.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Only the sender can edit this message" });
    }

    if (message.deletedAt) {
      return res.status(400).json({ message: "Cannot edit a deleted message" });
    }

    const { content } = req.body;
    const nextContent = typeof content === "string" ? content.trim() : "";
    if (!nextContent) {
      return res.status(400).json({ message: "Message content is required" });
    }

    message.content = nextContent;
    message.editedAt = new Date();
    await message.save();

    const isLastMessage =
      toComparableId(conversation.lastMessage?.messageId) ===
      toComparableId(message._id);

    if (isLastMessage) {
      conversation.lastMessage = {
        ...(conversation.lastMessage?.toObject?.() ||
          conversation.lastMessage ||
          {}),
        content: nextContent,
      };
      await conversation.save();
    }

    const [messageData, conversationData] = await Promise.all([
      formatMessage(message),
      formatConversation(conversation, { currentUserId: req.user._id }),
    ]);

    if (ioInstance) {
      ioInstance
        .to(getConversationRealtimeRoomNames(conversation))
        .emit("message_updated", {
          ...messageData,
          conversation: conversationData,
        });
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
      return res
        .status(403)
        .json({ message: "You are not a participant of this conversation" });
    }

    const message = await Message.findById(req.params.messageId);
    if (
      !message ||
      message.conversationId.toString() !== conversation._id.toString()
    ) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (message.senderId.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Only the sender can delete this message" });
    }

    message.deletedAt = message.deletedAt || new Date();
    message.deletedBy = req.user._id;
    message.isPinned = false;
    message.pinnedBy = null;
    message.pinnedAt = null;
    await message.save();

    const messageData = await formatMessage(message);
    const isLastMessage =
      toComparableId(conversation.lastMessage?.messageId) ===
        toComparableId(message._id) ||
      (!conversation.lastMessage?.messageId &&
        toComparableId(conversation.lastMessage?.senderId) ===
          toComparableId(message.senderId) &&
        conversation.lastMessage?.createdAt &&
        new Date(conversation.lastMessage.createdAt).getTime() ===
          new Date(message.createdAt).getTime());

    if (isLastMessage) {
      conversation.lastMessage = {
        ...(conversation.lastMessage?.toObject?.() ||
          conversation.lastMessage ||
          {}),
        messageId: message._id,
        content: "",
        senderId: message.senderId,
        createdAt: message.createdAt,
        deletedAt: message.deletedAt,
        deletedBy: req.user._id,
      };
      await conversation.save();
    }

    const conversationData = await formatConversation(conversation, {
      currentUserId: req.user._id,
    });

    if (ioInstance) {
      ioInstance
        .to(getConversationRealtimeRoomNames(conversation))
        .emit("message_deleted", {
          messageId: message._id,
          conversationId: conversation._id,
          message: messageData,
          conversation: conversationData,
        });
    }

    res
      .status(200)
      .json({ message: messageData, conversation: conversationData });
  } catch (error) {
    console.error("DeleteMessage error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// PATCH /conversations/:id/messages/:messageId/pin
export const updateMessagePin = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (!isParticipant(conversation, req.user._id)) {
      return res
        .status(403)
        .json({ message: "You are not a participant of this conversation" });
    }

    const message = await Message.findById(req.params.messageId);
    if (
      !message ||
      message.conversationId.toString() !== conversation._id.toString()
    ) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (message.deletedAt) {
      return res.status(400).json({ message: "Cannot pin a deleted message" });
    }

    const isPinned = normalizePinnedState(req.body?.isPinned);
    message.isPinned = isPinned;
    message.pinnedBy = isPinned ? req.user._id : null;
    message.pinnedAt = isPinned ? new Date() : null;
    await message.save();

    const messageData = await formatMessage(message);

    if (ioInstance) {
      ioInstance
        .to(getConversationRealtimeRoomNames(conversation))
        .emit("message_updated", messageData);
    }

    res.status(200).json(messageData);
  } catch (error) {
    console.error("UpdateMessagePin error:", error.message);
    if (error.message === "isPinned must be a boolean") {
      return res.status(400).json({ message: error.message });
    }
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
      return res
        .status(403)
        .json({ message: "You are not a participant of this conversation" });
    }

    const message = await Message.findById(req.params.messageId);
    if (
      !message ||
      message.conversationId.toString() !== conversation._id.toString()
    ) {
      return res.status(404).json({ message: "Message not found" });
    }

    const { reaction } = req.body;
    if (!reaction) {
      return res.status(400).json({ message: "reaction is required" });
    }

    // Check if user already has this reaction
    const existingIndex = message.reactions.findIndex(
      (r) =>
        r.userId.toString() === req.user._id.toString() &&
        r.reaction === reaction,
    );

    if (existingIndex !== -1) {
      return res
        .status(400)
        .json({ message: "You have already reacted with this emoji" });
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
      return res
        .status(403)
        .json({ message: "You are not a participant of this conversation" });
    }

    const message = await Message.findById(req.params.messageId);
    if (
      !message ||
      message.conversationId.toString() !== conversation._id.toString()
    ) {
      return res.status(404).json({ message: "Message not found" });
    }

    const { reaction } = req.body;
    if (!reaction) {
      return res.status(400).json({ message: "reaction is required" });
    }

    const reactionIndex = message.reactions.findIndex(
      (r) =>
        r.userId.toString() === req.user._id.toString() &&
        r.reaction === reaction,
    );

    if (reactionIndex === -1) {
      return res.status(404).json({ message: "Reaction not found" });
    }

    message.reactions.splice(reactionIndex, 1);
    await message.save();

    if (ioInstance) {
      ioInstance
        .to(`conversation:${conversation._id}`)
        .emit("reaction_removed", {
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
