# Phase 14 - Link Previews

**Commit message:** `Link Previews`
**Prerequisites:** Phase 4 (real-time) and Phase 7 (storage) complete.
**Goal:** URLs in messages get a preview card (title, description, image, site) fetched safely by the server.
**Read:** `SECURITY.md` (SSRF, Link previews), `DATABASE.md` (V10), `WEBSOCKET.md` (`message.updated`)

> **This is the most security-sensitive feature in the app.** The server makes outbound requests to addresses chosen by users. Follow the SSRF rules exactly.

## Design decisions
1. **Asynchronous:** the message is sent and broadcast immediately without a preview. A background task fetches the preview and then emits `message.updated` with `previews`. A slow site never delays chat.
2. **Which URLs:** the first 1 URL per message in v1 (max 3 later); only `http`/`https`; no embedded credentials (`user:pass@`); ports 80/443 only; IDN normalised to punycode; URLs longer than 2048 chars ignored.
3. **Cache:** `link_previews` keyed by SHA-256 of the normalised URL. Success TTL 24 h, failure TTL 1 h. Previews are shared across users (they contain only public page metadata).
4. **Privacy:** user browsers **never** load third-party images (that would leak their IP). The server downloads the preview image through the same safe fetcher, re-encodes/resizes to <= 600 px wide (webp/jpeg), stores it with `StorageService`, and the client loads it from `/api/previews/{id}/image` (authenticated).
5. **Controls:** per-user setting `linkPreviewsEnabled` (default on, only affects what *I* see); the sender can remove a preview from their own message (`DELETE /messages/{id}/previews`).
6. Not generated for: attachments-only messages, deleted messages, edited messages whose URL did not change.

## SSRF protection (mandatory)
Implement in one class `SafeHttpFetcher` and use it for **every** outbound fetch (page and image):
1. Resolve the hostname yourself and **reject** if any resolved address is loopback, private, link-local, multicast, unspecified, CGNAT, or cloud metadata: `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16` (includes `169.254.169.254`), `100.64.0.0/10`, `0.0.0.0/8`, `224.0.0.0/4`, `::1`, `fc00::/7`, `fe80::/10`, IPv4-mapped IPv6, and `localhost`/`*.local`/`*.internal` names.
2. **Pin the connection to the validated IP** (custom DNS resolver / socket factory in Apache HttpClient 5) so DNS rebinding cannot swap the address after validation.
3. Follow redirects **manually**, max 3, and re-run all checks on every hop. Only keep http/https.
4. Timeouts: connect 3 s, response 5 s, total 8 s. Max download 1 MB for HTML (stop reading), 3 MB for images.
5. Accept only `text/html` (and `application/xhtml+xml`) for pages and `image/jpeg|png|gif|webp` for images; sniff images, do not trust headers. Never render SVG.
6. Send `User-Agent: VanniBot/1.0` and no cookies/auth headers. Do not send the user's IP or identity.
7. Parse HTML with **Jsoup** (no JavaScript execution): `og:title`, `og:description`, `og:image`, `og:site_name`, `twitter:*`, `<title>`, `<meta name=description>`; trim lengths (title 200, description 300); store as plain text only.
8. Bounded worker pool (e.g. 4 threads, queue 100) with per-user rate limit (20 previews/min) and per-domain concurrency limit.
9. Log only the host and result, never the full URL or page content.

## Backend tasks
1. Migration `V10__link_previews.sql` (`link_previews`, `message_link_previews`, `users.link_previews_enabled`).
2. `UrlExtractor` (safe regex, trims trailing punctuation, ignores code spans), `UrlNormalizer`.
3. `SafeHttpFetcher` + `LinkPreviewService` (cache lookup, fetch, parse, image fetch/resize, persist) + `@Async` executor.
4. After message commit: enqueue; on completion link preview to message and emit `message.updated` to members.
5. Endpoints: `GET /previews/{id}/image` (authenticated), `DELETE /messages/{id}/previews`, `PATCH /users/me` accepts `linkPreviewsEnabled`.
6. Scheduled cleanup of expired previews and their images.

## Frontend tasks
1. Linkify URLs safely (`rel="noopener noreferrer nofollow"`, `target="_blank"`), show the real host for long URLs.
2. `LinkPreviewCard` under the text: glass card with image (lazy loaded), site name, title, description (2 lines), click opens the link. Skeleton while waiting is **not** needed (it appears via `message.updated`).
3. Sender menu item "Remove preview"; Settings toggle "Show link previews".
4. Layout shift protection: reserve the image aspect ratio; keep scroll position when a card appears.

## Tests (must include the attack cases)
Unit: block-list for every range above, IPv6 and IPv4-mapped forms, decimal/octal/hex IP spellings (`http://2130706433/`), `localhost`, `0.0.0.0`, redirect to `http://169.254.169.254/`, redirect chain > 3, DNS rebinding simulation (resolver returns public IP first and private second: must be rejected), oversized body, non-HTML content type, slow response timeout, `file://`, `gopher://`, credentials in URL, non-80/443 ports. Integration: preview appears via event; cached second request does not refetch; disabled setting hides cards; deleted message shows no card. Use a local test HTTP server on a random port only with the SSRF check **disabled via a test-only flag**, never in production profile.

## Acceptance checklist
- [x] Sending a normal article URL produces a card within a few seconds for both users.
- [x] `http://localhost:8080/api/ping`, `http://127.0.0.1`, and `http://169.254.169.254` produce **no** preview and no server request is made.
- [x] No third-party image URL is ever requested by the browser (check DevTools network tab).
- [x] Failure of a slow/bad site never delays or breaks message delivery.
- [x] Setting and "remove preview" work.

## Commit
```bash
git add -A && git commit -m "Link Previews"
```
