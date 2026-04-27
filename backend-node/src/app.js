import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import connectDB from "./config/db.js";
import { setupSocket } from "./config/socketHandler.js";
import { setIo } from "./presenters/conversationPresenter.js";

// Routes
import authRoutes from "./views/authView.js";
import userRoutes from "./views/userView.js";
import departmentRoutes from "./views/departmentView.js";
import projectRoutes from "./views/projectView.js";
import postRoutes from "./views/postView.js";
import commentRoutes from "./views/commentView.js";
import conversationRoutes from "./views/conversationView.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

connectDB();

const app = express();
const server = createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

setupSocket(io);
setIo(io);

app.use(cors());
app.use(express.json());

// Static file serving
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/conversations", conversationRoutes);

app.get("/", (req, res) => {
  res.send("WorkHub API is running");
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
