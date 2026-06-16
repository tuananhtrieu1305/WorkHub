import mongoose from "mongoose";
import Meeting from "../models/Meeting.js";
import MeetingSummary from "../models/MeetingSummary.js";
import ApiError from "../utils/apiError.js";
import { logActivity } from "../services/activityLogService.js";
import { getRealtimeMeetingService } from "../services/realtimeMeetingService.js";
import { scheduleMeetingRecordingSummary } from "../services/meetingAiSummaryService.js";
import { getRequestOrganizationId } from "../utils/organizationScope.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MEETING_HEARTBEAT_STALE_MS = 30000;
const MEETING_RECONCILE_INTERVAL_MS = 10000;

let meetingIo = null;
let meetingReconcileInterval = null;

export const setMeetingIo = (io) => {
  meetingIo = io;
};

const parsePage = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PAGE;
};

const parseLimit = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
};

const toId = (value) => String(value?._id || value || "");

const parseBooleanInput = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
};

const isAdmin = (user) => user?.role === "admin";

const isOwnerOrHost = (user, meeting) => {
  const userId = toId(user);
  return (
    toId(meeting.createdBy) === userId || toId(meeting.hostUserId) === userId
  );
};

const hasJoinedParticipant = (user, meeting) => {
  const userId = toId(user);
  return (meeting?.participants || []).some(
    (participant) => toId(participant.userId) === userId && participant.joinedAt,
  );
};

const buildActiveMeetingConditions = () => [
  { status: "active" },
  { status: { $exists: false }, endedAt: null },
  { status: null, endedAt: null },
];

const isActiveMeeting = (meeting) =>
  meeting?.status === "active" ||
  (!meeting?.status && meeting?.endedAt == null);

const getMeetingStatus = (meeting) => {
  if (meeting?.status) return meeting.status;
  return meeting?.endedAt ? "ended" : "active";
};

const isSystemVisibleMeeting = (meeting) => isActiveMeeting(meeting);

const isInReadableOrganization = (user, meeting) => {
  const meetingOrganizationId = toId(meeting?.organizationId);
  if (!meetingOrganizationId) return true;
  return toId(user?.activeOrganizationId) === meetingOrganizationId;
};

const canReadMeeting = (user, meeting) =>
  isInReadableOrganization(user, meeting) &&
  (isAdmin(user) ||
    isOwnerOrHost(user, meeting) ||
    hasJoinedParticipant(user, meeting) ||
    isSystemVisibleMeeting(meeting));

const buildReadableMeetingQuery = (user, filters = {}) => {
  const organizationId = toId(user?.activeOrganizationId);
  const query = organizationId ? { organizationId } : {};

  if (filters.status === "active") {
    query.$or = buildActiveMeetingConditions();
  } else if (filters.status) {
    query.status = filters.status;
  }

  if (filters.projectId) {
    query.projectId = filters.projectId;
  }

  if (filters.departmentId) {
    query.departmentId = filters.departmentId;
  }

  if (!isAdmin(user) && filters.status !== "active") {
    const userId = toId(user);
    query.$or = filters.status
      ? [
          { createdBy: userId },
          { hostUserId: userId },
          { participants: { $elemMatch: { userId, joinedAt: { $ne: null } } } },
        ]
      : [
          ...buildActiveMeetingConditions(),
          { createdBy: userId },
          { hostUserId: userId },
          { participants: { $elemMatch: { userId, joinedAt: { $ne: null } } } },
        ];
  }

  return query;
};

export const __meetingPresenterTestables = {
  buildReadableMeetingQuery,
  canReadMeeting,
};

const serializeMeetingSummary = (summary, { includeTranscript = false } = {}) => {
  if (!summary) return null;
  const data = summary?.toObject ? summary.toObject() : summary;

  return {
    id: toId(data._id),
    meetingId: toId(data.meetingId),
    status: data.status || "processing",
    title: data.title || "",
    summary: data.summary || "",
    decisions: data.decisions || [],
    actionItems: data.actionItems || [],
    followUps: data.followUps || [],
    recordingUrl: includeTranscript ? data.recordingUrl || "" : undefined,
    transcript: includeTranscript ? data.transcript || "" : undefined,
    errorMessage: data.errorMessage || "",
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
};

const serializeMeeting = (meeting, { summary = null } = {}) => {
  const data = meeting?.toObject ? meeting.toObject() : meeting;
  if (!data) return null;

  return {
    id: toId(data._id),
    title: data.title,
    cloudflareMeetingId: data.cloudflareMeetingId,
    createdBy: toId(data.createdBy) || null,
    hostUserId: toId(data.hostUserId) || null,
    organizationId: toId(data.organizationId) || null,
    status: getMeetingStatus(data),
    projectId: data.projectId ? toId(data.projectId) : null,
    departmentId: data.departmentId ? toId(data.departmentId) : null,
    aiSummaryEnabled: data.aiSummaryEnabled ?? Boolean(summary),
    startedAt: data.startedAt || null,
    endedAt: data.endedAt || null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    summaryStatus: summary?.status || null,
    summaryId: summary?._id ? toId(summary._id) : null,
  };
};

const attachMeetingSummaryStates = async (meetings) => {
  const ids = meetings.map((meeting) => meeting._id).filter(Boolean);
  if (!ids.length) return meetings.map((meeting) => serializeMeeting(meeting));
  if (process.env.NODE_ENV === "test" && mongoose.connection.readyState !== 1) {
    return meetings.map((meeting) => serializeMeeting(meeting));
  }

  const summaries = await MeetingSummary.find({ meetingId: { $in: ids } })
    .select("_id meetingId status errorMessage updatedAt")
    .lean();
  const summariesByMeetingId = new Map(
    summaries.map((summary) => [toId(summary.meetingId), summary]),
  );

  return meetings.map((meeting) =>
    serializeMeeting(meeting, {
      summary: summariesByMeetingId.get(toId(meeting._id)),
    }),
  );
};

const serializeParticipant = (participant) => ({
  id: participant?.id || participant?.participantId || null,
  token: participant?.token,
});

const emitMeetingEvent = (event, meeting) => {
  meetingIo?.emit?.(event, { meeting: serializeMeeting(meeting) });
};

const getProviderParticipantId = (participant) =>
  participant?.id || participant?.participantId || null;

const buildStoredParticipant = ({ user, participant, role }) => ({
  userId: user._id,
  cloudflareParticipantId: getProviderParticipantId(participant),
  role,
  tokenIssuedAt: new Date(),
  joinedAt: null,
  leftAt: null,
  lastHeartbeatAt: null,
});

const findStoredParticipant = (meeting, user) => {
  const userId = toId(user);
  return (meeting?.participants || []).find(
    (participant) => toId(participant.userId) === userId,
  );
};

const rememberParticipantTokenIssue = async ({ meeting, user, participant, role }) => {
  const participantId = getProviderParticipantId(participant);
  if (!participantId) return;

  await Meeting.updateOne(
    { _id: meeting._id, "participants.userId": { $ne: user._id } },
    {
      $push: {
        participants: buildStoredParticipant({ user, participant, role }),
      },
    },
  );
};

const touchExistingParticipantTokenIssue = async ({ meeting, user, role }) => {
  await Meeting.updateOne(
    { _id: meeting._id, "participants.userId": user._id },
    {
      $set: {
        "participants.$.role": role,
        "participants.$.tokenIssuedAt": new Date(),
        "participants.$.joinedAt": null,
        "participants.$.leftAt": null,
        "participants.$.lastHeartbeatAt": null,
      },
    },
  );
};

const getLiveMeetingParticipants = (meeting, now = new Date()) =>
  (meeting.participants || []).filter((participant) => {
    if (!participant.joinedAt || participant.leftAt) return false;
    if (!participant.lastHeartbeatAt) return false;
    return (
      now.getTime() - new Date(participant.lastHeartbeatAt).getTime() <=
      MEETING_HEARTBEAT_STALE_MS
    );
  });

const hasJoinedMeetingParticipant = (meeting) =>
  (meeting.participants || []).some((participant) => participant.joinedAt);

const endMeetingDocument = async (meeting) => {
  if (!isActiveMeeting(meeting)) return meeting;

  const updated = await Meeting.findByIdAndUpdate(
    meeting._id,
    {
      $set: {
        status: "ended",
        endedAt: new Date(),
      },
    },
    { new: true },
  );

  emitMeetingEvent("meeting_ended", updated || meeting);
  if ((updated || meeting)?.aiSummaryEnabled) {
    scheduleMeetingRecordingSummary(updated || meeting);
  }
  return updated || meeting;
};

const removeStaleActivePeer = async ({ realtimeService, meeting, user }) => {
  if (!realtimeService.kickParticipantFromActiveSession) return;

  try {
    await realtimeService.kickParticipantFromActiveSession({
      meetingId: meeting.cloudflareMeetingId,
      customParticipantId: toId(user),
    });
  } catch {
    // Best effort cleanup: joining should not fail just because there is no live session to kick.
  }
};

const issueParticipantToken = async ({ meeting, user, role, realtimeService }) => {
  await removeStaleActivePeer({ realtimeService, meeting, user });

  const storedParticipant = findStoredParticipant(meeting, user);
  if (
    storedParticipant?.cloudflareParticipantId &&
    realtimeService.refreshParticipantToken
  ) {
    const refreshed = await callRealtimeProvider(
      () =>
        realtimeService.refreshParticipantToken({
          meetingId: meeting.cloudflareMeetingId,
          participantId: storedParticipant.cloudflareParticipantId,
        }),
      "Unable to create meeting participant token",
    );

    await touchExistingParticipantTokenIssue({ meeting, user, role });

    return {
      id: storedParticipant.cloudflareParticipantId,
      token: refreshed?.token,
    };
  }

  const participant = await callRealtimeProvider(
    () =>
      realtimeService.createParticipantToken({
        meetingId: meeting.cloudflareMeetingId,
        user,
        role,
      }),
    "Unable to create meeting participant token",
  );

  await rememberParticipantTokenIssue({ meeting, user, participant, role });

  return participant;
};

const loadMeetingByRoomId = async (id) => {
  const roomId = String(id || "").trim();
  if (!roomId) {
    throw new ApiError(400, "Meeting id is required");
  }

  let meeting = null;
  if (mongoose.Types.ObjectId.isValid(roomId)) {
    meeting = await Meeting.findById(roomId);
  }

  if (!meeting) {
    meeting = await Meeting.findOne({ cloudflareMeetingId: roomId });
  }

  if (!meeting) {
    throw new ApiError(404, "Meeting not found");
  }

  return meeting;
};

const loadMeetingForUser = async (id, user) => {
  const meeting = await loadMeetingByRoomId(id);
  if (!canReadMeeting(user, meeting)) {
    throw new ApiError(403, "You do not have permission to access this meeting");
  }
  return meeting;
};

const logMeetingActivity = async ({ req, action, meeting, metadata = {} }) => {
  await logActivity({
    actorId: req.user?._id,
    action,
    entityType: "meeting",
    entityId: meeting?._id,
    organizationId: meeting?.organizationId || getRequestOrganizationId(req),
    projectId: meeting?.projectId || null,
    departmentId: meeting?.departmentId || null,
    metadata,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
};

const callRealtimeProvider = async (operation, safeMessage) => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(502, safeMessage);
  }
};

export const createMeeting = async (req, res) => {
  const organizationId = getRequestOrganizationId(req) || null;
  const title = String(req.body?.title || "WorkHub meeting").trim();
  if (!title) {
    throw new ApiError(400, "Meeting title is required");
  }
  const enableAiSummary = parseBooleanInput(req.body?.enableAiSummary, false);

  const realtimeService = getRealtimeMeetingService();
  const cloudflareMeeting = await callRealtimeProvider(
    () => realtimeService.createMeeting({ title, enableAiSummary }),
    "Unable to create realtime meeting",
  );
  const cloudflareMeetingId = cloudflareMeeting?.id;

  if (!cloudflareMeetingId) {
    throw new ApiError(502, "Realtime meeting provider returned invalid data");
  }

  const participant = await callRealtimeProvider(
    () =>
      realtimeService.createParticipantToken({
        meetingId: cloudflareMeetingId,
        user: req.user,
        role: "host",
      }),
    "Unable to create meeting participant token",
  );

  const meeting = await Meeting.create({
    title,
    cloudflareMeetingId,
    organizationId,
    createdBy: req.user._id,
    hostUserId: req.user._id,
    projectId: req.body?.projectId || null,
    departmentId: req.body?.departmentId || null,
    aiSummaryEnabled: enableAiSummary,
    status: "active",
    startedAt: new Date(),
    participants: [
      buildStoredParticipant({
        user: req.user,
        participant,
        role: "host",
      }),
    ],
  });

  await logMeetingActivity({
    req,
    action: "meeting.created",
    meeting,
    metadata: { title, enableAiSummary },
  });
  emitMeetingEvent("meeting_created", meeting);

  return res.status(201).json({
    meeting: serializeMeeting(meeting),
    participant: serializeParticipant(participant),
  });
};

export const joinMeeting = async (req, res) => {
  const meeting = await loadMeetingForUser(req.params.id, req.user);
  if (!isActiveMeeting(meeting)) {
    throw new ApiError(409, "Meeting is not active");
  }

  const realtimeService = getRealtimeMeetingService();
  const participant = await issueParticipantToken({
    meeting,
    user: req.user,
    role: isOwnerOrHost(req.user, meeting) ? "host" : "participant",
    realtimeService,
  });

  await logMeetingActivity({
    req,
    action: "meeting.joined",
    meeting,
  });

  return res.status(200).json({
    meeting: serializeMeeting(meeting),
    participant: serializeParticipant(participant),
  });
};

export const markMeetingJoined = async (req, res) => {
  const meeting = await loadMeetingForUser(req.params.id, req.user);
  if (!isActiveMeeting(meeting)) {
    throw new ApiError(409, "Meeting is not active");
  }

  const now = new Date();
  const updated = await Meeting.findOneAndUpdate(
    { _id: meeting._id, "participants.userId": req.user._id },
    {
      $set: {
        "participants.$.joinedAt": now,
        "participants.$.lastHeartbeatAt": now,
        "participants.$.leftAt": null,
      },
    },
    { new: true },
  );

  if (!updated) {
    throw new ApiError(409, "Meeting participant has not been issued a token");
  }

  await logMeetingActivity({
    req,
    action: "meeting.joined",
    meeting: updated,
  });

  return res.status(200).json({ meeting: serializeMeeting(updated) });
};

export const getMeeting = async (req, res) => {
  const meeting = await loadMeetingForUser(req.params.id, req.user);
  const summary =
    process.env.NODE_ENV === "test" && mongoose.connection.readyState !== 1
      ? null
      : await MeetingSummary.findOne({ meetingId: meeting._id });

  return res.status(200).json({
    meeting: serializeMeeting(meeting, { summary }),
    summary: serializeMeetingSummary(summary, { includeTranscript: true }),
  });
};

export const listMeetings = async (req, res) => {
  const page = parsePage(req.query.page);
  const limit = parseLimit(req.query.limit || req.query.size);
  const query = buildReadableMeetingQuery(req.user, req.query);

  const [meetings, totalElements] = await Promise.all([
    Meeting.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Meeting.countDocuments(query),
  ]);

  return res.status(200).json({
    content: await attachMeetingSummaryStates(meetings),
    page,
    limit,
    totalElements,
  });
};

export const endMeeting = async (req, res) => {
  const meeting = await loadMeetingForUser(req.params.id, req.user);
  if (!isAdmin(req.user) && !isOwnerOrHost(req.user, meeting)) {
    throw new ApiError(403, "You do not have permission to end this meeting");
  }

  const updated = await endMeetingDocument(meeting);

  await logMeetingActivity({
    req,
    action: "meeting.ended",
    meeting: updated || meeting,
  });

  return res.status(200).json({ meeting: serializeMeeting(updated || meeting) });
};

export const heartbeatMeeting = async (req, res) => {
  const meeting = await loadMeetingForUser(req.params.id, req.user);
  if (!isActiveMeeting(meeting)) {
    return res.status(200).json({ meeting: serializeMeeting(meeting) });
  }

  const now = new Date();
  const updated = await Meeting.findOneAndUpdate(
    { _id: meeting._id, "participants.userId": req.user._id },
    {
      $set: {
        "participants.$.lastHeartbeatAt": now,
        "participants.$.leftAt": null,
      },
    },
    { new: true },
  );

  return res.status(200).json({ meeting: serializeMeeting(updated || meeting) });
};

export const leaveMeeting = async (req, res) => {
  const meeting = await loadMeetingForUser(req.params.id, req.user);
  if (!isActiveMeeting(meeting)) {
    return res.status(200).json({ meeting: serializeMeeting(meeting) });
  }

  const storedParticipant = findStoredParticipant(meeting, req.user);
  if (!storedParticipant?.joinedAt) {
    return res.status(200).json({ meeting: serializeMeeting(meeting) });
  }

  const now = new Date();
  const updated = await Meeting.findOneAndUpdate(
    { _id: meeting._id, "participants.userId": req.user._id },
    {
      $set: {
        "participants.$.leftAt": now,
        "participants.$.lastHeartbeatAt": now,
      },
    },
    { new: true },
  );

  const meetingAfterLeave = updated || meeting;
  const liveParticipants = getLiveMeetingParticipants(meetingAfterLeave, now);
  if (liveParticipants.length === 0) {
    const ended = await endMeetingDocument(meetingAfterLeave);
    return res.status(200).json({ meeting: serializeMeeting(ended) });
  }

  return res.status(200).json({ meeting: serializeMeeting(meetingAfterLeave) });
};

export const reconcileStaleMeetings = async () => {
  const now = new Date();
  const meetings = await Meeting.find({
    $or: buildActiveMeetingConditions(),
  })
    .sort({ updatedAt: 1 })
    .limit(100);

  for (const meeting of meetings) {
    const participants = meeting.participants || [];
    if (!participants.length) {
      await endMeetingDocument(meeting);
      continue;
    }

    if (
      hasJoinedMeetingParticipant(meeting) &&
      getLiveMeetingParticipants(meeting, now).length === 0
    ) {
      await endMeetingDocument(meeting);
    }
  }
};

export const startMeetingReconciler = () => {
  if (meetingReconcileInterval) return;
  meetingReconcileInterval = setInterval(() => {
    reconcileStaleMeetings().catch((error) => {
      console.error("Meeting reconciler error:", error.message);
    });
  }, MEETING_RECONCILE_INTERVAL_MS);
  meetingReconcileInterval.unref?.();
};
