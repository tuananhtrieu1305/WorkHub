const DEFAULT_LOCAL_FRONTEND_URL = "http://localhost:5173";

const normalizeOrigin = (value) => {
  if (!value || typeof value !== "string") return "";

  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol)
      ? url.origin.replace(/\/+$/, "")
      : "";
  } catch {
    return "";
  }
};

const getConfiguredOrigins = () => {
  const origins = [
    process.env.FRONTEND_URL,
    ...(process.env.FRONTEND_ALLOWED_ORIGINS || "").split(","),
  ]
    .map(normalizeOrigin)
    .filter(Boolean);

  return [...new Set(origins)];
};

const getRequestOrigin = (req) => {
  const origin = normalizeOrigin(req.get("origin"));
  if (origin) return origin;

  return normalizeOrigin(req.get("referer"));
};

export const getFrontendUrl = (req) => {
  const configuredOrigins = getConfiguredOrigins();
  const requestOrigin = getRequestOrigin(req);

  if (requestOrigin && configuredOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return configuredOrigins[0] || DEFAULT_LOCAL_FRONTEND_URL;
};
