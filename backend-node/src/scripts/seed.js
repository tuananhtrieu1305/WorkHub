/**
 * Seed Script - Tạo dữ liệu mẫu cho WorkHub
 * Chạy: node src/scripts/seed.js
 *
 * Tạo: 5 Users, 3 Departments, 5 Projects, 5 Posts, Comments,
 *       Likes, Conversations, Messages, Tasks
 * Tất cả data có liên hệ logic chặt chẽ giữa các bảng.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import User from "../models/User.js";
import Department from "../models/Department.js";
import Project from "../models/Project.js";
import Post from "../models/Post.js";
import Comment from "../models/Comment.js";
import Like from "../models/Like.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Task from "../models/Task.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // ─── CLEANUP ───
    console.log("🗑️  Cleaning existing seed data...");
    await Promise.all([
      User.deleteMany({ email: { $regex: /^seed/ } }),
      Department.deleteMany({}),
      Project.deleteMany({}),
      Post.deleteMany({}),
      Comment.deleteMany({}),
      Like.deleteMany({}),
      Conversation.deleteMany({}),
      Message.deleteMany({}),
      Task.deleteMany({}),
    ]);

    // ═══════════════════════════════════════
    // 1. USERS (5 users + 1 admin)
    // ═══════════════════════════════════════
    console.log("👤 Creating users...");
    const usersData = [
      { fullName: "Nguyễn Văn An", email: "seed.admin@workhub.vn", password: "123456", role: "admin", phone: "0901000001", position: "CTO", isVerified: true },
      { fullName: "Trần Thị Bình", email: "seed.binh@workhub.vn", password: "123456", role: "user", phone: "0901000002", position: "Frontend Lead", isVerified: true },
      { fullName: "Lê Hoàng Cường", email: "seed.cuong@workhub.vn", password: "123456", role: "user", phone: "0901000003", position: "Backend Developer", isVerified: true },
      { fullName: "Phạm Minh Dũng", email: "seed.dung@workhub.vn", password: "123456", role: "user", phone: "0901000004", position: "UI/UX Designer", isVerified: true },
      { fullName: "Hoàng Thị Em", email: "seed.em@workhub.vn", password: "123456", role: "user", phone: "0901000005", position: "QA Engineer", isVerified: true },
    ];

    const users = await User.create(usersData);
    const [admin, binh, cuong, dung, em] = users;
    console.log(`   ✓ Created ${users.length} users`);

    // ═══════════════════════════════════════
    // 2. DEPARTMENTS (3 departments)
    // ═══════════════════════════════════════
    console.log("🏢 Creating departments...");
    const deptEngineering = await Department.create({
      name: "Phòng Kỹ thuật",
      description: "Phát triển phần mềm và hạ tầng hệ thống",
      managerId: admin._id,
    });

    const deptDesign = await Department.create({
      name: "Phòng Thiết kế",
      description: "UI/UX Design và Brand Identity",
      managerId: binh._id,
    });

    const deptQA = await Department.create({
      name: "Phòng QA",
      description: "Kiểm thử và đảm bảo chất lượng sản phẩm",
      managerId: em._id,
      parentId: deptEngineering._id,
    });

    // Cập nhật departmentId cho users
    await User.findByIdAndUpdate(admin._id, { departmentId: deptEngineering._id });
    await User.findByIdAndUpdate(binh._id, { departmentId: deptEngineering._id });
    await User.findByIdAndUpdate(cuong._id, { departmentId: deptEngineering._id });
    await User.findByIdAndUpdate(dung._id, { departmentId: deptDesign._id });
    await User.findByIdAndUpdate(em._id, { departmentId: deptQA._id });

    console.log("   ✓ Created 3 departments (Engineering > QA, Design)");

    // ═══════════════════════════════════════
    // 3. PROJECTS (5 projects)
    // ═══════════════════════════════════════
    console.log("📁 Creating projects...");
    const projectsData = [
      {
        name: "WorkHub Platform",
        description: "Nền tảng cộng tác nội bộ doanh nghiệp",
        status: "active",
        createdBy: admin._id,
        departmentIds: [deptEngineering._id],
        members: [
          { userId: admin._id, role: "lead" },
          { userId: binh._id, role: "member" },
          { userId: cuong._id, role: "member" },
        ],
        startDate: new Date("2026-01-15"),
        endDate: new Date("2026-06-30"),
      },
      {
        name: "Mobile App v2",
        description: "Phiên bản mobile với React Native",
        status: "active",
        createdBy: binh._id,
        departmentIds: [deptEngineering._id, deptDesign._id],
        members: [
          { userId: binh._id, role: "lead" },
          { userId: dung._id, role: "member" },
          { userId: cuong._id, role: "contributor" },
        ],
        startDate: new Date("2026-03-01"),
        endDate: new Date("2026-09-30"),
      },
      {
        name: "Design System",
        description: "Hệ thống thiết kế thống nhất cho tất cả sản phẩm",
        status: "active",
        createdBy: dung._id,
        departmentIds: [deptDesign._id],
        members: [
          { userId: dung._id, role: "lead" },
          { userId: binh._id, role: "contributor" },
        ],
        startDate: new Date("2026-02-01"),
      },
      {
        name: "API Gateway Migration",
        description: "Chuyển đổi hệ thống API sang kiến trúc microservices",
        status: "active",
        createdBy: cuong._id,
        departmentIds: [deptEngineering._id],
        members: [
          { userId: cuong._id, role: "lead" },
          { userId: admin._id, role: "member" },
        ],
        startDate: new Date("2026-04-01"),
        endDate: new Date("2026-08-15"),
      },
      {
        name: "Automation Testing Suite",
        description: "Bộ test tự động cho toàn bộ hệ thống",
        status: "completed",
        createdBy: em._id,
        departmentIds: [deptQA._id],
        members: [
          { userId: em._id, role: "lead" },
          { userId: cuong._id, role: "contributor" },
        ],
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-03-31"),
      },
    ];

    const projects = await Project.create(projectsData);
    console.log(`   ✓ Created ${projects.length} projects`);

    // ═══════════════════════════════════════
    // 4. TASKS (5 tasks across projects)
    // ═══════════════════════════════════════
    console.log("✅ Creating tasks...");
    const tasksData = [
      {
        title: "Setup CI/CD Pipeline",
        description: "Cấu hình GitHub Actions cho auto deploy",
        projectId: projects[0]._id,
        departmentId: deptEngineering._id,
        status: "done",
        createdBy: admin._id,
        assignees: [cuong._id],
        checklist: [
          { content: "Setup GitHub Actions workflow", isCompleted: true },
          { content: "Configure Docker build", isCompleted: true },
          { content: "Add staging deploy step", isCompleted: true },
        ],
        endAt: new Date("2026-02-28"),
      },
      {
        title: "Implement Chat realtime",
        description: "Tích hợp Socket.IO cho tính năng nhắn tin",
        projectId: projects[0]._id,
        departmentId: deptEngineering._id,
        status: "in_progress",
        createdBy: admin._id,
        assignees: [cuong._id, binh._id],
        checklist: [
          { content: "Setup Socket.IO server", isCompleted: true },
          { content: "Create Message model", isCompleted: true },
          { content: "Implement conversation UI", isCompleted: false },
          { content: "Add typing indicator", isCompleted: false },
        ],
        endAt: new Date("2026-05-15"),
      },
      {
        title: "Thiết kế màn hình Dashboard",
        description: "Wireframe + Mockup cho trang Dashboard chính",
        projectId: projects[1]._id,
        departmentId: deptDesign._id,
        status: "in_progress",
        createdBy: dung._id,
        assignees: [dung._id],
        checklist: [
          { content: "Research competitor dashboards", isCompleted: true },
          { content: "Create wireframe", isCompleted: true },
          { content: "Design hi-fi mockup", isCompleted: false },
        ],
        endAt: new Date("2026-05-01"),
      },
      {
        title: "Viết API documentation",
        description: "Document toàn bộ REST API endpoints bằng Swagger",
        projectId: projects[3]._id,
        departmentId: deptEngineering._id,
        status: "todo",
        createdBy: cuong._id,
        assignees: [cuong._id, admin._id],
        checklist: [
          { content: "Setup Swagger UI", isCompleted: false },
          { content: "Document auth endpoints", isCompleted: false },
          { content: "Document CRUD endpoints", isCompleted: false },
        ],
        endAt: new Date("2026-06-01"),
      },
      {
        title: "Viết E2E test cho flow đăng nhập",
        description: "Playwright tests cho login, register, forgot password",
        projectId: projects[4]._id,
        departmentId: deptQA._id,
        status: "done",
        createdBy: em._id,
        assignees: [em._id],
        checklist: [
          { content: "Setup Playwright", isCompleted: true },
          { content: "Test login flow", isCompleted: true },
          { content: "Test register flow", isCompleted: true },
          { content: "Test forgot password", isCompleted: true },
        ],
        endAt: new Date("2026-03-15"),
      },
    ];

    const tasks = await Task.create(tasksData);
    console.log(`   ✓ Created ${tasks.length} tasks`);

    // ═══════════════════════════════════════
    // 5. POSTS (5 posts from different users)
    // ═══════════════════════════════════════
    console.log("📝 Creating posts...");
    const postsData = [
      {
        authorId: admin._id,
        type: "announcement",
        content: "🎉 Chào mừng tất cả mọi người đến với WorkHub! Hãy cập nhật thông tin cá nhân và bắt đầu kết nối với đồng nghiệp nhé.",
        tags: ["welcome", "announcement"],
        targetAudience: { type: "all" },
        likesCount: 4,
        commentsCount: 3,
      },
      {
        authorId: binh._id,
        type: "post",
        content: "Vừa hoàn thành redesign trang Dashboard. Mọi người review giúp mình nhé! 🎨 Figma link: https://figma.com/file/example",
        mentions: [dung._id, admin._id],
        tags: ["design", "review"],
        targetAudience: { type: "department", departmentIds: [deptEngineering._id, deptDesign._id] },
        likesCount: 3,
        commentsCount: 2,
      },
      {
        authorId: cuong._id,
        type: "task_update",
        content: "API Gateway migration đã hoàn thành 60%. Dự kiến xong trước deadline 2 tuần. Performance tăng 35% so với monolith cũ 🚀",
        tags: ["backend", "progress"],
        targetAudience: { type: "department", departmentIds: [deptEngineering._id] },
        likesCount: 2,
        commentsCount: 1,
      },
      {
        authorId: dung._id,
        type: "document_share",
        content: "Mình vừa update bộ Design Tokens mới cho Q2. File đính kèm bên dưới, mọi người sync lại nhé 📄",
        tags: ["design-system", "tokens"],
        targetAudience: { type: "all" },
        attachments: [
          { fileName: "design-tokens-q2.pdf", fileUrl: "/uploads/attachments/design-tokens-q2.pdf", fileSize: 2048000, mimeType: "application/pdf" },
        ],
        likesCount: 5,
        commentsCount: 2,
      },
      {
        authorId: em._id,
        type: "post",
        content: "🐛 Bug report tuần này: Tổng 12 bugs found, 10 resolved, 2 pending. Chi tiết trong Jira board. Great job team QA! 💪",
        tags: ["qa", "weekly-report"],
        targetAudience: { type: "department", departmentIds: [deptQA._id, deptEngineering._id] },
        likesCount: 3,
        commentsCount: 1,
      },
    ];

    const posts = await Post.create(postsData);
    console.log(`   ✓ Created ${posts.length} posts`);

    // ═══════════════════════════════════════
    // 6. COMMENTS (với nested replies)
    // ═══════════════════════════════════════
    console.log("💬 Creating comments...");

    // Comments cho post[0] (announcement)
    const c1 = await Comment.create({ postId: posts[0]._id, authorId: binh._id, content: "Chào mọi người! Rất vui được làm việc cùng team 🙌" });
    const c2 = await Comment.create({ postId: posts[0]._id, authorId: cuong._id, content: "WorkHub nhìn xịn quá, ai dev vậy? 😄" });
    const c2Reply = await Comment.create({ postId: posts[0]._id, parentId: c2._id, authorId: admin._id, content: "Team mình tự dev đó, cảm ơn bạn! 😊" });

    // Comments cho post[1] (dashboard review)
    const c3 = await Comment.create({ postId: posts[1]._id, authorId: dung._id, content: "Mình thấy color palette cần điều chỉnh lại theo brand guide nhé" });
    const c4 = await Comment.create({ postId: posts[1]._id, authorId: admin._id, content: "Nhìn đẹp lắm! Ship thôi 🚀" });

    // Comments cho post[2]
    const c5 = await Comment.create({ postId: posts[2]._id, authorId: admin._id, content: "Excellent progress! Keep it up Cường 💪" });

    // Comments cho post[3]
    const c6 = await Comment.create({ postId: posts[3]._id, authorId: binh._id, content: "Đã sync, màu sắc mới nhìn pro hơn hẳn!" });
    const c7 = await Comment.create({ postId: posts[3]._id, authorId: em._id, content: "Cập nhật rồi, cảm ơn Dũng nhé" });

    // Comment cho post[4]
    const c8 = await Comment.create({ postId: posts[4]._id, authorId: cuong._id, content: "2 bugs pending là gì vậy Em? Mình fix luôn" });

    console.log("   ✓ Created 9 comments (incl. 1 reply)");

    // ═══════════════════════════════════════
    // 7. LIKES
    // ═══════════════════════════════════════
    console.log("❤️  Creating likes...");
    const likesData = [
      // Post[0] likes (4 likes)
      { targetType: "post", targetId: posts[0]._id, userId: binh._id },
      { targetType: "post", targetId: posts[0]._id, userId: cuong._id },
      { targetType: "post", targetId: posts[0]._id, userId: dung._id },
      { targetType: "post", targetId: posts[0]._id, userId: em._id },
      // Post[1] likes (3)
      { targetType: "post", targetId: posts[1]._id, userId: admin._id },
      { targetType: "post", targetId: posts[1]._id, userId: dung._id },
      { targetType: "post", targetId: posts[1]._id, userId: cuong._id },
      // Post[2] likes (2)
      { targetType: "post", targetId: posts[2]._id, userId: admin._id },
      { targetType: "post", targetId: posts[2]._id, userId: binh._id },
      // Post[3] likes (5)
      { targetType: "post", targetId: posts[3]._id, userId: admin._id },
      { targetType: "post", targetId: posts[3]._id, userId: binh._id },
      { targetType: "post", targetId: posts[3]._id, userId: cuong._id },
      { targetType: "post", targetId: posts[3]._id, userId: em._id },
      { targetType: "post", targetId: posts[3]._id, userId: dung._id },
      // Post[4] likes (3)
      { targetType: "post", targetId: posts[4]._id, userId: admin._id },
      { targetType: "post", targetId: posts[4]._id, userId: binh._id },
      { targetType: "post", targetId: posts[4]._id, userId: cuong._id },
      // Comment likes
      { targetType: "comment", targetId: c1._id, userId: admin._id },
      { targetType: "comment", targetId: c4._id, userId: binh._id },
      { targetType: "comment", targetId: c5._id, userId: cuong._id },
    ];

    await Like.create(likesData);
    console.log(`   ✓ Created ${likesData.length} likes`);

    // ═══════════════════════════════════════
    // 8. CONVERSATIONS (5: 2 private + 3 group)
    // ═══════════════════════════════════════
    console.log("💭 Creating conversations...");

    const conv1 = await Conversation.create({
      type: "private",
      participants: [
        { userId: admin._id },
        { userId: cuong._id },
      ],
      createdBy: admin._id,
    });

    const conv2 = await Conversation.create({
      type: "private",
      participants: [
        { userId: binh._id },
        { userId: dung._id },
      ],
      createdBy: binh._id,
    });

    const conv3 = await Conversation.create({
      type: "group",
      name: "Team Engineering",
      participants: [
        { userId: admin._id },
        { userId: binh._id },
        { userId: cuong._id },
      ],
      createdBy: admin._id,
    });

    const conv4 = await Conversation.create({
      type: "group",
      name: "WorkHub Core Team",
      participants: [
        { userId: admin._id },
        { userId: binh._id },
        { userId: cuong._id },
        { userId: dung._id },
        { userId: em._id },
      ],
      createdBy: admin._id,
    });

    const conv5 = await Conversation.create({
      type: "group",
      name: "Design Review",
      participants: [
        { userId: binh._id },
        { userId: dung._id },
        { userId: em._id },
      ],
      createdBy: dung._id,
    });

    console.log("   ✓ Created 5 conversations (2 private, 3 group)");

    // ═══════════════════════════════════════
    // 9. MESSAGES (nhiều messages trong conversations)
    // ═══════════════════════════════════════
    console.log("✉️  Creating messages...");

    // Conv1: admin <-> cuong (private)
    const m1 = await Message.create({ conversationId: conv1._id, senderId: admin._id, type: "text", content: "Cường ơi, API migration tiến độ thế nào rồi?" });
    const m2 = await Message.create({ conversationId: conv1._id, senderId: cuong._id, type: "text", content: "Đã xong 60% anh ơi. Tuần sau estimate xong phần auth service." });
    const m3 = await Message.create({ conversationId: conv1._id, senderId: admin._id, type: "text", content: "OK good. Nếu cần support thì ping mình nhé 👍", reactions: [{ userId: cuong._id, reaction: "👍" }] });

    // Conv2: binh <-> dung (private)
    const m4 = await Message.create({ conversationId: conv2._id, senderId: binh._id, type: "text", content: "Dũng ơi, design token mới có sẵn chưa?" });
    const m5 = await Message.create({ conversationId: conv2._id, senderId: dung._id, type: "text", content: "Có rồi chị, em vừa push lên Figma. Check mail nhé!" });

    // Conv3: Team Engineering (group)
    const m6 = await Message.create({ conversationId: conv3._id, senderId: admin._id, type: "text", content: "Team meeting 2PM hôm nay nhé mọi người" });
    const m7 = await Message.create({ conversationId: conv3._id, senderId: binh._id, type: "text", content: "Noted anh 👌", reactions: [{ userId: admin._id, reaction: "👍" }] });
    const m8 = await Message.create({ conversationId: conv3._id, senderId: cuong._id, type: "text", content: "OK anh, em sẽ chuẩn bị slide demo API mới" });

    // Conv4: WorkHub Core Team
    const m9 = await Message.create({ conversationId: conv4._id, senderId: admin._id, type: "text", content: "Sprint review thứ 6 tuần này nha team! 🗓️", mentions: [binh._id, cuong._id, dung._id, em._id] });
    const m10 = await Message.create({ conversationId: conv4._id, senderId: em._id, type: "text", content: "Em sẽ demo automation test suite ạ", reactions: [{ userId: admin._id, reaction: "🎉" }, { userId: binh._id, reaction: "💪" }] });

    // Conv5: Design Review
    const m11 = await Message.create({ conversationId: conv5._id, senderId: dung._id, type: "text", content: "Mọi người review mockup Dashboard mới giúp mình nhé" });
    const m12 = await Message.create({ conversationId: conv5._id, senderId: binh._id, type: "text", content: "Nhìn OK rồi, nhưng spacing section header cần tăng lên 24px", replyTo: m11._id });

    // Update lastMessage cho conversations
    await Conversation.findByIdAndUpdate(conv1._id, { lastMessage: { content: m3.content, senderId: m3.senderId, createdAt: m3.createdAt } });
    await Conversation.findByIdAndUpdate(conv2._id, { lastMessage: { content: m5.content, senderId: m5.senderId, createdAt: m5.createdAt } });
    await Conversation.findByIdAndUpdate(conv3._id, { lastMessage: { content: m8.content, senderId: m8.senderId, createdAt: m8.createdAt } });
    await Conversation.findByIdAndUpdate(conv4._id, { lastMessage: { content: m10.content, senderId: m10.senderId, createdAt: m10.createdAt } });
    await Conversation.findByIdAndUpdate(conv5._id, { lastMessage: { content: m12.content, senderId: m12.senderId, createdAt: m12.createdAt } });

    console.log("   ✓ Created 12 messages with reactions & replies");

    // ═══════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════
    console.log("\n╔════════════════════════════════════════╗");
    console.log("║       🌱 SEED COMPLETED SUCCESSFULLY    ║");
    console.log("╠════════════════════════════════════════╣");
    console.log(`║  👤 Users:          ${users.length}                  ║`);
    console.log(`║  🏢 Departments:    3                  ║`);
    console.log(`║  📁 Projects:       ${projects.length}                  ║`);
    console.log(`║  ✅ Tasks:          ${tasks.length}                  ║`);
    console.log(`║  📝 Posts:          ${posts.length}                  ║`);
    console.log(`║  💬 Comments:       9                  ║`);
    console.log(`║  ❤️  Likes:          ${likesData.length}                 ║`);
    console.log(`║  💭 Conversations:  5                  ║`);
    console.log(`║  ✉️  Messages:       12                 ║`);
    console.log("╠════════════════════════════════════════╣");
    console.log("║  🔑 Login: seed.admin@workhub.vn       ║");
    console.log("║  🔒 Password: 123456                   ║");
    console.log("╚════════════════════════════════════════╝");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Seed error:", error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seed();
