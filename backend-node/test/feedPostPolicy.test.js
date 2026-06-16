import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizePostActivity,
  serializePostActivity,
} from "../src/presenters/postPresenter.js";

test("normalizes valid post feeling metadata", () => {
  assert.deepEqual(
    normalizePostActivity({
      type: "feeling",
      emoji: "😀",
      label: "  Vui   vẻ  ",
    }),
    {
      type: "feeling",
      emoji: "😀",
      label: "Vui vẻ",
    },
  );
});

test("normalizes valid post activity metadata", () => {
  assert.deepEqual(
    serializePostActivity({
      type: "activity",
      emoji: "📚",
      label: "Đang học",
    }),
    {
      type: "activity",
      emoji: "📚",
      label: "Đang học",
    },
  );
});

test("rejects empty or unsupported post activity metadata", () => {
  assert.equal(normalizePostActivity(null), null);
  assert.equal(normalizePostActivity({ type: "mood", label: "Vui vẻ" }), null);
  assert.equal(normalizePostActivity({ type: "feeling", label: "" }), null);
});
