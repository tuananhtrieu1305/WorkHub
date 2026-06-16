import mongoose from "mongoose";
import Call from "../models/Call.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import ApiError from "../utils/apiError.js";
import { getRealtimeMeetingService } from "../services/realtimeMeetingService.js";
import { getRequestOrganizationId } from "../utils/organizationScope.js";
import {
  acquireUserLock,
  releaseCallLocks,
  releaseUserLock,
} from "../services/callLockService.js";
import { isUserOnline } from "../services/presenceService.js";
import {
  applyCallHeartbeat,
  isCallHeartbeatStale,
} from "../utils/callPolicy.js";

const PREPARING_TIMEOUT_MS = 15000;
const RINGING_TIMEOUT_MS = 30000;
const ANSWERING_TIMEOUT_MS = 15000;
const CONNECTING_TIMEOUT_MS = 45000;
const RECONCILE_INTERVAL_MS = 10000;

const TERMINAL_STATUSES = new Set([
  "declined",
  "cancelled",
  "missed",
  "busy",
  "failed",
  "ended",
]);

const CALL_EVENTS_BY_STATUS = {
  declined: "call_declined",
  cancelled: "call_cancelled",
  missed: "call_missed",
  busy: "call_busy",
  failed: "call_failed",
  ended: "call_ended",
};

let callIo = null;
let reconcileInterval = null;

export const setCallIo = (io) => {
  callIo = io;
};

const toId = (value) => String(value?._id || value || "");

const isSameId = (a, b) => toId(a) === toId(b);

const isTerminalCall = (call) => TERMINAL_STATUSES.has(call?.status);

const getSingleString = (value) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const getCallRole = (call, user) => {
  const userId = toId(user);
  if (toId(call?.callerUserId) === userId) return "caller";
  if (toId(call?.calleeUserId) === userId) return "callee";
  return "";
};

const assertCallParticipant = (call, user) => {
  if (toId(call?.organizationId) !== toId(user?.activeOrganizationId)) {
    throw new ApiError(404, "Call not found");
  }
  const role = getCallRole(call, user);
  if (!role) {
    throw new ApiError(403, "You are not a participant of this call");
  }
  return role;
};

const serializeParticipant = (participant) => ({
  userId: toId(participant.userId),
  role: participant.role,
  browserDeviceId: participant.browserDeviceId || "",
  tabInstanceId: participant.tabInstanceId || "",
  socketId: participant.socketId || "",
  cloudflareParticipantId: participant.cloudflareParticipantId || "",
  activeDeviceId: participant.activeDeviceId || "",
  tokenIssuedAt: participant.tokenIssuedAt || null,
  mediaPermissionGrantedAt: participant.mediaPermissionGrantedAt || null,
  joinedAt: participant.joinedAt || null,
  leftAt: participant.leftAt || null,
  lastHeartbeatAt: participant.lastHeartbeatAt || null,
  disconnectedAt: participant.disconnectedAt || null,
});

const serializeCall = (call) => {
  const data = call?.toObject ? call.toObject() : call;
  if (!data) return null;

  return {
    id: toId(data._id),
    organizationId: toId(data.organizationId),
    callerUserId: toId(data.callerUserId),
    calleeUserId: toId(data.calleeUserId),
    conversationId: toId(data.conversationId),
    mediaType: data.mediaType,
    status: data.status,
    statusReason: data.statusReason || "",
    cloudflareMeetingId: data.cloudflareMeetingId || "",
    cloudflareSessionId: data.cloudflareSessionId || "",
    callerBrowserDeviceId: data.callerBrowserDeviceId || "",
    callerTabInstanceId: data.callerTabInstanceId || "",
    answeredByBrowserDeviceId: data.answeredByBrowserDeviceId || "",
    answeredByTabInstanceId: data.answeredByTabInstanceId || "",
    preparingExpiresAt: data.preparingExpiresAt || null,
    ringingExpiresAt: data.ringingExpiresAt || null,
    answeringExpiresAt: data.answeringExpiresAt || null,
    acceptedAt: data.acceptedAt || null,
    connectedAt: data.connectedAt || null,
    endedAt: data.endedAt || null,
    durationSeconds: data.durationSeconds || 0,
    participants: (data.participants || []).map(serializeParticipant),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
};

const serializeUser = (user) => {
  if (!user) return null;
  return {
    id: toId(user._id || user.id),
    _id: toId(user._id || user.id),
    fullName: user.fullName || "",
    avatar: user.avatar || "",
  };
};

const getUserSummary = async (userId) => {
  const user = await User.findById(userId).select("_id fullName avatar");
  return serializeUser(user);
};

const buildCallPayload = async (call) => ({
  call: serializeCall(call),
  caller: await getUserSummary(call.callerUserId),
  callee: await getUserSummary(call.calleeUserId),
});

const emitToUser = (userId, event, payload) => {
  callIo?.to?.(`user:${toId(userId)}`)?.emit?.(event, payload);
};

const emitToCallUsers = (call, event, payload) => {
  emitToUser(call.callerUserId, event, payload);
  emitToUser(call.calleeUserId, event, payload);
};

const formatCallDuration = (seconds) => {
  if (!seconds) return "";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
};

const getSystemMessageContent = (call, eventType) => {
  const label = call.mediaType === "audio" ? "audio" : "video";
  if (eventType === "call_ended") {
    const duration = formatCallDuration(call.durationSeconds || 0);
    return duration
      ? `Cuoc goi ${label} da ket thuc - ${duration}`
      : `Cuoc goi ${label} da ket thuc`;
  }
  if (eventType === "call_missed") return `Cuoc goi ${label} nho`;
  if (eventType === "call_declined") return `Cuoc goi ${label} da bi tu choi`;
  if (eventType === "call_cancelled") return `Cuoc goi ${label} da bi huy`;
  if (eventType === "call_busy") return `May ban cho cuoc goi ${label}`;
  return `Cuoc goi ${label} that bai`;
};

const formatMessageForSocket = async (message) => {
  const sender = await User.findById(message.senderId).select(
    "_id fullName avatar activityStatus activityStatusExpiresAt",
  );
  return {
    id: toId(message._id),
    conversationId: message.conversationId,
    sender: {
      _id: toId(sender?._id),
      id: toId(sender?._id),
      fullName: sender?.fullName || "",
      avatar: sender?.avatar || "",
      activityStatus: sender?.activityStatus,
      activityStatusExpiresAt: sender?.activityStatusExpiresAt,
    },
    type: message.type,
    content: message.content,
    metadata: message.metadata || {},
    attachments: message.attachments || [],
    mentions: message.mentions || [],
    replyTo: null,
    reactions: message.reactions || [],
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
};

const createCallSystemMessage = async (call, eventType) => {
  if (!call?.conversationId || !eventType) return null;

  const message = await Message.create({
    conversationId: call.conversationId,
    organizationId: call.organizationId,
    senderId: call.callerUserId,
    type: "system",
    content: getSystemMessageContent(call, eventType),
    metadata: {
      eventType,
      callId: toId(call._id),
      mediaType: call.mediaType,
      durationSeconds: call.durationSeconds || 0,
      reason: call.statusReason || "",
    },
    attachments: [],
    mentions: [],
    replyTo: null,
  });

  await Conversation.findByIdAndUpdate(call.conversationId, {
    $set: {
      lastMessage: {
        content: message.content,
        senderId: message.senderId,
        createdAt: message.createdAt,
      },
    },
  });

  if (callIo) {
    const messageData = await formatMessageForSocket(message);
    callIo.to(`conversation:${call.conversationId}`).emit("new_message", messageData);
  }

  return message;
};

const loadConversationForCall = async (
  conversationId,
  callerUserId,
  calleeUserId,
  organizationId,
) => {
  const conversation = await Conversation.findOne({
    _id: conversationId,
    organizationId,
  });
  if (!conversation) throw new ApiError(404, "Conversation not found");
  if (conversation.type !== "private") {
    throw new ApiError(400, "Calls are only supported in private conversations");
  }

  const participantIds = (conversation.participants || []).map((participant) =>
    toId(participant.userId),
  );
  if (
    !participantIds.includes(toId(callerUserId)) ||
    !participantIds.includes(toId(calleeUserId)) ||
    participantIds.length !== 2
  ) {
    throw new ApiError(403, "Both users must be conversation participants");
  }

  return conversation;
};

const loadCall = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(String(id))) {
    throw new ApiError(400, "Invalid call id");
  }
  const call = await Call.findById(id);
  if (!call) throw new ApiError(404, "Call not found");
  return call;
};

const updateParticipant = (participants, userId, updates) => {
  const targetUserId = toId(userId);
  let matched = false;
  const nextParticipants = (participants || []).map((participant) => {
    if (toId(participant.userId) !== targetUserId) return participant;
    matched = true;
    return { ...participant, ...updates };
  });
  return { participants: nextParticipants, matched };
};

const callRealtimeProvider = async (operation, safeMessage) => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, safeMessage);
  }
};

const getProviderParticipantId = (participant) =>
  participant?.id || participant?.participantId || null;

const completeCall = async (
  call,
  status,
  statusReason,
  { emitEvent = true, createMessage = true } = {},
) => {
  const now = new Date();
  const durationSeconds =
    status === "ended" && call.connectedAt
      ? Math.max(0, Math.round((now.getTime() - new Date(call.connectedAt).getTime()) / 1000))
      : call.durationSeconds || 0;

  const setFields = {
    status,
    statusReason: statusReason || call.statusReason || "",
    endedAt: call.endedAt || now,
    durationSeconds,
  };
  if (call.participants) {
    setFields.participants = call.participants;
  }

  const updated = await Call.findByIdAndUpdate(
    call._id,
    {
      $set: setFields,
    },
    { new: true },
  );
  const terminalCall = updated || {
    ...call,
    status,
    statusReason,
    endedAt: now,
    durationSeconds,
  };

  releaseCallLocks(terminalCall._id);

  if (createMessage) {
    await createCallSystemMessage(
      terminalCall,
      CALL_EVENTS_BY_STATUS[status] || "call_failed",
    );
  }

  if (emitEvent) {
    const payload = await buildCallPayload(terminalCall);
    emitToCallUsers(terminalCall, `call:${status}`, payload);
  }

  if (terminalCall.cloudflareMeetingId && ["failed", "ended"].includes(status)) {
    const realtimeService = getRealtimeMeetingService();
    await realtimeService
      .kickAllParticipants?.({ meetingId: terminalCall.cloudflareMeetingId })
      .catch(() => {});
  }

  return terminalCall;
};

export const prepareCall = async (req, res) => {
  const conversationId = getSingleString(req.body?.conversationId);
  const calleeUserId = getSingleString(req.body?.calleeUserId);
  const mediaType = getSingleString(req.body?.mediaType);
  const browserDeviceId = getSingleString(req.body?.browserDeviceId);
  const tabInstanceId = getSingleString(req.body?.tabInstanceId);
  const callId = new mongoose.Types.ObjectId();

  if (!conversationId || !calleeUserId) {
    throw new ApiError(400, "Conversation and callee are required");
  }
  if (!["audio", "video"].includes(mediaType)) {
    throw new ApiError(400, "mediaType must be audio or video");
  }
  if (isSameId(req.user._id, calleeUserId)) {
    throw new ApiError(400, "Cannot call yourself");
  }

  const activeOrganizationId = getRequestOrganizationId(req);
  if (!activeOrganizationId) {
    throw new ApiError(
      409,
      "Please create or join an organization before starting a call",
      "NO_ACTIVE_ORGANIZATION",
    );
  }
  const conversation = await loadConversationForCall(
    conversationId,
    req.user._id,
    calleeUserId,
    activeOrganizationId,
  );
  const callee = await User.findById(calleeUserId).select("_id activityStatus");
  if (!callee) throw new ApiError(404, "Callee not found");
  if (!isUserOnline(calleeUserId) || callee.activityStatus === "invisible") {
    throw new ApiError(409, "Callee is unavailable", "CALLEE_UNAVAILABLE");
  }

  const lock = acquireUserLock(req.user._id, callId);
  if (!lock.ok) {
    throw new ApiError(409, "Caller is busy", "CALL_BUSY");
  }

  try {
    const call = await Call.create({
      _id: callId,
      callerUserId: req.user._id,
      calleeUserId,
      conversationId,
      organizationId: conversation.organizationId,
      mediaType,
      status: "preparing",
      callerBrowserDeviceId: browserDeviceId,
      callerTabInstanceId: tabInstanceId,
      preparingExpiresAt: new Date(Date.now() + PREPARING_TIMEOUT_MS),
      participants: [
        {
          userId: req.user._id,
          role: "caller",
          browserDeviceId,
          tabInstanceId,
          socketId: getSingleString(req.body?.socketId),
        },
      ],
    });

    return res.status(201).json({ call: serializeCall(call) });
  } catch (error) {
    releaseUserLock(req.user._id, callId);
    throw error;
  }
};

export const ringCall = async (req, res) => {
  const call = await loadCall(req.params.id);
  const role = assertCallParticipant(call, req.user);
  if (role !== "caller") throw new ApiError(403, "Only the caller can ring");
  if (call.status !== "preparing") {
    throw new ApiError(409, "Call is not preparing");
  }

  const lock = acquireUserLock(call.calleeUserId, call._id);
  if (!lock.ok) {
    const busyCall = await completeCall(call, "busy", "callee_busy", {
      emitEvent: false,
    });
    const payload = await buildCallPayload(busyCall);
    emitToUser(call.callerUserId, "call:busy", payload);
    return res.status(409).json({
      message: "Callee is busy",
      code: "CALL_BUSY",
      call: serializeCall(busyCall),
    });
  }

  const now = new Date();
  const { participants } = updateParticipant(call.participants, req.user._id, {
    browserDeviceId: getSingleString(req.body?.browserDeviceId) || call.callerBrowserDeviceId,
    tabInstanceId: getSingleString(req.body?.tabInstanceId) || call.callerTabInstanceId,
    mediaPermissionGrantedAt: now,
  });

  const updated = await Call.findByIdAndUpdate(
    call._id,
    {
      $set: {
        status: "ringing",
        ringingExpiresAt: new Date(Date.now() + RINGING_TIMEOUT_MS),
        participants,
      },
    },
    { new: true },
  );

  const payload = await buildCallPayload(updated);
  emitToUser(updated.callerUserId, "call:ringing", payload);
  emitToUser(updated.calleeUserId, "call:incoming", payload);

  return res.status(200).json({ call: serializeCall(updated) });
};

export const answerIntent = async (req, res) => {
  const browserDeviceId = getSingleString(req.body?.browserDeviceId);
  const tabInstanceId = getSingleString(req.body?.tabInstanceId);
  const call = await Call.findOneAndUpdate(
    {
      _id: req.params.id,
      organizationId: getRequestOrganizationId(req),
      calleeUserId: req.user._id,
      status: "ringing",
    },
    {
      $set: {
        status: "answering",
        answeredByBrowserDeviceId: browserDeviceId,
        answeredByTabInstanceId: tabInstanceId,
        answeringExpiresAt: new Date(Date.now() + ANSWERING_TIMEOUT_MS),
      },
    },
    { new: true },
  );

  if (!call) throw new ApiError(409, "Call is no longer ringing");

  const payload = await buildCallPayload(call);
  emitToUser(call.calleeUserId, "call:resolved", payload);
  emitToUser(call.callerUserId, "call:answering", payload);

  return res.status(200).json({ call: serializeCall(call) });
};

export const acceptCall = async (req, res) => {
  const call = await loadCall(req.params.id);
  const role = assertCallParticipant(call, req.user);
  if (role !== "callee") throw new ApiError(403, "Only the callee can accept");
  if (call.status !== "answering") {
    throw new ApiError(409, "Call is not waiting for accept");
  }

  const tabInstanceId = getSingleString(req.body?.tabInstanceId);
  if (call.answeredByTabInstanceId && call.answeredByTabInstanceId !== tabInstanceId) {
    throw new ApiError(409, "Call was answered on another tab");
  }

  const realtimeService = getRealtimeMeetingService();
  const cloudflareMeeting = await callRealtimeProvider(
    () => realtimeService.createMeeting({ title: "WorkHub 1-1 call" }),
    "Unable to create realtime meeting",
  );
  const cloudflareMeetingId = cloudflareMeeting?.id;
  if (!cloudflareMeetingId) {
    throw new ApiError(502, "Realtime meeting provider returned invalid data");
  }

  const caller = await User.findById(call.callerUserId).select("-password");
  const callee = req.user;
  const callerParticipant = await callRealtimeProvider(
    () =>
      realtimeService.createParticipantToken({
        meetingId: cloudflareMeetingId,
        user: caller,
        role: "host",
      }),
    "Unable to create meeting participant token",
  );
  const calleeParticipant = await callRealtimeProvider(
    () =>
      realtimeService.createParticipantToken({
        meetingId: cloudflareMeetingId,
        user: callee,
        role: "participant",
      }),
    "Unable to create meeting participant token",
  );

  const now = new Date();
  const participants = [
    {
      userId: call.callerUserId,
      role: "caller",
      browserDeviceId: call.callerBrowserDeviceId,
      tabInstanceId: call.callerTabInstanceId,
      cloudflareParticipantId: getProviderParticipantId(callerParticipant),
      tokenIssuedAt: now,
      mediaPermissionGrantedAt:
        call.participants?.find((participant) =>
          isSameId(participant.userId, call.callerUserId),
        )?.mediaPermissionGrantedAt || null,
    },
    {
      userId: call.calleeUserId,
      role: "callee",
      browserDeviceId: getSingleString(req.body?.browserDeviceId),
      tabInstanceId,
      cloudflareParticipantId: getProviderParticipantId(calleeParticipant),
      tokenIssuedAt: now,
      mediaPermissionGrantedAt: now,
    },
  ];

  const updated = await Call.findByIdAndUpdate(
    call._id,
    {
      $set: {
        status: "connecting",
        acceptedAt: now,
        cloudflareMeetingId,
        participants,
      },
    },
    { new: true },
  );

  const payload = await buildCallPayload(updated);
  emitToUser(updated.callerUserId, "call:accepted", payload);
  emitToUser(updated.calleeUserId, "call:resolved", payload);

  return res.status(200).json({
    call: serializeCall(updated),
    participant: {
      id: getProviderParticipantId(calleeParticipant),
      token: calleeParticipant?.token,
    },
  });
};

export const declineCall = async (req, res) => {
  const call = await loadCall(req.params.id);
  const role = assertCallParticipant(call, req.user);
  if (role !== "callee") throw new ApiError(403, "Only the callee can decline");
  if (!["ringing", "answering"].includes(call.status)) {
    throw new ApiError(409, "Call cannot be declined");
  }

  const updated = await completeCall(call, "declined", "user_declined");
  return res.status(200).json({ call: serializeCall(updated) });
};

export const cancelCall = async (req, res) => {
  const call = await loadCall(req.params.id);
  const role = assertCallParticipant(call, req.user);
  if (role !== "caller") throw new ApiError(403, "Only the caller can cancel");
  if (!["preparing", "ringing", "answering"].includes(call.status)) {
    throw new ApiError(409, "Call cannot be cancelled");
  }

  const updated = await completeCall(call, "cancelled", "caller_cancelled");
  return res.status(200).json({ call: serializeCall(updated) });
};

export const failCall = async (req, res) => {
  const call = await loadCall(req.params.id);
  assertCallParticipant(call, req.user);
  if (isTerminalCall(call)) {
    return res.status(200).json({ call: serializeCall(call) });
  }

  const statusReason = getSingleString(req.body?.statusReason) || "client_failed";
  const shouldCreateMessage = call.status !== "preparing";
  const updated = await completeCall(call, "failed", statusReason, {
    createMessage: shouldCreateMessage,
  });
  return res.status(200).json({ call: serializeCall(updated) });
};

export const getCall = async (req, res) => {
  const call = await loadCall(req.params.id);
  assertCallParticipant(call, req.user);
  return res.status(200).json({ call: serializeCall(call) });
};

export const joinToken = async (req, res) => {
  const call = await loadCall(req.params.id);
  assertCallParticipant(call, req.user);
  if (!["connecting", "active"].includes(call.status)) {
    throw new ApiError(409, "Call is not ready to join");
  }

  const participant = (call.participants || []).find((item) =>
    isSameId(item.userId, req.user._id),
  );
  if (!participant?.cloudflareParticipantId || !call.cloudflareMeetingId) {
    throw new ApiError(409, "Call participant is not ready");
  }

  const realtimeService = getRealtimeMeetingService();
  const refreshed = await callRealtimeProvider(
    () =>
      realtimeService.refreshParticipantToken({
        meetingId: call.cloudflareMeetingId,
        participantId: participant.cloudflareParticipantId,
      }),
    "Unable to create meeting participant token",
  );

  const now = new Date();
  const { participants } = updateParticipant(call.participants, req.user._id, {
    tokenIssuedAt: now,
  });
  await Call.findByIdAndUpdate(call._id, { $set: { participants } });

  return res.status(200).json({
    call: serializeCall(call),
    participant: {
      id: participant.cloudflareParticipantId,
      token: refreshed?.token,
    },
  });
};

export const joinedCall = async (req, res) => {
  const call = await loadCall(req.params.id);
  assertCallParticipant(call, req.user);
  if (!["connecting", "active"].includes(call.status)) {
    throw new ApiError(409, "Call is not joinable");
  }

  const now = new Date();
  const { participants } = updateParticipant(call.participants, req.user._id, {
    browserDeviceId: getSingleString(req.body?.browserDeviceId),
    tabInstanceId: getSingleString(req.body?.tabInstanceId),
    activeDeviceId: getSingleString(req.body?.tabInstanceId),
    joinedAt: now,
    lastHeartbeatAt: now,
    disconnectedAt: null,
  });
  call.participants = participants;

  const everyoneJoined =
    participants.length >= 2 && participants.every((participant) => participant.joinedAt);
  if (call.status === "connecting" && everyoneJoined) {
    call.status = "active";
    call.connectedAt = call.connectedAt || now;
  }

  await call.save();
  const payload = await buildCallPayload(call);
  if (call.status === "active") {
    emitToCallUsers(call, "call:active", payload);
  }

  return res.status(200).json({ call: serializeCall(call) });
};

export const heartbeatCall = async (req, res) => {
  const call = await loadCall(req.params.id);
  assertCallParticipant(call, req.user);
  if (!["connecting", "active"].includes(call.status)) {
    return res.status(200).json({ call: serializeCall(call) });
  }

  const { participants } = applyCallHeartbeat(
    call.participants,
    req.user._id,
    new Date(),
  );
  const updated = await Call.findByIdAndUpdate(
    call._id,
    { $set: { participants } },
    { new: true },
  );

  return res.status(200).json({ call: serializeCall(updated || call) });
};

export const endCall = async (req, res) => {
  const call = await loadCall(req.params.id);
  assertCallParticipant(call, req.user);
  if (isTerminalCall(call)) {
    return res.status(200).json({ call: serializeCall(call) });
  }

  const { participants } = updateParticipant(call.participants, req.user._id, {
    leftAt: new Date(),
  });
  call.participants = participants;
  const updated = await completeCall(call, "ended", "user_ended");
  return res.status(200).json({ call: serializeCall(updated) });
};

export const reconcileStaleCalls = async () => {
  const now = new Date();
  const queryOrCalls = Call.find({
    status: { $in: ["preparing", "ringing", "answering", "connecting", "active"] },
  });
  const limitedQuery =
    queryOrCalls && typeof queryOrCalls.limit === "function"
      ? queryOrCalls.limit(100)
      : queryOrCalls;
  const calls = Array.isArray(limitedQuery) ? limitedQuery : await limitedQuery;

  for (const call of calls || []) {
    if (call.status === "preparing" && call.preparingExpiresAt && call.preparingExpiresAt <= now) {
      await completeCall(call, "failed", "caller_media_permission_timeout", {
        createMessage: false,
      });
    } else if (call.status === "ringing" && call.ringingExpiresAt && call.ringingExpiresAt <= now) {
      await completeCall(call, "missed", "ringing_timeout");
    } else if (
      call.status === "answering" &&
      call.answeringExpiresAt &&
      call.answeringExpiresAt <= now
    ) {
      await completeCall(call, "failed", "callee_media_permission_timeout");
    } else if (
      call.status === "connecting" &&
      call.acceptedAt &&
      now.getTime() - new Date(call.acceptedAt).getTime() > CONNECTING_TIMEOUT_MS
    ) {
      await completeCall(call, "failed", "join_timeout");
    } else if (call.status === "active") {
      const staleParticipant = (call.participants || []).find((participant) => {
        return isCallHeartbeatStale(participant.lastHeartbeatAt, now);
      });
      if (staleParticipant) {
        console.warn("Call reconciler ending stale active call", {
          callId: toId(call._id),
          userId: toId(staleParticipant.userId),
          lastHeartbeatAt: staleParticipant.lastHeartbeatAt,
          staleMs:
            now.getTime() - new Date(staleParticipant.lastHeartbeatAt).getTime(),
        });
        await completeCall(call, "ended", "network_disconnect");
      }
    }
  }
};

export const startCallReconciler = () => {
  if (reconcileInterval) return;
  reconcileInterval = setInterval(() => {
    reconcileStaleCalls().catch((error) => {
      console.error("Call reconciler error:", error.message);
    });
  }, RECONCILE_INTERVAL_MS);
  reconcileInterval.unref?.();
};
