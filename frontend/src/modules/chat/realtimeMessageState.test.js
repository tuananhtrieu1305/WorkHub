import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addReactionToMessages,
  removeMessageById,
  removeReactionFromMessages,
  updateConversationParticipantStatus,
  updateConversationPreview,
  upsertMessageById,
  updateTypingUsers,
} from "./realtimeMessageState.js";

describe("chat realtime state helpers", () => {
  it("adds new messages in chronological order and replaces duplicate socket echoes", () => {
    const firstMessage = {
      id: "message-1",
      conversationId: "conversation-1",
      content: "First",
      createdAt: "2026-04-27T07:00:00.000Z",
    };

    const echoedMessage = {
      ...firstMessage,
      content: "First from socket",
      updatedAt: "2026-04-27T07:00:01.000Z",
    };

    const olderMessage = {
      id: "message-0",
      conversationId: "conversation-1",
      content: "Older",
      createdAt: "2026-04-27T06:59:00.000Z",
    };

    const afterFirstInsert = upsertMessageById([], firstMessage);
    const afterEcho = upsertMessageById(afterFirstInsert, echoedMessage);
    const afterOlderInsert = upsertMessageById(afterEcho, olderMessage);

    assert.equal(afterEcho.length, 1);
    assert.equal(afterEcho[0].content, "First from socket");
    assert.deepEqual(
      afterOlderInsert.map((message) => message.id),
      ["message-0", "message-1"]
    );
  });

  it("removes messages by id from delete events", () => {
    const messages = [
      { id: "message-1", content: "Keep" },
      { id: "message-2", content: "Delete" },
    ];

    assert.deepEqual(removeMessageById(messages, "message-2"), [
      { id: "message-1", content: "Keep" },
    ]);
  });

  it("adds and removes reactions without duplicating the same user reaction", () => {
    const messages = [
      {
        id: "message-1",
        reactions: [{ userId: "user-1", reaction: "👍" }],
      },
    ];

    const withDuplicateIgnored = addReactionToMessages(messages, {
      messageId: "message-1",
      userId: "user-1",
      reaction: "👍",
    });

    const withSecondReaction = addReactionToMessages(withDuplicateIgnored, {
      messageId: "message-1",
      userId: "user-2",
      reaction: "👍",
    });

    const afterRemove = removeReactionFromMessages(withSecondReaction, {
      messageId: "message-1",
      userId: "user-1",
      reaction: "👍",
    });

    assert.equal(withDuplicateIgnored[0].reactions.length, 1);
    assert.equal(withSecondReaction[0].reactions.length, 2);
    assert.deepEqual(afterRemove[0].reactions, [
      { userId: "user-2", reaction: "👍" },
    ]);
  });

  it("tracks typing users by conversation and clears users when typing stops", () => {
    const typingUsers = updateTypingUsers([], {
      conversationId: "conversation-1",
      userId: "user-1",
      fullName: "Nguyen Van An",
      isTyping: true,
    });

    const refreshedTypingUsers = updateTypingUsers(typingUsers, {
      conversationId: "conversation-1",
      userId: "user-1",
      fullName: "An Nguyen",
      isTyping: true,
    });

    const clearedTypingUsers = updateTypingUsers(refreshedTypingUsers, {
      conversationId: "conversation-1",
      userId: "user-1",
      fullName: "An Nguyen",
      isTyping: false,
    });

    assert.deepEqual(refreshedTypingUsers, [
      {
        conversationId: "conversation-1",
        userId: "user-1",
        fullName: "An Nguyen",
      },
    ]);
    assert.deepEqual(clearedTypingUsers, []);
  });

  it("moves conversations with new realtime messages to the top", () => {
    const conversations = [
      {
        id: "conversation-1",
        name: "Older conversation",
        updatedAt: "2026-04-27T07:00:00.000Z",
      },
      {
        id: "conversation-2",
        name: "Active conversation",
        updatedAt: "2026-04-27T07:01:00.000Z",
      },
    ];

    const updatedConversations = updateConversationPreview(conversations, {
      id: "message-1",
      conversationId: "conversation-1",
      sender: { _id: "user-1" },
      content: "Realtime hello",
      createdAt: "2026-04-27T07:02:00.000Z",
    });

    assert.deepEqual(
      updatedConversations.map((conversation) => conversation.id),
      ["conversation-1", "conversation-2"]
    );
    assert.deepEqual(updatedConversations[0].lastMessage, {
      content: "Realtime hello",
      senderId: "user-1",
      createdAt: "2026-04-27T07:02:00.000Z",
    });
  });

  it("updates participant activity statuses from realtime presence events", () => {
    const conversations = [
      {
        id: "conversation-1",
        participants: [
          {
            userId: "user-1",
            user: { _id: "user-1", fullName: "An", activityStatus: "online" },
          },
          {
            userId: "user-2",
            user: { _id: "user-2", fullName: "Binh", activityStatus: "idle" },
          },
        ],
      },
    ];

    const updatedConversations = updateConversationParticipantStatus(
      conversations,
      {
        userId: "user-2",
        activityStatus: "dnd",
      },
    );

    assert.equal(
      updatedConversations[0].participants[1].user.activityStatus,
      "dnd",
    );
    assert.equal(
      updatedConversations[0].participants[0].user.activityStatus,
      "online",
    );
  });
});
