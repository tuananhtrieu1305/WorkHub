import axiosClient from "./axiosClient";

export const getDocuments = async (params = {}) => {
  const { data } = await axiosClient.get("/documents", { params });
  return data;
};

export const getDocumentStats = async () => {
  const { data } = await axiosClient.get("/documents/stats");
  return data;
};

export const uploadDocument = async (folderId, formData) => {
  const endpoint = folderId ? `/folders/${folderId}/documents` : "/documents";
  const { data } = await axiosClient.post(endpoint, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
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

export const updateDocument = async (documentId, payload) => {
  const { data } = await axiosClient.put(`/documents/${documentId}`, payload);
  return data;
};

export const uploadDocumentVersion = async (documentId, formData) => {
  const { data } = await axiosClient.post(
    `/documents/${documentId}/versions`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
};

export const getDocumentDownloadUrl = (documentId) => {
  const baseURL = import.meta.env.VITE_NODE_API_URL || "http://localhost:5000";
  return `${baseURL}/api/documents/${documentId}/download`;
};

export const fetchDocumentPreviewBlob = async (documentId) => {
  const response = await axiosClient.get(`/documents/${documentId}/preview`, {
    responseType: "blob",
  });
  return response;
};

export const fetchDocumentDownloadBlob = async (documentId) => {
  const response = await axiosClient.get(`/documents/${documentId}/download`, {
    responseType: "blob",
  });
  return response;
};

export const getDocumentPreviewUrl = (documentId) => {
  const baseURL = import.meta.env.VITE_NODE_API_URL || "http://localhost:5000";
  return `${baseURL}/api/documents/${documentId}/preview`;
};

export const shareDocument = async (documentId, payload) => {
  const { data } = await axiosClient.post(
    `/documents/${documentId}/share`,
    payload
  );
  return data;
};
