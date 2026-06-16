import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import OrganizationMember from "../models/OrganizationMember.js";
import {
  DEFAULT_MEMBER_ROLE_KEY,
  OWNER_ORGANIZATION_PERMISSIONS,
  normalizeRoleKey,
} from "../utils/organizationPolicy.js";
import {
  getMembershipPermissions,
  getOrganizationRoles,
  getRolesFromMap,
} from "../services/organizationService.js";

const toId = (value) => String(value?._id || value?.id || value || "");

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

const inactiveAccountMessage =
  "Your account is not active. Please contact an administrator.";

export const isInactiveUser = (user) =>
  ["inactive", "suspended", "locked", "disabled"].includes(user?.status);

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res.status(401).json({ message: "User not found" });
      }

      if (isInactiveUser(req.user)) {
        return res.status(403).json({ message: inactiveAccountMessage });
      }

      const requestedOrganizationId =
        req.get("x-workhub-organization-id") || req.user.activeOrganizationId;
      req.organizationId = null;
      req.organization = null;
      req.organizationMembership = null;

      if (requestedOrganizationId) {
        const membership = await OrganizationMember.findOne({
          organizationId: requestedOrganizationId,
          userId: req.user._id,
          status: "active",
        });

        if (membership) {
          const organization = await Organization.findOne({
            _id: requestedOrganizationId,
            archivedAt: null,
          });

          if (organization) {
            const organizationRoles = await getOrganizationRoles(requestedOrganizationId);
            const roleMap = buildRoleMap(organizationRoles);
            const membershipRoles = getRolesFromMap(membership, roleMap);
            const roleDefinition = membershipRoles[0] || null;
            const isOwner =
              String(organization.ownerId || "") === String(req.user._id || "");
            const roleKey =
              roleDefinition?.key || membership.role || DEFAULT_MEMBER_ROLE_KEY;
            const permissions = isOwner
              ? OWNER_ORGANIZATION_PERMISSIONS
              : getMembershipPermissions(membership, roleMap);
            req.organizationId = organization._id;
            req.organization = organization;
            req.organizationMembership = membership;
            req.organizationMembership.isOwner = isOwner;
            req.organizationMembership.permissions = permissions;
            req.user.activeOrganizationId = organization._id;
            req.user.activeOrganizationRole = roleKey;
            req.user.activeOrganizationRoleId = roleDefinition?._id || membership.roleId || null;
            req.user.activeOrganizationRoleIds = membershipRoles
              .map((role) => role?._id || role?.id)
              .filter(Boolean);
            req.user.activeOrganizationRoles = membershipRoles.map((role) => ({
              id: role._id || role.id,
              key: role.key,
              name: role.name,
              color: role.color,
            }));
            req.user.activeOrganizationPermissions = permissions;
            req.user.activeOrganizationIsOwner = isOwner;
          }
        }
      }

      next();
    } catch (error) {
      console.error("Auth middleware error:", error.message);
      return res.status(401).json({ message: "Not authorized, token failed" });
    }
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }
};

export default protect;
