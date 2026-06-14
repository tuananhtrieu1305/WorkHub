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
  streamOrganizationLogo,
  switchOrganization,
  updateOrganization,
  updateOrganizationLogo,
} from "../presenters/organizationPresenter.js";
import upload from "../config/multer.js";

const router = express.Router();

router.get("/", protect, asyncHandler(getMyOrganizations));
router.post("/", protect, asyncHandler(createOrganization));
router.get("/logos", asyncHandler(streamOrganizationLogo));
router.post("/join", protect, asyncHandler(joinOrganization));
router.post("/join/:inviteCode", protect, asyncHandler(joinOrganization));
router.patch("/switch", protect, asyncHandler(switchOrganization));
router.get("/:id/members", protect, asyncHandler(getOrganizationMembers));
router.get("/:id/invite", protect, asyncHandler(getOrganizationInvite));
router.patch(
  "/:id/logo",
  protect,
  upload.single("logo"),
  asyncHandler(updateOrganizationLogo),
);
router.patch("/:id", protect, asyncHandler(updateOrganization));
router.delete("/:id/members/me", protect, asyncHandler(leaveOrganization));

export default router;
