import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getMessagePreviewText } from "./chatMessagePreview.js";

describe("chatMessagePreview", () => {
  it("normalizes text message previews onto one line", () => {
    assert.equal(
      getMessagePreviewText({
        content: "  Không cần viết\nexception    nhỉ  ",
      }),
      "Không cần viết exception nhỉ",
    );
  });

  it("uses media labels instead of the empty fallback", () => {
    assert.equal(
      getMessagePreviewText({
        attachments: [{ kind: "image", mimeType: "", fileName: "photo.png" }],
      }),
      "Ảnh",
    );
    assert.equal(
      getMessagePreviewText({
        attachments: [{ kind: "video", mimeType: "", fileName: "clip.mp4" }],
      }),
      "Video",
    );
  });

  it("does not default reply previews to dots", () => {
    assert.equal(getMessagePreviewText({ id: "missing-content" }), "Tin nhắn");
    assert.equal(
      getMessagePreviewText({ id: "missing-content" }, { emptyText: "" }),
      "",
    );
  });
});
