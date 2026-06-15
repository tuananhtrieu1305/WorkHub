import mongoose from "mongoose";

const joinQuestionOptionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      trim: true,
      maxlength: 80,
      required: true,
    },
    label: {
      type: String,
      trim: true,
      maxlength: 120,
      required: true,
    },
  },
  { _id: false },
);

const joinQuestionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      trim: true,
      maxlength: 80,
      required: true,
    },
    type: {
      type: String,
      enum: ["short_text", "paragraph", "multiple_choice", "rules"],
      default: "short_text",
      required: true,
    },
    label: {
      type: String,
      trim: true,
      maxlength: 240,
      required: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    required: {
      type: Boolean,
      default: true,
    },
    options: {
      type: [joinQuestionOptionSchema],
      default: [],
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { _id: false },
);

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
      joinQuestions: {
        type: [joinQuestionSchema],
        default: [],
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
