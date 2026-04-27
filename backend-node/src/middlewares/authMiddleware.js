import jwt from "jsonwebtoken";
import User from "../models/User.js";

const inactiveAccountMessage =
  "Your account is not active. Please contact an administrator.";

export const isInactiveUser = (user) =>
  ["locked", "disabled"].includes(user?.status);

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
