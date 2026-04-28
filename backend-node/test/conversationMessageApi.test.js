import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import jwt from "jsonwebtoken";
import request from "supertest";
import mongoose from "mongoose";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";

const { default: app } = await import("../src/app.js");
const { default: User } = await import("../src/models/User.js");
const { default: Conversation } = await import("../src/models/Conversation.js");
const { default: Message } = await import("../src/models/Message.js");

const originals = {
  userFindById: User.findById,
  conversationFind: Conversation.find,
  conversationFindById: Conversation.findById,
  messageFind: Message.find,
  messageFindById: Message.findById,
  messageCreate: Message.create,
};

const userId = new mongoose.Types.ObjectId();
const otherUserId = new mongoose.Types.ObjectId();
const conversationId = new mongoose.Types.ObjectId();
const replyMessageId = new mongoose.Types.ObjectId();
const newMessageId = new mongoose.Types.ObjectId();
const token = jwt.sign({ id: userId.toString() }, process.env.JWT_SECRET);

const auth = (req) => req.set("Authorization", `Bearer ${token}`);

const makeDoc = (data) => ({
  ...data,
  async save() {
    return this;
  },
});

let selectedUserFields = [];

const makeUser = (id, fullName, activityStatus = "online") => ({
  _id: id,
  fullName,
  email: `${fullName.toLowerCase().replace(/\s+/g, ".")}@example.com`,
  avatar: "",
  role: "user",
  status: "active",
  activityStatus,
});

const makeConversation = () =>
  makeDoc({
    _id: conversationId,
    type: "private",
    name: "",
    avatar: "",
    participants: [{ userId }, { userId: otherUserId }],
    lastMessage: {},
    createdAt: new Date("2026-04-27T06:00:00.000Z"),
    updatedAt: new Date("2026-04-27T07:00:00.000Z"),
  });

const makeReplyMessage = () =>
  makeDoc({
    _id: replyMessageId,
    conversationId,
    senderId: otherUserId,
    type: "text",
    content: "Original message",
    attachments: [],
    mentions: [],
    replyTo: null,
    reactions: [],
    createdAt: new Date("2026-04-27T07:00:00.000Z"),
    updatedAt: new Date("2026-04-27T07:00:00.000Z"),
  });

test.beforeEach(() => {
  selectedUserFields = [];
  User.findById = (id) => ({
    select: (fields) => {
      selectedUserFields.push(fields);
      const stringId = id.toString();
      if (stringId === otherUserId.toString()) {
        return Promise.resolve(makeUser(otherUserId, "Other User", "dnd"));
      }
      return Promise.resolve(makeUser(userId, "Current User"));
    },
  });
  Conversation.findById = async () => makeConversation();
});

test.afterEach(() => {
  User.findById = originals.userFindById;
  Conversation.find = originals.conversationFind;
  Conversation.findById = originals.conversationFindById;
  Message.find = originals.messageFind;
  Message.findById = originals.messageFindById;
  Message.create = originals.messageCreate;
});

test("conversation details include participant activity statuses for chat presence", async () => {
  const res = await auth(request(app).get(`/api/conversations/${conversationId}`));

  assert.equal(res.status, 200);
  assert.ok(
    selectedUserFields.includes(
      "_id fullName email avatar activityStatus activityStatusExpiresAt",
    ),
  );
  const otherParticipant = res.body.participants.find(
    (participant) => participant.userId === otherUserId.toString(),
  );
  assert.equal(otherParticipant.user.activityStatus, "dnd");
  assert.equal(otherParticipant.user.isOnline, false);
});

test("sending a reply returns replyTo details for realtime rendering", async () => {
  Message.findById = async (id) => {
    if (id.toString() === replyMessageId.toString()) return makeReplyMessage();
    return null;
  };
  Message.create = async (payload) =>
    makeDoc({
      _id: newMessageId,
      ...payload,
      reactions: [],
      createdAt: new Date("2026-04-27T07:01:00.000Z"),
      updatedAt: new Date("2026-04-27T07:01:00.000Z"),
    });

  const res = await auth(
    request(app).post(`/api/conversations/${conversationId}/messages`),
  ).send({
    content: "Reply body",
    replyTo: replyMessageId.toString(),
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.replyTo.id, replyMessageId.toString());
  assert.equal(res.body.replyTo.content, "Original message");
  assert.equal(res.body.replyTo.sender.fullName, "Other User");
});

test("listing messages returns replyTo details for existing replies", async () => {
  Message.findById = async () => makeReplyMessage();
  Message.find = () => ({
    sort() {
      return this;
    },
    limit() {
      return Promise.resolve([
        makeDoc({
          _id: newMessageId,
          conversationId,
          senderId: userId,
          type: "text",
          content: "Reply body",
          attachments: [],
          mentions: [],
          replyTo: replyMessageId,
          reactions: [],
          createdAt: new Date("2026-04-27T07:01:00.000Z"),
          updatedAt: new Date("2026-04-27T07:01:00.000Z"),
        }),
      ]);
    },
  });

  const res = await auth(
    request(app).get(`/api/conversations/${conversationId}/messages`),
  );

  assert.equal(res.status, 200);
  assert.equal(res.body.content[0].replyTo.id, replyMessageId.toString());
  assert.equal(res.body.content[0].replyTo.content, "Original message");
});

test("conversation participants can upload message attachments", async () => {
  const res = await auth(
    request(app)
      .post(`/api/conversations/${conversationId}/attachments`)
      .attach("file", Buffer.from("hello"), {
        filename: "hello.txt",
        contentType: "text/plain",
      }),
  );

  assert.equal(res.status, 201);
  assert.equal(res.body.fileName, "hello.txt");
  assert.equal(res.body.fileSize, 5);
  assert.equal(res.body.mimeType, "text/plain");
  assert.match(res.body.fileUrl, /^\/uploads\/attachments\//);

  const uploadedPath = new URL(`../src${res.body.fileUrl}`, import.meta.url);
  await fs.unlink(uploadedPath).catch(() => {});
});
