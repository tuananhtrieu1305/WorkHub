import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";

process.env.NODE_ENV = "test";

const { default: app } = await import("../src/app.js");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const attachmentUploadsDir = path.resolve(
  __dirname,
  "../src/uploads/attachments"
);

test("static upload route serves files from the post attachment upload directory", async (t) => {
  const fileName = `static-regression-${Date.now()}.txt`;
  const filePath = path.join(attachmentUploadsDir, fileName);

  await fs.mkdir(attachmentUploadsDir, { recursive: true });
  await fs.writeFile(filePath, "static attachment response", "utf8");
  t.after(() => fs.rm(filePath, { force: true }));

  const response = await request(app)
    .get(`/uploads/attachments/${fileName}`)
    .expect(200);

  assert.equal(response.text, "static attachment response");
});
