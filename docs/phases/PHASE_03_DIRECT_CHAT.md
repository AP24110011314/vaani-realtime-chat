# Phase 3 - Direct Conversations (REST only)

**Commit message:** `Direct Conversations`
**Goal:** one-to-one chat fully working through REST (messages appear after refresh/poll). Build the whole chat UI here so Phase 4 only adds live updates.
**Read:** `DATABASE.md` (conversations, members, messages), `API.md` (Users, Conversations, Messages), `UI_UX.md`

## Backend tasks
1. Migration `V3__conversations_messages.sql` (conversations, conversation_members, messages incl. `client_message_id`, `reply_to_id` columns, FK for last_message).
2. Entities and repositories. Message history query uses `id < :before ORDER BY id DESC LIMIT`.
3. `DirectKey` util (`min_max`). `ConversationService.getOrCreateDirect` in one transaction; on unique violation re-select.
4. `ConversationAccessService.requireMember/requireAdmin`.
5. `UserService.search` (>= 2 chars, name or email `LIKE`, excludes self, paged, limit 20).
6. `MessageService.send` (idempotent by `clientMessageId`, validation 1-4000 chars, updates `last_message_id/at`) and `history(before/after/size)`.
7. Controllers: `GET /users`, `GET /users/{id}`, `GET /conversations`, `GET /conversations/{id}`, `POST /conversations/direct`, `GET/POST /conversations/{id}/messages`.
8. Seed script `database/seed.sql` (5 dev users, password `Password@123`, a few messages) loaded in `dev` profile.

## Frontend tasks
1. API modules: `userApi`, `conversationApi`, `messageApi`.
2. `AppShell` two-pane layout; mobile route-driven single column (`/app`, `/app/c/:id`).
3. `Sidebar` with search box, "New chat" modal (`UserSearch`, debounced 300 ms), `ConversationList`/`ConversationItem` (last message, time, sorted by activity).
4. `ChatWindow`: `ChatHeader`, `MessageList` (older-message loading on scroll up, keep scroll position, date separators, grouped bubbles), `MessageBubble`, `MessageComposer` (Enter sends, Shift+Enter newline).
5. TanStack Query for conversations/messages; optimistic append with `clientMessageId` and failed/retry state.
6. Temporary refetch every 5 s of the open chat and the list (removed in Phase 4).
7. Loading skeletons, empty states, error toasts.

## Tests
Backend: get-or-create idempotent (call twice, and concurrently); non-member cannot read/send (403/404); pagination order and cursor; duplicate `clientMessageId` returns the same message; blank content rejected.
Frontend: composer behaviour, conversation sorting, empty states.

## Acceptance checklist
- [ ] User A searches B, starts chat, sends text; B (other browser) sees it within 5 s after polling.
- [ ] Starting a chat with the same person twice opens the same conversation.
- [ ] Scrolling up loads older messages without jumping.
- [ ] A third user cannot open the conversation by guessing the id.
- [ ] Usable at 360 px width.

## Commit
```bash
git add -A && git commit -m "Direct Conversations"
```
