import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));

const readChatInputSource = () =>
  readFile(join(__dirname, "ChatInput.jsx"), "utf8");

describe("ChatInput composer layout contracts", () => {
  it("uses the shared emoji picker inside the message field", async () => {
    const source = await readChatInputSource();

    assert.match(source, /EmojiPickerButton/);
    assert.match(
      source,
      /className="chat-composer-input-shell[\s\S]*<textarea[\s\S]*\/>\s*<EmojiPickerButton/
    );
  });

  it("keeps composer actions above the message field and removes the legacy bottom row", async () => {
    const source = await readChatInputSource();

    for (const label of [
      "Đính kèm file",
      "Chọn nhãn dán",
      "Chọn file GIF",
      "Gửi danh thiếp",
      "Gửi voice",
      "Định dạng tin nhắn",
    ]) {
      assert.match(source, new RegExp(label));
    }

    assert.doesNotMatch(source, /add_circle/);
    assert.doesNotMatch(source, /alternate_email/);
    assert.doesNotMatch(source, /sendLabel/);
  });

  it("shows formatting controls in a third row below the message field", async () => {
    const source = await readChatInputSource();

    assert.match(source, /showFormattingToolbar/);
    assert.match(source, /chat-format-panel/);
    assert.match(source, /Nhấn Ctrl \+ Shift \+ X để định dạng tin nhắn/);
    assert.match(
      source,
      /<textarea[\s\S]*<EmojiPickerButton[\s\S]*{showFormattingToolbar && \([\s\S]*chat-format-panel/
    );
  });
});
