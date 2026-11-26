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
| 12 | Group invite links | Done | `08c6a6d` | `V8__invites.sql`, SHA-256 hash-only `group_invites` (`PESSIMISTIC_WRITE` row lock), `group_join_requests` + live approval/rejection WS events, `banned` member enforcement, `/join/:code` preview/join page, `?next=` redirect preservation, `GroupInfoPanel` Invites/QR/Requests tabs, cold-tab `SocketContext` cache fix. All backend (`InviteIntegrationTest` + `verify`), Vitest (`63/63`), lint, build, and Playwright E2E passed. | `navigator.share` native OS share sheet (verified via capability check; test interactively on mobile/macOS Safari) |
| 13 | Voice messages | Done | `24c6d85` | `V9__voice.sql`, `MimeSniffer.sniffAudio` (`audio/webm`, `audio/ogg`, `audio/mp4`, `audio/mpeg`, `audio/x-m4a`), `POST /attachments/voice`, HTTP `Range` (`206 Partial Content` / `416` + `Accept-Ranges: bytes` + `nosniff` + `inline`), `MessageType.VOICE` rules & `Voice message M:SS` preview, `VoiceRecorder`, `VoicePlayer` (single active, keyboard `Space`/arrows slider, `1x`/`1.5x`/`2x`), `Permissions-Policy: microphone=(self)`. All backend (`VoiceIntegrationTest` + `verify`), Vitest (`66/66`), lint, build, and fake-media Playwright E2E passed. | Safari `audio/mp4` recording & iOS/macOS audio playback (test manually in Safari) |
| 14 | Link previews | Done | `f836b7a` | `V10__link_previews.sql`, SSRF-hardened `SafeHttpFetcher` (IP blocklist, DNS pinning per hop, max 3 redirect hops, timeouts & byte caps), `UrlExtractor`/`UrlNormalizer` (punycode/obfuscated IP blocking), Jsoup + Thumbnailator proxied `/api/previews/{id}/image`, `LinkPreviewCard`, `DELETE /api/messages/{id}/previews`, `Show Link Previews` setting. All backend (`SafeHttpFetcherUnitTest`, `LinkPreviewIntegrationTest`, `./mvnw -q verify`), Vitest (`68/68`), lint, build, Playwright E2E, and visual QA passed. | None |
| 15 | Scheduled messages | Done | `140ce6b` | `V11__scheduled_messages.sql`, `ScheduledMessage` + `attachments.scheduled_message_id` (orphan cleanup protected), `FOR UPDATE SKIP LOCKED` batch claim & retry/failure transitions, `ScheduledMessageController` (`/conversations/{id}/scheduled`, `/scheduled`, `/scheduled/{id}/send-now`), `ScheduleModal`, chat pending banner, `ScheduledPage` (`/scheduled`), Sidebar clock shortcut, live `scheduled.*` WS events. All backend (`ScheduledMessageIntegrationTest`, `./mvnw -q verify`), Vitest (`71/71`), lint, build, Playwright E2E (including due-time auto-delivery), and visual QA passed. | None |
| 16 | Catch me up (AI) | Done | Pending commit | `V12__ai.sql`, `AiProperties`, `TranscriptBuilder`, `AiSummaryParser`, `AnthropicAiSummaryService` (with circuit breaker, 1 retry, zero secret/transcript logging) + `FakeAiSummaryService`, `CatchUpService` (Caffeine 10m cache, hourly/daily `ai_usage` caps, prompt-injection delimiters & ID filtering), `PUT /users/me/ai-consent`, `POST /conversations/{id}/catch-up`, `CatchUpPanel`, `SettingsPage` AI opt-in. All backend (`CatchUpUnitTest`, `CatchUpIntegrationTest`, `./mvnw -q verify`), Vitest (`74/74`), lint, build, Playwright E2E (fake provider), and visual QA passed. | Manual smoke test with a real `ANTHROPIC_API_KEY` (`AI_FEATURES_ENABLED=true`, `AI_PROVIDER=anthropic`) |
| 17 | 1:1 voice & video calls | In Progress | — | Starting next | — |
