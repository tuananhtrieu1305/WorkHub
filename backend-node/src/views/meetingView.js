import express from "express";
import protect from "../middlewares/authMiddleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  createMeeting,
  endMeeting,
  getMeeting,
  heartbeatMeeting,
  joinMeeting,
  leaveMeeting,
  listMeetings,
  markMeetingJoined,
} from "../presenters/meetingPresenter.js";

const router = express.Router();

router.post("/", protect, asyncHandler(createMeeting));
router.get("/", protect, asyncHandler(listMeetings));
router.get("/:id", protect, asyncHandler(getMeeting));
router.post("/:id/join", protect, asyncHandler(joinMeeting));
router.post("/:id/joined", protect, asyncHandler(markMeetingJoined));
router.post("/:id/heartbeat", protect, asyncHandler(heartbeatMeeting));
router.post("/:id/leave", protect, asyncHandler(leaveMeeting));
router.patch("/:id/end", protect, asyncHandler(endMeeting));

export default router;