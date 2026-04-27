import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import jwt from "jsonwebtoken";
import request from "supertest";
import mongoose from "mongoose";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";
process.env.R2_BUCKET_NAME = "workhub-documents-test";
process.env.FRONTEND_URL = "http://localhost:5173";

const { default: app } = await import("../src/app.js");
const { default: User } = await import("../src/models/User.js");
const { default: Folder } = await import("../src/models/Folder.js");
const { default: Document } = await import("../src/models/Document.js");
const { default: DocumentVersion } = await import("../src/models/DocumentVersion.js");
const { default: DocumentShare } = await import("../src/models/DocumentShare.js");
const {
  clearR2StorageServiceOverride,
  setR2StorageServiceOverride,
} = await import("../src/services/r2StorageService.js");

const originals = {
  userFindById: User.findById,
  folderFind: Folder.find,
  folderFindById: Folder.findById,
  folderCreate: Folder.create,
  documentFind: Document.find,
  documentFindById: Document.findById,
  documentFindOne: Document.findOne,
  documentFindOneAndUpdate: Document.findOneAndUpdate,
  documentCreate: Document.create,
  documentCountDocuments: Document.countDocuments,
  documentFindByIdAndUpdate: Document.findByIdAndUpdate,
  versionFind: DocumentVersion.find,
  versionFindById: DocumentVersion.findById,
  versionCreate: DocumentVersion.create,
  shareCreate: DocumentShare.create,
  shareFindOne: DocumentShare.findOne,
  shareFindByIdAndUpdate: DocumentShare.findByIdAndUpdate,
  startSession: mongoose.startSession,
};

const userId = new mongoose.Types.ObjectId().toString();
const folderId = new mongoose.Types.ObjectId().toString();
const documentId = new mongoose.Types.ObjectId().toString();
const versionId = new mongoose.Types.ObjectId().toString();
const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);

const auth = (req) => req.set("Authorization", `Bearer ${token}`);

const makeDoc = (data) => ({
  ...data,
  toObject() {
    return { ...data };
  },
});

const sortedQuery = (value) => ({
  sort: () => Promise.resolve(value),
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

test.beforeEach(() => {
  User.findById = () => ({
    select: () =>
      Promise.resolve({
        _id: userId,
        role: "user",
        departmentId: "department-1",
      }),
  });

  setR2StorageServiceOverride({
    putObject: async ({ key }) => ({ bucketName: "workhub-documents-test", key }),
    getObjectStream: async () => ({
      body: Readable.from(["%PDF-1.4 test"]),
      contentLength: 13,
      contentType: "application/pdf",
    }),
    headObject: async () => ({ contentLength: 13, contentType: "application/pdf" }),
    deleteObject: async () => ({}),
  });

  mongoose.startSession = async () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {},
  });
});

test.afterEach(() => {
  User.findById = originals.userFindById;
  Folder.find = originals.folderFind;
  Folder.findById = originals.folderFindById;
  Folder.create = originals.folderCreate;
  Document.find = originals.documentFind;
  Document.findById = originals.documentFindById;
  Document.findOne = originals.documentFindOne;
  Document.findOneAndUpdate = originals.documentFindOneAndUpdate;
  Document.create = originals.documentCreate;
  Document.countDocuments = originals.documentCountDocuments;
  Document.findByIdAndUpdate = originals.documentFindByIdAndUpdate;
  DocumentVersion.find = originals.versionFind;
  DocumentVersion.findById = originals.versionFindById;
  DocumentVersion.create = originals.versionCreate;
  DocumentShare.create = originals.shareCreate;
  DocumentShare.findOne = originals.shareFindOne;
  DocumentShare.findByIdAndUpdate = originals.shareFindByIdAndUpdate;
  mongoose.startSession = originals.startSession;
  clearR2StorageServiceOverride();
});

test("GET /api/folders lists folders visible to the user", async () => {
  const folder = makeDoc({
    _id: folderId,
    name: "Root",
    ownerId: userId,
    createdBy: userId,
    deletedAt: null,
    permissions: { visibility: "private", users: [] },
  });
  Folder.find = () => sortedQuery([folder]);

  const res = await auth(request(app).get("/api/folders"));

  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].name, "Root");
});

test("POST /api/folders creates a root folder", async () => {
  Folder.create = async (payload) => makeDoc({ _id: folderId, ...payload });

  const res = await auth(request(app).post("/api/folders")).send({
    name: "Contracts",
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.name, "Contracts");
  assert.equal(res.body.ownerId, userId);
});

test("GET /api/folders/:id/documents returns paginated document summaries", async () => {
  const folder = makeDoc({
    _id: folderId,
    ownerId: userId,
    createdBy: userId,
    deletedAt: null,
    permissions: { visibility: "private", users: [] },
  });
  const document = makeDoc({
    _id: documentId,
    name: "report.pdf",
    ownerId: userId,
    createdBy: userId,
    status: "active",
    deletedAt: null,
    permissions: { visibility: "private", users: [] },
  });

  Folder.findById = async () => folder;
  Document.find = () => pagedQuery([document]);
  Document.countDocuments = async () => 1;

  const res = await auth(request(app).get(`/api/folders/${folderId}/documents`));

  assert.equal(res.status, 200);
  assert.equal(res.body.totalElements, 1);
  assert.equal(res.body.content[0].name, "report.pdf");
});

test("GET /api/folders/:id/documents does not count inaccessible documents", async () => {
  const folder = makeDoc({
    _id: folderId,
    ownerId: userId,
    createdBy: userId,
    deletedAt: null,
    permissions: { visibility: "private", users: [] },
  });
  const document = makeDoc({
    _id: documentId,
    name: "private.pdf",
    ownerId: userId,
    createdBy: userId,
    status: "active",
    deletedAt: null,
    permissions: { visibility: "private", users: [] },
  });
  let findQuery;
  let countQuery;

  Folder.findById = async () => folder;
  Document.find = (query) => {
    findQuery = query;
    return pagedQuery([document]);
  };
  Document.countDocuments = async (query) => {
    countQuery = query;
    return 1;
  };

  const res = await auth(request(app).get(`/api/folders/${folderId}/documents`));

  assert.equal(res.status, 200);
  assert.equal(res.body.totalElements, 1);
  assert.deepEqual(findQuery, countQuery);
  assert.ok(findQuery.$and);
  assert.ok(findQuery.$and.some((part) => part.$or));
});

test("POST /api/folders/:id/documents uploads a PDF and finalizes metadata", async () => {
  const folder = makeDoc({
    _id: folderId,
    departmentId: "department-1",
    ownerId: userId,
    createdBy: userId,
    deletedAt: null,
    permissions: { visibility: "private", users: [] },
  });
  const createdDocument = makeDoc({
    _id: documentId,
    name: "report.pdf",
    ownerId: userId,
    createdBy: userId,
    status: "uploading",
    deletedAt: null,
    permissions: { visibility: "private", users: [] },
  });
  const finalizedDocument = makeDoc({
    ...createdDocument,
    status: "active",
    currentVersionId: versionId,
    versionCounter: 1,
  });

  Folder.findById = async () => folder;
  Document.findOne = async () => null;
  Document.create = async () => createdDocument;
  Document.findByIdAndUpdate = async () => finalizedDocument;
  DocumentVersion.create = async ([payload]) => [makeDoc({ _id: versionId, ...payload })];

  const pdf = Buffer.from("%PDF-1.4\n%test\n");
  const res = await auth(
    request(app)
      .post(`/api/folders/${folderId}/documents`)
      .set("Idempotency-Key", "upload-1"),
  )
    .field("description", "Quarter report")
    .attach("file", pdf, {
      filename: "report.pdf",
      contentType: "application/pdf",
    });

  assert.equal(res.status, 201);
  assert.equal(res.body.status, "active");
  assert.equal(res.body.versionCounter, 1);
});

test("GET /api/documents/:id returns document detail with versions", async () => {
  const document = makeDoc({
    _id: documentId,
    name: "report.pdf",
    ownerId: userId,
    createdBy: userId,
    status: "active",
    deletedAt: null,
    permissions: { visibility: "private", users: [] },
  });
  const version = makeDoc({
    _id: versionId,
    documentId,
    versionNumber: 1,
  });

  Document.findById = async () => document;
  DocumentVersion.find = () => sortedQuery([version]);

  const res = await auth(request(app).get(`/api/documents/${documentId}`));

  assert.equal(res.status, 200);
  assert.equal(res.body.name, "report.pdf");
  assert.equal(res.body.versions.length, 1);
});

test("GET /api/documents/:id/preview streams current version inline", async () => {
  const document = makeDoc({
    _id: documentId,
    currentVersionId: versionId,
    ownerId: userId,
    createdBy: userId,
    status: "active",
    deletedAt: null,
    permissions: { visibility: "private", users: [] },
  });
  const version = makeDoc({
    _id: versionId,
    documentId,
    originalName: "report.pdf",
    storageKey: "documents/doc/versions/ver/object",
    mimeType: "application/pdf",
    size: 13,
  });

  Document.findById = async () => document;
  DocumentVersion.findById = async () => version;

  const res = await auth(request(app).get(`/api/documents/${documentId}/preview`));

  assert.equal(res.status, 200);
  assert.equal(res.headers["content-type"], "application/pdf");
  assert.match(res.headers["content-disposition"], /^inline/);
});

test("POST /api/documents/:id/share creates a fixed-version share link", async () => {
  const document = makeDoc({
    _id: documentId,
    currentVersionId: versionId,
    ownerId: userId,
    createdBy: userId,
    status: "active",
    deletedAt: null,
    permissions: { visibility: "private", users: [] },
  });

  Document.findById = async () => document;
  DocumentShare.create = async (payload) => makeDoc({ _id: "share-1", ...payload });

  const res = await auth(request(app).post(`/api/documents/${documentId}/share`)).send({
    permission: "download",
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.shareId, "share-1");
  assert.match(res.body.shareLink, /^http:\/\/localhost:5173\/share\/documents\//);
});

test("POST /api/documents/:id/versions uploads a concurrency-reserved version", async () => {
  const document = makeDoc({
    _id: documentId,
    currentVersionId: versionId,
    ownerId: userId,
    createdBy: userId,
    status: "active",
    deletedAt: null,
    permissions: { visibility: "private", users: [] },
  });

  Document.findById = async () => document;
  Document.findOneAndUpdate = async () => makeDoc({ ...document, versionCounter: 2 });
  Document.findByIdAndUpdate = async () => makeDoc({ ...document, versionCounter: 2 });
  DocumentVersion.create = async ([payload]) => [makeDoc(payload)];

  const pdf = Buffer.from("%PDF-1.4\n%version2\n");
  const res = await auth(
    request(app).post(`/api/documents/${documentId}/versions`),
  ).attach("file", pdf, {
    filename: "report-v2.pdf",
    contentType: "application/pdf",
  });

  assert.equal(res.status, 201);
  assert.ok(res.body.versionId);
  assert.equal(res.body.message, "Version uploaded");
});

test("GET /api/share/documents/:token/download streams fixed shared version", async () => {
  const document = makeDoc({
    _id: documentId,
    currentVersionId: versionId,
    status: "active",
    deletedAt: null,
  });
  const version = makeDoc({
    _id: versionId,
    documentId,
    originalName: "shared.pdf",
    storageKey: "documents/doc/versions/ver/object",
    mimeType: "application/pdf",
    size: 13,
  });
  const share = makeDoc({
    _id: "share-1",
    documentId,
    versionId,
    mode: "fixed_version",
    permission: "download",
    downloadCount: 0,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
  });

  DocumentShare.findOne = () => ({
    select: () => Promise.resolve(share),
  });
  DocumentShare.findByIdAndUpdate = async () => share;
  Document.findById = async () => document;
  DocumentVersion.findById = async () => version;

  const res = await request(app).get("/api/share/documents/share-token/download");

  assert.equal(res.status, 200);
  assert.match(res.headers["content-disposition"], /^attachment/);
  assert.equal(res.headers["content-type"], "application/pdf");
});
