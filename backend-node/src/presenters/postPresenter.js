import Post from "../models/Post.js";
import Comment from "../models/Comment.js";
import Like from "../models/Like.js";
import User from "../models/User.js";

// GET /posts
export const getPosts = async (req, res) => {
  try {
    const { type, page = 1, size = 10 } = req.query;

    const filter = {};
    if (type) filter.type = type;

    // Filter by target audience visibility
    const userId = req.user._id;
    const user = req.user;

    // User can see posts with: all, their department, their projects, or custom with their userId
    filter.$or = [
      { "targetAudience.type": "all" },
      { "targetAudience.departmentIds": user.departmentId },
      { "targetAudience.userIds": userId },
      { authorId: userId },
    ];

    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.max(1, parseInt(size));
    const skip = (pageNum - 1) * pageSize;

    const [posts, totalElements] = await Promise.all([
      Post.find(filter).skip(skip).limit(pageSize).sort({ createdAt: -1 }),
      Post.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalElements / pageSize);

    // Populate author info
    const content = await Promise.all(
      posts.map(async (post) => {
        const author = await User.findById(post.authorId).select(
          "_id fullName email avatar"
        );
        return {
          id: post._id,
          author,
          type: post.type,
          content: post.content,
          mentions: post.mentions,
          tags: post.tags,
          targetAudience: post.targetAudience,
          attachments: post.attachments,
          likesCount: post.likesCount,
          commentsCount: post.commentsCount,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
        };
      })
    );

    res.status(200).json({ content, totalElements, totalPages, currentPage: pageNum, pageSize });
  } catch (error) {
    console.error("GetPosts error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// POST /posts
export const createPost = async (req, res) => {
  try {
    const { type, content, mentions, tags, targetAudience } = req.body;

    if (!content) {
      return res.status(400).json({ message: "Post content is required" });
    }

    // Process uploaded attachments
    const attachments = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        attachments.push({
          fileName: file.originalname,
          fileUrl: `/uploads/attachments/${file.filename}`,
          fileSize: file.size,
          mimeType: file.mimetype,
        });
      });
    }

    // Parse targetAudience if it's a string (from multipart form)
    let parsedAudience = targetAudience;
    if (typeof targetAudience === "string") {
      try {
        parsedAudience = JSON.parse(targetAudience);
      } catch {
        parsedAudience = { type: "all" };
      }
    }

    // Parse mentions and tags if they are strings
    let parsedMentions = mentions;
    if (typeof mentions === "string") {
      try { parsedMentions = JSON.parse(mentions); } catch { parsedMentions = []; }
    }

    let parsedTags = tags;
    if (typeof tags === "string") {
      try { parsedTags = JSON.parse(tags); } catch { parsedTags = []; }
    }

    const post = await Post.create({
      authorId: req.user._id,
      type: type || "post",
      content,
      mentions: parsedMentions || [],
      tags: parsedTags || [],
      targetAudience: parsedAudience || { type: "all" },
      attachments,
    });

    const author = await User.findById(req.user._id).select("_id fullName email avatar");

    res.status(201).json({
      id: post._id,
      author,
      type: post.type,
      content: post.content,
      mentions: post.mentions,
      tags: post.tags,
      targetAudience: post.targetAudience,
      attachments: post.attachments,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    });
  } catch (error) {
    console.error("CreatePost error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// GET /posts/:id
export const getPostById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const author = await User.findById(post.authorId).select("_id fullName email avatar");

    res.status(200).json({
      id: post._id,
      author,
      type: post.type,
      content: post.content,
      mentions: post.mentions,
      tags: post.tags,
      targetAudience: post.targetAudience,
      attachments: post.attachments,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    });
  } catch (error) {
    console.error("GetPostById error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid post ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// PUT /posts/:id (author or admin)
export const updatePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Only author or admin can update
    if (
      post.authorId.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "Not authorized to update this post" });
    }

    const { content, mentions, tags, targetAudience } = req.body;

    if (content !== undefined) post.content = content;
    if (mentions !== undefined) post.mentions = mentions;
    if (tags !== undefined) post.tags = tags;
    if (targetAudience !== undefined) post.targetAudience = targetAudience;

    await post.save();

    const author = await User.findById(post.authorId).select("_id fullName email avatar");

    res.status(200).json({
      id: post._id,
      author,
      type: post.type,
      content: post.content,
      mentions: post.mentions,
      tags: post.tags,
      targetAudience: post.targetAudience,
      attachments: post.attachments,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    });
  } catch (error) {
    console.error("UpdatePost error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid post ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// DELETE /posts/:id (author or admin)
export const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (
      post.authorId.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "Not authorized to delete this post" });
    }

    // Delete related comments and likes
    await Comment.deleteMany({ postId: post._id });
    await Like.deleteMany({ targetType: "post", targetId: post._id });

    // Delete comment likes too
    const commentIds = await Comment.find({ postId: post._id }).select("_id");
    if (commentIds.length > 0) {
      await Like.deleteMany({
        targetType: "comment",
        targetId: { $in: commentIds.map((c) => c._id) },
      });
    }

    await Post.findByIdAndDelete(req.params.id);

    res.status(204).send();
  } catch (error) {
    console.error("DeletePost error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid post ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// GET /posts/:id/comments
export const getPostComments = async (req, res) => {
  try {
    const { page = 1, size = 10 } = req.query;

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.max(1, parseInt(size));
    const skip = (pageNum - 1) * pageSize;

    // Only get root comments (no parentId)
    const filter = { postId: post._id, parentId: null };

    const [comments, totalElements] = await Promise.all([
      Comment.find(filter).skip(skip).limit(pageSize).sort({ createdAt: -1 }),
      Comment.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalElements / pageSize);

    const content = await Promise.all(
      comments.map(async (comment) => {
        const author = await User.findById(comment.authorId).select(
          "_id fullName email avatar"
        );
        const repliesCount = await Comment.countDocuments({ parentId: comment._id });
        return {
          id: comment._id,
          postId: comment.postId,
          parentId: comment.parentId,
          author,
          content: comment.content,
          likesCount: comment.likesCount,
          repliesCount,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
        };
      })
    );

    res.status(200).json({ content, totalElements, totalPages, currentPage: pageNum, pageSize });
  } catch (error) {
    console.error("GetPostComments error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid post ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// POST /posts/:id/comments
export const addPostComment = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const { content, parentId } = req.body;

    if (!content) {
      return res.status(400).json({ message: "Comment content is required" });
    }

    // If parentId, verify parent comment exists and belongs to same post
    if (parentId) {
      const parentComment = await Comment.findById(parentId);
      if (!parentComment) {
        return res.status(404).json({ message: "Parent comment not found" });
      }
      if (parentComment.postId.toString() !== post._id.toString()) {
        return res.status(400).json({ message: "Parent comment does not belong to this post" });
      }
    }

    const comment = await Comment.create({
      postId: post._id,
      parentId: parentId || null,
      authorId: req.user._id,
      content,
    });

    // Increment comments count on post
    await Post.findByIdAndUpdate(post._id, { $inc: { commentsCount: 1 } });

    const author = await User.findById(req.user._id).select("_id fullName email avatar");

    res.status(201).json({
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
    console.error("AddPostComment error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// GET /posts/:id/likes
export const getPostLikes = async (req, res) => {
  try {
    const { page = 1, size = 10 } = req.query;

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.max(1, parseInt(size));
    const skip = (pageNum - 1) * pageSize;

    const filter = { targetType: "post", targetId: post._id };

    const [likes, totalElements] = await Promise.all([
      Like.find(filter).skip(skip).limit(pageSize).sort({ createdAt: -1 }),
      Like.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalElements / pageSize);

    const content = await Promise.all(
      likes.map(async (like) => {
        const user = await User.findById(like.userId).select(
          "_id fullName email avatar"
        );
        return user;
      })
    );

    res.status(200).json({ content, totalElements, totalPages, currentPage: pageNum, pageSize });
  } catch (error) {
    console.error("GetPostLikes error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid post ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// POST /posts/:id/likes (toggle)
export const togglePostLike = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const existingLike = await Like.findOne({
      targetType: "post",
      targetId: post._id,
      userId: req.user._id,
    });

    let liked;

    if (existingLike) {
      // Unlike
      await Like.findByIdAndDelete(existingLike._id);
      await Post.findByIdAndUpdate(post._id, { $inc: { likesCount: -1 } });
      liked = false;
    } else {
      // Like
      await Like.create({
        targetType: "post",
        targetId: post._id,
        userId: req.user._id,
      });
      await Post.findByIdAndUpdate(post._id, { $inc: { likesCount: 1 } });
      liked = true;
    }

    const updatedPost = await Post.findById(post._id);

    res.status(200).json({
      liked,
      likesCount: updatedPost.likesCount,
    });
  } catch (error) {
    console.error("TogglePostLike error:", error.message);
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid post ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};
