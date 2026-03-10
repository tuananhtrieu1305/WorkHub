import axios from "axios";

const API_URL = import.meta.env.VITE_NODE_API_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach token to every request if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("workhub_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const loginUser = async (email, password) => {
  const { data } = await api.post("/auth/login", { email, password });
  return data;
};

export const registerUser = async (fullName, email, password) => {
  const { data } = await api.post("/auth/register", {
    fullName,
    email,
    password,
  });
  return data;
};

export const getMe = async () => {
  const { data } = await api.get("/auth/me");
  return data;
};

export const verifyEmail = async (email, otp) => {
  const { data } = await api.post("/auth/verify-email", { email, otp });
  return data;
};

export const resendOTP = async (email) => {
  const { data } = await api.post("/auth/resend-otp", { email });
  return data;
};

export const forgotPassword = async (email) => {
  const { data } = await api.post("/auth/forgot-password", { email });
  return data;
};

export const resetPassword = async (token, password) => {
  const { data } = await api.post(`/auth/reset-password/${token}`, {
    password,
  });
  return data;
};

export default api;
