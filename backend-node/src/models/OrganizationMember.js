import mongoose from "mongoose";

const joinAnswerSchema = new mongoose.Schema(
  {
    questionId: {
      type: String,
      trim: true,
      maxlength: 80,
      required: true,
    },
    questionLabel: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },
    questionType: {
      type: String,
      enum: ["short_text", "paragraph", "multiple_choice", "rules"],
      default: "short_text",
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      default: "",
    },
  },
  { _id: false },
);

const organizationMemberSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 64,
      default: "thanh-vien",
      required: true,
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrganizationRole",
      default: null,
    },
    roleIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "OrganizationRole",
        },
      ],
      default: [],
    },
    status: {
      type: String,
      enum: ["active", "invited", "pending", "removed"],
      default: "active",
      required: true,
    },
    isFavorite: {
      type: Boolean,
      default: false,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    inviteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrganizationInvite",
      default: null,
    },
    inviteUsageCountedAt: {
      type: Date,
      default: null,
    },
    joinAnswers: {
      type: [joinAnswerSchema],
      default: [],
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    removedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

organizationMemberSchema.index(
  { organizationId: 1, userId: 1 },
  { unique: true },
);
organizationMemberSchema.index({ userId: 1, status: 1, updatedAt: -1 });
organizationMemberSchema.index({ userId: 1, isFavorite: 1, updatedAt: -1 });
organizationMemberSchema.index({ organizationId: 1, status: 1, role: 1 });
organizationMemberSchema.index({ organizationId: 1, status: 1, roleIds: 1 });

const OrganizationMember = mongoose.model(
  "OrganizationMember",
  organizationMemberSchema,
);

export default OrganizationMember;
