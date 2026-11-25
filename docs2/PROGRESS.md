# Vanni — Advanced Phases Progress (Phases 11–17)

## Pre-Flight Summary
- **Baseline status (2026-11-26):**
  - `git status`: clean on `main` (`2fcb50b`).
  - Stack running: MySQL (`vanni-mysql` on `3307`), Spring Boot backend (`8080`, `UP`), Vite frontend (`5173`, HTTP `200`).
  - Note: `.env` line 26 currently contains un-commented text (`Gemini api key`), which causes `docker compose` CLI commands that parse `.env` to warn (`key cannot contain a space`); MySQL container is already up and healthy.
  - Checks: `./mvnw -q verify` PASS, `npm run lint` PASS, `npm test -- --run` PASS (56/56), `npm run build` PASS.
  - Prerequisites verified: Groups & admin roles (Phase 5), receipts & unread counts (Phase 6), attachments & storage (Phase 7), STOMP real-time & presence (Phases 4–5).
  - Real code vs `docs2/` notes:
    - Existing highest Flyway migration is `V6__reactions_blocks.sql`, so Phase 11 starts cleanly at `V7__mentions.sql`.
    - Frontend component layout puts modals/panels under `components/chat/` and `components/common/` (adapted in place without rewriting existing working code).
    - `docs2/API.md` lists `/api/...` paths while `http.js` uses `baseURL: '/api'` (aligned).
    - `MessageDto` uses `@JsonProperty("notify") boolean shouldNotify` because Java `Object.notify()` is `final`.

## Phase Progress Table

| Phase | Title | Status | Commit Hash | Notes | NEEDS MANUAL CHECK |
|---|---|---|---|---|---|
| 11 | @Mentions in groups | Done | `d753a2b` | `V7__mentions.sql`, `MentionParser`, `NotificationPolicy`, `/mentionable`, `notifyMode` (`ALL`/`MENTIONS`/`NONE`), `mentionUnreadCount`, `MentionPicker`, clickable `@Name` & `@all` pills, `Mentions` filter tab, `Jump to mention` pill. All backend (`MentionParserTest`, `NotificationPolicyTest`, `MentionsIntegrationTest`), Vitest (`59/59`), build, and Playwright E2E passed. | None |
| 12 | Group invite links | Done | Pending commit | `V8__invites.sql`, SHA-256 hash-only `group_invites` (`PESSIMISTIC_WRITE` row lock), `group_join_requests` + live approval/rejection WS events, `banned` member enforcement, `/join/:code` preview/join page, `?next=` redirect preservation, `GroupInfoPanel` Invites/QR/Requests tabs, cold-tab `SocketContext` cache fix. All backend (`InviteIntegrationTest` + `verify`), Vitest (`63/63`), lint, build, and Playwright E2E passed. | `navigator.share` native OS share sheet (verified via capability check; test interactively on mobile/macOS Safari) |
| 13 | Voice messages | In Progress | — | Starting next | — |
| 14 | Link previews | Pending | — | — | — |
| 15 | Scheduled messages | Pending | — | — | — |
| 16 | Catch me up (AI) | Pending | — | — | — |
| 17 | 1:1 voice & video calls | Pending | — | — | — |
