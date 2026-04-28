import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("EmojiPickerButton integration contracts", () => {
  it("lets absolute positioning override the root default", async () => {
    const css = await readFile(
      join(__dirname, "EmojiPickerButton.css"),
      "utf8"
    );

    assert.match(
      css,
      /\.workhub-emoji-picker-root\.absolute\s*{[^}]*position:\s*absolute;/s
    );
  });

  it("keeps outside-click closing in React instead of emoji-mart", async () => {
    const source = await readFile(
      join(__dirname, "EmojiPickerButton.jsx"),
      "utf8"
    );

    assert.doesNotMatch(source, /onClickOutside\s*:/);
    assert.match(source, /document\.addEventListener\("mousedown"/);
  });

  it("shows the colored emoji trigger circle only on hover or open state", async () => {
    const css = await readFile(
      join(__dirname, "EmojiPickerButton.css"),
      "utf8"
    );

    assert.match(
      css,
      /\.workhub-emoji-trigger\s*{[^}]*background:\s*transparent;/s
    );
    assert.match(
      css,
      /\.workhub-emoji-trigger:hover,\s*\.workhub-emoji-trigger\[data-open="true"\]\s*{[^}]*background:\s*#fce7f3;/s
    );
  });
});
