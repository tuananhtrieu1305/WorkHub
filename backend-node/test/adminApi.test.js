import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import request from "supertest";
import mongoose from "mongoose";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";

const { default: app } = await import("../src/app.js");
const { default: User } = await import("../src/models/User.js");
const { default: ActivityLog } = await import("../src/models/ActivityLog.js");
const { default: Task } = await import("../src/models/Task.js");
const { default: Notification } = await import("../src/models/Notification.js");
const { default: NotificationSettings } = await import("../src/models/NotificationSettings.js");

const originals = {
  userFindById: User.findById,
  userFindByIdAndUpdate: User.findByIdAndUpdate,
  userCountDocuments: User.countDocuments,
  userAggregate: User.aggregate,
  activityFind: ActivityLog.find,
  activityCountDocuments: ActivityLog.countDocuments,
  activityCreate: ActivityLog.create,
  taskCountDocuments: Task.countDocuments,
  notificationCreate: Notification.create,
  settingsFindOneAndUpdate: NotificationSettings.findOneAndUpdate,
};

const adminId = new mongoose.Types.ObjectId().toString();
const userId = new mongoose.Types.ObjectId().toString();
const activityId = new mongoose.Types.ObjectId().toString();
const adminToken = jwt.sign({ id: adminId }, process.env.JWT_SECRET);
const userToken = jwt.sign({ id: userId }, process.env.JWT_SECRET);

const auth = (token, req) => req.set("Authorization", `Bearer ${token}`);

const makeDoc = (data) => ({
  ...data,
  toObject() {
    return { ...data };
  },
});

const makeQuery = (value) => ({
  sortValue: null,
  skipValue: null,
  limitValue: null,
  sort(valueArg) {
    this.sortValue = valueArg;
    return this;
  },
  skip(valueArg) {
    this.skipValue = valueArg;
    return this;
  },
  limit(valueArg) {
    this.limitValue = valueArg;
    return Promise.resolve(value);
  },
});

test.beforeEach(() => {
  User.findById = (id) => ({
    select: () =>
      Promise.resolve({
        _id: id,
        role: id.toString() === adminId ? "admin" : "user",
        status: "active",
        email: "user@example.com",
        fullName: "Test User",
      }),
  });
  ActivityLog.create = async (payload) => makeDoc({ _id: activityId, ...payload });
  Notification.create = async (payload) => makeDoc(payload);
  NotificationSettings.findOneAndUpdate = async (query) =>
    makeDoc({ userId: query.userId, inAppEnabled: true, adminActions: true });
});

test.afterEach(() => {
  User.findById = originals.userFindById;
  User.findByIdAndUpdate = originals.userFindByIdAndUpdate;
  User.countDocuments = originals.userCountDocuments;
  User.aggregate = originals.userAggregate;
  ActivityLog.find = originals.activityFind;
  ActivityLog.countDocuments = originals.activityCountDocuments;
  ActivityLog.create = originals.activityCreate;
  Task.countDocuments = originals.taskCountDocuments;
  Notification.create = originals.notificationCreate;
  NotificationSettings.findOneAndUpdate = originals.settingsFindOneAndUpdate;
});

test("non-admin is blocked from admin endpoints", async () => {
  const res = await auth(userToken, request(app).get("/api/admin/dashboard"));

  assert.equal(res.status, 403);
});

test("admin can list activity logs with filters", async () => {
  let query;
  let mongoQuery;
  ActivityLog.find = (value) => {
    query = value;
    mongoQuery = makeQuery([makeDoc({ _id: activityId, action: "task.created" })]);
    return mongoQuery;
  };
  ActivityLog.countDocuments = async () => 1;

  const entityId = new mongoose.Types.ObjectId().toString();
  const res = await auth(
    adminToken,
    request(app).get(
      `/api/admin/activity-logs?action=task.created&actorId=${userId}&entityId=${entityId}&limit=5`,
    ),
  );

  assert.equal(res.status, 200);
  assert.equal(query.action, "task.created");
  assert.equal(query.actorId, userId);
  assert.equal(query.entityId, entityId);
  assert.equal(mongoQuery.limitValue, 5);
  assert.equal(res.body.totalElements, 1);
});

test("admin can lock user", async () => {
  let updatePayload;
  User.findByIdAndUpdate = async (id, update) => {
    updatePayload = update;
    return makeDoc({ _id: id, status: "locked", email: "user@example.com" });
  };

  const res = await auth(adminToken, request(app).patch(`/api/admin/users/${userId}/lock`)).send({
    reason: "Policy violation",
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.status, "locked");
  assert.equal(updatePayload.status, "locked");
  assert.equal(updatePayload.lockReason, "Policy violation");
});

test("admin can unlock user", async () => {
  let updatePayload;
  User.findByIdAndUpdate = async (id, update) => {
    updatePayload = update;
    return makeDoc({ _id: id, status: "active", email: "user@example.com" });
  };

  const res = await auth(adminToken, request(app).patch(`/api/admin/users/${userId}/unlock`));

  assert.equal(res.status, 200);
  assert.equal(res.body.status, "active");
  assert.equal(updatePayload.status, "active");
  assert.equal(updatePayload.lockedAt, null);
});

test("admin reset password uses safe placeholder", async () => {
  const res = await auth(adminToken, request(app).post(`/api/admin/users/${userId}/reset-password`));

  assert.equal(res.status, 501);
  assert.match(res.body.message, /not enabled/i);
});

test("admin dashboard returns stats", async () => {
  User.countDocuments = async (query = {}) => {
    if (query.status === "active") return 7;
    if (query.status === "locked") return 2;
    return 10;
  };
  Task.countDocuments = async (query = {}) => {
    if (query.status === "done") return 4;
    if (query.endAt?.$lt) return 3;
    if (query.status?.$ne === "done") return 6;
    return 0;
  };

  const res = await auth(adminToken, request(app).get("/api/admin/dashboard"));

  assert.equal(res.status, 200);
  assert.equal(res.body.totalUsers, 10);
  assert.equal(res.body.activeUsers, 7);
  assert.equal(res.body.lockedUsers, 2);
  assert.equal(res.body.openTasks, 6);
  assert.equal(res.body.completedTasks, 4);
  assert.equal(res.body.overdueTasks, 3);
});

test("admin analytics returns grouped user creation data", async () => {
  User.aggregate = async (pipeline) => {
    assert.ok(Array.isArray(pipeline));
    return [
      { _id: "2026-04-01", count: 2 },
      { _id: "2026-04-02", count: 1 },
    ];
  };

  const res = await auth(
    adminToken,
    request(app).get("/api/admin/analytics/users?granularity=day&from=2026-04-01&to=2026-04-30"),
  );

  assert.equal(res.status, 200);
  assert.deepEqual(res.body.labels, ["2026-04-01", "2026-04-02"]);
  assert.deepEqual(res.body.data, [2, 1]);
});
