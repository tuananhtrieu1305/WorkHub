import mongoose from "mongoose";
import Meeting from "../models/Meeting.js";
import ApiError from "../utils/apiError.js";
import { logActivity } from "../services/activityLogService.js";
import { getRealtimeMeetingService } from "../services/realtimeMeetingService.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

let meetingIo = null;

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

const isAdmin = (user) => user?.role === "admin";

const isOwnerOrHost = (user, meeting) => {
  const userId = toId(user);
  return (
    toId(meeting.createdBy) === userId || toId(meeting.hostUserId) === userId
  );
};

// Centralize meeting access rules so project/department permissions can be added here later.
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

const canReadMeeting = (user, meeting) =>
  isAdmin(user) || isOwnerOrHost(user, meeting) || isSystemVisibleMeeting(meeting);

const buildReadableMeetingQuery = (user, filters = {}) => {
  const query = {};

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
      ? [{ createdBy: userId }, { hostUserId: userId }]
      : [
          ...buildActiveMeetingConditions(),
          { createdBy: userId },
          { hostUserId: userId },
        ];
  }

  return query;
};

const serializeMeeting = (meeting) => {
  const data = meeting?.toObject ? meeting.toObject() : meeting;
  if (!data) return null;

  return {
    id: toId(data._id),
    title: data.title,
    cloudflareMeetingId: data.cloudflareMeetingId,
    createdBy: toId(data.createdBy) || null,
    hostUserId: toId(data.hostUserId) || null,
    status: getMeetingStatus(data),
    projectId: data.projectId ? toId(data.projectId) : null,
    departmentId: data.departmentId ? toId(data.departmentId) : null,
    startedAt: data.startedAt || null,
    endedAt: data.endedAt || null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
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
  joinedAt: new Date(),
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
        "participants.$.joinedAt": new Date(),
      },
    },
  );
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
  const title = String(req.body?.title || "WorkHub meeting").trim();
  if (!title) {
    throw new ApiError(400, "Meeting title is required");
  }

  const realtimeService = getRealtimeMeetingService();
  const cloudflareMeeting = await callRealtimeProvider(
    () => realtimeService.createMeeting({ title }),
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
    createdBy: req.user._id,
    hostUserId: req.user._id,
    projectId: req.body?.projectId || null,
    departmentId: req.body?.departmentId || null,
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
    metadata: { title },
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

export const getMeeting = async (req, res) => {
  const meeting = await loadMeetingForUser(req.params.id, req.user);
  return res.status(200).json({ meeting: serializeMeeting(meeting) });
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
    content: meetings.map(serializeMeeting),
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

  await logMeetingActivity({
    req,
    action: "meeting.ended",
    meeting: updated || meeting,
  });
  emitMeetingEvent("meeting_ended", updated || meeting);

  return res.status(200).json({ meeting: serializeMeeting(updated || meeting) });
};
