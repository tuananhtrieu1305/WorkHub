import axiosClient from "./axiosClient";

export const getTasks = async (params = {}) => {
  const { data } = await axiosClient.get("/tasks", { params });
  return data;
};

export const getMyTasks = async (params = {}) => {
  const { data } = await axiosClient.get("/tasks/my", { params });
  return data;
};

export const getTaskSummary = async (params = {}) => {
  const { data } = await axiosClient.get("/tasks/summary", { params });
  return data;
};

export const getTaskById = async (taskId) => {
  const { data } = await axiosClient.get(`/tasks/${taskId}`);
  return data;
};

export const createTask = async (payload) => {
  const { data } = await axiosClient.post("/tasks", payload);
  return data;
};

export const updateTask = async (taskId, payload) => {
  const { data } = await axiosClient.patch(`/tasks/${taskId}`, payload);
  return data;
};

export const deleteTask = async (taskId) => {
  const { data } = await axiosClient.delete(`/tasks/${taskId}`);
  return data;
};

export const addTaskAssignees = async (taskId, userIds = []) => {
  const { data } = await axiosClient.post(`/tasks/${taskId}/assignees`, {
    userIds,
  });
  return data;
};

export const removeTaskAssignee = async (taskId, userId) => {
  const { data } = await axiosClient.delete(`/tasks/${taskId}/assignees/${userId}`);
  return data;
};

export const addChecklistItem = async (taskId, payload) => {
  const { data } = await axiosClient.post(`/tasks/${taskId}/checklist`, payload);
  return data;
};

export const updateChecklistItem = async (taskId, itemId, payload) => {
  const { data } = await axiosClient.patch(
    `/tasks/${taskId}/checklist/${itemId}`,
    payload,
  );
  return data;
};

export const deleteChecklistItem = async (taskId, itemId) => {
  const { data } = await axiosClient.delete(`/tasks/${taskId}/checklist/${itemId}`);
  return data;
};

export const getProjectTasks = async (projectId, params = {}) => {
  const { data } = await axiosClient.get(`/projects/${projectId}/tasks`, {
    params,
  });
  return data;
};
