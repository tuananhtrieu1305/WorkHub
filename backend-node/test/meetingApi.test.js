import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import request from "supertest";
import mongoose from "mongoose";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";
process.env.CLOUDFLARE_REALTIME_ACCOUNT_ID = "account-id";
process.env.CLOUDFLARE_REALTIME_APP_ID = "app-id";
process.env.CLOUDFLARE_REALTIME_API_TOKEN = "api-token";

const { default: app } = await import("../src/app.js");
const { default: User } = await import("../src/models/User.js");
const { default: ActivityLog } = await import("../src/models/ActivityLog.js");
const { default: Meeting } = await import("../src/models/Meeting.js");
const {
  clearRealtimeMeetingServiceOverride,
  setRealtimeMeetingServiceOverride,
} = await import("../src/services/realtimeMeetingService.js");

const originals = {
  userFindById: User.findById,
  meetingCreate: Meeting.create,
  meetingFind: Meeting.find,
  meetingFindById: Meeting.findById,
  meetingFindByIdAndUpdate: Meeting.findByIdAndUpdate,
  meetingCountDocuments: Meeting.countDocuments,
  activityCreate: ActivityLog.create,
};

const userId = new mongoose.Types.ObjectId().toString();
const otherUserId = new mongoose.Types.ObjectId().toString();
const meetingId = new mongoose.Types.ObjectId().toString();
const cloudflareMeetingId = "cf-meeting-1";
const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);

const auth = (req) => req.set("Authorization", `Bearer ${token}`);

const makeDoc = (data) => ({
  ...data,
  toObject() {
    return { ...data };
  },
});

const pagedQuery = (value) => ({
  sort() {
    return this;
  },
  skip() {
    return this;
  },
  limit() {
    return Promise.resolve(value);
  },
});

const activeUser = (overrides = {}) => ({
  _id: userId,
  role: "user",
  status: "active",
  fullName: "Test User",
  email: "test@example.com",
  ...overrides,
});

const baseMeeting = (overrides = {}) =>
  makeDoc({
    _id: meetingId,
    title: "Daily sync",
    cloudflareMeetingId,
    createdBy: userId,
    hostUserId: userId,
    status: "active",
    projectId: null,
    departmentId: null,
    startedAt: null,
    endedAt: null,
    createdAt: new Date("2026-04-27T00:00:00.000Z"),
    updatedAt: new Date("2026-04-27T00:00:00.000Z"),
    ...overrides,
  });

test.beforeEach(() => {
  User.findById = () => ({
    select: () => Promise.resolve(activeUser()),
  });

  setRealtimeMeetingServiceOverride({
    createMeeting: async () => ({ id: cloudflareMeetingId }),
    createParticipantToken: async () => ({
      token: "participant-token",
      id: "participant-1",
    }),
  });

  Meeting.create = async (payload) =>
    baseMeeting({
      ...payload,
      _id: meetingId,
      cloudflareMeetingId: payload.cloudflareMeetingId,
    });
  Meeting.findById = async () => baseMeeting();
  Meeting.find = () => pagedQuery([baseMeeting()]);
  Meeting.countDocuments = async () => 1;
  Meeting.findByIdAndUpdate = async (id, update) =>
    baseMeeting({ _id: id, ...update.$set });
  ActivityLog.create = async (payload) =>
    makeDoc({ _id: new mongoose.Types.ObjectId(), ...payload });
});

test.afterEach(() => {
  User.findById = originals.userFindById;
  Meeting.create = originals.meetingCreate;
  Meeting.find = originals.meetingFind;
  Meeting.findById = originals.meetingFindById;
  Meeting.findByIdAndUpdate = originals.meetingFindByIdAndUpdate;
  Meeting.countDocuments = originals.meetingCountDocuments;
  ActivityLog.create = originals.activityCreate;
  clearRealtimeMeetingServiceOverride();
});

test("POST /api/meetings creates a Cloudflare meeting and participant token", async () => {
  let createdTitle;
  setRealtimeMeetingServiceOverride({
    createMeeting: async ({ title }) => {
      createdTitle = title;
      return { id: cloudflareMeetingId };
    },
    createParticipantToken: async ({ role, user }) => ({
      token: `token-for-${role}-${user._id}`,
      id: "participant-1",
    }),
  });

  const res = await auth(request(app).post("/api/meetings")).send({
    title: "Daily sync",
  });

  assert.equal(res.status, 201);
  assert.equal(createdTitle, "Daily sync");
  assert.equal(res.body.meeting.id, meetingId);
  assert.equal(res.body.meeting.cloudflareMeetingId, cloudflareMeetingId);
  assert.equal(res.body.participant.token, `token-for-host-${userId}`);
  assert.equal(res.body.cloudflareApiToken, undefined);
});

test("POST /api/meetings/:id/join returns a token for readable meetings", async () => {
  const res = await auth(request(app).post(`/api/meetings/${meetingId}/join`)).send();

  assert.equal(res.status, 200);
  assert.equal(res.body.meeting.id, meetingId);
  assert.equal(res.body.participant.token, "participant-token");
});

test("GET /api/meetings/:id returns meeting detail for owner", async () => {
  const res = await auth(request(app).get(`/api/meetings/${meetingId}`));

  assert.equal(res.status, 200);
  assert.equal(res.body.meeting.id, meetingId);
  assert.equal(res.body.meeting.title, "Daily sync");
});

test("GET /api/meetings lists only meetings scoped to the current user", async () => {
  let countQuery;
  Meeting.countDocuments = async (query) => {
    countQuery = query;
    return 1;
  };

  const res = await auth(request(app).get("/api/meetings?page=1&limit=10"));

  assert.equal(res.status, 200);
  assert.equal(res.body.totalElements, 1);
  assert.deepEqual(countQuery.$or, [
    { createdBy: userId },
    { hostUserId: userId },
  ]);
});

test("PATCH /api/meetings/:id/end is forbidden for non owner", async () => {
  Meeting.findById = async () => baseMeeting({ createdBy: otherUserId, hostUserId: otherUserId });

  const res = await auth(request(app).patch(`/api/meetings/${meetingId}/end`)).send();

  assert.equal(res.status, 403);
});

test("Cloudflare participant errors return safe server message", async () => {
  setRealtimeMeetingServiceOverride({
    createMeeting: async () => ({ id: cloudflareMeetingId }),
    createParticipantToken: async () => {
      throw new Error("Cloudflare secret api-token failed");
    },
  });

  const res = await auth(request(app).post(`/api/meetings/${meetingId}/join`)).send();

  assert.equal(res.status, 502);
  assert.equal(res.body.message, "Unable to create meeting participant token");
  assert.equal(JSON.stringify(res.body).includes("api-token"), false);
});
