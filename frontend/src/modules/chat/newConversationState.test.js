import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildConversationPayload,
  canCreateConversation,
  toggleSelectedUser,
} from "./newConversationState.js";

describe("new conversation helpers", () => {
  const an = { id: "user-1", fullName: "An Nguyen" };
  const binh = { id: "user-2", fullName: "Binh Tran" };

  it("keeps private conversations to exactly one selected user", () => {
    assert.deepEqual(toggleSelectedUser([], an, "private"), [an]);
    assert.deepEqual(toggleSelectedUser([an], binh, "private"), [binh]);
    assert.deepEqual(toggleSelectedUser([an], an, "private"), []);
  });

  it("toggles multiple selected users for group conversations", () => {
    const selected = toggleSelectedUser([], an, "group");
    const withSecondUser = toggleSelectedUser(selected, binh, "group");
    const withoutFirstUser = toggleSelectedUser(withSecondUser, an, "group");

    assert.deepEqual(withSecondUser, [an, binh]);
    assert.deepEqual(withoutFirstUser, [binh]);
  });

  it("builds valid private and group conversation payloads", () => {
    assert.deepEqual(
      buildConversationPayload({
        type: "private",
        groupName: "",
        selectedUsers: [an],
      }),
      {
        type: "private",
        participantIds: ["user-1"],
      },
    );

    assert.deepEqual(
      buildConversationPayload({
        type: "group",
        groupName: "  Design team  ",
        selectedUsers: [an, binh],
      }),
      {
        type: "group",
        name: "Design team",
        participantIds: ["user-1", "user-2"],
      },
    );
  });

  it("requires a selected user and a group name when needed", () => {
    assert.equal(canCreateConversation("private", "", []), false);
    assert.equal(canCreateConversation("private", "", [an]), true);
    assert.equal(canCreateConversation("group", "", [an]), false);
    assert.equal(canCreateConversation("group", "Design", [an]), true);
  });
});
