import mongoose from "mongoose";
import User from "../models/User.js";
import Task from "../models/Task.js";

const hasRegisteredModel = (modelName) => mongoose.modelNames().includes(modelName);

const countOptionalModel = async (modelName, query = {}) => {
  if (!hasRegisteredModel(modelName)) return 0;
  return mongoose.model(modelName).countDocuments(query);
};

export const getDashboardStats = async () => {
  const now = new Date();

  const [
    totalUsers,
    activeUsers,
    lockedUsers,
    totalProjects,
    openTasks,
    completedTasks,
    overdueTasks,
    activeCalls,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ status: "active" }),
    User.countDocuments({ status: "locked" }),
    countOptionalModel("Project", {}),
    Task.countDocuments({ deletedAt: null, status: { $ne: "done" } }),
    Task.countDocuments({ deletedAt: null, status: "done" }),
    Task.countDocuments({
      deletedAt: null,
      status: { $ne: "done" },
      endAt: { $lt: now },
    }),
    countOptionalModel("Call", { status: "active" }),
  ]);

  return {
    totalUsers,
    activeUsers,
    lockedUsers,
    totalProjects,
    openTasks,
    completedTasks,
    overdueTasks,
    activeCalls,
  };
};

export const getUserAnalytics = async ({ granularity = "day", from, to }) => {
  const format = granularity === "month" ? "%Y-%m" : "%Y-%m-%d";
  const match = {};

  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }

  const rows = await User.aggregate([
    ...(Object.keys(match).length > 0 ? [{ $match: match }] : []),
    {
      $group: {
        _id: {
          $dateToString: {
            format,
            date: "$createdAt",
          },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return {
    labels: rows.map((row) => row._id),
    data: rows.map((row) => row.count),
  };
};

export default {
  getDashboardStats,
  getUserAnalytics,
};
