# Phase 1 - Project Setup

**Commit message:** `Project Setup`
**Goal:** frontend, backend and MySQL all run locally. Ports: 5173 / 8080 / 3307 (never 5000 or 7000).
**Read:** `ENVIRONMENT.md`, `TECH_STACK.md`, `ARCHITECTURE.md`, `GIT_WORKFLOW.md`

## Tasks
1. Create repo root `vanni/` with `backend/`, `frontend/`, `database/`, `docs/`. Run `git init -b main`.
2. Add `.gitignore` (see `GIT_WORKFLOW.md`), `.env.example`, `docker-compose.yml` (MySQL 8.4, host port 3307).
3. **Backend:** generate from start.spring.io (Maven, Java 21, Spring Boot 4.1.x, group `com.vanni`, artifact `vanni-backend`). Dependencies: Web MVC, WebSocket, Security, Validation, Data JPA, MySQL Driver, Flyway (+ flyway-mysql), Actuator, Lombok (optional).
4. Create the package skeleton from `ARCHITECTURE.md` (empty packages are fine).
5. Write `application.yml` (+ `application-dev.yml`) from `ENVIRONMENT.md`: port from env, datasource, `ddl-auto: validate`, Flyway on.
6. Add `V1__init_users.sql` with a minimal `users` table (full version arrives in Phase 2) so Flyway runs.
7. Add a temporary `GET /api/ping` returning `{"app":"Vanni","status":"ok"}` (permit it in security for now).
8. **Frontend:** `npm create vite@latest frontend -- --template react`; install Tailwind 4 + `@tailwindcss/vite`, React Router, TanStack Query, Axios. Configure `vite.config.js` with port 5173, `strictPort`, and `/api` + `/ws` proxy to 8080.
9. Replace boilerplate: `App.jsx` shows "Vanni" and the result of `/api/ping` (proves the proxy). Set page `<title>` to Vanni.
10. Create folder skeleton from `ARCHITECTURE.md` (`api/ components/ pages/ context/ hooks/ routes/ lib/ styles/`).
11. Add ESLint + Prettier configs; add npm scripts `dev`, `build`, `test`, `lint`.
12. Write root `README.md` run instructions (copy from `ENVIRONMENT.md`) and `database/seed.sql` placeholder.
13. Add smoke tests: backend `contextLoads`; frontend renders "Vanni".

## Acceptance checklist
- [x] `docker compose up -d mysql` healthy; connect on port 3307.
- [x] `./mvnw spring-boot:run` starts on 8080 and Flyway applies V1.
- [x] `npm run dev` serves on 5173 and shows ping result via proxy.
- [x] `./mvnw -q verify` and `npm run build` pass.
- [x] `grep -rn "5000\|7000\|ConnectX"` finds nothing in code or docs.
- [x] No secrets committed; `.env` ignored.

## Commit
```bash
git add -A && git commit -m "Project Setup"
```
