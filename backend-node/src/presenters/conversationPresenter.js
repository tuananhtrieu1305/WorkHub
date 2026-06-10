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
import {
  addPollOption,
  closePoll,
  applyPollVote,
  getCurrentUserPollOptionIds,
  isPollClosed,
  normalizePollPayload,
  sortPollOptionsByVotesAndText,
} from "../utils/pollPolicy.js";
import { contentDisposition } from "../utils/fileResponse.js";

// Helper: get io instance
let ioInstance = null;
export const setIo = (io) => {
  ioInstance = io;
};

const USER_MESSAGE_TYPES = new Set(["text", "image", "file", "audio", "poll"]);
const MAX_MESSAGE_ATTACHMENTS = 10;
const MAX_VOICE_DURATION_SECONDS = 5 * 60;
const VOICE_ATTACHMENT_FILE_SIZE_LIMIT = 20 * 1024 * 1024;
const POLL_VOTED_EVENT_TYPE = "poll_voted";
const POLL_OPTION_ADDED_EVENT_TYPE = "poll_option_added";
const POLL_CREATED_EVENT_TYPE = "poll_created";
const POLL_SHARED_EVENT_TYPE = "poll_shared";
const POLL_CLOSED_EVENT_TYPE = "poll_closed";
const POLL_ACTIVITY_EVENT_TYPES = new Set([
  POLL_VOTED_EVENT_TYPE,
  POLL_OPTION_ADDED_EVENT_TYPE,
  POLL_CREATED_EVENT_TYPE,
  POLL_SHARED_EVENT_TYPE,
  POLL_CLOSED_EVENT_TYPE,
]);
const ALLOWED_AUDIO_MIMES = new Set([
  "audio/aac",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a",
  "audio/x-wav",
]);

const normalizeString = (value, maxLength = 1000) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
};

const normalizePositiveNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
};

const getBaseMimeType = (mimeType = "") =>
  String(mimeType).toLowerCase().split(";")[0].trim();

const isAudioMime = (mimeType = "") =>
  getBaseMimeType(mimeType).startsWith("audio/");

const isAllowedAudioMime = (mimeType = "") => {
  const normalizedMime = getBaseMimeType(mimeType);
  return isAudioMime(normalizedMime) && ALLOWED_AUDIO_MIMES.has(normalizedMime);
};

const isAudioAttachment = (attachment = {}) => {
  return (
    attachment.kind === "voice" ||
    attachment.kind === "audio" ||
    isAudioMime(attachment.mimeType)
  );
};

const getAttachmentKind = (attachment = {}) => {
  const explicitKind = normalizeString(attachment.kind, 24);
  if (["file", "image", "video", "audio", "voice"].includes(explicitKind)) {
    return explicitKind;
  }

  const mimeType = getBaseMimeType(normalizeString(attachment.mimeType, 120));
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "file";
};

const normalizeAttachmentPayload = (attachment = {}) => {
  const fileName = normalizeString(attachment.fileName, 255);
  const fileUrl = normalizeString(attachment.fileUrl, 2048);
  const storageKey = normalizeString(attachment.storageKey, 2048);
  const mimeType = getBaseMimeType(normalizeString(attachment.mimeType, 120));
  const fileSize = normalizePositiveNumber(attachment.fileSize);
  const durationSeconds = normalizePositiveNumber(attachment.durationSeconds);
  const normalized = {
    fileName,
    fileUrl,
    ...(storageKey ? { storageKey } : {}),
    ...(fileSize !== undefined ? { fileSize } : {}),
    mimeType,
    kind: getAttachmentKind({ ...attachment, mimeType }),
  };

  if (durationSeconds !== undefined) {
    normalized.durationSeconds = Math.min(
      Math.round(durationSeconds),
      MAX_VOICE_DURATION_SECONDS,
    );
  }

  return normalized;
};

const normalizeMessageAttachments = (attachments) => {
  if (!Array.isArray(attachments)) return [];

  return attachments
    .slice(0, MAX_MESSAGE_ATTACHMENTS)
    .map(normalizeAttachmentPayload)
    .filter((attachment) => attachment.fileName && attachment.fileUrl);
};

const getMessagePreviewContent = ({ type, content, attachments = [] } = {}) => {
  const trimmedContent = typeof content === "string" ? content.trim() : "";
  if (type === "poll") {
    return trimmedContent ? `Bình chọn: ${trimmedContent}` : "Bình chọn";
  }

  if (trimmedContent) return trimmedContent;

  if (type === "audio" || attachments.some(isAudioAttachment)) {
    return "Tin nhắn thoại";
  }

  const firstAttachment = attachments[0];
  const firstMime = String(firstAttachment?.mimeType || "").toLowerCase();
  if (firstMime.startsWith("image/")) return "Ảnh";
  if (firstMime.startsWith("video/")) return "Video";
  if (attachments.length > 0) return "Tệp đính kèm";
  return "";
};

export const buildConversationAttachmentDownloadUrl = (
  conversationId,
  storageKey,
  fileName = "",
  { disposition = "inline" } = {},
) => {
  if (!conversationId || !storageKey) return "";

  const params = new URLSearchParams({
    key: storageKey,
    disposition: disposition === "attachment" ? "attachment" : "inline",
  });

  if (fileName) {
    params.set("name", fileName);
  }

  return `/api/conversations/${conversationId}/attachments/download?${params.toString()}`;
};

const extractR2StorageKey = (fileUrl = "") => {
  if (!fileUrl || !fileUrl.startsWith("http")) return "";

  try {
    const url = new URL(fileUrl);
    const bucketName = process.env.R2_BUCKET_NAME;
    const pathParts = url.pathname.split("/").filter(Boolean);
    if (!bucketName || pathParts[0] !== bucketName) return "";

    const storageKey = decodeURIComponent(pathParts.slice(1).join("/"));
    return storageKey.startsWith("attachments/conversations/")
      ? storageKey
      : "";
  } catch {
    return "";
  }
};

export const serializeConversationAttachments = (conversationId, attachments = []) => {
  return (attachments || []).map((attachment) => {
    const plain = attachment?.toObject?.() || attachment || {};
    const storageKey =
      normalizeString(plain.storageKey, 2048) ||
      extractR2StorageKey(plain.fileUrl);

    if (!storageKey) {
      return plain;
    }

    return {
      ...plain,
      storageKey,
      fileUrl: buildConversationAttachmentDownloadUrl(
        conversationId,
        storageKey,
        plain.fileName,
      ),
    };
  });
};

const getDirectR2AttachmentUrl = (storageKey) => {
  try {
    return buildR2PublicUrl(storageKey);
  } catch {
    return "";
  }
};

const isConversationAttachmentStorageKey = (storageKey = "") =>
  storageKey.startsWith("attachments/conversations/");

const sanitizeAttachmentHeaderFileName = (fileName = "") => {
  const normalized = normalizeString(fileName, 255) || "attachment";
  return normalized.replace(/["\\\r\n]/g, "_");
};

const normalizeRangeHeader = (rangeHeader) => {
  if (typeof rangeHeader !== "string") return "";
  const trimmedRange = rangeHeader.trim();
  return /^bytes=\d*-\d*$/.test(trimmedRange) ? trimmedRange : "";
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

const formatPollVoter = (user) =>
  user
    ? {
        _id: user._id,
        id: user._id,
        fullName: user.fullName,
        avatar: user.avatar,
      }
    : null;

const collectPollVoterIds = (poll) => {
  const voterIds = new Set();
  (poll?.options || []).forEach((option) => {
    (option.voters || []).forEach((vote) => {
      const userId = toComparableId(vote.userId);
      if (userId) voterIds.add(userId);
    });
  });
  return [...voterIds];
};

const formatPoll = async (poll, { currentUserId = null } = {}) => {
  if (!poll) return null;

  const plain = poll.toObject?.() || poll;
  const currentUserOptionIds = getCurrentUserPollOptionIds(
    plain,
    currentUserId,
  );
  const hasCurrentUserVoted = currentUserOptionIds.length > 0;
  const pollClosed = isPollClosed(plain);
  const resultsVisible =
    pollClosed || !plain.settings?.hideResultsUntilVoted || hasCurrentUserVoted;
  const hideVoters = Boolean(plain.settings?.hideVoters);
  const voterIds = collectPollVoterIds(plain);
  const users =
    resultsVisible && !hideVoters && voterIds.length
      ? await User.find({ _id: { $in: voterIds } }).select(
          "_id fullName avatar",
        )
      : [];
  const userById = new Map(users.map((user) => [user._id.toString(), user]));
  const totalVotes = (plain.options || []).reduce(
    (sum, option) => sum + (option.voters || []).length,
    0,
  );

  const options = (plain.options || []).map((option) => {
    const optionId = toComparableId(option._id || option.id);
    const voters = option.voters || [];
    const voterUsers =
      resultsVisible && !hideVoters
        ? voters
            .map((vote) => formatPollVoter(userById.get(toComparableId(vote.userId))))
            .filter(Boolean)
        : [];

    return {
      id: optionId,
      text: option.text || "",
      voteCount: resultsVisible ? voters.length : null,
      voters: voterUsers,
      isSelectedByCurrentUser: currentUserOptionIds.includes(optionId),
    };
  });

  return {
    question: plain.question || "",
    options: sortPollOptionsByVotesAndText(options, {
      getVoteCount: (option) =>
        resultsVisible && typeof option.voteCount === "number"
          ? option.voteCount
          : 0,
    }),
    settings: {
      multiple: Boolean(plain.settings?.multiple),
      allowOptions: Boolean(plain.settings?.allowOptions),
      hideResultsUntilVoted: Boolean(plain.settings?.hideResultsUntilVoted),
      hideVoters,
    },
    expiresAt: plain.expiresAt || null,
    closedAt: plain.closedAt || null,
    isClosed: pollClosed,
    resultsVisible,
    currentUserOptionIds,
    totalVotes: resultsVisible ? totalVotes : null,
    totalVoters: resultsVisible ? voterIds.length : null,
  };
};

const getSystemMessageMetadata = (message) => {
  const metadata = message.metadata?.toObject?.() || message.metadata || {};
  return metadata && typeof metadata === "object" ? metadata : {};
};

const formatPollActivityTargetMessage = async (
  metadata,
  { currentUserId = null } = {},
) => {
  const targetMessageId = metadata?.targetMessageId;
  if (!targetMessageId) return null;

  const pollMessage = await Message.findById(targetMessageId);
  if (
    !pollMessage ||
    pollMessage.deletedAt ||
    pollMessage.type !== "poll" ||
    !pollMessage.poll
  ) {
    return null;
  }

  const [sender, pinnedBy, pollData] = await Promise.all([
    User.findById(pollMessage.senderId).select(
      "_id fullName avatar activityStatus activityStatusExpiresAt",
    ),
    pollMessage.pinnedBy
      ? User.findById(pollMessage.pinnedBy).select(
          "_id fullName avatar activityStatus activityStatusExpiresAt",
        )
      : null,
    formatPoll(pollMessage.poll, { currentUserId }),
  ]);

  return {
    id: pollMessage._id,
    conversationId: pollMessage.conversationId,
    sender: formatConversationUser(sender),
    type: pollMessage.type,
    content: pollMessage.content,
    metadata: pollMessage.metadata || {},
    poll: pollData,
    attachments: [],
    mentions: pollMessage.mentions || [],
    replyTo: null,
    reactions: pollMessage.reactions || [],
    editedAt: pollMessage.editedAt,
    isPinned: Boolean(pollMessage.isPinned),
    pinnedAt: pollMessage.pinnedAt,
    pinnedBy: formatConversationUser(pinnedBy),
    deletedAt: null,
    deletedBy: null,
    createdAt: pollMessage.createdAt,
    updatedAt: pollMessage.updatedAt,
  };
};

const formatMessageMetadata = async (
  message,
  { currentUserId = null } = {},
) => {
  const metadata = getSystemMessageMetadata(message);
  if (
    message.type !== "system" ||
    !POLL_ACTIVITY_EVENT_TYPES.has(metadata.eventType)
  ) {
    return metadata;
  }

  return {
    ...metadata,
    pollMessage: await formatPollActivityTargetMessage(metadata, {
      currentUserId,
    }),
  };
};

const formatReplyMessage = async (replyTo, { currentUserId = null } = {}) => {
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
    poll: isDeleted
      ? null
      : await formatPoll(replyMessage.poll, { currentUserId }),
    attachments: isDeleted
      ? []
      : serializeConversationAttachments(
          replyMessage.conversationId,
          replyMessage.attachments,
        ),
    editedAt: replyMessage.editedAt,
    isPinned: isDeleted ? false : Boolean(replyMessage.isPinned),
    pinnedAt: isDeleted ? null : replyMessage.pinnedAt,
    pinnedBy: isDeleted ? null : formatConversationUser(pinnedBy),
    deletedAt: replyMessage.deletedAt,
    deletedBy: formatConversationUser(deletedBy),
    createdAt: replyMessage.createdAt,
  };
};

const formatMessage = async (message, { currentUserId = null } = {}) => {
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
  const metadata = isDeleted
    ? {}
    : await formatMessageMetadata(message, { currentUserId });

  return {
    id: message._id,
    conversationId: message.conversationId,
    sender: formatConversationUser(sender),
    type: message.type,
    content: isDeleted ? "" : message.content,
    metadata,
    poll: isDeleted ? null : await formatPoll(message.poll, { currentUserId }),
    attachments: isDeleted
      ? []
      : serializeConversationAttachments(
          message.conversationId,
          message.attachments,
        ),
    mentions: isDeleted ? [] : message.mentions,
    replyTo: await formatReplyMessage(message.replyTo, { currentUserId }),
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

const emitPersonalizedMessageUpdated = async (
  conversation,
  message,
  extraPayload = {},
) => {
  if (!ioInstance) return;

  await Promise.all(
    (conversation.participants || []).map(async (participant) => {
      const participantUserId = participant.userId;
      const [messageData, conversationData] = await Promise.all([
        formatMessage(message, { currentUserId: participantUserId }),
        formatConversation(conversation, { currentUserId: participantUserId }),
      ]);

      ioInstance.to(`user:${participantUserId}`).emit("message_updated", {
        ...messageData,
        ...extraPayload,
        conversation: conversationData,
      });
    }),
  );
};

const emitPersonalizedNewMessage = async (
  conversation,
  message,
  extraPayload = {},
) => {
  if (!ioInstance) return;

  await Promise.all(
    (conversation.participants || []).map(async (participant) => {
      const participantUserId = participant.userId;
      const [messageData, conversationData] = await Promise.all([
        formatMessage(message, { currentUserId: participantUserId }),
        formatConversation(conversation, { currentUserId: participantUserId }),
      ]);

      ioInstance.to(`user:${participantUserId}`).emit("new_message", {
        ...messageData,
        ...extraPayload,
        conversation: conversationData,
      });
    }),
  );
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

    const { before, around, limit = 30 } = req.query;
    const messageLimit = Math.min(Math.max(1, parseInt(limit)), 100);

    if (around) {
      const targetMessage = await Message.findById(around);
      if (
        !targetMessage ||
        targetMessage.conversationId.toString() !== conversation._id.toString()
      ) {
        return res.status(404).json({ message: "Message not found" });
      }

      const olderLimit = Math.floor((messageLimit - 1) / 2);
      const newerLimit = Math.max(0, messageLimit - olderLimit - 1);
      const [olderMessages, newerMessages] = await Promise.all([
        Message.find({
          conversationId: conversation._id,
          createdAt: { $lt: targetMessage.createdAt },
        })
          .sort({ createdAt: -1, _id: -1 })
          .limit(olderLimit),
        Message.find({
          conversationId: conversation._id,
          createdAt: { $gt: targetMessage.createdAt },
        })
          .sort({ createdAt: 1, _id: 1 })
          .limit(newerLimit),
      ]);

      const content = await Promise.all(
        [...olderMessages.reverse(), targetMessage, ...newerMessages].map(
          (message) => formatMessage(message, { currentUserId: req.user._id }),
        ),
      );

      return res.status(200).json({ content, hasMore: false });
    }

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

    const content = await Promise.all(
      messages.map((message) =>
        formatMessage(message, { currentUserId: req.user._id }),
      ),
    );

    res.status(200).json({ content, hasMore });
  } catch (error) {
    console.error("GetMessages error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid conversation ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// GET /conversations/:id/pinned-messages
export const getPinnedMessages = async (req, res) => {
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

    const pinnedMessages = await Message.find({
      conversationId: conversation._id,
      isPinned: true,
      deletedAt: null,
    }).sort({ pinnedAt: -1, createdAt: -1, _id: -1 });

    const content = await Promise.all(
      pinnedMessages.map((message) =>
        formatMessage(message, { currentUserId: req.user._id }),
      ),
    );

    res.status(200).json({ content });
  } catch (error) {
    console.error("GetPinnedMessages error:", error.message);
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

// GET /conversations/:id/attachments/download
export const downloadConversationAttachment = async (req, res) => {
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

    const storageKey = normalizeString(req.query?.key, 2048);
    if (!storageKey || !isConversationAttachmentStorageKey(storageKey)) {
      return res.status(400).json({ message: "Invalid attachment key" });
    }

    const directFileUrl = getDirectR2AttachmentUrl(storageKey);
    const attachmentLookup = [{ storageKey }];
    if (directFileUrl) {
      attachmentLookup.push({ fileUrl: directFileUrl });
    }

    const attachmentMessage = await Message.findOne({
      conversationId: conversation._id,
      attachments: {
        $elemMatch: {
          $or: attachmentLookup,
        },
      },
    }).select("_id");

    if (!attachmentMessage) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    const range = normalizeRangeHeader(req.headers.range);
    const object = await getR2StorageService().getObjectStream({
      key: storageKey,
      range,
    });

    if (!object.body) {
      return res.status(404).json({ message: "Attachment data not found" });
    }

    const fileName = sanitizeAttachmentHeaderFileName(req.query?.name);
    const statusCode = range && object.contentRange ? 206 : 200;
    res.status(statusCode);
    res.setHeader(
      "Content-Type",
      object.contentType || "application/octet-stream",
    );
    res.setHeader("Accept-Ranges", "bytes");
    const dispositionType =
      req.query?.disposition === "attachment" ? "attachment" : "inline";
    res.setHeader(
      "Content-Disposition",
      contentDisposition(dispositionType, fileName),
    );
    res.setHeader("Cache-Control", "private, max-age=3600");

    if (object.contentLength !== undefined) {
      res.setHeader("Content-Length", String(object.contentLength));
    }

    if (object.contentRange) {
      res.setHeader("Content-Range", object.contentRange);
    }

    object.body.on?.("error", (error) => {
      console.error(
        "DownloadConversationAttachment stream error:",
        error.message,
      );
      if (!res.headersSent) {
        res.status(500).json({ message: "Server error, please try again" });
      } else {
        res.destroy(error);
      }
    });

    object.body.pipe(res);
  } catch (error) {
    console.error("DownloadConversationAttachment error:", error.message);
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

    const uploadPurpose = normalizeString(req.body?.purpose, 40);
    const isVoiceUpload = uploadPurpose === "voice";
    const uploadMimeType = getBaseMimeType(req.file.mimetype);

    if (isVoiceUpload) {
      if (!isAllowedAudioMime(uploadMimeType)) {
        return res.status(400).json({
          message: "Voice attachment must be a supported audio file",
        });
      }

      if (req.file.size > VOICE_ATTACHMENT_FILE_SIZE_LIMIT) {
        return res.status(400).json({
          message: "Voice attachment is too large",
        });
      }
    }

    // Upload to R2
    const storage = getR2StorageService();
    const storageKey = buildR2AttachmentKey(
      `conversations/${conversation._id}`,
      req.file.originalname,
    );

    await storage.putObject({
      key: storageKey,
      body: req.file.buffer,
      contentType: uploadMimeType || req.file.mimetype,
      contentLength: req.file.size,
    });

    const fileUrl = buildConversationAttachmentDownloadUrl(
      conversation._id,
      storageKey,
      req.file.originalname,
    );

    res.status(201).json({
      fileName: req.file.originalname,
      fileUrl,
      storageKey,
      fileSize: req.file.size,
      mimeType: uploadMimeType,
      kind: isVoiceUpload
        ? "voice"
        : getAttachmentKind({ mimeType: uploadMimeType }),
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

    const { type, content, attachments, mentions, replyTo, metadata, poll } =
      req.body;
    const messageType = type || "text";
    const normalizedContent =
      typeof content === "string" ? content.trim() : "";
    const normalizedAttachments = normalizeMessageAttachments(attachments);
    let normalizedPoll = null;
    let pinPollOnCreate = false;

    if (!USER_MESSAGE_TYPES.has(messageType)) {
      return res.status(400).json({ message: "Invalid message type" });
    }

    if (messageType === "poll") {
      try {
        const normalized = normalizePollPayload(poll || metadata?.poll, {
          creatorId: req.user._id,
          now: new Date(),
        });
        normalizedPoll = normalized.poll;
        pinPollOnCreate = normalized.pinOnCreate;
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }
    }

    if (
      messageType !== "poll" &&
      !normalizedContent &&
      normalizedAttachments.length === 0
    ) {
      return res
        .status(400)
        .json({ message: "Message content or attachments required" });
    }

    if (
      messageType === "poll" &&
      (!normalizedPoll?.question || normalizedPoll.options.length < 2)
    ) {
      return res.status(400).json({ message: "Poll content is required" });
    }

    if (messageType === "audio") {
      const audioAttachments = normalizedAttachments.filter(isAudioAttachment);
      if (
        audioAttachments.length === 0 ||
        audioAttachments.length !== normalizedAttachments.length
      ) {
        return res.status(400).json({
          message: "Audio messages require audio attachments only",
        });
      }

      const hasUnsupportedAudio = audioAttachments.some(
        (attachment) => !isAllowedAudioMime(attachment.mimeType),
      );
      if (hasUnsupportedAudio) {
        return res.status(400).json({
          message: "Audio message attachment type is not supported",
        });
      }
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
      type: messageType,
      content: messageType === "poll" ? normalizedPoll.question : normalizedContent,
      metadata: metadata || {},
      poll: normalizedPoll,
      attachments: normalizedAttachments,
      mentions: mentions || [],
      replyTo: replyTo || null,
      isPinned: messageType === "poll" && pinPollOnCreate,
      pinnedBy: messageType === "poll" && pinPollOnCreate ? req.user._id : null,
      pinnedAt:
        messageType === "poll" && pinPollOnCreate ? new Date() : null,
    });

    let systemMessage = null;
    let conversationPreviewMessage = message;
    const previewContent = getMessagePreviewContent({
      type: messageType,
      content: messageType === "poll" ? normalizedPoll.question : normalizedContent,
      attachments: normalizedAttachments,
    });
    let conversationPreviewContent = previewContent;

    if (messageType === "poll") {
      const pollQuestion = normalizedPoll.question || message.content || "Bình chọn";
      const systemContent = `${
        req.user.fullName || "Người dùng"
      } đã tạo cuộc bình chọn mới: ${pollQuestion}`;
      systemMessage = await Message.create({
        conversationId: conversation._id,
        senderId: req.user._id,
        type: "system",
        content: systemContent,
        metadata: {
          eventType: POLL_CREATED_EVENT_TYPE,
          action: "create",
          targetMessageId: message._id,
          actorId: req.user._id,
          pollQuestion,
          pollCreatorId: req.user._id,
          pollCreatedAt: message.createdAt,
        },
      });
      conversationPreviewMessage = systemMessage;
      conversationPreviewContent = systemContent;
    }

    // Update lastMessage on conversation
    conversation.lastMessage = {
      messageId: conversationPreviewMessage._id,
      content: conversationPreviewContent,
      senderId: req.user._id,
      createdAt: conversationPreviewMessage.createdAt,
      deletedAt: null,
      deletedBy: null,
    };
    await conversation.save();

    const [messageData, systemMessageData, conversationData] =
      await Promise.all([
        formatMessage(message, { currentUserId: req.user._id }),
        systemMessage
          ? formatMessage(systemMessage, { currentUserId: req.user._id })
          : null,
        formatConversation(conversation, { currentUserId: req.user._id }),
      ]);

    // Emit Socket.IO event
    if (ioInstance) {
      joinParticipantSocketsToConversationRoom(ioInstance, conversation);
      if (systemMessage) {
        await emitPersonalizedNewMessage(conversation, message);
        await emitPersonalizedNewMessage(conversation, systemMessage);
      } else {
        ioInstance
          .to(getConversationRealtimeRoomNames(conversation))
          .emit("new_message", {
            ...messageData,
            conversation: conversationData,
          });
      }
    }

    res.status(201).json(
      systemMessageData
        ? {
            message: messageData,
            systemMessage: systemMessageData,
            conversation: conversationData,
          }
        : messageData,
    );
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
      formatMessage(message, { currentUserId: req.user._id }),
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

    const messageData = await formatMessage(message, {
      currentUserId: req.user._id,
    });
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
    const pinChangedAt = new Date();
    message.isPinned = isPinned;
    message.pinnedBy = isPinned ? req.user._id : null;
    message.pinnedAt = isPinned ? pinChangedAt : null;
    await message.save();

    const systemContent = `${req.user.fullName || "Người dùng"} ${
      isPinned ? "đã ghim một tin nhắn." : "đã bỏ ghim một tin nhắn"
    }`;
    const systemMessage = await Message.create({
      conversationId: conversation._id,
      senderId: req.user._id,
      type: "system",
      content: systemContent,
      metadata: {
        eventType: isPinned ? "message_pinned" : "message_unpinned",
        action: isPinned ? "pin" : "unpin",
        targetMessageId: message._id,
        actorId: req.user._id,
      },
    });

    conversation.lastMessage = {
      messageId: systemMessage._id,
      content: systemContent,
      senderId: req.user._id,
      createdAt: systemMessage.createdAt,
      deletedAt: null,
      deletedBy: null,
    };
    await conversation.save();

    const [messageData, systemMessageData, conversationData] =
      await Promise.all([
        formatMessage(message, { currentUserId: req.user._id }),
        formatMessage(systemMessage, { currentUserId: req.user._id }),
        formatConversation(conversation, { currentUserId: req.user._id }),
      ]);
    const pinEvent = {
      type: isPinned ? "pin" : "unpin",
      actor: messageData.pinnedBy || formatConversationUser(req.user),
      at: message.pinnedAt || message.updatedAt || pinChangedAt,
    };
    const messagePayload = {
      ...messageData,
      pinEvent,
      conversation: conversationData,
    };

    if (ioInstance) {
      joinParticipantSocketsToConversationRoom(ioInstance, conversation);
      if (message.type === "poll") {
        await emitPersonalizedMessageUpdated(conversation, message, {
          pinEvent,
        });
      } else {
        ioInstance
          .to(getConversationRealtimeRoomNames(conversation))
          .emit("message_updated", messagePayload);
      }
      ioInstance
        .to(getConversationRealtimeRoomNames(conversation))
        .emit("new_message", {
          ...systemMessageData,
          conversation: conversationData,
        });
    }

    res.status(200).json({
      ...messagePayload,
      systemMessage: systemMessageData,
    });
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

// POST /conversations/:id/messages/:messageId/poll/votes
export const votePoll = async (req, res) => {
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
      return res.status(400).json({ message: "Cannot vote on a deleted poll" });
    }

    if (message.type !== "poll" || !message.poll) {
      return res.status(400).json({ message: "Message is not a poll" });
    }

    const optionIds = Array.isArray(req.body?.optionIds)
      ? req.body.optionIds
      : req.body?.optionId
        ? [req.body.optionId]
        : [];

    try {
      applyPollVote(message.poll, optionIds, {
        userId: req.user._id,
        now: new Date(),
      });
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    message.markModified("poll");
    await message.save();

    const pollQuestion = message.poll?.question || message.content || "Bình chọn";
    const systemContent = `${
      req.user.fullName || "Người dùng"
    } tham gia cuộc bình chọn: ${pollQuestion}`;
    const systemMessage = await Message.create({
      conversationId: conversation._id,
      senderId: req.user._id,
      type: "system",
      content: systemContent,
      metadata: {
        eventType: POLL_VOTED_EVENT_TYPE,
        action: "vote",
        targetMessageId: message._id,
        actorId: req.user._id,
        pollQuestion,
        pollCreatorId: message.senderId,
        pollCreatedAt: message.createdAt,
      },
    });

    conversation.lastMessage = {
      messageId: systemMessage._id,
      content: systemContent,
      senderId: req.user._id,
      createdAt: systemMessage.createdAt,
      deletedAt: null,
      deletedBy: null,
    };
    await conversation.save();

    const [messageData, systemMessageData, conversationData] =
      await Promise.all([
        formatMessage(message, { currentUserId: req.user._id }),
        formatMessage(systemMessage, { currentUserId: req.user._id }),
        formatConversation(conversation, { currentUserId: req.user._id }),
      ]);

    if (ioInstance) {
      joinParticipantSocketsToConversationRoom(ioInstance, conversation);
      await emitPersonalizedMessageUpdated(conversation, message);
      await emitPersonalizedNewMessage(conversation, systemMessage);
    }

    res.status(200).json({
      message: messageData,
      systemMessage: systemMessageData,
      conversation: conversationData,
    });
  } catch (error) {
    console.error("VotePoll error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// POST /conversations/:id/messages/:messageId/poll/options
export const addPollOptionToMessage = async (req, res) => {
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
      return res
        .status(400)
        .json({ message: "Cannot add options to a deleted poll" });
    }

    if (message.type !== "poll" || !message.poll) {
      return res.status(400).json({ message: "Message is not a poll" });
    }

    const changedAt = new Date();

    try {
      addPollOption(message.poll, req.body?.text, {
        userId: req.user._id,
        now: changedAt,
      });
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    message.markModified("poll");
    await message.save();

    const addedOption =
      message.poll.options?.[message.poll.options.length - 1] || {};
    const pollOptionText =
      addedOption.text || normalizeString(req.body?.text, 100) || "lựa chọn mới";
    const pollQuestion = message.poll?.question || message.content || "Bình chọn";
    const systemContent = `${
      req.user.fullName || "Người dùng"
    } đã thêm lựa chọn "${pollOptionText}" vào cuộc bình chọn: ${pollQuestion}`;
    const systemMessage = await Message.create({
      conversationId: conversation._id,
      senderId: req.user._id,
      type: "system",
      content: systemContent,
      metadata: {
        eventType: POLL_OPTION_ADDED_EVENT_TYPE,
        action: "add_option",
        targetMessageId: message._id,
        actorId: req.user._id,
        pollQuestion,
        pollOptionText,
        pollCreatorId: message.senderId,
        pollCreatedAt: message.createdAt,
      },
    });

    conversation.lastMessage = {
      messageId: systemMessage._id,
      content: systemContent,
      senderId: req.user._id,
      createdAt: systemMessage.createdAt,
      deletedAt: null,
      deletedBy: null,
    };
    await conversation.save();

    const [messageData, systemMessageData, conversationData] =
      await Promise.all([
        formatMessage(message, { currentUserId: req.user._id }),
        formatMessage(systemMessage, { currentUserId: req.user._id }),
        formatConversation(conversation, { currentUserId: req.user._id }),
      ]);

    if (ioInstance) {
      joinParticipantSocketsToConversationRoom(ioInstance, conversation);
      await emitPersonalizedMessageUpdated(conversation, message);
      await emitPersonalizedNewMessage(conversation, systemMessage);
    }

    res.status(200).json({
      message: messageData,
      systemMessage: systemMessageData,
      conversation: conversationData,
    });
  } catch (error) {
    console.error("AddPollOption error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// POST /conversations/:id/messages/:messageId/poll/share
export const sharePollToConversation = async (req, res) => {
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
      return res.status(400).json({ message: "Cannot share a deleted poll" });
    }

    if (message.type !== "poll" || !message.poll) {
      return res.status(400).json({ message: "Message is not a poll" });
    }

    const pollQuestion = message.poll?.question || message.content || "Bình chọn";
    const systemContent = `${
      req.user.fullName || "Người dùng"
    } đã gửi bình chọn vào nhóm: ${pollQuestion}`;
    const systemMessage = await Message.create({
      conversationId: conversation._id,
      senderId: req.user._id,
      type: "system",
      content: systemContent,
      metadata: {
        eventType: POLL_SHARED_EVENT_TYPE,
        action: "share",
        targetMessageId: message._id,
        actorId: req.user._id,
        pollQuestion,
        pollCreatorId: message.senderId,
        pollCreatedAt: message.createdAt,
      },
    });

    conversation.lastMessage = {
      messageId: systemMessage._id,
      content: systemContent,
      senderId: req.user._id,
      createdAt: systemMessage.createdAt,
      deletedAt: null,
      deletedBy: null,
    };
    await conversation.save();

    const [messageData, systemMessageData, conversationData] =
      await Promise.all([
        formatMessage(message, { currentUserId: req.user._id }),
        formatMessage(systemMessage, { currentUserId: req.user._id }),
        formatConversation(conversation, { currentUserId: req.user._id }),
      ]);

    if (ioInstance) {
      joinParticipantSocketsToConversationRoom(ioInstance, conversation);
      await emitPersonalizedNewMessage(conversation, systemMessage);
    }

    res.status(200).json({
      message: messageData,
      systemMessage: systemMessageData,
      conversation: conversationData,
    });
  } catch (error) {
    console.error("SharePoll error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// PATCH /conversations/:id/messages/:messageId/poll/close
export const closePollInMessage = async (req, res) => {
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
      return res.status(400).json({ message: "Cannot close a deleted poll" });
    }

    if (message.type !== "poll" || !message.poll) {
      return res.status(400).json({ message: "Message is not a poll" });
    }

    if (message.senderId.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Only the poll creator can close this poll" });
    }

    const changedAt = new Date();

    try {
      closePoll(message.poll, { now: changedAt });
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    message.markModified("poll");
    await message.save();

    const pollQuestion = message.poll?.question || message.content || "Bình chọn";
    const systemContent = `${
      req.user.fullName || "Người dùng"
    } đã khóa bình chọn: ${pollQuestion}`;
    const systemMessage = await Message.create({
      conversationId: conversation._id,
      senderId: req.user._id,
      type: "system",
      content: systemContent,
      metadata: {
        eventType: POLL_CLOSED_EVENT_TYPE,
        action: "close",
        targetMessageId: message._id,
        actorId: req.user._id,
        pollQuestion,
        pollCreatorId: message.senderId,
        pollClosedAt: changedAt,
        pollCreatedAt: message.createdAt,
      },
    });

    conversation.lastMessage = {
      messageId: systemMessage._id,
      content: systemContent,
      senderId: req.user._id,
      createdAt: systemMessage.createdAt,
      deletedAt: null,
      deletedBy: null,
    };
    await conversation.save();

    const [messageData, systemMessageData, conversationData] =
      await Promise.all([
        formatMessage(message, { currentUserId: req.user._id }),
        formatMessage(systemMessage, { currentUserId: req.user._id }),
        formatConversation(conversation, { currentUserId: req.user._id }),
      ]);

    if (ioInstance) {
      joinParticipantSocketsToConversationRoom(ioInstance, conversation);
      await emitPersonalizedMessageUpdated(conversation, message);
      await emitPersonalizedNewMessage(conversation, systemMessage);
    }

    res.status(200).json({
      message: messageData,
      systemMessage: systemMessageData,
      conversation: conversationData,
    });
  } catch (error) {
    console.error("ClosePoll error:", error.message);
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
