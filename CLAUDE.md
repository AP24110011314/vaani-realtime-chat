# CLAUDE.md - Instructions for the AI coding agent

You are implementing **Vanni**, a real-time chat **web application** (browser only, not a native/mobile app).

## Read before coding
1. `docs/PHASES.md` - find the current phase.
2. The matching file in `docs/phases/`.
3. Relevant reference docs: `DATABASE.md`, `API.md`, `WEBSOCKET.md`, `SECURITY.md`.

## Hard rules
1. **Name:** the app is called **Vanni** everywhere (UI text, page titles, package names, README, DB name). Never use "ConnectX".
2. **Ports:** never use **5000** or **7000** (macOS AirPlay). Use backend `8080`, frontend `5173`, MySQL `3307` (Docker host port). Ports must come from config/env, not hard-coded in many places.
3. **Phases:** work on one phase at a time, in order. Finish its acceptance checklist before moving on.
4. **Commits:** make **exactly one commit at the end of each phase**, with the exact 2-3 word message listed in `docs/PHASES.md`. No long messages, no prefixes like `feat:`. Do not commit half-finished phases. Do not push unless asked.
5. **Secrets:** never commit `.env`, passwords, JWT secrets, or cloud keys. Only commit `.env.example`.
6. **Schema changes:** only through Flyway migrations in `backend/src/main/resources/db/migration`. Never use `ddl-auto=update` or `create`. Use `validate`.
7. **Authorization:** every endpoint, STOMP message and subscription that touches a conversation must verify the current user is a member. Never trust IDs from the client.
8. **Layers:** controller -> service -> repository. Controllers never touch repositories or return entities; always use DTOs.
9. **Passwords:** BCrypt only. Never log passwords, tokens, or message content.
10. **Web only:** no React Native, Electron, or mobile code. Responsive web layout is required.

## Style
- Java: 21, constructor injection, records for DTOs, Lombok optional, Bean Validation on request DTOs.
- React: function components, hooks, JavaScript (`.jsx`), Tailwind utility classes, no class components.
- Small focused files. Name files as in `docs/ARCHITECTURE.md`.
- Add tests for each service and each endpoint you create (see `docs/TESTING.md`).

## Definition of done for a phase
- App builds: `mvn -q verify` (backend) and `npm run build` (frontend) pass.
- Acceptance checklist in the phase file is fully ticked.
- Docs updated if behaviour or API changed.
- One commit with the prescribed message.

## When unsure
Prefer the simplest approach that satisfies the docs. If a decision is genuinely open, write it down in `docs/DECISIONS.md` (create if missing) in 2-3 lines and continue.
