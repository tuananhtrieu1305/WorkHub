import TaskAssignee from "../models/TaskAssignee.js";

const toId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value._id?.toString?.() || value.toString?.() || null;
};

const isAdmin = (user) => user?.role === "admin";

const hasSystemTaskAdmin = (user) => isAdmin(user);

const hasOrganizationTaskPermission = (user, permissionKey) => {
  if (!user || !permissionKey) return false;
  const permissions = user.activeOrganizationPermissions || {};
  return Boolean(
    user.activeOrganizationIsOwner ||
      permissions.manageOrganization ||
      permissions[permissionKey],
  );
};

const isInActiveOrganization = (user, task) => {
  const activeOrganizationId = toId(user?.activeOrganizationId);
  const taskOrganizationId = toId(task?.organizationId);
  return Boolean(activeOrganizationId && taskOrganizationId) &&
    activeOrganizationId === taskOrganizationId;
};

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
  if (!toId(user.activeOrganizationId)) return false;
  if (hasSystemTaskAdmin(user)) return true;
  if (!hasOrganizationTaskPermission(user, "createTasks")) return false;
  // There is no reliable project membership model in this backend yet.
  // Non-admin users can create standalone tasks, but scoped creation stays closed
  // until membership is modeled explicitly.
  return !scope.projectId || hasOrganizationTaskPermission(user, "manageTasks");
};

export const canViewAssignedTasks = (user) => {
  if (!user || !toId(user.activeOrganizationId)) return false;
  return (
    hasSystemTaskAdmin(user) ||
    hasOrganizationTaskPermission(user, "viewAssignedTasks") ||
    hasOrganizationTaskPermission(user, "viewOrganizationTasks")
  );
};

export const canViewOrganizationTasks = (user) => {
  if (!user || !toId(user.activeOrganizationId)) return false;
  return (
    hasSystemTaskAdmin(user) ||
    hasOrganizationTaskPermission(user, "viewOrganizationTasks")
  );
};

export const canViewTaskInsights = (user) => {
  if (!user || !toId(user.activeOrganizationId)) return false;
  return (
    hasSystemTaskAdmin(user) ||
    hasOrganizationTaskPermission(user, "viewTaskInsights")
  );
};

export const canReadTask = async (user, task) => {
  if (!user || !task || task.deletedAt) return false;
  if (!isInActiveOrganization(user, task)) return false;
  if (
    hasSystemTaskAdmin(user) ||
    hasOrganizationTaskPermission(user, "viewOrganizationTasks") ||
    isCreatorOrOwner(user, task)
  ) {
    return true;
  }
  if (!hasOrganizationTaskPermission(user, "viewAssignedTasks")) return false;
  return isTaskAssignee(user, task);
};

export const canEditTask = async (user, task) => {
  if (!user || !task || task.deletedAt) return false;
  if (!isInActiveOrganization(user, task)) return false;
  return (
    hasSystemTaskAdmin(user) ||
    hasOrganizationTaskPermission(user, "manageTasks") ||
    isCreatorOrOwner(user, task)
  );
};

export const canChangeTaskStatus = async (user, task) => {
  if (await canEditTask(user, task)) return true;
  if (!hasOrganizationTaskPermission(user, "viewAssignedTasks")) return false;
  return isTaskAssignee(user, task);
};

export const canDeleteTask = async (user, task) => {
  if (!user || !task || task.deletedAt) return false;
  if (!isInActiveOrganization(user, task)) return false;
  return (
    hasSystemTaskAdmin(user) ||
    hasOrganizationTaskPermission(user, "deleteTasks") ||
    hasOrganizationTaskPermission(user, "manageTasks") ||
    isCreatorOrOwner(user, task)
  );
};

export const canAssignTask = async (user, task) => {
  if (!user || !task || task.deletedAt) return false;
  if (!isInActiveOrganization(user, task)) return false;
  return (
    hasSystemTaskAdmin(user) ||
    hasOrganizationTaskPermission(user, "assignTasks") ||
    hasOrganizationTaskPermission(user, "manageTasks") ||
    isCreatorOrOwner(user, task)
  );
};

export default {
  canCreateTask,
  canViewAssignedTasks,
  canViewOrganizationTasks,
  canViewTaskInsights,
  canReadTask,
  canEditTask,
  canChangeTaskStatus,
  canDeleteTask,
  canAssignTask,
  isTaskAssignee,
};
