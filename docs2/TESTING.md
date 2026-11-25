# Vanni - Testing Strategy

Each phase adds tests for what it builds. `mvn -q verify` and `npm test -- --run` must pass before each phase commit.

| Type | Tools | What to cover |
|---|---|---|
| Backend unit | JUnit 5, Mockito | Services: password rules, direct-key generation, membership checks, idempotent send, receipt state, permission rules |
| Backend integration | `@SpringBootTest`, MockMvc, **Testcontainers MySQL**, Spring Security Test | Auth flow, cookies, CSRF, conversation APIs, pagination, authorization (IDOR), uploads |
| WebSocket | `WebSocketStompClient`, random port | Handshake auth, rejected foreign subscribe, live delivery to two users, typing, presence, receipts |
| Repository | `@DataJpaTest` + Testcontainers | Unique constraints, pagination queries, unread count query |
| Frontend unit | Vitest, React Testing Library, MSW | Forms validation, MessageBubble states, ConversationList sorting, hooks |
| Frontend E2E | Playwright (two browser contexts) | Register -> login -> search -> chat in real time -> read receipt; group flow; reconnect; mobile viewport |
| Security | Manual + automated | See checklist in `SECURITY.md` |
| Performance (basic) | k6 or simple script | 200 concurrent WebSocket users sending messages; history query < 100 ms for 100k messages |

## Per-phase test expectations
| Phase | Minimum tests |
|---|---|
| 1 | Context loads; DB connection; frontend renders App |
| 2 | Register/login/logout/refresh; duplicate email; bad password; protected route; BCrypt used |
| 3 | Direct chat get-or-create is idempotent; non-member 403/404; pagination order |
| 4 | Two WS clients exchange a message; unauthorized subscription rejected; reconnect fills gap |
| 5 | Group permission matrix; typing throttle; presence multi-tab |
| 6 | Receipt transitions; unread counts; privacy flag hides read receipts |
| 7 | Upload validation (size, MIME spoof); attachment authorization; avatar |
| 8 | Edit/delete rules; reactions toggle; block rules; search scoping |
| 9 | Full security checklist, E2E suite, coverage >= 70% on services |
| 10 | Smoke test of production build against staging |

## Manual E2E script (two browsers)
1. Browser A registers *Asha*; browser B (private window) registers *Ravi*.
2. A searches "Ravi", opens chat, sends "hello" -> B sees it instantly, A shows double tick, then blue when B opens it.
3. B types -> A sees typing indicator.
4. B goes offline (close tab) -> A sees offline / last seen.
5. A sends while B is offline; B logs in -> message present, unread badge 1.
6. A creates group with B and a third user; everyone chats; admin removes a member -> member loses access immediately.
7. Send image + PDF; try a `.exe` renamed to `.png` (must be rejected).
8. Resize to 360 px; verify the mobile layout.
9. Stop the backend, restart -> banner appears then clears; no duplicate messages.

## Tooling commands
```bash
cd backend  && ./mvnw -q verify
cd frontend && npm test -- --run && npx playwright test
```
Docker must be running for Testcontainers.

## Tests for Phases 11-17
| Phase | Must cover |
|---|---|
| 11 | Mention parser, notification policy matrix, mention unread count, `@all` admin-only |
| 12 | Invite lifecycle, concurrent last-use race, ban, approval flow, hash-only storage, rate limit |
| 13 | Audio MIME sniffing, size/duration/waveform validation, Range responses, recorder state machine |
| 14 | **SSRF attack suite** (private IPs, metadata IP, rebinding, redirects, odd IP spellings, schemes, ports, oversize, timeouts), cache behaviour, per-user toggle |
| 15 | Exactly-once claiming with concurrent schedulers, failure at send time, restart catch-up, attachment reservation, timezone helpers |
| 16 | JSON parsing/validation, consent and flag enforcement, rate limit, prompt-injection fixture, mock provider only |
| 17 | Call state machine, busy/timeout/missed, participant-only signalling, ICE credential HMAC, Playwright fake-media call |

Manual extras: Safari voice recording and playback; a real call across two networks via TURN; a real AI summary with a real key (smoke test only, never in CI).
