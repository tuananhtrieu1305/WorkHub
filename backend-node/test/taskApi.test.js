import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import request from "supertest";
import mongoose from "mongoose";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";

const { default: app } = await import("../src/app.js");
const { default: User } = await import("../src/models/User.js");
const { default: Task } = await import("../src/models/Task.js");
const { default: TaskAssignee } = await import("../src/models/TaskAssignee.js");
const { default: ChecklistItem } = await import("../src/models/ChecklistItem.js");
const { default: ActivityLog } = await import("../src/models/ActivityLog.js");
const { default: Notification } = await import("../src/models/Notification.js");
const { default: NotificationSettings } = await import("../src/models/NotificationSettings.js");

const originals = {
  userFindById: User.findById,
  userFind: User.find,
  taskCreate: Task.create,
  taskFind: Task.find,
  taskFindById: Task.findById,
  taskFindByIdAndUpdate: Task.findByIdAndUpdate,
  taskCountDocuments: Task.countDocuments,
  assigneeCreate: TaskAssignee.create,
  assigneeFind: TaskAssignee.find,
  assigneeFindOne: TaskAssignee.findOne,
  assigneeFindOneAndUpdate: TaskAssignee.findOneAndUpdate,
  assigneeUpdateOne: TaskAssignee.updateOne,
  checklistCreate: ChecklistItem.create,
  checklistFind: ChecklistItem.find,
  checklistFindById: ChecklistItem.findById,
  checklistFindByIdAndUpdate: ChecklistItem.findByIdAndUpdate,
  checklistDeleteOne: ChecklistItem.deleteOne,
  activityCreate: ActivityLog.create,
  activityFind: ActivityLog.find,
  activityCountDocuments: ActivityLog.countDocuments,
  notificationCreate: Notification.create,
  settingsFindOneAndUpdate: NotificationSettings.findOneAndUpdate,
};

const userId = new mongoose.Types.ObjectId().toString();
const otherUserId = new mongoose.Types.ObjectId().toString();
const taskId = new mongoose.Types.ObjectId().toString();
const projectId = new mongoose.Types.ObjectId().toString();
const departmentId = new mongoose.Types.ObjectId().toString();
const checklistId = new mongoose.Types.ObjectId().toString();
const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);

const auth = (req) => req.set("Authorization", `Bearer ${token}`);

const makeDoc = (data) => ({
  ...data,
  toObject() {
    return { ...data };
  },
});

const makeQuery = (value) => ({
  sort() {
    return this;
  },
  skip() {
    return this;
  },
  limit() {
    return Promise.resolve(value);
  },
});

const makeSortQuery = (value) => ({
  sort() {
    return Promise.resolve(value);
  },
});

const baseTask = (overrides = {}) =>
  makeDoc({
    _id: taskId,
    title: "Prepare report",
    description: "",
    projectId: null,
    departmentId,
    createdBy: userId,
    ownerId: userId,
    status: "todo",
    priority: "medium",
    deletedAt: null,
    ...overrides,
  });

test.beforeEach(() => {
  User.findById = () => ({
    select: () =>
      Promise.resolve({
        _id: userId,
        role: "user",
        departmentId,
      }),
  });

  TaskAssignee.findOne = async () => null;
  TaskAssignee.find = () => makeSortQuery([]);
  ChecklistItem.find = () => makeSortQuery([]);
  ActivityLog.find = () => makeQuery([]);
  ActivityLog.countDocuments = async () => 0;
  ActivityLog.create = async (payload) => makeDoc({ _id: new mongoose.Types.ObjectId(), ...payload });
  NotificationSettings.findOneAndUpdate = async (query) =>
    makeDoc({ userId: query.userId, inAppEnabled: false });
  Notification.create = async (payload) => makeDoc(payload);
});

test.afterEach(() => {
  User.findById = originals.userFindById;
  User.find = originals.userFind;
  Task.create = originals.taskCreate;
  Task.find = originals.taskFind;
  Task.findById = originals.taskFindById;
  Task.findByIdAndUpdate = originals.taskFindByIdAndUpdate;
  Task.countDocuments = originals.taskCountDocuments;
  TaskAssignee.create = originals.assigneeCreate;
  TaskAssignee.find = originals.assigneeFind;
  TaskAssignee.findOne = originals.assigneeFindOne;
  TaskAssignee.findOneAndUpdate = originals.assigneeFindOneAndUpdate;
  TaskAssignee.updateOne = originals.assigneeUpdateOne;
  ChecklistItem.create = originals.checklistCreate;
  ChecklistItem.find = originals.checklistFind;
  ChecklistItem.findById = originals.checklistFindById;
  ChecklistItem.findByIdAndUpdate = originals.checklistFindByIdAndUpdate;
  ChecklistItem.deleteOne = originals.checklistDeleteOne;
  ActivityLog.create = originals.activityCreate;
  ActivityLog.find = originals.activityFind;
  ActivityLog.countDocuments = originals.activityCountDocuments;
  Notification.create = originals.notificationCreate;
  NotificationSettings.findOneAndUpdate = originals.settingsFindOneAndUpdate;
});

test("POST /api/tasks creates a standalone task", async () => {
  Task.create = async (payload) => baseTask(payload);

  const res = await auth(request(app).post("/api/tasks")).send({
    title: "Prepare report",
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.title, "Prepare report");
  assert.equal(res.body.ownerId, userId);
});

test("POST /api/tasks creates task with assignees and checklist", async () => {
  Task.create = async (payload) => baseTask(payload);
  User.find = async () => [makeDoc({ _id: otherUserId, status: "active" })];
  TaskAssignee.create = async (payload) => makeDoc({ _id: new mongoose.Types.ObjectId(), ...payload });
  ChecklistItem.create = async (payload) => makeDoc({ _id: checklistId, ...payload });

  const res = await auth(request(app).post("/api/tasks")).send({
    title: "Launch checklist",
    assigneeIds: [otherUserId],
    checklist: [{ title: "Draft" }, { title: "Review" }],
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.assignees.length, 1);
  assert.equal(res.body.checklist.length, 2);
});

test("GET /api/tasks lists tasks with filters", async () => {
  let findQuery;
  Task.find = (query) => {
    findQuery = query;
    return makeQuery([baseTask({ status: "todo", priority: "high", projectId })]);
  };
  Task.countDocuments = async () => 1;

  const res = await auth(
    request(app).get(`/api/tasks?status=todo&priority=high&projectId=${projectId}&search=report`),
  );

  assert.equal(res.status, 200);
  assert.equal(findQuery.status, "todo");
  assert.equal(findQuery.priority, "high");
  assert.equal(findQuery.projectId, projectId);
  assert.ok(findQuery.$and.some((part) => part.$or));
  assert.equal(res.body.content.length, 1);
});

test("GET /api/tasks does not count inaccessible tasks", async () => {
  let findQuery;
  let countQuery;
  TaskAssignee.find = () => makeSortQuery([]);
  Task.find = (query) => {
    findQuery = query;
    return makeQuery([baseTask({ createdBy: userId, ownerId: userId })]);
  };
  Task.countDocuments = async (query) => {
    countQuery = query;
    return 1;
  };

  const res = await auth(request(app).get("/api/tasks"));

  assert.equal(res.status, 200);
  assert.equal(res.body.totalElements, 1);
  assert.deepEqual(findQuery, countQuery);
  assert.ok(findQuery.$and);
  assert.ok(findQuery.$and.some((part) => part.$or));
});

test("GET /api/tasks escapes regex metacharacters in search", async () => {
  let findQuery;
  TaskAssignee.find = () => makeSortQuery([]);
  Task.find = (query) => {
    findQuery = query;
    return makeQuery([]);
  };
  Task.countDocuments = async () => 0;

  const res = await auth(request(app).get("/api/tasks?search=.*"));

  assert.equal(res.status, 200);
  assert.equal(findQuery.$and[0].$or[0].title.source, "\\.\\*");
});

test("GET /api/tasks/my lists tasks assigned to current user", async () => {
  TaskAssignee.find = () => makeSortQuery([makeDoc({ taskId, userId, removedAt: null })]);
  Task.find = () => makeQuery([baseTask({ ownerId: otherUserId })]);
  Task.countDocuments = async () => 1;
  TaskAssignee.findOne = async () => makeDoc({ taskId, userId, removedAt: null });

  const res = await auth(request(app).get("/api/tasks/my"));

  assert.equal(res.status, 200);
  assert.equal(res.body.content.length, 1);
});

test("GET /api/tasks/:id includes assignees, checklist, and activity timeline", async () => {
  Task.findById = async () => baseTask();
  TaskAssignee.find = () => makeSortQuery([makeDoc({ taskId, userId, removedAt: null })]);
  ChecklistItem.find = () => makeSortQuery([makeDoc({ _id: checklistId, taskId, title: "Draft" })]);
  ActivityLog.find = () => makeQuery([makeDoc({ action: "task.created" })]);
  ActivityLog.countDocuments = async () => 1;

  const res = await auth(request(app).get(`/api/tasks/${taskId}`));

  assert.equal(res.status, 200);
  assert.equal(res.body.assignees.length, 1);
  assert.equal(res.body.checklist.length, 1);
  assert.equal(res.body.timeline.length, 1);
});

test("PATCH /api/tasks/:id updates task status", async () => {
  Task.findById = async () => baseTask({ status: "todo" });
  Task.findByIdAndUpdate = async () => baseTask({ status: "done", completedAt: new Date() });

  const res = await auth(request(app).patch(`/api/tasks/${taskId}`)).send({
    status: "done",
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.status, "done");
});

test("POST and DELETE assignees add and soft-remove assignments", async () => {
  Task.findById = async () => baseTask();
  User.find = async () => [makeDoc({ _id: otherUserId, status: "active" })];
  TaskAssignee.findOneAndUpdate = async (query, update) =>
    makeDoc({ taskId: query.taskId, userId: query.userId, ...update.$setOnInsert });
  TaskAssignee.updateOne = async () => ({ modifiedCount: 1 });

  const add = await auth(request(app).post(`/api/tasks/${taskId}/assignees`)).send({
    userIds: [otherUserId],
  });
  const remove = await auth(request(app).delete(`/api/tasks/${taskId}/assignees/${otherUserId}`));

  assert.equal(add.status, 200);
  assert.equal(add.body.assignees.length, 1);
  assert.equal(remove.status, 204);
});

test("POST /api/tasks/:id/assignees rejects missing assignee users without partial writes", async () => {
  let wroteAssignment = false;
  Task.findById = async () => baseTask();
  User.find = async () => [];
  TaskAssignee.findOneAndUpdate = async () => {
    wroteAssignment = true;
    return null;
  };

  const res = await auth(request(app).post(`/api/tasks/${taskId}/assignees`)).send({
    userIds: [otherUserId],
  });

  assert.equal(res.status, 400);
  assert.equal(wroteAssignment, false);
});

test("POST /api/tasks/:id/assignees rejects locked or disabled assignees", async () => {
  let wroteAssignment = false;
  Task.findById = async () => baseTask();
  User.find = async () => [makeDoc({ _id: otherUserId, status: "locked" })];
  TaskAssignee.findOneAndUpdate = async () => {
    wroteAssignment = true;
    return null;
  };

  const res = await auth(request(app).post(`/api/tasks/${taskId}/assignees`)).send({
    userIds: [otherUserId],
  });

  assert.equal(res.status, 400);
  assert.equal(wroteAssignment, false);
});

test("PATCH /api/tasks/:id/checklist/:itemId marks checklist complete", async () => {
  Task.findById = async () => baseTask();
  ChecklistItem.findById = async () =>
    makeDoc({ _id: checklistId, taskId, title: "Draft", isDone: false });
  ChecklistItem.findByIdAndUpdate = async () =>
    makeDoc({
      _id: checklistId,
      taskId,
      title: "Draft",
      isDone: true,
      completedBy: userId,
      completedAt: new Date(),
    });

  const res = await auth(
    request(app).patch(`/api/tasks/${taskId}/checklist/${checklistId}`),
  ).send({ isDone: true });

  assert.equal(res.status, 200);
  assert.equal(res.body.isDone, true);
});

test("GET /api/tasks/:id denies users without task access", async () => {
  Task.findById = async () =>
    baseTask({
      createdBy: otherUserId,
      ownerId: otherUserId,
      departmentId: new mongoose.Types.ObjectId().toString(),
    });
  TaskAssignee.findOne = async () => null;

  const res = await auth(request(app).get(`/api/tasks/${taskId}`));

  assert.equal(res.status, 403);
});

test("DELETE /api/tasks/:id soft deletes and list excludes deleted tasks", async () => {
  let deletedUpdate;
  let listQuery;
  Task.findById = async () => baseTask();
  Task.findByIdAndUpdate = async (id, update) => {
    deletedUpdate = update;
    return baseTask({ deletedAt: update.deletedAt });
  };
  Task.find = (query) => {
    listQuery = query;
    return makeQuery([]);
  };
  Task.countDocuments = async () => 0;

  const del = await auth(request(app).delete(`/api/tasks/${taskId}`));
  const list = await auth(request(app).get("/api/tasks"));

  assert.equal(del.status, 204);
  assert.ok(deletedUpdate.deletedAt instanceof Date);
  assert.equal(list.status, 200);
  assert.equal(listQuery.deletedAt, null);
});
