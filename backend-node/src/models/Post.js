import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: ["announcement", "post", "task_update", "document_share"],
      default: "post",
    },
    content: {
      type: String,
      default: "",
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
        enum: ["all", "project", "custom"],
        default: "all",
      },
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
        storedFileName: String,
        fileUrl: String,
        downloadUrl: String,
        fileSize: Number,
        mimeType: String,
        fileType: {
          type: String,
          enum: ["image", "video", "file"],
          default: "file",
        },
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
postSchema.index({ organizationId: 1, createdAt: -1 });
postSchema.index({ "targetAudience.type": 1 });

const Post = mongoose.model("Post", postSchema);
export default Post;
