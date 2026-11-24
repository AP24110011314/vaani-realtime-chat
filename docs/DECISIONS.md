# Architectural & Design Decisions

## 1. Spring Boot 4 Starter Web MVC and WebMvcTest
- Spring Boot 4.1.3 modularized web starters to `spring-boot-starter-webmvc` and test auto-configuration to `org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest`.
- Tested and verified with Java 21 LTS and Spring Boot 4.1.3.

## 2. Vite Proxy Configuration & Hostname
- In macOS development environments with Node 22+, Vite proxy is configured to route `/api` and `/ws` to `http://localhost:8080`.
- All ports (5173 for frontend, 8080 for backend, 3307 for Docker MySQL host port) are strictly respected.

## 3. Phase 2 Authentication & Security Architecture
- Used JJWT with HMAC-SHA256 and 15-minute `vanni_at` HttpOnly cookie.
- Used SHA-256 hashed 7-day `vanni_rt` HttpOnly cookie with rotation on each refresh and token family revocation upon reuse detection (`@Transactional(noRollbackFor = ApiException.class)`).
- Rate-limiting using Bucket4j: 5 requests/min per IP+email on login, 5 requests/hour per IP on registration.
- Single-flight 401 refresh interceptor in Axios (`api/http.js`) to seamlessly buffer and replay concurrent requests during token rotation.


## 4. Phase 3 Direct Conversations & SPA CSRF
- **SPA CSRF Configuration**: Configured `CsrfTokenRequestAttributeHandler.setCsrfRequestAttributeName(null)` so that `CookieCsrfTokenRepository.withHttpOnlyFalse()` issues raw tokens in the `XSRF-TOKEN` cookie, perfectly matching the raw header `X-XSRF-TOKEN` sent by Axios and client API calls without XOR-masking mismatches.
- **Direct Conversation Key & Concurrency**: Generated canonical `min_max` key via `DirectKey.of(u1, u2)` with unique database constraint. Concurrent creation safely catches `DataIntegrityViolationException` and re-queries the existing record.
- **Message Cursor & Scroll Preservation**: Cursor pagination queries `id < :before ORDER BY id DESC` on the backend. The frontend maintains scroll height using `container.scrollHeight` diff in `useLayoutEffect` to prevent jumping when prepending older messages.
- **REST Polling (Phase 3)**: Implemented 5-second refetch interval via TanStack Query for conversations and open message threads, ready to transition cleanly to WebSocket updates in Phase 4.
