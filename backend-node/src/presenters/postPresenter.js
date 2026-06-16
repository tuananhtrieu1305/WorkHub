import Post from "../models/Post.js";
import Comment from "../models/Comment.js";
import Like from "../models/Like.js";
import User from "../models/User.js";
import OrganizationMember from "../models/OrganizationMember.js";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import { contentDisposition } from "../utils/fileResponse.js";
import {
  attachmentUploadsDir,
  legacyAttachmentUploadsDir,
} from "../config/uploadPaths.js";
import {
  getLikeReactionType,
  getReactionTogglePlan,
  isReactionTypeError,
} from "../services/reactionService.js";
import { getReactionDetailsForTarget } from "../services/reactionDetailsService.js";
import {
  buildR2AttachmentKey,
  getR2StorageService,
} from "../services/r2StorageService.js";
import { emptyPage, getRequestOrganizationId } from "../utils/organizationScope.js";
import { getOrganizationRoomName } from "../utils/conversationRealtime.js";
import {
  notifyCommentReply,
  notifyPostComment,
  notifyPostMention,
  notifyPostReaction,
} from "../services/feedNotificationService.js";

const POST_ATTACHMENT_R2_PREFIX = "attachments/posts/";
const POST_ACTIVITY_TYPES = new Set(["feeling", "activity"]);

let postIoInstance = null;

export const setPostIo = (io) => {
  postIoInstance = io;
};

const getAttachmentType = (mimeType = "") => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "file";
};

const getSingleString = (value, fallback = "") => {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return typeof value === "string" ? value : fallback;
};

const isPostR2AttachmentKey = (storageKey = "") =>
  storageKey.startsWith(POST_ATTACHMENT_R2_PREFIX);

const normalizeRangeHeader = (rangeHeader) => {
  if (typeof rangeHeader !== "string") return "";
  const trimmedRange = rangeHeader.trim();
  return /^bytes=\d*-\d*$/.test(trimmedRange) ? trimmedRange : "";
};

const normalizeDisposition = (value) =>
  value === "inline" ? "inline" : "attachment";

const sanitizeDownloadFileName = (fileName = "") => {
  const normalized = String(fileName || "attachment").trim() || "attachment";
  return path.basename(normalized).replace(/["\\\r\n]/g, "_");
};

const extractR2PostAttachmentKey = (fileUrl = "") => {
  if (!fileUrl || !String(fileUrl).startsWith("http")) return "";

  try {
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const bucketName = process.env.R2_BUCKET_NAME;
    const candidates = [
      decodeURIComponent(pathParts.join("/")),
      bucketName && pathParts[0] === bucketName
        ? decodeURIComponent(pathParts.slice(1).join("/"))
        : "",
    ];

    return candidates.find(isPostR2AttachmentKey) || "";
  } catch {
    return "";
  }
};

export const buildAttachmentDownloadUrl = (
  storedFileName,
  fileName = storedFileName,
  { disposition = "attachment" } = {},
) => {
  if (!storedFileName) return "";
  const params = new URLSearchParams({
    key: storedFileName,
    name: fileName || storedFileName,
    disposition: normalizeDisposition(disposition),
  });

  return `/api/posts/attachments/download?${params.toString()}`;
};

// Upload attachments to R2 and build attachment objects
export const uploadPostAttachments = async (files = []) => {
  if (!files || files.length === 0) return [];

  const storage = getR2StorageService();
  const attachments = [];

  for (const file of files) {
    const storageKey = buildR2AttachmentKey("posts", file.originalname);

    await storage.putObject({
      key: storageKey,
      body: file.buffer,
      contentType: file.mimetype,
      contentLength: file.size,
    });

    const fileName = file.originalname;

    attachments.push({
      fileName,
      storedFileName: storageKey,
      fileUrl: buildAttachmentDownloadUrl(storageKey, fileName, {
        disposition: "inline",
      }),
      downloadUrl: buildAttachmentDownloadUrl(storageKey, fileName),
      fileSize: file.size,
      mimeType: file.mimetype,
      fileType: getAttachmentType(file.mimetype),
    });
  }

  return attachments;
};

export const buildPostAttachments = (files = []) =>
  files.map((file) => ({
    fileName: file.originalname,
    storedFileName: file.filename,
    fileUrl: `/uploads/attachments/${file.filename}`,
    downloadUrl: buildAttachmentDownloadUrl(file.filename, file.originalname),
    fileSize: file.size,
    mimeType: file.mimetype,
    fileType: getAttachmentType(file.mimetype),
  }));

export const hasPostBody = (content, attachments = []) => {
  const hasContent = typeof content === "string" && content.trim().length > 0;
  return hasContent || attachments.length > 0;
};

const TARGET_AUDIENCE_TYPES = new Set(["all", "project", "custom"]);

const normalizeAudienceIdList = (ids) =>
  Array.isArray(ids) ? ids.filter(Boolean) : [];

const normalizeTargetAudience = (targetAudience = { type: "all" }) => {
  const audience =
    targetAudience && typeof targetAudience === "object"
      ? targetAudience
      : { type: "all" };

  const type = TARGET_AUDIENCE_TYPES.has(audience.type)
    ? audience.type
    : "all";

  if (type === "project") {
    return { type, projectIds: normalizeAudienceIdList(audience.projectIds) };
  }

  if (type === "custom") {
    return { type, userIds: normalizeAudienceIdList(audience.userIds) };
  }

  return { type: "all" };
};

const parseJsonBodyField = (value, fallback) => {
  if (typeof value !== "string") return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const toComparableId = (value) => {
  if (value == null) return "";
  return String(value._id || value.id || value);
};

const normalizeIdList = (ids) => {
  const values = Array.isArray(ids) ? ids : [];
  const uniqueIds = new Set();

  values.forEach((value) => {
    const id = toComparableId(value).trim();
    if (mongoose.isValidObjectId(id)) uniqueIds.add(id);
  });

  return Array.from(uniqueIds);
};

const normalizeSingleLineText = (value = "", maxLength = 80) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

export const normalizePostActivity = (activity) => {
  if (!activity || typeof activity !== "object" || Array.isArray(activity)) {
    return null;
  }

  const type = POST_ACTIVITY_TYPES.has(activity.type) ? activity.type : null;
  const label = normalizeSingleLineText(activity.label, 80);
  if (!type || !label) return null;

  return {
    type,
    emoji: normalizeSingleLineText(activity.emoji, 8),
    label,
  };
};

export const serializePostActivity = (activity) => {
  const normalized = normalizePostActivity(activity);
  return normalized;
};

const resolveMentionIdsForOrganization = async (mentionIds, organizationId) => {
  const normalizedIds = normalizeIdList(mentionIds);
  if (!organizationId || normalizedIds.length === 0) return [];

  const memberships = await OrganizationMember.find({
    organizationId,
    userId: { $in: normalizedIds },
    status: "active",
  }).select("userId");
  const allowedIds = new Set(memberships.map((item) => toComparableId(item.userId)));

  return normalizedIds.filter((id) => allowedIds.has(id));
};

const getMentionUsers = async (mentionIds = []) => {
  const normalizedIds = normalizeIdList(mentionIds);
  if (normalizedIds.length === 0) return [];

  const users = await User.find({ _id: { $in: normalizedIds } }).select(
    "_id fullName email avatar position",
  );
  const usersById = new Map(users.map((user) => [toComparableId(user._id), user]));

  return normalizedIds.map((id) => usersById.get(id)).filter(Boolean);
};

const emitToPostOrganization = (organizationId, eventName, payload) => {
  const organizationRoom = getOrganizationRoomName(organizationId);
  if (!organizationRoom) return;

  postIoInstance?.to(organizationRoom)?.emit(eventName, payload);
};

const emitPostReactionUpdated = ({ post, actorId, liked, reactionType }) => {
  emitToPostOrganization(post.organizationId, "post_reaction_updated", {
    postId: post._id,
    organizationId: post.organizationId,
    actorId,
    liked,
    likesCount: post.likesCount,
    reactionType,
  });
};

const emitPostCommentCountUpdated = ({
  post,
  commentId,
  parentId = null,
  delta,
}) => {
  emitToPostOrganization(post.organizationId, "post_comment_count_updated", {
    postId: post._id,
    organizationId: post.organizationId,
    commentId,
    parentId,
    delta,
    commentsCount: post.commentsCount,
  });
};

const runNotificationHook = async (promise, label) => {
  try {
    await promise;
  } catch (error) {
    console.error(`${label} notification hook failed:`, error.message);
  }
};

export const serializePostAttachments = (attachments = []) =>
  attachments.map((attachment) => {
    const plain =
      typeof attachment?.toObject === "function"
        ? attachment.toObject()
        : attachment;
    const storedFileName =
      plain.storedFileName ||
      extractR2PostAttachmentKey(plain.fileUrl) ||
      path.basename(plain.fileUrl || "");
    const fileName = plain.fileName || path.basename(storedFileName);
    const isR2Attachment = isPostR2AttachmentKey(storedFileName);
    const fileUrl = isR2Attachment
      ? buildAttachmentDownloadUrl(storedFileName, fileName, {
          disposition: "inline",
        })
      : plain.fileUrl;
    const downloadUrl = isR2Attachment
      ? buildAttachmentDownloadUrl(storedFileName, fileName)
      : plain.downloadUrl ||
        buildAttachmentDownloadUrl(storedFileName, fileName);

    return {
      ...plain,
      storedFileName,
      fileUrl,
      fileType: plain.fileType || getAttachmentType(plain.mimeType || ""),
      downloadUrl,
    };
  });

const getUserReactionType = (like) => (like ? getLikeReactionType(like) : null);

const findPostAttachmentPath = (storedFileName) => {
  const candidates = [
    path.join(attachmentUploadsDir, storedFileName),
    path.join(legacyAttachmentUploadsDir, storedFileName),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
};

// GET /posts
export const getPosts = async (req, res) => {
  try {
    const { type, page = 1, size = 10, anchorId } = req.query;
    const organizationId = getRequestOrganizationId(req);
    if (!organizationId) {
      return res.status(200).json(emptyPage(page, size));
    }

    const filter = { organizationId };
    if (type) filter.type = type;

    const userId = req.user._id;

    // Organization-scoped feed: non-project/custom posts are organization-wide.
    filter.$or = [
      { "targetAudience.type": { $nin: ["project", "custom"] } },
      { "targetAudience.userIds": userId },
      { authorId: userId },
    ];

    const pageSize = Math.max(1, parseInt(size));
    let pageNum = Math.max(1, parseInt(page));

    const normalizedAnchorId = toComparableId(anchorId).trim();
    if (mongoose.isValidObjectId(normalizedAnchorId)) {
      const anchorPost = await Post.findOne({
        ...filter,
        _id: normalizedAnchorId,
      }).select("_id createdAt");

      if (anchorPost) {
        const newerPostsCount = await Post.countDocuments({
          ...filter,
          createdAt: { $gt: anchorPost.createdAt },
        });
        pageNum = Math.floor(newerPostsCount / pageSize) + 1;
      }
    }

    const skip = (pageNum - 1) * pageSize;

    const [posts, totalElements] = await Promise.all([
      Post.find(filter).skip(skip).limit(pageSize).sort({ createdAt: -1 }),
      Post.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalElements / pageSize);

    // Populate author info
    const content = await Promise.all(
      posts.map(async (post) => {
        const [author, existingLike, mentionUsers] = await Promise.all([
          User.findById(post.authorId).select(
            "_id fullName email avatar position",
          ),
          Like.findOne({ targetType: "post", targetId: post._id, userId }),
          getMentionUsers(post.mentions),
        ]);
        return {
          id: post._id,
          author,
          type: post.type,
          content: post.content,
          mentions: mentionUsers,
          mentionIds: post.mentions,
          activity: serializePostActivity(post.activity),
          tags: post.tags,
          targetAudience: normalizeTargetAudience(post.targetAudience),
          attachments: serializePostAttachments(post.attachments),
          likesCount: post.likesCount,
          commentsCount: post.commentsCount,
          isLiked: !!existingLike,
          reactionType: getUserReactionType(existingLike),
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
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
    console.error("GetPosts error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// POST /posts
export const createPost = async (req, res) => {
  try {
    const { type, content, mentions, tags, targetAudience, activity } = req.body;
    const organizationId = getRequestOrganizationId(req);
    if (!organizationId) {
      return res.status(409).json({
        code: "NO_ACTIVE_ORGANIZATION",
        message: "Please create or join an organization before posting",
      });
    }

    // Upload attachments to R2
    const attachments = await uploadPostAttachments(req.files || []);
    const postContent =
      typeof content === "string" && content.trim().length > 0 ? content : "";

    const parsedAudience = parseJsonBodyField(targetAudience, { type: "all" });
    const parsedMentions = parseJsonBodyField(mentions, []);
    const parsedTags = parseJsonBodyField(tags, []);
    const normalizedActivity = normalizePostActivity(
      parseJsonBodyField(activity, null),
    );
    const scopedMentionIds = await resolveMentionIdsForOrganization(
      parsedMentions,
      organizationId,
    );

    if (
      !hasPostBody(postContent, attachments) &&
      scopedMentionIds.length === 0 &&
      !normalizedActivity
    ) {
      return res
        .status(400)
        .json({ message: "Post content, attachment, tag, or activity is required" });
    }

    const post = await Post.create({
      organizationId,
      authorId: req.user._id,
      type: type || "post",
      content: postContent,
      mentions: scopedMentionIds,
      activity: normalizedActivity,
      tags: parsedTags || [],
      targetAudience: normalizeTargetAudience(parsedAudience || { type: "all" }),
      attachments,
    });

    const author = await User.findById(req.user._id).select(
      "_id fullName email avatar position",
    );
    const mentionUsers = await getMentionUsers(post.mentions);

    await runNotificationHook(
      notifyPostMention({ post, actor: req.user }),
      "Post mention",
    );

    res.status(201).json({
      id: post._id,
      author,
      type: post.type,
      content: post.content,
      mentions: mentionUsers,
      mentionIds: post.mentions,
      activity: serializePostActivity(post.activity),
      tags: post.tags,
      targetAudience: normalizeTargetAudience(post.targetAudience),
      attachments: serializePostAttachments(post.attachments),
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
    if (
      !post ||
      String(post.organizationId || "") !== String(getRequestOrganizationId(req))
    ) {
      return res.status(404).json({ message: "Post not found" });
    }

    const [author, existingLike, mentionUsers] = await Promise.all([
      User.findById(post.authorId).select("_id fullName email avatar position"),
      Like.findOne({
        targetType: "post",
        targetId: post._id,
        userId: req.user._id,
      }),
      getMentionUsers(post.mentions),
    ]);

    res.status(200).json({
      id: post._id,
      author,
      type: post.type,
      content: post.content,
      mentions: mentionUsers,
      mentionIds: post.mentions,
      activity: serializePostActivity(post.activity),
      tags: post.tags,
      targetAudience: normalizeTargetAudience(post.targetAudience),
      attachments: serializePostAttachments(post.attachments),
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      isLiked: !!existingLike,
      reactionType: getUserReactionType(existingLike),
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
    if (
      !post ||
      String(post.organizationId || "") !== String(getRequestOrganizationId(req))
    ) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Only author or admin can update
    if (
      post.authorId.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to update this post" });
    }

    const { content, mentions, tags, targetAudience, activity } = req.body;

    if (content !== undefined) post.content = content;
    if (mentions !== undefined) {
      post.mentions = await resolveMentionIdsForOrganization(
        parseJsonBodyField(mentions, []),
        post.organizationId,
      );
    }
    if (activity !== undefined) {
      post.activity = normalizePostActivity(parseJsonBodyField(activity, null));
    }
    if (tags !== undefined) post.tags = parseJsonBodyField(tags, []);
    if (targetAudience !== undefined) {
      post.targetAudience = normalizeTargetAudience(
        parseJsonBodyField(targetAudience, { type: "all" }),
      );
    }

    await post.save();

    const author = await User.findById(post.authorId).select(
      "_id fullName email avatar position",
    );
    const mentionUsers = await getMentionUsers(post.mentions);

    res.status(200).json({
      id: post._id,
      author,
      type: post.type,
      content: post.content,
      mentions: mentionUsers,
      mentionIds: post.mentions,
      activity: serializePostActivity(post.activity),
      tags: post.tags,
      targetAudience: normalizeTargetAudience(post.targetAudience),
      attachments: serializePostAttachments(post.attachments),
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
    if (
      !post ||
      String(post.organizationId || "") !== String(getRequestOrganizationId(req))
    ) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (
      post.authorId.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this post" });
    }

    // Delete related comments and likes
    const commentIds = await Comment.find({ postId: post._id }).select("_id");
    await Comment.deleteMany({ postId: post._id });
    await Like.deleteMany({ targetType: "post", targetId: post._id });

    // Delete comment likes too
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

// GET /posts/attachments/:filename/download
export const downloadPostAttachment = async (req, res) => {
  try {
    const requestedKey =
      getSingleString(req.query.key).trim() ||
      getSingleString(req.params.filename).trim();
    if (!requestedKey) {
      return res.status(400).json({ message: "Attachment key is required" });
    }

    const isR2Attachment = isPostR2AttachmentKey(requestedKey);
    const storedFileName = isR2Attachment
      ? requestedKey
      : path.basename(requestedKey);
    if (!storedFileName) {
      return res
        .status(400)
        .json({ message: "Attachment filename is required" });
    }

    if (requestedKey.includes("/") && !isR2Attachment) {
      return res.status(400).json({ message: "Invalid attachment key" });
    }

    const requestedName = sanitizeDownloadFileName(
      getSingleString(req.query.name).trim() || path.basename(storedFileName),
    );
    const dispositionType = normalizeDisposition(req.query.disposition);

    if (isR2Attachment) {
      const storage = getR2StorageService();
      try {
        const range = normalizeRangeHeader(req.headers.range);
        const object = await storage.getObjectStream({
          key: storedFileName,
          range,
        });
        const statusCode = range && object.contentRange ? 206 : 200;
        res.status(statusCode);
        res.setHeader(
          "Content-Type",
          object.contentType || "application/octet-stream",
        );
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader(
          "Content-Disposition",
          contentDisposition(dispositionType, requestedName),
        );
        res.setHeader("Cache-Control", "private, max-age=3600");
        if (object.contentLength !== undefined) {
          res.setHeader("Content-Length", String(object.contentLength));
        }
        if (object.contentRange) {
          res.setHeader("Content-Range", object.contentRange);
        }
        await pipeline(object.body, res);
      } catch (error) {
        if (error.code !== 'ECONNRESET' && error.message !== 'aborted') {
          console.error("Error getting object from R2:", error);
        }
        if (res.headersSent) {
          res.end();
          return;
        }
        return res.status(404).json({ message: "Attachment not found" });
      }
    } else {
      const filePath = findPostAttachmentPath(storedFileName);
      if (!filePath) {
        return res.status(404).json({ message: "Attachment not found" });
      }
      if (dispositionType === "inline") {
        res.setHeader(
          "Content-Disposition",
          contentDisposition("inline", requestedName),
        );
        return res.sendFile(filePath);
      }
      return res.download(filePath, requestedName);
    }
  } catch (error) {
    console.error("DownloadPostAttachment error:", error.message);
    return res.status(500).json({ message: "Server error, please try again" });
  }
};

// GET /posts/:id/comments
export const getPostComments = async (req, res) => {
  try {
    const { page = 1, size = 10 } = req.query;

    const post = await Post.findById(req.params.id);
    if (
      !post ||
      String(post.organizationId || "") !== String(getRequestOrganizationId(req))
    ) {
      return res.status(404).json({ message: "Post not found" });
    }

    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.max(1, parseInt(size));
    const skip = (pageNum - 1) * pageSize;

    // Only get root comments (no parentId)
    const filter = {
      organizationId: getRequestOrganizationId(req),
      postId: post._id,
      parentId: null,
    };

    const [comments, totalElements, totalCommentsCount] = await Promise.all([
      Comment.find(filter).skip(skip).limit(pageSize).sort({ createdAt: -1 }),
      Comment.countDocuments(filter),
      Comment.countDocuments({
        organizationId: getRequestOrganizationId(req),
        postId: post._id,
      }),
    ]);

    const totalPages = Math.ceil(totalElements / pageSize);
    if (post.commentsCount !== totalCommentsCount) {
      Post.findByIdAndUpdate(post._id, {
        $set: { commentsCount: totalCommentsCount },
      }).catch((error) => {
        console.error("Sync post commentsCount error:", error.message);
      });
    }

    const content = await Promise.all(
      comments.map(async (comment) => {
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
        return {
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
          repliesCount,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
        };
      }),
    );

    res
      .status(200)
      .json({
        content,
        totalElements,
        totalCommentsCount,
        totalPages,
        currentPage: pageNum,
        pageSize,
      });
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
    if (
      !post ||
      String(post.organizationId || "") !== String(getRequestOrganizationId(req))
    ) {
      return res.status(404).json({ message: "Post not found" });
    }

    const { content, parentId } = req.body;
    const attachments = await uploadPostAttachments(req.files || []);
    const commentContent =
      typeof content === "string" && content.trim().length > 0 ? content : "";

    if (!hasPostBody(commentContent, attachments)) {
      return res
        .status(400)
        .json({ message: "Comment content or image is required" });
    }

    // If parentId, verify parent comment exists and belongs to same post
    let parentComment = null;
    if (parentId) {
      parentComment = await Comment.findById(parentId);
      if (!parentComment) {
        return res.status(404).json({ message: "Parent comment not found" });
      }
      if (parentComment.postId.toString() !== post._id.toString()) {
        return res
          .status(400)
          .json({ message: "Parent comment does not belong to this post" });
      }
    }

    const comment = await Comment.create({
      organizationId: post.organizationId,
      postId: post._id,
      parentId: parentId || null,
      authorId: req.user._id,
      content: commentContent,
      attachments,
    });

    // Increment comments count on post
    const updatedPost = await Post.findByIdAndUpdate(
      post._id,
      { $inc: { commentsCount: 1 } },
      { new: true },
    );

    const author = await User.findById(req.user._id).select(
      "_id fullName email avatar",
    );

    await runNotificationHook(
      parentComment
        ? notifyCommentReply({
            post,
            parentComment,
            reply: comment,
            actor: req.user,
          })
        : notifyPostComment({ post, comment, actor: req.user }),
      parentComment ? "Comment reply" : "Post comment",
    );

    emitPostCommentCountUpdated({
      post: updatedPost,
      commentId: comment._id,
      parentId: comment.parentId,
      delta: 1,
    });

    res.status(201).json({
      id: comment._id,
      postId: comment.postId,
      parentId: comment.parentId,
      author,
      content: comment.content,
      attachments: serializePostAttachments(comment.attachments),
      likesCount: comment.likesCount,
      isLiked: false,
      reactionType: null,
      reactionSummary: [],
      reactions: [],
      repliesCount: 0,
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
    if (
      !post ||
      String(post.organizationId || "") !== String(getRequestOrganizationId(req))
    ) {
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
          "_id fullName email avatar",
        );
        return user
          ? {
              ...user.toObject(),
              reactionType: getLikeReactionType(like),
            }
          : null;
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
    if (
      !post ||
      String(post.organizationId || "") !== String(getRequestOrganizationId(req))
    ) {
      return res.status(404).json({ message: "Post not found" });
    }

    const existingLike = await Like.findOne({
      targetType: "post",
      targetId: post._id,
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
        targetType: "post",
        targetId: post._id,
        organizationId: post.organizationId,
        userId: req.user._id,
        reactionType: plan.reactionType,
      });
    }

    if (plan.countDelta !== 0) {
      await Post.findByIdAndUpdate(post._id, {
        $inc: { likesCount: plan.countDelta },
      });
    }

    const updatedPost = await Post.findById(post._id);

    if (plan.action === "create") {
      await runNotificationHook(
        notifyPostReaction({
          post,
          actor: req.user,
          reactionType: plan.reactionType,
        }),
        "Post reaction",
      );
    }

    emitPostReactionUpdated({
      post: updatedPost,
      actorId: req.user._id,
      liked: plan.liked,
      reactionType: plan.reactionType,
    });

    res.status(200).json({
      liked: plan.liked,
      likesCount: updatedPost.likesCount,
      reactionType: plan.reactionType,
    });
  } catch (error) {
    console.error("TogglePostLike error:", error.message);
    if (isReactionTypeError(error)) {
      return res.status(400).json({ message: error.message });
    }
    if (error.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid post ID" });
    }
    res.status(500).json({ message: "Server error, please try again" });
  }
};
