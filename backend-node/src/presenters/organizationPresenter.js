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
  DEFAULT_MEMBER_ROLE_KEY,
  OWNER_ORGANIZATION_PERMISSIONS,
  ORGANIZATION_PERMISSION_KEYS,
  hasOrganizationPermission,
  normalizeInviteCode,
  normalizeRoleKey,
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
  getMembershipPermissions,
  getMembershipRoleIds,
  getMissingRequiredJoinAnswers,
  getOrganizationRoles,
  getRolesFromMap,
  normalizeOrganizationJoinAnswers,
  normalizeOrganizationInvitePayload,
  normalizeOrganizationJoinQuestions,
  normalizeOrganizationPayload,
  normalizeOrganizationRolePayload,
  normalizeOrganizationSettingsPayload,
  resumeExpiredOrganizationInvitePauses,
  serializeOrganization,
  serializeOrganizationInvite,
  serializeOrganizationRole,
  syncMembershipPrimaryRole,
  isOrganizationOwnerMembership,
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

const toId = (value) => String(value?._id || value?.id || value || "");

const isObjectIdLike = (value) => /^[a-f\d]{24}$/i.test(String(value || ""));

const roleMapKey = (organizationId, roleKey) =>
  `${toId(organizationId)}:${normalizeRoleKey(roleKey) || DEFAULT_MEMBER_ROLE_KEY}`;

const roleIdMapKey = (roleId) => `id:${toId(roleId)}`;

const buildRoleMap = (roles = []) => {
  const roleMap = new Map();
  roles.forEach((role) => {
    const doc = role?.toObject?.() || role;
    if (!doc) return;
    roleMap.set(roleIdMapKey(doc._id || doc.id), role);
    roleMap.set(roleMapKey(doc.organizationId, doc.key), role);
  });
  return roleMap;
};

const getRoleForMembership = (membership, roleMap = new Map()) => {
  if (!membership) return null;
  return getRolesFromMap(membership, roleMap)[0] || null;
};

const getRoleOrderIndex = (roles = [], role) => {
  const roleId = toId(role?._id || role?.id || role);
  if (!roleId) return -1;
  return roles.findIndex((item) => toId(item?._id || item?.id) === roleId);
};

const isOwnerInContext = (context) =>
  Boolean(context?.membership && isOrganizationOwnerMembership(
    context.membership,
    context.organization,
  ));

const canManageRoleInHierarchy = (context, targetRole) => {
  if (!context?.membership || !targetRole) return false;
  if (isOwnerInContext(context)) return true;
  if (!hasOrganizationPermission(context.membership, "manageRoles")) return false;

  const actorRole =
    context.role || getRoleForMembership(context.membership, buildRoleMap(context.roles));
  const actorIndex = getRoleOrderIndex(context.roles, actorRole);
  const targetIndex = getRoleOrderIndex(context.roles, targetRole);

  return actorIndex >= 0 && targetIndex > actorIndex;
};

const assertCanManageRoleInHierarchy = (context, targetRole, message) => {
  if (!canManageRoleInHierarchy(context, targetRole)) {
    throw new ApiError(
      403,
      message || "You can only manage roles below your highest role",
    );
  }
};

const canManageMemberInHierarchy = (context, targetMembership) => {
  if (!context?.membership || !targetMembership) return false;
  if (isOrganizationOwnerMembership(targetMembership, context.organization)) return false;
  if (isOwnerInContext(context)) return true;

  const roleMap = buildRoleMap(context.roles);
  const actorRole = context.role || getRoleForMembership(context.membership, roleMap);
  const targetRole = getRoleForMembership(targetMembership, roleMap);
  const actorIndex = getRoleOrderIndex(context.roles, actorRole);
  const targetIndex = getRoleOrderIndex(context.roles, targetRole);

  return actorIndex >= 0 && targetIndex > actorIndex;
};

const normalizeRoleMemberIds = (value) =>
  Array.isArray(value)
    ? [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))]
    : [];

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
  const [membership, organization] = await Promise.all([
    getActiveMembership(organizationId, userId),
    Organization.findOne({ _id: organizationId, archivedAt: null }),
  ]);
  if (!membership) return null;

  const roles = await getOrganizationRoles(organizationId);
  const roleMap = buildRoleMap(roles);
  const role = getRoleForMembership(membership, roleMap);
  const isOwner = isOrganizationOwnerMembership(membership, organization);
  membership.isOwner = isOwner;
  membership.permissions = isOwner
    ? { ...OWNER_ORGANIZATION_PERMISSIONS }
    : getMembershipPermissions(membership, roleMap);
  return { membership, role, roles, organization };
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

const getDefaultMembershipRole = async (organization) => {
  const organizationId = organization?._id || organization?.id || organization;
  const fallbackRole = await ensureDefaultOrganizationRoles(organizationId);
  const configuredRoleId = toId(organization?.settings?.defaultRoleId);
  const configuredRoleKey = normalizeRoleKey(organization?.settings?.defaultRoleKey);

  const role =
    (configuredRoleId && isObjectIdLike(configuredRoleId)
      ? await OrganizationRole.findOne({
          _id: configuredRoleId,
          organizationId,
          archivedAt: null,
        })
      : null) ||
    (configuredRoleKey
      ? await OrganizationRole.findOne({
          organizationId,
          key: configuredRoleKey,
          archivedAt: null,
        })
      : null) ||
    fallbackRole;

  if (
    role &&
    (!configuredRoleId ||
      configuredRoleId !== toId(role._id) ||
      configuredRoleKey !== role.key)
  ) {
    await Organization.updateOne(
      { _id: organizationId },
      {
        $set: {
          "settings.defaultRoleId": role._id,
          "settings.defaultRoleKey": role.key,
        },
      },
    );
    if (organization?.settings) {
      organization.settings.defaultRoleId = role._id;
      organization.settings.defaultRoleKey = role.key;
    }
  }

  return role;
};

const canBypassInviteApproval = (membership) =>
  hasOrganizationPermission(membership, "manageInvites") ||
  hasOrganizationPermission(membership, "manageMembers") ||
  hasOrganizationPermission(membership, "manageSettings");

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
  const role = getRoleForMembership(membership, buildRoleMap(roles));
  const defaultRole =
    roles.find((item) => item.isDefault) ||
    roles.find((item) => item.key === DEFAULT_MEMBER_ROLE_KEY) ||
    roles[0];
  if (defaultRole && organization?.settings && !organization.settings.defaultRoleId) {
    organization.settings.defaultRoleId = defaultRole._id;
    organization.settings.defaultRoleKey = defaultRole.key;
  }
  return serializeOrganization(organization, membership, {
    baseUrl: getBaseUrl(req),
    stats: statsMap.get(organizationId),
    role,
    roles: getRolesFromMap(membership, buildRoleMap(roles)),
    invite: personalInvite,
  });
};

const serializeJoinAnswer = (answer) => ({
  questionId: answer.questionId,
  questionLabel: answer.questionLabel || "",
  questionType: answer.questionType || "short_text",
  value: answer.value,
});

const serializeMember = (membership, roleMap = new Map(), organization = null) => {
  const user = membership.userId;
  const rolePayloads = getRolesFromMap(membership, roleMap).map((role) =>
    serializeOrganizationRole(role),
  );
  const rolePayload = rolePayloads[0] || null;
  const isOwner = isOrganizationOwnerMembership(membership, organization);
  return {
    id: String(membership._id),
    organizationId: String(membership.organizationId),
    roleId: rolePayload?.id || toId(membership.roleId) || null,
    roleIds: rolePayloads.map((role) => role.id).filter(Boolean),
    role: rolePayload?.key || membership.role || DEFAULT_MEMBER_ROLE_KEY,
    roleLabel: rolePayload?.name || membership.role || "Thành viên",
    roleColor: rolePayload?.color || "#64748b",
    roles: rolePayloads,
    isOwner,
    permissions: isOwner
      ? { ...OWNER_ORGANIZATION_PERMISSIONS }
      : getMembershipPermissions(membership, roleMap),
    status: membership.status,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt,
    joinedAt: membership.joinedAt,
    invitedBy: membership.invitedBy ? String(membership.invitedBy) : null,
    joinAnswers: (membership.joinAnswers || []).map(serializeJoinAnswer),
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

  const defaultRole = await ensureDefaultOrganizationRoles(
    organization._id,
    req.user._id,
  );
  if (defaultRole) {
    organization.settings.defaultRoleId = defaultRole._id;
    organization.settings.defaultRoleKey = defaultRole.key;
  }

  const membership = await ensureOrganizationMember(
    organization._id,
    req.user._id,
    {
      role: defaultRole?.key || DEFAULT_MEMBER_ROLE_KEY,
      roleId: defaultRole?._id || null,
      invitedBy: req.user._id,
    },
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

export const previewOrganizationJoin = async (req, res) => {
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
  const [memberCount, existingMembership] = await Promise.all([
    OrganizationMember.countDocuments({
      organizationId: organization._id,
      status: "active",
    }),
    OrganizationMember.findOne({
      organizationId: organization._id,
      userId: req.user._id,
    }).select("status"),
  ]);

  res.json({
    organization: {
      id: String(organization._id),
      name: organization.name,
      slug: organization.slug,
      description: organization.description || "",
      logoUrl: organization.logoUrl || "",
      bannerUrl: organization.bannerUrl || "",
      accentColor: organization.accentColor || "#2563eb",
      memberCount,
      memberStatus: existingMembership?.status || null,
    },
    requireApproval,
    joinMessage: organization.settings?.joinMessage || "",
    joinQuestions: requireApproval
      ? normalizeOrganizationJoinQuestions(organization.settings?.joinQuestions || [])
      : [],
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
  const joinQuestions = requireApproval
    ? normalizeOrganizationJoinQuestions(organization.settings?.joinQuestions || [])
    : [];
  const joinAnswers = normalizeOrganizationJoinAnswers(
    joinQuestions,
    req.body?.answers || req.body?.joinAnswers || {},
  );
  const missingAnswers = getMissingRequiredJoinAnswers(joinQuestions, joinAnswers);
  if (
    missingAnswers.length &&
    !["active", "pending"].includes(existingMembership?.status)
  ) {
    throw new ApiError(
      400,
      "Please answer all required join questions",
      "JOIN_QUESTIONS_REQUIRED",
    );
  }
  const shouldTrackInviteUse = Boolean(
    invite &&
      String(invite.createdBy) !== String(req.user._id) &&
      !["active", "pending"].includes(existingMembership?.status),
  );
  const defaultRole = await getDefaultMembershipRole(organization);

  const membership = await ensureOrganizationJoinRequest(
    organization._id,
    req.user._id,
    {
      invitedBy: invite?.createdBy || null,
      inviteId: shouldTrackInviteUse ? invite?._id : null,
      joinAnswers,
      requireApproval,
      role: defaultRole?.key || DEFAULT_MEMBER_ROLE_KEY,
      roleId: defaultRole?._id || null,
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
  const roleFilterValue = String(req.query.roleId || req.query.role || "").trim();
  const roleFilter = normalizeRoleKey(roleFilterValue);
  const search = String(req.query.search || "").trim();
  const query = {
    organizationId: req.params.id,
    status: { $in: statuses },
  };
  let roles = permissionContext.roles || null;
  if (roleFilterValue) {
    if (isObjectIdLike(roleFilterValue)) {
      query.$or = [{ roleIds: roleFilterValue }, { roleId: roleFilterValue }];
    } else if (roleFilter) {
      if (!roles) roles = await getOrganizationRoles(req.params.id);
      const matchedRole = roles.find((role) => normalizeRoleKey(role.key) === roleFilter);
      query.$or = matchedRole
        ? [
            { roleIds: matchedRole._id },
            { roleId: matchedRole._id },
            { role: roleFilter },
          ]
        : [{ role: roleFilter }];
    }
  }

  let members = await OrganizationMember.find(query)
    .populate(
      "userId",
      "_id fullName email avatar position status activityStatus activityStatusExpiresAt",
    )
    .sort({ status: 1, roleId: 1, role: 1, joinedAt: 1, updatedAt: 1 });
  if (!roles) roles = await getOrganizationRoles(req.params.id);
  const roleMap = buildRoleMap(roles);
  if (search) {
    const needle = search.toLowerCase();
    members = members.filter((member) => {
      const user = member.userId;
      const roleValues = getRolesFromMap(member, roleMap).flatMap((role) => [
        role.name,
        role.key,
        role.description,
      ]);
      return [
        user?.fullName,
        user?.email,
        user?.position,
        member.role,
        ...roleValues,
      ].some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }

  res.json({
    content: members.map((member) => ({
      ...serializeMember(member, roleMap, permissionContext.organization),
      canManage: canManageMemberInHierarchy(permissionContext, member),
    })),
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

const buildOrganizationRoleListPayload = async (
  context,
  roles = context?.roles || [],
  search = "",
) => {
  const { membership, organization } = context;
  const scopedContext = { ...context, roles };
  const canManageRoles = hasOrganizationPermission(membership, "manageRoles");
  const roleIds = roles.map((role) => role._id);
  const organizationId = organization?._id || roles[0]?.organizationId;
  const countRows =
    roleIds.length && organizationId
      ? await OrganizationMember.aggregate([
          {
            $match: {
              organizationId,
              status: "active",
              userId: { $ne: organization?.ownerId || null },
            },
          },
          {
            $project: {
              roleIdsForCount: {
                $filter: {
                  input: {
                    $cond: [
                      { $gt: [{ $size: { $ifNull: ["$roleIds", []] } }, 0] },
                      "$roleIds",
                      ["$roleId"],
                    ],
                  },
                  as: "roleId",
                  cond: {
                    $and: [
                      { $ne: ["$$roleId", null] },
                      { $in: ["$$roleId", roleIds] },
                    ],
                  },
                },
              },
            },
          },
          { $unwind: "$roleIdsForCount" },
          { $group: { _id: "$roleIdsForCount", count: { $sum: 1 } } },
        ])
      : [];
  const memberCountMap = new Map(
    countRows.map((row) => [toId(row._id), Number(row.count || 0)]),
  );
  const normalizedSearch = String(search || "").trim().toLowerCase();
  const visibleRoles = normalizedSearch
    ? roles.filter((role) => {
        const doc = role.toObject?.() || role;
        return [doc.name, doc.key, doc.description].some((value) =>
          String(value || "").toLowerCase().includes(normalizedSearch),
        );
      })
    : roles;

  return {
    content: visibleRoles.map((role) => {
      const canManage = canManageRoleInHierarchy(scopedContext, role);
      return {
        ...serializeOrganizationRole({
          ...(role.toObject?.() || role),
          memberCount: memberCountMap.get(toId(role._id)) || 0,
        }),
        canManage,
        canReorder: canManage,
      };
    }),
    canManageRoles,
    permissionKeys: ORGANIZATION_PERMISSION_KEYS,
  };
};

export const getOrganizationRoleList = async (req, res) => {
  const context = await getMembershipWithPermissions(req.params.id, req.user._id);
  const membership = context?.membership;
  if (!membership) {
    throw new ApiError(403, "You are not a member of this organization");
  }
  if (
    !hasOrganizationPermission(membership, "viewMembers") &&
    !hasOrganizationPermission(membership, "manageRoles")
  ) {
    throw new ApiError(403, "You cannot view organization roles");
  }

  res.json(
    await buildOrganizationRoleListPayload(
      context,
      context.roles,
      req.query.search || req.query.q,
    ),
  );
};

export const createOrganizationRole = async (req, res) => {
  const context = await requireOrganizationPermission(
    req.params.id,
    req.user._id,
    "manageRoles",
    "Only authorized members can create roles",
  );
  if (!isOwnerInContext(context) && getRoleOrderIndex(context.roles, context.role) < 0) {
    throw new ApiError(403, "Your role cannot create organization roles");
  }

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
  const lastRole = await OrganizationRole.findOne({
    organizationId: req.params.id,
    archivedAt: null,
  }).sort({ sortOrder: -1, createdAt: -1 });

  const role = await OrganizationRole.create({
    organizationId: req.params.id,
    key: payload.key,
    name: payload.name,
    description: payload.description,
    color: payload.color,
    permissions: payload.permissions,
    isSystem: false,
    sortOrder: Number(lastRole?.sortOrder || 0) + 1,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });

  res.status(201).json(serializeOrganizationRole(role));
};

export const updateOrganizationRole = async (req, res) => {
  const context = await requireOrganizationPermission(
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
  assertCanManageRoleInHierarchy(
    context,
    role,
    "You can only update roles below your highest role",
  );

  const payload = normalizeOrganizationRolePayload({
    ...role.toObject(),
    ...req.body,
    key: role.key,
  });
  role.name = payload.name || role.name;
  role.description = payload.description;
  role.color = payload.color;
  role.permissions = {
    ...(role.permissions?.toObject?.() || role.permissions || {}),
    ...payload.permissions,
  };
  role.updatedBy = req.user._id;
  await role.save();

  res.json(serializeOrganizationRole(role));
};

export const deleteOrganizationRole = async (req, res) => {
  const context = await requireOrganizationPermission(
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
  assertCanManageRoleInHierarchy(
    context,
    role,
    "You can only delete roles below your highest role",
  );
  const organization = await Organization.findById(req.params.id);
  if (
    role.isDefault ||
    toId(organization?.settings?.defaultRoleId) === toId(role._id)
  ) {
    throw new ApiError(400, "Default role cannot be deleted");
  }

  role.archivedAt = new Date();
  role.updatedBy = req.user._id;
  await role.save();

  const [defaultRole, membershipsUsingRole] = await Promise.all([
    getDefaultMembershipRole(organization),
    OrganizationMember.find({
      organizationId: req.params.id,
      status: { $in: ["active", "pending"] },
      $or: [
        { roleIds: role._id },
        { roleId: role._id },
        { role: role.key },
      ],
    }),
  ]);
  const remainingRoles = await getOrganizationRoles(req.params.id);
  const roleMap = buildRoleMap(remainingRoles);

  await Promise.all(
    membershipsUsingRole.map(async (membership) => {
      const remainingRoleIds = getMembershipRoleIds(membership).filter(
        (roleId) => roleId !== toId(role._id),
      );
      membership.roleIds = remainingRoleIds;
      syncMembershipPrimaryRole(membership, roleMap, defaultRole);
      await membership.save();
    }),
  );

  res.status(204).send();
};

export const reorderOrganizationRoles = async (req, res) => {
  const context = await requireOrganizationPermission(
    req.params.id,
    req.user._id,
    "manageRoles",
    "Only authorized members can reorder roles",
  );

  const roleIds = Array.isArray(req.body?.roleIds)
    ? req.body.roleIds.map((roleId) => String(roleId || "").trim()).filter(Boolean)
    : [];
  if (!roleIds.length || roleIds.some((roleId) => !isObjectIdLike(roleId))) {
    throw new ApiError(400, "roleIds is required");
  }

  const roles = await OrganizationRole.find({
    _id: { $in: roleIds },
    organizationId: req.params.id,
    archivedAt: null,
  });
  if (roles.length !== roleIds.length) {
    throw new ApiError(400, "Role order contains invalid roles");
  }

  const currentRoleIds = context.roles.map((role) => toId(role._id));
  if (roleIds.length !== currentRoleIds.length) {
    throw new ApiError(400, "Role order must include every active role");
  }
  if (!isOwnerInContext(context)) {
    const actorIndex = getRoleOrderIndex(context.roles, context.role);
    if (actorIndex < 0) {
      throw new ApiError(403, "Your role cannot reorder organization roles");
    }
    const lockedRoleIds = currentRoleIds.slice(0, actorIndex + 1);
    const lockedOrderChanged = lockedRoleIds.some(
      (roleId, index) => roleIds[index] !== roleId,
    );
    if (lockedOrderChanged) {
      throw new ApiError(
        403,
        "You can only reorder roles below your highest role",
      );
    }
  }

  await OrganizationRole.bulkWrite(
    roleIds.map((roleId, index) => ({
      updateOne: {
        filter: {
          _id: roleId,
          organizationId: req.params.id,
          archivedAt: null,
        },
        update: {
          $set: {
            sortOrder: index + 1,
            updatedBy: req.user._id,
          },
        },
      },
    })),
  );

  const updatedRoles = await getOrganizationRoles(req.params.id);
  res.json(
    await buildOrganizationRoleListPayload(
      { ...context, roles: updatedRoles },
      updatedRoles,
    ),
  );
};

const getOrganizationRoleById = async (organizationId, roleId) => {
  if (!isObjectIdLike(roleId)) {
    throw new ApiError(400, "Role is invalid");
  }

  const role = await OrganizationRole.findOne({
    _id: roleId,
    organizationId,
    archivedAt: null,
  });
  if (!role) {
    throw new ApiError(404, "Role not found");
  }
  return role;
};

const memberCarriesRole = (membership, role, roleMap) => {
  const targetRoleId = toId(role?._id || role?.id);
  return (
    getMembershipRoleIds(membership).includes(targetRoleId) ||
    getRolesFromMap(membership, roleMap).some(
      (memberRole) => toId(memberRole?._id || memberRole?.id) === targetRoleId,
    ) ||
    normalizeRoleKey(membership.role) === normalizeRoleKey(role.key)
  );
};

const buildOrganizationRoleMembersPayload = async (context, role) => {
  const roleMap = buildRoleMap(context.roles);
  const memberships = await OrganizationMember.find({
    organizationId: role.organizationId,
    status: "active",
  })
    .populate(
      "userId",
      "_id fullName email avatar position status activityStatus activityStatusExpiresAt",
    )
    .sort({ joinedAt: 1, updatedAt: 1 });

  const members = [];
  const candidates = [];

  memberships.forEach((membership) => {
    if (isOrganizationOwnerMembership(membership, context.organization)) return;

    const serialized = serializeMember(membership, roleMap, context.organization);
    const canManage = canManageMemberInHierarchy(context, membership);
    const row = { ...serialized, canManage };

    if (memberCarriesRole(membership, role, roleMap)) {
      members.push(row);
      return;
    }

    if (canManageRoleInHierarchy(context, role) && canManage) candidates.push(row);
  });

  const canManage = canManageRoleInHierarchy(context, role);
  return {
    role: {
      ...serializeOrganizationRole(role),
      canManage,
      canReorder: canManage,
    },
    members,
    candidates,
  };
};

export const getOrganizationRoleMembers = async (req, res) => {
  const context = await getMembershipWithPermissions(
    req.params.id,
    req.user._id,
  );
  const membership = context?.membership;
  if (!membership) {
    throw new ApiError(403, "You are not a member of this organization");
  }
  if (
    !hasOrganizationPermission(membership, "viewMembers") &&
    !hasOrganizationPermission(membership, "manageRoles")
  ) {
    throw new ApiError(403, "You cannot view role members");
  }
  const role = await getOrganizationRoleById(req.params.id, req.params.roleId);

  res.json(await buildOrganizationRoleMembersPayload(context, role));
};

export const updateOrganizationRoleMembers = async (req, res) => {
  const context = await requireOrganizationPermission(
    req.params.id,
    req.user._id,
    "manageRoles",
    "Only authorized members can manage role members",
  );
  const role = await getOrganizationRoleById(req.params.id, req.params.roleId);
  assertCanManageRoleInHierarchy(
    context,
    role,
    "You can only manage members for roles below your highest role",
  );

  const addMemberIds = normalizeRoleMemberIds(req.body?.addMemberIds);
  const removeMemberIds = normalizeRoleMemberIds(req.body?.removeMemberIds);
  const memberIds = [...new Set([...addMemberIds, ...removeMemberIds])];

  if (!memberIds.length) {
    res.json(await buildOrganizationRoleMembersPayload(context, role));
    return;
  }
  if (memberIds.some((memberId) => !isObjectIdLike(memberId))) {
    throw new ApiError(400, "Member ids are invalid");
  }
  if (removeMemberIds.length && role.isDefault) {
    throw new ApiError(400, "Default role cannot be removed from members");
  }

  const memberships = await OrganizationMember.find({
    _id: { $in: memberIds },
    organizationId: req.params.id,
    status: "active",
  }).populate(
    "userId",
    "_id fullName email avatar position status activityStatus activityStatusExpiresAt",
  );

  if (memberships.length !== memberIds.length) {
    throw new ApiError(400, "Some members are invalid");
  }

  const roleMap = buildRoleMap(context.roles);
  const defaultRole = removeMemberIds.length
    ? await getDefaultMembershipRole(context.organization)
    : null;
  if (removeMemberIds.length && toId(defaultRole?._id) === toId(role._id)) {
    throw new ApiError(400, "Default role cannot be removed from members");
  }

  await Promise.all(
    memberships.map(async (membership) => {
      if (!canManageMemberInHierarchy(context, membership)) {
        throw new ApiError(
          403,
          "You can only update members below your highest role",
        );
      }

      const membershipId = toId(membership._id);
      let nextRoleIds = getMembershipRoleIds(membership);
      if (addMemberIds.includes(membershipId)) {
        const targetRoleId = toId(role._id);
        if (!nextRoleIds.includes(targetRoleId)) {
          nextRoleIds = [...nextRoleIds, targetRoleId];
        }
      }

      if (
        removeMemberIds.includes(membershipId) &&
        memberCarriesRole(membership, role, roleMap)
      ) {
        nextRoleIds = nextRoleIds.filter((roleId) => roleId !== toId(role._id));
      }

      membership.roleIds = nextRoleIds;
      syncMembershipPrimaryRole(membership, roleMap, defaultRole);

      await membership.save();
    }),
  );

  res.json(await buildOrganizationRoleMembersPayload(context, role));
};

export const updateOrganizationMember = async (req, res) => {
  const context = await requireOrganizationPermission(
    req.params.id,
    req.user._id,
    "manageMembers",
    "Only authorized members can update members",
  );
  const { organization } = context;

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
  if (isOrganizationOwnerMembership(membership, organization)) {
    throw new ApiError(400, "Organization owner cannot be changed here");
  }
  if (!canManageMemberInHierarchy(context, membership)) {
    throw new ApiError(403, "You can only update members below your highest role");
  }

  const requestedRoleIds = Array.isArray(req.body?.roleIds)
    ? [...new Set(req.body.roleIds.map((roleId) => String(roleId || "").trim()).filter(Boolean))]
    : null;
  const roleId = String(req.body?.roleId || "").trim();
  const roleKey = normalizeRoleKey(req.body?.role || "");

  if (requestedRoleIds) {
    if (requestedRoleIds.some((item) => !isObjectIdLike(item))) {
      throw new ApiError(400, "Role ids are invalid");
    }

    const selectedRoles = requestedRoleIds.length
      ? await OrganizationRole.find({
          _id: { $in: requestedRoleIds },
          organizationId: req.params.id,
          archivedAt: null,
        })
      : [];
    if (selectedRoles.length !== requestedRoleIds.length) {
      throw new ApiError(400, "Some roles are invalid");
    }
    selectedRoles.forEach((role) => {
      if (!canManageRoleInHierarchy(context, role)) {
        throw new ApiError(403, "You can only assign roles below your highest role");
      }
    });

    const defaultRole = requestedRoleIds.length
      ? null
      : await getDefaultMembershipRole(organization);
    membership.roleIds = selectedRoles.map((role) => role._id);
    syncMembershipPrimaryRole(membership, buildRoleMap(context.roles), defaultRole);
  } else if (roleId || roleKey) {
    const role = await OrganizationRole.findOne({
      organizationId: req.params.id,
      ...(roleId && isObjectIdLike(roleId) ? { _id: roleId } : { key: roleKey }),
      archivedAt: null,
    });
    if (!role) {
      throw new ApiError(400, "Role is invalid");
    }
    if (!canManageRoleInHierarchy(context, role)) {
      throw new ApiError(403, "You can only assign roles below your highest role");
    }
    membership.roleIds = [role._id];
    syncMembershipPrimaryRole(membership, buildRoleMap(context.roles), role);
  }

  await membership.save();
  const roles = await getOrganizationRoles(req.params.id);
  const roleMap = buildRoleMap(roles);
  res.json(serializeMember(membership, roleMap, organization));
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

export const getOrganizationJoinRequests = async (req, res) => {
  const { roles } = await requireOrganizationPermission(
    req.params.id,
    req.user._id,
    "manageMembers",
    "Only authorized members can view join requests",
  );

  const [organization, pendingMembers] = await Promise.all([
    Organization.findById(req.params.id),
    OrganizationMember.find({
      organizationId: req.params.id,
      status: "pending",
    })
      .populate(
        "userId",
        "_id fullName email avatar position status activityStatus activityStatusExpiresAt",
      )
      .sort({ updatedAt: -1, createdAt: -1 }),
  ]);

  if (!organization || organization.archivedAt) {
    throw new ApiError(404, "Organization not found");
  }

  const roleMap = buildRoleMap(roles);
  res.json({
    content: pendingMembers.map((member) =>
      serializeMember(member, roleMap, organization),
    ),
    totalElements: pendingMembers.length,
    joinQuestions: normalizeOrganizationJoinQuestions(
      organization.settings?.joinQuestions || [],
    ),
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
  const canBypassApproval = canBypassInviteApproval(membership);
  if (
    organization.settings?.requireApproval !== false &&
    payload.bypassApproval &&
    !canBypassApproval
  ) {
    throw new ApiError(403, "Only authorized members can bypass approval");
  }

  const invite = await OrganizationInvite.create({
    organizationId: req.params.id,
    createdBy: req.user._id,
    code: await createUniqueInviteCode(),
    maxUses: payload.maxUses,
    expiresAt: payload.expiresAt,
    bypassApproval:
      organization.settings?.requireApproval !== false &&
      canBypassApproval &&
      payload.bypassApproval,
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

  if (settings.defaultRoleId || settings.defaultRoleKey) {
    const role = await OrganizationRole.findOne({
      organizationId: req.params.id,
      ...(settings.defaultRoleId && isObjectIdLike(settings.defaultRoleId)
        ? { _id: settings.defaultRoleId }
        : { key: settings.defaultRoleKey }),
      archivedAt: null,
    });
    if (!role) {
      throw new ApiError(400, "Default role is invalid");
    }
    update["settings.defaultRoleId"] = role._id;
    update["settings.defaultRoleKey"] = role.key;
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
  const { organization, roles } = await requireOrganizationPermission(
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
    member: serializeMember(membership, buildRoleMap(roles), organization),
    ...(await buildUserOrganizationContext(req.user, {
      baseUrl: getBaseUrl(req),
      persistFallback: true,
    })),
  });
};

export const transferOrganizationOwnership = async (req, res) => {
  const { membership, roles, organization: currentOrganization } =
    await requireOrganizationPermission(
    req.params.id,
    req.user._id,
    "manageOrganization",
    "Only authorized members can transfer ownership",
  );

  if (!isOrganizationOwnerMembership(membership, currentOrganization)) {
    throw new ApiError(403, "Only the current owner can transfer ownership");
  }

  const memberId = String(req.body?.memberId || "").trim();
  const userId = String(req.body?.userId || "").trim();
  if (!memberId && !userId) {
    throw new ApiError(400, "memberId or userId is required");
  }

  const targetQuery = {
    organizationId: req.params.id,
    status: "active",
  };
  if (memberId) {
    targetQuery._id = memberId;
  } else {
    targetQuery.userId = userId;
  }

  const targetMembership = await OrganizationMember.findOne(targetQuery).populate(
    "userId",
    "_id fullName email avatar position status activityStatus activityStatusExpiresAt",
  );
  if (!targetMembership) {
    throw new ApiError(404, "Target member not found");
  }
  if (String(targetMembership.userId?._id || targetMembership.userId) === String(req.user._id)) {
    throw new ApiError(400, "Choose another member to transfer ownership");
  }

  const defaultRole = await getDefaultMembershipRole(currentOrganization);

  membership.role = defaultRole?.key || DEFAULT_MEMBER_ROLE_KEY;
  membership.roleId = defaultRole?._id || null;
  membership.roleIds = defaultRole?._id ? [defaultRole._id] : [];
  targetMembership.role = targetMembership.role || defaultRole?.key || DEFAULT_MEMBER_ROLE_KEY;
  targetMembership.roleId = targetMembership.roleId || defaultRole?._id || null;
  targetMembership.roleIds = getMembershipRoleIds(targetMembership);

  const organization = await Organization.findByIdAndUpdate(
    req.params.id,
    { ownerId: targetMembership.userId?._id || targetMembership.userId },
    { new: true, runValidators: true },
  );
  if (!organization || organization.archivedAt) {
    throw new ApiError(404, "Organization not found");
  }

  await Promise.all([membership.save(), targetMembership.save()]);

  const updatedRoles = await getOrganizationRoles(req.params.id);
  const roleMap = buildRoleMap(updatedRoles);
  res.json({
    organization: await serializeOrganizationWithStats(organization, membership, req),
    owner: serializeMember(targetMembership, roleMap, organization),
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

  const organization = await Organization.findById(req.params.id);
  if (
    membership.status === "active" &&
    isOrganizationOwnerMembership(membership, organization)
  ) {
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
