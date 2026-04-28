import axiosClient from "./axiosClient";

export const getNotifications = async (params = {}) => {
  const { data } = await axiosClient.get("/notifications", { params });
  return data;
};

export const getUnreadCount = async () => {
  const { data } = await axiosClient.get("/notifications/unread-count");
  return data;
};

export const markAsRead = async (notificationId) => {
  const { data } = await axiosClient.patch(
    `/notifications/${notificationId}/read`
  );
  return data;
};

export const markAllAsRead = async () => {
  const { data } = await axiosClient.patch("/notifications/read-all");
  return data;
};

export const getNotificationSettings = async () => {
  const { data } = await axiosClient.get("/notifications/settings");
  return data;
};

export const updateNotificationSettings = async (payload) => {
  const { data } = await axiosClient.patch("/notifications/settings", payload);
  return data;
};
