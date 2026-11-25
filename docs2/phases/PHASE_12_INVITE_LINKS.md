# Phase 12 - Group Invite Links

**Commit message:** `Invite Links`
**Prerequisites:** Phase 5 (groups) complete.
**Goal:** group admins create revocable invite links; people open the link, preview the group, and join instantly or after admin approval.
**Read:** `DATABASE.md` (V8), `API.md` (Invites), `SECURITY.md` (Invite links)

## Design decisions
1. **Code:** 32 random bytes, base64url (256 bits). Only the **SHA-256 hash** is stored; the full link is shown **once** at creation. The admin list shows a short prefix, creator, uses, expiry and status.
2. **Link format:** `https://<frontend-host>/join/<code>`. Frontend route `/join/:code`.
3. **Options per link:** expiry (1 h, 1 day, 7 days, 30 days, never), max uses (1, 10, 100, unlimited), **require admin approval** (yes/no).
4. **Who:** only group admins create/list/revoke links and handle join requests. Only groups (not direct chats).
5. **Limits:** max 10 active links per group; group size cap 256; rate-limit preview and join endpoints (10/min/user) to stop code guessing; return the same generic error for unknown, expired, revoked or full links.
6. **Bans:** a member removed by an admin is marked `banned` and cannot rejoin through a link; an admin must re-add them manually (which clears the flag).
7. **Auth:** preview and join need a logged-in user; unauthenticated visitors are sent to login/register and returned to `/join/:code` afterwards.
8. Joining adds a system message "Ravi joined using an invite link"; with approval required, admins get a `join_request.created` event and a badge.

## Backend tasks
1. Migration `V8__invites.sql`: `group_invites`, `group_join_requests`, `conversation_members.banned`.
2. `InviteService`: `create`, `list`, `revoke`, `preview(code)`, `join(code)` (transaction: lock invite row, check expiry/revoked/uses/size/banned/already member, increment `use_count`), `listRequests`, `approve`, `reject`.
3. Constant-time hash compare is not needed (lookup by hash), but never log codes.
4. Events: `conversation.created` to the joiner, `conversation.updated` to members, `join_request.created` / `join_request.decided` to admins/requester.
5. Scheduled cleanup of expired invites and old decided requests (> 30 days).
6. `ConversationService.removeMember` sets `banned = true`; `addMembers` clears it.

## Frontend tasks
1. Group info panel: "Invite link" section: create dialog (expiry, max uses, approval toggle), list with Revoke, **Copy** button, native Share button via `navigator.share` when available, optional QR code (small client-side lib or SVG generator).
2. `JoinPage` at `/join/:code`: glass card with group avatar, name, description, member count, whether approval is needed, **Join** / **Request to join** buttons, friendly errors (expired, revoked, full, banned message kept neutral).
3. After joining: redirect to the chat; after requesting: "Request sent" state.
4. Admin "Join requests" tab with Approve/Reject and a count badge on the group info icon.
5. Update the `ProtectedRoute` redirect so the `next` URL is preserved through login and register.

## Tests
Link lifecycle (create, preview, join, use count, max uses, expiry, revoke); race: two users use the last remaining use at the same time (only one succeeds); banned user cannot join; non-admin cannot create/list; approval flow; hash only stored in DB; brute-force rate limit 429. Playwright: full join flow including login redirect.

## Acceptance checklist
- [x] Admin creates a link, shares it, a logged-out user opens it, logs in and lands in the group.
- [x] Expired, revoked, full and banned cases show the right neutral messages.
- [x] Approval mode: request appears live for admins; approval adds the member instantly.
- [x] DB contains no plaintext codes; logs contain no codes.

## Commit
```bash
git add -A && git commit -m "Invite Links"
```
