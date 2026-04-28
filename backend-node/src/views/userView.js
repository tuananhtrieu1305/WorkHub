import express from "express";
import {
  getUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  getMe,
  searchUsersForChat,
  updateProfile,
  updateActivityStatus,
  updateAvatar,
  getPreferences,
  updatePreferences,
  getUserActivities,
} from "../presenters/userPresenter.js";
import protect from "../middlewares/authMiddleware.js";
import admin from "../middlewares/adminMiddleware.js";
import upload from "../config/multer.js";

const router = express.Router();

// Profile endpoints (for /me)
router.get("/me", protect, getMe);
router.put("/me", protect, updateProfile);
router.patch("/me/activity-status", protect, updateActivityStatus);
router.put("/me/avatar", protect, upload.single("avatar"), updateAvatar);
router.get("/me/preferences", protect, getPreferences);
router.put("/me/preferences", protect, updatePreferences);
router.get("/search", protect, searchUsersForChat);

// Admin endpoints
router.get("/", admin, getUsers);
router.post("/", admin, createUser);
router.put("/:id", admin, updateUser);
router.delete("/:id", admin, deleteUser);
router.get("/:id/activities", admin, getUserActivities);

// Public endpoints (requires protect middleware)
router.get("/:id", protect, getUserById);

export default router;
