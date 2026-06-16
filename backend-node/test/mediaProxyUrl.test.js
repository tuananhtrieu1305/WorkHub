import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAttachmentDownloadUrl,
  serializePostAttachments,
} from "../src/presenters/postPresenter.js";
import {
  buildConversationAvatarProxyUrl,
  buildConversationAttachmentDownloadUrl,
  serializeConversationAttachments,
} from "../src/presenters/conversationPresenter.js";
import { buildR2ConversationAvatarKey } from "../src/services/r2StorageService.js";

process.env.R2_BUCKET_NAME = "workhub-private";

test("post R2 attachments are serialized through the API media proxy", () => {
  const storageKey = "attachments/posts/1778422797226-image.png";
  const [attachment] = serializePostAttachments([
    {
      fileName: "image.png",
      storedFileName: storageKey,
      fileUrl:
        "https://account-id.r2.cloudflarestorage.com/workhub-private/attachments/posts/1778422797226-image.png",
      downloadUrl:
        "https://account-id.r2.cloudflarestorage.com/workhub-private/attachments/posts/1778422797226-image.png",
      mimeType: "image/png",
    },
  ]);

  assert.equal(
    attachment.fileUrl,
    buildAttachmentDownloadUrl(storageKey, "image.png", {
      disposition: "inline",
    }),
  );
  assert.equal(
    attachment.downloadUrl,
    buildAttachmentDownloadUrl(storageKey, "image.png"),
  );
  assert.equal(attachment.fileUrl.includes("r2.cloudflarestorage.com"), false);
  assert.equal(attachment.downloadUrl.includes("r2.cloudflarestorage.com"), false);
});

test("conversation R2 attachments are serialized through the protected API media proxy", () => {
  const conversationId = "conversation-1";
  const storageKey = "attachments/conversations/conversation-1/voice.webm";
  const [attachment] = serializeConversationAttachments(conversationId, [
    {
      fileName: "voice.webm",
      fileUrl:
        "https://account-id.r2.cloudflarestorage.com/workhub-private/attachments/conversations/conversation-1/voice.webm",
      mimeType: "audio/webm",
    },
  ]);

  assert.equal(
    attachment.fileUrl,
    buildConversationAttachmentDownloadUrl(
      conversationId,
      storageKey,
      "voice.webm",
    ),
  );
  assert.equal(attachment.storageKey, storageKey);
  assert.equal(attachment.fileUrl.includes("r2.cloudflarestorage.com"), false);
});

test("conversation avatars use the public avatar proxy instead of protected attachment downloads", () => {
  const storageKey = buildR2ConversationAvatarKey("conversation-1", "team.png");
  const avatarUrl = buildConversationAvatarProxyUrl(storageKey);

  assert.equal(storageKey.startsWith("avatars/conversations/conversation-1/"), true);
  assert.equal(avatarUrl.startsWith("/api/users/avatars?"), true);
  assert.equal(avatarUrl.includes("/attachments/download"), false);
  assert.equal(avatarUrl.includes(encodeURIComponent(storageKey)), true);
});
