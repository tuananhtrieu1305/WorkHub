import test from "node:test";
import assert from "node:assert/strict";

import Folder from "../src/models/Folder.js";
import Document from "../src/models/Document.js";
import DocumentVersion from "../src/models/DocumentVersion.js";
import DocumentShare from "../src/models/DocumentShare.js";

const hasIndex = (model, fields, options = {}) => {
  return model.schema.indexes().some(([indexFields, indexOptions]) => {
    const fieldsMatch = JSON.stringify(indexFields) === JSON.stringify(fields);
    const optionsMatch = Object.entries(options).every(
      ([key, value]) => indexOptions[key] === value,
    );
    return fieldsMatch && optionsMatch;
  });
};

test("Folder model defines hierarchy, permission fields, and planned indexes", () => {
  assert.ok(Folder.schema.path("name"));
  assert.ok(Folder.schema.path("parentId"));
  assert.ok(Folder.schema.path("departmentId"));
  assert.ok(Folder.schema.path("ownerId"));
  assert.ok(Folder.schema.path("permissions.visibility"));

  assert.ok(
    hasIndex(Folder, { parentId: 1, departmentId: 1, deletedAt: 1 }),
  );
  assert.ok(hasIndex(Folder, { ownerId: 1 }));
});

test("Document model tracks upload state, idempotency, version counter, and indexes", () => {
  const statusPath = Document.schema.path("status");

  assert.deepEqual(statusPath.enumValues, [
    "uploading",
    "pending_scan",
    "active",
    "failed",
    "deleted",
  ]);
  assert.equal(Document.schema.path("versionCounter").defaultValue, 0);
  assert.ok(Document.schema.path("uploadSessionId"));
  assert.ok(Document.schema.path("idempotencyKey"));

  assert.ok(hasIndex(Document, { folderId: 1, status: 1, deletedAt: 1 }));
  assert.ok(hasIndex(Document, { departmentId: 1, status: 1 }));
  assert.ok(hasIndex(Document, { ownerId: 1 }));
  assert.ok(hasIndex(Document, { currentVersionId: 1 }));
  assert.ok(hasIndex(Document, { createdBy: 1, idempotencyKey: 1 }, { unique: true }));
});

test("DocumentVersion model stores R2 metadata and prevents duplicate version numbers", () => {
  assert.equal(DocumentVersion.schema.path("storageProvider").defaultValue, "r2");
  assert.ok(DocumentVersion.schema.path("storageKey"));
  assert.ok(DocumentVersion.schema.path("checksum"));
  assert.ok(DocumentVersion.schema.path("scanStatus"));

  assert.ok(
    hasIndex(
      DocumentVersion,
      { documentId: 1, versionNumber: 1 },
      { unique: true },
    ),
  );
  assert.ok(hasIndex(DocumentVersion, { documentId: 1, createdAt: -1 }));
});

test("DocumentShare model stores hashed tokens and fixed-version shares by default", () => {
  assert.ok(DocumentShare.schema.path("tokenHash"));
  assert.equal(DocumentShare.schema.path("mode").defaultValue, "fixed_version");
  assert.equal(DocumentShare.schema.path("downloadCount").defaultValue, 0);

  assert.ok(hasIndex(DocumentShare, { tokenHash: 1 }, { unique: true }));
  assert.ok(hasIndex(DocumentShare, { documentId: 1, revokedAt: 1 }));
  assert.ok(hasIndex(DocumentShare, { expiresAt: 1 }));
});
