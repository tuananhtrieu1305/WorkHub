# Socket.IO Integration Guide — WorkHub

Hướng dẫn tích hợp các tính năng realtime (Socket.IO) cho frontend WorkHub.

---

## 1. Kết nối Socket.IO

### Cài đặt

```bash
npm install socket.io-client
```

### Khởi tạo kết nối

```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  auth: {
    token: "YOUR_JWT_ACCESS_TOKEN", // Token lấy từ API login
  },
});

// Lắng nghe kết nối thành công
socket.on("connect", () => {
  console.log("✅ Connected to Socket.IO server");
});

// Lắng nghe lỗi kết nối
socket.on("connect_error", (err) => {
  console.error("❌ Connection error:", err.message);
  // err.message sẽ là "Authentication required" hoặc "Invalid token"
});

socket.on("disconnect", (reason) => {
  console.log("🔌 Disconnected:", reason);
});
```

> **Lưu ý:** Server sử dụng JWT middleware để xác thực. Token **bắt buộc** phải được truyền qua `auth.token` khi kết nối.

---

## 2. Quản lý Conversation Rooms

Khi kết nối thành công, server **tự động join** user vào tất cả conversation rooms mà user là participant. Tuy nhiên, bạn cũng có thể join/leave thủ công:

### Join conversation (khi mở chat)

```javascript
socket.emit("join_conversation", conversationId);
```

### Leave conversation (khi đóng chat)

```javascript
socket.emit("leave_conversation", conversationId);
```

---

## 3. Events: Tin nhắn (Messages)

### 3.1. Nhận tin nhắn mới — `new_message`

Khi có user khác gửi tin nhắn trong conversation mà bạn đang tham gia.

```javascript
socket.on("new_message", (message) => {
  console.log("New message:", message);
  // Thêm message vào danh sách hiển thị
});
```

**Payload nhận về:**

```json
{
  "id": "665abc...",
  "conversationId": "665def...",
  "sender": {
    "_id": "665ghi...",
    "fullName": "Nguyễn Văn An",
    "avatar": ""
  },
  "type": "text",
  "content": "Hello!",
  "attachments": [],
  "mentions": [],
  "replyTo": null,
  "reactions": [],
  "createdAt": "2026-04-27T07:00:00.000Z",
  "updatedAt": "2026-04-27T07:00:00.000Z"
}
```

> **Khi nào được emit?** Khi bất kỳ participant nào gọi `POST /api/conversations/:id/messages`.

---

### 3.2. Tin nhắn được sửa — `message_updated`

```javascript
socket.on("message_updated", (message) => {
  console.log("Message updated:", message);
  // Cập nhật nội dung message trong UI
});
```

**Payload:** Cấu trúc giống `new_message` (message object đầy đủ sau khi sửa).

> **Khi nào được emit?** Khi sender gọi `PUT /api/conversations/:id/messages/:messageId`.

---

### 3.3. Tin nhắn bị xóa — `message_deleted`

```javascript
socket.on("message_deleted", ({ messageId, conversationId }) => {
  console.log("Message deleted:", messageId);
  // Xóa message khỏi danh sách hiển thị
});
```

**Payload:**

```json
{
  "messageId": "665abc...",
  "conversationId": "665def..."
}
```

> **Khi nào được emit?** Khi sender gọi `DELETE /api/conversations/:id/messages/:messageId`.

---

## 4. Events: Reactions

### 4.1. Reaction được thêm — `reaction_added`

```javascript
socket.on("reaction_added", ({ messageId, conversationId, userId, reaction }) => {
  console.log(`${userId} reacted with ${reaction}`);
  // Thêm reaction vào message UI
});
```

**Payload:**

```json
{
  "messageId": "665abc...",
  "conversationId": "665def...",
  "userId": "665ghi...",
  "reaction": "👍"
}
```

> **Khi nào được emit?** Khi user gọi `POST /api/conversations/:id/messages/:messageId/reactions`.

---

### 4.2. Reaction bị gỡ — `reaction_removed`

```javascript
socket.on("reaction_removed", ({ messageId, conversationId, userId, reaction }) => {
  console.log(`${userId} removed ${reaction}`);
  // Gỡ reaction khỏi message UI
});
```

**Payload:** Cấu trúc giống `reaction_added`.

> **Khi nào được emit?** Khi user gọi `DELETE /api/conversations/:id/messages/:messageId/reactions`.

---

## 5. Event: Typing Status (#65)

### 5.1. Gửi trạng thái đang gõ — `typing_status`

```javascript
// Khi user bắt đầu gõ
socket.emit("typing_status", {
  conversationId: "665def...",
  isTyping: true,
});

// Khi user ngừng gõ (sau debounce hoặc blur)
socket.emit("typing_status", {
  conversationId: "665def...",
  isTyping: false,
});
```

### 5.2. Nhận trạng thái người khác đang gõ — `user_typing`

```javascript
socket.on("user_typing", ({ conversationId, userId, fullName, isTyping }) => {
  if (isTyping) {
    showTypingIndicator(fullName); // VD: "An đang gõ..."
  } else {
    hideTypingIndicator(userId);
  }
});
```

**Payload:**

```json
{
  "conversationId": "665def...",
  "userId": "665ghi...",
  "fullName": "Nguyễn Văn An",
  "isTyping": true
}
```

### Gợi ý implement debounce phía client

```javascript
let typingTimeout = null;

function handleInputChange(conversationId) {
  // Gửi typing = true
  socket.emit("typing_status", { conversationId, isTyping: true });

  // Reset timeout
  clearTimeout(typingTimeout);

  // Tự động gửi typing = false sau 3 giây không gõ
  typingTimeout = setTimeout(() => {
    socket.emit("typing_status", { conversationId, isTyping: false });
  }, 3000);
}
```

---

## 6. Tổng hợp Events

### Events client **GỬI** (emit)

| Event | Payload | Mô tả |
|-------|---------|-------|
| `join_conversation` | `conversationId` (string) | Join room khi mở conversation |
| `leave_conversation` | `conversationId` (string) | Leave room khi đóng conversation |
| `typing_status` | `{ conversationId, isTyping }` | Báo hiệu đang gõ / ngừng gõ |

### Events client **NHẬN** (on)

| Event | Payload | Mô tả |
|-------|---------|-------|
| `new_message` | Message object | Có tin nhắn mới |
| `message_updated` | Message object | Tin nhắn được sửa |
| `message_deleted` | `{ messageId, conversationId }` | Tin nhắn bị xóa |
| `reaction_added` | `{ messageId, conversationId, userId, reaction }` | Reaction mới |
| `reaction_removed` | `{ messageId, conversationId, userId, reaction }` | Reaction bị gỡ |
| `user_typing` | `{ conversationId, userId, fullName, isTyping }` | Ai đó đang gõ |

---

## 7. Ví dụ tích hợp React (hook)

```javascript
// hooks/useSocket.js
import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

export function useSocket(token) {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) return;

    const socket = io("http://localhost:5000", {
      auth: { token },
    });

    socketRef.current = socket;

    socket.on("connect", () => console.log("Socket connected"));
    socket.on("connect_error", (err) => console.error("Socket error:", err.message));

    return () => {
      socket.disconnect();
    };
  }, [token]);

  return socketRef.current;
}
```

```javascript
// components/ChatRoom.jsx
import { useEffect } from "react";
import { useSocket } from "../hooks/useSocket";

function ChatRoom({ conversationId, token }) {
  const socket = useSocket(token);

  useEffect(() => {
    if (!socket) return;

    // Join room
    socket.emit("join_conversation", conversationId);

    // Lắng nghe tin nhắn mới
    socket.on("new_message", (message) => {
      // Thêm vào state messages
    });

    // Lắng nghe typing
    socket.on("user_typing", ({ fullName, isTyping }) => {
      // Hiển thị/ẩn typing indicator
    });

    return () => {
      socket.emit("leave_conversation", conversationId);
      socket.off("new_message");
      socket.off("user_typing");
    };
  }, [socket, conversationId]);

  return <div>{/* Chat UI */}</div>;
}
```

---

## 8. Lưu ý quan trọng

1. **Authentication:** Socket.IO sử dụng **cùng JWT token** với REST API. Nếu token hết hạn, socket sẽ bị ngắt kết nối.

2. **Auto-join rooms:** Khi kết nối, server tự động join user vào **tất cả** conversation rooms. Không cần emit `join_conversation` ngay khi connect.

3. **Broadcast:** Các event message (`new_message`, `message_updated`, `message_deleted`) được **broadcast cho toàn bộ room** (bao gồm cả sender). Frontend cần tự check `sender._id !== currentUserId` nếu muốn bỏ qua event từ chính mình.

4. **Typing event:** Event `user_typing` **không gửi lại cho sender** (sử dụng `socket.to()` thay vì `io.to()`). Frontend không cần filter.

5. **Reconnection:** `socket.io-client` tự động reconnect khi mất kết nối. Không cần implement retry logic thủ công.
