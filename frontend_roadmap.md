# 🗺️ WorkHub Frontend — Lộ Trình Xây Dựng Giao Diện

> **Trạng thái Auth:** ✅ Hoàn thành (Login, Register, Verify Email, Forgot/Reset Password)
> **Mục tiêu:** Xây dựng toàn bộ giao diện theo thứ tự hợp lý, từ nền tảng đến tính năng phức tạp.

---

## 🏗️ GIAI ĐOẠN 0 — Nền Tảng Kỹ Thuật (Làm TRƯỚC khi làm UI)

> [!IMPORTANT]
> Đây là bước **bắt buộc** phải làm trước. Nếu không có layer này, mọi màn hình sau sẽ bị lặp code và khó maintain.

### 0.1 — API Client (`src/api/`)

Tạo một Axios instance trung tâm với:
- `baseURL` = `http://localhost:5000/api`
- Interceptor request: tự động gắn `Authorization: Bearer <token>`
- Interceptor response: bắt `401` → tự động gọi refresh token → retry request gốc
- Bắt `403` → redirect hoặc show "không có quyền"

```
src/api/
  axiosClient.js       ← Axios instance + interceptors
  authApi.js           ← /api/auth/*
  userApi.js           ← /api/users/*
  departmentApi.js     ← /api/departments/*
  projectApi.js        ← /api/projects/*
  postApi.js           ← /api/posts/* + /api/comments/*
  conversationApi.js   ← /api/conversations/*
  taskApi.js           ← /api/tasks/*
  folderApi.js         ← /api/folders/*
  documentApi.js       ← /api/documents/*
  notificationApi.js   ← /api/notifications/*
  adminApi.js          ← /api/admin/*
  meetingApi.js        ← /api/meetings/*
```

> [!NOTE]
> Backend có nhiều response shape khác nhau (object, array, pagination, 204). Mỗi API file nên có wrapper riêng xử lý shape đó.

### 0.2 — Auth State Global (`src/context/AuthContext.jsx`)

File này đã có skeleton, cần bổ sung đầy đủ:
- `user` state (lấy từ `GET /api/auth/me`)
- `accessToken` lưu trong memory (không localStorage)
- `refreshToken` lưu trong `httpOnly cookie` hoặc localStorage tùy cấu hình backend
- `isLoading` trong khi đang check auth
- Hàm `login()`, `logout()`, `refreshSession()`
- Khi app mount: kiểm tra token → gọi `/api/auth/me` → populate `user`

### 0.3 — Route Guard (`src/routes/`)

```
src/routes/
  route.jsx            ← (đã có, cần mở rộng)
  PrivateRoute.jsx     ← Check user logged in, nếu không → /login
  AdminRoute.jsx       ← Check user.role === 'admin', nếu không → /403
  GuestRoute.jsx       ← Đã login → redirect về /
```

### 0.4 — App Shell / Layout (`src/components/layout/`)

Layout chính cho toàn bộ app sau khi login:

```
src/components/layout/
  MainLayout.jsx       ← Wrapper chính: Sidebar + Header + <Outlet>
  Sidebar.jsx          ← Navigation chính (Feed, Chat, Tasks, Docs, ...)
  Header.jsx           ← Top bar: Search, Notification bell, Avatar menu
  MobileNav.jsx        ← Bottom nav cho mobile (nếu cần)
```

---

## 📦 GIAI ĐOẠN 1 — User & Trang Chủ

### 1.1 — Trang Profile (`/profile/:userId`)

| Màn hình | Path | API |
|---|---|---|
| Profile của tôi | `/profile/me` | `GET /api/users/me` |
| Profile người khác | `/profile/:userId` | `GET /api/users/:id` |
| Chỉnh sửa profile | `/profile/edit` | `PATCH /api/users/me` |
| Đổi avatar | (modal trong edit) | `PATCH /api/users/me/avatar` |

**File cần tạo:**
```
src/modules/user/
  ProfilePage.jsx
  EditProfilePage.jsx
  components/
    AvatarUploader.jsx
    ProfileCard.jsx
```

### 1.2 — Danh Sách Thành Viên (`/members`)

- Tìm kiếm user trong công ty
- Xem phòng ban của từng người
- Click → đến trang Profile

---

## 📰 GIAI ĐOẠN 2 — Feed (Bảng Tin Nội Bộ)

> Đây là "trung tâm" của app, nên làm sớm để app trông "có nội dung".

### Màn hình cần làm

| Màn hình | Path | API |
|---|---|---|
| Feed chính | `/feed` hoặc `/` | `GET /api/posts` |
| Tạo bài đăng | (modal/inline) | `POST /api/posts` |
| Chi tiết bài đăng | `/posts/:id` | `GET /api/posts/:id` |
| Comment + Reply | (trong post) | `GET/POST /api/comments` |
| Like bài/comment | (inline) | `POST /api/posts/:id/like` |

**File cần tạo:**
```
src/modules/feed/
  FeedPage.jsx
  PostDetailPage.jsx
  components/
    PostCard.jsx          ← Hiển thị 1 bài đăng
    PostComposer.jsx      ← Ô tạo bài mới (có upload ảnh)
    CommentSection.jsx    ← Danh sách comment + reply
    CommentItem.jsx
    ReactionButton.jsx    ← Like button + counter
    AttachmentPreview.jsx ← Preview ảnh/file đính kèm
```

> [!NOTE]
> Post attachment dùng `multipart/form-data`. Ảnh hiển thị qua `/uploads/<filename>`.

---

## 💬 GIAI ĐOẠN 3 — Chat (Conversations)

> Đây là module phức tạp nhất. Chia làm 2 bước: REST trước, Socket sau.

### Bước 3A — REST Chat UI

| Màn hình | Path | API |
|---|---|---|
| Danh sách hội thoại | `/messages` | `GET /api/conversations` |
| Cửa sổ chat | `/messages/:convId` | `GET /api/conversations/:id/messages` |
| Gửi tin nhắn | (inline) | `POST /api/conversations/:id/messages` |
| Tạo group chat | (modal) | `POST /api/conversations` |

**File cần tạo:**
```
src/modules/chat/
  ChatPage.jsx            ← Layout 2 cột: danh sách + khung chat
  components/
    ConversationList.jsx  ← Sidebar danh sách hội thoại
    ConversationItem.jsx  ← 1 hội thoại trong list
    ChatWindow.jsx        ← Khung tin nhắn chính
    MessageBubble.jsx     ← 1 tin nhắn
    MessageInput.jsx      ← Ô nhập + nút gửi
    ReactionPicker.jsx    ← Emoji reactions
```

### Bước 3B — Socket.IO Realtime

Sau khi REST chat chạy ổn, tích hợp Socket.IO theo `how_to_socket.md`:
- Connect với `auth.token = accessToken`
- Lắng nghe: `new_message`, `message_updated`, `message_deleted`, `reaction_added`, `reaction_removed`, `user_typing`
- Tạo `src/context/SocketContext.jsx` để share socket instance

```
src/context/SocketContext.jsx
src/hooks/useSocket.js
src/hooks/useChat.js     ← Kết hợp REST + Socket
```

---

## ✅ GIAI ĐOẠN 4 — Tasks (Quản Lý Công Việc)

| Màn hình | Path | API |
|---|---|---|
| Task của tôi | `/tasks/me` | `GET /api/tasks/me` |
| Task theo project | `/projects/:id/tasks` | `GET /api/projects/:id/tasks` |
| Task theo phòng ban | `/departments/:id/tasks` | `GET /api/departments/:id/tasks` |
| Tạo / Sửa task | (modal) | `POST/PATCH /api/tasks` |
| Chi tiết task | `/tasks/:id` | `GET /api/tasks/:id` |

**File cần tạo:**
```
src/modules/tasks/
  MyTasksPage.jsx
  TaskBoardPage.jsx       ← Kanban view (To-do / In Progress / Done)
  TaskDetailPage.jsx      ← Sidebar hoặc modal chi tiết
  components/
    TaskCard.jsx
    TaskColumn.jsx        ← 1 cột kanban
    ChecklistItem.jsx     ← Sub-tasks (checklist)
    AssigneeSelector.jsx  ← Chọn người giao việc
    TaskFilter.jsx        ← Lọc theo status/assignee/deadline
```

> [!WARNING]
> Task có permission service riêng ở backend. Frontend **phải xử lý `403`** như trường hợp bình thường, không phải lỗi token.

---

## 🏢 GIAI ĐOẠN 5 — Departments & Projects

| Màn hình | Path | API |
|---|---|---|
| Danh sách phòng ban | `/departments` | `GET /api/departments` |
| Chi tiết phòng ban | `/departments/:id` | `GET /api/departments/:id` |
| Danh sách project | `/projects` | `GET /api/projects` |
| Chi tiết project | `/projects/:id` | `GET /api/projects/:id` |

**File cần tạo:**
```
src/modules/departments/
  DepartmentsPage.jsx
  DepartmentDetailPage.jsx
  components/
    DepartmentCard.jsx
    MemberList.jsx

src/modules/projects/
  ProjectsPage.jsx
  ProjectDetailPage.jsx
  components/
    ProjectCard.jsx
    ProjectMemberBadge.jsx
```

---

## 📁 GIAI ĐOẠN 6 — Documents (Kho Lưu Trữ)

| Màn hình | Path | API |
|---|---|---|
| Duyệt thư mục | `/docs` | `GET /api/folders` |
| Nội dung folder | `/docs/:folderId` | `GET /api/folders/:id/documents` |
| Upload file | (modal) | `POST /api/folders/:id/documents` |
| Preview/Download | (modal/tab mới) | `GET /api/documents/:id/preview` |
| Share link | (modal) | `POST /api/documents/:id/share` |

**File cần tạo:**
```
src/modules/documents/
  DocsPage.jsx
  FolderViewPage.jsx
  components/
    FolderTree.jsx        ← Sidebar duyệt cây thư mục
    DocumentGrid.jsx      ← Grid view danh sách file
    DocumentCard.jsx      ← 1 file card (icon, tên, ngày, size)
    FileUploader.jsx      ← Drag & drop upload
    DocumentPreview.jsx   ← Iframe/embed preview
    ShareLinkModal.jsx    ← Tạo share link
```

> [!IMPORTANT]
> Preview/download là binary stream. Dùng `blob` URL hoặc mở tab mới với URL API, **không** đọc như JSON.
> Share link public (`/api/share/...`) không cần Bearer token.

---

## 🔔 GIAI ĐOẠN 7 — Notifications

Không cần trang riêng. Tích hợp vào `Header`:

| Thành phần | API |
|---|---|
| Bell icon + unread badge | `GET /api/notifications/unread-count` |
| Dropdown list | `GET /api/notifications` |
| Mark đã đọc | `PATCH /api/notifications/:id/read` |
| Mark all | `PATCH /api/notifications/read-all` |
| Cài đặt notification | `GET/PATCH /api/notifications/settings` |

**File cần tạo:**
```
src/modules/notifications/
  components/
    NotificationBell.jsx    ← Bell + badge (gắn vào Header)
    NotificationDropdown.jsx
    NotificationItem.jsx
  NotificationSettingsPage.jsx
```

---

## 🛡️ GIAI ĐOẠN 8 — Admin Panel

> Chỉ hiện với user có `role === 'admin'`. Dùng `AdminRoute` đã tạo ở Giai đoạn 0.

| Màn hình | Path | API |
|---|---|---|
| Dashboard stats | `/admin` | `GET /api/admin/dashboard` |
| Quản lý user | `/admin/users` | `GET /api/admin/users` |
| Lock / Unlock user | (inline action) | `PATCH /api/admin/users/:id/lock` |
| Activity logs | `/admin/logs` | `GET /api/admin/logs` |
| User analytics | `/admin/analytics` | `GET /api/admin/users/:id/activity` |
| CRUD phòng ban | `/admin/departments` | `POST/PATCH/DELETE /api/departments` |

**File cần tạo:**
```
src/modules/admin/
  AdminDashboardPage.jsx
  AdminUsersPage.jsx
  AdminLogsPage.jsx
  components/
    StatCard.jsx
    UserTable.jsx
    LogTable.jsx
    UserActionMenu.jsx    ← Lock, Unlock, View activity
```

> [!WARNING]
> Reset password admin hiện trả `501 Not Implemented`. Ẩn hoặc disable nút này trong UI.

---

## 📹 GIAI ĐOẠN 9 — Meetings (Video Call)

> Module này phức tạp nhất vì phụ thuộc SDK ngoài (Cloudflare Realtime). Để cuối cùng.

| Màn hình | Path | API |
|---|---|---|
| Danh sách meeting | `/meetings` | `GET /api/meetings` |
| Tạo meeting | (modal) | `POST /api/meetings` |
| Phòng họp | `/meetings/:id` | `POST /api/meetings/:id/join` → lấy token |

**Luồng join meeting:**
1. Gọi `POST /api/meetings/:id/join` → nhận `participantToken`
2. Dùng token đó kết nối sang Cloudflare Calls SDK
3. Render video/audio streams

**File cần tạo:**
```
src/modules/meeting/
  MeetingPage.jsx          ← (đã có skeleton)
  MeetingRoomPage.jsx      ← (đã có skeleton)
  components/
    MeetingCard.jsx
    CreateMeetingModal.jsx
    VideoGrid.jsx           ← Hiển thị video participants
    MeetingControls.jsx     ← Mute, Camera, Share screen, Leave
```

---

## 📋 Bảng Tổng Hợp Thứ Tự Ưu Tiên

| Giai đoạn | Module | Độ ưu tiên | Ghi chú |
|---|---|---|---|
| 0 | API Client + Auth State + Layout Shell | 🔴 Critical | Nền tảng cho tất cả |
| 1 | User Profile | 🟠 High | Cần để gắn avatar, tên người dùng |
| 2 | Feed (Posts + Comments) | 🟠 High | "Mặt tiền" của app |
| 3A | Chat REST | 🟠 High | Tính năng cốt lõi |
| 3B | Chat Socket.IO | 🟡 Medium | Upgrade realtime sau |
| 4 | Tasks | 🟡 Medium | Workflow management |
| 5 | Departments + Projects | 🟡 Medium | Cần trước khi làm Task view |
| 6 | Documents | 🟡 Medium | Kho lưu trữ |
| 7 | Notifications | 🟡 Medium | Gắn vào Header |
| 8 | Admin Panel | 🟢 Low | Chỉ cho admin |
| 9 | Meetings | 🟢 Low | Phụ thuộc SDK ngoài |

---

## 🧱 Cấu Trúc Thư Mục Đề Xuất (Sau Khi Hoàn Thành)

```
frontend/src/
  api/
    axiosClient.js
    authApi.js | userApi.js | postApi.js | ...
  assets/
  components/
    layout/
      MainLayout.jsx
      Sidebar.jsx
      Header.jsx
    ui/
      Button.jsx | Modal.jsx | Avatar.jsx | Badge.jsx | ...
    AuthLayout.jsx
    Logo.jsx
  context/
    AuthContext.jsx
    SocketContext.jsx
  hooks/
    useAuth.js
    useSocket.js
    useChat.js
    useNotifications.js
  modules/
    auth/           ✅ Done
    user/
    feed/
    chat/
    tasks/
    departments/
    projects/
    documents/
    notifications/
    admin/
    meeting/        ⚠️ Skeleton exists
  routes/
    route.jsx       ← Mở rộng thêm
    PrivateRoute.jsx
    AdminRoute.jsx
    GuestRoute.jsx
  services/
    authService.js  ✅ Done
    meetingService.js ✅ Done
  styles/
  utils/
```
