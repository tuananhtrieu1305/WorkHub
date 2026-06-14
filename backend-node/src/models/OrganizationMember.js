import mongoose from "mongoose";

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
      enum: ["owner", "admin", "member"],
      default: "member",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "invited", "removed"],
      default: "active",
      required: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
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
organizationMemberSchema.index({ organizationId: 1, status: 1, role: 1 });

const OrganizationMember = mongoose.model(
  "OrganizationMember",
  organizationMemberSchema,
);

export default OrganizationMember;
