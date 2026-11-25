# Vanni - Feature List

Tiers: **Core** = required for the first release (from the project document). **Extended** = high-value additions. **Stretch** = only if time allows.
Phase column shows where each feature is built.

## Core
| # | Feature | Phase |
|---|---|---|
| 1 | Register with name, email, password (validation + unique email) | 2 |
| 2 | Login / logout, protected routes, session refresh | 2 |
| 3 | Landing page with Vanni branding | 2 |
| 4 | User search by name or email | 3 |
| 5 | Create/reopen direct conversation (no duplicates) | 3 |
| 6 | Conversation list sorted by latest activity, last-message preview | 3 |
| 7 | Send text messages, persisted in MySQL | 3 |
| 8 | Cursor-paginated message history | 3 |
| 9 | Real-time delivery over WebSocket/STOMP with reconnect | 4 |
| 10 | Optimistic sending with pending / failed / retry state | 4 |
| 11 | Online/offline presence | 5 |
| 12 | Typing indicator | 5 |
| 13 | Group chats (create, add/remove members, rename, leave) | 5 |
| 14 | Group admin roles | 5 |
| 15 | Delivery + read receipts (single/double/blue ticks) | 6 |
| 16 | Unread counts per conversation | 6 |
| 17 | Attachments (images, PDF, docs) with validation | 7 |
| 18 | Profile: display name, avatar, about | 7 |
| 19 | Responsive layout (mobile collapsible sidebar) | 1-7 |

## Extended
| # | Feature | Phase |
|---|---|---|
| 20 | Edit own message (shows "edited") | 8 |
| 21 | Delete own message (soft delete, "message deleted") | 8 |
| 22 | Reply to a message (quoted preview) | 8 |
| 23 | Emoji reactions | 8 |
| 24 | Emoji picker in composer | 8 |
| 25 | Browser tab title unread count | 8 |
| 26 | Browser (Web Notifications API) alerts with permission prompt | 8 |
| 27 | Mute / archive / pin conversation | 8 |
| 28 | Search within a conversation, and across conversations | 8 |
| 29 | Image preview lightbox, drag-and-drop upload, paste image | 8 |
| 30 | Dark / light theme (system default + toggle) | 8 |
| 31 | Block user; privacy settings (hide last seen / read receipts) | 8 |
| 32 | Date separators, grouped bubbles, "jump to latest" button | 8 |
| 33 | Link detection (clickable URLs, no remote preview in v1) | 8 |
| 34 | Group avatar and group description | 8 |

## Stretch
| # | Feature |
|---|---|
| 35 | Installable PWA (still a web app) |
| 36 | Voice message recording in browser (MediaRecorder) |
| 37 | Forward message |
| 38 | Starred messages |
| 39 | Link previews (server-side fetch with SSRF protection) |
| 40 | Platform admin dashboard + report/moderation queue |
| 41 | Account deletion / data export |
| 42 | i18n (English + one more language) |

## Advanced (selected for Phases 11-17)
| # | Feature | Phase |
|---|---|---|
| 43 | @mentions in groups (`@name`, `@all` for admins), "@" unread badge, notification modes All / Mentions only / Off | 11 |
| 44 | Group invite links: expiry, max uses, optional admin approval, QR/share, revoke, preview page | 12 |
| 45 | Voice messages: in-browser recording, waveform, seek, 1x/1.5x/2x speed | 13 |
| 46 | Link previews: safe server-side fetch, cached, proxied images, per-user toggle | 14 |
| 47 | Scheduled messages: send later, edit, cancel, send now, failure visibility | 15 |
| 48 | "Catch me up": opt-in AI summary (key points, decisions, action items, for you) | 16 |
| 49 | 1:1 voice and video calls with call history, mute, camera, TURN support | 17 |

(Stretch items 36 "Voice message recording" and 39 "Link previews" above are now covered by #45 and #46.)

## Explicitly out of scope
Native mobile/desktop apps, group calls, call recording, end-to-end encryption, payments. (1:1 calls are now in scope: Phase 17.)
