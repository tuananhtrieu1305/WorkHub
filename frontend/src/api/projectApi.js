import axiosClient from "./axiosClient";

export const getProjects = async (params = {}) => {
  const { data } = await axiosClient.get("/projects", { params });
  return data;
};

export const getProjectById = async (projectId) => {
  const { data } = await axiosClient.get(`/projects/${projectId}`);
  return data;
};

export const createProject = async (payload) => {
  const { data } = await axiosClient.post("/projects", payload);
  return data;
};

export const updateProject = async (projectId, payload) => {
  const { data } = await axiosClient.patch(`/projects/${projectId}`, payload);
  return data;
};

export const deleteProject = async (projectId) => {
  const { data } = await axiosClient.delete(`/projects/${projectId}`);
  return data;
};
