import express from "express";
import {
  getDepartments,
  createDepartment,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
  getDepartmentMembers,
  addDepartmentMember,
  removeDepartmentMember,
} from "../presenters/departmentPresenter.js";
import protect from "../middlewares/authMiddleware.js";
import admin from "../middlewares/adminMiddleware.js";

const router = express.Router();

// Any authenticated user
router.get("/", protect, getDepartments);
router.get("/:id", protect, getDepartmentById);
router.get("/:id/members", protect, getDepartmentMembers);

// Admin only
router.post("/", admin, createDepartment);
router.put("/:id", admin, updateDepartment);
router.delete("/:id", admin, deleteDepartment);
router.post("/:id/members", admin, addDepartmentMember);
router.delete("/:id/members/:userId", admin, removeDepartmentMember);

export default router;
