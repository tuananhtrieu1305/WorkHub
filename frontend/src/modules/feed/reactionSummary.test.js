import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getCommentReactionParticipants,
  getCommentReactionSummary,
} from "./reactionSummary.js";

describe("comment reaction summary helpers", () => {
  it("returns at most three reaction types sorted by highest count", () => {
    const summary = getCommentReactionSummary({
      reactions: [
        { reactionType: "haha", user: { _id: "u1", fullName: "An" } },
        { reactionType: "love", user: { _id: "u2", fullName: "Binh" } },
        { reactionType: "wow", user: { _id: "u3", fullName: "Chi" } },
        { reactionType: "love", user: { _id: "u4", fullName: "Dung" } },
        { reactionType: "sad", user: { _id: "u5", fullName: "Em" } },
        { reactionType: "love", user: { _id: "u6", fullName: "Gia" } },
        { reactionType: "haha", user: { _id: "u7", fullName: "Huy" } },
        { reactionType: "wow", user: { _id: "u8", fullName: "Lam" } },
      ],
    });

    assert.deepEqual(
      summary.map((item) => [item.reactionType, item.count]),
      [
        ["love", 3],
        ["haha", 2],
        ["wow", 2],
      ]
    );
  });

  it("normalizes participant rows with reaction metadata for the details panel", () => {
    const participants = getCommentReactionParticipants({
      reactions: [
        {
          reactionType: "care",
          user: {
            _id: "user-1",
            fullName: "Nguyen Van A",
            email: "a@example.test",
            avatar: "/avatar-a.png",
          },
        },
        {
          reactionType: "love",
          user: {
            id: "user-2",
            fullName: "Tran Thi B",
          },
        },
      ],
    });

    assert.deepEqual(participants, [
      {
        id: "user-1",
        fullName: "Nguyen Van A",
        email: "a@example.test",
        avatar: "/avatar-a.png",
        reactionType: "care",
        reactionLabel: "Thương thương",
        reactionEmoji: "🤗",
      },
      {
        id: "user-2",
        fullName: "Tran Thi B",
        email: "",
        avatar: "",
        reactionType: "love",
        reactionLabel: "Yêu thích",
        reactionEmoji: "❤️",
      },
    ]);
  });
});
