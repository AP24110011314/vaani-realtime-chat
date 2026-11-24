# Phase 8 - Message Features and Polish

**Commit message:** `Message Features`
**Goal:** the Extended tier from `FEATURES.md`.
**Read:** `FEATURES.md` (#20-34), `API.md`, `WEBSOCKET.md`, `UI_UX.md`

## Backend tasks
1. Migration `V6__reactions_blocks.sql` (`reactions`, `blocks`).
2. **Edit** `PATCH /messages/{id}` (sender only, not deleted, text only) -> `edited_at`, emit `message.updated`.
3. **Delete** `DELETE /messages/{id}` (sender or group admin) -> soft delete, hide content in DTOs, delete attachments from storage, emit `message.deleted`.
4. **Reply:** validate `replyToId` is in the same conversation; DTO includes `replyTo` preview.
5. **Reactions:** `PUT /messages/{id}/reactions` toggles; DTO aggregates; emit `message.updated`.
6. **Conversation settings:** `PATCH /conversations/{id}/settings` (mute, archive, pin); list ordering pinned first; archived hidden by default; mute suppresses notifications only.
7. **Search:** `GET /search/messages` scoped to the caller's active conversations (LIKE; add FULLTEXT optional); highlight offsets optional.
8. **Block/unblock** and enforcement (no new direct chat, no sending, no presence); privacy toggles from Phase 6 exposed in settings.
9. Group description and avatar endpoints.

## Frontend tasks
1. Message action menu (hover / long-press): reply, react, copy, edit, delete (confirm), info.
2. Reply banner in composer and quoted preview in bubble (click jumps to original).
3. Reaction bar and emoji picker in composer.
4. "edited" label; "This message was deleted" placeholder.
5. In-chat search (header icon) with result list and jump-to; global search in sidebar.
6. Mute/pin/archive menu on conversations; Archived tab.
7. Browser notifications: explicit "Enable notifications" button in Settings (Web Notifications API); show only when tab hidden and chat not muted.
8. Theme: system/light/dark with `ThemeContext` and toggle; persist preference (localStorage is fine in the real app).
9. Image lightbox with next/prev, keyboard support; "jump to latest" button; clickable links (`rel="noopener noreferrer nofollow"`).
10. `SettingsPage`: theme, notifications, blocked users, privacy toggles, logout all devices.

## Tests
Edit/delete permissions; deleted content never returned; reaction toggle idempotence; block rules; search never returns messages from other conversations; muted conversation emits no notification.

## Acceptance checklist
- [ ] All Extended features #20-34 work in two browsers, live.
- [ ] Dark mode has no unreadable text.
- [ ] A blocked user cannot message or find the blocker.
- [ ] Search finds only the user's own conversations.

## Commit
```bash
git add -A && git commit -m "Message Features"
```
