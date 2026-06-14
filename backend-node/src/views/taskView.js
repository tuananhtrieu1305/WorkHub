import express from "express";
import protect from "../middlewares/authMiddleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  addAssignees,
  addChecklistItem,
  createTask,
  deleteChecklistItem,
  deleteTask,
  getTask,
  listMyTasks,
  listProjectTasks,
  listTasks,
  removeAssignee,
  updateChecklistItem,
  updateTask,
} from "../presenters/taskPresenter.js";

const router = express.Router();
const projectTaskRouter = express.Router();

router.post("/", protect, asyncHandler(createTask));
router.get("/", protect, asyncHandler(listTasks));
router.get("/my", protect, asyncHandler(listMyTasks));
router.get("/:id", protect, asyncHandler(getTask));
router.patch("/:id", protect, asyncHandler(updateTask));
router.delete("/:id", protect, asyncHandler(deleteTask));
router.post("/:id/assignees", protect, asyncHandler(addAssignees));
router.delete("/:id/assignees/:userId", protect, asyncHandler(removeAssignee));
router.post("/:id/checklist", protect, asyncHandler(addChecklistItem));
router.patch("/:id/checklist/:itemId", protect, asyncHandler(updateChecklistItem));
router.delete("/:id/checklist/:itemId", protect, asyncHandler(deleteChecklistItem));

projectTaskRouter.get("/:projectId/tasks", protect, asyncHandler(listProjectTasks));

export { projectTaskRouter };
export default router;
