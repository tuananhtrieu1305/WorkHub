import mongoose from "mongoose";

const { Schema } = mongoose;

const meetingSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    cloudflareMeetingId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hostUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "ended", "cancelled"],
      default: "active",
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

meetingSchema.index({ createdBy: 1, createdAt: -1 });
meetingSchema.index({ hostUserId: 1, createdAt: -1 });
meetingSchema.index({ status: 1, createdAt: -1 });
meetingSchema.index({ projectId: 1, status: 1 });
meetingSchema.index({ departmentId: 1, status: 1 });

const Meeting = mongoose.model("Meeting", meetingSchema);

export default Meeting;
