import assert from "node:assert/strict";
import test from "node:test";
import {
  createMessagePageState,
  getCachedMessagePageState,
  getOldestMessageCursor,
  mergeMessagePage,
  setCachedMessagePageState,
} from "./messagePaginationState.js";

test("message pagination state stores only reusable page metadata", () => {
  const cache = new Map();

  setCachedMessagePageState(cache, { id: "conversation-1" }, {
    hasOlder: true,
    isLoadingOlder: true,
  });

  assert.deepEqual(getCachedMessagePageState(cache, "conversation-1"), {
    hasOlder: true,
    isLoadingOlder: false,
  });
  assert.deepEqual(createMessagePageState(), {
    hasOlder: false,
    isLoadingOlder: false,
  });
});

test("oldest message cursor is based on the earliest loaded message", () => {
  const messages = [
    { id: "message-3", createdAt: "2026-06-10T10:02:00.000Z" },
    { id: "message-1", createdAt: "2026-06-10T10:00:00.000Z" },
    { id: "message-2", createdAt: "2026-06-10T10:01:00.000Z" },
  ];

  assert.equal(
    getOldestMessageCursor(messages),
    "2026-06-10T10:00:00.000Z",
  );
});

test("older message pages are merged without duplicates and remain chronological", () => {
  const currentMessages = [
    { id: "message-3", content: "current", createdAt: "2026-06-10T10:02:00.000Z" },
    { id: "message-4", content: "newest", createdAt: "2026-06-10T10:03:00.000Z" },
  ];
  const olderPage = [
    { id: "message-2", content: "older", createdAt: "2026-06-10T10:01:00.000Z" },
    { id: "message-3", content: "refreshed", createdAt: "2026-06-10T10:02:00.000Z" },
    { _id: "message-1", content: "oldest", createdAt: "2026-06-10T10:00:00.000Z" },
  ];

  assert.deepEqual(
    mergeMessagePage(currentMessages, olderPage).map((message) => ({
      id: message.id,
      content: message.content,
    })),
    [
      { id: "message-1", content: "oldest" },
      { id: "message-2", content: "older" },
      { id: "message-3", content: "refreshed" },
      { id: "message-4", content: "newest" },
    ],
  );
});
