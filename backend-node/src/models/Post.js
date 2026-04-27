import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["announcement", "post", "task_update", "document_share"],
      default: "post",
    },
    content: {
      type: String,
      required: [true, "Post content is required"],
    },
    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    tags: [String],
    targetAudience: {
      type: {
        type: String,
        enum: ["all", "department", "project", "custom"],
        default: "all",
      },
      departmentIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Department",
        },
      ],
      projectIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Project",
        },
      ],
      userIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
    },
    attachments: [
      {
        fileName: String,
        fileUrl: String,
        fileSize: Number,
        mimeType: String,
      },
    ],
    likesCount: {
      type: Number,
      default: 0,
    },
    commentsCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

postSchema.index({ authorId: 1, createdAt: -1 });
postSchema.index({ "targetAudience.type": 1 });

const Post = mongoose.model("Post", postSchema);
export default Post;
