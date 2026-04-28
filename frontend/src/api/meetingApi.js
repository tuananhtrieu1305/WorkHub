import axiosClient from "./axiosClient";

export const getMeetings = async (params = {}) => {
  const { data } = await axiosClient.get("/meetings", { params });
  return data;
};

export const getMeetingById = async (meetingId) => {
  const { data } = await axiosClient.get(`/meetings/${meetingId}`);
  return data;
};

export const createMeeting = async (payload) => {
  const { data } = await axiosClient.post("/meetings", payload);
  return data;
};

export const joinMeeting = async (meetingId) => {
  const { data } = await axiosClient.post(`/meetings/${meetingId}/join`);
  return data;
};

export const endMeeting = async (meetingId) => {
  const { data } = await axiosClient.patch(`/meetings/${meetingId}/end`);
  return data;
};
