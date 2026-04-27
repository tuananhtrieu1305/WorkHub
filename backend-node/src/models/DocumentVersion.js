import mongoose from "mongoose";

const { Schema } = mongoose;

const documentVersionSchema = new Schema(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
      required: true,
    },
    versionNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    storageProvider: {
      type: String,
      enum: ["r2"],
      default: "r2",
      required: true,
    },
    storageBucket: {
      type: String,
      required: true,
      trim: true,
    },
    storageKey: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    detectedMimeType: {
      type: String,
      trim: true,
      default: null,
    },
    extension: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    checksum: {
      type: String,
      trim: true,
      default: null,
    },
    scanStatus: {
      type: String,
      enum: ["not_required", "pending", "clean", "infected", "failed"],
      default: "not_required",
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

documentVersionSchema.index(
  { documentId: 1, versionNumber: 1 },
  { unique: true },
);
documentVersionSchema.index({ documentId: 1, createdAt: -1 });

const DocumentVersion = mongoose.model(
  "DocumentVersion",
  documentVersionSchema,
);

export default DocumentVersion;
