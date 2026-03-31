import mongoose from "mongoose";

const userPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    language: {
      type: String,
      enum: ["vi", "en"],
      default: "vi",
    },
    theme: {
      type: String,
      enum: ["light", "dark", "system"],
      default: "system",
    },
    notifications: {
      email: {
        taskAssigned: { type: Boolean, default: true },
        postMention: { type: Boolean, default: true },
        documentShared: { type: Boolean, default: true },
        comment: { type: Boolean, default: true },
        callMissed: { type: Boolean, default: false },
      },
      push: {
        taskAssigned: { type: Boolean, default: true },
        postMention: { type: Boolean, default: true },
        documentShared: { type: Boolean, default: true },
        comment: { type: Boolean, default: true },
        callMissed: { type: Boolean, default: false },
      },
      inApp: {
        taskAssigned: { type: Boolean, default: true },
        postMention: { type: Boolean, default: true },
        documentShared: { type: Boolean, default: true },
        comment: { type: Boolean, default: true },
        callMissed: { type: Boolean, default: true },
      },
    },
  },
  {
    timestamps: true,
  }
);

const UserPreference = mongoose.model("UserPreference", userPreferenceSchema);
export default UserPreference;
