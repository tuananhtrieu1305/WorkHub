import crypto from "node:crypto";

import mongoose from "mongoose";
import ActivityLog from "../models/ActivityLog.js";
import Conversation from "../models/Conversation.js";
import Document from "../models/Document.js";
import Meeting from "../models/Meeting.js";
import Organization from "../models/Organization.js";
import OrganizationInvite from "../models/OrganizationInvite.js";
import OrganizationMember from "../models/OrganizationMember.js";
import OrganizationRole from "../models/OrganizationRole.js";
import Post from "../models/Post.js";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import User from "../models/User.js";
import { isUserOnline } from "./presenceService.js";
import {
  DEFAULT_ORGANIZATION_ROLES,
  ORGANIZATION_PERMISSION_KEYS,
  createOrganizationSlug,
  normalizeOrganizationAccentColor,
  normalizeInviteCode,
  normalizeOrganizationName,
  normalizeRoleKey,
  normalizeRolePermissions,
} from "../utils/organizationPolicy.js";

const toId = (value) => String(value?._id || value || "");

const toObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(value)
    ? new mongoose.Types.ObjectId(value)
    : value;

const toDateOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

export const buildInviteLinkFromCode = (code, baseUrl = "") => {
  if (!code) return "";
  const origin = String(baseUrl || "").replace(/\/+$/, "");
  return origin ? `${origin}/organization/join/${code}` : `/organization/join/${code}`;
};

export const createInviteCode = () =>
  crypto.randomBytes(18).toString("base64url");

export const createUniqueInviteCode = async () => {
  let code = createInviteCode();
  while (
    (await Organization.exists({ inviteCode: code })) ||
    (await OrganizationInvite.exists({ code }))
  ) {
    code = createInviteCode();
  }
  return code;
};

const roleMapKey = (organizationId, roleKey) =>
  `${toId(organizationId)}:${normalizeRoleKey(roleKey) || "member"}`;

const buildRoleMap = (roles = []) =>
  new Map(roles.map((role) => [roleMapKey(role.organizationId, role.key), role]));

export const getRoleDefinition = (roleKey = "member", role = null) => {
  const normalizedKey = normalizeRoleKey(roleKey) || "member";
  const defaultRole = DEFAULT_ORGANIZATION_ROLES.find(
    (item) => item.key === normalizedKey,
  );

  return {
    key: normalizedKey,
    name: role?.name || defaultRole?.name || normalizedKey,
    description: role?.description || defaultRole?.description || "",
    color: role?.color || defaultRole?.color || "#64748b",
    isSystem: Boolean(role?.isSystem ?? defaultRole?.isSystem),
    isDefault: Boolean(role?.isDefault ?? defaultRole?.isDefault),
    permissions: normalizeRolePermissions(normalizedKey, role?.permissions),
  };
};

export const getMembershipPermissions = (membership, roleMap = new Map()) => {
  if (!membership) return normalizeRolePermissions("member");
  const roleKeyValue = normalizeRoleKey(membership.role) || "member";
  const role = roleMap.get(roleMapKey(membership.organizationId, roleKeyValue));
  return getRoleDefinition(roleKeyValue, role).permissions;
};

export const attachMembershipPermissions = (membership, roleMap = new Map()) => {
  if (!membership) return null;
  membership.permissions = getMembershipPermissions(membership, roleMap);
  return membership;
};

export const serializeOrganization = (
  organization,
  membership = null,
  { baseUrl = "", stats = {}, role = null, invite = null } = {},
) => {
  const org = organization?.toObject?.() || organization;
  if (!org) return null;

  const memberCount = Number(stats.memberCount || 0);
  const onlineCount = Number(stats.onlineCount || 0);
  const pendingCount = Number(stats.pendingCount || 0);
  const roleDefinition = getRoleDefinition(membership?.role, role);
  const permissions = membership
    ? roleDefinition.permissions
    : normalizeRolePermissions("member");

  return {
    id: toId(org._id || org.id),
    name: org.name,
    slug: org.slug,
    description: org.description || "",
    logoUrl: org.logoUrl || "",
    bannerUrl: org.bannerUrl || "",
    ownerId: toId(org.ownerId),
    role: membership?.role || null,
    roleLabel: membership ? roleDefinition.name : null,
    roleColor: membership ? roleDefinition.color : null,
    permissions,
    canManage: Boolean(permissions.manageOrganization),
    memberStatus: membership?.status || null,
    isFavorite: Boolean(membership?.isFavorite),
    joinedAt: membership?.joinedAt || null,
    inviteCode: invite?.code || "",
    inviteLink: invite ? buildInviteLinkFromCode(invite.code, baseUrl) : "",
    inviteEnabled: org.inviteEnabled !== false,
    accentColor: org.accentColor || "#2563eb",
    settings: {
      requireApproval: org.settings?.requireApproval !== false,
      allowMemberInvites: org.settings?.allowMemberInvites !== false,
      memberDirectoryVisible: org.settings?.memberDirectoryVisible !== false,
      defaultRoleKey: org.settings?.defaultRoleKey || "member",
      joinMessage: org.settings?.joinMessage || "",
    },
    memberCount,
    onlineCount,
    pendingCount,
    stats: {
      members: memberCount,
      online: onlineCount,
      pending: pendingCount,
    },
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  };
};

export const createUniqueOrganizationSlug = async (name) => {
  const baseSlug = createOrganizationSlug(name);
  let candidate = baseSlug;
  let suffix = 1;

  while (await Organization.exists({ slug: candidate })) {
    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }

  return candidate;
};

export const ensureDefaultOrganizationRoles = async (
  organizationId,
  createdBy = null,
) => {
  const operations = DEFAULT_ORGANIZATION_ROLES.map((role) => ({
    updateOne: {
      filter: { organizationId, key: role.key, archivedAt: null },
      update: {
        $setOnInsert: {
          organizationId,
          key: role.key,
          name: role.name,
          description: role.description,
          color: role.color,
          permissions: role.permissions,
          isSystem: role.isSystem,
          isDefault: Boolean(role.isDefault),
          sortOrder: role.sortOrder,
          createdBy,
        },
      },
      upsert: true,
    },
  }));

  if (operations.length) {
    await OrganizationRole.bulkWrite(operations, { ordered: false });
  }
};

export const getOrganizationRoles = async (organizationId) => {
  await ensureDefaultOrganizationRoles(organizationId);
  return OrganizationRole.find({ organizationId, archivedAt: null }).sort({
    sortOrder: 1,
    createdAt: 1,
  });
};

export const serializeOrganizationRole = (role) => {
  const doc = role?.toObject?.() || role;
  const definition = getRoleDefinition(doc?.key, doc);

  return {
    id: toId(doc._id || doc.id),
    organizationId: toId(doc.organizationId),
    key: definition.key,
    name: definition.name,
    description: definition.description,
    color: definition.color,
    permissions: definition.permissions,
    isSystem: definition.isSystem,
    isDefault: definition.isDefault,
    sortOrder: doc.sortOrder ?? 100,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

export const serializeOrganizationInvite = (invite, { baseUrl = "" } = {}) => {
  const doc = invite?.toObject?.() || invite;
  const inviter = doc.createdBy;
  const maxUses = doc.maxUses ?? null;
  const expiresAt = doc.expiresAt || null;
  const isExpired = Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());
  const isExhausted = Boolean(maxUses && Number(doc.usesCount || 0) >= maxUses);

  return {
    id: toId(doc._id || doc.id),
    organizationId: toId(doc.organizationId),
    code: doc.code,
    inviteLink: buildInviteLinkFromCode(doc.code, baseUrl),
    status: doc.status,
    isActive: doc.status === "active" && !isExpired && !isExhausted,
    maxUses,
    usesCount: Number(doc.usesCount || 0),
    remainingUses: maxUses ? Math.max(maxUses - Number(doc.usesCount || 0), 0) : null,
    expiresAt,
    isExpired,
    note: doc.note || "",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    inviter: inviter
      ? {
          id: toId(inviter._id || inviter.id || inviter),
          fullName: inviter.fullName || "",
          email: inviter.email || "",
          avatar: inviter.avatar || "",
        }
      : null,
  };
};

export const getUserOrganizationMemberships = async (userId) =>
  OrganizationMember.find({ userId, status: "active" })
    .populate("organizationId")
    .sort({ updatedAt: -1 });

export const getPendingOrganizationMemberships = async (userId) =>
  OrganizationMember.find({ userId, status: "pending" })
    .populate("organizationId")
    .sort({ updatedAt: -1 });

export const buildOrganizationStatsMap = async (organizationIds = []) => {
  const ids = [
    ...new Set(
      organizationIds.map((organizationId) => toId(organizationId)).filter(Boolean),
    ),
  ];

  const statsMap = new Map(
    ids.map((organizationId) => [
      organizationId,
      { memberCount: 0, onlineCount: 0, pendingCount: 0 },
    ]),
  );

  if (!ids.length) return statsMap;

  const memberships = await OrganizationMember.find({
    organizationId: { $in: ids },
    status: { $in: ["active", "pending"] },
  }).select("organizationId userId status");

  memberships.forEach((membership) => {
    const organizationId = toId(membership.organizationId);
    const stats =
      statsMap.get(organizationId) ||
      { memberCount: 0, onlineCount: 0, pendingCount: 0 };

    if (membership.status === "pending") {
      stats.pendingCount += 1;
    } else if (membership.status === "active") {
      stats.memberCount += 1;
      if (isUserOnline(membership.userId)) {
        stats.onlineCount += 1;
      }
    }

    statsMap.set(organizationId, stats);
  });

  return statsMap;
};

export const buildUserOrganizationContext = async (
  user,
  { baseUrl = "", persistFallback = false } = {},
) => {
  const [memberships, pendingMemberships] = await Promise.all([
    getUserOrganizationMemberships(user._id),
    getPendingOrganizationMemberships(user._id),
  ]);
  const activeId = toId(user.activeOrganizationId);
  const activeMembership =
    memberships.find(
      (membership) => toId(membership.organizationId) === activeId,
    ) || memberships[0] || null;
  const activeOrganization = activeMembership?.organizationId || null;
  const organizationIds = [
    ...memberships.map((membership) => membership.organizationId),
    ...pendingMemberships.map((membership) => membership.organizationId),
  ];
  const statsMap = await buildOrganizationStatsMap(organizationIds);
  const ids = [
    ...new Set(organizationIds.map((organizationId) => toId(organizationId)).filter(Boolean)),
  ];
  const [roles, personalInvites] = await Promise.all([
    ids.length
      ? OrganizationRole.find({
          organizationId: { $in: ids },
          archivedAt: null,
        })
      : [],
    ids.length
      ? OrganizationInvite.find({
          organizationId: { $in: ids },
          createdBy: user._id,
          status: "active",
          $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
        }).sort({ createdAt: -1 })
      : [],
  ]);
  const roleMap = buildRoleMap(roles);
  const inviteMap = new Map();
  personalInvites.forEach((invite) => {
    const organizationId = toId(invite.organizationId);
    if (!inviteMap.has(organizationId)) inviteMap.set(organizationId, invite);
  });

  if (
    persistFallback &&
    toId(activeOrganization) &&
    toId(user.activeOrganizationId) !== toId(activeOrganization)
  ) {
    await User.findByIdAndUpdate(user._id, {
      activeOrganizationId: activeOrganization._id,
    });
    user.activeOrganizationId = activeOrganization._id;
  }

  return {
    activeOrganization: serializeOrganization(activeOrganization, activeMembership, {
      baseUrl,
      stats: statsMap.get(toId(activeOrganization)),
      role: roleMap.get(roleMapKey(toId(activeOrganization), activeMembership?.role)),
      invite: inviteMap.get(toId(activeOrganization)),
    }),
    organizations: memberships
      .filter((membership) => membership.organizationId)
      .map((membership) =>
        serializeOrganization(membership.organizationId, membership, {
          baseUrl,
          stats: statsMap.get(toId(membership.organizationId)),
          role: roleMap.get(roleMapKey(membership.organizationId, membership.role)),
          invite: inviteMap.get(toId(membership.organizationId)),
        }),
      ),
    pendingOrganizations: pendingMemberships
      .filter((membership) => membership.organizationId)
      .map((membership) =>
        serializeOrganization(membership.organizationId, membership, {
          baseUrl,
          stats: statsMap.get(toId(membership.organizationId)),
          role: roleMap.get(roleMapKey(membership.organizationId, membership.role)),
          invite: inviteMap.get(toId(membership.organizationId)),
        }),
      ),
  };
};

export const buildCurrentUserPayload = async (
  user,
  { baseUrl = "", includeTokenFields = {} } = {},
) => {
  const organizationContext = await buildUserOrganizationContext(user, {
    baseUrl,
    persistFallback: true,
  });

  return {
    _id: user._id,
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    phone: user.phone,
    position: user.position,
    activityStatus: user.activityStatus,
    activityStatusExpiresAt: user.activityStatusExpiresAt,
    activeOrganizationId:
      organizationContext.activeOrganization?.id || null,
    ...organizationContext,
    ...includeTokenFields,
  };
};

export const findInviteTarget = async (inviteInput) => {
  const inviteCode = normalizeInviteCode(inviteInput);
  if (!inviteCode) return null;

  const invite = await OrganizationInvite.findOne({
    code: inviteCode,
    status: "active",
  }).populate("organizationId");

  if (invite) {
    const organization = invite.organizationId;
    const maxUses = invite.maxUses ?? null;
    const isExpired =
      invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now();
    const isExhausted = maxUses && Number(invite.usesCount || 0) >= maxUses;

    if (!organization || organization.archivedAt || isExpired || isExhausted) {
      return null;
    }

    return { organization, invite };
  }

  const organization = await Organization.findOne({
    inviteCode,
    inviteEnabled: true,
    archivedAt: null,
  });

  return organization ? { organization, invite: null } : null;
};

export const findOrganizationByInvite = async (inviteInput) => {
  const target = await findInviteTarget(inviteInput);
  return target?.organization || null;
};

export const ensureOrganizationMember = async (
  organizationId,
  userId,
  { role = "member", invitedBy = null } = {},
) => {
  const existing = await OrganizationMember.findOne({ organizationId, userId });
  if (existing) {
    const wasActive = existing.status === "active";
    existing.status = "active";
    existing.removedAt = null;
    existing.joinedAt = wasActive && existing.joinedAt ? existing.joinedAt : new Date();
    existing.invitedBy = existing.invitedBy || invitedBy;
    if (!existing.role) existing.role = role;
    await existing.save();
    return existing;
  }

  return OrganizationMember.findOneAndUpdate(
    { organizationId, userId },
    {
      $set: {
        role,
        status: "active",
        removedAt: null,
        joinedAt: new Date(),
        invitedBy,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
};

export const ensureOrganizationJoinRequest = async (
  organizationId,
  userId,
  { invitedBy = null, requireApproval = true, role = "member" } = {},
) => {
  const existing = await OrganizationMember.findOne({ organizationId, userId });
  const nextStatus = requireApproval ? "pending" : "active";
  if (existing) {
    if (existing.status === "active" || existing.status === "pending") {
      return existing;
    }

    existing.status = nextStatus;
    existing.role = existing.role || role;
    existing.invitedBy = existing.invitedBy || invitedBy;
    existing.removedAt = null;
    existing.joinedAt = nextStatus === "active" ? new Date() : null;
    await existing.save();
    return existing;
  }

  return OrganizationMember.findOneAndUpdate(
    { organizationId, userId },
    {
      $set: {
        role,
        status: nextStatus,
        removedAt: null,
        joinedAt: nextStatus === "active" ? new Date() : null,
        invitedBy,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
};

export const normalizeOrganizationPayload = (payload = {}) => {
  const normalized = {
    name: normalizeOrganizationName(payload.name),
  };

  if (Object.prototype.hasOwnProperty.call(payload, "description")) {
    normalized.description = String(payload.description || "").trim().slice(0, 1000);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "accentColor")) {
    normalized.accentColor = normalizeOrganizationAccentColor(payload.accentColor);
  }

  return normalized;
};

export const normalizeOrganizationSettingsPayload = (payload = {}) => {
  const settings = {};

  if (payload.requireApproval !== undefined) {
    settings.requireApproval = Boolean(payload.requireApproval);
  }
  if (payload.allowMemberInvites !== undefined) {
    settings.allowMemberInvites = Boolean(payload.allowMemberInvites);
  }
  if (payload.memberDirectoryVisible !== undefined) {
    settings.memberDirectoryVisible = Boolean(payload.memberDirectoryVisible);
  }
  if (payload.defaultRoleKey !== undefined) {
    settings.defaultRoleKey = normalizeRoleKey(payload.defaultRoleKey) || "member";
  }
  if (payload.joinMessage !== undefined) {
    settings.joinMessage = String(payload.joinMessage || "").trim().slice(0, 500);
  }

  return settings;
};

export const normalizeOrganizationRolePayload = (payload = {}) => {
  const name = String(payload.name || "").trim().replace(/\s+/g, " ").slice(0, 80);
  const key = normalizeRoleKey(payload.key || name);
  const permissions = {};

  ORGANIZATION_PERMISSION_KEYS.forEach((permissionKey) => {
    if (payload.permissions?.[permissionKey] !== undefined) {
      permissions[permissionKey] = Boolean(payload.permissions[permissionKey]);
    }
  });

  return {
    key,
    name,
    description: String(payload.description || "").trim().slice(0, 500),
    color: String(payload.color || "#2563eb").trim().slice(0, 24) || "#2563eb",
    permissions,
  };
};

export const normalizeOrganizationInvitePayload = (payload = {}) => {
  const expiresAt = toDateOrNull(payload.expiresAt);
  const rawMaxUses = Number(payload.maxUses);
  const maxUses =
    Number.isFinite(rawMaxUses) && rawMaxUses > 0
      ? Math.min(Math.floor(rawMaxUses), 10000)
      : null;

  return {
    expiresAt,
    maxUses,
    note: String(payload.note || "").trim().slice(0, 300),
  };
};

const countDocuments = (model, query) => model.countDocuments(query);

const buildStatusCounts = (items = [], keyName = "_id") =>
  items.reduce((acc, item) => {
    acc[item[keyName] || "unknown"] = Number(item.count || 0);
    return acc;
  }, {});

const buildMonthKey = (date) => {
  const value = new Date(date);
  const month = value.getMonth() + 1;
  return `${value.getFullYear()}-${String(month).padStart(2, "0")}`;
};

export const buildOrganizationDashboard = async (organizationId) => {
  const organizationObjectId = toObjectId(organizationId);
  const now = new Date();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [
    memberCount,
    pendingCount,
    projectCount,
    taskCount,
    openTaskCount,
    documentCount,
    postCount,
    meetingCount,
    conversationCount,
    taskStatusRows,
    roleRows,
    memberGrowthRows,
    recentActivities,
  ] = await Promise.all([
    countDocuments(OrganizationMember, { organizationId, status: "active" }),
    countDocuments(OrganizationMember, { organizationId, status: "pending" }),
    countDocuments(Project, { organizationId, status: { $ne: "archived" } }),
    countDocuments(Task, { organizationId, deletedAt: null }),
    countDocuments(Task, {
      organizationId,
      deletedAt: null,
      status: { $nin: ["done", "cancelled"] },
    }),
    countDocuments(Document, {
      organizationId,
      deletedAt: null,
      status: { $ne: "deleted" },
    }),
    countDocuments(Post, { organizationId }),
    countDocuments(Meeting, { organizationId }),
    countDocuments(Conversation, { organizationId }),
    Task.aggregate([
      { $match: { organizationId: organizationObjectId, deletedAt: null } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    OrganizationMember.aggregate([
      { $match: { organizationId: organizationObjectId, status: "active" } },
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]),
    OrganizationMember.aggregate([
      {
        $match: {
          organizationId: organizationObjectId,
          status: "active",
          joinedAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$joinedAt" },
            month: { $month: "$joinedAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),
    ActivityLog.find({ organizationId })
      .populate("actorId", "_id fullName email avatar")
      .sort({ createdAt: -1 })
      .limit(8),
  ]);

  const growthByMonth = new Map(
    memberGrowthRows.map((row) => [
      `${row._id.year}-${String(row._id.month).padStart(2, "0")}`,
      row.count,
    ]),
  );
  const memberGrowth = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(sixMonthsAgo);
    date.setMonth(sixMonthsAgo.getMonth() + index);
    const key = buildMonthKey(date);
    return { month: key, count: Number(growthByMonth.get(key) || 0) };
  });

  return {
    metrics: {
      members: memberCount,
      pendingMembers: pendingCount,
      projects: projectCount,
      tasks: taskCount,
      openTasks: openTaskCount,
      documents: documentCount,
      posts: postCount,
      meetings: meetingCount,
      conversations: conversationCount,
    },
    taskStatus: buildStatusCounts(taskStatusRows),
    roleDistribution: buildStatusCounts(roleRows),
    memberGrowth,
    recentActivities: recentActivities.map((activity) => ({
      id: toId(activity._id),
      action: activity.action,
      entityType: activity.entityType,
      createdAt: activity.createdAt,
      actor: activity.actorId
        ? {
            id: toId(activity.actorId._id || activity.actorId.id),
            fullName: activity.actorId.fullName || "",
            email: activity.actorId.email || "",
            avatar: activity.actorId.avatar || "",
          }
        : null,
    })),
  };
};

export default {
  attachMembershipPermissions,
  buildInviteLinkFromCode,
  buildCurrentUserPayload,
  buildOrganizationDashboard,
  buildUserOrganizationContext,
  createInviteCode,
  createUniqueInviteCode,
  createUniqueOrganizationSlug,
  buildOrganizationStatsMap,
  ensureOrganizationMember,
  ensureOrganizationJoinRequest,
  ensureDefaultOrganizationRoles,
  findInviteTarget,
  findOrganizationByInvite,
  getMembershipPermissions,
  getOrganizationRoles,
  getPendingOrganizationMemberships,
  getUserOrganizationMemberships,
  normalizeOrganizationInvitePayload,
  normalizeOrganizationPayload,
  normalizeOrganizationRolePayload,
  normalizeOrganizationSettingsPayload,
  serializeOrganizationInvite,
  serializeOrganization,
  serializeOrganizationRole,
};
