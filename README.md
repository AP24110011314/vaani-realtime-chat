# Vanni

> A real-time chat **web application** built with React, Java Spring Boot, WebSocket (STOMP) and MySQL.

Vanni runs in the browser. There is nothing to install on a phone or desktop. Users register, find each other, chat one-to-one or in groups, share files and see live presence, typing and read status.

This repository is planned to be built **phase by phase**. Each phase ends with exactly **one Git commit** that has a 2-3 word message.

---

## Documentation map

| File | What it covers |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Rules for the AI coding agent (read first when implementing) |
| [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md) | Goals, roles, scope, requirements, MVP |
| [`docs/FEATURES.md`](docs/FEATURES.md) | Complete feature list in tiers (Core / Extended / Stretch) |
| [`docs/TECH_STACK.md`](docs/TECH_STACK.md) | Versions, libraries, key decisions |
| [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) | **Ports**, env variables, macOS setup, Docker MySQL |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System design, folder structure, flows |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Schema, SQL, indexes, rules |
| [`docs/API.md`](docs/API.md) | REST API contract |
| [`docs/WEBSOCKET.md`](docs/WEBSOCKET.md) | STOMP destinations and event payloads |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Auth strategy, authorization rules, hardening |
| [`docs/BACKEND_GUIDE.md`](docs/BACKEND_GUIDE.md) | Spring Boot coding conventions |
| [`docs/FRONTEND_GUIDE.md`](docs/FRONTEND_GUIDE.md) | React conventions, state, hooks |
| [`docs/UI_UX.md`](docs/UI_UX.md) | Pages, layouts, design system, responsive rules |
| [`docs/TESTING.md`](docs/TESTING.md) | Test strategy and checklists |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Production deployment plan |
| [`docs/GIT_WORKFLOW.md`](docs/GIT_WORKFLOW.md) | Branching and the commit-per-phase rule |
| [`docs/PHASES.md`](docs/PHASES.md) | Roadmap overview + commit message table |
| [`docs/phases/PHASE_01..10`](docs/phases/) | Step-by-step instructions for each phase |

## Quick facts

| Item | Value |
|---|---|
| Frontend | React 19 + Vite + Tailwind CSS 4 → **http://localhost:5173** |
| Backend | Java 21 + Spring Boot 4.1 → **http://localhost:8080** |
| WebSocket | `ws://localhost:8080/ws` (proxied through Vite in dev) |
| Database | MySQL 8.4 LTS → host port **3307** (Docker) |
| **Never use** | **5000** and **7000** (macOS AirPlay Receiver uses them) |

## Build order

Start with `docs/PHASES.md`, then follow `docs/phases/PHASE_01_PROJECT_SETUP.md` onward. Do not start a phase until the previous phase's acceptance checklist passes and its commit is made.

---

## Getting Started

### 1. Prerequisites
- Java 21 LTS (`/opt/homebrew/opt/openjdk@21` or via Homebrew)
- Node 22+ (`node -v && npm -v`)
- Docker Desktop (`docker compose`)

### 2. Run commands
```bash
# 1. Start MySQL (port 3307)
docker compose up -d mysql

# 2. Run Backend (port 8080)
cd backend && ./mvnw spring-boot:run

# 3. Run Frontend (port 5173)
cd frontend && npm install && npm run dev
```

Visit [http://localhost:5173](http://localhost:5173) in your browser.

