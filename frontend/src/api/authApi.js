import axiosClient from "./axiosClient";

export const loginUser = async (email, password) => {
  const { data } = await axiosClient.post("/auth/login", { email, password });
  return data;
};

export const googleLoginUser = async (userInfo) => {
  const { data } = await axiosClient.post("/auth/google", userInfo);
  return data;
};

export const registerUser = async (fullName, email, password) => {
  const { data } = await axiosClient.post("/auth/register", {
    fullName,
    email,
    password,
  });
  return data;
};

export const getMe = async () => {
  const { data } = await axiosClient.get("/auth/me");
  return data;
};

export const verifyEmail = async (email, otp) => {
  const { data } = await axiosClient.post("/auth/verify-email", { email, otp });
  return data;
};

export const resendOTP = async (email) => {
  const { data } = await axiosClient.post("/auth/resend-otp", { email });
  return data;
};

export const forgotPassword = async (email) => {
  const { data } = await axiosClient.post("/auth/forgot-password", { email });
  return data;
};

export const resetPassword = async (token, password) => {
  const { data } = await axiosClient.post(`/auth/reset-password/${token}`, {
    password,
  });
  return data;
};

export const logoutUser = async (refreshToken) => {
  const { data } = await axiosClient.post("/auth/logout", { refreshToken });
  return data;
};

export const refreshAccessToken = async (refreshToken) => {
  const { data } = await axiosClient.post("/auth/refresh-token", {
    refreshToken,
  });
  return data;
};
