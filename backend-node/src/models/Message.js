import mongoose from "mongoose";

const pollVoterSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    votedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const pollOptionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    voters: {
      type: [pollVoterSchema],
      default: [],
    },
  },
  { _id: true },
);

const pollSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    options: {
      type: [pollOptionSchema],
      default: [],
    },
    settings: {
      multiple: {
        type: Boolean,
        default: false,
      },
      allowOptions: {
        type: Boolean,
        default: false,
      },
      hideResultsUntilVoted: {
        type: Boolean,
        default: false,
      },
      hideVoters: {
        type: Boolean,
        default: false,
      },
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

const reminderResponseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["accepted", "declined"],
      required: true,
    },
    respondedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const reminderSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      maxlength: 500,
      required: true,
    },
    scheduledAt: {
      type: Date,
      required: true,
    },
    nextTriggerAt: {
      type: Date,
      default: null,
    },
    recurrence: {
      type: String,
      enum: ["none", "daily", "weekly", "monthly"],
      default: "none",
    },
    status: {
      type: String,
      enum: ["active", "completed", "cancelled"],
      default: "active",
    },
    responses: {
      type: [reminderResponseSchema],
      default: [],
    },
    triggerCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastTriggeredAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["text", "image", "file", "audio", "poll", "reminder", "system"],
      default: "text",
    },
    content: {
      type: String,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    poll: {
      type: pollSchema,
      default: null,
    },
    reminder: {
      type: reminderSchema,
      default: null,
    },
    attachments: [
      {
        fileName: String,
        fileUrl: String,
        storageKey: String,
        fileSize: Number,
        mimeType: String,
        kind: {
          type: String,
          enum: ["file", "image", "video", "audio", "voice"],
          default: "file",
        },
        durationSeconds: Number,
      },
    ],
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    reactions: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        reaction: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    editedAt: {
      type: Date,
      default: null,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    pinnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    pinnedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, isPinned: -1, pinnedAt: -1 });
messageSchema.index({
  type: 1,
  "reminder.status": 1,
  "reminder.nextTriggerAt": 1,
});

const Message = mongoose.model("Message", messageSchema);
export default Message;
