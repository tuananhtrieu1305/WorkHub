import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import connectDB from "./config/db.js";
import authRoutes from "./views/authView.js";
import folderRoutes from "./views/folderView.js";
import documentRoutes, { shareRouter } from "./views/documentView.js";
import taskRoutes, {
  departmentTaskRouter,
  projectTaskRouter,
} from "./views/taskView.js";
import notificationRoutes from "./views/notificationView.js";
import adminRoutes from "./views/adminView.js";
import meetingRoutes from "./views/meetingView.js";
import errorMiddleware from "./utils/errorMiddleware.js";

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

  app.use("/api/auth", authRoutes);
  app.use("/api/folders", folderRoutes);
  app.use("/api/documents", documentRoutes);
  app.use("/api/share", shareRouter);
  app.use("/api/tasks", taskRoutes);
  app.use("/api/projects", projectTaskRouter);
  app.use("/api/departments", departmentTaskRouter);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/meetings", meetingRoutes);

  app.get("/", (req, res) => {
    res.send("WorkHub API is running");
  });

  app.use(errorMiddleware);

  return app;
};

const app = createApp();

if (process.env.NODE_ENV !== "test") {
  connectDB();

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default app;
