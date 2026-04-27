import Comment from "../models/Comment.js";
import Post from "../models/Post.js";
import Like from "../models/Like.js";
import User from "../models/User.js";

// GET /comments/:id
export const getCommentById = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const author = await User.findById(comment.authorId).select("_id fullName email avatar");

    // Get users who liked this comment
    const likes = await Like.find({ targetType: "comment", targetId: comment._id });
    const likedByUsers = await Promise.all(
      likes.map(async (like) => {
        return await User.findById(like.userId).select("_id fullName email avatar");
      })
    );

    res.status(200).json({
      id: comment._id,
      postId: comment.postId,
      parentId: comment.parentId,
      author,
      content: comment.content,
      likesCount: comment.likesCount,
      likedBy: likedByUsers,
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
      return res.status(403).json({ message: "Not authorized to update this comment" });
    }

    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ message: "Comment content is required" });
    }

    comment.content = content;
    await comment.save();

    const author = await User.findById(comment.authorId).select("_id fullName email avatar");

    res.status(200).json({
      id: comment._id,
      postId: comment.postId,
      parentId: comment.parentId,
      author,
      content: comment.content,
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
      return res.status(403).json({ message: "Not authorized to delete this comment" });
    }

    // Count this comment + all its replies for decrementing post commentsCount
    const repliesCount = await Comment.countDocuments({ parentId: comment._id });
    const totalToRemove = 1 + repliesCount;

    // Delete replies
    const replyIds = await Comment.find({ parentId: comment._id }).select("_id");
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
        const author = await User.findById(reply.authorId).select(
          "_id fullName email avatar"
        );
        return {
          id: reply._id,
          postId: reply.postId,
          parentId: reply.parentId,
          author,
          content: reply.content,
          likesCount: reply.likesCount,
          createdAt: reply.createdAt,
          updatedAt: reply.updatedAt,
        };
      })
    );

    res.status(200).json({ content, totalElements, totalPages, currentPage: pageNum, pageSize });
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
    if (!content) {
      return res.status(400).json({ message: "Reply content is required" });
    }

    const reply = await Comment.create({
      postId: parentComment.postId,
      parentId: parentComment._id,
      authorId: req.user._id,
      content,
    });

    // Increment commentsCount on post
    await Post.findByIdAndUpdate(parentComment.postId, { $inc: { commentsCount: 1 } });

    const author = await User.findById(req.user._id).select("_id fullName email avatar");

    res.status(201).json({
      id: reply._id,
      postId: reply.postId,
      parentId: reply.parentId,
      author,
      content: reply.content,
      likesCount: reply.likesCount,
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

    let liked;

    if (existingLike) {
      await Like.findByIdAndDelete(existingLike._id);
      await Comment.findByIdAndUpdate(comment._id, { $inc: { likesCount: -1 } });
      liked = false;
    } else {
      await Like.create({
        targetType: "comment",
        targetId: comment._id,
        userId: req.user._id,
      });
      await Comment.findByIdAndUpdate(comment._id, { $inc: { likesCount: 1 } });
      liked = true;
    }

    const updatedComment = await Comment.findById(comment._id);

    res.status(200).json({
      liked,
      likesCount: updatedComment.likesCount,
    });
  } catch (error) {
    console.error("ToggleCommentLike error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid comment ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};
