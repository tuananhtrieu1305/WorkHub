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

const assertDocumentReadable = (user, document) => {
  if (!document || document.deletedAt || document.status === "deleted") {
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
        createdBy: req.user._id,
        idempotencyKey,
      });
      if (existing) {
        return res.status(existing.status === "active" ? 200 : 202).json(existing);
      }
    }

    const uploadSessionId = crypto.randomUUID();
    document = await Document.create({
      name: validation.safeName,
      description: req.body.description || "",
      folderId: folder._id,
      departmentId: folder.departmentId,
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

    return res.status(201).json(document);
  } catch (error) {
    if (document?._id) {
      await Document.findByIdAndUpdate(document._id, { status: "failed" }).catch(() => {});
    }
    throw error;
  } finally {
    await cleanupTempFile(req.file);
  }
};

export const getDocument = async (req, res) => {
  const document = await Document.findById(req.params.id);
  assertDocumentReadable(req.user, document);

  const versions = await DocumentVersion.find({ documentId: document._id }).sort({
    versionNumber: -1,
  });

  res.json({ ...document.toObject(), versions });
};

export const updateDocument = async (req, res) => {
  const document = await Document.findById(req.params.id);
  assertDocumentEditable(req.user, document);

  const update = { updatedBy: req.user._id };
  if (req.body.description !== undefined) update.description = req.body.description;
  if (req.body.name !== undefined) update.name = req.body.name;

  const updated = await Document.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  });

  res.json(updated);
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

  await streamVersion({ res, version, dispositionType: "attachment" });
};

export const previewDocument = async (req, res) => {
  const { document, version } = await getDocumentAndCurrentVersion(req.params.id);
  assertDocumentReadable(req.user, document);
  if (!version) throw new ApiError(404, "Document version not found");

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
  assertDocumentEditable(req.user, document);
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
