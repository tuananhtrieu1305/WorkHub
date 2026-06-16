import mongoose from "mongoose";

const { Schema } = mongoose;

const meetingActionItemSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    owner: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },
    dueDate: {
      type: String,
      trim: true,
      default: "",
      maxlength: 80,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
  },
  { _id: false },
);

const meetingSummarySchema = new Schema(
  {
    meetingId: {
      type: Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
      unique: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },
    generatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    source: {
      type: String,
      enum: ["recording", "transcript", "notes"],
      default: "recording",
    },
    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      default: "processing",
      index: true,
    },
    cloudflareSessionId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    recordingUrl: {
      type: String,
      trim: true,
      default: "",
    },
    transcript: {
      type: String,
      trim: true,
      default: "",
      maxlength: 200000,
    },
    title: {
      type: String,
      trim: true,
      default: "",
      maxlength: 160,
    },
    summary: {
      type: String,
      trim: true,
      default: "",
      maxlength: 5000,
    },
    decisions: {
      type: [String],
      default: [],
    },
    actionItems: {
      type: [meetingActionItemSchema],
      default: [],
    },
    followUps: {
      type: [String],
      default: [],
    },
    model: {
      type: String,
      trim: true,
      default: "",
    },
    rawResponse: {
      type: String,
      trim: true,
      default: "",
      maxlength: 20000,
    },
    rawWebhook: {
      type: Schema.Types.Mixed,
      default: null,
    },
    errorMessage: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },
  },
  { timestamps: true },
);

meetingSummarySchema.index({ organizationId: 1, createdAt: -1 });

const MeetingSummary = mongoose.model("MeetingSummary", meetingSummarySchema);

export default MeetingSummary;
