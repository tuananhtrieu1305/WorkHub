import axiosClient from "./axiosClient";

export const getFolders = async (params = {}) => {
  const { data } = await axiosClient.get("/folders", { params });
  return data;
};

export const getFolderById = async (folderId) => {
  const { data } = await axiosClient.get(`/folders/${folderId}`);
  return data;
};

export const createFolder = async (payload) => {
  const { data } = await axiosClient.post("/folders", payload);
  return data;
};

export const updateFolder = async (folderId, payload) => {
  const { data } = await axiosClient.patch(`/folders/${folderId}`, payload);
  return data;
};

export const deleteFolder = async (folderId) => {
  const { data } = await axiosClient.delete(`/folders/${folderId}`);
  return data;
};

export const getFolderDocuments = async (folderId, params = {}) => {
  const { data } = await axiosClient.get(`/folders/${folderId}/documents`, {
    params,
  });
  return data;
};
