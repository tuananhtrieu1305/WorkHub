import mongoose from "mongoose";

const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    content: {
      type: String,
      trim: true,
      default: "",
    },
    entityType: {
      type: String,
      trim: true,
      default: null,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    readAt: {
      type: Date,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  },
);

notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, deletedAt: 1, createdAt: -1 });
notificationSchema.index({ entityType: 1, entityId: 1 });
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
