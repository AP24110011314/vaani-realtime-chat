# Architectural & Design Decisions

## 1. Spring Boot 4 Starter Web MVC and WebMvcTest
- Spring Boot 4.1.3 modularized web starters to `spring-boot-starter-webmvc` and test auto-configuration to `org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest`.
- Tested and verified with Java 21 LTS and Spring Boot 4.1.3.

## 2. Vite Proxy Configuration & Hostname
- In macOS development environments with Node 22+, Vite proxy is configured to route `/api` and `/ws` to `http://localhost:8080`.
- All ports (5173 for frontend, 8080 for backend, 3307 for Docker MySQL host port) are strictly respected.

## 3. Phase 2 Authentication & Security Architecture
- Used JJWT with HMAC-SHA256 and 15-minute `vanni_at` HttpOnly cookie.
- Used SHA-256 hashed 7-day `vanni_rt` HttpOnly cookie with rotation on each refresh and token family revocation upon reuse detection (`@Transactional(noRollbackFor = ApiException.class)`).
- Rate-limiting using Bucket4j: 5 requests/min per IP+email on login, 5 requests/hour per IP on registration.
- Single-flight 401 refresh interceptor in Axios (`api/http.js`) to seamlessly buffer and replay concurrent requests during token rotation.


## 4. Phase 3 Direct Conversations & SPA CSRF
- **SPA CSRF Configuration**: Configured `CsrfTokenRequestAttributeHandler.setCsrfRequestAttributeName(null)` so that `CookieCsrfTokenRepository.withHttpOnlyFalse()` issues raw tokens in the `XSRF-TOKEN` cookie, perfectly matching the raw header `X-XSRF-TOKEN` sent by Axios and client API calls without XOR-masking mismatches.
- **Direct Conversation Key & Concurrency**: Generated canonical `min_max` key via `DirectKey.of(u1, u2)` with unique database constraint. Concurrent creation safely catches `DataIntegrityViolationException` and re-queries the existing record.
- **Message Cursor & Scroll Preservation**: Cursor pagination queries `id < :before ORDER BY id DESC` on the backend. The frontend maintains scroll height using `container.scrollHeight` diff in `useLayoutEffect` to prevent jumping when prepending older messages.
- **REST Polling (Phase 3)**: Implemented 5-second refetch interval via TanStack Query for conversations and open message threads, ready to transition cleanly to WebSocket updates in Phase 4.

## 5. Phase 4 Real-time Messaging & STOMP Architecture
- **Cookie Authentication on WebSocket Handshake**: Extracted `vanni_at` cookie in `JwtHandshakeInterceptor`, verified signature and expiry, and bound user principal where `getName()` returns `userId.toString()`. Spring's `UserDestinationMessageHandler` routes `/user/{userId}/queue/events` directly to all sessions of that user.
- **Strict Inbound Channel Interception**: `WsAuthChannelInterceptor` enforces that client `SUBSCRIBE` commands are strictly targeted to `/user/queue/events` (and its internal user destination mapping), blocking `/topic/**` and unauthorized queues. It also enforces 64 KB maximum payload size and per-user rate limiting (30 msgs / 10 s via Bucket4j).
- **Post-Commit Event Fan-out**: `EventPublisher` registers a Spring `TransactionSynchronization.afterCommit` hook (falling back to immediate execution if outside an active transaction) to guarantee that WebSocket events (`message.created`, `conversation.created`) are only broadcast after the database transaction successfully commits.
- **Frontend Reactive Query Cache Updates**: `SocketContext` listens to `/user/queue/events` and updates TanStack Query cache directly with `queryClient.setQueryData`. Replaces optimistic pending messages matching `clientMessageId`, auto-sorts conversation list previews, and removes all 5-second polling intervals.
- **Reconnection Catch-up & Resilience**: On STOMP reconnection, the frontend refetches the conversation list and queries `messages?after=<maxId>` for the open chat, de-duplicating by message ID to prevent missing or duplicated messages during disconnects.
- **Offline / Failure Handling with 10s Timeout & Retry**: Added 10-second pending message timeout and REST fallback. Failed messages are marked with `failed: true` and display a "Retry" button that re-submits with the same idempotent `clientMessageId`.

## 6. Phase 5 Groups, Presence & Typing Architecture
- **Group Membership & Permission Matrix**: Creator is assigned `ADMIN`; requires at least 2 other members on creation (total >= 3), capped at 256 members. Admin-only actions (`updateGroup`, `addMembers`, `removeMember`, `setRole`) enforce `ADMIN` role with HTTP 403 `FORBIDDEN`. All access checks require `left_at IS NULL`; non-members receive HTTP 404 `NOT_FOUND` to prevent conversation ID probing.
- **Member Re-activation**: When re-adding a user who previously left a group, their existing `conversation_members` record is re-activated (`left_at = null, role = MEMBER, joined_at = Instant.now()`) to avoid violating the unique `(conversation_id, user_id)` constraint.
- **Last-Admin-Leaves Promotion Rule**: When an admin leaves a group, if no other admins remain and active members exist, the oldest active member (by `joined_at ASC`) is automatically promoted to `ADMIN`. If the last member leaves, the conversation is marked empty.
- **System Messages**: System events ("Asha added Ravi", "Bob left the group", "Alice was promoted to admin", etc.) persist as messages with `message_type=SYSTEM` and are broadcast via `message.created`. The frontend renders these as centered notification pills without bubbles or avatars.
- **Multi-Tab Presence & Privacy**: `PresenceService` tracks open WebSocket sessions per user using `ConcurrentHashMap<Long, AtomicInteger>`. State transitions from 0 -> 1 (`online=true`) and 1 -> 0 (`online=false`, updating `users.last_seen_at`) fan out `presence.changed` events exclusively to users sharing mutual active conversations. The `show_last_seen` flag is checked on snapshot retrieval and event emission to protect user privacy.
- **Typing Indicator Throttling**: `@MessageMapping("chat.typing")` is throttled on the backend using an in-memory sliding window (1 frame per 2 seconds per user per conversation) and forwarded only to other active conversation members. The frontend debounces typing keystrokes by 3 seconds and applies a 4-second client-side auto-expiry timer.

## 7. Phase 6 Read Receipts, Unread Counts & Notifications Architecture
- **Message Receipt Lifecycle & State Monotonicity**: Receipts follow a monotonic state progression: `SENT` (implicit, message saved) $\to$ `DELIVERED` (client acks event via `/app/chat.delivered`) $\to$ `READ` (active conversation open & visible via `/app/chat.read`). Receipts are never downgraded (a subsequent delivered ping will not overwrite an existing `READ` state).
- **Group Status Aggregation**: Direct message status reflects the peer's receipt. In groups, status is `DELIVERED` when all other active members have received it ($\ge \text{DELIVERED}$), and `READ` when all other active members have read it. Senders can inspect per-user delivery/read timestamps via `GET /api/messages/{id}/receipts`.
- **Read Receipts Privacy Protection**: When a reader has `show_read_receipts = false`, their personal unread state and read pointer advance normally (`last_read_message_id`), but the sender receives a `DELIVERED` event rather than a `READ` event, and the computed status viewed by the sender remains masked to `DELIVERED`.
- **Bulk Pending Delivery on Connect**: When a user connects to WebSocket (session count $0 \to 1$), `ReceiptService.markPendingDeliveredForUser` bulk-marks all undelivered messages across the user's active conversations as `DELIVERED` and notifies respective senders.
- **Frontend Real-time Receipt & Unread Updates**: STOMP `receipt.updated` updates individual message status in the TanStack Query cache (`SENT` $\to$ `DELIVERED` $\to$ `READ`), preventing duplicate renders. `unread.updated` synchronizes unread badges across multi-tab sessions.
- **Tab Title & Visibility Synchronization**: Dynamic tab title `(n) Vanni` displays total unread messages across conversations and restores to `Vanni` when all messages are read. Visibility change and window focus listeners automatically trigger read receipts when returning to an open conversation.


## 8. Phase 7 Attachments & Profile Architecture
- **Content-Sniffed MIME Detection & Spoof Rejection**: Implemented `MimeSniffer` inspecting file magic bytes against a strict allowlist (`image/jpeg`, `image/png`, `image/gif`, `image/webp`, `application/pdf`, `text/plain`, `application/zip`, `application/msword`, and OOXML types). Executable headers (DOS MZ, Unix ELF, Mach-O, Java class, script shebangs) and script tags are strictly rejected. Cross-checks extension against detected MIME to block extension spoofing (e.g. `.exe` renamed `.png`).
- **Storage Layer Abstraction**: Built `StorageService` interface backed by `LocalStorageService` (base directory `STORAGE_LOCAL_DIR`, defaults to `./uploads`) with directory traversal guards and random UUID keys (no user-supplied paths). Implemented `CloudinaryStorageService` adapter with server-side credential isolation.
- **Upload Rate Limiting & Lifecycle**: Enforced 20 uploads/hour/user via Bucket4j in `RateLimiterService`. Uploading generates an unattached `attachments` row (`message_id IS NULL`). An hourly scheduled job deletes unattached uploads older than 24 hours from both disk/storage and MySQL.
- **Attachment Linking & Empty Content Support**: In `MessageService.send`, `SendMessageRequest` accepts `attachmentIds`. The server validates that attachments belong to the sender and are unattached, marks the message as `IMAGE` (if all attachments are image/*) or `FILE`, links the attachments to the message, and allows empty message content when attachments exist.
- **Membership-Checked Streaming**: `GET /api/attachments/{id}` enforces that unattached files are only downloadable by the uploader, while attached files are only downloadable by active conversation members (`404 NOT_FOUND` for non-members). Sets `Content-Disposition` (`inline` for image/pdf, `attachment` for others) and `X-Content-Type-Options: nosniff`.
- **Live Avatar Propagation**: Avatar uploads (`POST /api/users/me/avatar`, <= 2 MB) strip EXIF and re-encode to PNG via `ImageIO`. `ConversationService.broadcastUserConversationsUpdated(userId)` broadcasts `conversation.updated` to mutual active members in all conversations the user belongs to, updating avatars in real time without requiring re-login.
