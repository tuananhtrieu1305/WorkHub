import ApiError from "../utils/apiError.js";
import Folder from "../models/Folder.js";
import Document from "../models/Document.js";
import permission from "../services/documentPermissionService.js";
import {
  assertResourceInActiveOrganization,
  getRequestOrganizationId,
  requireActiveOrganization,
} from "../utils/organizationScope.js";

const toId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value._id?.toString?.() || value.toString?.() || null;
};

const ALLOWED_VISIBILITIES = new Set(["private", "organization", "custom"]);

const parsePage = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const readableDocumentScope = (user) => {
  if (user?.role === "admin") return null;

  const userId = toId(user?._id);
  const clauses = [
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
  ];

  return { $or: clauses };
};

const normalizePermissions = (permissions) => {
  if (!permissions || typeof permissions !== "object") return permissions;
  const normalizedVisibility = ALLOWED_VISIBILITIES.has(permissions.visibility)
    ? permissions.visibility
    : "private";
  return {
    ...permissions,
    visibility: normalizedVisibility,
  };
};

const assertFolderAccess = (user, folder) => {
  if (!folder || folder.deletedAt) {
    throw new ApiError(404, "Folder not found");
  }
  if (!permission.canReadFolder(user, folder)) {
    throw new ApiError(403, "You do not have access to this folder");
  }
};

const assertFolderInActiveOrganization = (req, folder) => {
  assertResourceInActiveOrganization(req, folder, "Folder");
};

export const listFolders = async (req, res) => {
  const organizationId = getRequestOrganizationId(req);
  if (!organizationId) {
    return res.json([]);
  }

  const query = {
    organizationId,
    deletedAt: null,
  };

  if (req.query.parentId) {
    query.parentId = req.query.parentId;
  } else {
    query.parentId = null;
  }

  const folders = await Folder.find(query).sort({ name: 1 });
  const accessibleFolders = folders.filter((folder) =>
    permission.canReadFolder(req.user, folder),
  );

  res.json(accessibleFolders);
};

export const createFolder = async (req, res) => {
  const organizationId = requireActiveOrganization(req);
  const { name, parentId = null, permissions } = req.body;

  if (!name?.trim()) {
    throw new ApiError(400, "Folder name is required");
  }

  if (parentId) {
    const parent = await Folder.findById(parentId);
    assertFolderInActiveOrganization(req, parent);
    assertFolderAccess(req.user, parent);
    if (!permission.canUploadToFolder(req.user, parent)) {
      throw new ApiError(403, "You cannot create folders here");
    }
  }

  const folder = await Folder.create({
    name,
    organizationId,
    parentId,
    ownerId: req.user._id,
    createdBy: req.user._id,
    permissions: normalizePermissions(permissions),
  });

  res.status(201).json(folder);
};

export const getFolder = async (req, res) => {
  const folder = await Folder.findById(req.params.id);
  assertFolderInActiveOrganization(req, folder);
  assertFolderAccess(req.user, folder);

  const [folders, documents] = await Promise.all([
    Folder.find({ parentId: folder._id, deletedAt: null }).sort({ name: 1 }),
    Document.find({
      organizationId: getRequestOrganizationId(req),
      folderId: folder._id,
      deletedAt: null,
      status: { $ne: "deleted" },
    }).sort({ name: 1 }),
  ]);

  const children = [
    ...folders
      .filter((child) => permission.canReadFolder(req.user, child))
      .map((child) => ({ type: "folder", item: child })),
    ...documents
      .filter((document) => permission.canRead(req.user, document))
      .map((document) => ({ type: "document", item: document })),
  ];

  res.json({ folder, children });
};

export const updateFolder = async (req, res) => {
  const folder = await Folder.findById(req.params.id);
  assertFolderInActiveOrganization(req, folder);
  assertFolderAccess(req.user, folder);

  if (!permission.canUploadToFolder(req.user, folder)) {
    throw new ApiError(403, "You cannot update this folder");
  }

  const update = { updatedBy: req.user._id };
  if (req.body.name !== undefined) update.name = req.body.name;
  if (req.body.permissions !== undefined) {
    update.permissions = normalizePermissions(req.body.permissions);
  }

  const updated = await Folder.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  });

  res.json(updated);
};

export const deleteFolder = async (req, res) => {
  const folder = await Folder.findById(req.params.id);
  assertFolderInActiveOrganization(req, folder);
  assertFolderAccess(req.user, folder);

  if (!permission.canUploadToFolder(req.user, folder)) {
    throw new ApiError(403, "You cannot delete this folder");
  }

  await Folder.findByIdAndUpdate(req.params.id, {
    deletedAt: new Date(),
    updatedBy: req.user._id,
  });

  res.status(204).send();
};

export const listFolderDocuments = async (req, res) => {
  const folder = await Folder.findById(req.params.id);
  assertFolderInActiveOrganization(req, folder);
  assertFolderAccess(req.user, folder);

  const page = parsePage(req.query.page, 1);
  const size = Math.min(parsePage(req.query.size, 20), 100);
  const query = {
    organizationId: getRequestOrganizationId(req),
    folderId: folder._id,
    deletedAt: null,
    status: "active",
  };
  const readableScope = readableDocumentScope(req.user);
  if (readableScope) {
    query.$and = [readableScope];
  }

  const [documents, totalElements] = await Promise.all([
    Document.find(query)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * size)
      .limit(size),
    Document.countDocuments(query),
  ]);

  res.json({
    content: documents.filter((document) => permission.canRead(req.user, document)),
    totalElements,
  });
};
