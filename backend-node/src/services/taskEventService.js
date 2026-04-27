import TaskAssignee from "../models/TaskAssignee.js";
import { notifyUsers } from "./notificationService.js";

const toId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value._id?.toString?.() || value.toString?.() || null;
};

const activeAssigneeIds = async (task) => {
  const assignments = await TaskAssignee.find({
    taskId: task._id,
    removedAt: null,
  }).sort({ assignedAt: -1 });

  return assignments.map((assignment) => toId(assignment.userId)).filter(Boolean);
};

export const emitTaskEvent = async (eventName, payload = {}) => {
  try {
    const task = payload.task;
    if (!task) return;

    if (eventName === "task.assignees_added") {
      const userIds = (payload.userIds || []).filter(
        (userId) => toId(userId) !== toId(payload.actorId),
      );
      await notifyUsers(userIds, {
        type: "task_assigned",
        title: "New task assigned",
        message: `You were assigned to ${task.title || "a task"}`,
        entityType: "task",
        entityId: task._id,
        actorId: payload.actorId || null,
        data: {
          taskId: task._id,
          title: task.title,
        },
      });
    }

    if (eventName === "task.updated") {
      const changedFields = payload.changedFields || [];
      const shouldNotify = changedFields.some((field) =>
        ["status", "endAt", "priority"].includes(field),
      );
      if (!shouldNotify) return;

      const userIds = (await activeAssigneeIds(task)).filter(
        (userId) => userId !== toId(payload.actorId),
      );
      await notifyUsers(userIds, {
        type: "task_updated",
        title: "Task updated",
        message: `${task.title || "A task"} was updated`,
        entityType: "task",
        entityId: task._id,
        actorId: payload.actorId || null,
        data: {
          taskId: task._id,
          title: task.title,
          changedFields,
        },
      });
    }
  } catch (error) {
    console.error("Task notification hook failed:", error.message);
  }
};

export default {
  emitTaskEvent,
};
