import assert from "node:assert/strict";
import test from "node:test";
import {
  getMessageMenuActions,
  normalizePinnedState,
} from "../src/utils/messageActionPolicy.js";

test("sender messages expose copy, edit, recall, and pin menu actions", () => {
  const actions = getMessageMenuActions({
    currentUserId: "user-1",
    senderId: "user-1",
    isDeleted: false,
    isPinned: false,
  });

  assert.deepEqual(actions, ["copy", "edit", "recall", "pin"]);
});

test("recipient messages expose only copy and pin menu actions", () => {
  const actions = getMessageMenuActions({
    currentUserId: "user-1",
    senderId: "user-2",
    isDeleted: false,
    isPinned: true,
  });

  assert.deepEqual(actions, ["copy", "unpin"]);
});

test("deleted messages expose no menu actions", () => {
  const actions = getMessageMenuActions({
    currentUserId: "user-1",
    senderId: "user-1",
    isDeleted: true,
    isPinned: true,
  });

  assert.deepEqual(actions, []);
});

test("pin payload accepts only explicit boolean values", () => {
  assert.equal(normalizePinnedState(true), true);
  assert.equal(normalizePinnedState(false), false);
  assert.throws(
    () => normalizePinnedState("true"),
    /isPinned must be a boolean/,
  );
});
