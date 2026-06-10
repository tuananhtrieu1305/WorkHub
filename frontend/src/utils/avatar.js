import { API_URL, normalizeApiUrl } from "../config/api";

const isHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const getApiUrl = (apiUrl) =>
  normalizeApiUrl(typeof apiUrl === "string" && apiUrl.trim()
    ? apiUrl.trim()
    : API_URL
  );

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

export const getAvatarUrl = (avatar, apiUrl = API_URL) => {
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
