import express from "express";
import protect from "../middlewares/authMiddleware.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  acceptCall,
  answerIntent,
  cancelCall,
  declineCall,
  endCall,
  failCall,
  getCall,
  heartbeatCall,
  joinedCall,
  joinToken,
  prepareCall,
  ringCall,
} from "../presenters/callPresenter.js";

const router = express.Router();

router.post("/prepare", protect, asyncHandler(prepareCall));
router.get("/:id", protect, asyncHandler(getCall));
router.post("/:id/ring", protect, asyncHandler(ringCall));
router.post("/:id/answer-intent", protect, asyncHandler(answerIntent));
router.post("/:id/accept", protect, asyncHandler(acceptCall));
router.post("/:id/decline", protect, asyncHandler(declineCall));
router.post("/:id/cancel", protect, asyncHandler(cancelCall));
router.post("/:id/fail", protect, asyncHandler(failCall));
router.post("/:id/join-token", protect, asyncHandler(joinToken));
router.post("/:id/joined", protect, asyncHandler(joinedCall));
router.post("/:id/heartbeat", protect, asyncHandler(heartbeatCall));
router.patch("/:id/end", protect, asyncHandler(endCall));

export default router;
