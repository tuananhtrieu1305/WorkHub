import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appendEmojiToText, getNativeEmoji } from "./emojiText.js";

describe("emoji text helpers", () => {
  it("appends a native emoji to existing text with spacing", () => {
    assert.equal(appendEmojiToText("Hello", "😀"), "Hello 😀");
  });

  it("uses the first skin native value returned by emoji-mart", () => {
    assert.equal(
      getNativeEmoji({
        skins: [{ native: "🎉" }],
      }),
      "🎉"
    );
  });

  it("falls back to the native field when skins are unavailable", () => {
    assert.equal(getNativeEmoji({ native: "💬" }), "💬");
  });
});
