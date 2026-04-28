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

export const likePost = async (postId) => {
  const { data } = await axiosClient.post(`/posts/${postId}/likes`);
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

export const createComment = async (postId, payload) => {
  const { data } = await axiosClient.post(`/posts/${postId}/comments`, payload);
  return data;
};

export const deleteComment = async (commentId) => {
  const { data } = await axiosClient.delete(`/comments/${commentId}`);
  return data;
};
