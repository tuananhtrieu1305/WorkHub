import assert from "node:assert/strict";
import test from "node:test";
import { getMessagePreviewText } from "./chatMessagePreview.js";

test("contact messages render a contact card preview", () => {
  assert.equal(
    getMessagePreviewText({
      type: "contact",
      content: "Nguyen Van A",
      contact: {
        fullName: "Nguyen Van A",
      },
    }),
    "Danh thiếp: Nguyen Van A",
  );
});

