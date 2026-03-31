import protect from "./authMiddleware.js";

const admin = async (req, res, next) => {
  await protect(req, res, () => {
    if (req.user && req.user.role === "admin") {
      next();
    } else {
      res.status(403).json({ message: "Access denied. Admin only." });
    }
  });
};

export default admin;
