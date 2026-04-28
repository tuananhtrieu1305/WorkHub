import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Conversation from "../models/Conversation.js";
import {
  buildPresencePayload,
  markUserConnected,
  markUserDisconnected,
} from "../services/presenceService.js";

const emitPresenceChanged = async (io, userId) => {
  const freshUser = await User.findById(userId).select(
    "_id fullName avatar activityStatus activityStatusExpiresAt"
  );
  if (!freshUser) return;

  const payload = buildPresencePayload(freshUser);

  io.to(`user:${freshUser._id}`).emit("activity_status_changed", payload);

  const conversations = await Conversation.find({
    "participants.userId": freshUser._id,
  }).select("_id");

  conversations.forEach((conversation) => {
    io.to(`conversation:${conversation._id}`).emit(
      "activity_status_changed",
      payload,
    );
  });
};

export const setupSocket = (io) => {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(" ")[1];
      if (!token) {
        return next(new Error("Authentication required"));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");
      if (!user) {
        return next(new Error("User not found"));
      }
      socket.user = user;
      next();
    } catch (error) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", async (socket) => {
    console.log(`User connected: ${socket.user.fullName} (${socket.user._id})`);
    socket.join(`user:${socket.user._id}`);
    const becameOnline = markUserConnected(socket.user._id, socket.id);

    // Auto-join all conversation rooms
    try {
      const conversations = await Conversation.find({
        "participants.userId": socket.user._id,
      }).select("_id");

      conversations.forEach((conv) => {
        socket.join(`conversation:${conv._id}`);
      });

      if (becameOnline) {
        await emitPresenceChanged(io, socket.user._id);
      }
    } catch (error) {
      console.error("Error joining rooms:", error.message);
    }

    // Join a specific conversation room (when user opens a conversation)
    socket.on("join_conversation", (conversationId) => {
      socket.join(`conversation:${conversationId}`);
    });

    // Leave a specific conversation room
    socket.on("leave_conversation", (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // #65 - Typing status: báo hiệu đang gõ / ngừng gõ
    socket.on("typing_status", async ({ conversationId, isTyping }) => {
      try {
        if (!conversationId) return;

        const conversation = await Conversation.findById(conversationId).select("participants");
        if (!conversation) return;

        const isMember = conversation.participants.some(
          (p) => p.userId.toString() === socket.user._id.toString()
        );
        if (!isMember) return;

        socket.to(`conversation:${conversationId}`).emit("user_typing", {
          conversationId,
          userId: socket.user._id,
          fullName: socket.user.fullName,
          isTyping: Boolean(isTyping),
        });
      } catch (error) {
        console.error("Typing status error:", error.message);
      }
    });

    socket.on("disconnect", async () => {
      console.log(`User disconnected: ${socket.user.fullName}`);
      const becameOffline = markUserDisconnected(socket.user._id, socket.id);
      if (!becameOffline) return;

      try {
        await emitPresenceChanged(io, socket.user._id);
      } catch (error) {
        console.error("Presence disconnect error:", error.message);
      }
    });
  });

  return io;
};
