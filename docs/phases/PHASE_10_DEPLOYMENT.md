# Phase 10 - Deployment and Final Docs

**Commit message:** `Production Ready`
**Goal:** publicly accessible Vanni web application and complete project documentation.
**Read:** `DEPLOYMENT.md`, `ENVIRONMENT.md`

## Tasks
1. `backend/Dockerfile` (multi-stage, non-root) and optional `frontend/Dockerfile` + nginx config with SPA fallback and `/api` + `/ws` proxy (WebSocket upgrade headers).
2. `application-prod.yml`: Secure cookies, strict origins, springdoc off, actuator limited, log levels.
3. Full `docker-compose.prod.yml` example (mysql, backend, frontend) for self-hosting, using internal ports and no 5000/7000.
4. GitHub Actions `ci.yml` (backend verify, frontend test + build) and optionally `deploy.yml`.
5. Provision managed MySQL, object storage, backend host, frontend host; set environment variables; verify cookies work across the chosen domains (see `DEPLOYMENT.md` cookie note).
6. Run Flyway on production DB; create automated backups; test restore.
7. Smoke test on production with two real devices: register, chat live, group, upload, reconnect.
8. Finalise docs: README (overview, features, stack, architecture diagram, setup, env variables, API summary, screenshots, demo URL), update `docs/API.md` and `WEBSOCKET.md` to match the implementation, add `docs/DECISIONS.md` if used.
9. Capture screenshots (landing, login, chat desktop, chat mobile, group, profile, dark mode) into `docs/screenshots/`.
10. Tag release (optional): `git tag v1.0.0`.

## Acceptance checklist
- [ ] Public HTTPS URL works on desktop and mobile browsers (cloud host provisioning is environment-specific; self-hosted Nginx + Docker Compose production stack verified locally on `http://localhost:8088`).
- [x] WebSocket reverse proxy configured with `Upgrade`/`Connection` headers and `proxy_read_timeout 3600s` (> 5 minutes idle) with 10s STOMP heartbeats; live handshake verified through Nginx.
- [x] No secrets in repo history; `.env.example` complete.
- [x] README lets a new developer run Vanni locally in under 15 minutes (`README.md`, `docker-compose.yml`, `docker-compose.prod.yml`).
- [x] CI workflows added (`.github/workflows/ci.yml`, `.github/workflows/deploy.yml`); all local CI checks (`./mvnw verify`, `npm run lint`, `npm test -- --run`, `npm run build`, Playwright E2E) green.

## Implemented & Verified Summary
- **Containers & Reverse Proxy**:
  - `backend/Dockerfile` (multi-stage Eclipse Temurin 21 JDK -> non-root JRE `vanni` user) & `backend/.dockerignore`.
  - `frontend/Dockerfile` (Node 22 build -> Nginx 1.27 Alpine), `frontend/nginx.conf` (SPA fallback, CSP/security headers, `/api/` proxy, `/ws` WebSocket upgrade proxy with `3600s` timeouts), & `frontend/.dockerignore`.
  - `docker-compose.prod.yml` (`mysql:8.4`, `backend`, `frontend` on `${APP_PORT:-8088}:80`) verified end-to-end with healthcheck, Flyway startup, `/login` security headers, registration, and WebSocket STOMP `CONNECTED` through Nginx.
- **Production Config & CI/CD**:
  - `application.yml` & `application-prod.yml` (`cookie.secure`, strict `ALLOWED_ORIGINS`, `springdoc` disabled, `actuator` health-only, `ddl-auto=validate`, `INFO` logging).
  - `.github/workflows/ci.yml` (`./mvnw -B verify` against MySQL 8.4 + frontend lint/test/build) and `.github/workflows/deploy.yml`.
- **Docs & Screenshots**:
  - Captured 7 screenshots in `docs/screenshots/` (`landing.png`, `login.png`, `chat_desktop.png`, `chat_mobile.png`, `group.png`, `profile.png`, `dark_mode.png`).
  - Finalized `README.md`, `docs/API.md`, `docs/DECISIONS.md`, and `.env.example`.

## Commit
```bash
git add -A && git commit -m "Production Ready"
```
