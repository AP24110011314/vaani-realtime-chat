# Phase 9 - Quality and Security

**Commit message:** `Security Testing`
**Goal:** release-quality confidence. No new features.
**Read:** `TESTING.md`, `SECURITY.md`

## Tasks
1. Complete the backend test suite: unit (services), integration with Testcontainers MySQL, WebSocket tests. Target >= 70 % line coverage on `service` and `security` packages (JaCoCo).
2. Frontend: Vitest/RTL tests for forms, list, bubble states, hooks; MSW mocks.
3. Playwright E2E with two browser contexts: register/login, chat live, receipts, group flow, reconnect, 360 px mobile viewport.
4. Run the **security checklist** in `SECURITY.md` section 9 and fix every failure. Pay special attention to IDOR on REST and WebSocket, CSRF, origin check, file spoofing, XSS in message and name fields.
5. Verify rate limits on login, register, search, messages, uploads.
6. Add security headers and a CSP for the frontend host; confirm cookies flags in production profile.
7. Dependency audit: `./mvnw org.owasp:dependency-check-maven:check`, `npm audit`; upgrade as needed.
8. Performance check: seed 100k messages, confirm history query < 100 ms (`EXPLAIN` uses `idx_msg_conv_id`); load test ~200 WebSocket clients.
9. Accessibility pass (`UI_UX.md` section 6): keyboard-only run-through, contrast check, aria labels, Lighthouse >= 90.
10. Logging review: nothing sensitive logged; add request ids.
11. Fix bugs found; add regression tests for each.

## Acceptance checklist
- [x] All tests green locally; E2E suite passes (70 backend tests, 52 Vitest/MSW tests, Playwright multi-context E2E).
- [x] Every item in the security checklist ticked (`SECURITY.md` section 9, verified by `SecurityChecklistIntegrationTest`).
- [ ] No high/critical vulnerabilities in dependency scans (`npm audit`: 0 vulnerabilities; OWASP `dependency-check-maven` blocked locally because `NVD_API_KEY` is unset).
- [x] Lighthouse accessibility >= 90 on login and chat pages (100/100 on `/login`, 100/100 on `/app`).

## Implemented & Verified Summary
- **Backend Hardening & Coverage**:
  - `SecurityConfig.java`: enabled `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, `Content-Security-Policy`, and configurable HSTS (`app.security.hsts-enabled: true` in `application-prod.yml`).
  - `application-prod.yml`: `cookie.secure: true`, `server.forward-headers-strategy: native`, `INFO` logging.
  - `RequestIdFilter.java` + `logback-spring.xml`: sanitized `X-Request-Id` header & SLF4J `MDC` (`requestId`); redacted password fields in `LoginRequest`, `RegisterRequest`, `ChangePasswordRequest` `toString()`.
  - `RateLimiterService.java` + `GlobalExceptionHandler.java`: rate limits with `Retry-After` on login (5/min/IP+email + exponential lockout), register (5/hr/IP), user/message search (30/min/user), REST & WS message send (30/10s/user), and uploads (20/hr/user).
  - IDOR & Privacy fixes: added `conversationAccessService.requireMember(...)` before edit/delete checks in `MessageService`; masked blocked and `showLastSeen=false` user presence in `PresenceService` and `UserService.getUser`.
  - Tests & JaCoCo: `ServiceUnitTest`, `SecurityAndRateLimiterUnitTest`, `SecurityChecklistIntegrationTest` — **70/70** passing; JaCoCo line coverage **84.4%** on `com.vanni.service` and **91.6%** on `com.vanni.security` (`>= 70%` enforced in `pom.xml`).
- **Frontend Quality, MSW, Playwright E2E, Accessibility**:
  - Fixed missing `QueryClientProvider` in `App.jsx` (caught by Playwright E2E) and added regression test in `msw.test.jsx`.
  - Added MSW integration tests (`msw.test.jsx`), Playwright multi-context E2E (`e2e/vanni.spec.js`), security headers in `vite.config.js`, and accessibility fixes (`<main>` landmarks, `role="log"`, `aria-live="polite"`, `aria-invalid`, `role="alert"`, `aria-label` on icon buttons).
  - Lighthouse Accessibility: **100/100** on `/login` and **100/100** on `/app`.
- **Performance Benchmarks**:
  - 100,000 seeded messages in MySQL 8.4: `SHOW PROFILES` server execution `0.18 ms`, end-to-end paginated `LIMIT 30` query `40–80 ms` (`< 100 ms`).
  - 200 concurrent STOMP WebSocket sessions connected in `398.5 ms`; broadcast fanned out to `100/100` recipient sessions in `63.4 ms`.

## Commit
```bash
git add -A && git commit -m "Security Testing"
```
