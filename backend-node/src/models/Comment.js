import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      default: "",
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
          default: "image",
        },
      },
    ],
    likesCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

commentSchema.pre("validate", function validateCommentBody(next) {
  const hasContent = typeof this.content === "string" && this.content.trim().length > 0;
  const hasAttachments = Array.isArray(this.attachments) && this.attachments.length > 0;

  if (!hasContent && !hasAttachments) {
    this.invalidate("content", "Comment content or attachment is required");
  }

  next();
});

commentSchema.index({ postId: 1, createdAt: -1 });
commentSchema.index({ parentId: 1 });

const Comment = mongoose.model("Comment", commentSchema);
export default Comment;
