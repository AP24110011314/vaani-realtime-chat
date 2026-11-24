# Phase 4 - Real-time Messaging

**Commit message:** `Realtime Messaging`
**Goal:** messages appear instantly for connected users; reconnect restores state. This completes the **MVP** (except presence, done in Phase 5).
**Read:** `WEBSOCKET.md`, `SECURITY.md`, `FRONTEND_GUIDE.md` (STOMP, event map)

## Backend tasks
1. `WebSocketConfig`: endpoint `/ws`, allowed origins from `ALLOWED_ORIGINS`, simple broker `/queue`, prefix `/app`, user prefix `/user`, heartbeats.
2. `JwtHandshakeInterceptor` (cookie -> principal named by user id). Reject unauthenticated.
3. `WsAuthInterceptor` on inbound channel: only `/user/queue/events` may be subscribed; block `/topic/**`; per-user rate limit; max frame size.
4. `EventPublisher` (`sendToUser`, `sendToConversationMembers`) publishing after DB commit.
5. `ChatWebSocketController` `@MessageMapping("chat.send")` calling the same `MessageService.send` used by REST. Emit `message.created` to every active member incl. sender; emit `error` events on failure.
6. Make REST send also publish events so both paths behave the same.
7. Emit `conversation.created` to the other member when a direct chat is first created.

## Frontend tasks
1. `lib/socket.js` (stompjs client) and `SocketContext` (status: connecting/connected/reconnecting/offline). Connect after auth, disconnect on logout.
2. Event handler updating the Query cache (see map in `FRONTEND_GUIDE.md`): append message, replace pending by `clientMessageId`, bump/re-sort conversation list, add new conversation.
3. Composer publishes `/app/chat.send` when connected, else falls back to REST. Pending -> sent; failed after 10 s with Retry.
4. `ConnectionBanner` ("Reconnecting...", "Back online").
5. On reconnect: refetch conversations and `messages?after=<lastId>` for the open chat; de-duplicate by message id.
6. Remove the Phase 3 polling.

## Tests
Backend (WebSocket): unauthenticated handshake rejected; bad origin rejected; subscribing to another user's queue or `/topic/x` rejected; two clients exchange a message; non-member send rejected with `error` event; duplicate `clientMessageId` is not duplicated.
Frontend: cache update on events, pending-to-sent replacement.

## Acceptance checklist
- [ ] Two browsers chat with no refresh and no polling.
- [ ] Stop backend -> banner shows; restart -> reconnects automatically and missed messages appear exactly once.
- [ ] Sending while offline from browser A shows failed/retry; retry works.
- [ ] Multiple tabs of the same user stay in sync.
- [ ] Messages are in MySQL even when the recipient is offline.

## Commit
```bash
git add -A && git commit -m "Realtime Messaging"
```
