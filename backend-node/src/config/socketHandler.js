import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import OrganizationMember from "../models/OrganizationMember.js";
import Conversation from "../models/Conversation.js";
import Call from "../models/Call.js";
import {
  buildPresencePayload,
  markUserConnected,
  markUserDisconnected,
} from "../services/presenceService.js";
import { applyCallHeartbeat } from "../utils/callPolicy.js";
import {
  getOrganizationRoomName,
  getOrganizationUserRoomName,
  getConversationParticipantUserRoomName,
  getConversationRoomName,
} from "../utils/conversationRealtime.js";

const toComparableId = (value) => {
  if (value == null) return "";
  return String(value._id || value.id || value);
};

const resolveSocketOrganization = async (user, requestedOrganizationId) => {
  const organizationId = toComparableId(
    requestedOrganizationId || user?.activeOrganizationId,
  );
  if (!organizationId) return null;

  const [membership, organization] = await Promise.all([
    OrganizationMember.findOne({
      organizationId,
      userId: user._id,
      status: "active",
    }),
    Organization.findOne({ _id: organizationId, archivedAt: null }),
  ]);

  return membership && organization ? organization._id : null;
};

const joinConversationRooms = (socket, conversationOrId) => {
  const targetConversationId = toComparableId(
    conversationOrId?._id || conversationOrId?.id || conversationOrId,
  );
  const organizationId = toComparableId(
    conversationOrId?.organizationId || socket.data?.organizationId,
  );
  const currentUserId = toComparableId(socket.user?._id);
  if (!targetConversationId || !currentUserId) return;

  socket.join(getConversationRoomName(targetConversationId, organizationId));
  socket.join(
    getConversationParticipantUserRoomName(
      targetConversationId,
      currentUserId,
      organizationId,
    ),
  );
};

const leaveConversationRooms = (socket, conversationId) => {
  const targetConversationId = toComparableId(conversationId);
  const organizationId = toComparableId(socket.data?.organizationId);
  const currentUserId = toComparableId(socket.user?._id);
  if (!targetConversationId || !currentUserId) return;

  socket.leave(getConversationRoomName(targetConversationId, organizationId));
  socket.leave(getConversationRoomName(targetConversationId));
  socket.leave(
    getConversationParticipantUserRoomName(
      targetConversationId,
      currentUserId,
      organizationId,
    ),
  );
  socket.leave(
    getConversationParticipantUserRoomName(targetConversationId, currentUserId),
  );
};

const emitPresenceChanged = async (io, userId) => {
  const freshUser = await User.findById(userId).select(
    "_id fullName avatar activityStatus activityStatusExpiresAt"
  );
  if (!freshUser) return;

  const payload = buildPresencePayload(freshUser);

  io.to(`user:${freshUser._id}`).emit("activity_status_changed", payload);

  const conversations = await Conversation.find({
    "participants.userId": freshUser._id,
  }).select("_id organizationId");

  conversations.forEach((conversation) => {
    io.to(getConversationRoomName(conversation._id, conversation.organizationId)).emit(
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
      socket.data.userId = toComparableId(user._id);
      const organizationId = await resolveSocketOrganization(
        user,
        socket.handshake.auth?.organizationId,
      );
      socket.data.organizationId = toComparableId(organizationId);
      next();
    } catch (error) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", async (socket) => {
    console.log(`User connected: ${socket.user.fullName} (${socket.user._id})`);
    socket.join(`user:${socket.user._id}`);
    if (socket.data.organizationId) {
      socket.join(getOrganizationRoomName(socket.data.organizationId));
      socket.join(
        getOrganizationUserRoomName(socket.data.organizationId, socket.user._id),
      );
    }
    const becameOnline = markUserConnected(socket.user._id, socket.id);

    // Auto-join all conversation rooms
    try {
      const conversationQuery = {
        "participants.userId": socket.user._id,
      };
      if (socket.data.organizationId) {
        conversationQuery.organizationId = socket.data.organizationId;
      } else {
        conversationQuery._id = { $exists: false };
      }
      const conversations = await Conversation.find(conversationQuery).select(
        "_id organizationId",
      );

      conversations.forEach((conv) => joinConversationRooms(socket, conv));

      if (becameOnline) {
        await emitPresenceChanged(io, socket.user._id);
      }
    } catch (error) {
      console.error("Error joining rooms:", error.message);
    }

    // Join a specific conversation room (when user opens a conversation)
    socket.on("join_conversation", async (conversationId) => {
      try {
        const conversation = await Conversation.findOne({
          _id: conversationId,
          organizationId: socket.data.organizationId,
        }).select("participants organizationId");
        if (!conversation) return;

        const isMember = conversation.participants.some(
          (p) => p.userId.toString() === socket.user._id.toString()
        );
        if (!isMember) return;

        joinConversationRooms(socket, conversation);
      } catch (error) {
        console.error("Join conversation error:", error.message);
      }
    });

    // Leave a specific conversation room
    socket.on("leave_conversation", (conversationId) => {
      leaveConversationRooms(socket, conversationId);
    });

    // #65 - Typing status: báo hiệu đang gõ / ngừng gõ
    socket.on("typing_status", async ({ conversationId, isTyping }) => {
      try {
        if (!conversationId) return;

        const conversation = await Conversation.findOne({
          _id: conversationId,
          organizationId: socket.data.organizationId,
        }).select("participants organizationId");
        if (!conversation) return;

        const isMember = conversation.participants.some(
          (p) => p.userId.toString() === socket.user._id.toString()
        );
        if (!isMember) return;

        socket.to(
          getConversationRoomName(conversation._id, conversation.organizationId),
        ).emit("user_typing", {
          conversationId,
          organizationId: conversation.organizationId,
          userId: socket.user._id,
          fullName: socket.user.fullName,
          isTyping: Boolean(isTyping),
        });
      } catch (error) {
        console.error("Typing status error:", error.message);
      }
    });

    socket.on("call_heartbeat", async ({ callId } = {}, acknowledge) => {
      try {
        if (!callId) {
          acknowledge?.({ ok: false, reason: "missing_call_id" });
          return;
        }

        const call = await Call.findOne({
          _id: callId,
          status: { $in: ["connecting", "active"] },
          "participants.userId": socket.user._id,
        });
        if (!call) {
          acknowledge?.({ ok: false, reason: "call_not_found" });
          return;
        }

        const { participants, updated } = applyCallHeartbeat(
          call.participants,
          socket.user._id,
          new Date(),
        );
        if (!updated) {
          acknowledge?.({ ok: false, reason: "participant_not_found" });
          return;
        }

        await Call.findByIdAndUpdate(call._id, { $set: { participants } });
        acknowledge?.({ ok: true });
      } catch (error) {
        console.error("Call socket heartbeat error:", error.message);
        acknowledge?.({ ok: false, reason: "server_error" });
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
