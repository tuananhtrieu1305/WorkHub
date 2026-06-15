import mongoose from "mongoose";

const { Schema } = mongoose;

const organizationInviteSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "paused", "revoked"],
      default: "active",
      required: true,
      index: true,
    },
    maxUses: {
      type: Number,
      default: null,
      min: 1,
    },
    bypassApproval: {
      type: Boolean,
      default: false,
    },
    usesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    pausedAt: {
      type: Date,
      default: null,
    },
    pausedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    pausedUntil: {
      type: Date,
      default: null,
      index: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

organizationInviteSchema.index({
  organizationId: 1,
  status: 1,
  expiresAt: 1,
  createdAt: -1,
});
organizationInviteSchema.index({ organizationId: 1, createdBy: 1, createdAt: -1 });

const OrganizationInvite = mongoose.model(
  "OrganizationInvite",
  organizationInviteSchema,
);

export default OrganizationInvite;
