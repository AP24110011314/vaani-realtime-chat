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
- [ ] Public HTTPS URL works on desktop and mobile browsers.
- [ ] WebSocket stays connected > 5 minutes idle (heartbeats working through the proxy).
- [ ] No secrets in repo history; `.env.example` complete.
- [ ] README lets a new developer run Vanni locally in under 15 minutes.
- [ ] CI is green.

## Commit
```bash
git add -A && git commit -m "Production Ready"
```
