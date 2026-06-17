import fs from "node:fs";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { pipeline } from "node:stream/promises";

import ApiError from "../utils/apiError.js";
import Document from "../models/Document.js";
import DocumentVersion from "../models/DocumentVersion.js";
import DocumentShare from "../models/DocumentShare.js";
import Folder from "../models/Folder.js";
import { buildR2ObjectKey, getR2StorageService } from "../services/r2StorageService.js";
import permission from "../services/documentPermissionService.js";
import { setFileHeaders } from "../utils/fileResponse.js";
import { validateUploadedFile } from "../services/fileValidationService.js";
import { getLocalDateKey } from "../utils/dateKeys.js";
import {
  assertResourceInActiveOrganization,
  getRequestOrganizationId,
} from "../utils/organizationScope.js";

const cleanupTempFile = async (file) => {
  if (!file?.path) return;
  await fs.promises.unlink(file.path).catch(() => {});
};

const sha256File = async (filePath) => {
  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest("hex");
};

const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const DOCUMENT_CATEGORIES = new Set([
  "general",
  "policy",
  "report",
  "contract",
  "design",
  "finance",
  "technical",
  "other",
]);

const toId = (value) => {
  if (!value) return "";
  return String(value._id || value.id || value);
};

const parsePage = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const escapeRegExp = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeDocumentCategory = (value) => {
  const category = String(value || "").trim().toLowerCase();
  return DOCUMENT_CATEGORIES.has(category) ? category : "general";
};

const normalizeDocumentName = (value, fallback) => {
  const name = String(value || "")
    .trim()
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\\/]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 255);
  return name || fallback;
};

const normalizeDocumentTags = (value) => {
  const raw = (() => {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return [];
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return trimmed.split(",");
    }
    return [];
  })();

  return [
    ...new Set(
      raw
        .map((tag) => String(tag || "").trim().replace(/\s+/g, " ").slice(0, 40))
        .filter(Boolean),
    ),
  ].slice(0, 12);
};

const readableDocumentScope = (user) => {
  if (permission.canManageAllDocuments(user)) return null;

  const userId = toId(user?._id);
  return {
    $or: [
      { ownerId: userId },
      { createdBy: userId },
      { "permissions.visibility": "organization" },
      {
        "permissions.users": {
          $elemMatch: {
            userId,
            role: { $in: ["viewer", "editor"] },
          },
        },
      },
    ],
  };
};

const getDocumentSort = (sort = "recent") => {
  switch (sort) {
    case "name":
      return { name: 1 };
    case "oldest":
      return { updatedAt: 1 };
    case "created":
      return { createdAt: -1 };
    default:
      return { updatedAt: -1 };
  }
};

const getVersionPayload = (version) => {
  const item = version?.toObject?.() || version;
  if (!item) return null;
  return {
    id: toId(item._id),
    versionNumber: item.versionNumber,
    originalName: item.originalName,
    mimeType: item.mimeType,
    extension: item.extension,
    size: item.size,
    checksum: item.checksum,
    scanStatus: item.scanStatus,
    uploadedBy: toId(item.uploadedBy),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
};

const getUserPayload = (user) => {
  const item = user?.toObject?.() || user;
  if (!item) return null;
  return {
    id: toId(item._id),
    fullName: item.fullName || "",
    email: item.email || "",
    avatar: item.avatar || "",
    position: item.position || "",
  };
};

const getFolderPayload = (folder) => {
  const item = folder?.toObject?.() || folder;
  if (!item) return null;
  return {
    id: toId(item._id),
    name: item.name || "",
    parentId: toId(item.parentId) || null,
    isDefaultPortalFolder: Boolean(item.isDefaultPortalFolder),
  };
};

const serializeDocument = (document, user) => {
  const item = document?.toObject?.() || document;
  const version = getVersionPayload(item.currentVersionId);
  return {
    id: toId(item._id),
    name: item.name,
    description: item.description || "",
    category: item.category || "general",
    tags: item.tags || [],
    folderId: toId(item.folderId?._id || item.folderId),
    organizationId: toId(item.organizationId),
    ownerId: toId(item.ownerId?._id || item.ownerId),
    createdBy: toId(item.createdBy?._id || item.createdBy),
    updatedBy: toId(item.updatedBy?._id || item.updatedBy),
    status: item.status,
    currentVersion: version,
    versionCounter: item.versionCounter || version?.versionNumber || 0,
    permissions: item.permissions || {},
    previewCount: item.previewCount || 0,
    downloadCount: item.downloadCount || 0,
    lastAccessedAt: item.lastAccessedAt || null,
    owner: getUserPayload(item.ownerId),
    creator: getUserPayload(item.createdBy),
    folder: getFolderPayload(item.folderId),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    capabilities: {
      canRead: permission.canRead(user, item),
      canEdit: permission.canEdit(user, item),
      canDelete: permission.canDelete(user, item),
      canShare: permission.canShare(user, item),
      canUploadVersion: permission.canEdit(user, item),
    },
  };
};

const ensureDefaultPortalFolder = async (req) => {
  const organizationId = getRequestOrganizationId(req);
  if (!organizationId) {
    throw new ApiError(
      409,
      "Please create or join an organization before uploading documents",
      "NO_ACTIVE_ORGANIZATION",
    );
  }

  const existing = await Folder.findOne({
    organizationId,
    isDefaultPortalFolder: true,
    deletedAt: null,
  });
  if (existing) return existing;

  return Folder.create({
    name: "Tài liệu chung",
    organizationId,
    parentId: null,
    ownerId: req.organization?.ownerId || req.user._id,
    createdBy: req.user._id,
    permissions: {
      visibility: "organization",
      users: [],
    },
    isDefaultPortalFolder: true,
  });
};

const resolveUploadFolder = async (req) => {
  const folderId = req.body.folderId || req.query.folderId;
  if (!folderId) return ensureDefaultPortalFolder(req);

  const folder = await Folder.findById(folderId);
  if (!folder || folder.deletedAt) {
    throw new ApiError(404, "Folder not found");
  }
  assertResourceInActiveOrganization(req, folder, "Folder");
  return folder;
};

const assertDocumentReadable = (user, document) => {
  if (!document || document.deletedAt || document.status === "deleted") {
    throw new ApiError(404, "Document not found");
  }
  if (String(document.organizationId || "") !== String(user?.activeOrganizationId || "")) {
    throw new ApiError(404, "Document not found");
  }
  if (!permission.canRead(user, document)) {
    throw new ApiError(403, "You do not have access to this document");
  }
};

const assertDocumentEditable = (user, document) => {
  assertDocumentReadable(user, document);
  if (!permission.canEdit(user, document)) {
    throw new ApiError(403, "You cannot update this document");
  }
};

const getDocumentAndCurrentVersion = async (documentId) => {
  const document = await Document.findById(documentId);
  if (!document) return { document: null, version: null };

  const version = document.currentVersionId
    ? await DocumentVersion.findById(document.currentVersionId)
    : null;

  return { document, version };
};

const streamVersion = async ({ res, version, dispositionType }) => {
  const storage = getR2StorageService();
  const object = await storage.getObjectStream({ key: version.storageKey });

  setFileHeaders(
    res,
    {
      contentType: object.contentType || version.mimeType,
      contentLength: object.contentLength || version.size,
      originalName: version.originalName,
    },
    dispositionType,
  );

  await pipeline(object.body, res);
};

export const uploadDocumentToFolder = async (req, res) => {
  let uploadedKey = null;
  let document = null;

  try {
    const folder = await Folder.findById(req.params.id);
    if (!folder || folder.deletedAt) {
      throw new ApiError(404, "Folder not found");
    }
    assertResourceInActiveOrganization(req, folder, "Folder");
    if (!permission.canUploadToFolder(req.user, folder)) {
      throw new ApiError(403, "You cannot upload to this folder");
    }

    const validation = await validateUploadedFile(req.file);
    if (!validation.ok) {
      throw new ApiError(400, validation.message);
    }

    const idempotencyKey = req.get("Idempotency-Key") || null;
    if (idempotencyKey) {
      const existing = await Document.findOne({
        organizationId: getRequestOrganizationId(req),
        createdBy: req.user._id,
        idempotencyKey,
      })
        .populate("ownerId", "_id fullName email avatar position")
        .populate("createdBy", "_id fullName email avatar position")
        .populate("folderId", "_id name parentId isDefaultPortalFolder")
        .populate("currentVersionId");
      if (existing) {
        return res
          .status(existing.status === "active" ? 200 : 202)
          .json(serializeDocument(existing, req.user));
      }
    }

    const uploadSessionId = crypto.randomUUID();
    document = await Document.create({
      name: normalizeDocumentName(req.body.name, validation.safeName),
      description: req.body.description || "",
      category: normalizeDocumentCategory(req.body.category),
      tags: normalizeDocumentTags(req.body.tags),
      folderId: folder._id,
      organizationId: folder.organizationId,
      ownerId: req.user._id,
      createdBy: req.user._id,
      status: "uploading",
      uploadSessionId,
      idempotencyKey,
      permissions: {
        inheritFromFolder: true,
        visibility: folder.permissions?.visibility || "private",
        users: folder.permissions?.users || [],
      },
    });

    const versionId = new mongoose.Types.ObjectId();
    const storageKey = buildR2ObjectKey({
      documentId: document._id.toString(),
      versionId: versionId.toString(),
    });
    uploadedKey = storageKey;

    const checksum = await sha256File(req.file.path);
    const storage = getR2StorageService();
    await storage.putObject({
      key: storageKey,
      body: fs.createReadStream(req.file.path),
      contentType: validation.mimeType,
      contentLength: req.file.size,
      metadata: {
        documentId: document._id.toString(),
        versionId: versionId.toString(),
      },
    });

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const [version] = await DocumentVersion.create(
          [
            {
              _id: versionId,
              documentId: document._id,
              versionNumber: 1,
              originalName: validation.safeName,
              storageBucket: process.env.R2_BUCKET_NAME,
              storageKey,
              mimeType: validation.mimeType,
              detectedMimeType: validation.detectedMimeType,
              extension: validation.extension,
              size: req.file.size,
              checksum,
              uploadedBy: req.user._id,
            },
          ],
          { session },
        );

        document = await Document.findByIdAndUpdate(
          document._id,
          {
            currentVersionId: version._id,
            versionCounter: 1,
            status: "active",
            updatedBy: req.user._id,
          },
          { new: true, session },
        );
      });
    } catch (error) {
      await getR2StorageService().deleteObject({ key: uploadedKey }).catch(() => {});
      throw error;
    } finally {
      await session.endSession();
    }

    const responseDocument = await Document.findById(document._id)
      .populate("ownerId", "_id fullName email avatar position")
      .populate("createdBy", "_id fullName email avatar position")
      .populate("folderId", "_id name parentId isDefaultPortalFolder")
      .populate("currentVersionId");

    return res.status(201).json(serializeDocument(responseDocument, req.user));
  } catch (error) {
    if (document?._id) {
      await Document.findByIdAndUpdate(document._id, { status: "failed" }).catch(() => {});
    }
    throw error;
  } finally {
    await cleanupTempFile(req.file);
  }
};

export const uploadDocumentToPortal = async (req, res) => {
  let folderResolved = false;
  try {
    const folder = await resolveUploadFolder(req);
    folderResolved = true;
    req.params.id = folder._id.toString();
    return uploadDocumentToFolder(req, res);
  } catch (error) {
    if (!folderResolved) {
      await cleanupTempFile(req.file);
    }
    throw error;
  }
};

export const listDocuments = async (req, res) => {
  const organizationId = getRequestOrganizationId(req);
  if (!organizationId) {
    return res.json({
      content: [],
      totalElements: 0,
      totalPages: 0,
      currentPage: 1,
      pageSize: parsePage(req.query.size, 24),
      capabilities: {
        canUpload: false,
        canViewInsights: false,
        canManageFolders: false,
        canManageAllDocuments: false,
      },
    });
  }

  const page = parsePage(req.query.page, 1);
  const size = Math.min(parsePage(req.query.size, 24), 100);
  const query = {
    organizationId,
    deletedAt: null,
    status: { $ne: "deleted" },
  };
  const andClauses = [];
  const readableScope = readableDocumentScope(req.user);

  if (readableScope) andClauses.push(readableScope);
  if (req.query.folderId) query.folderId = req.query.folderId;
  if (req.query.status && req.query.status !== "all") query.status = req.query.status;
  if (req.query.category && req.query.category !== "all") {
    query.category = normalizeDocumentCategory(req.query.category);
  }
  if (req.query.owner === "mine") {
    query.ownerId = req.user._id;
  }
  if (req.query.extension && req.query.extension !== "all") {
    andClauses.push({
      currentVersionId: {
        $in: await DocumentVersion.find({
          extension: String(req.query.extension).toLowerCase(),
        }).distinct("_id"),
      },
    });
  }

  const search = String(req.query.search || "").trim();
  if (search) {
    const expression = new RegExp(escapeRegExp(search), "i");
    andClauses.push({
      $or: [
        { name: expression },
        { description: expression },
        { category: expression },
        { tags: expression },
      ],
    });
  }
  if (andClauses.length) query.$and = andClauses;

  const [documents, totalElements] = await Promise.all([
    Document.find(query)
      .populate("ownerId", "_id fullName email avatar position")
      .populate("createdBy", "_id fullName email avatar position")
      .populate("folderId", "_id name parentId isDefaultPortalFolder")
      .populate("currentVersionId")
      .sort(getDocumentSort(req.query.sort))
      .skip((page - 1) * size)
      .limit(size),
    Document.countDocuments(query),
  ]);

  res.json({
    content: documents.map((document) => serializeDocument(document, req.user)),
    totalElements,
    totalPages: Math.ceil(totalElements / size),
    currentPage: page,
    pageSize: size,
    capabilities: {
      canUpload: true,
      canViewInsights: permission.canViewDocumentInsights(req.user),
      canManageFolders: permission.canManageDocumentPortal(req.user),
      canManageAllDocuments: permission.canManageAllDocuments(req.user),
    },
  });
};

export const getDocumentStats = async (req, res) => {
  const organizationId = getRequestOrganizationId(req);
  if (!organizationId) {
    throw new ApiError(
      409,
      "Please create or join an organization before viewing document stats",
      "NO_ACTIVE_ORGANIZATION",
    );
  }
  if (!permission.canViewDocumentInsights(req.user)) {
    throw new ApiError(403, "You cannot view document statistics");
  }

  const documents = await Document.find({
    organizationId,
    deletedAt: null,
    status: { $ne: "deleted" },
  })
    .populate("ownerId", "_id fullName email avatar position")
    .populate("folderId", "_id name parentId isDefaultPortalFolder")
    .populate("currentVersionId")
    .sort({ updatedAt: -1 });

  const folders = await Folder.find({ organizationId, deletedAt: null });
  const categoryCounts = new Map();
  const statusCounts = new Map();
  const extensionCounts = new Map();
  const uploaderMap = new Map();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const activityMap = new Map();
  let storageBytes = 0;
  let downloads = 0;
  let previews = 0;

  documents.forEach((document) => {
    const doc = document.toObject();
    const version = doc.currentVersionId || {};
    storageBytes += Number(version.size || 0);
    downloads += Number(doc.downloadCount || 0);
    previews += Number(doc.previewCount || 0);
    categoryCounts.set(doc.category || "general", (categoryCounts.get(doc.category || "general") || 0) + 1);
    statusCounts.set(doc.status || "unknown", (statusCounts.get(doc.status || "unknown") || 0) + 1);
    const extension = version.extension || "other";
    extensionCounts.set(extension, (extensionCounts.get(extension) || 0) + 1);

    const ownerId = toId(doc.ownerId?._id || doc.ownerId);
    if (ownerId) {
      const existing = uploaderMap.get(ownerId) || {
        owner: getUserPayload(doc.ownerId),
        documents: 0,
        storageBytes: 0,
      };
      existing.documents += 1;
      existing.storageBytes += Number(version.size || 0);
      uploaderMap.set(ownerId, existing);
    }

    const createdAt = new Date(doc.createdAt);
    if (Number.isFinite(createdAt.getTime())) {
      const key = getLocalDateKey(createdAt);
      activityMap.set(key, (activityMap.get(key) || 0) + 1);
    }
  });

  const trend = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (13 - index));
    const key = getLocalDateKey(date);
    return {
      key,
      label: date.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
      }),
      value: activityMap.get(key) || 0,
    };
  });

  res.json({
    summary: {
      totalDocuments: documents.length,
      totalFolders: folders.length,
      storageBytes,
      downloads,
      previews,
      activeDocuments: statusCounts.get("active") || 0,
      failedDocuments: statusCounts.get("failed") || 0,
      uploadingDocuments: statusCounts.get("uploading") || 0,
    },
    categories: Array.from(categoryCounts, ([key, value]) => ({ key, value })),
    statuses: Array.from(statusCounts, ([key, value]) => ({ key, value })),
    extensions: Array.from(extensionCounts, ([key, value]) => ({ key, value })),
    trend,
    topUploaders: Array.from(uploaderMap.values())
      .sort((a, b) => b.documents - a.documents)
      .slice(0, 5),
    recentDocuments: documents
      .slice(0, 6)
      .map((document) => serializeDocument(document, req.user)),
    capabilities: {
      canViewInsights: true,
      canManageFolders: permission.canManageDocumentPortal(req.user),
      canManageAllDocuments: permission.canManageAllDocuments(req.user),
    },
  });
};

export const getDocument = async (req, res) => {
  const document = await Document.findById(req.params.id)
    .populate("ownerId", "_id fullName email avatar position")
    .populate("createdBy", "_id fullName email avatar position")
    .populate("folderId", "_id name parentId isDefaultPortalFolder")
    .populate("currentVersionId");
  assertDocumentReadable(req.user, document);

  const versions = await DocumentVersion.find({ documentId: document._id }).sort({
    versionNumber: -1,
  });

  res.json({
    ...serializeDocument(document, req.user),
    versions: versions.map(getVersionPayload),
  });
};

export const updateDocument = async (req, res) => {
  const document = await Document.findById(req.params.id);
  assertDocumentEditable(req.user, document);

  const update = { updatedBy: req.user._id };
  if (req.body.description !== undefined) {
    update.description = String(req.body.description || "").trim().slice(0, 2000);
  }
  if (req.body.name !== undefined) {
    const name = String(req.body.name || "").trim();
    if (!name) throw new ApiError(400, "Document name is required");
    update.name = name.slice(0, 255);
  }
  if (req.body.category !== undefined) {
    update.category = normalizeDocumentCategory(req.body.category);
  }
  if (req.body.tags !== undefined) {
    update.tags = normalizeDocumentTags(req.body.tags);
  }
  if (req.body.folderId !== undefined && req.body.folderId !== toId(document.folderId)) {
    const folder = await Folder.findById(req.body.folderId);
    if (!folder || folder.deletedAt) {
      throw new ApiError(404, "Folder not found");
    }
    assertResourceInActiveOrganization(req, folder, "Folder");
    if (!permission.canUploadToFolder(req.user, folder)) {
      throw new ApiError(403, "You cannot move documents to this folder");
    }
    update.folderId = folder._id;
  }

  const updated = await Document.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  })
    .populate("ownerId", "_id fullName email avatar position")
    .populate("createdBy", "_id fullName email avatar position")
    .populate("folderId", "_id name parentId isDefaultPortalFolder")
    .populate("currentVersionId");

  res.json(serializeDocument(updated, req.user));
};

export const deleteDocument = async (req, res) => {
  const document = await Document.findById(req.params.id);
  assertDocumentEditable(req.user, document);

  await Document.findByIdAndUpdate(req.params.id, {
    status: "deleted",
    deletedAt: new Date(),
    updatedBy: req.user._id,
  });

  res.status(204).send();
};

export const uploadDocumentVersion = async (req, res) => {
  let uploadedKey = null;

  try {
    const document = await Document.findById(req.params.id);
    assertDocumentEditable(req.user, document);

    const validation = await validateUploadedFile(req.file);
    if (!validation.ok) {
      throw new ApiError(400, validation.message);
    }

    const reserved = await Document.findOneAndUpdate(
      { _id: document._id, deletedAt: null, status: { $ne: "deleted" } },
      { $inc: { versionCounter: 1 }, updatedBy: req.user._id },
      { new: true },
    );
    if (!reserved) {
      throw new ApiError(409, "Could not reserve a new version number");
    }
    const versionNumber = reserved.versionCounter;
    const versionId = new mongoose.Types.ObjectId();
    const storageKey = buildR2ObjectKey({
      documentId: document._id.toString(),
      versionId: versionId.toString(),
    });
    uploadedKey = storageKey;

    const checksum = await sha256File(req.file.path);
    await getR2StorageService().putObject({
      key: storageKey,
      body: fs.createReadStream(req.file.path),
      contentType: validation.mimeType,
      contentLength: req.file.size,
      metadata: {
        documentId: document._id.toString(),
        versionId: versionId.toString(),
      },
    });

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const [version] = await DocumentVersion.create(
          [
            {
              _id: versionId,
              documentId: document._id,
              versionNumber,
              originalName: validation.safeName,
              storageBucket: process.env.R2_BUCKET_NAME,
              storageKey,
              mimeType: validation.mimeType,
              detectedMimeType: validation.detectedMimeType,
              extension: validation.extension,
              size: req.file.size,
              checksum,
              uploadedBy: req.user._id,
            },
          ],
          { session },
        );

        await Document.findByIdAndUpdate(
          document._id,
          {
            currentVersionId: version._id,
            status: "active",
            updatedBy: req.user._id,
          },
          { session },
        );
      });
    } catch (error) {
      await getR2StorageService().deleteObject({ key: uploadedKey }).catch(() => {});
      throw error;
    } finally {
      await session.endSession();
    }

    res.status(201).json({ versionId: versionId.toString(), message: "Version uploaded" });
  } finally {
    await cleanupTempFile(req.file);
  }
};

export const listDocumentVersions = async (req, res) => {
  const document = await Document.findById(req.params.id);
  assertDocumentReadable(req.user, document);

  const versions = await DocumentVersion.find({ documentId: document._id }).sort({
    versionNumber: -1,
  });

  res.json(versions);
};

export const downloadDocument = async (req, res) => {
  const { document, version } = await getDocumentAndCurrentVersion(req.params.id);
  assertDocumentReadable(req.user, document);
  if (!version) throw new ApiError(404, "Document version not found");

  await Document.findByIdAndUpdate(document._id, {
    $inc: { downloadCount: 1 },
    lastAccessedAt: new Date(),
  });
  await streamVersion({ res, version, dispositionType: "attachment" });
};

export const previewDocument = async (req, res) => {
  const { document, version } = await getDocumentAndCurrentVersion(req.params.id);
  assertDocumentReadable(req.user, document);
  if (!version) throw new ApiError(404, "Document version not found");

  await Document.findByIdAndUpdate(document._id, {
    $inc: { previewCount: 1 },
    lastAccessedAt: new Date(),
  });
  await streamVersion({ res, version, dispositionType: "inline" });
};

export const previewDocumentVersion = async (req, res) => {
  const document = await Document.findById(req.params.id);
  assertDocumentReadable(req.user, document);
  const version = await DocumentVersion.findById(req.params.versionId);
  if (!permission.canViewVersion(req.user, document, version)) {
    throw new ApiError(404, "Document version not found");
  }

  await streamVersion({ res, version, dispositionType: "inline" });
};

export const createDocumentShare = async (req, res) => {
  const document = await Document.findById(req.params.id);
  assertDocumentReadable(req.user, document);
  if (!permission.canShare(req.user, document)) {
    throw new ApiError(403, "You cannot share this document");
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const mode = req.body.mode || "fixed_version";
  const share = await DocumentShare.create({
    documentId: document._id,
    versionId: mode === "latest" ? null : document.currentVersionId,
    mode,
    tokenHash: hashToken(token),
    permission: req.body.permission || "view",
    expiresAt: req.body.expiry ? new Date(req.body.expiry) : null,
    maxDownloads: req.body.maxDownloads || null,
    createdBy: req.user._id,
  });

  const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`;

  res.status(201).json({
    shareId: share._id,
    shareLink: `${baseUrl}/share/documents/${token}`,
  });
};

const resolveShare = async (token, requiredPermission) => {
  const share = await DocumentShare.findOne({ tokenHash: hashToken(token) }).select("+tokenHash");
  if (!share || share.revokedAt) {
    throw new ApiError(404, "Share link not found");
  }
  if (share.expiresAt && share.expiresAt < new Date()) {
    throw new ApiError(410, "Share link has expired");
  }
  if (share.maxDownloads && share.downloadCount >= share.maxDownloads) {
    throw new ApiError(410, "Share link download limit reached");
  }
  if (requiredPermission === "download" && share.permission !== "download") {
    throw new ApiError(403, "Share link does not allow downloads");
  }

  const document = await Document.findById(share.documentId);
  if (!document || document.deletedAt || document.status !== "active") {
    throw new ApiError(404, "Document not found");
  }

  const version =
    share.mode === "latest"
      ? await DocumentVersion.findById(document.currentVersionId)
      : await DocumentVersion.findById(share.versionId);

  if (!version) {
    throw new ApiError(404, "Document version not found");
  }

  await DocumentShare.findByIdAndUpdate(share._id, {
    lastAccessedAt: new Date(),
    ...(requiredPermission === "download" ? { $inc: { downloadCount: 1 } } : {}),
  });

  return { document, version };
};

export const previewSharedDocument = async (req, res) => {
  const { version } = await resolveShare(req.params.token, "view");
  await streamVersion({ res, version, dispositionType: "inline" });
};

export const downloadSharedDocument = async (req, res) => {
  const { version } = await resolveShare(req.params.token, "download");
  await streamVersion({ res, version, dispositionType: "attachment" });
};
