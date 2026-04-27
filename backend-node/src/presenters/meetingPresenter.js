import mongoose from "mongoose";
import Meeting from "../models/Meeting.js";
import ApiError from "../utils/apiError.js";
import { logActivity } from "../services/activityLogService.js";
import { getRealtimeMeetingService } from "../services/realtimeMeetingService.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

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

const buildReadableMeetingQuery = (user, filters = {}) => {
  const query = {};

  if (!isAdmin(user)) {
    const userId = toId(user);
    query.$or = [{ createdBy: userId }, { hostUserId: userId }];
  }

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.projectId) {
    query.projectId = filters.projectId;
  }

  if (filters.departmentId) {
    query.departmentId = filters.departmentId;
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
    status: data.status,
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

const ensureObjectId = (id, label = "id") => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `Invalid ${label}`);
  }
};

const loadMeetingForUser = async (id, user) => {
  ensureObjectId(id, "meeting id");
  const meeting = await Meeting.findById(id);
  if (!meeting) {
    throw new ApiError(404, "Meeting not found");
  }
  if (!isAdmin(user) && !isOwnerOrHost(user, meeting)) {
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

  const meeting = await Meeting.create({
    title,
    cloudflareMeetingId,
    createdBy: req.user._id,
    hostUserId: req.user._id,
    projectId: req.body?.projectId || null,
    departmentId: req.body?.departmentId || null,
    status: "active",
    startedAt: new Date(),
  });

  const participant = await callRealtimeProvider(
    () =>
      realtimeService.createParticipantToken({
        meetingId: cloudflareMeetingId,
        user: req.user,
        role: "host",
      }),
    "Unable to create meeting participant token",
  );

  await logMeetingActivity({
    req,
    action: "meeting.created",
    meeting,
    metadata: { title },
  });

  return res.status(201).json({
    meeting: serializeMeeting(meeting),
    participant: serializeParticipant(participant),
  });
};

export const joinMeeting = async (req, res) => {
  const meeting = await loadMeetingForUser(req.params.id, req.user);
  if (meeting.status !== "active") {
    throw new ApiError(409, "Meeting is not active");
  }

  const participant = await callRealtimeProvider(
    () =>
      getRealtimeMeetingService().createParticipantToken({
        meetingId: meeting.cloudflareMeetingId,
        user: req.user,
        role: isOwnerOrHost(req.user, meeting) ? "host" : "participant",
      }),
    "Unable to create meeting participant token",
  );

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

  return res.status(200).json({ meeting: serializeMeeting(updated || meeting) });
};
