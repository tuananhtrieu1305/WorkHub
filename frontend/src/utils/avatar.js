const DEFAULT_API_URL = "http://localhost:5000";

const getDefaultApiUrl = () =>
  import.meta.env?.VITE_NODE_API_URL || DEFAULT_API_URL;

const isHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const getApiUrl = (apiUrl) =>
  (typeof apiUrl === "string" && apiUrl.trim()
    ? apiUrl.trim()
    : DEFAULT_API_URL
  ).replace(/\/+$/, "");

const getR2AvatarProxyPath = (avatar) => {
  try {
    const url = new URL(avatar);
    if (!url.hostname.endsWith("r2.cloudflarestorage.com")) return "";

    const pathParts = url.pathname.split("/").filter(Boolean);
    const candidates = [
      decodeURIComponent(pathParts.join("/")),
      decodeURIComponent(pathParts.slice(1).join("/")),
    ];
    const storageKey = candidates.find((candidate) =>
      candidate.startsWith("avatars/")
    );

    return storageKey
      ? `/api/users/avatars?key=${encodeURIComponent(storageKey)}`
      : "";
  } catch {
    return "";
  }
};

const getLocalAvatarPath = (avatar) => {
  if (avatar.startsWith("/")) return avatar;
  if (avatar.startsWith("uploads/")) return `/${avatar}`;
  return "";
};

export const getAvatarUrl = (avatar, apiUrl = getDefaultApiUrl()) => {
  if (!avatar || typeof avatar !== "string") return null;
  const trimmedAvatar = avatar.trim();
  if (!trimmedAvatar) return null;

  const r2AvatarPath = getR2AvatarProxyPath(trimmedAvatar);
  if (r2AvatarPath) return `${getApiUrl(apiUrl)}${r2AvatarPath}`;

  if (isHttpUrl(trimmedAvatar)) return trimmedAvatar;
  const localAvatarPath = getLocalAvatarPath(trimmedAvatar);
  if (localAvatarPath) return `${getApiUrl(apiUrl)}${localAvatarPath}`;

  return null;
};

export const getAvatarReferrerPolicy = (avatarUrl) => {
  if (!avatarUrl) return undefined;

  try {
    const url = new URL(avatarUrl);
    return url.hostname.endsWith("googleusercontent.com")
      ? "no-referrer"
      : undefined;
  } catch {
    return undefined;
  }
};
