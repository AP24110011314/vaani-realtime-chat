# Phase 11 - @Mentions in Groups

**Commit message:** `Add Mentions`
**Prerequisites:** Phases 5 (groups) and 6 (unread) complete.
**Goal:** people can be @mentioned in groups, get highlighted and notified even when the group is muted, and see a separate "@" unread badge.
**Read:** `DATABASE.md` (V7), `API.md` (Mentions), `WEBSOCKET.md`, `UI_UX.md` (Mentions)

## Design decisions
1. **Storage format:** message `content` keeps a token `<@123>` for each mention (123 = user id). The raw text never contains the display name, so renamed users still render correctly. `<@all>` mentions everyone (**admins only**, rate limited to 1 per 5 min per group).
2. **Server is the authority:** the client sends `content` and the server parses tokens, keeps only tokens for **active members of that conversation**, stores them in `message_mentions`, and leaves invalid tokens as literal text. The client never sends a separate trusted mention list.
3. **DTO:** `MessageDto` gets `mentions: [{userId, name}]`, `mentionsAll: bool`, `mentionsMe: bool`. Previews (conversation list, notifications, search) are rendered server-side as `@Name`.
4. **Notification mode** replaces the simple mute flag: `ALL`, `MENTIONS` (only mentions/replies to me), `NONE`. A mention still notifies in `MENTIONS` mode, and in `NONE` mode only shows the in-app "@" badge (no browser notification).
5. A reply to my message counts as a mention for notification purposes (not for the "@" badge).
6. Mentions work in groups only; in direct chats typing `@` does nothing.

## Backend tasks
1. Migration `V7__mentions.sql` (see `DATABASE.md`).
2. `MentionParser` util: regex `<@(\d+|all)>`, max 20 mentions per message, de-duplicate, ignore tokens inside code spans if Markdown formatting exists.
3. `MessageService.send/edit`: parse, validate members, persist `message_mentions` (rebuild on edit; do not re-notify users who were already mentioned).
4. `ConversationDto.mentionUnreadCount` = mentions with `message_id > last_read_message_id` for me; update on `chat.read` and emit with `unread.updated`.
5. Notification decision helper `NotificationPolicy.shouldNotify(member, message)` used for event flags (`notify: true/false`) in `message.created`.
6. `PATCH /conversations/{id}/settings` accepts `notifyMode`. Keep `muted` as a read-only alias (`notifyMode == NONE`).
7. `GET /conversations/{id}/mentionable?query=` returns members matching a prefix (max 8, excludes self, active only).
8. Search: mentions are searchable by name via the rendered text, not by token.

## Frontend tasks
1. `MentionPicker`: typing `@` at a word boundary opens a glass popup above the composer (arrow keys, Enter/Tab to select, Esc to close), filter as you type, avatar + name, `@all` shown only to admins.
2. Composer keeps mentions as inline "chips" in the editor value; on send they are converted to `<@id>` tokens. Use a controlled textarea with an overlay or a small contenteditable wrapper; **never** `dangerouslySetInnerHTML` (see `SECURITY.md`).
3. `MessageBubble` renders tokens as accent-coloured `@Name` pills (click opens member info); mentions of me get a highlighted bubble outline.
4. Conversation list: "@" badge (accent) next to the unread count when `mentionUnreadCount > 0`; "Mentions" filter tab/chip.
5. In-chat "Jump to next mention" floating button.
6. Notification mode selector in the conversation menu (All / Mentions only / Off) with explanatory text.
7. Browser notification text: "Asha mentioned you in Team".

## Tests
Parser (valid, invalid ids, duplicates, non-members, `<@all>` by non-admin ignored); notification policy matrix (ALL/MENTIONS/NONE x mention/reply/plain); `mentionUnreadCount` correctness after read; edit does not re-notify; user removed from group is no longer mentionable; XSS payload inside a name renders as text. Playwright: A mentions B in a group; B (group muted) still gets the "@" badge.

## Acceptance checklist
- [ ] `@` opens the picker; selection inserts a chip; sent message shows a highlighted pill for both users.
- [ ] A mentioned user in a `MENTIONS`-only group is notified; a non-mentioned one is not.
- [ ] `@all` works for admins and is ignored for members (UI hidden and server enforced).
- [ ] "@" badge clears when the mention is read.
- [ ] Renaming a user updates existing mention pills.

## Commit
```bash
git add -A && git commit -m "Add Mentions"
```
