import express from "express";
import protect from "../middlewares/authMiddleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  createOrganizationInvite,
  createOrganization,
  createOrganizationRole,
  deleteOrganizationInvite,
  deleteOrganizationRole,
  getMyOrganizations,
  getOrganizationDetail,
  getOrganizationInvites,
  getOrganizationInvite,
  getOrganizationMembers,
  getOrganizationOverview,
  getOrganizationRoleList,
  joinOrganization,
  leaveOrganization,
  pauseOrganizationInvites,
  reviewOrganizationJoinRequest,
  streamOrganizationBanner,
  streamOrganizationLogo,
  switchOrganization,
  updateOrganizationInvite,
  updateOrganizationMember,
  updateOrganization,
  updateOrganizationBanner,
  updateOrganizationFavorite,
  updateOrganizationLogo,
  updateOrganizationRole,
  updateOrganizationSettings,
} from "../presenters/organizationPresenter.js";
import upload from "../config/multer.js";

const router = express.Router();

router.get("/", protect, asyncHandler(getMyOrganizations));
router.post("/", protect, asyncHandler(createOrganization));
router.get("/logos", asyncHandler(streamOrganizationLogo));
router.get("/banners", asyncHandler(streamOrganizationBanner));
router.post("/join", protect, asyncHandler(joinOrganization));
router.post("/join/:inviteCode", protect, asyncHandler(joinOrganization));
router.patch("/switch", protect, asyncHandler(switchOrganization));
router.get("/:id", protect, asyncHandler(getOrganizationDetail));
router.get("/:id/overview", protect, asyncHandler(getOrganizationOverview));
router.get("/:id/members", protect, asyncHandler(getOrganizationMembers));
router.get("/:id/invite", protect, asyncHandler(getOrganizationInvite));
router.get("/:id/roles", protect, asyncHandler(getOrganizationRoleList));
router.post("/:id/roles", protect, asyncHandler(createOrganizationRole));
router.patch("/:id/roles/:roleId", protect, asyncHandler(updateOrganizationRole));
router.delete("/:id/roles/:roleId", protect, asyncHandler(deleteOrganizationRole));
router.get("/:id/invites", protect, asyncHandler(getOrganizationInvites));
router.post("/:id/invites", protect, asyncHandler(createOrganizationInvite));
router.patch("/:id/invites/pause", protect, asyncHandler(pauseOrganizationInvites));
router.patch(
  "/:id/invites/:inviteId",
  protect,
  asyncHandler(updateOrganizationInvite),
);
router.delete(
  "/:id/invites/:inviteId",
  protect,
  asyncHandler(deleteOrganizationInvite),
);
router.patch("/:id/settings", protect, asyncHandler(updateOrganizationSettings));
router.patch("/:id/favorite", protect, asyncHandler(updateOrganizationFavorite));
router.patch(
  "/:id/members/:memberId",
  protect,
  asyncHandler(updateOrganizationMember),
);
router.patch(
  "/:id/members/:memberId/review",
  protect,
  asyncHandler(reviewOrganizationJoinRequest),
);
router.patch(
  "/:id/logo",
  protect,
  upload.single("logo"),
  asyncHandler(updateOrganizationLogo),
);
router.patch(
  "/:id/banner",
  protect,
  upload.single("banner"),
  asyncHandler(updateOrganizationBanner),
);
router.patch("/:id", protect, asyncHandler(updateOrganization));
router.delete("/:id/members/me", protect, asyncHandler(leaveOrganization));

export default router;
