import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getChatDetailDisplay } from "./chatDetailPanelState.js";

describe("chat detail panel display state", () => {
  it("uses the other participant for private chat details", () => {
    const display = getChatDetailDisplay(
      {
        type: "private",
        participants: [
          {
            userId: "me",
            user: {
              id: "me",
              _id: "me",
              fullName: "Current User",
              email: "me@example.com",
            },
          },
          {
            userId: "other",
            user: {
              id: "other",
              _id: "other",
              fullName: "Linh Tran",
              email: "linh@example.com",
              avatar: "/uploads/linh.png",
              activityStatus: "dnd",
              isOnline: true,
            },
          },
        ],
      },
      "me",
    );

    assert.equal(display.displayName, "Linh Tran");
    assert.equal(display.email, "linh@example.com");
    assert.equal(display.avatar, "/uploads/linh.png");
    assert.equal(display.activityStatus, "dnd");
    assert.equal(display.isOnline, true);
  });
});
