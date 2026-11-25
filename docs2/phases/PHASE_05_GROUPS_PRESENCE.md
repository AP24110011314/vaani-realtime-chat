# Phase 5 - Groups and Presence

**Commit message:** `Groups Presence`
**Goal:** group chats with admin permissions, typing indicators, online/offline status.
**Read:** `API.md` (Conversations), `WEBSOCKET.md` (typing, presence), `SECURITY.md` (authorization)

## Backend tasks
1. `ConversationService`: `createGroup` (creator = ADMIN, >= 2 other members, max 256), `updateGroup`, `addMembers` (admin only, skip duplicates, re-activate if `left_at` set), `removeMember`, `leave` (if last admin leaves promote oldest member; if nobody left, archive/close), `setRole`.
2. System messages (`message_type=SYSTEM`) such as "Asha added Ravi" persisted and broadcast.
3. Events: `conversation.created` to new members, `conversation.updated` to all, `conversation.removed` to removed member. Removed members lose access **immediately** (membership check, not cache).
4. Group endpoints from `API.md`.
5. Typing: `@MessageMapping("chat.typing")` with throttle (1 per 2 s per conversation per user) forwarding `typing` to other active members.
6. `PresenceService` (session counter per user), `PresenceEventHandler` for `SessionConnectedEvent` / `SessionDisconnectEvent`; update `users.last_seen_at` on last disconnect; emit `presence.changed` only to users who share a conversation and are allowed to see it. `GET /presence?userIds=` snapshot.

## Frontend tasks
1. `GroupCreateModal` (name, description, member multi-select chips), "New group" button.
2. `GroupInfoPanel`: members list with role badges, add member (search), remove, promote/demote, rename, leave. Admin-only controls hidden for members.
3. Sender name/avatar on group bubbles; system-message rendering.
4. `useTyping` (send true on first keystroke, false after 3 s idle or send; display with 4 s auto-expiry) and `TypingIndicator` ("Asha is typing...", "3 people are typing...").
5. `usePresence` + presence dot on avatars, "online" / "last seen today at 10:32" in `ChatHeader`.
6. Handle `conversation.removed` (close chat, toast).

## Tests
Permission matrix (member vs admin vs outsider for each group action); last-admin-leaves rule; removed user cannot send/read; typing throttle; presence multi-tab (online until last tab closes); privacy flag hides presence.

## Acceptance checklist
- [ ] Create a 3-person group; all see messages live with sender names.
- [ ] Non-admin cannot add/remove/rename (UI hidden and API 403).
- [ ] Removed member is kicked out instantly and cannot fetch history.
- [ ] Typing indicator shows and disappears correctly.
- [ ] Closing the last tab flips the user to offline with last seen.

## Commit
```bash
git add -A && git commit -m "Groups Presence"
```
