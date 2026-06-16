import mongoose from "mongoose";

const { Schema } = mongoose;

const permissionUserSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["viewer", "editor"],
      required: true,
    },
  },
  { _id: false },
);

const documentSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 255,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    category: {
      type: String,
      enum: [
        "general",
        "policy",
        "report",
        "contract",
        "design",
        "finance",
        "technical",
        "other",
      ],
      default: "general",
      required: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    folderId: {
      type: Schema.Types.ObjectId,
      ref: "Folder",
      required: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    currentVersionId: {
      type: Schema.Types.ObjectId,
      ref: "DocumentVersion",
      default: null,
    },
    versionCounter: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["uploading", "pending_scan", "active", "failed", "deleted"],
      default: "uploading",
      required: true,
    },
    uploadSessionId: {
      type: String,
      trim: true,
      default: null,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      default: null,
    },
    permissions: {
      inheritFromFolder: {
        type: Boolean,
        default: true,
      },
      visibility: {
        type: String,
        enum: ["private", "organization", "custom"],
        default: "private",
      },
      users: {
        type: [permissionUserSchema],
        default: [],
      },
    },
    previewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    downloadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastAccessedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

documentSchema.index({ organizationId: 1, folderId: 1, status: 1, deletedAt: 1 });
documentSchema.index({ organizationId: 1, updatedAt: -1 });
documentSchema.index({ ownerId: 1 });
documentSchema.index({ currentVersionId: 1 });
documentSchema.index(
  { createdBy: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: "string" },
    },
  },
);

const Document = mongoose.model("Document", documentSchema);

export default Document;
