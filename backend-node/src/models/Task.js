import mongoose from "mongoose";

const { Schema } = mongoose;

const taskSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 255,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["todo", "in_progress", "blocked", "review", "done", "cancelled"],
      default: "todo",
      required: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      required: true,
    },
    startAt: {
      type: Date,
      default: null,
    },
    endAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    archivedAt: {
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

taskSchema.index({ projectId: 1, status: 1, endAt: 1 });
taskSchema.index({ departmentId: 1, status: 1, endAt: 1 });
taskSchema.index({ deletedAt: 1, projectId: 1, status: 1, endAt: 1 });
taskSchema.index({ deletedAt: 1, departmentId: 1, status: 1, endAt: 1 });
taskSchema.index({ deletedAt: 1, createdBy: 1, createdAt: -1 });
taskSchema.index({ deletedAt: 1, ownerId: 1, createdAt: -1 });
taskSchema.index({ createdBy: 1, createdAt: -1 });
taskSchema.index({ ownerId: 1, createdAt: -1 });
taskSchema.index({ status: 1, endAt: 1 });
taskSchema.index({ deletedAt: 1 });

const Task = mongoose.model("Task", taskSchema);

export default Task;
