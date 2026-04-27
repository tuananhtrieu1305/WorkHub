import mongoose from "mongoose";

const { Schema } = mongoose;

const taskAssigneeSchema = new Schema(
  {
    taskId: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    removedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["assigned", "accepted", "declined", "completed"],
      default: "assigned",
      required: true,
    },
  },
  {
    timestamps: false,
  },
);

taskAssigneeSchema.index({ taskId: 1, userId: 1 }, { unique: true });
taskAssigneeSchema.index({ userId: 1, removedAt: 1, assignedAt: -1 });

const TaskAssignee = mongoose.model("TaskAssignee", taskAssigneeSchema);

export default TaskAssignee;
