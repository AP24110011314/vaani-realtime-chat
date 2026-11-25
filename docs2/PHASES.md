# Vanni - Development Phases

Build in order. One commit per phase, using the 2-3 word message below.

| # | Phase | Outcome | Commit message | Doc |
|---|---|---|---|---|
| 1 | Project setup | Frontend, backend, MySQL all run locally (ports 5173 / 8080 / 3307) | `Project Setup` | [PHASE_01](phases/PHASE_01_PROJECT_SETUP.md) |
| 2 | Authentication | Register, login, logout, refresh, protected routes, landing page | `Add Authentication` | [PHASE_02](phases/PHASE_02_AUTHENTICATION.md) |
| 3 | Direct chat (REST) | User search, direct conversations, messages + history via REST, full chat UI | `Direct Conversations` | [PHASE_03](phases/PHASE_03_DIRECT_CHAT.md) |
| 4 | Real-time messaging | STOMP, live delivery, optimistic send, reconnect | `Realtime Messaging` | [PHASE_04](phases/PHASE_04_REALTIME.md) |
| 5 | Groups & presence | Group chats, roles, typing, online/offline | `Groups Presence` | [PHASE_05](phases/PHASE_05_GROUPS_PRESENCE.md) |
| 6 | Receipts & unread | Delivered/read ticks, unread counts, notifications basics | `Read Receipts` | [PHASE_06](phases/PHASE_06_RECEIPTS_UNREAD.md) |
| 7 | Attachments & profile | File/image sharing, avatars, profile page | `File Sharing` | [PHASE_07](phases/PHASE_07_ATTACHMENTS_PROFILE.md) |
| 8 | Message enhancements | Edit/delete, replies, reactions, emoji, search, mute/pin/archive, block, dark mode | `Message Features` | [PHASE_08](phases/PHASE_08_ENHANCEMENTS.md) |
| 9 | Quality & security | Test suite, security review, rate limits, accessibility | `Security Testing` | [PHASE_09](phases/PHASE_09_QUALITY_SECURITY.md) |
| 10 | Deployment & docs | Docker, CI, production config, final README, screenshots | `Production Ready` | [PHASE_10](phases/PHASE_10_DEPLOYMENT.md) |
| 11 | @Mentions | Mention members in groups, "@" badge, notify modes | `Add Mentions` | [PHASE_11](phases/PHASE_11_MENTIONS.md) |
| 12 | Group invite links | Revocable links, preview page, optional admin approval | `Invite Links` | [PHASE_12](phases/PHASE_12_INVITE_LINKS.md) |
| 13 | Voice messages | Record, send, play with waveform and speed | `Voice Messages` | [PHASE_13](phases/PHASE_13_VOICE_MESSAGES.md) |
| 14 | Link previews | Safe server-side preview cards (SSRF protected) | `Link Previews` | [PHASE_14](phases/PHASE_14_LINK_PREVIEWS.md) |
| 15 | Scheduled messages | Send later, manage and cancel | `Scheduled Messages` | [PHASE_15](phases/PHASE_15_SCHEDULED_MESSAGES.md) |
| 16 | Catch me up (AI) | Opt-in AI summary of missed messages | `Catch Me Up` | [PHASE_16](phases/PHASE_16_CATCH_ME_UP.md) |
| 17 | 1:1 voice and video calls | WebRTC calls with TURN, call history | `Video Calls` | [PHASE_17](phases/PHASE_17_VIDEO_CALLS.md) |

## MVP line
Phases **1-4** deliver the MVP from the project document (register, search, direct chat, real-time messaging, history, basic presence is added in 5). Phases 5-8 complete the feature set. Phases 9-10 make it releasable.

## Phase completion routine
1. Implement all tasks in the phase file.
2. Run backend `./mvnw -q verify` and frontend `npm test -- --run && npm run build`.
3. Manually test with two browsers.
4. Tick every acceptance item.
5. Update docs if API/behaviour changed.
6. `git add -A && git commit -m "<message from table>"`.

## Phases 11-17 (advanced features)
These build on the finished core app. Do them in order; each ends with one commit.

| Phase | Needs from earlier phases |
|---|---|
| 11 Mentions | 5 groups, 6 unread |
| 12 Invite links | 5 groups |
| 13 Voice messages | 7 attachments |
| 14 Link previews | 4 real-time, 7 storage |
| 15 Scheduled messages | 4, 7 |
| 16 Catch me up | 6 unread counts |
| 17 Calls | 4, 5, 6 (largest phase, do last) |

Phases 9-10 (quality, deployment) can be done **before** these, with the advanced phases then following a normal release; or after them if you want everything in one launch. If you do them after, re-run the Phase 9 security checklist and extend it with the new items in `SECURITY.md` section 10.

Extra reference docs for this block: `AI_FEATURES.md` (Phase 16) and `CALLS_WEBRTC.md` (Phase 17).
