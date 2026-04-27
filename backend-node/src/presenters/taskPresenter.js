import ApiError from "../utils/apiError.js";
import mongoose from "mongoose";
import User from "../models/User.js";
import Task from "../models/Task.js";
import TaskAssignee from "../models/TaskAssignee.js";
import ChecklistItem from "../models/ChecklistItem.js";
import { logActivity, listByEntity } from "../services/activityLogService.js";
import permission from "../services/taskPermissionService.js";
import { emitTaskEvent } from "../services/taskEventService.js";

const TASK_UPDATE_FIELDS = [
  "title",
  "description",
  "status",
  "priority",
  "startAt",
  "endAt",
  "projectId",
  "departmentId",
  "ownerId",
  "archivedAt",
];

const parsePage = (value, fallback = 1) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseSize = (value, fallback = 20) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 100);
};

const toObject = (doc) => doc?.toObject?.() || doc;

const toId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value._id?.toString?.() || value.toString?.() || null;
};

const uniqueIds = (ids = []) => {
  return [...new Set(ids.filter(Boolean).map((id) => id.toString()))];
};

const isAdmin = (user) => user?.role === "admin";

const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const buildSearchRegex = (value) => {
  const search = String(value || "").trim().slice(0, 80);
  if (!search) return null;
  return new RegExp(escapeRegex(search), "i");
};

const activeStatus = (user) => !user?.status || user.status === "active";

const validateAssignableUsers = async (userIds) => {
  if (userIds.length === 0) return [];

  const invalidIds = userIds.filter((userId) => !mongoose.Types.ObjectId.isValid(userId));
  if (invalidIds.length > 0) {
    throw new ApiError(400, "One or more assignees are invalid");
  }

  const users = await User.find({ _id: { $in: userIds } });
  const usersById = new Map(users.map((user) => [toId(user._id), user]));
  const missingUserIds = userIds.filter((userId) => !usersById.has(userId));
  if (missingUserIds.length > 0) {
    throw new ApiError(400, "One or more assignees were not found");
  }

  const inactiveUserIds = userIds.filter((userId) => !activeStatus(usersById.get(userId)));
  if (inactiveUserIds.length > 0) {
    throw new ApiError(400, "Locked or disabled users cannot be assigned to tasks");
  }

  return users;
};

const requestAuditContext = (req) => ({
  ipAddress: req.ip,
  userAgent: req.get("user-agent") || null,
});

const assertTaskReadable = async (user, task) => {
  if (!task || task.deletedAt) {
    throw new ApiError(404, "Task not found");
  }
  if (!(await permission.canReadTask(user, task))) {
    throw new ApiError(403, "You do not have access to this task");
  }
};

const assertTaskEditable = async (user, task) => {
  await assertTaskReadable(user, task);
  if (!(await permission.canEditTask(user, task))) {
    throw new ApiError(403, "You cannot update this task");
  }
};

const assertTaskAssignable = async (user, task) => {
  await assertTaskReadable(user, task);
  if (!(await permission.canAssignTask(user, task))) {
    throw new ApiError(403, "You cannot assign this task");
  }
};

const getTaskRelations = async (taskId, timelineSize = 10) => {
  const [assignees, checklist, timeline] = await Promise.all([
    TaskAssignee.find({ taskId, removedAt: null }).sort({ assignedAt: -1 }),
    ChecklistItem.find({ taskId }).sort({ order: 1 }),
    listByEntity("task", taskId, { size: timelineSize }),
  ]);

  return {
    assignees,
    checklist,
    timeline: timeline.content,
  };
};

const serializeTask = async (task, options = {}) => {
  const base = toObject(task);
  if (!options.includeRelations) return base;

  const relations = await getTaskRelations(base._id);
  return {
    ...base,
    ...relations,
  };
};

const createActivity = async (req, task, action, metadata = {}) => {
  return logActivity({
    actorId: req.user?._id,
    actorType: "user",
    action,
    entityType: "task",
    entityId: task._id,
    projectId: task.projectId || null,
    departmentId: task.departmentId || null,
    metadata,
    ...requestAuditContext(req),
  });
};

const buildTaskQuery = async (filters = {}) => {
  const query = {
    deletedAt: null,
  };
  const andClauses = [];

  ["status", "priority", "projectId", "departmentId", "createdBy"].forEach((key) => {
    if (filters[key]) query[key] = filters[key];
  });

  if (filters.dueBefore || filters.dueAfter) {
    query.endAt = {};
    if (filters.dueBefore) query.endAt.$lte = new Date(filters.dueBefore);
    if (filters.dueAfter) query.endAt.$gte = new Date(filters.dueAfter);
  }

  if (filters.search) {
    const regex = buildSearchRegex(filters.search);
    if (regex) {
      andClauses.push({ $or: [{ title: regex }, { description: regex }] });
    }
  }

  if (filters.assigneeId) {
    const assignments = await TaskAssignee.find({
      userId: filters.assigneeId,
      removedAt: null,
    }).sort({ assignedAt: -1 });
    andClauses.push({ _id: { $in: assignments.map((assignment) => assignment.taskId) } });
  }

  if (!isAdmin(filters.currentUser)) {
    const userId = toId(filters.currentUser?._id);
    const assignments = userId
      ? await TaskAssignee.find({ userId, removedAt: null }).sort({ assignedAt: -1 })
      : [];

    andClauses.push({
      $or: [
        { createdBy: userId },
        { ownerId: userId },
        { _id: { $in: assignments.map((assignment) => assignment.taskId) } },
      ],
    });
  }

  if (andClauses.length > 0) {
    query.$and = andClauses;
  }

  return query;
};

export const createTask = async (req, res) => {
  const {
    title,
    description = "",
    projectId = null,
    departmentId = null,
    assigneeIds = [],
    checklist = [],
    startAt = null,
    endAt = null,
    priority = "medium",
    status = "todo",
  } = req.body;

  if (!title?.trim()) {
    throw new ApiError(400, "Task title is required");
  }

  if (!permission.canCreateTask(req.user, { projectId, departmentId })) {
    throw new ApiError(403, "You cannot create a task in this scope");
  }

  const assignedUserIds = uniqueIds(assigneeIds);
  await validateAssignableUsers(assignedUserIds);

  const task = await Task.create({
    title,
    description,
    projectId,
    departmentId,
    createdBy: req.user._id,
    ownerId: req.user._id,
    status,
    priority,
    startAt,
    endAt,
    completedAt: status === "done" ? new Date() : null,
  });

  const assignees = [];
  for (const userId of assignedUserIds) {
    assignees.push(
      await TaskAssignee.create({
        taskId: task._id,
        userId,
        assignedBy: req.user._id,
      }),
    );
  }

  const checklistItems = [];
  for (const [index, item] of checklist.entries()) {
    if (!item?.title?.trim()) continue;
    checklistItems.push(
      await ChecklistItem.create({
        taskId: task._id,
        title: item.title,
        isDone: Boolean(item.isDone),
        order: item.order ?? index,
        createdBy: req.user._id,
        completedBy: item.isDone ? req.user._id : null,
        completedAt: item.isDone ? new Date() : null,
      }),
    );
  }

  await createActivity(req, task, "task.created", {
    title: task.title,
    assigneeIds: assignedUserIds,
    checklistCount: checklistItems.length,
  });
  await emitTaskEvent("task.created", {
    task,
    assigneeIds: assignedUserIds,
    actorId: req.user._id,
  });

  res.status(201).json({
    ...toObject(task),
    assignees,
    checklist: checklistItems,
  });
};

export const listTasks = async (req, res) => {
  const page = parsePage(req.query.page);
  const size = parseSize(req.query.size);
  const query = await buildTaskQuery({ ...req.query, currentUser: req.user });
  const [tasks, totalElements] = await Promise.all([
    Task.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * size)
      .limit(size),
    Task.countDocuments(query),
  ]);

  const content = [];
  for (const task of tasks) {
    if (await permission.canReadTask(req.user, task)) {
      content.push(toObject(task));
    }
  }

  res.json({ content, totalElements });
};

export const listMyTasks = async (req, res) => {
  const assignments = await TaskAssignee.find({
    userId: req.user._id,
    removedAt: null,
  }).sort({ assignedAt: -1 });

  req.query.assigneeId = req.user._id.toString();
  req.query._assignedTaskIds = assignments.map((assignment) => assignment.taskId);
  return listTasks(req, res);
};

export const listProjectTasks = async (req, res) => {
  req.query.projectId = req.params.projectId;
  return listTasks(req, res);
};

export const listDepartmentTasks = async (req, res) => {
  req.query.departmentId = req.params.departmentId;
  return listTasks(req, res);
};

export const getTask = async (req, res) => {
  const task = await Task.findById(req.params.id);
  await assertTaskReadable(req.user, task);
  res.json(await serializeTask(task, { includeRelations: true }));
};

export const updateTask = async (req, res) => {
  const task = await Task.findById(req.params.id);
  await assertTaskEditable(req.user, task);

  const update = {};
  const changedFields = [];
  TASK_UPDATE_FIELDS.forEach((field) => {
    if (req.body[field] !== undefined) {
      update[field] = req.body[field];
      if (String(toObject(task)[field] ?? "") !== String(req.body[field] ?? "")) {
        changedFields.push(field);
      }
    }
  });

  if (req.body.status === "done" && task.status !== "done") {
    update.completedAt = new Date();
    changedFields.push("completedAt");
  }
  if (req.body.status && req.body.status !== "done") {
    update.completedAt = null;
  }

  const updated = await Task.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  });

  await createActivity(req, updated, "task.updated", {
    changedFields,
  });
  await emitTaskEvent("task.updated", {
    task: updated,
    changedFields,
    actorId: req.user._id,
  });

  res.json(toObject(updated));
};

export const deleteTask = async (req, res) => {
  const task = await Task.findById(req.params.id);
  await assertTaskReadable(req.user, task);
  if (!(await permission.canDeleteTask(req.user, task))) {
    throw new ApiError(403, "You cannot delete this task");
  }

  const deletedAt = new Date();
  const updated = await Task.findByIdAndUpdate(
    req.params.id,
    { deletedAt },
    { new: true },
  );

  await createActivity(req, updated || task, "task.deleted", { deletedAt });
  await emitTaskEvent("task.deleted", { task: updated || task, actorId: req.user._id });

  res.status(204).send();
};

export const addAssignees = async (req, res) => {
  const task = await Task.findById(req.params.id);
  await assertTaskAssignable(req.user, task);

  const userIds = uniqueIds(req.body.userIds || (req.body.userId ? [req.body.userId] : []));
  if (userIds.length === 0) {
    throw new ApiError(400, "At least one assignee is required");
  }
  await validateAssignableUsers(userIds);

  const assignees = [];
  for (const userId of userIds) {
    assignees.push(
      await TaskAssignee.findOneAndUpdate(
        { taskId: task._id, userId },
        {
          $set: {
            removedAt: null,
            status: "assigned",
          },
          $setOnInsert: {
            taskId: task._id,
            userId,
            assignedBy: req.user._id,
            assignedAt: new Date(),
          },
        },
        { new: true, upsert: true, runValidators: true },
      ),
    );
  }

  await createActivity(req, task, "task.assignees_added", { userIds });
  await emitTaskEvent("task.assignees_added", {
    task,
    userIds,
    actorId: req.user._id,
  });

  res.json({ assignees });
};

export const removeAssignee = async (req, res) => {
  const task = await Task.findById(req.params.id);
  await assertTaskAssignable(req.user, task);

  await TaskAssignee.updateOne(
    { taskId: task._id, userId: req.params.userId, removedAt: null },
    { removedAt: new Date() },
  );

  await createActivity(req, task, "task.assignees_removed", {
    userIds: [req.params.userId],
  });
  await emitTaskEvent("task.assignees_removed", {
    task,
    userIds: [req.params.userId],
    actorId: req.user._id,
  });

  res.status(204).send();
};

export const addChecklistItem = async (req, res) => {
  const task = await Task.findById(req.params.id);
  await assertTaskEditable(req.user, task);

  if (!req.body.title?.trim()) {
    throw new ApiError(400, "Checklist item title is required");
  }

  const item = await ChecklistItem.create({
    taskId: task._id,
    title: req.body.title,
    isDone: Boolean(req.body.isDone),
    order: req.body.order ?? 0,
    createdBy: req.user._id,
    completedBy: req.body.isDone ? req.user._id : null,
    completedAt: req.body.isDone ? new Date() : null,
  });

  await createActivity(req, task, "task.checklist_added", {
    checklistItemId: item._id,
  });

  res.status(201).json(toObject(item));
};

export const updateChecklistItem = async (req, res) => {
  const task = await Task.findById(req.params.id);
  await assertTaskEditable(req.user, task);

  const item = await ChecklistItem.findById(req.params.itemId);
  if (!item || toId(item.taskId) !== toId(task._id)) {
    throw new ApiError(404, "Checklist item not found");
  }

  const update = {};
  if (req.body.title !== undefined) update.title = req.body.title;
  if (req.body.order !== undefined) update.order = req.body.order;

  const completionChanged =
    req.body.isDone !== undefined && Boolean(req.body.isDone) !== Boolean(item.isDone);

  if (req.body.isDone !== undefined) {
    update.isDone = Boolean(req.body.isDone);
    update.completedBy = req.body.isDone ? req.user._id : null;
    update.completedAt = req.body.isDone ? new Date() : null;
  }

  const updated = await ChecklistItem.findByIdAndUpdate(req.params.itemId, update, {
    new: true,
    runValidators: true,
  });

  await createActivity(
    req,
    task,
    completionChanged && updated.isDone
      ? "task.checklist_completed"
      : "task.checklist_updated",
    {
      checklistItemId: updated._id,
      changedFields: Object.keys(update),
    },
  );

  res.json(toObject(updated));
};

export const deleteChecklistItem = async (req, res) => {
  const task = await Task.findById(req.params.id);
  await assertTaskEditable(req.user, task);

  const item = await ChecklistItem.findById(req.params.itemId);
  if (!item || toId(item.taskId) !== toId(task._id)) {
    throw new ApiError(404, "Checklist item not found");
  }

  await ChecklistItem.deleteOne({ _id: req.params.itemId });
  await createActivity(req, task, "task.checklist_deleted", {
    checklistItemId: req.params.itemId,
  });

  res.status(204).send();
};
