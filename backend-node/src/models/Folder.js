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

const folderSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 160,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      default: null,
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
    permissionMode: {
      type: String,
      enum: ["inherit", "override"],
      default: "inherit",
    },
    permissions: {
      visibility: {
        type: String,
        enum: ["private", "department", "custom"],
        default: "private",
      },
      users: {
        type: [permissionUserSchema],
        default: [],
      },
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

folderSchema.index({ parentId: 1, departmentId: 1, deletedAt: 1 });
folderSchema.index({ ownerId: 1 });

const Folder = mongoose.model("Folder", folderSchema);

export default Folder;
