const LOCAL_API_URL = "http://localhost:5000";

const getDefaultApiUrl = () => {
  if (typeof window === "undefined") return LOCAL_API_URL;

  const { hostname, origin } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return LOCAL_API_URL;
  }

  return origin;
};

export const normalizeApiUrl = (apiUrl) =>
  String(apiUrl || getDefaultApiUrl()).replace(/\/+$/, "");

export const API_URL = normalizeApiUrl(import.meta.env.VITE_NODE_API_URL);
