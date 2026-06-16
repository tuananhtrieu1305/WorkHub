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
  DEFAULT_MEMBER_ROLE_KEY,
  LEGACY_ORGANIZATION_ROLE_KEYS,
  ORGANIZATION_PERMISSION_KEYS,
  OWNER_ORGANIZATION_PERMISSIONS,
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

const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_CODE_LENGTH = 10;

export const createInviteCode = () => {
  const bytes = crypto.randomBytes(INVITE_CODE_LENGTH);
  return Array.from(bytes, (byte) => INVITE_CODE_ALPHABET[byte % INVITE_CODE_ALPHABET.length]).join("");
};

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

export const deleteExpiredOrganizationInvites = async (criteria = {}) =>
  OrganizationInvite.deleteMany({
    ...criteria,
    expiresAt: { $ne: null, $lte: new Date() },
  });

export const resumeExpiredOrganizationInvitePauses = async (criteria = {}) =>
  OrganizationInvite.updateMany(
    {
      ...criteria,
      status: "paused",
      pausedUntil: { $ne: null, $lte: new Date() },
    },
    {
      $set: {
        status: "active",
        pausedAt: null,
        pausedBy: null,
        pausedUntil: null,
      },
    },
  );

const roleMapKey = (organizationId, roleKey) =>
  `${toId(organizationId)}:${normalizeRoleKey(roleKey) || DEFAULT_MEMBER_ROLE_KEY}`;

const roleIdMapKey = (roleId) => `id:${toId(roleId)}`;

const isOrganizationOwner = (organization, userId) =>
  Boolean(toId(organization?.ownerId) && toId(organization?.ownerId) === toId(userId));

export const isOrganizationOwnerMembership = (membership, organization) =>
  isOrganizationOwner(organization, membership?.userId?._id || membership?.userId);

const JOIN_QUESTION_TYPES = new Set([
  "short_text",
  "paragraph",
  "multiple_choice",
  "rules",
]);

const normalizeJoinBuilderId = (value, fallbackPrefix = "item") => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return normalized || `${fallbackPrefix}-${crypto.randomUUID().slice(0, 8)}`;
};

export const normalizeOrganizationJoinQuestions = (questions = []) => {
  if (!Array.isArray(questions)) return [];

  return questions
    .slice(0, 5)
    .map((question, index) => {
      const type = JOIN_QUESTION_TYPES.has(question?.type)
        ? question.type
        : "short_text";
      const label = String(question?.label || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 240);
      if (!label) return null;

      const options =
        type === "multiple_choice" && Array.isArray(question?.options)
          ? question.options
              .slice(0, 10)
              .map((option, optionIndex) => {
                const optionLabel = String(option?.label || option || "")
                  .trim()
                  .replace(/\s+/g, " ")
                  .slice(0, 120);
                if (!optionLabel) return null;

                return {
                  id: normalizeJoinBuilderId(
                    option?.id,
                    `option-${optionIndex + 1}`,
                  ),
                  label: optionLabel,
                };
              })
              .filter(Boolean)
          : [];

      return {
        id: normalizeJoinBuilderId(question?.id, `question-${index + 1}`),
        type,
        label,
        description: String(question?.description || "").trim().slice(0, 500),
        required: question?.required !== false,
        options,
        sortOrder: index,
      };
    })
    .filter(Boolean);
};

const getAnswerValue = (answers, questionId) => {
  if (!answers) return undefined;
  if (Array.isArray(answers)) {
    return answers.find((answer) => answer?.questionId === questionId)?.value;
  }
  return answers[questionId];
};

export const normalizeOrganizationJoinAnswers = (questions = [], answers = {}) =>
  normalizeOrganizationJoinQuestions(questions).map((question) => {
    const rawValue = getAnswerValue(answers, question.id);
    let value = "";

    if (question.type === "rules") {
      value = rawValue === true || rawValue === "true" || rawValue === "accepted";
    } else if (question.type === "multiple_choice") {
      const requestedValue = String(rawValue || "").trim().slice(0, 120);
      const matchedOption = question.options.find(
        (option) =>
          option.id === requestedValue ||
          option.label.toLowerCase() === requestedValue.toLowerCase(),
      );
      value = matchedOption?.label || requestedValue;
    } else {
      value = String(rawValue || "")
        .trim()
        .slice(0, question.type === "paragraph" ? 3000 : 1000);
    }

    return {
      questionId: question.id,
      questionLabel: question.label,
      questionType: question.type,
      value,
    };
  });

export const getMissingRequiredJoinAnswers = (questions = [], answers = []) => {
  const answerMap = new Map(
    (answers || []).map((answer) => [answer.questionId, answer.value]),
  );

  return normalizeOrganizationJoinQuestions(questions).filter((question) => {
    if (!question.required) return false;
    const value = answerMap.get(question.id);
    if (question.type === "rules") return value !== true;
    return !String(value || "").trim();
  });
};

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

export const getMembershipRoleIds = (membership) => {
  if (!membership) return [];
  const roleIds = Array.isArray(membership.roleIds) ? membership.roleIds : [];
  if (roleIds.length) {
    return [
      ...new Set(roleIds.map((roleId) => toId(roleId)).filter(Boolean)),
    ];
  }
  return [
    ...new Set(
      [membership.roleId].map((roleId) => toId(roleId)).filter(Boolean),
    ),
  ];
};

const compareRolesByOrder = (left, right) => {
  const leftDoc = left?.toObject?.() || left || {};
  const rightDoc = right?.toObject?.() || right || {};
  const leftOrder = Number(leftDoc.sortOrder ?? 100);
  const rightOrder = Number(rightDoc.sortOrder ?? 100);
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  const leftCreatedAt = new Date(leftDoc.createdAt || 0).getTime();
  const rightCreatedAt = new Date(rightDoc.createdAt || 0).getTime();
  if (leftCreatedAt !== rightCreatedAt) return leftCreatedAt - rightCreatedAt;
  return String(leftDoc.name || leftDoc.key || "").localeCompare(
    String(rightDoc.name || rightDoc.key || ""),
  );
};

export const getRolesFromMap = (membership, roleMap = new Map()) => {
  if (!membership) return [];
  const roles = [];
  const seen = new Set();

  getMembershipRoleIds(membership).forEach((roleId) => {
    const role = roleMap.get(roleIdMapKey(roleId));
    const normalizedId = toId(role?._id || role?.id);
    if (role && normalizedId && !seen.has(normalizedId)) {
      seen.add(normalizedId);
      roles.push(role);
    }
  });

  const hasExplicitRoleIds =
    Array.isArray(membership.roleIds) && membership.roleIds.length > 0;
  if (!hasExplicitRoleIds) {
    const legacyRole = roleMap.get(roleMapKey(membership.organizationId, membership.role));
    const legacyRoleId = toId(legacyRole?._id || legacyRole?.id);
    if (legacyRole && legacyRoleId && !seen.has(legacyRoleId)) {
      seen.add(legacyRoleId);
      roles.push(legacyRole);
    }
  }

  return roles.sort(compareRolesByOrder);
};

const getRoleFromMap = (membership, roleMap = new Map()) => {
  const roles = getRolesFromMap(membership, roleMap);
  return roles[0] || null;
};

const mergeRolePermissions = (roleDefinitions = []) => {
  if (!roleDefinitions.length) {
    return normalizeRolePermissions(DEFAULT_MEMBER_ROLE_KEY);
  }

  return roleDefinitions.reduce((merged, roleDefinition) => {
    const rolePermissions = normalizeRolePermissions(
      roleDefinition.key,
      roleDefinition.permissions,
    );
    ORGANIZATION_PERMISSION_KEYS.forEach((permissionKey) => {
      merged[permissionKey] =
        Boolean(merged[permissionKey]) || Boolean(rolePermissions[permissionKey]);
    });
    return merged;
  }, {});
};

export const syncMembershipPrimaryRole = (
  membership,
  roleMap = new Map(),
  fallbackRole = null,
) => {
  if (!membership) return null;

  let roles = getRolesFromMap(membership, roleMap);
  if (!roles.length && fallbackRole) {
    const fallbackId = toId(fallbackRole._id || fallbackRole.id);
    if (fallbackId) {
      membership.roleIds = [fallbackRole._id || fallbackRole.id];
      roles = [fallbackRole];
    }
  }

  const uniqueRoleIds = [
    ...new Set(roles.map((role) => toId(role?._id || role?.id)).filter(Boolean)),
  ];
  membership.roleIds = uniqueRoleIds;

  const primaryRole = roles[0] || fallbackRole || null;
  membership.roleId = primaryRole?._id || primaryRole?.id || null;
  membership.role =
    normalizeRoleKey(primaryRole?.key) ||
    normalizeRoleKey(membership.role) ||
    DEFAULT_MEMBER_ROLE_KEY;

  return primaryRole;
};

export const getRoleDefinition = (roleOrKey = DEFAULT_MEMBER_ROLE_KEY, role = null) => {
  const sourceRole =
    role ||
    (typeof roleOrKey === "object" && roleOrKey ? roleOrKey : null);
  const normalizedKey =
    normalizeRoleKey(sourceRole?.key || roleOrKey) || DEFAULT_MEMBER_ROLE_KEY;
  const defaultRole = DEFAULT_ORGANIZATION_ROLES.find(
    (item) => item.key === normalizedKey,
  );

  return {
    key: normalizedKey,
    id: toId(sourceRole?._id || sourceRole?.id),
    name: sourceRole?.name || defaultRole?.name || normalizedKey,
    description: sourceRole?.description || defaultRole?.description || "",
    color: sourceRole?.color || defaultRole?.color || "#64748b",
    isSystem: Boolean(sourceRole?.isSystem ?? defaultRole?.isSystem),
    isDefault: Boolean(sourceRole?.isDefault ?? defaultRole?.isDefault),
    permissions: normalizeRolePermissions(normalizedKey, sourceRole?.permissions),
  };
};

export const getMembershipPermissions = (membership, roleMap = new Map()) => {
  if (!membership) return normalizeRolePermissions(DEFAULT_MEMBER_ROLE_KEY);
  if (membership.isOwner || membership.isOrganizationOwner) {
    return { ...OWNER_ORGANIZATION_PERMISSIONS };
  }
  const roles = getRolesFromMap(membership, roleMap);
  const roleDefinitions = roles.length
    ? roles.map((role) => getRoleDefinition(role))
    : [getRoleDefinition(membership.role)];
  return mergeRolePermissions(roleDefinitions);
};

export const attachMembershipPermissions = (membership, roleMap = new Map()) => {
  if (!membership) return null;
  membership.permissions = getMembershipPermissions(membership, roleMap);
  return membership;
};

export const serializeOrganization = (
  organization,
  membership = null,
  { baseUrl = "", stats = {}, role = null, roles = null, invite = null } = {},
) => {
  const org = organization?.toObject?.() || organization;
  if (!org) return null;

  const memberCount = Number(stats.memberCount || 0);
  const onlineCount = Number(stats.onlineCount || 0);
  const pendingCount = Number(stats.pendingCount || 0);
  const isOwner = Boolean(membership && isOrganizationOwnerMembership(membership, org));
  const roleDefinitions =
    Array.isArray(roles) && roles.length
      ? roles.map((item) => getRoleDefinition(item))
      : [getRoleDefinition(role || membership?.role)];
  const roleDefinition = roleDefinitions[0];
  const permissions = isOwner
    ? { ...OWNER_ORGANIZATION_PERMISSIONS }
    : membership
      ? mergeRolePermissions(roleDefinitions)
      : normalizeRolePermissions(DEFAULT_MEMBER_ROLE_KEY);

  return {
    id: toId(org._id || org.id),
    name: org.name,
    slug: org.slug,
    description: org.description || "",
    logoUrl: org.logoUrl || "",
    bannerUrl: org.bannerUrl || "",
    ownerId: toId(org.ownerId),
    roleId: membership ? roleDefinition.id || toId(membership.roleId) || null : null,
    role: membership ? roleDefinition.key || membership.role || null : null,
    roleLabel: membership ? roleDefinition.name : null,
    roleColor: membership ? roleDefinition.color : null,
    roles: membership
      ? roleDefinitions.map((definition) => ({
          id: definition.id || null,
          key: definition.key,
          name: definition.name,
          description: definition.description,
          color: definition.color,
          isSystem: definition.isSystem,
          isDefault: definition.isDefault,
          permissions: definition.permissions,
        }))
      : [],
    isOwner,
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
      defaultRoleId: toId(org.settings?.defaultRoleId),
      defaultRoleKey: org.settings?.defaultRoleKey || DEFAULT_MEMBER_ROLE_KEY,
      joinMessage: org.settings?.joinMessage || "",
      joinQuestions: normalizeOrganizationJoinQuestions(
        org.settings?.joinQuestions || [],
      ),
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

  const defaultRole = await OrganizationRole.findOne({
    organizationId,
    key: DEFAULT_MEMBER_ROLE_KEY,
    archivedAt: null,
  });

  if (defaultRole) {
    const legacyRoles = await OrganizationRole.find({
      organizationId,
      key: { $in: LEGACY_ORGANIZATION_ROLE_KEYS },
      archivedAt: null,
    }).select("_id key");
    const legacyRoleIds = legacyRoles.map((role) => role._id);

    if (legacyRoles.length) {
      await OrganizationRole.updateMany(
        {
          organizationId,
          key: { $in: LEGACY_ORGANIZATION_ROLE_KEYS },
          archivedAt: null,
        },
        {
          $set: {
            archivedAt: new Date(),
            updatedBy: createdBy,
          },
        },
      );
    }

    await Promise.all([
      Organization.updateOne(
        {
          _id: organizationId,
          $or: [
            { "settings.defaultRoleId": null },
            { "settings.defaultRoleKey": { $in: LEGACY_ORGANIZATION_ROLE_KEYS } },
          ],
        },
        {
          $set: {
            "settings.defaultRoleId": defaultRole._id,
            "settings.defaultRoleKey": defaultRole.key,
          },
        },
      ),
      OrganizationMember.updateMany(
        {
          organizationId,
          $or: [
            { role: { $in: LEGACY_ORGANIZATION_ROLE_KEYS } },
            { roleId: null },
            ...(legacyRoleIds.length ? [{ roleId: { $in: legacyRoleIds } }] : []),
          ],
        },
        {
          $set: {
            role: defaultRole.key,
            roleId: defaultRole._id,
          },
          $addToSet: {
            roleIds: defaultRole._id,
          },
        },
      ),
    ]);
  }

  return defaultRole;
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
    memberCount: Number(doc.memberCount || 0),
    sortOrder: doc.sortOrder ?? 100,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
};

export const serializeOrganizationInvite = (
  invite,
  { baseUrl = "", canManageInvites = false, currentUserId = null } = {},
) => {
  const doc = invite?.toObject?.() || invite;
  const inviter = doc.createdBy;
  const maxUses = doc.maxUses ?? null;
  const expiresAt = doc.expiresAt || null;
  const pausedUntil = doc.pausedUntil || null;
  const isExpired = Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());
  const isExhausted = Boolean(maxUses && Number(doc.usesCount || 0) >= maxUses);
  const creatorId = toId(inviter?._id || inviter?.id || inviter);
  const isCreator = Boolean(currentUserId && creatorId === toId(currentUserId));

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
    pausedAt: doc.pausedAt || null,
    pausedUntil,
    bypassApproval: Boolean(doc.bypassApproval),
    isExpired,
    note: doc.note || "",
    canDelete: Boolean(canManageInvites || isCreator),
    canUpdate: Boolean(canManageInvites || isCreator),
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
  if (ids.length) {
    await Promise.all(ids.map((organizationId) => ensureDefaultOrganizationRoles(organizationId)));
  }
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
      role: getRoleFromMap(activeMembership, roleMap),
      roles: getRolesFromMap(activeMembership, roleMap),
      invite: inviteMap.get(toId(activeOrganization)),
    }),
    organizations: memberships
      .filter((membership) => membership.organizationId)
      .map((membership) =>
        serializeOrganization(membership.organizationId, membership, {
          baseUrl,
          stats: statsMap.get(toId(membership.organizationId)),
          role: getRoleFromMap(membership, roleMap),
          roles: getRolesFromMap(membership, roleMap),
          invite: inviteMap.get(toId(membership.organizationId)),
        }),
      ),
    pendingOrganizations: pendingMemberships
      .filter((membership) => membership.organizationId)
      .map((membership) =>
        serializeOrganization(membership.organizationId, membership, {
          baseUrl,
          stats: statsMap.get(toId(membership.organizationId)),
          role: getRoleFromMap(membership, roleMap),
          roles: getRolesFromMap(membership, roleMap),
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
    bio: user.bio || "",
    about: user.about || "",
    location: user.location || "",
    birthday: user.birthday || null,
    pronouns: user.pronouns || "",
    education: user.education || "",
    interests: Array.isArray(user.interests) ? user.interests : [],
    socialLinks: Array.isArray(user.socialLinks) ? user.socialLinks : [],
    profileBannerUrl: user.profileBannerUrl || "",
    profileTheme: {
      useBannerImage: user.profileTheme?.useBannerImage !== false,
      preset: user.profileTheme?.preset || "aurora",
      accentColor: user.profileTheme?.accentColor || "#0f766e",
      backgroundColor: user.profileTheme?.backgroundColor || "#ccfbf1",
      textColor: user.profileTheme?.textColor || "#134e4a",
    },
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

  await Promise.all([
    deleteExpiredOrganizationInvites(),
    resumeExpiredOrganizationInvitePauses(),
  ]);

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
  { role = DEFAULT_MEMBER_ROLE_KEY, roleId = null, invitedBy = null } = {},
) => {
  const existing = await OrganizationMember.findOne({ organizationId, userId });
  if (existing) {
    const wasActive = existing.status === "active";
    existing.status = "active";
    existing.removedAt = null;
    existing.joinedAt = wasActive && existing.joinedAt ? existing.joinedAt : new Date();
    existing.invitedBy = existing.invitedBy || invitedBy;
    if (!existing.role) existing.role = role;
    if (!existing.roleId && roleId) existing.roleId = roleId;
    const roleIds = getMembershipRoleIds(existing);
    if (roleId && !roleIds.includes(toId(roleId))) {
      roleIds.push(toId(roleId));
    }
    existing.roleIds = roleIds;
    await existing.save();
    return existing;
  }

  return OrganizationMember.findOneAndUpdate(
    { organizationId, userId },
    {
      $set: {
        role,
        roleId,
        roleIds: roleId ? [roleId] : [],
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
  {
    invitedBy = null,
    inviteId = null,
    inviteUsageCountedAt = null,
    joinAnswers = [],
    requireApproval = true,
    role = DEFAULT_MEMBER_ROLE_KEY,
    roleId = null,
  } = {},
) => {
  const existing = await OrganizationMember.findOne({ organizationId, userId });
  const nextStatus = requireApproval ? "pending" : "active";
  if (existing) {
    if (existing.status === "active" || existing.status === "pending") {
      const roleIds = getMembershipRoleIds(existing);
      if (roleId && !roleIds.includes(toId(roleId))) {
        roleIds.push(toId(roleId));
      }
      existing.roleIds = roleIds;
      if (existing.status === "pending" && joinAnswers.length) {
        existing.joinAnswers = joinAnswers;
      }
      await existing.save();
      return existing;
    }

    existing.status = nextStatus;
    existing.role = existing.role || role;
    existing.roleId = existing.roleId || roleId;
    const roleIds = getMembershipRoleIds(existing);
    if (roleId && !roleIds.includes(toId(roleId))) {
      roleIds.push(toId(roleId));
    }
    existing.roleIds = roleIds;
    existing.invitedBy = existing.invitedBy || invitedBy;
    const previousInviteId = toId(existing.inviteId);
    if (inviteId) existing.inviteId = inviteId;
    existing.inviteUsageCountedAt =
      inviteId && previousInviteId !== toId(inviteId)
        ? inviteUsageCountedAt
        : inviteUsageCountedAt || existing.inviteUsageCountedAt;
    existing.removedAt = null;
    existing.joinedAt = nextStatus === "active" ? new Date() : null;
    existing.joinAnswers = joinAnswers;
    await existing.save();
    return existing;
  }

  return OrganizationMember.findOneAndUpdate(
    { organizationId, userId },
    {
      $set: {
        role,
        roleId,
        roleIds: roleId ? [roleId] : [],
        status: nextStatus,
        removedAt: null,
        joinedAt: nextStatus === "active" ? new Date() : null,
        invitedBy,
        inviteId,
        inviteUsageCountedAt,
        joinAnswers,
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
  if (payload.defaultRoleId !== undefined) {
    const defaultRoleId = String(payload.defaultRoleId || "").trim();
    settings.defaultRoleId = mongoose.Types.ObjectId.isValid(defaultRoleId)
      ? defaultRoleId
      : null;
  }
  if (payload.defaultRoleKey !== undefined) {
    settings.defaultRoleKey =
      normalizeRoleKey(payload.defaultRoleKey) || DEFAULT_MEMBER_ROLE_KEY;
  }
  if (payload.joinMessage !== undefined) {
    settings.joinMessage = String(payload.joinMessage || "").trim().slice(0, 500);
  }
  if (payload.joinQuestions !== undefined) {
    settings.joinQuestions = normalizeOrganizationJoinQuestions(
      payload.joinQuestions,
    );
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
    color: normalizeOrganizationAccentColor(payload.color, "#2563eb"),
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
    bypassApproval: Boolean(payload.bypassApproval),
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

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date = new Date()) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const shiftDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

const buildDayKey = (date) => startOfDay(date).toISOString().slice(0, 10);

const buildDayLabel = (date) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);

const buildCountMap = (rows = []) =>
  new Map(rows.map((row) => [row._id, Number(row.count || 0)]));

const buildDailySeries = (startDate, length, rows = []) => {
  const countMap = buildCountMap(rows);

  return Array.from({ length }, (_, index) => {
    const date = shiftDays(startDate, index);
    const key = buildDayKey(date);
    const value = Number(countMap.get(key) || 0);
    return {
      key,
      date: key,
      label: buildDayLabel(date),
      value,
    };
  });
};

const buildWeeklySeries = (startDate, rowsByType = {}) => {
  const maps = Object.entries(rowsByType).reduce((acc, [key, rows]) => {
    acc[key] = buildCountMap(rows);
    return acc;
  }, {});

  return Array.from({ length: 8 }, (_, index) => {
    const start = shiftDays(startDate, index * 7);
    const end = shiftDays(start, 6);
    const item = {
      key: `${buildDayKey(start)}:${buildDayKey(end)}`,
      label: `${buildDayLabel(start)}-${buildDayLabel(end)}`,
    };

    Object.entries(maps).forEach(([seriesKey, countMap]) => {
      item[seriesKey] = Array.from({ length: 7 }, (_, dayIndex) => {
        const dateKey = buildDayKey(shiftDays(start, dayIndex));
        return Number(countMap.get(dateKey) || 0);
      }).reduce((sum, value) => sum + value, 0);
    });

    item.total = Number(item.tasks || 0) + Number(item.documents || 0) + Number(item.posts || 0);
    return item;
  });
};

const buildDelta = (current = 0, previous = 0) => {
  const difference = Number(current || 0) - Number(previous || 0);
  const percent = previous
    ? Math.round((difference / Math.max(previous, 1)) * 100)
    : current
      ? 100
      : 0;

  return {
    value: difference,
    percent: Math.abs(percent),
    direction: difference > 0 ? "up" : difference < 0 ? "down" : "flat",
  };
};

const getActivityDisplay = (activity) => {
  const action = String(activity.action || "").toLowerCase();
  const entityType = String(activity.entityType || "").toLowerCase();

  if (action.includes("mời") || entityType.includes("invite")) {
    return { icon: "person_add", tone: "emerald" };
  }
  if (action.includes("vai trò") || entityType.includes("role")) {
    return { icon: "admin_panel_settings", tone: "blue" };
  }
  if (action.includes("quyền")) {
    return { icon: "lock_open", tone: "amber" };
  }
  if (action.includes("thu hồi") || action.includes("xóa")) {
    return { icon: "person_remove", tone: "rose" };
  }
  if (action.includes("duyệt") || action.includes("hoàn thành")) {
    return { icon: "check_circle", tone: "emerald" };
  }
  if (action.includes("biểu ngữ") || action.includes("banner")) {
    return { icon: "wallpaper", tone: "cyan" };
  }

  return { icon: "bolt", tone: "slate" };
};

export const buildOrganizationDashboard = async (organizationId) => {
  const organizationObjectId = toObjectId(organizationId);
  const now = new Date();
  const today = startOfDay(now);
  const last7Start = shiftDays(today, -6);
  const previous7Start = shiftDays(last7Start, -7);
  const last30Start = shiftDays(today, -29);
  const previous30Start = shiftDays(last30Start, -30);
  const next7End = shiftDays(today, 7);
  const eightWeeksAgo = shiftDays(today, -55);
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [
    roles,
    memberCount,
    pendingCount,
    projectCount,
    taskCount,
    openTaskCount,
    doneTaskCount,
    documentCount,
    postCount,
    meetingCount,
    conversationCount,
    activeInviteCount,
    totalInviteCount,
    newMembersLast30,
    newMembersPrevious30,
    invitesLast7,
    invitesPrevious7,
    pendingLast7,
    pendingPrevious7,
    activitiesLast7,
    activitiesPrevious7,
    dueSoonCount,
    overdueCount,
    taskStatusRows,
    roleRows,
    memberGrowthRows,
    activityTrendRows,
    weeklyTaskRows,
    weeklyCompletedTaskRows,
    weeklyDocumentRows,
    weeklyPostRows,
    projectStatusRows,
    focusTasks,
    recentActivities,
  ] = await Promise.all([
    getOrganizationRoles(organizationId),
    countDocuments(OrganizationMember, { organizationId, status: "active" }),
    countDocuments(OrganizationMember, { organizationId, status: "pending" }),
    countDocuments(Project, { organizationId, status: { $ne: "archived" } }),
    countDocuments(Task, { organizationId, deletedAt: null }),
    countDocuments(Task, {
      organizationId,
      deletedAt: null,
      status: { $nin: ["done", "cancelled"] },
    }),
    countDocuments(Task, { organizationId, deletedAt: null, status: "done" }),
    countDocuments(Document, {
      organizationId,
      deletedAt: null,
      status: { $ne: "deleted" },
    }),
    countDocuments(Post, { organizationId }),
    countDocuments(Meeting, { organizationId }),
    countDocuments(Conversation, { organizationId }),
    countDocuments(OrganizationInvite, {
      organizationId,
      status: "active",
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    }),
    countDocuments(OrganizationInvite, { organizationId }),
    countDocuments(OrganizationMember, {
      organizationId,
      status: "active",
      joinedAt: { $gte: last30Start },
    }),
    countDocuments(OrganizationMember, {
      organizationId,
      status: "active",
      joinedAt: { $gte: previous30Start, $lt: last30Start },
    }),
    countDocuments(OrganizationInvite, {
      organizationId,
      createdAt: { $gte: last7Start },
    }),
    countDocuments(OrganizationInvite, {
      organizationId,
      createdAt: { $gte: previous7Start, $lt: last7Start },
    }),
    countDocuments(OrganizationMember, {
      organizationId,
      status: "pending",
      createdAt: { $gte: last7Start },
    }),
    countDocuments(OrganizationMember, {
      organizationId,
      status: "pending",
      createdAt: { $gte: previous7Start, $lt: last7Start },
    }),
    countDocuments(ActivityLog, {
      organizationId,
      createdAt: { $gte: last7Start },
    }),
    countDocuments(ActivityLog, {
      organizationId,
      createdAt: { $gte: previous7Start, $lt: last7Start },
    }),
    countDocuments(Task, {
      organizationId,
      deletedAt: null,
      status: { $nin: ["done", "cancelled"] },
      endAt: { $gte: today, $lte: next7End },
    }),
    countDocuments(Task, {
      organizationId,
      deletedAt: null,
      status: { $nin: ["done", "cancelled"] },
      endAt: { $lt: today },
    }),
    Task.aggregate([
      { $match: { organizationId: organizationObjectId, deletedAt: null } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    OrganizationMember.aggregate([
      {
        $match: {
          organizationId: organizationObjectId,
          status: "active",
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
              cond: { $ne: ["$$roleId", null] },
            },
          },
        },
      },
      { $unwind: "$roleIdsForCount" },
      { $group: { _id: "$roleIdsForCount", count: { $sum: 1 } } },
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
    ActivityLog.aggregate([
      {
        $match: {
          organizationId: organizationObjectId,
          createdAt: { $gte: last30Start },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Task.aggregate([
      {
        $match: {
          organizationId: organizationObjectId,
          deletedAt: null,
          createdAt: { $gte: eightWeeksAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Task.aggregate([
      {
        $match: {
          organizationId: organizationObjectId,
          deletedAt: null,
          completedAt: { $gte: eightWeeksAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$completedAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Document.aggregate([
      {
        $match: {
          organizationId: organizationObjectId,
          deletedAt: null,
          status: { $ne: "deleted" },
          createdAt: { $gte: eightWeeksAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Post.aggregate([
      {
        $match: {
          organizationId: organizationObjectId,
          createdAt: { $gte: eightWeeksAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Project.aggregate([
      { $match: { organizationId: organizationObjectId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Task.find({
      organizationId,
      deletedAt: null,
      status: { $nin: ["done", "cancelled"] },
      endAt: { $ne: null, $lte: next7End },
    })
      .populate("ownerId", "_id fullName email avatar")
      .sort({ endAt: 1 })
      .limit(5),
    ActivityLog.find({ organizationId })
      .populate("actorId", "_id fullName email avatar")
      .sort({ createdAt: -1 })
      .limit(10),
  ]);

  const taskStatus = buildStatusCounts(taskStatusRows);
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
  const roleMap = new Map(
    roles.map((role) => [toId(role._id || role.id), serializeOrganizationRole(role)]),
  );
  const roleDistribution = buildStatusCounts(roleRows);
  const roleBreakdown = roleRows.map((row) => {
    const roleId = toId(row._id);
    const role = roleMap.get(roleId);
    return {
      key: roleId || "unknown",
      label: role?.name || row._id || "Không rõ",
      color: role?.color || "#64748b",
      count: Number(row.count || 0),
    };
  });
  const projectStatus = buildStatusCounts(projectStatusRows);
  const activityTrend = buildDailySeries(last30Start, 30, activityTrendRows);
  const weeklyThroughput = buildWeeklySeries(eightWeeksAgo, {
    tasks: weeklyTaskRows,
    completed: weeklyCompletedTaskRows,
    documents: weeklyDocumentRows,
    posts: weeklyPostRows,
  });
  const completionRate = taskCount
    ? Math.round((doneTaskCount / Math.max(taskCount, 1)) * 100)
    : 0;
  const activityRate = Math.min(
    99,
    Math.round(
      completionRate * 0.56 +
        Math.min(activitiesLast7, 30) * 1.15 +
        Math.min(memberCount, 30) * 0.72,
    ),
  );
  const activityPeak = Math.max(1, ...activityTrend.map((item) => item.value));

  return {
    metrics: {
      members: memberCount,
      pendingMembers: pendingCount,
      roles: roles.length,
      activeInvites: activeInviteCount,
      invites: totalInviteCount,
      projects: projectCount,
      tasks: taskCount,
      openTasks: openTaskCount,
      doneTasks: doneTaskCount,
      documents: documentCount,
      posts: postCount,
      meetings: meetingCount,
      conversations: conversationCount,
      dueSoonTasks: dueSoonCount,
      overdueTasks: overdueCount,
      activityRate,
      completionRate,
    },
    statCards: [
      {
        key: "members",
        icon: "groups",
        label: "thành viên",
        value: memberCount,
        tone: "teal",
        delta: buildDelta(newMembersLast30, newMembersPrevious30),
        detail: `${newMembersLast30} mới trong 30 ngày`,
      },
      {
        key: "roles",
        icon: "shield",
        label: "vai trò",
        value: roles.length,
        tone: "blue",
        delta: { value: 0, percent: 0, direction: "flat" },
        detail: "Không đổi",
      },
      {
        key: "invites",
        icon: "mail",
        label: "lời mời",
        value: activeInviteCount,
        tone: "indigo",
        delta: buildDelta(invitesLast7, invitesPrevious7),
        detail: `${invitesLast7} mới tuần này`,
      },
      {
        key: "pending",
        icon: "schedule",
        label: "yêu cầu chờ duyệt",
        value: pendingCount,
        tone: "amber",
        delta: buildDelta(pendingLast7, pendingPrevious7),
        detail: `${pendingLast7} phát sinh tuần này`,
      },
      {
        key: "activity",
        icon: "trending_up",
        label: "hoạt động",
        value: `${activityRate}%`,
        tone: "emerald",
        delta: buildDelta(activitiesLast7, activitiesPrevious7),
        detail: "so với tuần trước",
      },
    ],
    taskStatus,
    roleDistribution,
    roleBreakdown,
    memberGrowth,
    activityTrend: activityTrend.map((item) => ({
      ...item,
      percent: Math.round((item.value / activityPeak) * 100),
    })),
    weeklyThroughput,
    projectStatus,
    health: {
      activityRate,
      completionRate,
      dueSoonTasks: dueSoonCount,
      overdueTasks: overdueCount,
      openTasks: openTaskCount,
      activeProjects: Number(projectStatus.active || 0),
      completedProjects: Number(projectStatus.completed || 0),
    },
    focusQueue: focusTasks.map((task) => ({
      id: toId(task._id),
      title: task.title,
      status: task.status,
      priority: task.priority,
      endAt: task.endAt,
      owner: task.ownerId
        ? {
            id: toId(task.ownerId._id || task.ownerId.id),
            fullName: task.ownerId.fullName || "",
            email: task.ownerId.email || "",
            avatar: task.ownerId.avatar || "",
          }
        : null,
    })),
    recentActivities: recentActivities.map((activity) => ({
      id: toId(activity._id),
      action: activity.action,
      entityType: activity.entityType,
      createdAt: activity.createdAt,
      ...getActivityDisplay(activity),
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
  deleteExpiredOrganizationInvites,
  ensureOrganizationMember,
  ensureOrganizationJoinRequest,
  ensureDefaultOrganizationRoles,
  findInviteTarget,
  findOrganizationByInvite,
  getMembershipPermissions,
  getMembershipRoleIds,
  getOrganizationRoles,
  getPendingOrganizationMemberships,
  getRolesFromMap,
  getUserOrganizationMemberships,
  getMissingRequiredJoinAnswers,
  normalizeOrganizationJoinAnswers,
  normalizeOrganizationJoinQuestions,
  normalizeOrganizationInvitePayload,
  normalizeOrganizationPayload,
  normalizeOrganizationRolePayload,
  normalizeOrganizationSettingsPayload,
  resumeExpiredOrganizationInvitePauses,
  serializeOrganizationInvite,
  serializeOrganization,
  serializeOrganizationRole,
  syncMembershipPrimaryRole,
};
