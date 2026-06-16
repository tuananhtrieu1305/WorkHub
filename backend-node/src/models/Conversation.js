import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["private", "group"],
      required: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },
    name: {
      type: String,
      default: "",
    },
    avatar: {
      type: String,
      default: "",
    },
    participants: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        lastReadMessageId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Message",
          default: null,
        },
        nickname: {
          type: String,
          trim: true,
          maxlength: 80,
          default: "",
        },
        isPinned: {
          type: Boolean,
          default: false,
        },
        pinnedAt: {
          type: Date,
          default: null,
        },
        mutedUntil: {
          type: Date,
          default: null,
        },
        mutedIndefinitely: {
          type: Boolean,
          default: false,
        },
      },
    ],
    lastMessage: {
      messageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
      content: { type: String, default: "" },
      senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      createdAt: { type: Date },
      deletedAt: { type: Date, default: null },
      deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

conversationSchema.index({ "participants.userId": 1 });
conversationSchema.index({ organizationId: 1, "participants.userId": 1 });
conversationSchema.index({ updatedAt: -1 });
conversationSchema.index({
  "participants.userId": 1,
  "participants.isPinned": 1,
  "participants.pinnedAt": 1,
});
conversationSchema.index({
  "participants.userId": 1,
  "lastMessage.createdAt": -1,
  createdAt: -1,
});

const Conversation = mongoose.model("Conversation", conversationSchema);
export default Conversation;
