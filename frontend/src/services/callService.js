import api from "../api/axiosClient";

export const prepareCall = async (payload) => {
  const { data } = await api.post("/calls/prepare", payload);
  return data;
};

export const ringCall = async (callId, payload = {}) => {
  const { data } = await api.post(`/calls/${callId}/ring`, payload);
  return data;
};

export const getCall = async (callId) => {
  const { data } = await api.get(`/calls/${callId}`);
  return data;
};

export const answerIntent = async (callId, payload = {}) => {
  const { data } = await api.post(`/calls/${callId}/answer-intent`, payload);
  return data;
};

export const acceptCall = async (callId, payload = {}) => {
  const { data } = await api.post(`/calls/${callId}/accept`, payload);
  return data;
};

export const declineCall = async (callId) => {
  const { data } = await api.post(`/calls/${callId}/decline`);
  return data;
};

export const cancelCall = async (callId) => {
  const { data } = await api.post(`/calls/${callId}/cancel`);
  return data;
};

export const failCall = async (callId, payload = {}) => {
  const { data } = await api.post(`/calls/${callId}/fail`, payload);
  return data;
};

export const getJoinToken = async (callId) => {
  const { data } = await api.post(`/calls/${callId}/join-token`);
  return data;
};

export const markCallJoined = async (callId, payload = {}) => {
  const { data } = await api.post(`/calls/${callId}/joined`, payload);
  return data;
};

export const heartbeatCall = async (callId) => {
  const { data } = await api.post(`/calls/${callId}/heartbeat`);
  return data;
};

export const endCall = async (callId) => {
  const { data } = await api.patch(`/calls/${callId}/end`);
  return data;
};
