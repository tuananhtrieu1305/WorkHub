import ApiError from "../utils/apiError.js";
import mongoose from "mongoose";
import User from "../models/User.js";
import Task from "../models/Task.js";
import TaskAssignee from "../models/TaskAssignee.js";
import OrganizationMember from "../models/OrganizationMember.js";
import ChecklistItem from "../models/ChecklistItem.js";
import { logActivity, listByEntity } from "../services/activityLogService.js";
import permission from "../services/taskPermissionService.js";
import { emitTaskEvent } from "../services/taskEventService.js";
import {
  getRequestOrganizationId,
  requireActiveOrganization,
} from "../utils/organizationScope.js";

const TASK_UPDATE_FIELDS = [
  "title",
  "description",
  "status",
  "priority",
  "startAt",
  "endAt",
  "projectId",
  "ownerId",
  "archivedAt",
];

const TASK_STATUSES = ["todo", "in_progress", "blocked", "review", "done", "cancelled"];
const ACTIVE_TASK_STATUSES = ["todo", "in_progress", "blocked", "review"];
const STATUS_ONLY_UPDATE_FIELDS = ["status"];

const parsePage = (value, fallback = 1) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseSize = (value, fallback = 20, max = 200) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
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

const startOfDay = (date = new Date()) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const shiftDays = (date, days) =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const serializeUser = (user) => {
  const doc = toObject(user);
  if (!doc) return null;

  return {
    id: toId(doc._id || doc.id),
    fullName: doc.fullName || "",
    email: doc.email || "",
    avatar: doc.avatar || "",
    position: doc.position || "",
    activityStatus: doc.activityStatus || "offline",
    isOnline: Boolean(doc.isOnline),
  };
};

const serializeChecklistItem = (item) => {
  const doc = toObject(item);
  if (!doc) return null;

  return {
    id: toId(doc._id || doc.id),
    taskId: toId(doc.taskId),
    title: doc.title || doc.content || "",
    isDone: Boolean(doc.isDone ?? doc.isCompleted),
    order: Number(doc.order || 0),
    createdBy: toId(doc.createdBy),
    completedBy: toId(doc.completedBy),
    completedAt: doc.completedAt || null,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
};

const buildTaskAbility = (user, task, assigneeIds = []) => {
  const userId = toId(user?._id);
  const taskOrganizationId = toId(task?.organizationId);
  const activeOrganizationId = toId(user?.activeOrganizationId);
  const inActiveOrganization =
    Boolean(activeOrganizationId && taskOrganizationId) &&
    activeOrganizationId === taskOrganizationId;
  const orgPermissions = user?.activeOrganizationPermissions || {};
  const organizationOwner = Boolean(user?.activeOrganizationIsOwner);
  const organizationManager = Boolean(orgPermissions.manageOrganization);
  const systemAdmin = isAdmin(user);
  const taskCreatorOrOwner =
    Boolean(userId) &&
    (toId(task?.createdBy) === userId || toId(task?.ownerId) === userId);
  const assigned = assigneeIds.map(String).includes(String(userId));
  const canManage =
    inActiveOrganization &&
    (systemAdmin || organizationOwner || organizationManager || orgPermissions.manageTasks);

  return {
    canRead:
      inActiveOrganization &&
      (canManage ||
        orgPermissions.viewOrganizationTasks ||
        taskCreatorOrOwner ||
        (orgPermissions.viewAssignedTasks && assigned)),
    canEdit: Boolean(inActiveOrganization && (canManage || taskCreatorOrOwner)),
    canChangeStatus: Boolean(inActiveOrganization && (canManage || taskCreatorOrOwner || assigned)),
    canAssign: Boolean(
      inActiveOrganization &&
        (canManage || orgPermissions.assignTasks || taskCreatorOrOwner),
    ),
    canDelete: Boolean(
      inActiveOrganization &&
        (canManage || orgPermissions.deleteTasks || taskCreatorOrOwner),
    ),
    isAssigned: assigned,
    isOwner: taskCreatorOrOwner,
  };
};

const createTaskSerializer = async (tasks, user) => {
  const taskList = (Array.isArray(tasks) ? tasks : [tasks]).filter(Boolean);
  const taskIds = taskList.map((task) => toId(task._id)).filter(Boolean);

  if (!taskIds.length) {
    return Array.isArray(tasks) ? [] : null;
  }

  const [assignments, checklistItems] = await Promise.all([
    TaskAssignee.find({ taskId: { $in: taskIds }, removedAt: null }).sort({
      assignedAt: -1,
    }),
    ChecklistItem.find({ taskId: { $in: taskIds } }).sort({ order: 1 }),
  ]);

  const userIds = new Set();
  taskList.forEach((task) => {
    [task.createdBy, task.ownerId].forEach((id) => {
      const value = toId(id);
      if (value) userIds.add(value);
    });
  });
  assignments.forEach((assignment) => {
    const value = toId(assignment.userId);
    if (value) userIds.add(value);
  });

  const users = userIds.size
    ? await User.find({ _id: { $in: [...userIds] } }).select(
        "_id fullName email avatar position activityStatus isOnline",
      )
    : [];
  const usersById = new Map(users.map((item) => [toId(item._id), serializeUser(item)]));

  const assignmentsByTaskId = new Map();
  assignments.forEach((assignment) => {
    const taskId = toId(assignment.taskId);
    const userId = toId(assignment.userId);
    const item = {
      id: toId(assignment._id),
      taskId,
      userId,
      assignedBy: toId(assignment.assignedBy),
      assignedAt: assignment.assignedAt || null,
      status: assignment.status,
      user: usersById.get(userId) || { id: userId },
    };
    assignmentsByTaskId.set(taskId, [...(assignmentsByTaskId.get(taskId) || []), item]);
  });

  const checklistByTaskId = new Map();
  checklistItems.forEach((item) => {
    const taskId = toId(item.taskId);
    const serialized = serializeChecklistItem(item);
    checklistByTaskId.set(taskId, [...(checklistByTaskId.get(taskId) || []), serialized]);
  });

  const serialize = (task) => {
    const doc = toObject(task);
    const taskId = toId(doc._id || doc.id);
    const assignees = assignmentsByTaskId.get(taskId) || [];
    const assigneeIds = assignees.map((assignment) => assignment.userId);
    const checklist = checklistByTaskId.get(taskId) || [];
    const doneChecklistCount = checklist.filter((item) => item.isDone).length;
    const ability = buildTaskAbility(user, doc, assigneeIds);

    return {
      id: taskId,
      _id: doc._id,
      title: doc.title,
      description: doc.description || "",
      projectId: toId(doc.projectId),
      organizationId: toId(doc.organizationId),
      createdBy: toId(doc.createdBy),
      ownerId: toId(doc.ownerId),
      status: doc.status,
      priority: doc.priority,
      startAt: doc.startAt || null,
      endAt: doc.endAt || null,
      completedAt: doc.completedAt || null,
      archivedAt: doc.archivedAt || null,
      deletedAt: doc.deletedAt || null,
      assigneeIds,
      assignees,
      checklist,
      checklistProgress: {
        done: doneChecklistCount,
        total: checklist.length,
        percent: checklist.length
          ? Math.round((doneChecklistCount / checklist.length) * 100)
          : 0,
      },
      owner: usersById.get(toId(doc.ownerId)) || null,
      creator: usersById.get(toId(doc.createdBy)) || null,
      permissions: ability,
      createdAt: doc.createdAt || null,
      updatedAt: doc.updatedAt || null,
    };
  };

  const payload = taskList.map(serialize);
  return Array.isArray(tasks) ? payload : payload[0];
};

const validateAssignableUsers = async (userIds, organizationId = null) => {
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

  if (organizationId) {
    const memberships = await OrganizationMember.find({
      organizationId,
      userId: { $in: userIds },
      status: "active",
    }).select("userId");
    const memberIds = new Set(memberships.map((membership) => toId(membership.userId)));
    const outsideOrganizationIds = userIds.filter((userId) => !memberIds.has(userId));
    if (outsideOrganizationIds.length > 0) {
      throw new ApiError(400, "Assignees must belong to the active organization");
    }
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
    organizationId: task.organizationId || getRequestOrganizationId(req),
    projectId: task.projectId || null,
    metadata,
    ...requestAuditContext(req),
  });
};

const buildTaskQuery = async (filters = {}) => {
  const query = {
    deletedAt: null,
  };
  const andClauses = [];

  ["status", "priority", "projectId", "createdBy"].forEach((key) => {
    if (filters[key]) query[key] = filters[key];
  });

  if (filters.organizationId) {
    query.organizationId = filters.organizationId;
  } else {
    query._id = { $exists: false };
  }

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

  if (!permission.canViewOrganizationTasks(filters.currentUser)) {
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
  const organizationId = requireActiveOrganization(req);
  const {
    title,
    description = "",
    projectId = null,
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

  if (!permission.canCreateTask(req.user, { projectId })) {
    throw new ApiError(403, "You cannot create a task in this scope");
  }

  const assignedUserIds = uniqueIds(assigneeIds);
  const creatorId = toId(req.user._id);
  const assignsOtherMembers = assignedUserIds.some((userId) => userId !== creatorId);
  const taskPermissions = req.user.activeOrganizationPermissions || {};
  const canAssignDuringCreate = Boolean(
    isAdmin(req.user) ||
      req.user.activeOrganizationIsOwner ||
      taskPermissions.manageOrganization ||
      taskPermissions.manageTasks ||
      taskPermissions.assignTasks,
  );
  if (assignsOtherMembers && !canAssignDuringCreate) {
    throw new ApiError(403, "You cannot assign this task to other members");
  }
  await validateAssignableUsers(assignedUserIds, organizationId);

  const task = await Task.create({
    title,
    description,
    organizationId,
    projectId,
    createdBy: req.user._id,
    ownerId: req.user._id,
    status,
    priority,
    startAt,
    endAt,
    assignees: assignedUserIds,
    completedAt: status === "done" ? new Date() : null,
  });

  for (const userId of assignedUserIds) {
    await TaskAssignee.create({
      taskId: task._id,
      userId,
      assignedBy: req.user._id,
    });
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

  const payload = await createTaskSerializer(task, req.user);
  res.status(201).json(payload);
};

export const listTasks = async (req, res) => {
  const page = parsePage(req.query.page);
  const size = parseSize(req.query.size);
  const query = await buildTaskQuery({
    ...req.query,
    currentUser: req.user,
    organizationId: getRequestOrganizationId(req),
  });
  const [tasks, totalElements] = await Promise.all([
    Task.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * size)
      .limit(size),
    Task.countDocuments(query),
  ]);

  const serializedTasks = await createTaskSerializer(
    tasks.filter((task) => task && !task.deletedAt),
    req.user,
  );
  const content = serializedTasks.filter((task) => task.permissions?.canRead);
  const totalPages = totalElements ? Math.ceil(totalElements / size) : 0;

  res.json({
    content,
    totalElements,
    totalPages,
    page,
    size,
    first: page <= 1,
    last: totalPages === 0 || page >= totalPages,
  });
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

export const getTaskSummary = async (req, res) => {
  const organizationId = requireActiveOrganization(req);
  if (!permission.canViewTaskInsights(req.user)) {
    throw new ApiError(403, "You cannot view task insights");
  }

  const today = startOfDay();
  const dueSoonEnd = shiftDays(today, 7);
  const baseQuery = {
    organizationId,
    deletedAt: null,
  };
  const tasks = await Task.find(baseQuery).select(
    "_id title status priority endAt completedAt ownerId createdAt",
  );
  const taskIds = tasks.map((task) => task._id);
  const assignments = taskIds.length
    ? await TaskAssignee.find({ taskId: { $in: taskIds }, removedAt: null })
    : [];
  const assigneeUserIds = [
    ...new Set(assignments.map((assignment) => toId(assignment.userId)).filter(Boolean)),
  ];
  const users = assigneeUserIds.length
    ? await User.find({ _id: { $in: assigneeUserIds } }).select(
        "_id fullName email avatar position",
      )
    : [];
  const usersById = new Map(users.map((user) => [toId(user._id), serializeUser(user)]));

  const byStatus = TASK_STATUSES.reduce(
    (acc, status) => ({
      ...acc,
      [status]: 0,
    }),
    {},
  );
  const byPriority = ["low", "medium", "high", "urgent"].reduce(
    (acc, priority) => ({
      ...acc,
      [priority]: 0,
    }),
    {},
  );
  const workloadByUserId = new Map();

  tasks.forEach((task) => {
    byStatus[task.status] = Number(byStatus[task.status] || 0) + 1;
    byPriority[task.priority] = Number(byPriority[task.priority] || 0) + 1;
  });

  assignments.forEach((assignment) => {
    const task = tasks.find((item) => toId(item._id) === toId(assignment.taskId));
    const userId = toId(assignment.userId);
    if (!task || !userId) return;

    const current = workloadByUserId.get(userId) || {
      userId,
      user: usersById.get(userId) || { id: userId },
      total: 0,
      open: 0,
      done: 0,
      overdue: 0,
    };
    current.total += 1;
    if (task.status === "done") {
      current.done += 1;
    } else if (task.status !== "cancelled") {
      current.open += 1;
    }
    if (
      task.endAt &&
      ACTIVE_TASK_STATUSES.includes(task.status) &&
      new Date(task.endAt) < today
    ) {
      current.overdue += 1;
    }
    workloadByUserId.set(userId, current);
  });

  const total = tasks.length;
  const done = Number(byStatus.done || 0);
  const cancelled = Number(byStatus.cancelled || 0);
  const open = tasks.filter((task) => ACTIVE_TASK_STATUSES.includes(task.status)).length;
  const overdue = tasks.filter(
    (task) =>
      task.endAt &&
      ACTIVE_TASK_STATUSES.includes(task.status) &&
      new Date(task.endAt) < today,
  ).length;
  const dueSoon = tasks.filter(
    (task) =>
      task.endAt &&
      ACTIVE_TASK_STATUSES.includes(task.status) &&
      new Date(task.endAt) >= today &&
      new Date(task.endAt) <= dueSoonEnd,
  ).length;

  res.json({
    totals: {
      total,
      open,
      done,
      cancelled,
      overdue,
      dueSoon,
      completionRate: total ? Math.round((done / Math.max(total - cancelled, 1)) * 100) : 0,
    },
    byStatus,
    byPriority,
    workload: [...workloadByUserId.values()]
      .sort((left, right) => right.open - left.open || right.total - left.total)
      .slice(0, 8),
    generatedAt: new Date().toISOString(),
  });
};

export const getTask = async (req, res) => {
  const task = await Task.findById(req.params.id);
  await assertTaskReadable(req.user, task);
  const [payload, relations] = await Promise.all([
    createTaskSerializer(task, req.user),
    getTaskRelations(task._id),
  ]);
  res.json({
    ...payload,
    timeline: relations.timeline,
  });
};

export const updateTask = async (req, res) => {
  const task = await Task.findById(req.params.id);
  await assertTaskReadable(req.user, task);

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

  const requestedFields = Object.keys(update);
  const statusOnlyUpdate =
    requestedFields.length > 0 &&
    requestedFields.every((field) => STATUS_ONLY_UPDATE_FIELDS.includes(field));
  const canEditTask = await permission.canEditTask(req.user, task);
  const canChangeStatus =
    statusOnlyUpdate && (await permission.canChangeTaskStatus(req.user, task));

  if (!canEditTask && !canChangeStatus) {
    throw new ApiError(403, "You cannot update this task");
  }

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

  res.json(await createTaskSerializer(updated, req.user));
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
  await validateAssignableUsers(userIds, task.organizationId);

  for (const userId of userIds) {
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
    );
  }
  const updatedTask = await Task.findByIdAndUpdate(
    task._id,
    { $addToSet: { assignees: { $each: userIds } } },
    { new: true },
  );

  await createActivity(req, task, "task.assignees_added", { userIds });
  await emitTaskEvent("task.assignees_added", {
    task,
    userIds,
    actorId: req.user._id,
  });

  res.json(await createTaskSerializer(updatedTask || task, req.user));
};

export const removeAssignee = async (req, res) => {
  const task = await Task.findById(req.params.id);
  await assertTaskAssignable(req.user, task);

  await TaskAssignee.updateOne(
    { taskId: task._id, userId: req.params.userId, removedAt: null },
    { removedAt: new Date() },
  );
  const updatedTask = await Task.findByIdAndUpdate(
    task._id,
    { $pull: { assignees: req.params.userId } },
    { new: true },
  );

  await createActivity(req, task, "task.assignees_removed", {
    userIds: [req.params.userId],
  });
  await emitTaskEvent("task.assignees_removed", {
    task,
    userIds: [req.params.userId],
    actorId: req.user._id,
  });

  res.json(await createTaskSerializer(updatedTask || task, req.user));
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
