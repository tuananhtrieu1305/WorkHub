/**
 * Create the default WorkHub organization and move legacy public data into it.
 *
 * Run: node src/scripts/migrateOrganizations.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ActivityLog from "../models/ActivityLog.js";
import Call from "../models/Call.js";
import Comment from "../models/Comment.js";
import Conversation from "../models/Conversation.js";
import Document from "../models/Document.js";
import Folder from "../models/Folder.js";
import Like from "../models/Like.js";
import Meeting from "../models/Meeting.js";
import Message from "../models/Message.js";
import Notification from "../models/Notification.js";
import Organization from "../models/Organization.js";
import OrganizationMember from "../models/OrganizationMember.js";
import Post from "../models/Post.js";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import User from "../models/User.js";
import {
  createInviteCode,
  createUniqueOrganizationSlug,
} from "../services/organizationService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const OWNER_EMAIL = "sonogamirinne310105@gmail.com";
const DEFAULT_ORGANIZATION_NAME = "WorkHub Community";
const LEGACY_SCOPE_VALUE = "department";
const LEGACY_SINGLE_SCOPE_FIELD = "departmentId";
const LEGACY_MULTI_SCOPE_FIELD = "departmentIds";

const bindLegacyData = async (organizationId) => {
  const organizationFilter = {
    $or: [{ organizationId: null }, { organizationId: { $exists: false } }],
  };

  const models = [
    ActivityLog,
    Call,
    Comment,
    Conversation,
    Document,
    Folder,
    Like,
    Meeting,
    Message,
    Notification,
    Post,
    Project,
    Task,
  ];

  const results = [];
  for (const Model of models) {
    const result = await Model.updateMany(organizationFilter, {
      $set: { organizationId },
    });
    results.push({
      model: Model.modelName,
      modifiedCount: result.modifiedCount || 0,
      matchedCount: result.matchedCount || 0,
    });
  }

  return results;
};

const buildExistsFilter = (fields) => ({
  $or: fields.map((field) => ({ [field]: { $exists: true } })),
});

const unsetLegacyScopeFields = async (Model, fields) => {
  const result = await Model.collection.updateMany(buildExistsFilter(fields), {
    $unset: Object.fromEntries(fields.map((field) => [field, ""])),
  });

  return {
    model: Model.modelName,
    fields,
    modifiedCount: result.modifiedCount || 0,
    matchedCount: result.matchedCount || 0,
  };
};

const normalizeLegacyVisibility = async (Model) => {
  const result = await Model.collection.updateMany(
    { "permissions.visibility": LEGACY_SCOPE_VALUE },
    { $set: { "permissions.visibility": "organization" } },
  );

  return {
    model: Model.modelName,
    modifiedCount: result.modifiedCount || 0,
    matchedCount: result.matchedCount || 0,
  };
};

const normalizeLegacyPostAudience = async () => {
  const scopedResult = await Post.collection.updateMany(
    { "targetAudience.type": LEGACY_SCOPE_VALUE },
    {
      $set: { "targetAudience.type": "all" },
      $unset: { [`targetAudience.${LEGACY_MULTI_SCOPE_FIELD}`]: "" },
    },
  );
  const fieldResult = await Post.collection.updateMany(
    { [`targetAudience.${LEGACY_MULTI_SCOPE_FIELD}`]: { $exists: true } },
    { $unset: { [`targetAudience.${LEGACY_MULTI_SCOPE_FIELD}`]: "" } },
  );

  return {
    model: Post.modelName,
    scopedMatchedCount: scopedResult.matchedCount || 0,
    scopedModifiedCount: scopedResult.modifiedCount || 0,
    fieldMatchedCount: fieldResult.matchedCount || 0,
    fieldModifiedCount: fieldResult.modifiedCount || 0,
  };
};

const dropLegacyScopeIndexes = async (Model) => {
  const dropped = [];
  const indexes = await Model.collection.indexes().catch(() => []);

  for (const index of indexes) {
    const keys = Object.keys(index.key || {});
    const hasLegacyScopeKey = keys.some((key) =>
      key.toLowerCase().includes(LEGACY_SCOPE_VALUE),
    );
    if (!hasLegacyScopeKey || index.name === "_id_") continue;

    await Model.collection.dropIndex(index.name);
    dropped.push(index.name);
  }

  return {
    model: Model.modelName,
    dropped,
  };
};

const cleanupLegacyOrganizationData = async () => {
  const scopeFieldResults = [];
  for (const [Model, fields] of [
    [ActivityLog, [LEGACY_SINGLE_SCOPE_FIELD]],
    [Document, [LEGACY_SINGLE_SCOPE_FIELD]],
    [Folder, [LEGACY_SINGLE_SCOPE_FIELD]],
    [Meeting, [LEGACY_SINGLE_SCOPE_FIELD]],
    [Project, [LEGACY_MULTI_SCOPE_FIELD]],
    [Task, [LEGACY_SINGLE_SCOPE_FIELD]],
    [User, [LEGACY_SINGLE_SCOPE_FIELD]],
  ]) {
    scopeFieldResults.push(await unsetLegacyScopeFields(Model, fields));
  }

  const visibilityResults = [];
  for (const Model of [Document, Folder]) {
    visibilityResults.push(await normalizeLegacyVisibility(Model));
  }

  const indexResults = [];
  for (const Model of [ActivityLog, Document, Folder, Meeting, Post, Project, Task, User]) {
    indexResults.push(await dropLegacyScopeIndexes(Model));
  }

  return {
    scopeFieldResults,
    visibilityResults,
    postAudienceResult: await normalizeLegacyPostAudience(),
    indexResults,
  };
};

const migrate = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const owner = await User.findOne({ email: OWNER_EMAIL });
  if (!owner) {
    throw new Error(`Owner user not found: ${OWNER_EMAIL}`);
  }

  let organization = await Organization.findOne({ ownerId: owner._id });
  if (!organization) {
    organization = await Organization.create({
      name: DEFAULT_ORGANIZATION_NAME,
      slug: await createUniqueOrganizationSlug(DEFAULT_ORGANIZATION_NAME),
      description:
        "Không gian mặc định chứa dữ liệu WorkHub public trước khi chuyển sang mô hình tổ chức.",
      ownerId: owner._id,
      createdBy: owner._id,
      inviteCode: createInviteCode(),
      accentColor: "#2563eb",
    });
  }

  const users = await User.find({});
  for (const user of users) {
    const role = user.email === OWNER_EMAIL ? "owner" : "member";
    await OrganizationMember.findOneAndUpdate(
      { organizationId: organization._id, userId: user._id },
      {
        $set: {
          role,
          status: "active",
          removedAt: null,
        },
        $setOnInsert: {
          joinedAt: new Date(),
          invitedBy: owner._id,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    if (!user.activeOrganizationId) {
      user.activeOrganizationId = organization._id;
      await user.save();
    }
  }

  owner.activeOrganizationId = organization._id;
  await owner.save();

  const dataResults = await bindLegacyData(organization._id);
  const cleanupResults = await cleanupLegacyOrganizationData();

  console.log(
    JSON.stringify(
      {
        organizationId: organization._id,
        organizationName: organization.name,
        ownerEmail: OWNER_EMAIL,
        members: users.length,
        dataResults,
        cleanupResults,
      },
      null,
      2,
    ),
  );
};

migrate()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
