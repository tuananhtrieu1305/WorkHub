import mongoose from "mongoose";

const { Schema } = mongoose;

const organizationRolePermissionsSchema = new Schema(
  {
    viewOverview: { type: Boolean, default: false },
    viewMembers: { type: Boolean, default: true },
    manageOrganization: { type: Boolean, default: false },
    manageMembers: { type: Boolean, default: false },
    manageRoles: { type: Boolean, default: false },
    manageInvites: { type: Boolean, default: false },
    manageSettings: { type: Boolean, default: false },
    createInvites: { type: Boolean, default: false },
    pauseInvites: { type: Boolean, default: false },
    viewDocumentInsights: { type: Boolean, default: false },
    manageDocuments: { type: Boolean, default: false },
    manageDocumentFolders: { type: Boolean, default: false },
    shareDocuments: { type: Boolean, default: false },
    viewAssignedTasks: { type: Boolean, default: true },
    viewOrganizationTasks: { type: Boolean, default: false },
    createTasks: { type: Boolean, default: true },
    manageTasks: { type: Boolean, default: false },
    assignTasks: { type: Boolean, default: false },
    deleteTasks: { type: Boolean, default: false },
    viewTaskInsights: { type: Boolean, default: false },
  },
  { _id: false },
);

const organizationRoleSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 64,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    color: {
      type: String,
      trim: true,
      default: "#2563eb",
    },
    permissions: {
      type: organizationRolePermissionsSchema,
      default: () => ({}),
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    sortOrder: {
      type: Number,
      default: 100,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
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

organizationRoleSchema.index(
  { organizationId: 1, key: 1 },
  {
    unique: true,
    partialFilterExpression: { archivedAt: null },
  },
);
organizationRoleSchema.index({ organizationId: 1, archivedAt: 1, sortOrder: 1 });

const OrganizationRole = mongoose.model(
  "OrganizationRole",
  organizationRoleSchema,
);

export default OrganizationRole;
