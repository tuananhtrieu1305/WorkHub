import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Organization name is required"],
      trim: true,
      minlength: [2, "Organization name must be at least 2 characters"],
      maxlength: [120, "Organization name must be at most 120 characters"],
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 140,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    logoUrl: {
      type: String,
      trim: true,
      default: "",
    },
    logoStorageKey: {
      type: String,
      trim: true,
      default: "",
      select: false,
    },
    bannerUrl: {
      type: String,
      trim: true,
      default: "",
    },
    bannerStorageKey: {
      type: String,
      trim: true,
      default: "",
      select: false,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    inviteCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    inviteEnabled: {
      type: Boolean,
      default: true,
    },
    settings: {
      requireApproval: {
        type: Boolean,
        default: true,
      },
      allowMemberInvites: {
        type: Boolean,
        default: true,
      },
      memberDirectoryVisible: {
        type: Boolean,
        default: true,
      },
      defaultRoleKey: {
        type: String,
        trim: true,
        lowercase: true,
        default: "member",
      },
      joinMessage: {
        type: String,
        trim: true,
        maxlength: 500,
        default: "",
      },
    },
    accentColor: {
      type: String,
      default: "#2563eb",
      trim: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

organizationSchema.index({ slug: 1 }, { unique: true });
organizationSchema.index({ ownerId: 1, createdAt: -1 });

const Organization = mongoose.model("Organization", organizationSchema);
export default Organization;
