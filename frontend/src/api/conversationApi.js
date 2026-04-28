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
