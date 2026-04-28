import axiosClient from "./axiosClient";

export const getDepartments = async (params = {}) => {
  const { data } = await axiosClient.get("/departments", { params });
  return data;
};

export const getDepartmentById = async (departmentId) => {
  const { data } = await axiosClient.get(`/departments/${departmentId}`);
  return data;
};

export const createDepartment = async (payload) => {
  const { data } = await axiosClient.post("/departments", payload);
  return data;
};

export const updateDepartment = async (departmentId, payload) => {
  const { data } = await axiosClient.patch(`/departments/${departmentId}`, payload);
  return data;
};

export const deleteDepartment = async (departmentId) => {
  const { data } = await axiosClient.delete(`/departments/${departmentId}`);
  return data;
};
