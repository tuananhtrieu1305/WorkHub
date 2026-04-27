import ActivityLog from "../models/ActivityLog.js";
import ApiError from "../utils/apiError.js";

const DEFAULT_PAGE = 1;
const DEFAULT_SIZE = 20;
const MAX_SIZE = 100;
const REDACTED = "[REDACTED]";
const TRUNCATED = "[TRUNCATED]";

const SENSITIVE_KEY_PATTERNS = [
  "password",
  "passwd",
  "jwt",
  "token",
  "authorization",
  "authheader",
  "secret",
  "apikey",
  "api_key",
  "accesskey",
  "access_key",
  "privatekey",
  "private_key",
  "sharetoken",
  "rawsharetoken",
  "filecontent",
  "filecontents",
  "filebuffer",
  "rawfile",
  "rawbytes",
];

const parsePage = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PAGE;
};

const parseSize = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SIZE;
  return Math.min(parsed, MAX_SIZE);
};

const parseLimit = (filters = {}) => parseSize(filters.limit || filters.size);

const parseDate = (value, label) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, `Invalid ${label} date`);
  }
  return date;
};

const isPlainObject = (value) => {
  return Object.prototype.toString.call(value) === "[object Object]";
};

const isSensitiveKey = (key) => {
  const normalized = String(key).replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((pattern) => normalized.includes(pattern));
};

const looksLikeJwt = (value) => {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
  );
};

export const redactSensitiveMetadata = (metadata, depth = 0) => {
  if (metadata === null || metadata === undefined) return metadata;
  if (looksLikeJwt(metadata)) return REDACTED;
  if (depth > 6) return TRUNCATED;

  if (Array.isArray(metadata)) {
    return metadata.slice(0, 50).map((item) => redactSensitiveMetadata(item, depth + 1));
  }

  if (!isPlainObject(metadata)) {
    return metadata;
  }

  return Object.entries(metadata).reduce((safeMetadata, [key, value]) => {
    if (isSensitiveKey(key)) {
      safeMetadata[key] = REDACTED;
      return safeMetadata;
    }

    safeMetadata[key] = redactSensitiveMetadata(value, depth + 1);
    return safeMetadata;
  }, {});
};

const buildDateFilter = ({ fromDate, toDate }) => {
  const createdAt = {};
  const from = parseDate(fromDate, "from");
  const to = parseDate(toDate, "to");

  if (from) {
    createdAt.$gte = from;
  }

  if (to) {
    createdAt.$lte = to;
  }

  return Object.keys(createdAt).length > 0 ? createdAt : undefined;
};

const applyOptionalFilters = (query, filters = {}) => {
  const optionalKeys = [
    "action",
    "actorId",
    "actorType",
    "targetUserId",
    "projectId",
    "departmentId",
    "entityType",
    "entityId",
  ];

  optionalKeys.forEach((key) => {
    if (filters[key]) {
      query[key] = filters[key];
    }
  });

  const createdAt = buildDateFilter(filters);
  if (createdAt) {
    query.createdAt = createdAt;
  }

  return query;
};

const listActivityLogs = async (query, filters = {}) => {
  const page = parsePage(filters.page);
  const limit = parseLimit(filters);

  const [content, totalElements] = await Promise.all([
    ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    ActivityLog.countDocuments(query),
  ]);

  return {
    content,
    totalElements,
  };
};

export const logActivity = async (payload) => {
  const safePayload = {
    actorId: payload.actorId || null,
    actorType: payload.actorType || (payload.actorId ? "user" : "system"),
    action: payload.action,
    entityType: payload.entityType,
    entityId: payload.entityId || null,
    projectId: payload.projectId || null,
    departmentId: payload.departmentId || null,
    targetUserId: payload.targetUserId || null,
    metadata: redactSensitiveMetadata(payload.metadata || {}),
    ipAddress: payload.ipAddress || null,
    userAgent: payload.userAgent || null,
  };

  return ActivityLog.create(safePayload);
};

export const listByEntity = async (entityType, entityId, filters = {}) => {
  const query = applyOptionalFilters(
    {
      entityType,
      entityId,
    },
    filters,
  );

  return listActivityLogs(query, filters);
};

export const listForAdmin = async (filters = {}) => {
  const query = applyOptionalFilters({}, filters);

  return listActivityLogs(query, filters);
};

export default {
  logActivity,
  listByEntity,
  listForAdmin,
  redactSensitiveMetadata,
};
