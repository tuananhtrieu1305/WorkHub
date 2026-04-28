import axiosClient from "./axiosClient";

export const getConversations = async (params = {}) => {
  const { data } = await axiosClient.get("/conversations", { params });
  return data;
};

export const getConversationById = async (conversationId) => {
  const { data } = await axiosClient.get(`/conversations/${conversationId}`);
  return data;
};

export const createConversation = async (payload) => {
  const { data } = await axiosClient.post("/conversations", payload);
  return data;
};

export const getMessages = async (conversationId, params = {}) => {
  const { data } = await axiosClient.get(
    `/conversations/${conversationId}/messages`,
    { params }
  );
  return data;
};

export const sendMessage = async (conversationId, payload) => {
  const { data } = await axiosClient.post(
    `/conversations/${conversationId}/messages`,
    payload
  );
  return data;
};

export const uploadConversationAttachment = async (conversationId, file) => {
  const formData = new FormData();
  formData.append("file", file);

  const { data } = await axiosClient.post(
    `/conversations/${conversationId}/attachments`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
};

export const updateMessage = async (conversationId, messageId, payload) => {
  const { data } = await axiosClient.put(
    `/conversations/${conversationId}/messages/${messageId}`,
    payload
  );
  return data;
};

export const deleteMessage = async (conversationId, messageId) => {
  await axiosClient.delete(`/conversations/${conversationId}/messages/${messageId}`);
};

export const addMessageReaction = async (conversationId, messageId, reaction) => {
  const { data } = await axiosClient.post(
    `/conversations/${conversationId}/messages/${messageId}/reactions`,
    { reaction }
  );
  return data;
};

export const removeMessageReaction = async (
  conversationId,
  messageId,
  reaction
) => {
  await axiosClient.delete(
    `/conversations/${conversationId}/messages/${messageId}/reactions`,
    { data: { reaction } }
  );
};
