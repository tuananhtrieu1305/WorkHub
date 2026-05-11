import Comment from "../models/Comment.js";
import Post from "../models/Post.js";
import Like from "../models/Like.js";
import User from "../models/User.js";
import {
  buildPostAttachments,
  hasPostBody,
  serializePostAttachments,
  uploadPostAttachments,
} from "./postPresenter.js";
import {
  getLikeReactionType,
  getReactionTogglePlan,
  isReactionTypeError,
} from "../services/reactionService.js";
import { getReactionDetailsForTarget } from "../services/reactionDetailsService.js";

const getUserReactionType = (like) => (like ? getLikeReactionType(like) : null);

let commentIoInstance = null;

export const setCommentIo = (io) => {
  commentIoInstance = io;
};

const buildPublicReactionPayload = ({ comment, reactionDetails }) => ({
  commentId: comment._id,
  postId: comment.postId,
  likesCount: comment.likesCount,
  reactionSummary: reactionDetails.reactionSummary,
  reactions: reactionDetails.reactions,
  likedBy: reactionDetails.reactions.map((reaction) => ({
    ...reaction.user,
    reactionType: reaction.reactionType,
    reactedAt: reaction.reactedAt,
  })),
});

// GET /comments/:id
export const getCommentById = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const [author, repliesCount, existingLike, reactionDetails] =
      await Promise.all([
        User.findById(comment.authorId).select("_id fullName email avatar"),
        Comment.countDocuments({ parentId: comment._id }),
        Like.findOne({
          targetType: "comment",
          targetId: comment._id,
          userId: req.user._id,
        }),
        getReactionDetailsForTarget("comment", comment._id),
      ]);

    res.status(200).json({
      id: comment._id,
      postId: comment.postId,
      parentId: comment.parentId,
      author,
      content: comment.content,
      attachments: serializePostAttachments(comment.attachments),
      likesCount: comment.likesCount,
      isLiked: !!existingLike,
      reactionType: getUserReactionType(existingLike),
      reactionSummary: reactionDetails.reactionSummary,
      reactions: reactionDetails.reactions,
      likedBy: reactionDetails.reactions.map((reaction) => ({
        ...reaction.user,
        reactionType: reaction.reactionType,
        reactedAt: reaction.reactedAt,
      })),
      repliesCount,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    });
  } catch (error) {
    console.error("GetCommentById error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid comment ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// PUT /comments/:id (author or admin)
export const updateComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    if (
      comment.authorId.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this comment" });
    }

    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ message: "Comment content is required" });
    }

    comment.content = content;
    await comment.save();

    const author = await User.findById(comment.authorId).select(
      "_id fullName email avatar",
    );

    res.status(200).json({
      id: comment._id,
      postId: comment.postId,
      parentId: comment.parentId,
      author,
      content: comment.content,
      attachments: serializePostAttachments(comment.attachments),
      likesCount: comment.likesCount,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    });
  } catch (error) {
    console.error("UpdateComment error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid comment ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// DELETE /comments/:id (author or admin)
export const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    if (
      comment.authorId.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this comment" });
    }

    // Count this comment + all its replies for decrementing post commentsCount
    const repliesCount = await Comment.countDocuments({
      parentId: comment._id,
    });
    const totalToRemove = 1 + repliesCount;

    // Delete replies
    const replyIds = await Comment.find({ parentId: comment._id }).select(
      "_id",
    );
    if (replyIds.length > 0) {
      await Like.deleteMany({
        targetType: "comment",
        targetId: { $in: replyIds.map((r) => r._id) },
      });
      await Comment.deleteMany({ parentId: comment._id });
    }

    // Delete likes for this comment
    await Like.deleteMany({ targetType: "comment", targetId: comment._id });

    // Delete the comment
    await Comment.findByIdAndDelete(comment._id);

    // Decrement commentsCount on post
    await Post.findByIdAndUpdate(comment.postId, {
      $inc: { commentsCount: -totalToRemove },
    });

    res.status(204).send();
  } catch (error) {
    console.error("DeleteComment error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid comment ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// GET /comments/:id/replies
export const getCommentReplies = async (req, res) => {
  try {
    const { page = 1, size = 10 } = req.query;

    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.max(1, parseInt(size));
    const skip = (pageNum - 1) * pageSize;

    const filter = { parentId: comment._id };

    const [replies, totalElements] = await Promise.all([
      Comment.find(filter).skip(skip).limit(pageSize).sort({ createdAt: 1 }),
      Comment.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalElements / pageSize);

    const content = await Promise.all(
      replies.map(async (reply) => {
        const [author, repliesCount, existingLike, reactionDetails] =
          await Promise.all([
            User.findById(reply.authorId).select("_id fullName email avatar"),
            Comment.countDocuments({ parentId: reply._id }),
            Like.findOne({
              targetType: "comment",
              targetId: reply._id,
              userId: req.user._id,
            }),
            getReactionDetailsForTarget("comment", reply._id),
          ]);
        return {
          id: reply._id,
          postId: reply.postId,
          parentId: reply.parentId,
          author,
          content: reply.content,
          attachments: serializePostAttachments(reply.attachments),
          likesCount: reply.likesCount,
          isLiked: !!existingLike,
          reactionType: getUserReactionType(existingLike),
          reactionSummary: reactionDetails.reactionSummary,
          reactions: reactionDetails.reactions,
          repliesCount,
          createdAt: reply.createdAt,
          updatedAt: reply.updatedAt,
        };
      }),
    );

    res
      .status(200)
      .json({
        content,
        totalElements,
        totalPages,
        currentPage: pageNum,
        pageSize,
      });
  } catch (error) {
    console.error("GetCommentReplies error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid comment ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// POST /comments/:id/replies
export const addCommentReply = async (req, res) => {
  try {
    const parentComment = await Comment.findById(req.params.id);
    if (!parentComment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const { content } = req.body;
    const attachments = await uploadPostAttachments(req.files || []);
    const replyContent =
      typeof content === "string" && content.trim().length > 0 ? content : "";

    if (!hasPostBody(replyContent, attachments)) {
      return res
        .status(400)
        .json({ message: "Reply content or image is required" });
    }

    const reply = await Comment.create({
      postId: parentComment.postId,
      parentId: parentComment._id,
      authorId: req.user._id,
      content: replyContent,
      attachments,
    });

    // Increment commentsCount on post
    await Post.findByIdAndUpdate(parentComment.postId, {
      $inc: { commentsCount: 1 },
    });

    const author = await User.findById(req.user._id).select(
      "_id fullName email avatar",
    );

    res.status(201).json({
      id: reply._id,
      postId: reply.postId,
      parentId: reply.parentId,
      author,
      content: reply.content,
      attachments: serializePostAttachments(reply.attachments),
      likesCount: reply.likesCount,
      isLiked: false,
      reactionType: null,
      reactionSummary: [],
      reactions: [],
      repliesCount: 0,
      createdAt: reply.createdAt,
      updatedAt: reply.updatedAt,
    });
  } catch (error) {
    console.error("AddCommentReply error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid comment ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// POST /comments/:id/likes (toggle)
export const toggleCommentLike = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const existingLike = await Like.findOne({
      targetType: "comment",
      targetId: comment._id,
      userId: req.user._id,
    });

    const plan = getReactionTogglePlan({
      existingReactionType: existingLike
        ? getLikeReactionType(existingLike)
        : null,
      requestedReactionType: req.body?.reactionType,
    });

    if (plan.action === "delete") {
      await Like.findByIdAndDelete(existingLike._id);
    } else if (plan.action === "update") {
      existingLike.reactionType = plan.reactionType;
      await existingLike.save();
    } else {
      await Like.create({
        targetType: "comment",
        targetId: comment._id,
        userId: req.user._id,
        reactionType: plan.reactionType,
      });
    }

    if (plan.countDelta !== 0) {
      await Comment.findByIdAndUpdate(comment._id, {
        $inc: { likesCount: plan.countDelta },
      });
    }

    const [updatedComment, reactionDetails] = await Promise.all([
      Comment.findById(comment._id),
      getReactionDetailsForTarget("comment", comment._id),
    ]);

    const publicReactionPayload = buildPublicReactionPayload({
      comment: updatedComment,
      reactionDetails,
    });

    commentIoInstance?.emit("comment_reaction_updated", publicReactionPayload);

    res.status(200).json({
      liked: plan.liked,
      likesCount: updatedComment.likesCount,
      reactionType: plan.reactionType,
      reactionSummary: publicReactionPayload.reactionSummary,
      reactions: publicReactionPayload.reactions,
      likedBy: publicReactionPayload.likedBy,
    });
  } catch (error) {
    console.error("ToggleCommentLike error:", error.message);
    if (isReactionTypeError(error)) {
      return res.status(400).json({ message: error.message });
    }
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid comment ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};
