# Vanni QA Verification Report (Part A)

**Date:** 2026-11-25  
**Scope:** Full-stack verification of Phases 1–10 (Core #1–19, Extended #20–34) against `docs/PHASES.md`, `docs/FEATURES.md`, `docs/API.md`, `docs/WEBSOCKET.md`, `docs/SECURITY.md`, `docs/TESTING.md`, and `docs/UI_UX.md`.

---

## 1. Automated Verification Summary

| Check | Result | Scope & Evidence |
| :--- | :--- | :--- |
| `./mvnw -q verify` | **PASS** | 74 integration & unit tests passed (`VanniApplicationTests`, `AuthIntegrationTest`, `ConversationIntegrationTest`, `GroupAndPresenceIntegrationTest`, `ReceiptsIntegrationTest`, `AttachmentsAndProfileIntegrationTest`, `EnhancementsIntegrationTest`, `WebSocketIntegrationTest`, `SecurityChecklistIntegrationTest`). |
| `npm run lint` | **PASS** | ESLint exited with code `0` (0 errors, 0 warnings). |
| `npm test -- --run` | **PASS** | Vitest `2` files, `56` tests passed (`App.test.jsx`: 47, `msw.test.jsx`: 9). |
| `npm run build` | **PASS** | Production bundle compiled via Vite (`vite build`) in 284 ms. |
| `npx playwright test --reporter=list` | **PASS** | `e2e/vanni.spec.js` multi-context Chromium E2E test passed (`1 passed (22.2s)`). |
| Live QA Matrix (`qa_part_a_matrix.mjs`) | **PASS** | Verified logout cookie clearing, WS security, two-tab presence, privacy flags, 105-msg infinite scroll, >4000-char rejection, reactions, soft delete, block/unblock, in-chat search, 390/768/1440px overflow checks, and `consoleIssuesA: []`. |
| Reconnect Probe (`qa_disconnect_test.mjs`) | **PASS** | Killed running Spring Boot backend -> `"Reconnecting"` / offline banner shown -> send failed with `"Retry"` -> restarted backend -> auto-reconnected & retry delivered with `countA: 1, countB: 1, noDuplicates: true`. |

---

## 2. Test Matrix Results

### AUTH
| Item | Status | Evidence |
| :--- | :--- | :--- |
| Register valid / duplicate email (`409`) / weak password (`400`) / invalid email (`400`) | **PASS** | Verified via `AuthIntegrationTest`, `e2e/vanni.spec.js` (registering Asha, Ravi, Mira via `/register`), and live API probe (`409 Conflict` duplicate, `400` invalid email/weak password). Inline UI validation checked in `App.test.jsx`. |
| Login OK / generic error for wrong password and unknown email | **PASS** | `AuthIntegrationTest` & live API probe confirmed identical `"Invalid email or password"` `401` error for both unknown email and wrong password. |
| HttpOnly cookies, zero tokens in `localStorage`/`sessionStorage` | **PASS** | `Set-Cookie` sets `HttpOnly` on `vanni_at` (`Path=/`, `SameSite=Lax`) and `vanni_rt` (`Path=/api/auth`, `SameSite=Strict`). Playwright `qa_part_a_matrix.mjs` confirmed `storageKeys: { local: [], session: [] }`. |
| Page refresh keeps session; protected route redirects; `/login` redirects when authed | **PASS** | `e2e/vanni.spec.js` reloaded `/app/c/{id}` and preserved session + messages; `App.test.jsx` & router guards enforce `/login` <-> `/app` redirects. |
| Refresh token rotation, reuse detection, expired access token refresh, logout clears cookies | **PASS** | Live probe confirmed `POST /auth/refresh` returns `200`, rotates `vanni_rt`, rejects reused token (`401`) and revokes token family (`401`). `SecurityChecklistIntegrationTest#auth_expiredAccessTokenRefreshedViaRefreshCookie` verified expired JWT (`401`) refreshes cleanly to working `vanni_at` (`200`). `POST /auth/logout` returned `204` clearing both `vanni_at` & `vanni_rt` (`Max-Age=0`). |
| CSRF protection & stateless token preservation | **PASS** | Missing `X-XSRF-TOKEN` rejected with `403` (`SecurityChecklistIntegrationTest`). Fixed bug where Spring Security rotated `XSRF-TOKEN` on every authenticated request; verified live via `WebSocketIntegrationTest#csrf_authenticatedRequestsPreserveXsrfCookie` and Playwright group removal `DELETE` (`204`). |
| Login, register, search, upload, message rate limiting (`429` + `Retry-After`) | **PASS** | Verified in `SecurityChecklistIntegrationTest#rateLimits_loginRegisterSearchMessagesAndUploadReturn429WithRetryAfter` and `rateLimits_restSendAndUploadReturn429WithRetryAfter`. |

### USERS AND SEARCH
| Item | Status | Evidence |
| :--- | :--- | :--- |
| Search by name & email (`min 2 chars`), excludes self, debounce, empty state | **PASS** | Verified in `e2e/vanni.spec.js` (`New Chat` & `New Group` search), `AttachmentsAndProfileIntegrationTest`, and `App.test.jsx`. |
| Profile update, avatar upload/remove, change password | **PASS** | Verified in `AttachmentsAndProfileIntegrationTest`, `AuthIntegrationTest` (password change revokes tokens & clears cookies), and live API probe. |

### DIRECT CHAT
| Item | Status | Evidence |
| :--- | :--- | :--- |
| Start chat idempotency (concurrent/repeat opens same conversation) | **PASS** | `ConversationIntegrationTest` + live concurrent `POST /conversations/direct` probe returned identical conversation ID. |
| Text send, `Shift+Enter` newline, `Enter` send, blank blocked, `>4000` rejected, `utf8mb4` | **PASS** | Playwright `qa_part_a_matrix.mjs` sent `Line1\nLine2` (`Shift+Enter`), verified `>4000` alert (`overLimitAlertVisible: true`), and rendered `'Namaste 🙏 नमस्ते مرحبا 🚀\nLine 2 here'`. |
| Infinite scroll up loads older messages without scroll jump | **PASS** | Seeded 105+ messages (`BulkMsg #001..#105`), scrolled to `scrollTop = 0`, verified `afterPrependCount: 120` and preserved `scrollTopAfterPrepend: 1979 > 0` after fixing `MessageList.jsx` & `ChatWindow.jsx`. |
| Conversation list sorting & latest preview | **PASS** | Verified in `ConversationIntegrationTest` and visually in Playwright sidebar screenshots. |

### REAL-TIME & RECONNECT
| Item | Status | Evidence |
| :--- | :--- | :--- |
| Instant two-way DM & multi-tab same-user sync | **PASS** | `e2e/vanni.spec.js` verified live two-browser DM delivery (`pageA` <-> `pageB`) and `pageA2` second-tab preview update without reload. |
| Optimistic send -> server ack deduplication | **PASS** | Verified in `SocketContext.jsx` / `ChatWindow.jsx` tests (`App.test.jsx`) and `e2e/vanni.spec.js`. |
| Kill backend -> `"Reconnecting"` banner -> failed send `"Retry"` -> restart auto-reconnect | **PASS** | `qa_disconnect_test.mjs` verified `"Reconnecting to server..."` banner on backend kill, `"Retry"` button on failed send, auto-reconnect on backend restart, and `countA: 1, countB: 1` (`noDuplicates: true`). `SocketContext` also refreshes expired token in `beforeConnect`. |
| Unauthorized WS handshake, foreign queue/topic subscribe, non-member `chat.send` | **PASS** | `qa_part_a_matrix.mjs` verified unauthenticated WS rejected (`1006`), `/topic/public` & foreign queue rejected (`ERROR`, closed `1002`), and foreign `chat.send` returned `{"type":"error",...}` with `storedInDb: false`. |

### PRESENCE AND TYPING
| Item | Status | Evidence |
| :--- | :--- | :--- |
| Multi-tab online dot & offline `lastSeenAt` on last tab close | **PASS** | `qa_part_a_matrix.mjs` connected 2 WS sessions for Ravi: closed 1 (`oneClosed: true`), closed 2 (`bothClosed: false`, `lastSeenAfterClose` timestamp populated). Fixed race condition on concurrent WS connect (`ReceiptService`). |
| Typing indicator & throttling | **PASS** | `e2e/vanni.spec.js` verified `"typing"` indicator shown on `pageA` when `pageB` typed; `useTyping` debounces/throttles at 2s/3s idle. |
| Privacy: `showLastSeen=false` hides last seen & online | **PASS** | `qa_part_a_matrix.mjs` (`PATCH /api/users/me` `{ showLastSeen: false }`) verified `lastSeenHiddenWhenOffline: true`. |

### GROUPS
| Item | Status | Evidence |
| :--- | :--- | :--- |
| Create group live with sender names & system messages | **PASS** | `e2e/vanni.spec.js` created group `E2E Squad`, verified system message (`created group`) and live delivery to Mira (`pageC`) & Ravi (`pageB`). |
| Admin actions (rename/desc/avatar/add/remove/role), non-admin `403`, removed member kicked immediately, leave & admin promotion | **PASS** | `GroupAndPresenceIntegrationTest` verified role checks (`403`), leave + admin promotion, system messages, and history restriction (`404`). `e2e/vanni.spec.js` verified live removal (`DELETE /members/{id}` -> `204`) immediately returns removed user (`pageC`) to empty workspace state (`Welcome to Vanni`). Group avatar upload + IDOR `404` fixed & tested in `SecurityChecklistIntegrationTest#idor_outsiderCannotDownloadGroupAvatar`. |

### RECEIPTS, UNREAD, ATTACHMENTS, ACTIONS, BLOCKING, SEARCH, UI
| Item | Status | Evidence |
| :--- | :--- | :--- |
| Sent -> Delivered -> Read ticks only when focused, visible & at bottom; group receipts modal | **PASS** | `e2e/vanni.spec.js` confirmed `"Read"` tick; `SocketContext.jsx` / `ChatWindow.jsx` enforce focus + visibility + bottom check (`App.test.jsx`). `ReceiptsIntegrationTest` verifies group receipt aggregation & details. |
| Unread badge counts, `(n) Vanni` title, `showReadReceipts=false` suppression | **PASS** | `qa_part_a_matrix.mjs` observed `"(1) Vanni"` title and verified `statusWithReadReceiptsOff: "DELIVERED"`. |
| Attachments upload, progress/cancel, MIME/magic-byte rejection, traversal safety, download IDOR (`404`) | **PASS** | `e2e/vanni.spec.js` uploaded valid PNG (`img[alt="photo.png"]` rendered in `pageB`) and verified spoofed `.exe.png` rejected with `400` + error alert; `AttachmentsAndProfileIntegrationTest` & `attachmentApi.js` `AbortController` cancel tested. |
| Edit within 15 min (`edited` label), soft delete, emoji reactions, reply quote, pin/mute/archive | **PASS** | `e2e/vanni.spec.js` edited live (`edited` label visible), `qa_part_a_matrix.mjs` toggled `👍` reaction, soft-deleted (`"This message was deleted"`), pinned/muted (`200`), and `EnhancementsIntegrationTest` tested archive/replies/15m window. |
| Block / Unblock (UI toggle + API enforcement + blocked user hides online/lastSeen/about/search) | **PASS** | `qa_part_a_matrix.mjs` toggled Block/Unblock in `ChatHeader`; `SecurityChecklistIntegrationTest#blockedUser_cannotSeePresenceOrSearchOrDirectChat` + `qa_deep_probe.mjs` verified live presence hiding (`blockedSeesOnline: false`). |
| In-chat & global message search | **PASS** | `qa_part_a_matrix.mjs` searched `"BulkMsg #105"` via header search (`searchResultFound: true`). |
| Theme toggle (`Onyx` dark / `Pearl` light), Glass styling, zero indigo/purple, 390/768/1440px mobile/tablet/desktop, zero console errors | **PASS** | Verified via `e2e/vanni.spec.js` & screenshots (`overflow768: false`, `overflow390: false`, `consoleIssuesA: []`), clean backend logs (`task-4241.log`). |

### STRETCH & OUT-OF-SCOPE FEATURES (`NOT IMPLEMENTED`)
Per `docs/PHASES.md` and `docs/FEATURES.md`, the following stretch/out-of-scope items are not implemented in this codebase:
- **NOT IMPLEMENTED:** PWA manifest / service worker / offline message queue (#35)
- **NOT IMPLEMENTED:** Voice message recording & waveform playback (#36)
- **NOT IMPLEMENTED:** Message forwarding & starred messages (#37, #38)
- **NOT IMPLEMENTED:** Rich link previews / OpenGraph fetching (#39)
- **NOT IMPLEMENTED:** Admin moderation dashboard / abuse reports (#40)
- **NOT IMPLEMENTED:** Account deletion / full GDPR data export (#41)
- **NOT IMPLEMENTED:** Multi-language i18n (#42)
- **NOT IMPLEMENTED (Out of Scope):** Native mobile/desktop apps, voice/video calls, end-to-end encryption (E2EE), in-app payments.

---

## 3. Bugs Found and Fixed in Part A

1. **Spring Security Stateless CSRF Rotation (`SecurityConfig.java`)**  
   - **Bug:** With `SessionCreationPolicy.STATELESS` and `CookieCsrfTokenRepository`, `SessionManagementFilter` treated each authenticated JWT request (`JwtAuthFilter`) as a new login and invoked `CsrfAuthenticationStrategy`, wiping and regenerating `XSRF-TOKEN` on every `GET`/`POST`/`DELETE` request and triggering `403 Forbidden` on concurrent/subsequent mutations (reproduced live on group `DELETE /api/conversations/{id}/members/{userId}`).  
   - **Fix:** Configured `NullAuthenticatedSessionStrategy` on both `sessionManagement` and `csrf` in `SecurityConfig.java`; added live HTTP regression test `WebSocketIntegrationTest#csrf_authenticatedRequestsPreserveXsrfCookie`.

2. **Group Avatar Download IDOR (`ConversationController.java`, `ConversationService.java`)**  
   - **Bug:** `GET /api/conversations/{id}/avatar` allowed non-members (`200`) to download group avatars.  
   - **Fix:** Enforced `conversationAccessService.requireMember(conversationId, userId)` in `serveGroupAvatar`; added regression test `SecurityChecklistIntegrationTest#idor_outsiderCannotDownloadGroupAvatar`.

3. **Live Presence Controller Principal Mismatch & Block Privacy (`PresenceController.java`, `UserService.java`, `ConversationService.java`)**  
   - **Bug:** `PresenceController` declared `@AuthenticationPrincipal Long` instead of `@CurrentUser UserPrincipal`, passing `null` as `requesterId` to `PresenceService.getPresence` so block privacy was bypassed on `/api/presence`; `UserService.toUserSummary` also omitted block checks (`about`/`online`/`lastSeenAt`) when building conversation member summaries.  
   - **Fix:** Switched `PresenceController` to `@CurrentUser UserPrincipal` and added bilateral block masking in `UserService.toUserSummary` and `ConversationService.toDto`; verified via live WS probe and `SecurityChecklistIntegrationTest#blockedUser_cannotSeePresenceOrSearchOrDirectChat`.

4. **Concurrent Multi-Tab WebSocket Receipt Race & Deadlock (`MessageReceiptRepository.java`, `ReceiptService.java`)**  
   - **Bug:** Simultaneous WS connects or overlapping `chat.read` frames for the same user triggered `DataIntegrityViolationException` (`uq_receipt` duplicate insert) and MySQL `SQLState 40001` deadlocks in `ReceiptService`.  
   - **Fix:** Added native `INSERT IGNORE` (`insertIgnoreReceipt`) and bulk pre-check (`findByUserIdAndMessageIds`) + deterministic ascending message-ID ordering + targeted `upgradeToRead` updates; added `SecurityChecklistIntegrationTest#receipts_idempotentUnderRepeatedDeliveryAndRead`.

5. **Frontend Chat State, Scroll Jump, Focus Receipts, Upload Cancel & Group UI Gaps**  
   - **`ChatWindow.jsx` / `MessageList.jsx`:** Reset `olderMessages`/`hasOlder` when switching chats (`key={conversationId}`), prevented scroll-to-bottom jump when prepending older pages (`prevLastMessageKeyRef`), and enforced `hasFocus()` + `isChatAtBottomRef` before emitting `chat.read`.  
   - **`SocketContext.jsx` / `socket.js` / `ConnectionBanner.jsx`:** Refreshed expired auth tokens in STOMP `beforeConnect`, fixed `ConnectionBanner` `prevStatusRef` tracking, and routed notification toast clicks via `useNavigate`.  
   - **`MessageComposer.jsx` / `attachmentApi.js` / `MessageBubble.jsx`:** Enforced `MAX_MESSAGE_LENGTH = 4000` with live limit clearing, wired `AbortController` upload cancellation, surfaced `message.error` on failed bubbles, and computed 15-minute `canEdit` dynamically.  
   - **`ChatHeader.jsx` / `GroupInfoPanel.jsx`:** Added 1:1 Block/Unblock toggle (`userApi.block`/`unblock`) and group avatar upload/display (`conversationApi.uploadAvatar`). Added regression tests in `frontend/src/App.test.jsx`.
