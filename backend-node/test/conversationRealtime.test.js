import assert from "node:assert/strict";
import test from "node:test";
import {
  getConversationParticipantUserRoomName,
  getConversationRealtimeRoomNames,
  getConversationRoomName,
  getOrganizationRoomName,
  getOrganizationUserRoomName,
} from "../src/utils/conversationRealtime.js";

test("organization socket rooms include the organization boundary", () => {
  assert.equal(getOrganizationRoomName("org-a"), "organization:org-a");
  assert.equal(
    getOrganizationUserRoomName("org-a", "user-1"),
    "organization:org-a:user:user-1",
  );
});

test("conversation socket rooms are scoped to the active organization", () => {
  assert.equal(
    getConversationRoomName("conversation-1", "org-a"),
    "organization:org-a:conversation:conversation-1",
  );
  assert.equal(
    getConversationParticipantUserRoomName("conversation-1", "user-1", "org-a"),
    "organization:org-a:conversation:conversation-1:user:user-1",
  );
});

test("conversation realtime rooms do not include global user rooms when organization exists", () => {
  const rooms = getConversationRealtimeRoomNames({
    _id: "conversation-1",
    organizationId: "org-a",
    participants: [{ userId: "user-1" }, { userId: "user-2" }],
  });

  assert.deepEqual(rooms, [
    "organization:org-a:conversation:conversation-1",
    "organization:org-a:user:user-1",
    "organization:org-a:user:user-2",
    "organization:org-a:conversation:conversation-1:user:user-1",
    "organization:org-a:conversation:conversation-1:user:user-2",
  ]);
  assert.equal(rooms.includes("user:user-1"), false);
  assert.equal(rooms.includes("conversation:conversation-1"), false);
});
