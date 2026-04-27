# WorkHub Backend Summary

Tài liệu này là bản tổng hợp nhanh cho phía frontend trước khi bắt đầu tích hợp với backend `backend-node/`.

Thứ tự nên đọc:
1. File này để hiểu cấu trúc backend, module nào dùng để làm gì, các quy ước chung.
2. [how_to_socket.md](/home/tuananh/Workspace/Workhub/how_to_socket.md) để tích hợp realtime chat bằng Socket.IO.

Để xem request mẫu đầy đủ, nên mở thêm collection Postman hiện có trong repo/workspace.

## 1. Tổng quan

`backend-node` là backend Node.js dùng:
- `Express 5`
- `MongoDB + Mongoose`
- `JWT` cho auth
- `Socket.IO` cho realtime chat
- `Cloudflare R2` cho document storage
- `Cloudflare Realtime` cho meeting token/provisioning

Backend phục vụ 3 nhóm chức năng lớn:
- Core app: auth, users, departments, projects, posts, comments, conversations
- Workspace features: tasks, folders, documents, notifications, admin logs/dashboard
- Realtime/media: chat realtime qua Socket.IO, meeting qua Cloudflare Realtime

Server mặc định chạy ở:
- `http://localhost:5000`

Health check:
- `GET /`

Static upload local:
- `GET /uploads/...`

Lưu ý:
- Avatar user và attachment post đang dùng đường dẫn local `/uploads/...`
- Document thật không đọc trực tiếp từ `/uploads`, mà download/preview qua API vì file nằm trên R2

## 2. Cách tổ chức code

`backend-node/src/` được chia như sau:

- `app.js`: entry point, mount toàn bộ route, khởi tạo HTTP server và Socket.IO
- `views/`: định nghĩa router Express cho từng domain
- `presenters/`: handler chính cho API, chứa business flow
- `models/`: schema Mongoose
- `services/`: logic dùng lại giữa nhiều presenter, permission, stats, notification, storage, realtime
- `middlewares/`: auth, admin, upload
- `config/`: kết nối DB, socket setup, multer config
- `utils/`: helper chung như `ApiError`, `errorMiddleware`, token helpers, email helper
- `scripts/`: script seed
- `test/`: test API/model/service

Nếu nhìn theo luồng request:
1. Request vào `views/*`
2. Qua middleware nếu có
3. Sang `presenters/*`
4. Presenter gọi `models/*` và `services/*`
5. Trả JSON hoặc stream file về frontend

Đây không phải MVC thuần. Tên `views` ở đây thực tế là router, còn `presenters` là lớp xử lý chính của API.

## 3. App bootstrap

File chính là [backend-node/src/app.js](/home/tuananh/Workspace/Workhub/backend-node/src/app.js).

Những việc file này làm:
- load `.env`
- khởi tạo Express
- bật `cors()`
- bật `express.json()`
- expose static `/uploads`
- mount toàn bộ route `/api/...`
- gắn `errorMiddleware`
- khi `NODE_ENV !== test` thì:
  - connect MongoDB
  - tạo HTTP server
  - gắn Socket.IO
  - start port

Tất cả API frontend dùng hiện tại đều nằm dưới `/api`.

## 4. Route map tổng quát

Các route group đang được mount:

- `/api/auth`
- `/api/users`
- `/api/departments`
- `/api/projects`
- `/api/posts`
- `/api/comments`
- `/api/conversations`
- `/api/folders`
- `/api/documents`
- `/api/share`
- `/api/tasks`
- `/api/notifications`
- `/api/admin`
- `/api/meetings`

Ngoài ra còn có route phụ:
- `/api/projects/:projectId/tasks`
- `/api/departments/:departmentId/tasks`

## 5. Ý nghĩa từng module chính

### Auth

Các chức năng chính:
- register
- verify email bằng OTP
- resend OTP
- login password
- login Google
- forgot password
- reset password
- refresh access token
- logout
- `GET /api/auth/me`

Token model:
- access token: JWT ngắn hạn, frontend gửi qua `Authorization: Bearer <token>`
- refresh token: backend trả từ login/verify/google login, dùng cho refresh/logout

### Users

Gồm:
- hồ sơ user hiện tại
- avatar
- preferences
- admin CRUD user
- admin xem activity của user

Phần `preferences` là cài đặt cá nhân kiểu cũ của user.
Phần `notifications/settings` là cài đặt notification kiểu mới cho module notification.
Frontend nên coi đây là 2 vùng dữ liệu khác nhau.

### Departments

Quản lý:
- danh sách phòng ban
- chi tiết phòng ban
- thành viên phòng ban
- admin CRUD phòng ban
- admin add/remove member
- danh sách task theo department

### Projects

Quản lý:
- CRUD project
- member của project
- role member trong project
- danh sách task theo project

### Posts + Comments

Feed nội bộ:
- post
- comment gốc
- reply comment
- like post/comment
- mention/tag
- target audience

Post attachment đang dùng upload local qua multipart/form-data.

### Conversations

Chat domain:
- conversation private/group
- member conversation
- message list / send / edit / delete
- reaction
- realtime event qua Socket.IO

Đây là phần frontend chat sẽ dùng nhiều nhất cùng với `how_to_socket.md`.

### Tasks

Task module hiện đã tách riêng khá rõ:
- create/list/get/update/delete task
- list task của tôi
- list task theo project/department
- add/remove assignee
- checklist item CRUD

Task có permission service riêng:
- `taskPermissionService.js`
- `taskEventService.js`

Vì vậy frontend nên kỳ vọng có thể gặp `403` dù user vẫn login hợp lệ.

### Folders + Documents

Workspace document được chia 2 lớp:

- `Folder`
  - thư mục logic
  - phân quyền đọc/upload theo folder
- `Document`
  - metadata document
  - versioning
  - share link
  - preview/download

Điểm quan trọng:
- Upload file vào folder: `POST /api/folders/:id/documents`
- Upload version mới: `POST /api/documents/:id/versions`
- File thực tế lưu trên Cloudflare R2
- Preview/download là stream binary, không phải JSON
- Public share dùng route `/api/share/...` và không cần auth token

### Notifications

Notification module riêng gồm:
- list notifications
- unread count
- mark one read
- mark all read
- delete notification
- get/patch notification settings

Notification settings kiểu mới nằm trong model `NotificationSettings`.

### Admin

Admin module hiện có:
- activity logs
- lock user
- unlock user
- reset password placeholder
- dashboard stats
- user analytics

Lưu ý:
- endpoint reset password admin hiện trả `501`
- frontend nên coi endpoint này là “chưa dùng được”

### Meetings

Meeting module hiện không tự host media.

Backend chỉ làm:
- tạo meeting record
- gọi Cloudflare Realtime API để tạo meeting
- tạo participant token cho user join
- list/get/end meeting

Frontend sẽ cần dùng response token từ backend để kết nối sang SDK/media layer phía Cloudflare.

## 6. Middleware và phân quyền

### Auth

Middleware chính: [backend-node/src/middlewares/authMiddleware.js](/home/tuananh/Workspace/Workhub/backend-node/src/middlewares/authMiddleware.js)

Quy ước:
- gửi `Authorization: Bearer <access_token>`
- nếu không có token: `401`
- token sai/hết hạn: `401`
- user bị `inactive/suspended/locked/disabled`: `403`

### Admin

Middleware admin:
- phải qua auth trước
- `req.user.role === "admin"`

Nếu không đủ quyền:
- `403 Access denied. Admin only.`

### Domain permissions

Ngoài auth/admin cơ bản, một số module có permission riêng trong service:
- task
- folder/document
- admin routes

Nghĩa là:
- không phải cứ login là gọi được mọi endpoint
- frontend cần xử lý `403` như trường hợp hợp lệ của business

## 7. Format response cần lưu ý

Backend hiện chưa ép toàn bộ API theo một response envelope duy nhất.

Các kiểu response đang tồn tại song song:

- object đơn:
  - ví dụ `GET /api/users/me`
- object có phân trang:
  - thường có `content`, `totalElements`
  - một số endpoint có thêm `totalPages`, `currentPage`, `pageSize`
- array thuần:
  - ví dụ một số endpoint members/replies
- `204 No Content`:
  - delete, remove member, remove reaction, mark soft delete ở một số chỗ
- binary stream:
  - document preview/download/share download

Frontend nên code theo từng endpoint cụ thể, không nên assume tất cả API có cùng shape.

## 8. Format lỗi

Middleware lỗi nằm ở [backend-node/src/utils/errorMiddleware.js](/home/tuananh/Workspace/Workhub/backend-node/src/utils/errorMiddleware.js).

Response lỗi thường có dạng:

```json
{
  "message": "Some error message"
}
```

Một số mã lỗi thường gặp:
- `400`: validation/input sai
- `401`: thiếu token hoặc token hỏng
- `403`: không đủ quyền hoặc account không active
- `404`: resource không tồn tại
- `409`: duplicate resource hoặc state conflict
- `410`: share link hết hạn / quá quota download
- `413`: file quá lớn
- `500`: server error
- `501`: endpoint có placeholder nhưng chưa enable
- `502` / `503`: service ngoài chưa sẵn sàng như R2 / Cloudflare realtime

## 9. Upload, file và media

Hiện có 3 kiểu file handling khác nhau:

### Avatar user

- upload local
- truy cập qua `/uploads/<filename>`

### Post attachments

- upload local qua multer
- cũng trả link local trong `/uploads/...`

### Documents workspace

- upload qua file field `file`
- lưu metadata trong MongoDB
- lưu object thật trên Cloudflare R2
- frontend phải dùng API preview/download chứ không nên đoán URL file

## 10. Realtime và Socket.IO

Socket.IO chỉ đang phục vụ chat conversation.

Xem chi tiết ở [how_to_socket.md](/home/tuananh/Workspace/Workhub/how_to_socket.md).

Những điểm cần nhớ:
- connect cùng origin backend, thường là `http://localhost:5000`
- truyền JWT tại `auth.token`
- server auto join các room conversation mà user là participant
- event chính:
  - `new_message`
  - `message_updated`
  - `message_deleted`
  - `reaction_added`
  - `reaction_removed`
  - `user_typing`

Meeting realtime không đi qua Socket.IO này. Meeting dùng REST để lấy participant token, sau đó frontend nối sang media service riêng.

## 11. Biến môi trường quan trọng

Những env chính đang được backend dùng:

- `PORT`
- `NODE_ENV`
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `FRONTEND_URL`
- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_USER`
- `EMAIL_PASS`
- `MAX_UPLOAD_SIZE_MB`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_REGION`
- `CLOUDFLARE_REALTIME_ACCOUNT_ID`
- `CLOUDFLARE_REALTIME_APP_ID`
- `CLOUDFLARE_REALTIME_API_TOKEN`
- `CLOUDFLARE_REALTIME_HOST_PRESET`
- `CLOUDFLARE_REALTIME_PARTICIPANT_PRESET`

Lưu ý:
- `app.js` load `.env` theo thứ tự `backend-node/.env` rồi tới root `.env`
- nếu thiếu env cho R2 hoặc meeting realtime, các endpoint liên quan sẽ lỗi dù phần còn lại vẫn chạy

## 12. Cách chạy backend

### Chạy local bằng Node

```bash
cd backend-node
npm install
npm run dev
```

### Chạy cả hệ thống bằng Docker Compose

Từ root repo:

```bash
docker compose up
```

Nếu build lại image:

```bash
docker compose up --build
```

## 13. Test hiện có

Thư mục `backend-node/test/` đã có test cho:
- auth security
- task API/model
- document API/model
- notification API/model
- admin API
- meeting API
- activity log service
- R2 storage service

Chạy test:

```bash
cd backend-node
npm test
```

## 14. Các điểm frontend cần chú ý khi tích hợp

### 1. Không assume response shape đồng nhất

Có endpoint trả object, có endpoint trả array, có endpoint trả pagination object, có endpoint trả `204`.

### 2. Xử lý `401` và `403` khác nhau

- `401`: thường cần login lại hoặc refresh token
- `403`: user login rồi nhưng không có quyền hoặc account bị lock/inactive

### 3. Document preview/download là binary

Các endpoint document/share preview/download không trả JSON.
Frontend cần dùng `blob`, `arrayBuffer`, hoặc mở trực tiếp URL tùy use case.

### 4. Share document là public route

`/api/share/documents/:token/...` không cần bearer token.
Frontend public page có thể gọi trực tiếp route này.

### 5. Chat realtime không thay thế REST

Socket chỉ để nhận event realtime.
Frontend vẫn cần gọi REST để:
- lấy list conversation
- lấy lịch sử message
- gửi/edit/delete message
- add/remove reaction

### 6. Meeting hiện là REST + external realtime service

Backend chỉ tạo meeting và participant token.
Frontend phải tự giữ state phòng họp và dùng token đó với SDK/media layer tương ứng.

### 7. Một số endpoint admin/task/document phụ thuộc business permission

Nếu gặp `403`, trước tiên kiểm tra role và scope dữ liệu chứ không nên kết luận là token lỗi.

## 15. Gợi ý quy trình cho phía frontend

Nên triển khai theo thứ tự:

1. Auth + refresh token flow
2. Current user + users/departments/projects cơ bản
3. Posts/comments hoặc tasks tùy ưu tiên sản phẩm
4. Conversations REST
5. Socket.IO chat theo `how_to_socket.md`
6. Folders/documents
7. Notifications
8. Admin pages
9. Meetings

## 16. File nên mở khi cần đào sâu

- Router map: [backend-node/src/app.js](/home/tuananh/Workspace/Workhub/backend-node/src/app.js)
- Socket realtime: [backend-node/src/config/socketHandler.js](/home/tuananh/Workspace/Workhub/backend-node/src/config/socketHandler.js)
- Auth middleware: [backend-node/src/middlewares/authMiddleware.js](/home/tuananh/Workspace/Workhub/backend-node/src/middlewares/authMiddleware.js)
- Task logic: [backend-node/src/presenters/taskPresenter.js](/home/tuananh/Workspace/Workhub/backend-node/src/presenters/taskPresenter.js)
- Document logic: [backend-node/src/presenters/documentPresenter.js](/home/tuananh/Workspace/Workhub/backend-node/src/presenters/documentPresenter.js)
- Notification logic: [backend-node/src/presenters/notificationPresenter.js](/home/tuananh/Workspace/Workhub/backend-node/src/presenters/notificationPresenter.js)
- Meeting logic: [backend-node/src/presenters/meetingPresenter.js](/home/tuananh/Workspace/Workhub/backend-node/src/presenters/meetingPresenter.js)

## 17. Kết luận ngắn

Để làm frontend cho project này, nên coi backend hiện tại như sau:

- REST API là nguồn dữ liệu chính
- Socket.IO chỉ dùng cho chat realtime
- Document và meeting có dependency ngoài hệ thống
- phân quyền không chỉ nằm ở login/admin mà còn nằm ở service-level permission
- response shape giữa các endpoint chưa được chuẩn hóa hoàn toàn, nên phải tích hợp theo endpoint thật

Nếu phía frontend nắm được file này cộng với `how_to_socket.md`, thì đã đủ context để bắt đầu làm phần lớn màn hình mà không cần đọc toàn bộ code backend.
