import TaskAssignee from "../models/TaskAssignee.js";

const toId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value._id?.toString?.() || value.toString?.() || null;
};

const isAdmin = (user) => user?.role === "admin";

const isCreatorOrOwner = (user, task) => {
  const userId = toId(user?._id);
  return Boolean(
    userId && (toId(task?.createdBy) === userId || toId(task?.ownerId) === userId),
  );
};

export const isTaskAssignee = async (user, task) => {
  const userId = toId(user?._id);
  const taskId = toId(task?._id);
  if (!userId || !taskId) return false;

  const assignment = await TaskAssignee.findOne({
    taskId,
    userId,
    removedAt: null,
  });

  return Boolean(assignment);
};

export const canCreateTask = (user, scope = {}) => {
  if (!user) return false;
  if (isAdmin(user)) return true;
  // There is no reliable Project/Department membership model in this backend yet.
  // Non-admin users can create standalone tasks, but scoped creation stays closed
  // until membership is modeled explicitly.
  return !scope.projectId && !scope.departmentId;
};

export const canReadTask = async (user, task) => {
  if (!user || !task || task.deletedAt) return false;
  if (isAdmin(user) || isCreatorOrOwner(user, task)) {
    return true;
  }
  return isTaskAssignee(user, task);
};

export const canEditTask = async (user, task) => {
  if (!user || !task || task.deletedAt) return false;
  return isAdmin(user) || isCreatorOrOwner(user, task);
};

export const canDeleteTask = async (user, task) => {
  if (!user || !task || task.deletedAt) return false;
  return isAdmin(user) || isCreatorOrOwner(user, task);
};

export const canAssignTask = async (user, task) => {
  if (!user || !task || task.deletedAt) return false;
  return isAdmin(user) || isCreatorOrOwner(user, task);
};

export default {
  canCreateTask,
  canReadTask,
  canEditTask,
  canDeleteTask,
  canAssignTask,
  isTaskAssignee,
};
