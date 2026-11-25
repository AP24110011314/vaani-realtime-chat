# Phase 6 - Receipts, Unread Counts, Notifications

**Commit message:** `Read Receipts`
**Goal:** sent/delivered/read ticks, accurate unread badges, basic in-site notifications.
**Read:** `DATABASE.md` (receipt meaning, rule 3-4), `WEBSOCKET.md`

## Backend tasks
1. Migration `V4__receipts.sql` (`message_receipts`, `last_read_message_id` already on members).
2. `ReceiptService`: `markDelivered` (upsert DELIVERED, never downgrade READ), `markRead(conversationId, upToMessageId)` (advance `last_read_message_id` monotonically, upsert READ for unread messages of others, respect `show_read_receipts` privacy: still update own unread state but do not emit READ to the sender when the reader has it off).
3. STOMP handlers `chat.delivered` and `chat.read`; events `receipt.updated` (to sender) and `unread.updated` (to the reader's other tabs).
4. Unread count query; include `unreadCount` in `ConversationDto`.
5. Message `status` computation: direct = receipt of the other user; group = DELIVERED when all active recipients delivered, READ when all read. `GET /messages/{id}/receipts` for per-user detail (sender only).
6. When a user connects, mark pending messages as DELIVERED for them (bulk) and notify senders.
7. REST fallback `POST /conversations/{id}/read`.

## Frontend tasks
1. Send `chat.delivered` on every incoming event; send `chat.read` only when tab focused (`document.visibilityState`), chat open and list scrolled near bottom; also on focus return.
2. Tick icons in `MessageBubble`: clock (pending), 1 grey (sent), 2 grey (delivered), 2 blue (read).
3. Unread badge on `ConversationItem`, "Unread" filter tab, unread divider ("3 unread messages") in the list, "New messages" pill.
4. Browser tab title `(n) Vanni` with total unread; restore on focus.
5. Message info drawer (group) listing delivered/read per user.
6. In-site toast for a new message in a non-open conversation.

## Tests
Receipt never downgrades; unread count after read and after new messages; group aggregation; privacy flag; reconnect delivers pending.

## Acceptance checklist
- [ ] Ticks progress sent -> delivered -> read in real time.
- [ ] Unread badges correct across refresh and multiple tabs; clear when the chat is opened and visible.
- [ ] Not marked read while the tab is in the background.
- [ ] Reader with receipts disabled does not trigger blue ticks.

## Commit
```bash
git add -A && git commit -m "Read Receipts"
```
