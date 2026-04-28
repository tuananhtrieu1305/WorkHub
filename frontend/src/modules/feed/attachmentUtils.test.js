import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatFileSize,
  getAttachmentDownloadUrl,
  getAttachmentIcon,
  getAttachmentType,
  getAttachmentUrl,
  isPreviewableMedia,
} from "./attachmentUtils.js";

describe("feed attachment utilities", () => {
  it("classifies image, video, and generic file attachments", () => {
    assert.equal(getAttachmentType({ mimeType: "image/png" }), "image");
    assert.equal(getAttachmentType({ mimeType: "video/mp4" }), "video");
    assert.equal(getAttachmentType({ mimeType: "application/pdf" }), "file");
    assert.equal(getAttachmentType({ fileName: "report.jpg" }), "image");
    assert.equal(getAttachmentType({ fileName: "demo.webm" }), "video");
  });

  it("builds absolute preview and download URLs from relative upload paths", () => {
    const attachment = {
      fileName: "report.pdf",
      fileUrl: "/uploads/attachments/report-1.pdf",
      downloadUrl: "/api/posts/attachments/report-1.pdf/download?name=report.pdf",
    };

    assert.equal(
      getAttachmentUrl(attachment, "https://api.workhub.test"),
      "https://api.workhub.test/uploads/attachments/report-1.pdf"
    );
    assert.equal(
      getAttachmentDownloadUrl(attachment, "https://api.workhub.test"),
      "https://api.workhub.test/api/posts/attachments/report-1.pdf/download?name=report.pdf"
    );
  });

  it("formats file sizes and picks useful material icons", () => {
    assert.equal(formatFileSize(0), "");
    assert.equal(formatFileSize(512), "512 B");
    assert.equal(formatFileSize(1536), "1.5 KB");
    assert.equal(formatFileSize(2 * 1024 * 1024), "2.0 MB");

    assert.equal(getAttachmentIcon({ mimeType: "application/pdf" }), "picture_as_pdf");
    assert.equal(getAttachmentIcon({ fileName: "budget.xlsx" }), "table_chart");
    assert.equal(getAttachmentIcon({ fileName: "archive.zip" }), "folder_zip");
  });

  it("marks only image and video attachments as media previews", () => {
    assert.equal(isPreviewableMedia({ mimeType: "image/webp" }), true);
    assert.equal(isPreviewableMedia({ mimeType: "video/webm" }), true);
    assert.equal(isPreviewableMedia({ mimeType: "application/zip" }), false);
  });
});
