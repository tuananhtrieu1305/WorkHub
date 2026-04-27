import ApiError from "../utils/apiError.js";
import User from "../models/User.js";
import { listForAdmin, logActivity } from "../services/activityLogService.js";
import { createNotification } from "../services/notificationService.js";
import {
  getDashboardStats,
  getUserAnalytics,
} from "../services/adminStatsService.js";

const auditContext = (req) => ({
  ipAddress: req.ip,
  userAgent: req.get("user-agent") || null,
});

const sanitizeUser = (user) => {
  const data = user?.toObject?.() || user;
  if (!data) return data;

  const {
    password,
    verificationOTP,
    verificationOTPExpires,
    resetPasswordToken,
    resetPasswordExpires,
    ...safe
  } = data;

  return safe;
};

export const listActivityLogs = async (req, res) => {
  const result = await listForAdmin({
    ...req.query,
    fromDate: req.query.from,
    toDate: req.query.to,
  });

  res.json(result);
};

export const lockUser = async (req, res) => {
  const reason = req.body.reason || "";
  const user = await User.findByIdAndUpdate(
    req.params.id,
    {
      status: "locked",
      lockedAt: new Date(),
      lockedBy: req.user._id,
      lockReason: reason,
    },
    { new: true, runValidators: true },
  );

  if (!user) throw new ApiError(404, "User not found");

  await logActivity({
    actorId: req.user._id,
    actorType: "user",
    action: "admin.user.locked",
    entityType: "user",
    entityId: user._id,
    targetUserId: user._id,
    metadata: { reason },
    ...auditContext(req),
  });

  await createNotification({
    userId: user._id,
    type: "admin_action",
    title: "Account locked",
    message: "Your WorkHub account has been locked by an administrator.",
    entityType: "user",
    entityId: user._id,
    actorId: req.user._id,
    data: { reason },
  }).catch(() => null);

  res.json(sanitizeUser(user));
};

export const unlockUser = async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    {
      status: "active",
      lockedAt: null,
      lockedBy: null,
      lockReason: "",
    },
    { new: true, runValidators: true },
  );

  if (!user) throw new ApiError(404, "User not found");

  await logActivity({
    actorId: req.user._id,
    actorType: "user",
    action: "admin.user.unlocked",
    entityType: "user",
    entityId: user._id,
    targetUserId: user._id,
    metadata: {},
    ...auditContext(req),
  });

  res.json(sanitizeUser(user));
};

export const resetUserPassword = async (req, res) => {
  await logActivity({
    actorId: req.user._id,
    actorType: "user",
    action: "admin.user.password_reset_requested",
    entityType: "user",
    entityId: req.params.id,
    targetUserId: req.params.id,
    metadata: {
      reason: "Admin password reset endpoint is not enabled yet",
    },
    ...auditContext(req),
  });

  throw new ApiError(
    501,
    "Admin password reset is not enabled yet. Use the existing forgot-password flow.",
  );
};

export const dashboard = async (req, res) => {
  res.json(await getDashboardStats());
};

export const userAnalytics = async (req, res) => {
  res.json(
    await getUserAnalytics({
      granularity: req.query.granularity,
      from: req.query.from,
      to: req.query.to,
    }),
  );
};
