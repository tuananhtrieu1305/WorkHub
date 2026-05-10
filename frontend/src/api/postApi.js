import axiosClient from "./axiosClient";

export const getPosts = async (params = {}) => {
  const { data } = await axiosClient.get("/posts", { params });
  return data;
};

export const getPostById = async (postId) => {
  const { data } = await axiosClient.get(`/posts/${postId}`);
  return data;
};

export const createPost = async (formData) => {
  const { data } = await axiosClient.post("/posts", formData);
  return data;
};

export const updatePost = async (postId, payload) => {
  const { data } = await axiosClient.patch(`/posts/${postId}`, payload);
  return data;
};

export const deletePost = async (postId) => {
  const { data } = await axiosClient.delete(`/posts/${postId}`);
  return data;
};

export const likePost = async (postId, reactionType) => {
  const payload = reactionType ? { reactionType } : undefined;
  const { data } = await axiosClient.post(`/posts/${postId}/likes`, payload);
  return data;
};

export const getPostLikes = async (postId, params = {}) => {
  const { data } = await axiosClient.get(`/posts/${postId}/likes`, { params });
  return data;
};

export const getComments = async (postId, params = {}) => {
  const { data } = await axiosClient.get(`/posts/${postId}/comments`, { params });
  return data;
};

export const getCommentById = async (commentId) => {
  const { data } = await axiosClient.get(`/comments/${commentId}`);
  return data;
};

const normalizeCommentPayload = (payload) => {
  if (typeof FormData === "undefined" || !(payload instanceof FormData)) {
    return payload;
  }

  const attachments = payload.getAll("attachments").filter(Boolean);
  if (attachments.length > 0) {
    return payload;
  }

  return {
    content: payload.get("content") || "",
  };
};

export const createComment = async (postId, payload) => {
  const { data } = await axiosClient.post(
    `/posts/${postId}/comments`,
    normalizeCommentPayload(payload)
  );
  return data;
};

export const getCommentReplies = async (commentId, params = {}) => {
  const { data } = await axiosClient.get(`/comments/${commentId}/replies`, { params });
  return data;
};

export const createCommentReply = async (commentId, payload) => {
  const { data } = await axiosClient.post(
    `/comments/${commentId}/replies`,
    normalizeCommentPayload(payload)
  );
  return data;
};

export const likeComment = async (commentId, reactionType) => {
  const payload = reactionType ? { reactionType } : undefined;
  const { data } = await axiosClient.post(`/comments/${commentId}/likes`, payload);
  return data;
};

export const deleteComment = async (commentId) => {
  const { data } = await axiosClient.delete(`/comments/${commentId}`);
  return data;
};
