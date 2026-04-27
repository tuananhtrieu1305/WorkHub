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
  userFindOne: User.findOne,
};

const userId = new mongoose.Types.ObjectId().toString();
const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);

const makeUser = (status = "active") => ({
  _id: userId,
  fullName: "Locked User",
  email: "locked@example.com",
  role: "user",
  avatar: "",
  status,
  isVerified: true,
  password: "hashed",
  matchPassword: async () => true,
});

test.afterEach(() => {
  User.findById = originals.userFindById;
  User.findOne = originals.userFindOne;
});

test("auth middleware rejects locked users with existing tokens", async () => {
  User.findById = () => ({
    select: () => Promise.resolve(makeUser("locked")),
  });

  const res = await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(res.status, 403);
  assert.match(res.body.message, /account is not active/i);
});

test("auth middleware rejects disabled users with existing tokens", async () => {
  User.findById = () => ({
    select: () => Promise.resolve(makeUser("disabled")),
  });

  const res = await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(res.status, 403);
  assert.match(res.body.message, /account is not active/i);
});

test("normal login rejects locked users", async () => {
  User.findOne = () => ({
    select: () => Promise.resolve(makeUser("locked")),
  });

  const res = await request(app).post("/api/auth/login").send({
    email: "locked@example.com",
    password: "password",
  });

  assert.equal(res.status, 403);
  assert.match(res.body.message, /account is not active/i);
});

test("google login rejects disabled users", async () => {
  User.findOne = async () => makeUser("disabled");

  const res = await request(app).post("/api/auth/google").send({
    email: "locked@example.com",
    name: "Locked User",
    picture: "",
    sub: "google-id",
  });

  assert.equal(res.status, 403);
  assert.match(res.body.message, /account is not active/i);
});
