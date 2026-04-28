import axiosClient from "./axiosClient";

export const getMyTasks = async (params = {}) => {
  const { data } = await axiosClient.get("/tasks/me", { params });
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

export const getProjectTasks = async (projectId, params = {}) => {
  const { data } = await axiosClient.get(`/projects/${projectId}/tasks`, {
    params,
  });
  return data;
};

export const getDepartmentTasks = async (departmentId, params = {}) => {
  const { data } = await axiosClient.get(`/departments/${departmentId}/tasks`, {
    params,
  });
  return data;
};
