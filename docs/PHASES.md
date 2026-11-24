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

## MVP line
Phases **1-4** deliver the MVP from the project document (register, search, direct chat, real-time messaging, history, basic presence is added in 5). Phases 5-8 complete the feature set. Phases 9-10 make it releasable.

## Phase completion routine
1. Implement all tasks in the phase file.
2. Run backend `./mvnw -q verify` and frontend `npm test -- --run && npm run build`.
3. Manually test with two browsers.
4. Tick every acceptance item.
5. Update docs if API/behaviour changed.
6. `git add -A && git commit -m "<message from table>"`.
