import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileTypeFromBuffer } from "file-type";
import ApiError from "../utils/apiError.js";
import Organization from "../models/Organization.js";
import OrganizationInvite from "../models/OrganizationInvite.js";
import OrganizationMember from "../models/OrganizationMember.js";
import OrganizationRole from "../models/OrganizationRole.js";
import User from "../models/User.js";
import {
  buildR2OrganizationBannerKey,
  buildR2OrganizationLogoKey,
  getR2StorageService,
} from "../services/r2StorageService.js";
import { logActivity } from "../services/activityLogService.js";
import { contentDisposition } from "../utils/fileResponse.js";
import {
  hasOrganizationPermission,
  normalizeInviteCode,
  normalizeRoleKey,
  normalizeRolePermissions,
} from "../utils/organizationPolicy.js";
import {
  buildOrganizationDashboard,
  buildUserOrganizationContext,
  buildOrganizationStatsMap,
  createUniqueInviteCode,
  deleteExpiredOrganizationInvites,
  createUniqueOrganizationSlug,
  ensureOrganizationMember,
  ensureOrganizationJoinRequest,
  ensureDefaultOrganizationRoles,
  findInviteTarget,
  getOrganizationRoles,
  normalizeOrganizationInvitePayload,
  normalizeOrganizationPayload,
  normalizeOrganizationRolePayload,
  normalizeOrganizationSettingsPayload,
  resumeExpiredOrganizationInvitePauses,
  serializeOrganization,
  serializeOrganizationInvite,
  serializeOrganizationRole,
} from "../services/organizationService.js";
import { getPresenceFields } from "../services/presenceService.js";

const getBaseUrl = (req) =>
  process.env.FRONTEND_URL ||
  req.get("origin") ||
  `${req.protocol}://${req.get("host")}`;

const ORGANIZATION_MEDIA_R2_PREFIX = "organizations/";
const ALLOWED_LOGO_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
const ALLOWED_LOGO_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_BANNER_SIZE_BYTES = 8 * 1024 * 1024;
const HOUR_MS = 60 * 60 * 1000;
const PAUSE_DURATION_HOURS = new Set([1, 2, 4, 6, 12, 24]);

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

const normalizePauseDurationHours = (value) => {
  const duration = Number(value);
  return PAUSE_DURATION_HOURS.has(duration) ? duration : 1;
};

const isOrganizationLogoStorageKey = (storageKey = "") =>
  storageKey.startsWith(ORGANIZATION_MEDIA_R2_PREFIX) &&
  storageKey.includes("/logos/");

const isOrganizationBannerStorageKey = (storageKey = "") =>
  storageKey.startsWith(ORGANIZATION_MEDIA_R2_PREFIX) &&
  storageKey.includes("/banners/");

export const buildOrganizationLogoProxyUrl = (storageKey) => {
  if (!isOrganizationLogoStorageKey(storageKey)) return "";
  const params = new URLSearchParams({ key: storageKey });
  return `/api/organizations/logos?${params.toString()}`;
};

export const buildOrganizationBannerProxyUrl = (storageKey) => {
  if (!isOrganizationBannerStorageKey(storageKey)) return "";
  const params = new URLSearchParams({ key: storageKey });
  return `/api/organizations/banners?${params.toString()}`;
};

const validateOrganizationImageFile = async (
  file,
  { label = "Image", maxSizeBytes = MAX_LOGO_SIZE_BYTES } = {},
) => {
  if (!file) {
    throw new ApiError(400, `${label} file is required`);
  }

  if (file.size > maxSizeBytes) {
    throw new ApiError(
      400,
      `${label} file must be smaller than ${Math.round(maxSizeBytes / 1024 / 1024)}MB`,
    );
  }

  const extension = path.extname(file.originalname || "").toLowerCase();
  if (!ALLOWED_LOGO_EXTENSIONS.has(extension)) {
    throw new ApiError(400, `${label} file extension is not allowed`);
  }

  if (!ALLOWED_LOGO_MIMES.has(file.mimetype)) {
    throw new ApiError(400, "Only JPEG, PNG, GIF, or WebP images are allowed");
  }

  const detectedType = await fileTypeFromBuffer(file.buffer);
  if (!detectedType || !ALLOWED_LOGO_MIMES.has(detectedType.mime)) {
    throw new ApiError(400, `${label} content is not a supported image`);
  }

  if (detectedType.mime !== file.mimetype) {
    throw new ApiError(400, `${label} content does not match its MIME type`);
  }

  return {
    safeName: sanitizeLogoFileName(file.originalname),
    mimeType: detectedType.mime,
  };
};

const validateOrganizationLogoFile = (file) =>
  validateOrganizationImageFile(file, { label: "Logo" });

const validateOrganizationBannerFile = (file) =>
  validateOrganizationImageFile(file, {
    label: "Banner",
    maxSizeBytes: MAX_BANNER_SIZE_BYTES,
  });

const getActiveMembership = async (organizationId, userId) =>
  OrganizationMember.findOne({
    organizationId,
    userId,
    status: "active",
  });

const getMembershipWithPermissions = async (organizationId, userId) => {
  const membership = await getActiveMembership(organizationId, userId);
  if (!membership) return null;

  const roles = await getOrganizationRoles(organizationId);
  const role = roles.find((item) => item.key === membership.role);
  membership.permissions = role
    ? serializeOrganizationRole(role).permissions
    : normalizeRolePermissions(membership.role);
  return { membership, role, roles };
};

const requireOrganizationPermission = async (
  organizationId,
  userId,
  permissionKey,
  message,
) => {
  const result = await getMembershipWithPermissions(organizationId, userId);
  if (!result?.membership) {
    throw new ApiError(403, "You are not a member of this organization");
  }
  if (!hasOrganizationPermission(result.membership, permissionKey)) {
    throw new ApiError(403, message || "You do not have permission");
  }
  return result;
};

const recordInviteSuccessfulUse = async (invite, membership, userId) => {
  if (!invite || !membership || membership.inviteUsageCountedAt) return;
  if (String(invite.createdBy?._id || invite.createdBy) === String(userId)) {
    await membership.save();
    return;
  }

  const maxUses = invite.maxUses ?? null;
  if (maxUses && Number(invite.usesCount || 0) >= maxUses) {
    throw new ApiError(400, "Invite usage limit has been reached");
  }

  const usedAt = new Date();
  invite.usesCount = Number(invite.usesCount || 0) + 1;
  invite.lastUsedAt = usedAt;
  membership.inviteUsageCountedAt = usedAt;
  if (!membership.inviteId) membership.inviteId = invite._id;

  await Promise.all([invite.save(), membership.save()]);
};

const recordMembershipInviteUsage = async (membership) => {
  if (!membership?.inviteId || membership.inviteUsageCountedAt) return;

  const invite = await OrganizationInvite.findOne({
    _id: membership.inviteId,
    organizationId: membership.organizationId,
  });
  if (!invite) {
    await membership.save();
    return;
  }
  await recordInviteSuccessfulUse(invite, membership, membership.userId?._id || membership.userId);
};

const serializeOrganizationWithStats = async (organization, membership, req) => {
  const organizationId = String(organization?._id || organization?.id || "");
  const [statsMap, roles, personalInvite] = await Promise.all([
    buildOrganizationStatsMap([organizationId]),
    getOrganizationRoles(organizationId),
    OrganizationInvite.findOne({
      organizationId,
      createdBy: req.user._id,
      status: "active",
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    }).sort({ createdAt: -1 }),
  ]);
  const role = roles.find((item) => item.key === membership?.role);
  return serializeOrganization(organization, membership, {
    baseUrl: getBaseUrl(req),
    stats: statsMap.get(organizationId),
    role,
    invite: personalInvite,
  });
};

const serializeMember = (membership, roleMap = new Map()) => {
  const user = membership.userId;
  const role = roleMap.get(membership.role);
  const rolePayload = role ? serializeOrganizationRole(role) : null;
  return {
    id: String(membership._id),
    organizationId: String(membership.organizationId),
    role: membership.role,
    roleLabel: rolePayload?.name || membership.role,
    roleColor: rolePayload?.color || "#64748b",
    permissions: rolePayload?.permissions || {},
    status: membership.status,
    joinedAt: membership.joinedAt,
    invitedBy: membership.invitedBy ? String(membership.invitedBy) : null,
    user: user
      ? {
          id: String(user._id || user.id),
          _id: user._id || user.id,
          fullName: user.fullName,
          email: user.email,
          avatar: user.avatar,
          position: user.position,
          status: user.status,
          ...getPresenceFields(user),
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
    inviteCode: await createUniqueInviteCode(),
  });

  await ensureDefaultOrganizationRoles(organization._id, req.user._id);

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
    organization: await serializeOrganizationWithStats(organization, membership, req),
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
  const inviteTarget = await findInviteTarget(inviteCode);
  if (!inviteTarget?.organization) {
    throw new ApiError(404, "Invite link is invalid or disabled");
  }
  const { organization, invite } = inviteTarget;
  const requireApproval =
    organization.settings?.requireApproval !== false && !invite?.bypassApproval;
  const existingMembership = await OrganizationMember.findOne({
    organizationId: organization._id,
    userId: req.user._id,
  }).select("status");
  const shouldTrackInviteUse = Boolean(
    invite &&
      String(invite.createdBy) !== String(req.user._id) &&
      !["active", "pending"].includes(existingMembership?.status),
  );

  const membership = await ensureOrganizationJoinRequest(
    organization._id,
    req.user._id,
    {
      invitedBy: invite?.createdBy || null,
      inviteId: shouldTrackInviteUse ? invite?._id : null,
      requireApproval,
      role: organization.settings?.defaultRoleKey || "member",
    },
  );

  if (shouldTrackInviteUse && membership.status === "active") {
    await recordInviteSuccessfulUse(invite, membership, req.user._id);
  }

  if (membership.status === "active") {
    await User.findByIdAndUpdate(req.user._id, {
      activeOrganizationId: organization._id,
    });
    req.user.activeOrganizationId = organization._id;
  }

  res.status(membership.status === "pending" ? 202 : 200).json({
    organization: await serializeOrganizationWithStats(organization, membership, req),
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
  const permissionContext = await getMembershipWithPermissions(
    req.params.id,
    req.user._id,
  );
  const membership = permissionContext?.membership;
  if (!membership) {
    throw new ApiError(403, "You are not a member of this organization");
  }

  const requestedStatus = String(req.query.status || "active").toLowerCase();
  const canManage = hasOrganizationPermission(membership, "manageMembers");
  const canViewMembers = hasOrganizationPermission(membership, "viewMembers");
  if (!canViewMembers) {
    throw new ApiError(403, "You cannot view organization members");
  }
  const statuses =
    requestedStatus === "all" && canManage
      ? ["active", "pending"]
      : requestedStatus === "pending" && canManage
        ? ["pending"]
        : ["active"];
  const roleFilter = normalizeRoleKey(req.query.role || "");
  const search = String(req.query.search || "").trim();
  const query = {
    organizationId: req.params.id,
    status: { $in: statuses },
  };
  if (roleFilter) query.role = roleFilter;

  let members = await OrganizationMember.find(query)
    .populate(
      "userId",
      "_id fullName email avatar position status activityStatus activityStatusExpiresAt",
    )
    .sort({ status: 1, role: 1, joinedAt: 1, updatedAt: 1 });
  if (search) {
    const needle = search.toLowerCase();
    members = members.filter((member) => {
      const user = member.userId;
      return [user?.fullName, user?.email, user?.position, member.role].some(
        (value) => String(value || "").toLowerCase().includes(needle),
      );
    });
  }
  const roles = permissionContext.roles || (await getOrganizationRoles(req.params.id));
  const roleMap = new Map(roles.map((role) => [role.key, role]));

  res.json({
    content: members.map((member) => serializeMember(member, roleMap)),
    totalElements: members.length,
    pendingElements: members.filter((item) => item.status === "pending").length,
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

  res.json(await serializeOrganizationWithStats(organization, membership, req));
};

export const getOrganizationDetail = async (req, res) => {
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

  res.json(await serializeOrganizationWithStats(organization, membership, req));
};

export const getOrganizationOverview = async (req, res) => {
  await requireOrganizationPermission(
    req.params.id,
    req.user._id,
    "viewOverview",
    "You cannot view organization overview",
  );

  res.json(await buildOrganizationDashboard(req.params.id));
};

export const getOrganizationRoleList = async (req, res) => {
  const { membership, roles } = await requireOrganizationPermission(
    req.params.id,
    req.user._id,
    "viewMembers",
    "You cannot view organization roles",
  );
  const canManageRoles = hasOrganizationPermission(membership, "manageRoles");

  res.json({
    content: roles.map(serializeOrganizationRole),
    canManageRoles,
    permissionKeys: [
      "viewOverview",
      "viewMembers",
      "manageOrganization",
      "manageMembers",
      "manageRoles",
      "manageInvites",
      "manageSettings",
      "createInvites",
      "pauseInvites",
    ],
  });
};

export const createOrganizationRole = async (req, res) => {
  await requireOrganizationPermission(
    req.params.id,
    req.user._id,
    "manageRoles",
    "Only authorized members can create roles",
  );

  const payload = normalizeOrganizationRolePayload(req.body);
  if (!payload.name || !payload.key) {
    throw new ApiError(400, "Role name is required");
  }

  const existing = await OrganizationRole.findOne({
    organizationId: req.params.id,
    key: payload.key,
    archivedAt: null,
  });
  if (existing) {
    throw new ApiError(409, "Role key already exists");
  }

  const role = await OrganizationRole.create({
    organizationId: req.params.id,
    key: payload.key,
    name: payload.name,
    description: payload.description,
    color: payload.color,
    permissions: payload.permissions,
    isSystem: false,
    sortOrder: 50,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });

  res.status(201).json(serializeOrganizationRole(role));
};

export const updateOrganizationRole = async (req, res) => {
  await requireOrganizationPermission(
    req.params.id,
    req.user._id,
    "manageRoles",
    "Only authorized members can update roles",
  );

  const role = await OrganizationRole.findOne({
    _id: req.params.roleId,
    organizationId: req.params.id,
    archivedAt: null,
  });
  if (!role) {
    throw new ApiError(404, "Role not found");
  }
  if (role.key === "owner" && req.body.permissions) {
    throw new ApiError(400, "Owner permissions cannot be reduced");
  }

  const payload = normalizeOrganizationRolePayload({
    ...role.toObject(),
    ...req.body,
    key: role.key,
  });
  role.name = payload.name || role.name;
  role.description = payload.description;
  role.color = payload.color;
  role.permissions =
    role.key === "owner"
      ? role.permissions
      : {
          ...(role.permissions?.toObject?.() || role.permissions || {}),
          ...payload.permissions,
        };
  role.updatedBy = req.user._id;
  await role.save();

  res.json(serializeOrganizationRole(role));
};

export const deleteOrganizationRole = async (req, res) => {
  await requireOrganizationPermission(
    req.params.id,
    req.user._id,
    "manageRoles",
    "Only authorized members can delete roles",
  );

  const role = await OrganizationRole.findOne({
    _id: req.params.roleId,
    organizationId: req.params.id,
    archivedAt: null,
  });
  if (!role) {
    throw new ApiError(404, "Role not found");
  }
  if (role.isSystem || ["owner", "admin", "member"].includes(role.key)) {
    throw new ApiError(400, "System roles cannot be deleted");
  }

  const membersUsingRole = await OrganizationMember.countDocuments({
    organizationId: req.params.id,
    role: role.key,
    status: { $in: ["active", "pending"] },
  });
  if (membersUsingRole > 0) {
    throw new ApiError(400, "Move members to another role before deleting it");
  }

  role.archivedAt = new Date();
  role.updatedBy = req.user._id;
  await role.save();

  res.status(204).send();
};

export const updateOrganizationMember = async (req, res) => {
  await requireOrganizationPermission(
    req.params.id,
    req.user._id,
    "manageMembers",
    "Only authorized members can update members",
  );

  const membership = await OrganizationMember.findOne({
    _id: req.params.memberId,
    organizationId: req.params.id,
    status: { $in: ["active", "pending"] },
  }).populate(
    "userId",
    "_id fullName email avatar position status activityStatus activityStatusExpiresAt",
  );
  if (!membership) {
    throw new ApiError(404, "Member not found");
  }
  if (membership.role === "owner") {
    throw new ApiError(400, "Owner role cannot be changed here");
  }

  const roleKey = normalizeRoleKey(req.body?.role || "");
  if (roleKey) {
    const role = await OrganizationRole.findOne({
      organizationId: req.params.id,
      key: roleKey,
      archivedAt: null,
    });
    if (!role || role.key === "owner") {
      throw new ApiError(400, "Role is invalid");
    }
    membership.role = role.key;
    membership.roleId = role._id;
  }

  await membership.save();
  const roles = await getOrganizationRoles(req.params.id);
  const roleMap = new Map(roles.map((role) => [role.key, role]));
  res.json(serializeMember(membership, roleMap));
};

export const getOrganizationInvites = async (req, res) => {
  const permissionContext = await getMembershipWithPermissions(
    req.params.id,
    req.user._id,
  );
  const membership = permissionContext?.membership;
  if (!membership) {
    throw new ApiError(403, "You are not a member of this organization");
  }

  const canManageInvites = hasOrganizationPermission(membership, "manageInvites");
  await Promise.all([
    deleteExpiredOrganizationInvites({ organizationId: req.params.id }),
    resumeExpiredOrganizationInvitePauses({ organizationId: req.params.id }),
  ]);

  const query = { organizationId: req.params.id };
  if (!canManageInvites) query.createdBy = req.user._id;
  if (String(req.query.status || "active") !== "all") {
    query.status = String(req.query.status || "active");
  }

  const invites = await OrganizationInvite.find(query)
    .populate("createdBy", "_id fullName email avatar")
    .sort({ status: 1, createdAt: -1 });

  res.json({
    content: invites.map((invite) =>
      serializeOrganizationInvite(invite, {
        baseUrl: getBaseUrl(req),
        canManageInvites,
        currentUserId: req.user._id,
      }),
    ),
    canManageInvites,
    canCreateInvites:
      hasOrganizationPermission(membership, "createInvites") ||
      hasOrganizationPermission(membership, "manageInvites"),
  });
};

export const createOrganizationInvite = async (req, res) => {
  const organization = await Organization.findById(req.params.id);
  if (!organization || organization.archivedAt) {
    throw new ApiError(404, "Organization not found");
  }

  const permissionContext = await getMembershipWithPermissions(
    req.params.id,
    req.user._id,
  );
  const membership = permissionContext?.membership;
  if (!membership) {
    throw new ApiError(403, "You are not a member of this organization");
  }

  const canCreate =
    hasOrganizationPermission(membership, "manageInvites") ||
    (organization.settings?.allowMemberInvites !== false &&
      hasOrganizationPermission(membership, "createInvites"));
  if (!canCreate) {
    throw new ApiError(403, "You cannot create invites for this organization");
  }

  const payload = normalizeOrganizationInvitePayload(req.body);
  const invite = await OrganizationInvite.create({
    organizationId: req.params.id,
    createdBy: req.user._id,
    code: await createUniqueInviteCode(),
    maxUses: payload.maxUses,
    expiresAt: payload.expiresAt,
    bypassApproval:
      organization.settings?.requireApproval !== false && payload.bypassApproval,
    note: payload.note,
  });
  await invite.populate("createdBy", "_id fullName email avatar");

  res.status(201).json(
    serializeOrganizationInvite(invite, {
      baseUrl: getBaseUrl(req),
      canManageInvites: hasOrganizationPermission(membership, "manageInvites"),
      currentUserId: req.user._id,
    }),
  );
};

export const updateOrganizationInvite = async (req, res) => {
  const permissionContext = await getMembershipWithPermissions(
    req.params.id,
    req.user._id,
  );
  const membership = permissionContext?.membership;
  if (!membership) {
    throw new ApiError(403, "You are not a member of this organization");
  }

  const invite = await OrganizationInvite.findOne({
    _id: req.params.inviteId,
    organizationId: req.params.id,
  }).populate("createdBy", "_id fullName email avatar");
  if (!invite) {
    throw new ApiError(404, "Invite not found");
  }

  const canManage = hasOrganizationPermission(membership, "manageInvites");
  const isOwner = String(invite.createdBy?._id || invite.createdBy) === String(req.user._id);
  if (!canManage && !isOwner) {
    throw new ApiError(403, "You cannot update this invite");
  }

  const status = String(req.body?.status || "").toLowerCase();
  if (status) {
    if (!["active", "paused", "revoked"].includes(status)) {
      throw new ApiError(400, "Invite status is invalid");
    }
    invite.status = status;
    if (status === "paused") {
      const pausedUntil = new Date(
        Date.now() + normalizePauseDurationHours(req.body?.durationHours) * HOUR_MS,
      );
      invite.pausedAt = new Date();
      invite.pausedBy = req.user._id;
      invite.pausedUntil = pausedUntil;
    } else if (status === "active" || status === "revoked") {
      invite.pausedAt = null;
      invite.pausedBy = null;
      invite.pausedUntil = null;
    }
  }

  const payload = normalizeOrganizationInvitePayload(req.body);
  if (req.body.maxUses !== undefined) invite.maxUses = payload.maxUses;
  if (req.body.expiresAt !== undefined) invite.expiresAt = payload.expiresAt;
  if (req.body.note !== undefined) invite.note = payload.note;
  await invite.save();

  res.json(
    serializeOrganizationInvite(invite, {
      baseUrl: getBaseUrl(req),
      canManageInvites: canManage,
      currentUserId: req.user._id,
    }),
  );
};

export const deleteOrganizationInvite = async (req, res) => {
  const permissionContext = await getMembershipWithPermissions(
    req.params.id,
    req.user._id,
  );
  const membership = permissionContext?.membership;
  if (!membership) {
    throw new ApiError(403, "You are not a member of this organization");
  }

  const invite = await OrganizationInvite.findOne({
    _id: req.params.inviteId,
    organizationId: req.params.id,
  });
  if (!invite) {
    throw new ApiError(404, "Invite not found");
  }

  const canManage = hasOrganizationPermission(membership, "manageInvites");
  const isOwner = String(invite.createdBy) === String(req.user._id);
  if (!canManage && !isOwner) {
    throw new ApiError(403, "You cannot delete this invite");
  }

  await invite.deleteOne();
  res.status(204).send();
};

export const pauseOrganizationInvites = async (req, res) => {
  const { membership } = await requireOrganizationPermission(
    req.params.id,
    req.user._id,
    "pauseInvites",
    "Only authorized members can pause invites",
  );

  const scope = String(req.body?.scope || "all").toLowerCase();
  const query = {
    organizationId: req.params.id,
    status: "active",
  };
  if (scope === "mine" && !hasOrganizationPermission(membership, "manageInvites")) {
    query.createdBy = req.user._id;
  }

  const pausedUntil = new Date(
    Date.now() + normalizePauseDurationHours(req.body?.durationHours) * HOUR_MS,
  );
  const result = await OrganizationInvite.updateMany(query, {
    $set: {
      status: "paused",
      pausedAt: new Date(),
      pausedBy: req.user._id,
      pausedUntil,
    },
  });

  res.json({ pausedCount: result.modifiedCount || 0, pausedUntil });
};

export const updateOrganizationSettings = async (req, res) => {
  const { membership } = await requireOrganizationPermission(
    req.params.id,
    req.user._id,
    "manageSettings",
    "Only authorized members can update organization settings",
  );

  const settings = normalizeOrganizationSettingsPayload(req.body);
  const update = {};
  Object.entries(settings).forEach(([key, value]) => {
    update[`settings.${key}`] = value;
  });
  if (!Object.keys(update).length) {
    throw new ApiError(400, "No settings to update");
  }

  if (settings.defaultRoleKey) {
    const role = await OrganizationRole.findOne({
      organizationId: req.params.id,
      key: settings.defaultRoleKey,
      archivedAt: null,
    });
    if (!role || role.key === "owner") {
      throw new ApiError(400, "Default role is invalid");
    }
  }

  const organization = await Organization.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  });
  if (!organization || organization.archivedAt) {
    throw new ApiError(404, "Organization not found");
  }

  res.json(await serializeOrganizationWithStats(organization, membership, req));
};

export const updateOrganization = async (req, res) => {
  const { membership } = await requireOrganizationPermission(
    req.params.id,
    req.user._id,
    "manageOrganization",
    "Only authorized members can update the organization",
  );

  const payload = normalizeOrganizationPayload(req.body);
  const update = {};
  if (payload.name) update.name = payload.name;
  if (payload.description !== undefined) update.description = payload.description;
  if (payload.accentColor) update.accentColor = payload.accentColor;
  if (req.body.inviteEnabled !== undefined) {
    update.inviteEnabled = Boolean(req.body.inviteEnabled);
  }
  if (req.body.rotateInviteCode === true) {
    update.inviteCode = await createUniqueInviteCode();
  }

  const organization = await Organization.findByIdAndUpdate(
    req.params.id,
    update,
    { new: true, runValidators: true },
  );
  if (!organization) {
    throw new ApiError(404, "Organization not found");
  }

  res.json(await serializeOrganizationWithStats(organization, membership, req));
};

export const updateOrganizationLogo = async (req, res) => {
  const { membership } = await requireOrganizationPermission(
    req.params.id,
    req.user._id,
    "manageOrganization",
    "Only authorized members can update the organization",
  );

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

  res.json(await serializeOrganizationWithStats(organization, membership, req));
};

export const updateOrganizationBanner = async (req, res) => {
  const { membership } = await requireOrganizationPermission(
    req.params.id,
    req.user._id,
    "manageOrganization",
    "Only authorized members can update the organization",
  );

  const organization = await Organization.findById(req.params.id).select(
    "+bannerStorageKey",
  );
  if (!organization || organization.archivedAt) {
    throw new ApiError(404, "Organization not found");
  }

  const validation = await validateOrganizationBannerFile(req.file);
  const storageKey = buildR2OrganizationBannerKey(
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
      mediaType: "banner",
    },
  });

  const oldStorageKey = organization.bannerStorageKey;
  organization.bannerStorageKey = storageKey;
  organization.bannerUrl = buildOrganizationBannerProxyUrl(storageKey);
  await organization.save();

  await logActivity({
    actorId: req.user._id,
    action: "Cập nhật ảnh biểu ngữ",
    entityType: "organization",
    entityId: organization._id,
    organizationId: organization._id,
    metadata: {
      mediaType: "banner",
      mimeType: validation.mimeType,
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  if (oldStorageKey && oldStorageKey !== storageKey) {
    storage.deleteObject({ key: oldStorageKey }).catch(() => {});
  }

  res.json(await serializeOrganizationWithStats(organization, membership, req));
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

export const streamOrganizationBanner = async (req, res) => {
  try {
    const storageKey = getSingleString(req.query.key).trim();
    if (!storageKey || !isOrganizationBannerStorageKey(storageKey)) {
      return res.status(400).json({ message: "Invalid organization banner key" });
    }

    const object = await getR2StorageService().getObjectStream({
      key: storageKey,
    });

    if (!object.body) {
      return res.status(404).json({ message: "Organization banner not found" });
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
      contentDisposition("inline", storageKey.split("/").pop() || "banner"),
    );
    res.setHeader("Cache-Control", "public, max-age=3600");

    await pipeline(object.body, res);
  } catch (error) {
    console.error("StreamOrganizationBanner error:", error.message);
    return res.status(404).json({ message: "Organization banner not found" });
  }
};

export const updateOrganizationFavorite = async (req, res) => {
  const membership = await getActiveMembership(req.params.id, req.user._id);
  if (!membership) {
    throw new ApiError(403, "You are not a member of this organization");
  }

  membership.isFavorite =
    req.body?.isFavorite === undefined
      ? !membership.isFavorite
      : Boolean(req.body.isFavorite);
  await membership.save();

  const organization = await Organization.findById(req.params.id);
  if (!organization || organization.archivedAt) {
    throw new ApiError(404, "Organization not found");
  }

  res.json(await serializeOrganizationWithStats(organization, membership, req));
};

export const reviewOrganizationJoinRequest = async (req, res) => {
  await requireOrganizationPermission(
    req.params.id,
    req.user._id,
    "manageMembers",
    "Only authorized members can review requests",
  );

  const action = String(req.body?.action || "").toLowerCase();
  if (!["approve", "reject"].includes(action)) {
    throw new ApiError(400, "action must be approve or reject");
  }

  const membership = await OrganizationMember.findOne({
    _id: req.params.memberId,
    organizationId: req.params.id,
    status: "pending",
  }).populate(
    "userId",
    "_id fullName email avatar position status activityStatus activityStatusExpiresAt",
  );

  if (!membership) {
    throw new ApiError(404, "Pending membership request not found");
  }

  if (action === "approve") {
    membership.status = "active";
    membership.joinedAt = new Date();
    membership.removedAt = null;
    if (membership.inviteId && !membership.inviteUsageCountedAt) {
      await recordMembershipInviteUsage(membership);
    } else {
      await membership.save();
    }
    await User.findOneAndUpdate(
      { _id: membership.userId?._id || membership.userId, activeOrganizationId: null },
      { activeOrganizationId: req.params.id },
    );
  } else {
    membership.status = "removed";
    membership.removedAt = new Date();
    await membership.save();
  }

  res.json({
    member: serializeMember(membership),
    ...(await buildUserOrganizationContext(req.user, {
      baseUrl: getBaseUrl(req),
      persistFallback: true,
    })),
  });
};

export const leaveOrganization = async (req, res) => {
  const membership = await OrganizationMember.findOne({
    organizationId: req.params.id,
    userId: req.user._id,
    status: { $in: ["active", "pending"] },
  });
  if (!membership) {
    throw new ApiError(404, "Organization membership not found");
  }

  if (membership.status === "active" && membership.role === "owner") {
    throw new ApiError(400, "Organization owner cannot leave the organization");
  }

  const wasActive = membership.status === "active";
  membership.status = "removed";
  membership.removedAt = new Date();
  await membership.save();

  if (wasActive) {
    const remaining = await OrganizationMember.findOne({
      userId: req.user._id,
      status: "active",
    }).sort({ updatedAt: -1 });
    await User.findByIdAndUpdate(req.user._id, {
      activeOrganizationId: remaining?.organizationId || null,
    });
    req.user.activeOrganizationId = remaining?.organizationId || null;
  }

  res.json(
    await buildUserOrganizationContext(req.user, {
      baseUrl: getBaseUrl(req),
      persistFallback: true,
    }),
  );
};
