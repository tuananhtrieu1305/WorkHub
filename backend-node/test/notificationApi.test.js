import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import request from "supertest";
import mongoose from "mongoose";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";

const { default: app } = await import("../src/app.js");
const { default: User } = await import("../src/models/User.js");
const { default: Notification } = await import("../src/models/Notification.js");
const { default: NotificationSettings } = await import("../src/models/NotificationSettings.js");
const { default: Task } = await import("../src/models/Task.js");
const { default: TaskAssignee } = await import("../src/models/TaskAssignee.js");
const { default: ActivityLog } = await import("../src/models/ActivityLog.js");

const originals = {
  userFindById: User.findById,
  userFind: User.find,
  notificationFind: Notification.find,
  notificationCountDocuments: Notification.countDocuments,
  notificationUpdateOne: Notification.updateOne,
  notificationUpdateMany: Notification.updateMany,
  notificationFindOneAndUpdate: Notification.findOneAndUpdate,
  settingsFindOneAndUpdate: NotificationSettings.findOneAndUpdate,
  taskFindById: Task.findById,
  assigneeFindOne: TaskAssignee.findOne,
  assigneeFindOneAndUpdate: TaskAssignee.findOneAndUpdate,
  notificationCreate: Notification.create,
  activityCreate: ActivityLog.create,
};

const userId = new mongoose.Types.ObjectId().toString();
const otherUserId = new mongoose.Types.ObjectId().toString();
const notificationId = new mongoose.Types.ObjectId().toString();
const taskId = new mongoose.Types.ObjectId().toString();
const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);

const auth = (req) => req.set("Authorization", `Bearer ${token}`);

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
  User.findById = () => ({
    select: () => Promise.resolve({ _id: userId, role: "user" }),
  });
});

test.afterEach(() => {
  User.findById = originals.userFindById;
  User.find = originals.userFind;
  Notification.find = originals.notificationFind;
  Notification.countDocuments = originals.notificationCountDocuments;
  Notification.updateOne = originals.notificationUpdateOne;
  Notification.updateMany = originals.notificationUpdateMany;
  Notification.findOneAndUpdate = originals.notificationFindOneAndUpdate;
  NotificationSettings.findOneAndUpdate = originals.settingsFindOneAndUpdate;
  Task.findById = originals.taskFindById;
  TaskAssignee.findOne = originals.assigneeFindOne;
  TaskAssignee.findOneAndUpdate = originals.assigneeFindOneAndUpdate;
  Notification.create = originals.notificationCreate;
  ActivityLog.create = originals.activityCreate;
});

test("GET /api/notifications lists current user's notifications", async () => {
  let query;
  Notification.find = (value) => {
    query = value;
    return makeQuery([makeDoc({ _id: notificationId, userId, readAt: null })]);
  };
  Notification.countDocuments = async () => 1;

  const res = await auth(request(app).get("/api/notifications?unreadOnly=true&type=task_assigned"));

  assert.equal(res.status, 200);
  assert.equal(query.userId, userId);
  assert.equal(query.readAt, null);
  assert.equal(query.type, "task_assigned");
  assert.equal(res.body.totalElements, 1);
});

test("GET /api/notifications/unread-count returns unread count", async () => {
  Notification.countDocuments = async (query) => {
    assert.equal(query.userId, userId);
    assert.equal(query.readAt, null);
    assert.equal(query.deletedAt, null);
    return 3;
  };

  const res = await auth(request(app).get("/api/notifications/unread-count"));

  assert.equal(res.status, 200);
  assert.equal(res.body.unreadCount, 3);
});

test("PATCH /api/notifications/:id/read marks only user's notification read", async () => {
  let query;
  Notification.findOneAndUpdate = async (value, update) => {
    query = value;
    return makeDoc({ _id: notificationId, userId, readAt: update.readAt });
  };

  const res = await auth(request(app).patch(`/api/notifications/${notificationId}/read`));

  assert.equal(res.status, 200);
  assert.equal(query._id, notificationId);
  assert.equal(query.userId, userId);
  assert.ok(res.body.readAt);
});

test("PATCH /api/notifications/read-all marks all current user's notifications read", async () => {
  Notification.updateMany = async (query, update) => {
    assert.equal(query.userId, userId);
    assert.equal(query.readAt, null);
    assert.ok(update.readAt instanceof Date);
    return { modifiedCount: 2 };
  };

  const res = await auth(request(app).patch("/api/notifications/read-all"));

  assert.equal(res.status, 200);
  assert.equal(res.body.modifiedCount, 2);
});

test("DELETE /api/notifications/:id soft deletes only user's notification", async () => {
  let query;
  Notification.updateOne = async (value, update) => {
    query = value;
    assert.ok(update.deletedAt instanceof Date);
    return { modifiedCount: 1 };
  };

  const res = await auth(request(app).delete(`/api/notifications/${notificationId}`));

  assert.equal(res.status, 204);
  assert.equal(query._id, notificationId);
  assert.equal(query.userId, userId);
});

test("GET and PATCH /api/notifications/settings manage settings", async () => {
  const activities = [];
  NotificationSettings.findOneAndUpdate = async (query, update) =>
    makeDoc({
      userId: query.userId,
      inAppEnabled: update.$set?.inAppEnabled ?? update.$setOnInsert?.inAppEnabled,
      emailEnabled: update.$set?.emailEnabled ?? update.$setOnInsert?.emailEnabled,
      pushEnabled: false,
      taskAssigned: true,
      taskUpdated: true,
      taskDueSoon: true,
      documentShared: true,
      documentVersionAdded: true,
      adminActions: true,
    });
  ActivityLog.create = async (payload) => {
    activities.push(payload);
    return makeDoc(payload);
  };

  const get = await auth(request(app).get("/api/notifications/settings"));
  const patch = await auth(request(app).patch("/api/notifications/settings")).send({
    inAppEnabled: false,
    emailEnabled: true,
  });

  assert.equal(get.status, 200);
  assert.equal(patch.status, 200);
  assert.equal(patch.body.inAppEnabled, false);
  assert.equal(activities.length, 1);
  assert.equal(activities[0].action, "notification.settings_updated");
  assert.equal(activities[0].entityType, "notification_settings");
});

test("task assignment creates in-app notification for assignee", async () => {
  const created = [];
  Task.findById = async () =>
    makeDoc({
      _id: taskId,
      title: "Task",
      createdBy: userId,
      ownerId: userId,
      deletedAt: null,
    });
  User.find = async () => [makeDoc({ _id: otherUserId, status: "active" })];
  TaskAssignee.findOne = async () => null;
  TaskAssignee.findOneAndUpdate = async (query) =>
    makeDoc({ taskId: query.taskId, userId: query.userId, removedAt: null });
  NotificationSettings.findOneAndUpdate = async (query) =>
    makeDoc({ userId: query.userId, inAppEnabled: true, taskAssigned: true });
  Notification.create = async (payload) => {
    created.push(payload);
    return makeDoc(payload);
  };
  ActivityLog.create = async (payload) => makeDoc(payload);

  const res = await auth(request(app).post(`/api/tasks/${taskId}/assignees`)).send({
    userIds: [otherUserId],
  });

  assert.equal(res.status, 200);
  assert.equal(created.length, 1);
  assert.equal(created[0].userId, otherUserId);
  assert.equal(created[0].type, "task_assigned");
});

test("user cannot read or delete another user's notification", async () => {
  Notification.findOneAndUpdate = async () => null;
  Notification.updateOne = async () => ({ modifiedCount: 0 });

  const read = await auth(request(app).patch(`/api/notifications/${notificationId}/read`));
  const del = await auth(request(app).delete(`/api/notifications/${notificationId}`));

  assert.equal(read.status, 404);
  assert.equal(del.status, 404);
});
