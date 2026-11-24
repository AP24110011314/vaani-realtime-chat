# Vanni - WebSocket / STOMP Contract

## Connection
- Endpoint: `/ws` (native WebSocket, **no SockJS needed** for modern browsers). Dev URL: `ws://localhost:5173/ws` (proxied to 8080). Prod: `wss://api.<domain>/ws` or same-origin.
- Auth: the browser sends the `vanni_at` cookie on the handshake. `HandshakeInterceptor` validates the JWT and stores the user principal. Reject with 401 otherwise.
- **Origin check:** `setAllowedOriginPatterns(ALLOWED_ORIGINS)`; never `*` in production.
- When the access token expires while connected: the server closes with an auth error; the client refreshes via REST and reconnects.
- Heartbeats: 10 s in/out. Reconnect delay: exponential 1 s -> 30 s with jitter.

## Broker configuration
- Application prefix: `/app`
- Simple broker destinations: `/queue`, `/topic`
- User destination prefix: `/user` (messages are sent per-user, so no per-conversation subscription authorization is needed)
- Inbound channel interceptor: reject any SUBSCRIBE whose destination is not exactly `/user/queue/events`. Clients **cannot** subscribe to `/topic/**`.
- Max frame size ~64 KB; reject larger.

## Client subscriptions (only one)
| Destination | Purpose |
|---|---|
| `/user/queue/events` | All events for this user (messages, receipts, typing, presence, conversation changes) |

Every event uses one envelope:
```json
{ "type": "message.created", "ts": "2026-11-24T09:30:00.123Z", "data": { } }
```

## Client -> server (publish to `/app/...`)
| Destination | Payload | Server action |
|---|---|---|
| `/app/chat.send` | `{conversationId, clientMessageId, content, replyToId?, attachmentIds?}` | Validate, persist, fan out `message.created`; ack to sender via `message.created` (same event with `clientMessageId`) |
| `/app/chat.delivered` | `{conversationId, messageIds[]}` or `{conversationId, upToMessageId}` | Upsert DELIVERED receipts; emit `receipt.updated` to senders |
| `/app/chat.read` | `{conversationId, upToMessageId}` | Update `last_read_message_id`, upsert READ receipts; emit `receipt.updated`, `unread.updated` to self |
| `/app/chat.typing` | `{conversationId, typing: true|false}` | Throttled (max 1 per 2 s); forward `typing` to other members |
| `/app/presence.ping` | `{}` | Optional keep-alive/away state |

Every handler: get `Principal` -> load user -> verify active membership -> validate payload -> act. There is no separate error queue. Failures are sent to the same user queue as an `error` event:
`{ "type": "error", "data": { "code": "NOT_A_MEMBER", "clientMessageId": "...", "message": "..." } }`.

## Server -> client events (`/user/queue/events`)
| `type` | `data` |
|---|---|
| `message.created` | `MessageDto` |
| `message.updated` | `MessageDto` (edit, reactions changed) |
| `message.deleted` | `{ conversationId, messageId }` |
| `receipt.updated` | `{ conversationId, messageId, userId, status }` (or `{conversationId, userId, upToMessageId, status}` for bulk) |
| `unread.updated` | `{ conversationId, unreadCount }` |
| `typing` | `{ conversationId, userId, name, typing }` (client auto-expires after 4 s) |
| `presence.changed` | `{ userId, online, lastSeenAt|null }` |
| `conversation.created` | `ConversationDto` (new direct/group involving me) |
| `conversation.updated` | `ConversationDto` (title, avatar, members, my role changed) |
| `conversation.removed` | `{ conversationId }` (I was removed or left) |
| `error` | `{ code, message, clientMessageId? }` |

## Client behaviour checklist
1. Connect after login; disconnect on logout.
2. On `CONNECTED`: refetch `/api/conversations`; for the open chat fetch `messages?after=<lastId>`.
3. Keep a map `clientMessageId -> pending message`; mark failed after 10 s without ack and offer **Retry** (same `clientMessageId`, server de-duplicates by `uq_msg_client`).
4. Send `chat.delivered` for every incoming message; send `chat.read` only when the window is focused **and** the chat is open and scrolled to the bottom.
5. Debounce typing: send `typing:true` on first keystroke, `typing:false` after 3 s idle or on send.
6. Show `ConnectionBanner` while disconnected/reconnecting.

## Server implementation notes
- `EventPublisher.sendToUser(userId, type, data)` wraps `SimpMessagingTemplate.convertAndSendToUser(userId.toString(), "/queue/events", envelope)`. The principal name must be the numeric user id as string.
- Publish after DB commit.
- `PresenceService` keeps `ConcurrentHashMap<Long, AtomicInteger>` of sessions; handles `SessionConnectedEvent` / `SessionDisconnectEvent`.
- Use `ChannelInterceptor` on `clientInboundChannel` to (a) block unauthorised SUBSCRIBE, (b) apply rate limit (e.g. 30 msgs/10 s per user).
- Tests: use `WebSocketStompClient` with a real random port (`@SpringBootTest(webEnvironment = RANDOM_PORT)`).
