import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
  POST_ATTACHMENT_FILE_SIZE_LIMIT,
  postAttachmentFileFilter,
} from "../src/config/multer.js";
import Post from "../src/models/Post.js";
import {
  buildPostAttachments,
  hasPostBody,
} from "../src/presenters/postPresenter.js";

const runAttachmentFilter = (file) =>
  new Promise((resolve, reject) => {
    postAttachmentFileFilter({}, file, (error, accepted) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(accepted);
    });
  });

test("Post model permits attachment-only posts and stores download metadata", () => {
  const post = new Post({
    authorId: new mongoose.Types.ObjectId(),
    attachments: [
      {
        fileName: "report.pdf",
        storedFileName: "report-123.pdf",
        fileUrl: "/uploads/attachments/report-123.pdf",
        downloadUrl: "/uploads/attachments/report-123.pdf",
        fileSize: 2048,
        mimeType: "application/pdf",
        fileType: "file",
      },
    ],
  });

  const error = post.validateSync();

  assert.equal(error?.errors?.content, undefined);
  assert.equal(post.content, "");
  assert.ok(Post.schema.path("attachments.storedFileName"));
  assert.ok(Post.schema.path("attachments.downloadUrl"));
  assert.ok(Post.schema.path("attachments.fileType"));
});

test("buildPostAttachments maps uploaded files to preview and download metadata", () => {
  const attachments = buildPostAttachments([
    {
      originalname: "clip.mp4",
      filename: "clip-123.mp4",
      size: 4096,
      mimetype: "video/mp4",
    },
  ]);

  assert.deepEqual(attachments, [
      {
        fileName: "clip.mp4",
        storedFileName: "clip-123.mp4",
        fileUrl: "/uploads/attachments/clip-123.mp4",
        downloadUrl: "/api/posts/attachments/clip-123.mp4/download?name=clip.mp4",
        fileSize: 4096,
        mimeType: "video/mp4",
        fileType: "video",
    },
  ]);
});

test("hasPostBody accepts text or attachments and rejects empty posts", () => {
  assert.equal(hasPostBody("hello", []), true);
  assert.equal(hasPostBody("   ", [{ fileName: "report.pdf" }]), true);
  assert.equal(hasPostBody("", []), false);
  assert.equal(hasPostBody(undefined, []), false);
});

test("post attachment upload accepts videos and generic files", async () => {
  await assert.doesNotReject(() =>
    runAttachmentFilter({ mimetype: "video/mp4" })
  );
  await assert.doesNotReject(() =>
    runAttachmentFilter({ mimetype: "application/pdf" })
  );
});

test("post attachment upload limit is large enough for common video posts", () => {
  assert.ok(POST_ATTACHMENT_FILE_SIZE_LIMIT >= 100 * 1024 * 1024);
});
