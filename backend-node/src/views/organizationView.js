import express from "express";
import protect from "../middlewares/authMiddleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  createOrganization,
  getMyOrganizations,
  getOrganizationInvite,
  getOrganizationMembers,
  joinOrganization,
  leaveOrganization,
  switchOrganization,
  updateOrganization,
} from "../presenters/organizationPresenter.js";

const router = express.Router();

router.get("/", protect, asyncHandler(getMyOrganizations));
router.post("/", protect, asyncHandler(createOrganization));
router.post("/join", protect, asyncHandler(joinOrganization));
router.post("/join/:inviteCode", protect, asyncHandler(joinOrganization));
router.patch("/switch", protect, asyncHandler(switchOrganization));
router.get("/:id/members", protect, asyncHandler(getOrganizationMembers));
router.get("/:id/invite", protect, asyncHandler(getOrganizationInvite));
router.patch("/:id", protect, asyncHandler(updateOrganization));
router.delete("/:id/members/me", protect, asyncHandler(leaveOrganization));

export default router;
