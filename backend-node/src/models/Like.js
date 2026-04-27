import mongoose from "mongoose";

const likeSchema = new mongoose.Schema(
  {
    targetType: {
      type: String,
      enum: ["post", "comment"],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure one user can only like a target once
likeSchema.index({ targetType: 1, targetId: 1, userId: 1 }, { unique: true });
likeSchema.index({ targetId: 1, targetType: 1 });

const Like = mongoose.model("Like", likeSchema);
export default Like;
