# Vanni

> A real-time chat **web application** built with React, Java Spring Boot, WebSocket (STOMP), and MySQL.

Vanni runs in any modern desktop or mobile browser. Users register, search contacts, chat one-to-one or in groups, share images and files, react/reply/edit/delete messages, and see live presence, typing indicators, and delivery/read receipts.

---

## Features

- **Authentication & Security:** HttpOnly cookie JWT (`vanni_at`), SHA-256 hashed rotating refresh tokens (`vanni_rt`) with reuse family revocation, SPA CSRF (`X-XSRF-TOKEN`), strict WebSocket Origin validation, Bucket4j rate limiting with `Retry-After`, CSP/HSTS security headers, and `X-Request-Id` MDC logging.
- **Direct & Group Messaging:** Idempotent `clientMessageId` delivery, cursor pagination (`before`/`after`), typing indicators (server-throttled + client-debounced), system announcements, group admin roles, and last-admin promotion.
- **Receipts & Notifications:** Monotonic `SENT` → `DELIVERED` → `READ` tracking, per-recipient receipt inspection, unread counters, privacy flags (`showLastSeen`, `showReadReceipts`), mute/pin/archive settings, and browser notifications.
- **Attachments & Profiles:** Apache Tika MIME sniffing, executable/spoofed-extension rejection, image EXIF stripping, local or cloud storage abstraction, user/group avatars, and multi-image lightbox navigation.
- **Message Enhancements & Settings:** Replies/quotes, emoji reactions, 15-minute edit window, soft delete, in-chat & global search, user blocking, Light/Dark/System themes, and multi-device logout.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, Tailwind CSS 4, TanStack Query 5, React Hook Form, Zod, `@stomp/stompjs`, Lucide |
| Backend | Java 21 LTS, Spring Boot 4.1.3, Spring Security, Spring Data JPA, Spring WebSocket (STOMP), Flyway, JJWT, Bucket4j |
| Database | MySQL 8.4 (`utf8mb4`) |
| Testing & QA | JUnit 5, Mockito, MockMvc, JaCoCo, Vitest, React Testing Library, MSW, Playwright, Lighthouse |
| Deployment | Docker multi-stage builds, Nginx reverse proxy, GitHub Actions CI/CD |

---

## Architecture

```text
  Browser (React + STOMP.js)
       │  HTTPS / WSS (same-origin cookies + X-XSRF-TOKEN)
       ▼
  Nginx Reverse Proxy / Vite Dev Proxy
       ├── /api/**  ──▶ Spring Boot REST Controllers ──▶ Services / Bucket4j ──▶ MySQL 8.4 (Flyway V1..V6)
       ├── /ws      ──▶ STOMP Handshake + Auth Interceptor ──▶ EventPublisher ──▶ Storage (Local / S3 / Cloudinary)
       └── /*       ──▶ React SPA (dist/)
```

---

## Getting Started (< 15 Minutes)

### Prerequisites
- Java 21 LTS (`/opt/homebrew/opt/openjdk@21` on macOS)
- Node.js 22+ and npm
- Docker Desktop (`docker compose`)

### Local Development
```bash
# 1. Copy environment template (adjust if needed)
cp .env.example .env

# 2. Start MySQL 8.4 on host port 3307
docker compose up -d mysql

# 3. Start Spring Boot backend (port 8080)
cd backend && ./mvnw spring-boot:run

# 4. Start React frontend (port 5173, proxies /api and /ws -> :8080)
cd frontend && npm install && npm run dev
```

Visit [http://localhost:5173](http://localhost:5173). Never use ports `5000` or `7000` on macOS (reserved by AirPlay Receiver).

### Self-Hosted Production (Docker Compose)
```bash
cp .env.example .env
# Set strong DB_ROOT_PASSWORD, DB_PASSWORD, JWT_SECRET (64+ chars), and ALLOWED_ORIGINS
docker compose -f docker-compose.prod.yml up -d --build
```
The Nginx container exposes the application on `${APP_PORT:-8088}` and proxies `/api` and `/ws` internally to the non-root `backend:8080` service.

---

## Environment Variables

See [`.env.example`](.env.example) for the complete template:

| Variable | Default (dev) | Purpose |
|---|---|---|
| `SERVER_PORT` | `8080` | Backend HTTP port |
| `DB_HOST` / `DB_PORT` / `DB_NAME` | `localhost` / `3307` / `vanni` | MySQL 8.4 connection |
| `DB_USER` / `DB_PASSWORD` | `vanni` / `vannipass` | Database credentials |
| `JWT_SECRET` | dev fallback | 64+ character HMAC secret (required in prod) |
| `COOKIE_SECURE` | `false` (`true` in `prod`) | `Secure` flag on `vanni_at` and `vanni_rt` |
| `ALLOWED_ORIGINS` | `http://localhost:5173,...` | Allowed WebSocket `Origin` patterns |
| `STORAGE_PROVIDER` / `STORAGE_LOCAL_DIR` | `local` / `./uploads` | Attachment & avatar storage (`local` \| `cloudinary` \| `s3`) |
| `MAX_UPLOAD_MB` | `10` | Max attachment upload size |
| `APP_PORT` | `8088` | Host port mapped to Nginx in `docker-compose.prod.yml` |

---

## API & WebSocket Summary

- **REST (`/api`):** Auth (`/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/logout-all`, `/auth/change-password`, `/auth/csrf`), Users (`/users/me`, `/users/me/avatar`, `/users/{id}/block`, `/users/blocked`), Conversations (`/conversations`, `/direct`, `/groups`, `/members`, `/leave`, `/settings`, `/avatar`), Messages (`/conversations/{id}/messages`, `/messages/{id}`, `/reactions`, `/receipts`, `/search/messages`), Attachments (`/attachments`), Presence (`/presence`), Health (`/actuator/health`). Full contract: [`docs/API.md`](docs/API.md).
- **WebSocket STOMP (`/ws`):** Single user queue subscription `/user/queue/events`; client frames `/app/chat.send`, `/app/chat.delivered`, `/app/chat.read`, `/app/chat.typing`; server events `message.created`, `message.updated`, `message.deleted`, `receipt.updated`, `unread.updated`, `typing`, `presence.changed`, `conversation.*`, `error`. Full contract: [`docs/WEBSOCKET.md`](docs/WEBSOCKET.md).

---

## Screenshots

| Landing | Login |
|---|---|
| ![Landing](docs/screenshots/landing.png) | ![Login](docs/screenshots/login.png) |

| Chat (Desktop) | Chat (Mobile 360px) |
|---|---|
| ![Chat Desktop](docs/screenshots/chat_desktop.png) | ![Chat Mobile](docs/screenshots/chat_mobile.png) |

| Groups | Profile | Settings & Dark Mode |
|---|---|---|
| ![Group](docs/screenshots/group.png) | ![Profile](docs/screenshots/profile.png) | ![Dark Mode](docs/screenshots/dark_mode.png) |

---

## Testing & Quality

```bash
# Backend unit, integration, security & WebSocket tests + JaCoCo (>= 70% on service & security)
cd backend && ./mvnw verify

# Frontend lint, unit/MSW tests, production build & Playwright E2E
cd frontend && npm run lint && npm test -- --run && npm run build && npx playwright test
```

## Documentation Map

- [`docs/API.md`](docs/API.md) — REST contract and DTO schemas
- [`docs/WEBSOCKET.md`](docs/WEBSOCKET.md) — STOMP destinations and event envelopes
- [`docs/SECURITY.md`](docs/SECURITY.md) — Auth, authorization, headers, rate limits & checklist
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Production topology, Docker & CI/CD
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — Architectural decisions log
- [`docs/TESTING.md`](docs/TESTING.md) — Test strategy and coverage expectations
- [`docs/phases/`](docs/phases/) — Phase 1–10 plans and verification records
