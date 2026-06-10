import axiosClient from "./axiosClient";
import { API_URL } from "../config/api";

export const uploadDocument = async (folderId, formData) => {
  const { data } = await axiosClient.post(
    `/folders/${folderId}/documents`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
};

export const getDocumentById = async (documentId) => {
  const { data } = await axiosClient.get(`/documents/${documentId}`);
  return data;
};

export const deleteDocument = async (documentId) => {
  const { data } = await axiosClient.delete(`/documents/${documentId}`);
  return data;
};

export const getDocumentPreviewUrl = (documentId) => {
  return `${API_URL}/api/documents/${documentId}/preview`;
};

export const shareDocument = async (documentId, payload) => {
  const { data } = await axiosClient.post(
    `/documents/${documentId}/share`,
    payload
  );
  return data;
};
