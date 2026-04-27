import mongoose from "mongoose";

const { Schema } = mongoose;

const notificationSettingsSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    inAppEnabled: {
      type: Boolean,
      default: true,
    },
    emailEnabled: {
      type: Boolean,
      default: false,
    },
    pushEnabled: {
      type: Boolean,
      default: false,
    },
    taskAssigned: {
      type: Boolean,
      default: true,
    },
    taskUpdated: {
      type: Boolean,
      default: true,
    },
    taskDueSoon: {
      type: Boolean,
      default: true,
    },
    documentShared: {
      type: Boolean,
      default: true,
    },
    documentVersionAdded: {
      type: Boolean,
      default: true,
    },
    adminActions: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

notificationSettingsSchema.index({ userId: 1 }, { unique: true });

const NotificationSettings = mongoose.model(
  "NotificationSettings",
  notificationSettingsSchema,
);

export default NotificationSettings;
