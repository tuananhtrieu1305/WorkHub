import api from "./authService";

export const createMeeting = async ({ title, projectId, departmentId } = {}) => {
  const { data } = await api.post("/meetings", {
    title,
    projectId,
    departmentId,
  });
  return data;
};

export const listMeetings = async (params = {}) => {
  const { data } = await api.get("/meetings", { params });
  return data;
};

export const getMeeting = async (meetingId) => {
  const { data } = await api.get(`/meetings/${meetingId}`);
  return data;
};

export const joinMeeting = async (meetingId) => {
  const { data } = await api.post(`/meetings/${meetingId}/join`);
  return data;
};

export const endMeeting = async (meetingId) => {
  const { data } = await api.patch(`/meetings/${meetingId}/end`);
  return data;
};
