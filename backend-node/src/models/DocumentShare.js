import mongoose from "mongoose";

const { Schema } = mongoose;

const documentShareSchema = new Schema(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
      required: true,
    },
    versionId: {
      type: Schema.Types.ObjectId,
      ref: "DocumentVersion",
      default: null,
    },
    mode: {
      type: String,
      enum: ["fixed_version", "latest"],
      default: "fixed_version",
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      trim: true,
      select: false,
    },
    permission: {
      type: String,
      enum: ["view", "download"],
      default: "view",
      required: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    maxDownloads: {
      type: Number,
      min: 1,
      default: null,
    },
    downloadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    lastAccessedAt: {
      type: Date,
      default: null,
    },
    accessScope: {
      type: String,
      enum: ["public_token", "email_bound", "password_protected"],
      default: "public_token",
    },
  },
  {
    timestamps: true,
  },
);

documentShareSchema.index({ tokenHash: 1 }, { unique: true });
documentShareSchema.index({ documentId: 1, revokedAt: 1 });
documentShareSchema.index({ expiresAt: 1 });

const DocumentShare = mongoose.model("DocumentShare", documentShareSchema);

export default DocumentShare;
