import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileTypeFromBuffer } from "file-type";
import ApiError from "../utils/apiError.js";
import Organization from "../models/Organization.js";
import OrganizationMember from "../models/OrganizationMember.js";
import User from "../models/User.js";
import {
  buildR2OrganizationLogoKey,
  getR2StorageService,
} from "../services/r2StorageService.js";
import { contentDisposition } from "../utils/fileResponse.js";
import {
  canManageOrganization,
  normalizeInviteCode,
} from "../utils/organizationPolicy.js";
import {
  buildUserOrganizationContext,
  createInviteCode,
  createUniqueOrganizationSlug,
  ensureOrganizationMember,
  findOrganizationByInvite,
  normalizeOrganizationPayload,
  serializeOrganization,
} from "../services/organizationService.js";

const getBaseUrl = (req) =>
  process.env.FRONTEND_URL ||
  req.get("origin") ||
  `${req.protocol}://${req.get("host")}`;

const ORGANIZATION_LOGO_R2_PREFIX = "organizations/";
const ALLOWED_LOGO_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
const ALLOWED_LOGO_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;

const getSingleString = (value, fallback = "") => {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return typeof value === "string" ? value : fallback;
};

const sanitizeLogoFileName = (fileName = "") => {
  const extension = path.extname(fileName).toLowerCase();
  const baseName = path
    .basename(fileName || "organization-logo", extension)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${baseName || "organization-logo"}${extension || ".png"}`;
};

const isOrganizationLogoStorageKey = (storageKey = "") =>
  storageKey.startsWith(ORGANIZATION_LOGO_R2_PREFIX) &&
  storageKey.includes("/logos/");

export const buildOrganizationLogoProxyUrl = (storageKey) => {
  if (!isOrganizationLogoStorageKey(storageKey)) return "";
  const params = new URLSearchParams({ key: storageKey });
  return `/api/organizations/logos?${params.toString()}`;
};

const validateOrganizationLogoFile = async (file) => {
  if (!file) {
    throw new ApiError(400, "Logo file is required");
  }

  if (file.size > MAX_LOGO_SIZE_BYTES) {
    throw new ApiError(400, "Logo file must be smaller than 5MB");
  }

  const extension = path.extname(file.originalname || "").toLowerCase();
  if (!ALLOWED_LOGO_EXTENSIONS.has(extension)) {
    throw new ApiError(400, "Logo file extension is not allowed");
  }

  if (!ALLOWED_LOGO_MIMES.has(file.mimetype)) {
    throw new ApiError(400, "Only JPEG, PNG, GIF, or WebP images are allowed");
  }

  const detectedType = await fileTypeFromBuffer(file.buffer);
  if (!detectedType || !ALLOWED_LOGO_MIMES.has(detectedType.mime)) {
    throw new ApiError(400, "Logo content is not a supported image");
  }

  if (detectedType.mime !== file.mimetype) {
    throw new ApiError(400, "Logo content does not match its MIME type");
  }

  return {
    safeName: sanitizeLogoFileName(file.originalname),
    mimeType: detectedType.mime,
  };
};

const getActiveMembership = async (organizationId, userId) =>
  OrganizationMember.findOne({
    organizationId,
    userId,
    status: "active",
  });

const serializeMember = (membership) => {
  const user = membership.userId;
  return {
    id: String(membership._id),
    organizationId: String(membership.organizationId),
    role: membership.role,
    status: membership.status,
    joinedAt: membership.joinedAt,
    user: user
      ? {
          id: String(user._id || user.id),
          _id: user._id || user.id,
          fullName: user.fullName,
          email: user.email,
          avatar: user.avatar,
          position: user.position,
          status: user.status,
        }
      : null,
  };
};

export const getMyOrganizations = async (req, res) => {
  const context = await buildUserOrganizationContext(req.user, {
    baseUrl: getBaseUrl(req),
    persistFallback: true,
  });

  res.json(context);
};

export const createOrganization = async (req, res) => {
  const payload = normalizeOrganizationPayload(req.body);
  if (!payload.name) {
    throw new ApiError(400, "Organization name is required");
  }

  const organization = await Organization.create({
    name: payload.name,
    slug: await createUniqueOrganizationSlug(payload.name),
    description: payload.description,
    accentColor: payload.accentColor,
    ownerId: req.user._id,
    createdBy: req.user._id,
    inviteCode: createInviteCode(),
  });

  const membership = await ensureOrganizationMember(
    organization._id,
    req.user._id,
    { role: "owner", invitedBy: req.user._id },
  );

  await User.findByIdAndUpdate(req.user._id, {
    activeOrganizationId: organization._id,
  });
  req.user.activeOrganizationId = organization._id;

  res.status(201).json({
    organization: serializeOrganization(organization, membership, {
      baseUrl: getBaseUrl(req),
    }),
    ...(await buildUserOrganizationContext(req.user, {
      baseUrl: getBaseUrl(req),
      persistFallback: true,
    })),
  });
};

export const joinOrganization = async (req, res) => {
  const inviteInput =
    req.body?.inviteLink || req.body?.inviteCode || req.params?.inviteCode;
  const inviteCode = normalizeInviteCode(inviteInput);
  const organization = await findOrganizationByInvite(inviteCode);
  if (!organization) {
    throw new ApiError(404, "Invite link is invalid or disabled");
  }

  const membership = await ensureOrganizationMember(
    organization._id,
    req.user._id,
    { role: "member" },
  );

  await User.findByIdAndUpdate(req.user._id, {
    activeOrganizationId: organization._id,
  });
  req.user.activeOrganizationId = organization._id;

  res.status(200).json({
    organization: serializeOrganization(organization, membership, {
      baseUrl: getBaseUrl(req),
    }),
    ...(await buildUserOrganizationContext(req.user, {
      baseUrl: getBaseUrl(req),
      persistFallback: true,
    })),
  });
};

export const switchOrganization = async (req, res) => {
  const { organizationId } = req.body;
  if (!organizationId) {
    throw new ApiError(400, "organizationId is required");
  }

  const membership = await getActiveMembership(organizationId, req.user._id);
  if (!membership) {
    throw new ApiError(403, "You are not a member of this organization");
  }

  await User.findByIdAndUpdate(req.user._id, {
    activeOrganizationId: organizationId,
  });
  req.user.activeOrganizationId = organizationId;

  res.json(
    await buildUserOrganizationContext(req.user, {
      baseUrl: getBaseUrl(req),
      persistFallback: true,
    }),
  );
};

export const getOrganizationMembers = async (req, res) => {
  const membership = await getActiveMembership(req.params.id, req.user._id);
  if (!membership) {
    throw new ApiError(403, "You are not a member of this organization");
  }

  const members = await OrganizationMember.find({
    organizationId: req.params.id,
    status: "active",
  })
    .populate("userId", "_id fullName email avatar position status")
    .sort({ role: 1, joinedAt: 1 });

  res.json({
    content: members.map(serializeMember),
    totalElements: members.length,
  });
};

export const getOrganizationInvite = async (req, res) => {
  const [organization, membership] = await Promise.all([
    Organization.findById(req.params.id),
    getActiveMembership(req.params.id, req.user._id),
  ]);

  if (!organization || organization.archivedAt) {
    throw new ApiError(404, "Organization not found");
  }
  if (!membership) {
    throw new ApiError(403, "You are not a member of this organization");
  }

  res.json(
    serializeOrganization(organization, membership, { baseUrl: getBaseUrl(req) }),
  );
};

export const updateOrganization = async (req, res) => {
  const membership = await getActiveMembership(req.params.id, req.user._id);
  if (!canManageOrganization(membership)) {
    throw new ApiError(403, "Only organization owners and admins can update it");
  }

  const payload = normalizeOrganizationPayload(req.body);
  const update = {};
  if (payload.name) update.name = payload.name;
  if (payload.description !== undefined) update.description = payload.description;
  if (payload.accentColor) update.accentColor = payload.accentColor;
  if (req.body.inviteEnabled !== undefined) {
    update.inviteEnabled = Boolean(req.body.inviteEnabled);
  }
  if (req.body.rotateInviteCode === true) {
    update.inviteCode = createInviteCode();
  }

  const organization = await Organization.findByIdAndUpdate(
    req.params.id,
    update,
    { new: true, runValidators: true },
  );
  if (!organization) {
    throw new ApiError(404, "Organization not found");
  }

  res.json(
    serializeOrganization(organization, membership, { baseUrl: getBaseUrl(req) }),
  );
};

export const updateOrganizationLogo = async (req, res) => {
  const membership = await getActiveMembership(req.params.id, req.user._id);
  if (!canManageOrganization(membership)) {
    throw new ApiError(403, "Only organization owners and admins can update it");
  }

  const organization = await Organization.findById(req.params.id).select(
    "+logoStorageKey",
  );
  if (!organization || organization.archivedAt) {
    throw new ApiError(404, "Organization not found");
  }

  const validation = await validateOrganizationLogoFile(req.file);
  const storageKey = buildR2OrganizationLogoKey(
    organization._id.toString(),
    validation.safeName,
  );
  const storage = getR2StorageService();

  await storage.putObject({
    key: storageKey,
    body: req.file.buffer,
    contentType: validation.mimeType,
    contentLength: req.file.size,
    metadata: {
      organizationId: organization._id.toString(),
      uploadedBy: req.user._id.toString(),
    },
  });

  const oldStorageKey = organization.logoStorageKey;
  organization.logoStorageKey = storageKey;
  organization.logoUrl = buildOrganizationLogoProxyUrl(storageKey);
  await organization.save();

  if (oldStorageKey && oldStorageKey !== storageKey) {
    storage.deleteObject({ key: oldStorageKey }).catch(() => {});
  }

  res.json(
    serializeOrganization(organization, membership, { baseUrl: getBaseUrl(req) }),
  );
};

export const streamOrganizationLogo = async (req, res) => {
  try {
    const storageKey = getSingleString(req.query.key).trim();
    if (!storageKey || !isOrganizationLogoStorageKey(storageKey)) {
      return res.status(400).json({ message: "Invalid organization logo key" });
    }

    const object = await getR2StorageService().getObjectStream({
      key: storageKey,
    });

    if (!object.body) {
      return res.status(404).json({ message: "Organization logo not found" });
    }

    res.setHeader(
      "Content-Type",
      object.contentType || "application/octet-stream",
    );
    if (object.contentLength !== undefined) {
      res.setHeader("Content-Length", String(object.contentLength));
    }
    res.setHeader(
      "Content-Disposition",
      contentDisposition("inline", storageKey.split("/").pop() || "logo"),
    );
    res.setHeader("Cache-Control", "public, max-age=3600");

    await pipeline(object.body, res);
  } catch (error) {
    console.error("StreamOrganizationLogo error:", error.message);
    return res.status(404).json({ message: "Organization logo not found" });
  }
};

export const leaveOrganization = async (req, res) => {
  const membership = await getActiveMembership(req.params.id, req.user._id);
  if (!membership) {
    throw new ApiError(404, "Organization membership not found");
  }

  if (membership.role === "owner") {
    throw new ApiError(400, "Organization owner cannot leave the organization");
  }

  membership.status = "removed";
  membership.removedAt = new Date();
  await membership.save();

  const remaining = await OrganizationMember.findOne({
    userId: req.user._id,
    status: "active",
  }).sort({ updatedAt: -1 });
  await User.findByIdAndUpdate(req.user._id, {
    activeOrganizationId: remaining?.organizationId || null,
  });
  req.user.activeOrganizationId = remaining?.organizationId || null;

  res.json(
    await buildUserOrganizationContext(req.user, {
      baseUrl: getBaseUrl(req),
      persistFallback: true,
    }),
  );
};
