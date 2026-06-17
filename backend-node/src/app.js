import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { Server } from "socket.io";
import connectDB from "./config/db.js";
import { setupSocket } from "./config/socketHandler.js";
import {
  setIo,
  startReminderScheduler,
} from "./presenters/conversationPresenter.js";
import { setUserIo } from "./presenters/userPresenter.js";
import authRoutes from "./views/authView.js";
import userRoutes from "./views/userView.js";
import organizationRoutes from "./views/organizationView.js";
import projectRoutes from "./views/projectView.js";
import postRoutes from "./views/postView.js";
import commentRoutes from "./views/commentView.js";
import { setPostIo } from "./presenters/postPresenter.js";
import { setCommentIo } from "./presenters/commentPresenter.js";
import conversationRoutes from "./views/conversationView.js";
import folderRoutes from "./views/folderView.js";
import documentRoutes, { shareRouter } from "./views/documentView.js";
import taskRoutes, {
  projectTaskRouter,
} from "./views/taskView.js";
import notificationRoutes from "./views/notificationView.js";
import meetingRoutes from "./views/meetingView.js";
import { setMeetingIo, startMeetingReconciler } from "./presenters/meetingPresenter.js";
import callRoutes from "./views/callView.js";
import { setCallIo, startCallReconciler } from "./presenters/callPresenter.js";
import cloudflareWebhookRoutes from "./views/cloudflareWebhookView.js";
import { setMeetingAiSummaryIo } from "./services/meetingAiSummaryService.js";
import { setNotificationIo } from "./services/notificationService.js";
import errorMiddleware from "./utils/errorMiddleware.js";
import { legacyUploadsDir, uploadsDir } from "./config/uploadPaths.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "..");
const rootDir = path.resolve(backendDir, "..");

dotenv.config({
  path: [path.join(backendDir, ".env"), path.join(rootDir, ".env")],
});

export const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use("/uploads", express.static(uploadsDir));
  app.use("/uploads", express.static(legacyUploadsDir));

  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/organizations", organizationRoutes);
  app.use("/api/projects", projectRoutes);
  app.use("/api/projects", projectTaskRouter);
  app.use("/api/posts", postRoutes);
  app.use("/api/comments", commentRoutes);
  app.use("/api/conversations", conversationRoutes);
  app.use("/api/folders", folderRoutes);
  app.use("/api/documents", documentRoutes);
  app.use("/api/share", shareRouter);
  app.use("/api/tasks", taskRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/meetings", meetingRoutes);
  app.use("/api/calls", callRoutes);
  app.use("/api/webhooks/cloudflare", cloudflareWebhookRoutes);

  app.get("/", (req, res) => {
    res.send("WorkHub API is running");
  });

  app.use(errorMiddleware);

  return app;
};

const app = createApp();

if (process.env.NODE_ENV !== "test") {
  connectDB();

  const server = createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  setupSocket(io);
  setIo(io);
  startReminderScheduler();
  setPostIo(io);
  setCommentIo(io);
  setUserIo(io);
  setMeetingIo(io);
  setMeetingAiSummaryIo(io);
  startMeetingReconciler();
  setCallIo(io);
  startCallReconciler();
  setNotificationIo(io);

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
