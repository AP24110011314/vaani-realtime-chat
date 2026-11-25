# Vanni - Security Plan

## 1. Authentication strategy (decision)
**HttpOnly cookie JWT + rotating refresh token + CSRF token.**

| Item | Setting |
|---|---|
| Access token | JWT (HS256 or EdDSA), 15 min, cookie `vanni_at`, `HttpOnly`, `SameSite=Lax`, `Secure` in prod, `Path=/` |
| Refresh token | Random 256-bit value, 7 days, cookie `vanni_rt`, `HttpOnly`, `SameSite=Strict`, `Secure` in prod, `Path=/api/auth` |
| Refresh storage | SHA-256 hash in `refresh_tokens`; **rotated on each use**; reuse of an old token revokes the whole `family_id` |
| CSRF | `CookieCsrfTokenRepository.withHttpOnlyFalse()` + SPA handler; header `X-XSRF-TOKEN` on unsafe methods. WebSocket handshake protected by Origin check |
| Password hash | `BCryptPasswordEncoder(12)` (or Argon2) |
| Logout | Revoke refresh token, clear cookies, close WebSocket |

Why: tokens are not readable by JavaScript (XSS cannot steal them), and same-origin in dev (Vite proxy) and prod (same parent domain / reverse proxy) keeps cookies simple.

## 2. Authorization rules
1. Every conversation operation requires an **active membership** check in the service layer (`ConversationAccessService.requireMember(conversationId, userId)`).
2. Group management requires `ADMIN` role. Direct chats have no admin actions.
3. Edit/delete message: only sender (delete also by group admin).
4. Attachments: download requires membership of the conversation of the message the attachment belongs to; uploader can access their own unattached file.
5. Blocks: a blocked user cannot start a direct chat with, send to, or see presence of the blocker.
6. IDs in URLs/payloads are never trusted; always re-check ownership (prevents IDOR).
7. Return **404** (not 403) for conversations the user does not belong to when you want to avoid leaking existence; be consistent.

## 3. Input validation
- Bean Validation on all request DTOs; reject unknown fields where practical.
- Max lengths: name 80, email 190, about 200, group title 100, message 4000.
- Sanitise filenames (strip path separators, limit length). Store files under random keys, never user-supplied paths.
- Escape on output in React (default). Never render message content as HTML. Linkify safely with `rel="noopener noreferrer nofollow"` and `target="_blank"`.

## 4. File upload safety
- Max size (default 10 MB, avatars 2 MB).
- Detect real MIME with Apache Tika (or magic bytes); compare with allowlist.
- No executable types, no SVG/HTML unless sanitised (serve as download).
- Serve with `Content-Disposition: attachment` for non-images and `X-Content-Type-Options: nosniff`.
- Re-encode images (strip EXIF/GPS) when feasible.
- Optional later: antivirus scan (ClamAV).

## 5. Rate limiting (Bucket4j)
| Endpoint | Limit |
|---|---|
| `POST /auth/login` | 5 / min / IP+email, then exponential lockout |
| `POST /auth/register` | 5 / hour / IP |
| `GET /users?query=` | 30 / min / user |
| Messages (REST + WS) | 30 / 10 s / user |
| Uploads | 20 / hour / user |

Return 429 with `Retry-After`.

## 6. HTTP security headers
`Strict-Transport-Security` (prod), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy` (camera/mic off unless voice messages), a strict `Content-Security-Policy` on the frontend host (self, ws/wss to API origin, img from storage domain).

## 7. Privacy and logging
- Never log passwords, tokens, cookies, message bodies or signed URLs.
- Generic auth errors; constant-time-ish behaviour (hash a dummy password when the email is unknown).
- Private users: `showLastSeen=false` hides last seen and online state from others; `showReadReceipts=false` stops sending READ receipts (and hides others' too).
- Before public launch define: data retention, account deletion, abuse reporting, terms/privacy pages.

## 8. Dependency and secret hygiene
- Secrets only in env vars; `.env` in `.gitignore`.
- Enable Dependabot and `mvn dependency-check` / `npm audit` in CI.
- Pin Docker image tags.

## 9. Security test checklist
- [ ] User A cannot read/send/subscribe/upload into User B's conversation (REST **and** WS).
- [ ] Tampered/expired JWT rejected; refresh reuse revokes family.
- [ ] CSRF: POST without header fails.
- [ ] Wrong-origin WebSocket handshake rejected.
- [ ] Oversized / disallowed / mislabeled files rejected.
- [ ] XSS payload in message and name renders as text.
- [ ] Brute-force login gets 429.
- [ ] Passwords never appear in logs or responses.

## 10. Advanced features (Phases 11-17)

### Mentions
- Server parses and validates tokens; clients cannot mark arbitrary users as mentioned. Only active members can be mentioned. `<@all>` is admin-only and rate limited.

### Invite links
- 256-bit codes, stored only as SHA-256 hashes, shown once. Generic error for unknown/expired/revoked/full codes. Rate limit preview and join. Use a row lock when incrementing `use_count`. Banned (admin-removed) users cannot rejoin by link. Never log codes or put them in analytics.

### Voice messages
- Same upload rules as attachments (sniffed MIME, size cap), plus: max 5 min, waveform length/range check. `Permissions-Policy: microphone=(self)`. Serve with `nosniff` and `Content-Disposition: inline` only for the audio types; support Range.

### Link previews (SSRF)
- All outbound fetches go through `SafeHttpFetcher`: DNS resolve + block private/loopback/link-local/metadata ranges, **pin the connection to the validated IP** (anti DNS-rebinding), manual redirects (max 3, re-validated), ports 80/443 only, tight timeouts and byte caps, content-type allowlist, no cookies/credentials, bounded worker pool, per-user rate limit.
- Parse with Jsoup (no JS). Store plain text only. Proxy/copy images so browsers never contact third-party hosts (IP privacy).
- Never run the fetcher with the SSRF guard disabled outside a test profile.

### Scheduled messages
- Re-check membership and blocks at send time. Idempotent send via `client_message_id`. Per-user pending cap and minimum lead time. Reserve attachments so cleanup does not delete them, and delete them when cancelled.

### AI (Catch me up)
- Opt-in per user plus global kill switch. Send only visible, non-deleted messages after `joined_at`. Treat messages as untrusted data (delimiters, JSON-only output, no tools). Do not store or log prompts/summaries. API key server-side only. Rate limits, size caps, timeouts, circuit breaker. Render summaries as plain text.

### Calls
- Direct chats only; blocks respected; participant-only signalling with size/rate limits.
- TURN: short-lived HMAC credentials (1 h), `denied-peer-ip` for private ranges, quotas, no CLI, TLS on 5349 in production.
- Media is end-to-end encrypted by WebRTC (DTLS-SRTP) between peers; the TURN relay sees only encrypted packets. Do **not** call Vanni "end-to-end encrypted" in general: only call media is.
- IP exposure to the peer is mitigated by the "relay only" user setting.
- Never log SDP or ICE candidates.
- `Permissions-Policy: camera=(self), microphone=(self)`.

### Extra checklist items (add to section 9)
- [ ] `http://localhost`, `http://127.0.0.1`, `http://169.254.169.254`, decimal-IP and redirect-to-private URLs produce no preview and no outbound request.
- [ ] DNS-rebinding test host is rejected.
- [ ] Invite code never appears in DB or logs; revoked/expired links fail generically.
- [ ] A non-participant cannot send `call.signal` for someone else's `callId`.
- [ ] AI endpoint returns 403 until the user opts in; no transcript or summary is logged.
- [ ] Scheduled message to a conversation the user has since left fails visibly and sends nothing.
