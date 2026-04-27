import ApiError from "../utils/apiError.js";

export const isAdmin = (user) => user?.role === "admin";

export const requireAdmin = (req, res, next) => {
  if (!isAdmin(req.user)) {
    return next(new ApiError(403, "Admin access required"));
  }

  return next();
};

export default {
  isAdmin,
  requireAdmin,
};
