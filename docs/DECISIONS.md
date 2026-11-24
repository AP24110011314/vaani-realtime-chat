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

