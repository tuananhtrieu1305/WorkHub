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
const { default: Conversation } = await import("../src/models/Conversation.js");
const { default: Call } = await import("../src/models/Call.js");
const { default: Message } = await import("../src/models/Message.js");
const {
  clearRealtimeMeetingServiceOverride,
  setRealtimeMeetingServiceOverride,
} = await import("../src/services/realtimeMeetingService.js");
const {
  clearCallLocks,
  acquireUserLock,
} = await import("../src/services/callLockService.js");
const {
  markUserConnected,
  markUserDisconnected,
} = await import("../src/services/presenceService.js");

const callerUserId = new mongoose.Types.ObjectId();
const calleeUserId = new mongoose.Types.ObjectId();
const conversationId = new mongoose.Types.ObjectId();
const callId = new mongoose.Types.ObjectId();
const token = jwt.sign({ id: callerUserId.toString() }, process.env.JWT_SECRET);
const calleeToken = jwt.sign({ id: calleeUserId.toString() }, process.env.JWT_SECRET);

const auth = (req) => req.set("Authorization", `Bearer ${token}`);
const authCallee = (req) => req.set("Authorization", `Bearer ${calleeToken}`);

const makeDoc = (data) => ({
  ...data,
  toObject() {
    return { ...data };
  },
  async save() {
    return this;
  },
});

const makeUser = (id, overrides = {}) => ({
  _id: id,
  id,
  fullName: id.toString() === callerUserId.toString() ? "Caller" : "Callee",
  email: `${id}@example.com`,
  role: "user",
  status: "active",
  avatar: "",
  ...overrides,
});

const makeConversation = (overrides = {}) =>
  makeDoc({
    _id: conversationId,
    type: "private",
    participants: [{ userId: callerUserId }, { userId: calleeUserId }],
    lastMessage: {},
    ...overrides,
  });

const makeCall = (overrides = {}) =>
  makeDoc({
    _id: callId,
    callerUserId,
    calleeUserId,
    conversationId,
    mediaType: "video",
    status: "preparing",
    statusReason: "",
    callerBrowserDeviceId: "browser-a",
    callerTabInstanceId: "tab-a",
    answeredByBrowserDeviceId: "",
    answeredByTabInstanceId: "",
    cloudflareMeetingId: "",
    cloudflareSessionId: "",
    preparingExpiresAt: new Date(Date.now() + 15000),
    ringingExpiresAt: null,
    answeringExpiresAt: null,
    acceptedAt: null,
    connectedAt: null,
    endedAt: null,
    durationSeconds: 0,
    participants: [
      {
        userId: callerUserId,
        role: "caller",
        browserDeviceId: "browser-a",
        tabInstanceId: "tab-a",
        socketId: "",
      },
    ],
    createdAt: new Date("2026-05-10T00:00:00.000Z"),
    updatedAt: new Date("2026-05-10T00:00:00.000Z"),
    ...overrides,
  });

const originals = {
  userFindById: User.findById,
  conversationFindById: Conversation.findById,
  conversationFindByIdAndUpdate: Conversation.findByIdAndUpdate,
  callCreate: Call.create,
  callFindById: Call.findById,
  callFindOneAndUpdate: Call.findOneAndUpdate,
  callFindByIdAndUpdate: Call.findByIdAndUpdate,
  messageCreate: Message.create,
};

test.beforeEach(() => {
  clearCallLocks();
  markUserConnected(calleeUserId, "socket-callee");
  User.findById = (id) => ({
    select: () => Promise.resolve(makeUser(id)),
  });
  Conversation.findById = async () => makeConversation();
  Conversation.findByIdAndUpdate = async () => makeConversation();
  Call.create = async (payload) => makeCall({ ...payload, _id: callId });
  Call.findById = async () => makeCall();
  Call.findOneAndUpdate = async (query, update) =>
    makeCall({ _id: query._id, ...update.$set });
  Call.findByIdAndUpdate = async (id, update) =>
    makeCall({ _id: id, ...update.$set });
  Message.create = async (payload) =>
    makeDoc({ _id: new mongoose.Types.ObjectId(), ...payload });
  setRealtimeMeetingServiceOverride({
    createMeeting: async () => ({ id: "cf-meeting-1" }),
    createParticipantToken: async ({ user }) => ({
      id: `cf-participant-${user._id}`,
      token: `token-${user._id}`,
    }),
    refreshParticipantToken: async ({ participantId }) => ({
      token: `refreshed-${participantId}`,
    }),
    kickAllParticipants: async () => ({}),
  });
});

test.afterEach(() => {
  markUserDisconnected(calleeUserId, "socket-callee");
  User.findById = originals.userFindById;
  Conversation.findById = originals.conversationFindById;
  Conversation.findByIdAndUpdate = originals.conversationFindByIdAndUpdate;
  Call.create = originals.callCreate;
  Call.findById = originals.callFindById;
  Call.findOneAndUpdate = originals.callFindOneAndUpdate;
  Call.findByIdAndUpdate = originals.callFindByIdAndUpdate;
  Message.create = originals.messageCreate;
  clearRealtimeMeetingServiceOverride();
  clearCallLocks();
});

test("POST /api/calls/prepare creates a preparing call before ringing the callee", async () => {
  let createdPayload;
  Call.create = async (payload) => {
    createdPayload = payload;
    return makeCall({ ...payload, _id: callId });
  };

  const res = await auth(request(app).post("/api/calls/prepare")).send({
    conversationId: conversationId.toString(),
    calleeUserId: calleeUserId.toString(),
    mediaType: "video",
    browserDeviceId: "browser-a",
    tabInstanceId: "tab-a",
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.call.status, "preparing");
  assert.equal(createdPayload.status, "preparing");
  assert.equal(createdPayload.callerUserId.toString(), callerUserId.toString());
  assert.equal(createdPayload.calleeUserId.toString(), calleeUserId.toString());
});

test("POST /api/calls/prepare rejects unavailable callees before creating a call", async () => {
  markUserDisconnected(calleeUserId, "socket-callee");
  let createdPayload = null;
  Call.create = async (payload) => {
    createdPayload = payload;
    return makeCall({ ...payload, _id: callId });
  };

  const res = await auth(request(app).post("/api/calls/prepare")).send({
    conversationId: conversationId.toString(),
    calleeUserId: calleeUserId.toString(),
    mediaType: "video",
    browserDeviceId: "browser-a",
    tabInstanceId: "tab-a",
  });

  assert.equal(res.status, 409);
  assert.equal(res.body.code, "CALLEE_UNAVAILABLE");
  assert.equal(createdPayload, null);
});

test("POST /api/calls/:id/ring returns busy when callee has an active RAM lock", async () => {
  acquireUserLock(calleeUserId, new mongoose.Types.ObjectId());

  const res = await auth(request(app).post(`/api/calls/${callId}/ring`)).send({
    browserDeviceId: "browser-a",
    tabInstanceId: "tab-a",
  });

  assert.equal(res.status, 409);
  assert.equal(res.body.code, "CALL_BUSY");
});

test("answer intent reserves one callee tab before media permission is requested", async () => {
  Call.findOneAndUpdate = async (query, update) => {
    assert.equal(query.status, "ringing");
    assert.equal(update.$set.status, "answering");
    assert.equal(update.$set.answeredByTabInstanceId, "tab-callee");
    return makeCall({ status: "answering", ...update.$set });
  };

  const res = await authCallee(
    request(app).post(`/api/calls/${callId}/answer-intent`),
  ).send({
    browserDeviceId: "browser-callee",
    tabInstanceId: "tab-callee",
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.call.status, "answering");
  assert.equal(res.body.call.answeredByTabInstanceId, "tab-callee");
});

test("POST /api/calls/:id/fail records callee media denial instead of letting call become missed", async () => {
  Call.findById = async () =>
    makeCall({
      status: "answering",
      answeredByTabInstanceId: "tab-callee",
      participants: [
        { userId: callerUserId, role: "caller" },
        { userId: calleeUserId, role: "callee", tabInstanceId: "tab-callee" },
      ],
    });
  Call.findByIdAndUpdate = async (id, update) => {
    assert.equal(update.$set.status, "failed");
    assert.equal(update.$set.statusReason, "callee_media_permission_denied");
    return makeCall({ _id: id, ...update.$set });
  };

  const res = await authCallee(request(app).post(`/api/calls/${callId}/fail`)).send({
    statusReason: "callee_media_permission_denied",
    tabInstanceId: "tab-callee",
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.call.status, "failed");
  assert.equal(res.body.call.statusReason, "callee_media_permission_denied");
});
