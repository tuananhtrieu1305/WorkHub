import assert from "node:assert/strict";
import test from "node:test";
import {
  areMessagesForConversation,
  getCachedMessages,
  getVisibleMessagesForConversation,
  setCachedMessages,
  updateCachedMessages,
} from "./messageCacheState.js";

test("message cache returns stored messages by normalized conversation id", () => {
  const cache = new Map();
  const messages = [{ id: "message-1", content: "Xin chào" }];

  setCachedMessages(cache, { id: "conversation-1" }, messages);

  assert.deepEqual(getCachedMessages(cache, "conversation-1"), messages);
});

test("message cache updates only conversations that already have cached data", () => {
  const cache = new Map();
  setCachedMessages(cache, "conversation-1", [{ id: "message-1" }]);

  updateCachedMessages(cache, "conversation-1", (messages) => [
    ...messages,
    { id: "message-2" },
  ]);
  updateCachedMessages(cache, "conversation-2", () => [{ id: "message-3" }]);

  assert.deepEqual(getCachedMessages(cache, "conversation-1"), [
    { id: "message-1" },
    { id: "message-2" },
  ]);
  assert.equal(getCachedMessages(cache, "conversation-2"), null);
});

test("message owner guard hides messages from a previously selected conversation", () => {
  const messages = [{ id: "message-1", content: "Tin nhắn cũ" }];

  assert.equal(
    areMessagesForConversation("conversation-1", "conversation-2"),
    false
  );
  assert.deepEqual(
    getVisibleMessagesForConversation(
      messages,
      "conversation-1",
      "conversation-2"
    ),
    []
  );
  assert.deepEqual(
    getVisibleMessagesForConversation(
      messages,
      "conversation-1",
      "conversation-1"
    ),
    messages
  );
});
