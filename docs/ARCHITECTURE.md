# Vanni - Architecture

## 1. High-level view
```
 Browser (React SPA)
   |  REST (JSON, cookies)           |  WebSocket + STOMP (cookie-authenticated)
   v                                 v
 +-----------------------------------------------------------+
 |                    Spring Boot (port 8080)                |
 |  Security filter chain (JWT cookie, CSRF, rate limit)     |
 |  REST controllers      STOMP controllers + interceptors   |
 |            \               /                              |
 |                Service layer (rules, permissions, tx)     |
 |                Repositories (Spring Data JPA)             |
 |                StorageService (local / Cloudinary / S3)   |
 +-------------------------+---------------------------------+
                           |
                        MySQL 8.4            File storage
```

## 2. Components
| Component | Responsibility |
|---|---|
| React client | Pages, conversation list, chat window, composer, profile, groups. |
| REST controllers | HTTP endpoints, DTO validation, status codes. |
| Service layer | Business rules, membership checks, transactions. |
| STOMP controllers | Receive `/app/**` messages (send, typing, read, ack). |
| Handshake/Channel interceptors | Authenticate WS connection, authorize every inbound frame. |
| Presence tracker | Counts active sessions per user, broadcasts online/offline. |
| Repositories | Persistence only. No business rules. |
| StorageService | Interface with `LocalStorage`, `CloudinaryStorage`, `S3Storage` implementations. |

## 3. Backend package structure
```
backend/src/main/java/com/vanni/
  VanniApplication.java
  config/        SecurityConfig, WebSocketConfig, CorsConfig, StorageConfig, RateLimitConfig, JacksonConfig
  security/      JwtService, JwtAuthFilter, CookieUtil, CurrentUser, WsAuthInterceptor
  controller/    AuthController, UserController, ConversationController, MessageController,
                 AttachmentController, ReceiptController, SearchController
  websocket/     ChatWebSocketController, TypingController, PresenceEventHandler, EventPublisher
  service/       AuthService, UserService, ConversationService, MessageService, ReceiptService,
                 AttachmentService, PresenceService, SearchService, BlockService
  storage/       StorageService, LocalStorageService, CloudinaryStorageService, S3StorageService
  repository/    UserRepository, ConversationRepository, ConversationMemberRepository,
                 MessageRepository, MessageReceiptRepository, AttachmentRepository,
                 ReactionRepository, RefreshTokenRepository, BlockRepository
  entity/        User, Conversation, ConversationMember, Message, MessageReceipt,
                 Attachment, Reaction, RefreshToken, Block
  dto/           request/ and response/ (records)
  exception/     ApiException, NotFoundException, ForbiddenException, GlobalExceptionHandler
  util/          TimeUtil, DirectKey
backend/src/main/resources/
  application.yml, application-dev.yml, application-prod.yml
  db/migration/  V1__init.sql, V2__...
backend/src/test/java/com/vanni/ ...
```

## 4. Frontend structure
```
frontend/src/
  api/          http.js (axios), authApi.js, userApi.js, conversationApi.js, messageApi.js, attachmentApi.js
  components/
    layout/     AppShell.jsx, Sidebar.jsx, TopBar.jsx
    chat/       ConversationList.jsx, ConversationItem.jsx, ChatWindow.jsx, ChatHeader.jsx,
                MessageList.jsx, MessageBubble.jsx, MessageComposer.jsx, TypingIndicator.jsx,
                ReplyPreview.jsx, ReactionBar.jsx, AttachmentPreview.jsx, DateSeparator.jsx
    common/     UserAvatar.jsx, Button.jsx, Input.jsx, Modal.jsx, Toast.jsx, Spinner.jsx,
                EmptyState.jsx, ConnectionBanner.jsx, Badge.jsx
    group/      GroupCreateModal.jsx, GroupInfoPanel.jsx, MemberRow.jsx
    user/       UserSearch.jsx, UserCard.jsx
  pages/        LandingPage.jsx, LoginPage.jsx, RegisterPage.jsx, ChatPage.jsx, ProfilePage.jsx,
                SettingsPage.jsx, NotFoundPage.jsx
  context/      AuthContext.jsx, SocketContext.jsx, ThemeContext.jsx
  hooks/        useAuth.js, useSocket.js, useConversations.js, useMessages.js, usePresence.js,
                useTyping.js, useDebounce.js, useInfiniteScrollUp.js, useNotifications.js
  routes/       AppRoutes.jsx, ProtectedRoute.jsx, PublicOnlyRoute.jsx
  lib/          socket.js (stomp client), dates.js, validators.js, constants.js
  styles/       index.css (Tailwind + @theme tokens)
  App.jsx  main.jsx
```

## 5. Key flows

### 5.1 Login and session
1. `POST /api/auth/login` -> server sets `vanni_at` (access JWT, 15 min) and `vanni_rt` (refresh token, 7 d) as HttpOnly cookies, plus `XSRF-TOKEN` cookie.
2. SPA calls `GET /api/users/me` on load; 401 -> try `POST /api/auth/refresh` once -> else redirect to login.
3. After login the SPA opens the STOMP connection (cookie is sent automatically on the handshake).

### 5.2 Sending a message (real-time)
1. Client creates a temporary message with `clientMessageId` (UUID), shows it as *pending*.
2. Client publishes to `/app/chat.send` `{conversationId, clientMessageId, content, replyToId?, attachmentIds?}`.
3. Server: validate membership, not blocked, payload size -> **save to MySQL** -> build `MessageDto`.
4. Server fans out `message.created` to **each member's** `/user/queue/events` (including the sender so other tabs sync).
5. Sender's client matches `clientMessageId`, replaces pending with the real message (status *sent*).
6. Recipient client receives the event, appends it, sends `/app/chat.delivered`. If the chat is open and focused it also sends `/app/chat.read`.
7. Server stores receipts and emits `receipt.updated` to the sender.

### 5.3 Offline / reconnect
- Messages are always in MySQL. On (re)connect the client refetches conversation list and, for the open chat, messages `after=<lastKnownId>` to fill the gap.
- STOMP client uses exponential backoff reconnect (1s -> 30s) and shows a "Reconnecting..." banner.

### 5.4 Presence
- `SessionConnectedEvent` -> increment user's session counter; first session => `presence.changed ONLINE`.
- `SessionDisconnectEvent` -> decrement; last session => update `last_seen_at`, emit `OFFLINE`.
- Presence events go only to users who share a conversation with that user and who are allowed to see it (privacy flag, blocks).

### 5.5 Attachments
1. Client `POST /api/attachments` (multipart) -> server validates size, real MIME type (content sniffing), stores via `StorageService`, creates an *unattached* `attachments` row, returns `attachmentId`.
2. Client sends a message with `attachmentIds`; server links them (only if uploaded by the same user and unattached).
3. Downloads go through `GET /api/attachments/{id}` which checks membership and returns a short-lived signed URL or streams the file.

## 6. Cross-cutting
- **Errors:** one JSON error shape (`code`, `message`, `details`, `timestamp`, `path`). See `API.md`.
- **Logging:** structured logs, request id; never log passwords, tokens, message bodies.
- **Time:** UTC everywhere in DB and API (ISO-8601).
- **IDs:** `BIGINT` auto-increment in DB. Expose as numbers (use strings only if > 2^53 is possible; not the case here).
- **Transactions:** at service level; message persistence + receipt creation in one transaction; broadcast **after commit** (`TransactionSynchronization` or `@TransactionalEventListener(AFTER_COMMIT)`).
- **Scaling note:** the simple in-memory broker and in-memory presence work for one backend instance. For multiple instances, switch to a STOMP broker relay (RabbitMQ) and Redis-backed presence. Keep all publishing behind `EventPublisher` so this is a one-class change.
