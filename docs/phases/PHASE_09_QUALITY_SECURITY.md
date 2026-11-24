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
- [ ] All tests green locally; E2E suite passes.
- [ ] Every item in the security checklist ticked.
- [ ] No high/critical vulnerabilities in dependency scans.
- [ ] Lighthouse accessibility >= 90 on login and chat pages.

## Commit
```bash
git add -A && git commit -m "Security Testing"
```
