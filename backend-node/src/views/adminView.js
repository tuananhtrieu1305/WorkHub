import express from "express";
import protect from "../middlewares/authMiddleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import { requireAdmin } from "../services/adminPermissionService.js";
import {
  dashboard,
  listActivityLogs,
  lockUser,
  resetUserPassword,
  unlockUser,
  userAnalytics,
} from "../presenters/adminPresenter.js";

const router = express.Router();

router.use(protect, requireAdmin);

router.get("/activity-logs", asyncHandler(listActivityLogs));
router.patch("/users/:id/lock", asyncHandler(lockUser));
router.patch("/users/:id/unlock", asyncHandler(unlockUser));
router.post("/users/:id/reset-password", asyncHandler(resetUserPassword));
router.get("/dashboard", asyncHandler(dashboard));
router.get("/analytics/users", asyncHandler(userAnalytics));

export default router;
