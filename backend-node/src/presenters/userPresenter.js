import path from "node:path";
import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import OrganizationMember from "../models/OrganizationMember.js";
import OrganizationRole from "../models/OrganizationRole.js";
import Project from "../models/Project.js";
import UserPreference from "../models/UserPreference.js";
import ActivityLog from "../models/ActivityLog.js";
import { pipeline } from "stream/promises";
import { fileTypeFromBuffer } from "file-type";
import {
  activityStatuses,
  buildPresencePayload,
  getPresenceFields,
} from "../services/presenceService.js";
import {
  buildR2AvatarKey,
  buildR2ProfileBannerKey,
  getR2StorageService,
} from "../services/r2StorageService.js";
import { contentDisposition } from "../utils/fileResponse.js";
import {
  buildUserOrganizationContext,
  getRoleDefinition,
} from "../services/organizationService.js";
import { getConversationRoomName } from "../utils/conversationRealtime.js";

let ioInstance = null;
const activityStatusExpiryTimers = new Map();
const AVATAR_R2_PREFIX = "avatars/";
const PROFILE_BANNER_R2_PREFIX = "profiles/";
const PROFILE_BANNER_R2_SEGMENT = "/banners/";
const ALLOWED_PROFILE_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const toId = (value) => {
  if (!value) return "";
  return String(value?._id || value?.id || value);
};
const ALLOWED_PROFILE_IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
]);
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_PROFILE_BANNER_SIZE_BYTES = 8 * 1024 * 1024;
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;
const PROFILE_LINK_TYPES = new Set([
  "website",
  "blog",
  "portfolio",
  "social",
  "app",
  "other",
]);

export const setUserIo = (io) => {
  ioInstance = io;
};

const getSingleString = (value, fallback = "") => {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return typeof value === "string" ? value : fallback;
};

const isAvatarStorageKey = (storageKey = "") =>
  storageKey.startsWith(AVATAR_R2_PREFIX);

const isProfileBannerStorageKey = (storageKey = "") =>
  storageKey.startsWith(PROFILE_BANNER_R2_PREFIX) &&
  storageKey.includes(PROFILE_BANNER_R2_SEGMENT);

export const buildAvatarProxyUrl = (storageKey) => {
  if (!isAvatarStorageKey(storageKey)) return "";
  const params = new URLSearchParams({ key: storageKey });
  return `/api/users/avatars?${params.toString()}`;
};

export const buildProfileBannerProxyUrl = (storageKey) => {
  if (!isProfileBannerStorageKey(storageKey)) return "";
  const params = new URLSearchParams({ key: storageKey });
  return `/api/users/profile-banners?${params.toString()}`;
};

const extractAvatarStorageKeyFromUrl = (avatarUrl = "") => {
  if (!avatarUrl) return "";

  try {
    const url = new URL(avatarUrl, "http://workhub.local");
    const key = url.searchParams.get("key");
    if (key && isAvatarStorageKey(key)) return key;

    const pathParts = url.pathname.split("/").filter(Boolean);
    const bucketName = process.env.R2_BUCKET_NAME;
    const candidates = [
      decodeURIComponent(pathParts.join("/")),
      bucketName && pathParts[0] === bucketName
        ? decodeURIComponent(pathParts.slice(1).join("/"))
        : "",
    ];

    return candidates.find(isAvatarStorageKey) || "";
  } catch {
    return "";
  }
};

const createBadRequestError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const hasOwn = (payload, key) =>
  Object.prototype.hasOwnProperty.call(payload || {}, key);

const normalizeSingleLineText = (value, maxLength) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const normalizeMultilineText = (value, maxLength) =>
  String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);

const normalizeBirthday = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw createBadRequestError("Birthday must be a valid date");
  }
  return date;
};

const normalizeProfileColor = (value, fallback) => {
  const color = String(value || "").trim();
  return HEX_COLOR_REGEX.test(color) ? color : fallback;
};

const normalizeProfileTheme = (value = {}, currentTheme = {}) => ({
  useBannerImage:
    value.useBannerImage !== undefined
      ? Boolean(value.useBannerImage)
      : currentTheme?.useBannerImage !== false,
  preset: normalizeSingleLineText(value.preset || currentTheme?.preset || "aurora", 40),
  accentColor: normalizeProfileColor(
    value.accentColor,
    currentTheme?.accentColor || "#0f766e",
  ),
  backgroundColor: normalizeProfileColor(
    value.backgroundColor,
    currentTheme?.backgroundColor || "#ccfbf1",
  ),
  textColor: normalizeProfileColor(
    value.textColor,
    currentTheme?.textColor || "#134e4a",
  ),
});

const normalizeExternalUrl = (value) => {
  const url = String(value || "").trim();
  if (!url) return "";

  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
};

const inferProfileLinkLabel = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "Liên kết";
  }
};

const normalizeProfileLinks = (links = []) => {
  if (!Array.isArray(links)) return [];

  return links
    .slice(0, 10)
    .map((link) => {
      const url = normalizeExternalUrl(link?.url);
      if (!url) return null;

      const type = PROFILE_LINK_TYPES.has(link?.type) ? link.type : "other";
      const label =
        normalizeSingleLineText(link?.label, 80) ||
        inferProfileLinkLabel(url);

      return { label, url, type };
    })
    .filter(Boolean);
};

const normalizeInterests = (interests = []) => {
  if (!Array.isArray(interests)) return [];

  return [
    ...new Set(
      interests
        .map((interest) => normalizeSingleLineText(interest, 60))
        .filter(Boolean),
    ),
  ].slice(0, 20);
};

const sanitizeProfileFileName = (fileName = "", fallback = "profile-image") => {
  const extension = path.extname(fileName).toLowerCase();
  const baseName = path
    .basename(fileName || fallback, extension)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${baseName || fallback}${extension || ".png"}`;
};

const validateProfileImageFile = async (
  file,
  { label = "Image", maxSizeBytes = MAX_AVATAR_SIZE_BYTES } = {},
) => {
  if (!file) {
    throw createBadRequestError(`${label} file is required`);
  }

  if (file.size > maxSizeBytes) {
    throw createBadRequestError(
      `${label} file must be smaller than ${Math.round(maxSizeBytes / 1024 / 1024)}MB`,
    );
  }

  const extension = path.extname(file.originalname || "").toLowerCase();
  if (!ALLOWED_PROFILE_IMAGE_EXTENSIONS.has(extension)) {
    throw createBadRequestError(`${label} file extension is not allowed`);
  }

  if (!ALLOWED_PROFILE_IMAGE_MIMES.has(file.mimetype)) {
    throw createBadRequestError("Only JPEG, PNG, GIF, or WebP images are allowed");
  }

  const detectedType = await fileTypeFromBuffer(file.buffer);
  if (!detectedType || !ALLOWED_PROFILE_IMAGE_MIMES.has(detectedType.mime)) {
    throw createBadRequestError(`${label} content is not a supported image`);
  }

  if (detectedType.mime !== file.mimetype) {
    throw createBadRequestError(`${label} content does not match its MIME type`);
  }

  return {
    safeName: sanitizeProfileFileName(file.originalname, label.toLowerCase()),
    mimeType: detectedType.mime,
  };
};

const formatCurrentUser = (user) => ({
  _id: user._id,
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  ...getPresenceFields(user),
});

const formatProfileTheme = (theme = {}) =>
  normalizeProfileTheme(theme?.toObject?.() || theme);

const formatProfileFields = (user) => ({
  bio: user.bio || "",
  about: user.about || "",
  location: user.location || "",
  birthday: user.birthday ? user.birthday.toISOString() : null,
  pronouns: user.pronouns || "",
  education: user.education || "",
  interests: Array.isArray(user.interests) ? user.interests : [],
  socialLinks: Array.isArray(user.socialLinks) ? user.socialLinks : [],
  profileBannerUrl: user.profileBannerUrl || "",
  profileTheme: formatProfileTheme(user.profileTheme),
});

const formatProjectSummary = (project) => ({
  id: project._id,
  name: project.name,
  description: project.description,
  status: project.status,
});

export const formatScopedProfileRole = (membership, role = null) => {
  if (!membership) return null;

  const definition = getRoleDefinition(role || membership.role);

  const roleId = definition.id || toId(membership.roleId);

  return {
    ...(roleId ? { id: roleId } : {}),
    key: definition.key,
    name: definition.name,
    description: definition.description,
    color: definition.color,
    isSystem: false,
    status: membership.status,
    joinedAt: membership.joinedAt || null,
  };
};

const buildScopedProfileRoles = async (userId, organizationId) => {
  if (!userId || !organizationId) return [];

  const membership = await OrganizationMember.findOne({
    organizationId,
    userId,
    status: "active",
  });

  if (!membership) return [];

  const role =
    (membership.roleId
      ? await OrganizationRole.findOne({
          _id: membership.roleId,
          organizationId,
          archivedAt: null,
        })
      : null) ||
    (membership.role
      ? await OrganizationRole.findOne({
          organizationId,
          key: membership.role,
          archivedAt: null,
        })
      : null);

  return [formatScopedProfileRole(membership, role)].filter(Boolean);
};

const buildActiveOrganizationRole = (activeOrganization) => {
  if (!activeOrganization?.role) return null;

  return {
    id: activeOrganization.roleId || null,
    key: activeOrganization.role,
    name: activeOrganization.roleLabel || activeOrganization.role,
    description: "Vai trò trong tổ chức đang hoạt động.",
    color: activeOrganization.roleColor || "#64748b",
    isSystem: false,
    isOwner: Boolean(activeOrganization.isOwner),
    status: activeOrganization.memberStatus || "active",
    joinedAt: activeOrganization.joinedAt || null,
  };
};

const emitActivityStatusChanged = async (user) => {
  if (!ioInstance) return;

  const payload = buildPresencePayload(user);

  ioInstance.to(`user:${user._id}`).emit("activity_status_changed", payload);

  const conversations = await Conversation.find({
    "participants.userId": user._id,
  }).select("_id organizationId");

  conversations.forEach((conversation) => {
    ioInstance
      .to(getConversationRoomName(conversation._id, conversation.organizationId))
      .emit("activity_status_changed", payload);
  });
};

const clearActivityStatusExpiryTimer = (userId) => {
  const key = userId.toString();
  const timer = activityStatusExpiryTimers.get(key);
  if (!timer) return;

  clearTimeout(timer);
  activityStatusExpiryTimers.delete(key);
};

const scheduleActivityStatusExpiry = (user) => {
  clearActivityStatusExpiryTimer(user._id);

  if (!user.activityStatusExpiresAt) return;

  const expiresAt = new Date(user.activityStatusExpiresAt).getTime();
  const delay = expiresAt - Date.now();
  if (!Number.isFinite(delay) || delay <= 0) return;

  const key = user._id.toString();
  const timer = setTimeout(async () => {
    try {
      const currentUser = await User.findById(user._id);
      if (!currentUser?.activityStatusExpiresAt) return;

      const currentExpiry = new Date(
        currentUser.activityStatusExpiresAt,
      ).getTime();
      if (currentExpiry > Date.now()) {
        scheduleActivityStatusExpiry(currentUser);
        return;
      }

      currentUser.activityStatus = "online";
      currentUser.activityStatusExpiresAt = null;
      await currentUser.save();
      await emitActivityStatusChanged(currentUser);
    } catch (error) {
      console.error("Activity status expiry error:", error.message);
    } finally {
      activityStatusExpiryTimers.delete(key);
    }
  }, delay);

  timer.unref?.();

  activityStatusExpiryTimers.set(key, timer);
};

const formatUserSummary = (user, projects) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  status: user.status,
  ...getPresenceFields(user),
  position: user.position,
  phone: user.phone,
  avatar: user.avatar,
  bio: user.bio || "",
  projects: projects
    ? projects.map(formatProjectSummary)
    : [],
});

const formatChatUser = (user) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  avatar: user.avatar,
  position: user.position,
  status: user.status,
  ...getPresenceFields(user),
});

const getSingleQueryValue = (value, fallback = "") => {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
};

const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const parsePositiveInt = (value, fallback) => {
  const parsed = parseInt(getSingleQueryValue(value, fallback));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeProfileUpdates = (payload = {}, currentUser = {}) => {
  const updates = {};

  if (hasOwn(payload, "fullName")) {
    const fullName = normalizeSingleLineText(payload.fullName, 50);
    if (fullName.length < 2) {
      throw createBadRequestError("Full name must be at least 2 characters");
    }
    updates.fullName = fullName;
  }

  if (hasOwn(payload, "phone")) {
    updates.phone = normalizeSingleLineText(payload.phone, 30);
  }

  if (hasOwn(payload, "position")) {
    updates.position = normalizeSingleLineText(payload.position, 120);
  }

  if (hasOwn(payload, "bio")) {
    updates.bio = normalizeSingleLineText(payload.bio, 160);
  }

  if (hasOwn(payload, "about")) {
    updates.about = normalizeMultilineText(payload.about, 1500);
  }

  if (hasOwn(payload, "location")) {
    updates.location = normalizeSingleLineText(payload.location, 120);
  }

  if (hasOwn(payload, "birthday")) {
    updates.birthday = normalizeBirthday(payload.birthday);
  }

  if (hasOwn(payload, "pronouns")) {
    updates.pronouns = normalizeSingleLineText(payload.pronouns, 80);
  }

  if (hasOwn(payload, "education")) {
    updates.education = normalizeSingleLineText(payload.education, 300);
  }

  if (hasOwn(payload, "interests")) {
    updates.interests = normalizeInterests(payload.interests);
  }

  if (hasOwn(payload, "socialLinks") || hasOwn(payload, "links")) {
    updates.socialLinks = normalizeProfileLinks(
      hasOwn(payload, "socialLinks") ? payload.socialLinks : payload.links,
    );
  }

  if (hasOwn(payload, "profileTheme")) {
    updates.profileTheme = normalizeProfileTheme(
      payload.profileTheme,
      currentUser.profileTheme?.toObject?.() || currentUser.profileTheme,
    );
  }

  return updates;
};

const formatUserDetail = (
  user,
  projects,
  organizationContext = {},
  { includeOrganizations = true } = {},
) => {
  const activeOrganizationRole = buildActiveOrganizationRole(
    organizationContext.activeOrganization,
  );

  return {
    id: user._id,
    _id: user._id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    position: user.position,
    status: user.status,
    ...getPresenceFields(user),
    role: user.role,
    avatar: user.avatar,
    ...formatProfileFields(user),
    isVerified: user.isVerified,
    authProvider: user.authProvider,
    projects: projects ? projects.map(formatProjectSummary) : [],
    activeOrganizationId: organizationContext.activeOrganization?.id || null,
    activeOrganization: organizationContext.activeOrganization || null,
    organizations: includeOrganizations
      ? organizationContext.organizations || []
      : [],
    pendingOrganizations: includeOrganizations
      ? organizationContext.pendingOrganizations || []
      : [],
    organizationRoles:
      organizationContext.organizationRoles ||
      (activeOrganizationRole ? [activeOrganizationRole] : []),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

export const getUsers = async (req, res) => {
  try {
    const {
      keyword,
      fullName,
      email,
      phone,
      position,
      role,
      status,
      page = 1,
      size = 10,
    } = req.query;

    const filter = {};
    if (keyword) {
      filter.$or = [
        { fullName: { $regex: keyword, $options: "i" } },
        { email: { $regex: keyword, $options: "i" } },
        { phone: { $regex: keyword, $options: "i" } },
      ];
    }
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (fullName) filter.fullName = { $regex: fullName, $options: "i" };
    if (phone) filter.phone = { $regex: phone, $options: "i" };
    if (position) filter.position = { $regex: position, $options: "i" };

    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.max(1, parseInt(size));
    const skip = (pageNum - 1) * pageSize;

    const [users, totalElements] = await Promise.all([
      User.find(filter).skip(skip).limit(pageSize).sort({ createdAt: -1 }),
      User.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalElements / pageSize);

    const content = await Promise.all(
      users.map(async (user) => {
        const projects = await Project.find({
          "members.userId": user._id,
        }).select("_id name description status");

        return formatUserSummary(user, projects);
      }),
    );

    res.status(200).json({
      content,
      totalElements,
      totalPages,
      currentPage: pageNum,
      pageSize,
    });
  } catch (error) {
    console.error("GetUsers error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

export const searchUsersForChat = async (req, res) => {
  try {
    const {
      keyword = req.query.search || "",
      page = 1,
      size = 10,
    } = req.query;

    const pageNum = parsePositiveInt(page, 1);
    const pageSize = Math.min(parsePositiveInt(size, 10), 20);
    const normalizedKeyword = getSingleQueryValue(keyword)
      .toString()
      .trim()
      .slice(0, 50);
    const filter = {
      _id: { $ne: req.user._id },
      status: "active",
    };

    if (req.organizationId) {
      const memberships = await OrganizationMember.find({
        organizationId: req.organizationId,
        status: "active",
      }).select("userId");

      filter._id = {
        $in: memberships.map((membership) => membership.userId),
        $ne: req.user._id,
      };
    } else {
      filter._id = { $in: [] };
    }

    if (normalizedKeyword) {
      const safeKeyword = escapeRegex(normalizedKeyword);
      filter.$or = [
        { fullName: { $regex: safeKeyword, $options: "i" } },
        { email: { $regex: safeKeyword, $options: "i" } },
      ];
    }

    const skip = (pageNum - 1) * pageSize;
    const [users, totalElements] = await Promise.all([
      User.find(filter)
        .select(
          "_id fullName email avatar position status activityStatus activityStatusExpiresAt",
        )
        .skip(skip)
        .limit(pageSize)
        .sort({ fullName: 1 }),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      content: users.map(formatChatUser),
      totalElements,
      totalPages: Math.ceil(totalElements / pageSize),
      currentPage: pageNum,
      pageSize,
    });
  } catch (error) {
    console.error("SearchUsersForChat error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

export const createUser = async (req, res) => {
  try {
    const { email, password, fullName, phone, position, role } = req.body;

    // Validation
    if (!email || !password || !fullName) {
      return res
        .status(400)
        .json({ message: "Email, password, and fullName are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }

    // Create user
    const user = await User.create({
      fullName,
      email,
      password,
      phone: phone || "",
      position: position || "",
      role: role || "user",
      isVerified: true, // Admin-created users are pre-verified
    });

    res.status(201).json({
      id: user._id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    });
  } catch (error) {
    console.error("CreateUser error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isCurrentUser = String(req.user._id) === String(user._id);
    const projectQuery = {
      "members.userId": user._id,
    };

    if (!isCurrentUser) {
      if (!req.organizationId) {
        projectQuery._id = { $exists: false };
      } else {
        projectQuery.organizationId = req.organizationId;
      }
    }

    const projects = await Project.find(projectQuery).select(
      "_id name description status",
    );

    const organizationContext = isCurrentUser
      ? await buildUserOrganizationContext(user, {
          baseUrl:
            process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`,
          persistFallback: true,
        })
      : {
          organizationRoles: await buildScopedProfileRoles(
            user._id,
            req.organizationId,
          ),
        };

    res
      .status(200)
      .json(
        formatUserDetail(user, projects, organizationContext, {
          includeOrganizations: isCurrentUser,
        }),
      );
  } catch (error) {
    console.error("GetUserById error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, phone, position, role, status } = req.body;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update allowed fields
    if (fullName !== undefined) user.fullName = fullName;
    if (phone !== undefined) user.phone = phone;
    if (position !== undefined) user.position = position;
    if (role !== undefined) user.role = role;
    if (status !== undefined) user.status = status;

    await user.save();

    const projects = await Project.find({
      "members.userId": user._id,
    }).select("_id name description status");

    const organizationContext = await buildUserOrganizationContext(user, {
      baseUrl: process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`,
      persistFallback: true,
    });

    res
      .status(200)
      .json(formatUserDetail(user, projects, organizationContext));
  } catch (error) {
    console.error("UpdateUser error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// DELETE /users/:id - Xóa người dùng (bởi admin)
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("DeleteUser error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const projects = await Project.find({
      "members.userId": user._id,
    }).select("_id name description status");

    const organizationContext = await buildUserOrganizationContext(user, {
      baseUrl: process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`,
      persistFallback: true,
    });

    res
      .status(200)
      .json(formatUserDetail(user, projects, organizationContext));
  } catch (error) {
    console.error("GetMe error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const updates = normalizeProfileUpdates(req.body, user);
    Object.entries(updates).forEach(([key, value]) => {
      user[key] = value;
    });

    await user.save();

    const projects = await Project.find({
      "members.userId": user._id,
    }).select("_id name description status");

    const organizationContext = await buildUserOrganizationContext(user, {
      baseUrl: process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`,
      persistFallback: true,
    });

    res
      .status(200)
      .json(formatUserDetail(user, projects, organizationContext));
  } catch (error) {
    console.error("UpdateProfile error:", error.message);
    res
      .status(error.statusCode || 500)
      .json({
        message:
          error.statusCode === 400
            ? error.message
            : "Server error, please try again",
      });
  }
};

export const updateActivityStatus = async (req, res) => {
  try {
    const { activityStatus, expiresInMinutes } = req.body;

    if (!activityStatuses.has(activityStatus)) {
      return res.status(400).json({
        message: "activityStatus must be one of online, idle, dnd, invisible",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.activityStatus = activityStatus;
    if (activityStatus === "online") {
      user.activityStatusExpiresAt = null;
    } else if (
      Number.isFinite(Number(expiresInMinutes)) &&
      Number(expiresInMinutes) > 0
    ) {
      user.activityStatusExpiresAt = new Date(
        Date.now() + Number(expiresInMinutes) * 60 * 1000,
      );
    } else {
      user.activityStatusExpiresAt = null;
    }
    await user.save();
    scheduleActivityStatusExpiry(user);

    await emitActivityStatusChanged(user).catch((error) => {
      console.error("Emit activity status error:", error.message);
    });

    res.status(200).json(formatCurrentUser(user));
  } catch (error) {
    console.error("UpdateActivityStatus error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

export const streamAvatar = async (req, res) => {
  try {
    const storageKey =
      getSingleString(req.query.key).trim() ||
      extractAvatarStorageKeyFromUrl(getSingleString(req.query.url).trim());

    if (!storageKey || !isAvatarStorageKey(storageKey)) {
      return res.status(400).json({ message: "Invalid avatar key" });
    }

    const object = await getR2StorageService().getObjectStream({
      key: storageKey,
    });

    if (!object.body) {
      return res.status(404).json({ message: "Avatar not found" });
    }

    res.setHeader(
      "Content-Type",
      object.contentType || "application/octet-stream",
    );
    if (object.contentLength !== undefined) {
      res.setHeader("Content-Length", String(object.contentLength));
    }
    res.setHeader(
      "Content-Disposition",
      contentDisposition("inline", storageKey.split("/").pop() || "avatar"),
    );
    res.setHeader("Cache-Control", "private, max-age=3600");

    await pipeline(object.body, res);
  } catch (error) {
    console.error("StreamAvatar error:", error.message);
    return res.status(404).json({ message: "Avatar not found" });
  }
};

export const streamProfileBanner = async (req, res) => {
  try {
    const storageKey = getSingleString(req.query.key).trim();

    if (!storageKey || !isProfileBannerStorageKey(storageKey)) {
      return res.status(400).json({ message: "Invalid profile banner key" });
    }

    const object = await getR2StorageService().getObjectStream({
      key: storageKey,
    });

    if (!object.body) {
      return res.status(404).json({ message: "Profile banner not found" });
    }

    res.setHeader(
      "Content-Type",
      object.contentType || "application/octet-stream",
    );
    if (object.contentLength !== undefined) {
      res.setHeader("Content-Length", String(object.contentLength));
    }
    res.setHeader(
      "Content-Disposition",
      contentDisposition("inline", storageKey.split("/").pop() || "banner"),
    );
    res.setHeader("Cache-Control", "public, max-age=3600");

    await pipeline(object.body, res);
  } catch (error) {
    console.error("StreamProfileBanner error:", error.message);
    return res.status(404).json({ message: "Profile banner not found" });
  }
};

export const updateAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const validation = await validateProfileImageFile(req.file, {
      label: "Avatar",
      maxSizeBytes: MAX_AVATAR_SIZE_BYTES,
    });
    const storage = getR2StorageService();
    const storageKey = buildR2AvatarKey(
      req.user._id.toString(),
      validation.safeName,
    );

    await storage.putObject({
      key: storageKey,
      body: req.file.buffer,
      contentType: validation.mimeType,
      contentLength: req.file.size,
      metadata: {
        userId: req.user._id.toString(),
        mediaType: "avatar",
      },
    });

    const oldStorageKey = extractAvatarStorageKeyFromUrl(user.avatar);
    user.avatar = buildAvatarProxyUrl(storageKey);

    await user.save();

    if (oldStorageKey && oldStorageKey !== storageKey) {
      storage.deleteObject({ key: oldStorageKey }).catch(() => {});
    }

    res.status(200).json({
      avatarUrl: user.avatar,
    });
  } catch (error) {
    console.error("UpdateAvatar error:", error.message);
    res
      .status(error.statusCode || 500)
      .json({
        message:
          error.statusCode === 400
            ? error.message
            : "Server error, please try again",
      });
  }
};

export const updateProfileBanner = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "+profileBannerStorageKey",
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const validation = await validateProfileImageFile(req.file, {
      label: "Profile banner",
      maxSizeBytes: MAX_PROFILE_BANNER_SIZE_BYTES,
    });
    const storage = getR2StorageService();
    const storageKey = buildR2ProfileBannerKey(
      req.user._id.toString(),
      validation.safeName,
    );

    await storage.putObject({
      key: storageKey,
      body: req.file.buffer,
      contentType: validation.mimeType,
      contentLength: req.file.size,
      metadata: {
        userId: req.user._id.toString(),
        mediaType: "profile-banner",
      },
    });

    const oldStorageKey = user.profileBannerStorageKey;
    user.profileBannerStorageKey = storageKey;
    user.profileBannerUrl = buildProfileBannerProxyUrl(storageKey);
    user.profileTheme = normalizeProfileTheme(
      { ...(user.profileTheme?.toObject?.() || user.profileTheme), useBannerImage: true },
      user.profileTheme,
    );
    await user.save();

    if (oldStorageKey && oldStorageKey !== storageKey) {
      storage.deleteObject({ key: oldStorageKey }).catch(() => {});
    }

    res.status(200).json({
      bannerUrl: user.profileBannerUrl,
      profileBannerUrl: user.profileBannerUrl,
      profileTheme: formatProfileTheme(user.profileTheme),
    });
  } catch (error) {
    console.error("UpdateProfileBanner error:", error.message);
    res
      .status(error.statusCode || 500)
      .json({
        message:
          error.statusCode === 400
            ? error.message
            : "Server error, please try again",
      });
  }
};

export const deleteProfileBanner = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "+profileBannerStorageKey",
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const oldStorageKey = user.profileBannerStorageKey;
    user.profileBannerStorageKey = "";
    user.profileBannerUrl = "";
    user.profileTheme = normalizeProfileTheme(
      { ...(user.profileTheme?.toObject?.() || user.profileTheme), useBannerImage: false },
      user.profileTheme,
    );
    await user.save();

    if (oldStorageKey) {
      getR2StorageService().deleteObject({ key: oldStorageKey }).catch(() => {});
    }

    res.status(200).json({
      profileBannerUrl: "",
      profileTheme: formatProfileTheme(user.profileTheme),
    });
  } catch (error) {
    console.error("DeleteProfileBanner error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// GET /users/me/preferences - Lấy cài đặt cá nhân
export const getPreferences = async (req, res) => {
  try {
    let preferences = await UserPreference.findOne({ userId: req.user._id });

    // If preferences don't exist, create default ones
    if (!preferences) {
      preferences = await UserPreference.create({
        userId: req.user._id,
      });
    }

    res.status(200).json({
      notifications: preferences.notifications,
      theme: preferences.theme,
      language: preferences.language,
    });
  } catch (error) {
    console.error("GetPreferences error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// PUT /users/me/preferences - Cập nhật cài đặt cá nhân
export const updatePreferences = async (req, res) => {
  try {
    const { notifications, theme, language } = req.body;

    const preferences = await UserPreference.findOneAndUpdate(
      { userId: req.user._id },
      {
        $set: {
          ...(notifications && { notifications }),
          ...(theme && { theme }),
          ...(language && { language }),
        },
      },
      {
        upsert: true, // Create if not exists
        new: true,
        runValidators: true,
      },
    );

    res.status(200).json({ message: "Preferences updated successfully" });
  } catch (error) {
    console.error("UpdatePreferences error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// GET /users/:id/activities - Lấy nhật ký hoạt động của user
export const getUserActivities = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, targetType, page = 1, size = 10 } = req.query;

    // Build filter object
    const filter = { userId: id };
    if (action) filter.action = action;
    if (targetType) filter.targetType = targetType;

    // Validate user exists
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.max(1, parseInt(size));
    const skip = (pageNum - 1) * pageSize;

    const [activities, totalElements] = await Promise.all([
      ActivityLog.find(filter)
        .skip(skip)
        .limit(pageSize)
        .sort({ createdAt: -1 }),
      ActivityLog.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalElements / pageSize);

    res.status(200).json({
      content: activities,
      totalElements,
      totalPages,
      currentPage: pageNum,
      pageSize,
    });
  } catch (error) {
    console.error("GetUserActivities error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};
