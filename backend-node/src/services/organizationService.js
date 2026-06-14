import crypto from "node:crypto";

import Organization from "../models/Organization.js";
import OrganizationMember from "../models/OrganizationMember.js";
import User from "../models/User.js";
import {
  createOrganizationSlug,
  normalizeInviteCode,
  normalizeOrganizationName,
} from "../utils/organizationPolicy.js";

const toId = (value) => String(value?._id || value || "");

const buildInviteLink = (organization, baseUrl = "") => {
  const code = organization?.inviteCode || "";
  if (!code) return "";
  const origin = String(baseUrl || "").replace(/\/+$/, "");
  return origin ? `${origin}/organization/join/${code}` : `/organization/join/${code}`;
};

export const serializeOrganization = (
  organization,
  membership = null,
  { baseUrl = "" } = {},
) => {
  const org = organization?.toObject?.() || organization;
  if (!org) return null;

  return {
    id: toId(org._id || org.id),
    name: org.name,
    slug: org.slug,
    description: org.description || "",
    logoUrl: org.logoUrl || "",
    ownerId: toId(org.ownerId),
    role: membership?.role || null,
    memberStatus: membership?.status || null,
    joinedAt: membership?.joinedAt || null,
    inviteCode: org.inviteCode,
    inviteLink: buildInviteLink(org, baseUrl),
    inviteEnabled: org.inviteEnabled !== false,
    accentColor: org.accentColor || "#2563eb",
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  };
};

export const createInviteCode = () =>
  crypto.randomBytes(18).toString("base64url");

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

export const getUserOrganizationMemberships = async (userId) =>
  OrganizationMember.find({ userId, status: "active" })
    .populate("organizationId")
    .sort({ updatedAt: -1 });

export const buildUserOrganizationContext = async (
  user,
  { baseUrl = "", persistFallback = false } = {},
) => {
  const memberships = await getUserOrganizationMemberships(user._id);
  const activeId = toId(user.activeOrganizationId);
  const activeMembership =
    memberships.find(
      (membership) => toId(membership.organizationId) === activeId,
    ) || memberships[0] || null;
  const activeOrganization = activeMembership?.organizationId || null;

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
    }),
    organizations: memberships
      .filter((membership) => membership.organizationId)
      .map((membership) =>
        serializeOrganization(membership.organizationId, membership, {
          baseUrl,
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

export const findOrganizationByInvite = async (inviteInput) => {
  const inviteCode = normalizeInviteCode(inviteInput);
  if (!inviteCode) return null;
  return Organization.findOne({
    inviteCode,
    inviteEnabled: true,
    archivedAt: null,
  });
};

export const ensureOrganizationMember = async (
  organizationId,
  userId,
  { role = "member", invitedBy = null } = {},
) => {
  const existing = await OrganizationMember.findOne({ organizationId, userId });
  if (existing) {
    existing.status = "active";
    existing.removedAt = null;
    existing.joinedAt = existing.joinedAt || new Date();
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

export const normalizeOrganizationPayload = (payload = {}) => ({
  name: normalizeOrganizationName(payload.name),
  description: String(payload.description || "").trim().slice(0, 1000),
  accentColor: String(payload.accentColor || "#2563eb").trim() || "#2563eb",
});

export default {
  buildCurrentUserPayload,
  buildUserOrganizationContext,
  createInviteCode,
  createUniqueOrganizationSlug,
  ensureOrganizationMember,
  findOrganizationByInvite,
  getUserOrganizationMemberships,
  normalizeOrganizationPayload,
  serializeOrganization,
};
