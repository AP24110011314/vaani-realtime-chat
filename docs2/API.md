# Vanni - REST API

Base path: `/api`. JSON in/out, UTF-8. Auth via HttpOnly cookies (`vanni_at`, `vanni_rt`). State-changing requests (POST/PUT/PATCH/DELETE) must send header `X-XSRF-TOKEN` (value of the `XSRF-TOKEN` cookie). Axios does this automatically when configured with `withXSRFToken: true`.

## Conventions
- Timestamps: ISO-8601 UTC, e.g. `2026-11-24T09:30:00.123Z`.
- Pagination: cursor (`before`/`after` message id + `size`, default 30, max 100). Lists of users/conversations use `page`/`size`.
- Error shape (all errors):
```json
{ "timestamp": "2026-11-24T09:30:00Z", "status": 403, "code": "NOT_A_MEMBER",
  "message": "You are not a member of this conversation", "path": "/api/conversations/9/messages",
  "details": { "field": "reason" } }
```
- Common codes: `VALIDATION_FAILED` 400, `UNAUTHENTICATED` 401, `FORBIDDEN`/`NOT_A_MEMBER` 403, `NOT_FOUND` 404, `EMAIL_TAKEN` 409, `RATE_LIMITED` 429.
- Do **not** reveal whether an email exists on login failure ("Invalid email or password").

## DTO shapes
```jsonc
// UserSummary
{ "id": 4, "name": "Asha", "avatarUrl": null, "about": "Hey there", "online": true, "lastSeenAt": null }
// UserMe  (UserSummary + email + privacy)
{ "id": 1, "name": "...", "email": "...", "avatarUrl": "...", "about": "...", "showLastSeen": true, "showReadReceipts": true }
// ConversationDto
{ "id": 12, "type": "DIRECT", "title": "Asha", "avatarUrl": null, "description": null,
  "members": [UserSummary], "myRole": "MEMBER", "muted": false, "archived": false, "pinned": false,
  "unreadCount": 3, "lastMessage": MessageDto|null, "updatedAt": "..." }
// MessageDto
{ "id": 501, "conversationId": 12, "sender": UserSummary, "clientMessageId": "uuid",
  "content": "hi", "type": "TEXT", "replyTo": { "id": 480, "senderName": "Asha", "snippet": "..." } | null,
  "attachments": [AttachmentDto], "reactions": [{ "emoji": "👍", "count": 2, "reactedByMe": true }],
  "status": "SENT|DELIVERED|READ", "createdAt": "...", "editedAt": null, "deleted": false }
// AttachmentDto
{ "id": 9, "fileName": "report.pdf", "mimeType": "application/pdf", "size": 120394,
  "url": "/api/attachments/9", "width": null, "height": null }
```

## Auth
| Method | Endpoint | Body | Result |
|---|---|---|---|
| POST | `/auth/register` | `{name,email,password}` | 201 `UserMe`; sets cookies |
| POST | `/auth/login` | `{email,password}` | 200 `UserMe`; sets cookies |
| POST | `/auth/refresh` | - (refresh cookie) | 200; rotates both cookies |
| POST | `/auth/logout` | - | 204; revokes refresh token, clears cookies |
| POST | `/auth/logout-all` | - | 204; revokes all refresh tokens |
| POST | `/auth/change-password` | `{currentPassword,newPassword}` | 204 |

Password rules: min 8 chars, at least one letter and one digit (max 72 bytes because of BCrypt). Name 2-80 chars. Email normalised to lowercase.

## Users
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/users/me` | Current profile |
| PATCH | `/users/me` | Update `name`, `about`, `showLastSeen`, `showReadReceipts` |
| POST | `/users/me/avatar` | Multipart image (<=2 MB, jpeg/png/webp) -> `UserMe` |
| DELETE | `/users/me/avatar` | Remove avatar |
| GET | `/users?query=&page=&size=` | Search by name/email (query >= 2 chars; excludes self and users who blocked me) |
| GET | `/users/{id}` | Public profile (`UserSummary`) |
| POST | `/users/{id}/block` | Block user |
| DELETE | `/users/{id}/block` | Unblock |
| GET | `/users/blocked` | List blocked users |

## Conversations
| Method | Endpoint | Body / Params | Result |
|---|---|---|---|
| GET | `/conversations?archived=false` | | `ConversationDto[]` sorted pinned first, then `lastMessageAt` desc |
| GET | `/conversations/{id}` | | `ConversationDto` (member only) |
| POST | `/conversations/direct` | `{userId}` | 200/201 `ConversationDto` (get-or-create) |
| POST | `/conversations/groups` | `{title, description?, memberIds[]}` | 201 `ConversationDto`; creator = ADMIN |
| PATCH | `/conversations/{id}` | `{title?, description?}` | group admin only |
| POST | `/conversations/{id}/avatar` | multipart | group admin only |
| POST | `/conversations/{id}/members` | `{userIds[]}` | group admin only |
| DELETE | `/conversations/{id}/members/{userId}` | | admin removes member |
| POST | `/conversations/{id}/leave` | | member leaves (last admin leaving promotes oldest member) |
| PATCH | `/conversations/{id}/members/{userId}/role` | `{role}` | admin promote/demote |
| PATCH | `/conversations/{id}/settings` | `{muted?, archived?, pinned?}` | per-user settings |

## Messages
| Method | Endpoint | Notes |
|---|---|---|
| GET | `/conversations/{id}/messages?before=&after=&size=` | Newest-first page by default (`before`); `after` is used to fill gaps after reconnect |
| POST | `/conversations/{id}/messages` | REST fallback send: `{clientMessageId, content, replyToId?, attachmentIds?}` -> 201 `MessageDto`. Same service as WebSocket send |
| PATCH | `/messages/{id}` | `{content}` - sender only, not deleted, within edit window (e.g. 15 min optional) |
| DELETE | `/messages/{id}` | Sender (or group admin) - soft delete |
| PUT | `/messages/{id}/reactions` | `{emoji}` - toggle my reaction |
| GET | `/messages/{id}/receipts` | Per-user delivered/read (sender only) |
| POST | `/conversations/{id}/read` | `{lastMessageId}` - mark read (REST fallback for the WS event) |
| GET | `/search/messages?q=&conversationId=&page=` | Scoped to my conversations |

Content rules: trimmed, 1-4000 chars unless attachments present; reject control characters except newline/tab. Output is always plain text; the React client escapes it (never use `dangerouslySetInnerHTML`).

## Attachments
| Method | Endpoint | Notes |
|---|---|---|
| POST | `/attachments` | Multipart `file`; <= `MAX_UPLOAD_MB`; returns `AttachmentDto` (unattached) |
| GET | `/attachments/{id}` | Membership-checked download/redirect to short-lived URL; `Content-Disposition` set; `X-Content-Type-Options: nosniff` |

Allowed MIME (validated by content sniffing, not by extension): `image/jpeg, image/png, image/gif, image/webp, application/pdf, text/plain, application/zip, application/msword`, `.docx/.xlsx/.pptx` OOXML types. Block executables and scripts (`.exe .sh .bat .js .html .svg` unless sanitised).

## Misc
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/presence?userIds=1,2,3` | Snapshot of online users (initial load) |
| GET | `/health` (actuator `/actuator/health`) | Liveness for deployment |

## Advanced endpoints (Phases 11-17)

### Mentions (Phase 11)
| Method | Endpoint | Notes |
|---|---|---|
| GET | `/conversations/{id}/mentionable?query=` | Active members matching the prefix, max 8, excludes me; groups only |
| PATCH | `/conversations/{id}/settings` | now also accepts `notifyMode: ALL|MENTIONS|NONE` (`muted` remains as a read-only alias) |

`MessageDto` additions: `mentions: [{userId, name}]`, `mentionsAll`, `mentionsMe`. `ConversationDto` addition: `mentionUnreadCount`, `notifyMode`. Message content uses tokens `<@userId>` / `<@all>`.

### Invite links (Phase 12)
| Method | Endpoint | Notes |
|---|---|---|
| POST | `/conversations/{id}/invites` | Admin. `{expiresInSeconds?, maxUses?, requiresApproval}` -> `{id, url, expiresAt, ...}`. **The `url` is returned only here** |
| GET | `/conversations/{id}/invites` | Admin. List without the full code (prefix only) |
| DELETE | `/conversations/{id}/invites/{inviteId}` | Admin. Revoke |
| GET | `/invites/{code}` | Auth. Preview `{conversationId?, title, avatarUrl, description, memberCount, requiresApproval}`; generic 404 for any invalid state |
| POST | `/invites/{code}/join` | Auth. `200 {status: "JOINED", conversation}` or `202 {status: "PENDING"}` |
| GET | `/conversations/{id}/join-requests?status=PENDING` | Admin |
| POST | `/conversations/{id}/join-requests/{requestId}/approve` | Admin |
| POST | `/conversations/{id}/join-requests/{requestId}/reject` | Admin |

Codes: 256-bit random, base64url, only the SHA-256 hash is stored. Rate limit: 10/min/user on preview and join.

### Voice messages (Phase 13)
| Method | Endpoint | Notes |
|---|---|---|
| POST | `/attachments/voice` | Multipart `file` + fields `durationMs` (1-300000) and `waveform` (64 bytes, base64). Returns `AttachmentDto` with `durationMs`, `waveform` |
| POST | `/conversations/{id}/messages` | `type: "VOICE"` with exactly one voice `attachmentIds` entry and no text |
| GET | `/attachments/{id}` | Supports `Range` (206 Partial Content) |

### Link previews (Phase 14)
| Method | Endpoint | Notes |
|---|---|---|
| GET | `/previews/{id}/image` | Authenticated; serves our stored copy of the preview image |
| DELETE | `/messages/{id}/previews` | Sender only; removes preview cards from my message |
| PATCH | `/users/me` | accepts `linkPreviewsEnabled` |

`MessageDto` addition: `previews: [{id, url, siteName, title, description, imageUrl|null, imageWidth, imageHeight}]`, delivered later through a `message.updated` event.

### Scheduled messages (Phase 15)
| Method | Endpoint | Notes |
|---|---|---|
| POST | `/conversations/{id}/scheduled` | `{content, replyToId?, attachmentIds?, scheduledFor}` (ISO UTC, 1 min to 90 days ahead) -> `ScheduledDto` |
| GET | `/scheduled?status=PENDING` | My scheduled messages |
| PATCH | `/scheduled/{id}` | `{content?, scheduledFor?}` while `PENDING` |
| POST | `/scheduled/{id}/send-now` | Sends immediately |
| DELETE | `/scheduled/{id}` | Cancel |

`ScheduledDto`: `{id, conversationId, content, attachments, scheduledFor, status, failureReason, sentMessageId}`.

### AI: Catch me up (Phase 16)
| Method | Endpoint | Notes |
|---|---|---|
| PUT | `/users/me/ai-consent` | `{enabled}` |
| POST | `/conversations/{id}/catch-up` | `{fromMessageId?}` -> `{messageCount, fromMessageId, toMessageId, generatedAt, summary}`; see `AI_FEATURES.md` for the schema and error codes (`AI_NOT_ENABLED`, `NOTHING_TO_SUMMARISE`, `AI_UNAVAILABLE`, `AI_BAD_RESPONSE`) |

### Calls (Phase 17)
| Method | Endpoint | Notes |
|---|---|---|
| GET | `/calls/ice-servers` | STUN + TURN with short-lived credentials; `relayOnly` per user setting |
| GET | `/conversations/{id}/calls?page=` | Call history |
| PATCH | `/users/me` | accepts `callsRelayOnly` |

Call control itself is over WebSocket, see `WEBSOCKET.md` and `CALLS_WEBRTC.md`.
