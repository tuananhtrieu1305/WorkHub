import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import ActivityLog from "../src/models/ActivityLog.js";
import {
  listByEntity,
  listForAdmin,
  logActivity,
  redactSensitiveMetadata,
} from "../src/services/activityLogService.js";

const hasIndex = (model, fields) => {
  return model.schema.indexes().some(([indexFields]) => {
    return JSON.stringify(indexFields) === JSON.stringify(fields);
  });
};

const originals = {
  create: ActivityLog.create,
  find: ActivityLog.find,
  countDocuments: ActivityLog.countDocuments,
};

const makeQuery = (content) => ({
  sortValue: null,
  skipValue: null,
  limitValue: null,
  sort(value) {
    this.sortValue = value;
    return this;
  },
  skip(value) {
    this.skipValue = value;
    return this;
  },
  limit(value) {
    this.limitValue = value;
    return Promise.resolve(content);
  },
});

test.afterEach(() => {
  ActivityLog.create = originals.create;
  ActivityLog.find = originals.find;
  ActivityLog.countDocuments = originals.countDocuments;
});

test("ActivityLog model defines required fields and query indexes", () => {
  assert.ok(ActivityLog.schema.path("actorId"));
  assert.deepEqual(ActivityLog.schema.path("actorType").enumValues, [
    "user",
    "system",
  ]);
  assert.ok(ActivityLog.schema.path("action"));
  assert.ok(ActivityLog.schema.path("entityType"));
  assert.ok(ActivityLog.schema.path("entityId"));
  assert.ok(ActivityLog.schema.path("projectId"));
  assert.ok(ActivityLog.schema.path("departmentId"));
  assert.ok(ActivityLog.schema.path("targetUserId"));
  assert.ok(ActivityLog.schema.path("metadata"));
  assert.ok(ActivityLog.schema.path("ipAddress"));
  assert.ok(ActivityLog.schema.path("userAgent"));
  assert.ok(ActivityLog.schema.path("createdAt"));

  assert.ok(hasIndex(ActivityLog, { entityType: 1, entityId: 1, createdAt: -1 }));
  assert.ok(hasIndex(ActivityLog, { actorId: 1, createdAt: -1 }));
  assert.ok(hasIndex(ActivityLog, { targetUserId: 1, createdAt: -1 }));
  assert.ok(hasIndex(ActivityLog, { projectId: 1, createdAt: -1 }));
  assert.ok(hasIndex(ActivityLog, { departmentId: 1, createdAt: -1 }));
  assert.ok(hasIndex(ActivityLog, { action: 1, createdAt: -1 }));
});

test("logActivity creates an activity log with redacted metadata", async () => {
  let createdPayload;
  ActivityLog.create = async (payload) => {
    createdPayload = payload;
    return payload;
  };

  const actorId = new mongoose.Types.ObjectId();
  const entityId = new mongoose.Types.ObjectId();

  await logActivity({
    actorId,
    actorType: "user",
    action: "task.created",
    entityType: "task",
    entityId,
    metadata: {
      title: "Prepare report",
      password: "secret",
      nested: {
        jwt: "header.payload.signature",
        rawShareToken: "share-token",
      },
    },
    ipAddress: "127.0.0.1",
    userAgent: "test-agent",
  });

  assert.equal(createdPayload.action, "task.created");
  assert.equal(createdPayload.metadata.title, "Prepare report");
  assert.equal(createdPayload.metadata.password, "[REDACTED]");
  assert.equal(createdPayload.metadata.nested.jwt, "[REDACTED]");
  assert.equal(createdPayload.metadata.nested.rawShareToken, "[REDACTED]");
});

test("listByEntity filters and paginates activity logs for one entity", async () => {
  let findQuery;
  let query;
  ActivityLog.find = (value) => {
    findQuery = value;
    query = makeQuery([{ action: "task.updated" }]);
    return query;
  };
  ActivityLog.countDocuments = async (value) => {
    assert.deepEqual(value, findQuery);
    return 1;
  };

  const entityId = new mongoose.Types.ObjectId().toString();
  const result = await listByEntity("task", entityId, {
    action: "task.updated",
    page: 2,
    size: 10,
  });

  assert.equal(findQuery.entityType, "task");
  assert.equal(findQuery.entityId, entityId);
  assert.equal(findQuery.action, "task.updated");
  assert.deepEqual(query.sortValue, { createdAt: -1 });
  assert.equal(query.skipValue, 10);
  assert.equal(query.limitValue, 10);
  assert.equal(result.totalElements, 1);
});

test("listForAdmin applies audit filters", async () => {
  let findQuery;
  let query;
  ActivityLog.find = (value) => {
    findQuery = value;
    query = makeQuery([]);
    return query;
  };
  ActivityLog.countDocuments = async () => 0;

  const actorId = new mongoose.Types.ObjectId().toString();
  const entityId = new mongoose.Types.ObjectId().toString();
  const projectId = new mongoose.Types.ObjectId().toString();
  const fromDate = "2026-04-01T00:00:00.000Z";
  const toDate = "2026-04-30T23:59:59.999Z";

  const result = await listForAdmin({
    actorId,
    entityId,
    projectId,
    action: "admin.user.locked",
    fromDate,
    toDate,
    limit: 7,
  });

  assert.equal(findQuery.actorId, actorId);
  assert.equal(findQuery.entityId, entityId);
  assert.equal(findQuery.projectId, projectId);
  assert.equal(findQuery.action, "admin.user.locked");
  assert.ok(findQuery.createdAt.$gte instanceof Date);
  assert.ok(findQuery.createdAt.$lte instanceof Date);
  assert.equal(query.limitValue, 7);
  assert.deepEqual(result.content, []);
});

test("listForAdmin rejects invalid date filters", async () => {
  await assert.rejects(
    () => listForAdmin({ fromDate: "not-a-date" }),
    /Invalid from date/,
  );
});

test("redactSensitiveMetadata removes secrets, tokens, auth headers, and file contents", () => {
  const metadata = redactSensitiveMetadata({
    ok: true,
    accessToken: "token",
    Authorization: "Bearer abc",
    fileContents: "raw-bytes",
    nested: {
      apiSecret: "secret",
      value: "kept",
    },
  });

  assert.equal(metadata.ok, true);
  assert.equal(metadata.accessToken, "[REDACTED]");
  assert.equal(metadata.Authorization, "[REDACTED]");
  assert.equal(metadata.fileContents, "[REDACTED]");
  assert.equal(metadata.nested.apiSecret, "[REDACTED]");
  assert.equal(metadata.nested.value, "kept");
});
