import express from "express";
import protect from "../middlewares/authMiddleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  deleteNotification,
  getNotificationSettings,
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  patchNotificationSettings,
} from "../presenters/notificationPresenter.js";

const router = express.Router();

router.get("/", protect, asyncHandler(listNotifications));
router.get("/unread-count", protect, asyncHandler(getUnreadCount));
router.patch("/read-all", protect, asyncHandler(markAllNotificationsRead));
router.get("/settings", protect, asyncHandler(getNotificationSettings));
router.patch("/settings", protect, asyncHandler(patchNotificationSettings));
router.patch("/:id/read", protect, asyncHandler(markNotificationRead));
router.delete("/:id", protect, asyncHandler(deleteNotification));

export default router;
