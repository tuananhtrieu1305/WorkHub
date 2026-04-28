import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import request from "supertest";
import mongoose from "mongoose";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";

const { default: app } = await import("../src/app.js");
const { default: User } = await import("../src/models/User.js");

const originals = {
  userFindById: User.findById,
  userFind: User.find,
  userCountDocuments: User.countDocuments,
};

const currentUserId = new mongoose.Types.ObjectId().toString();
const coworkerId = new mongoose.Types.ObjectId().toString();
const token = jwt.sign({ id: currentUserId }, process.env.JWT_SECRET);

const auth = (req) => req.set("Authorization", `Bearer ${token}`);

const makeQuery = (value) => ({
  selectedFields: null,
  skipValue: null,
  limitValue: null,
  sortValue: null,
  select(fields) {
    this.selectedFields = fields;
    return this;
  },
  skip(valueArg) {
    this.skipValue = valueArg;
    return this;
  },
  limit(valueArg) {
    this.limitValue = valueArg;
    return this;
  },
  sort(valueArg) {
    this.sortValue = valueArg;
    return Promise.resolve(value);
  },
});

test.beforeEach(() => {
  User.findById = (id) => ({
    select: () =>
      Promise.resolve({
        _id: id,
        role: "user",
        status: "active",
        email: "current@example.com",
        fullName: "Current User",
      }),
  });
});

test.afterEach(() => {
  User.findById = originals.userFindById;
  User.find = originals.userFind;
  User.countDocuments = originals.userCountDocuments;
});

test("authenticated users can search active coworkers for chat", async () => {
  let capturedFindFilter;
  let capturedCountFilter;
  let mongoQuery;

  User.find = (filter) => {
    capturedFindFilter = filter;
    mongoQuery = makeQuery([
      {
        _id: coworkerId,
        fullName: "An Nguyen",
        email: "an@example.com",
        avatar: "/uploads/an.png",
        position: "Designer",
        status: "active",
        activityStatus: "idle",
      },
    ]);
    return mongoQuery;
  };
  User.countDocuments = async (filter) => {
    capturedCountFilter = filter;
    return 1;
  };

  const res = await auth(
    request(app).get("/api/users/search?keyword=an&page=1&size=5"),
  );

  assert.equal(res.status, 200);
  assert.equal(capturedFindFilter.status, "active");
  assert.equal(capturedFindFilter._id.$ne.toString(), currentUserId);
  assert.equal(capturedFindFilter.$or.length, 2);
  assert.equal(capturedCountFilter, capturedFindFilter);
  assert.equal(
    mongoQuery.selectedFields,
    "_id fullName email avatar position status activityStatus activityStatusExpiresAt",
  );
  assert.equal(mongoQuery.skipValue, 0);
  assert.equal(mongoQuery.limitValue, 5);
  assert.deepEqual(res.body.content, [
    {
      id: coworkerId,
      fullName: "An Nguyen",
      email: "an@example.com",
      avatar: "/uploads/an.png",
      position: "Designer",
      status: "active",
      activityStatus: "idle",
      activityStatusExpiresAt: null,
      isOnline: false,
    },
  ]);
});

test("authenticated users can update their chat activity status", async () => {
  let savedActivityStatus = null;
  let savedActivityStatusExpiresAt = null;
  const userDoc = {
    _id: currentUserId,
    role: "user",
    status: "active",
    email: "current@example.com",
    fullName: "Current User",
    activityStatus: "online",
    activityStatusExpiresAt: null,
    select() {
      return Promise.resolve(this);
    },
    async save() {
      savedActivityStatus = this.activityStatus;
      savedActivityStatusExpiresAt = this.activityStatusExpiresAt;
      return this;
    },
  };

  User.findById = () => userDoc;

  const res = await auth(
    request(app).patch("/api/users/me/activity-status"),
  ).send({ activityStatus: "dnd", expiresInMinutes: 60 });

  assert.equal(res.status, 200);
  assert.equal(savedActivityStatus, "dnd");
  assert.ok(savedActivityStatusExpiresAt instanceof Date);
  assert.equal(res.body.activityStatus, "dnd");
  assert.ok(res.body.activityStatusExpiresAt);
  assert.equal(res.body.fullName, "Current User");
});
