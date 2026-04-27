import express from "express";
import {
  getProjects,
  createProject,
  getProjectById,
  updateProject,
  deleteProject,
  getProjectMembers,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
  getProjectTasks,
} from "../presenters/projectPresenter.js";
import protect from "../middlewares/authMiddleware.js";
import admin from "../middlewares/adminMiddleware.js";

const router = express.Router();

// Any authenticated user
router.get("/", protect, getProjects);
router.post("/", protect, createProject);
router.get("/:id", protect, getProjectById);
router.put("/:id", protect, updateProject);
router.get("/:id/members", protect, getProjectMembers);
router.post("/:id/members", protect, addProjectMember);
router.put("/:id/members/:userId", protect, updateProjectMemberRole);
router.delete("/:id/members/:userId", protect, removeProjectMember);
router.get("/:id/tasks", protect, getProjectTasks);

// Admin only
router.delete("/:id", admin, deleteProject);

export default router;
