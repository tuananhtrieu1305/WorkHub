import mongoose from "mongoose";

const { Schema } = mongoose;

const callParticipantSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["caller", "callee"],
      required: true,
    },
    browserDeviceId: {
      type: String,
      default: "",
      trim: true,
    },
    tabInstanceId: {
      type: String,
      default: "",
      trim: true,
    },
    socketId: {
      type: String,
      default: "",
      trim: true,
    },
    cloudflareParticipantId: {
      type: String,
      default: "",
      trim: true,
    },
    activeDeviceId: {
      type: String,
      default: "",
      trim: true,
    },
    tokenIssuedAt: {
      type: Date,
      default: null,
    },
    mediaPermissionGrantedAt: {
      type: Date,
      default: null,
    },
    joinedAt: {
      type: Date,
      default: null,
    },
    leftAt: {
      type: Date,
      default: null,
    },
    lastHeartbeatAt: {
      type: Date,
      default: null,
    },
    disconnectedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

const callSchema = new Schema(
  {
    callerUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    calleeUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    mediaType: {
      type: String,
      enum: ["audio", "video"],
      required: true,
    },
    status: {
      type: String,
      enum: [
        "preparing",
        "ringing",
        "answering",
        "connecting",
        "active",
        "declined",
        "cancelled",
        "missed",
        "busy",
        "failed",
        "ended",
      ],
      default: "preparing",
      index: true,
    },
    statusReason: {
      type: String,
      default: "",
      trim: true,
    },
    cloudflareMeetingId: {
      type: String,
      default: "",
      trim: true,
    },
    cloudflareSessionId: {
      type: String,
      default: "",
      trim: true,
    },
    callerBrowserDeviceId: {
      type: String,
      default: "",
      trim: true,
    },
    callerTabInstanceId: {
      type: String,
      default: "",
      trim: true,
    },
    answeredByBrowserDeviceId: {
      type: String,
      default: "",
      trim: true,
    },
    answeredByTabInstanceId: {
      type: String,
      default: "",
      trim: true,
    },
    preparingExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    ringingExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    answeringExpiresAt: {
      type: Date,
      default: null,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    connectedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    durationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    participants: {
      type: [callParticipantSchema],
      default: [],
    },
  },
  { timestamps: true },
);

callSchema.index({ callerUserId: 1, createdAt: -1 });
callSchema.index({ calleeUserId: 1, createdAt: -1 });
callSchema.index({ conversationId: 1, createdAt: -1 });
callSchema.index({ status: 1, updatedAt: -1 });
callSchema.index({ "participants.userId": 1, status: 1 });

const Call = mongoose.model("Call", callSchema);

export default Call;
