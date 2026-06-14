import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import OrganizationMember from "../models/OrganizationMember.js";

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
            req.organizationId = organization._id;
            req.organization = organization;
            req.organizationMembership = membership;
            req.user.activeOrganizationId = organization._id;
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
