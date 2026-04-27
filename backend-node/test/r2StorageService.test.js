import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";

import {
  buildR2ObjectKey,
  createR2ClientConfig,
  createR2StorageService,
} from "../src/services/r2StorageService.js";

test("createR2ClientConfig validates required R2 env values and builds Cloudflare endpoint", () => {
  assert.throws(
    () => createR2ClientConfig({}),
    /Missing required R2 environment variables/,
  );

  const config = createR2ClientConfig({
    R2_ACCOUNT_ID: "account-123",
    R2_ACCESS_KEY_ID: "access-key",
    R2_SECRET_ACCESS_KEY: "secret-key",
    R2_BUCKET_NAME: "workhub-documents",
  });

  assert.equal(
    config.endpoint,
    "https://account-123.r2.cloudflarestorage.com",
  );
  assert.equal(config.region, "auto");
  assert.equal(config.bucketName, "workhub-documents");
  assert.equal(config.credentials.accessKeyId, "access-key");
  assert.equal(config.credentials.secretAccessKey, "secret-key");
});

test("buildR2ObjectKey avoids leaking original filenames", () => {
  const key = buildR2ObjectKey({
    documentId: "doc123",
    versionId: "version456",
  });

  assert.equal(key, "documents/doc123/versions/version456/object");
  assert.equal(key.includes(".pdf"), false);
});

test("R2 storage service sends object commands through injected S3 client", async () => {
  const calls = [];
  const client = {
    send: async (command) => {
      calls.push({
        name: command.constructor.name,
        input: command.input,
      });
      if (command.constructor.name === "GetObjectCommand") {
        return {
          Body: Readable.from(["file-body"]),
          ContentLength: 9,
          ContentType: "application/pdf",
        };
      }
      return {};
    },
  };
  const service = createR2StorageService({
    client,
    bucketName: "workhub-documents",
  });

  await service.putObject({
    key: "documents/doc123/versions/ver123/object",
    body: Readable.from(["file-body"]),
    contentType: "application/pdf",
    contentLength: 9,
  });
  const object = await service.getObjectStream({
    key: "documents/doc123/versions/ver123/object",
  });
  await service.headObject({ key: "documents/doc123/versions/ver123/object" });
  await service.deleteObject({ key: "documents/doc123/versions/ver123/object" });

  assert.deepEqual(
    calls.map((call) => call.name),
    ["PutObjectCommand", "GetObjectCommand", "HeadObjectCommand", "DeleteObjectCommand"],
  );
  assert.equal(calls[0].input.Bucket, "workhub-documents");
  assert.equal(calls[0].input.Key, "documents/doc123/versions/ver123/object");
  assert.equal(object.contentLength, 9);
  assert.equal(object.contentType, "application/pdf");
  assert.ok(object.body);
});
