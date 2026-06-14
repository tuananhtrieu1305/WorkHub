import ApiError from "../utils/apiError.js";
import Organization from "../models/Organization.js";
import OrganizationMember from "../models/OrganizationMember.js";
import User from "../models/User.js";
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
