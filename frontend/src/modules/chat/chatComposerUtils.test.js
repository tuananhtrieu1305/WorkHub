import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyComposerFormat } from "./chatComposerUtils.js";

describe("chat composer formatting helpers", () => {
  it("wraps selected text with markdown markers", () => {
    assert.deepEqual(
      applyComposerFormat({
        text: "hello world",
        selectionStart: 6,
        selectionEnd: 11,
        action: "bold",
      }),
      {
        text: "hello **world**",
        selectionStart: 8,
        selectionEnd: 13,
      },
    );
  });

  it("uses renderable markdown for italic selections", () => {
    assert.deepEqual(
      applyComposerFormat({
        text: "hello world",
        selectionStart: 6,
        selectionEnd: 11,
        action: "italic",
      }),
      {
        text: "hello *world*",
        selectionStart: 7,
        selectionEnd: 12,
      },
    );
  });

  it("wraps selected text with underline tags", () => {
    assert.deepEqual(
      applyComposerFormat({
        text: "hello world",
        selectionStart: 6,
        selectionEnd: 11,
        action: "underline",
      }),
      {
        text: "hello <u>world</u>",
        selectionStart: 9,
        selectionEnd: 14,
      },
    );
  });

  it("inserts useful snippets when no text is selected", () => {
    assert.deepEqual(
      applyComposerFormat({
        text: "Check ",
        selectionStart: 6,
        selectionEnd: 6,
        action: "link",
      }),
      {
        text: "Check [liên kết](https://)",
        selectionStart: 7,
        selectionEnd: 15,
      },
    );
  });

  it("prefixes selected lines as a bullet list", () => {
    assert.deepEqual(
      applyComposerFormat({
        text: "one\ntwo",
        selectionStart: 0,
        selectionEnd: 7,
        action: "list",
      }).text,
      "- one\n- two",
    );
  });

  it("prefixes selected lines as a numbered list", () => {
    assert.equal(
      applyComposerFormat({
        text: "one\ntwo",
        selectionStart: 0,
        selectionEnd: 7,
        action: "orderedList",
      }).text,
      "1. one\n2. two",
    );
  });
});
