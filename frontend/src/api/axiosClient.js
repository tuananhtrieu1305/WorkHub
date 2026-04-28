import axios from "axios";

const API_URL = import.meta.env.VITE_NODE_API_URL || "http://localhost:5000";

const axiosClient = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

let accessToken = null;
let refreshToken = null;
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
};

export const setTokens = (newAccessToken, newRefreshToken) => {
  accessToken = newAccessToken;
  if (newRefreshToken !== undefined) {
    refreshToken = newRefreshToken;
    if (newRefreshToken) {
      localStorage.setItem("workhub_refresh_token", newRefreshToken);
    } else {
      localStorage.removeItem("workhub_refresh_token");
    }
  }
};

export const getAccessToken = () => accessToken;

export const getRefreshToken = () => {
  return refreshToken || localStorage.getItem("workhub_refresh_token");
};

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem("workhub_refresh_token");
  localStorage.removeItem("workhub_token");
};

axiosClient.interceptors.request.use(
  (config) => {
    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      config.headers?.setContentType?.(undefined);
    }

    const token = accessToken || localStorage.getItem("workhub_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 403 && !error.response?.data?.needsVerification) {
      window.dispatchEvent(
        new CustomEvent("workhub:forbidden", {
          detail: error.response?.data,
        })
      );
      return Promise.reject(error);
    }

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    const storedRefreshToken = getRefreshToken();
    if (!storedRefreshToken) {
      clearTokens();
      window.dispatchEvent(new CustomEvent("workhub:logout"));
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return axiosClient(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post(`${API_URL}/api/auth/refresh-token`, {
        refreshToken: storedRefreshToken,
      });

      const newAccessToken = data.token;
      accessToken = newAccessToken;

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      processQueue(null, newAccessToken);

      return axiosClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearTokens();
      window.dispatchEvent(new CustomEvent("workhub:logout"));
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default axiosClient;
