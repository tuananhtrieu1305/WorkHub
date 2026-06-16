import {
  notifyUsersAggregated,
} from "./notificationService.js";
import {
  buildAggregatedNotificationCopy,
  uniqueIdList,
} from "../utils/notificationPolicy.js";

const toComparableId = (value) => {
  if (value == null) return "";
  return String(value._id || value.id || value);
};

const getActorId = (actor) => actor?._id || actor?.id || actor;

const getActorName = (actor) =>
  String(actor?.fullName || actor?.name || "Ai đó").trim() || "Ai đó";

const getConversationId = (conversation) => conversation?._id || conversation?.id;

const getParticipantUserIds = (conversation) =>
  uniqueIdList(
    (conversation?.participants || []).map((participant) => participant.userId),
  );

const normalizeBoolean = (value) =>
  value === true || value === "true" || value === 1 || value === "1";

export const normalizeMessageMentions = ({
  mentions = [],
  metadata = {},
  conversation,
  senderId,
} = {}) => {
  const sender = toComparableId(senderId);
  const participantIds = getParticipantUserIds(conversation);
  const participantSet = new Set(participantIds);
  const mentionEveryone =
    conversation?.type === "group" &&
    normalizeBoolean(metadata?.mentionEveryone);

  if (mentionEveryone) {
    const mentionIds = participantIds.filter((id) => id !== sender);
    return {
      mentionIds,
      recipientIds: mentionIds,
      mentionEveryone: true,
    };
  }

  const mentionIds = uniqueIdList(mentions, { exclude: sender }).filter((id) =>
    participantSet.has(id),
  );

  return {
    mentionIds,
    recipientIds: mentionIds,
    mentionEveryone: false,
  };
};

const buildChatMentionCopy = (context) =>
  buildAggregatedNotificationCopy({
    type: "chat_mention",
    data: context.data,
    ...context,
  });

export const notifyChatMentions = async ({
  conversation,
  message,
  actor,
  recipientIds = [],
  mentionEveryone = false,
} = {}) => {
  const conversationId = getConversationId(conversation);
  const messageId = message?._id || message?.id;
  const actorId = getActorId(actor);
  const recipients = uniqueIdList(recipientIds, { exclude: actorId });
  if (!conversationId || !messageId || recipients.length === 0) return [];

  const conversationName =
    conversation?.type === "group"
      ? conversation?.name || "nhóm chat"
      : "cuộc trò chuyện";

  return notifyUsersAggregated(recipients, {
    organizationId: conversation.organizationId || null,
    type: "chat_mention",
    title: "Bạn được đề cập trong tin nhắn",
    message: `${getActorName(actor)} đã nhắc ${
      mentionEveryone ? "@mọi người" : "bạn"
    } trong ${conversationName}.`,
    entityType: "message",
    entityId: messageId,
    actorId,
    actorName: getActorName(actor),
    aggregationKey: `conversation:${conversationId}:message:${messageId}:mentions`,
    isMention: true,
    buildCopy: buildChatMentionCopy,
    data: {
      conversationId,
      messageId,
      conversationName,
      mentionEveryone,
      actorName: getActorName(actor),
      contentPreview: message?.content || "",
      route: `/messages/${conversationId}`,
    },
  });
};

export default {
  normalizeMessageMentions,
  notifyChatMentions,
};
