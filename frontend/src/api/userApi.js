import axiosClient from "./axiosClient";

export const getMyProfile = async () => {
  const { data } = await axiosClient.get("/users/me");
  return data;
};

export const getUserById = async (userId) => {
  const { data } = await axiosClient.get(`/users/${userId}`);
  return data;
};

export const updateMyProfile = async (updates) => {
  const { data } = await axiosClient.patch("/users/me", updates);
  return data;
};

export const updateMyAvatar = async (formData) => {
  const { data } = await axiosClient.patch("/users/me/avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const searchUsers = async (params = {}) => {
  const { data } = await axiosClient.get("/users", { params });
  return data;
};
