import axiosClient from "./axiosClient";

export const getDashboard = async () => {
  const { data } = await axiosClient.get("/admin/dashboard");
  return data;
};

export const getAdminUsers = async (params = {}) => {
  const { data } = await axiosClient.get("/admin/users", { params });
  return data;
};

export const lockUser = async (userId) => {
  const { data } = await axiosClient.patch(`/admin/users/${userId}/lock`);
  return data;
};

export const unlockUser = async (userId) => {
  const { data } = await axiosClient.patch(`/admin/users/${userId}/unlock`);
  return data;
};

export const getAdminLogs = async (params = {}) => {
  const { data } = await axiosClient.get("/admin/logs", { params });
  return data;
};

export const getUserActivity = async (userId) => {
  const { data } = await axiosClient.get(`/admin/users/${userId}/activity`);
  return data;
};
