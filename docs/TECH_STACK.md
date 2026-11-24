# Vanni - Technology Stack

Versions below were checked in November 2026. Always generate the backend from https://start.spring.io and the frontend from `npm create vite@latest`, then confirm the latest patch versions.

## Backend
| Item | Choice | Notes |
|---|---|---|
| Language | Java 21 LTS | Java 25 LTS also works with Boot 4 |
| Framework | Spring Boot 4.1.x | 3.5 reached OSS end-of-life on 2026-06-30, so do not start on it |
| Build | Maven (use `./mvnw`) | |
| Web | `spring-boot-starter-webmvc` | Boot 4 renamed/modularised starters; verify names in Initializr |
| Real-time | `spring-boot-starter-websocket` + STOMP, in-memory simple broker | Move to broker relay only if scaling out |
| Security | Spring Security 7 (via Boot 4) | |
| Persistence | Spring Data JPA + Hibernate | |
| Migrations | Flyway (`flyway-core` + `flyway-mysql`) | |
| Database | MySQL 8.4 LTS | |
| Validation | `spring-boot-starter-validation` | |
| Auth tokens | `jjwt` (api, impl, jackson) or Nimbus JOSE (bundled with Spring Security) | |
| Rate limiting | Bucket4j (in-memory) | |
| Files | Cloudinary SDK **or** S3-compatible (MinIO locally) behind a `StorageService` interface | Local-disk implementation for dev |
| API docs | springdoc-openapi | Dev profile only |
| Testing | JUnit 5, Mockito, Spring Boot Test, Testcontainers (MySQL), Spring Security Test | |
| Utilities | Lombok (optional), MapStruct (optional) | Note: Boot 4 uses Jackson 3 (`tools.jackson`) |

## Frontend
| Item | Choice |
|---|---|
| Framework | React 19.x |
| Build tool | Vite 7.x (`@vitejs/plugin-react`) |
| Language | JavaScript (JSX), per the project document |
| Styling | Tailwind CSS 4.x via `@tailwindcss/vite` (no `tailwind.config.js` needed; CSS-first `@theme`) |
| Routing | React Router (v7, library/data mode) |
| Server state | TanStack Query |
| Client state | React Context (auth, theme, socket) + small `useReducer` stores |
| HTTP | Axios (with `withCredentials`, CSRF header handling, 401 refresh interceptor) |
| WebSocket | `@stomp/stompjs` |
| Forms | React Hook Form + Zod |
| Icons | `lucide-react` |
| Emoji | `emoji-picker-react` or `emoji-mart` |
| Dates | `date-fns` |
| Tests | Vitest, React Testing Library, MSW; Playwright for E2E |

## Infrastructure
| Item | Choice |
|---|---|
| Local DB | Docker Compose MySQL 8.4 on host port **3307** |
| Node | 22 or 24 LTS |
| Git | GitHub, `main` + feature branches |
| CI | GitHub Actions (build + test both sides) |
| Hosting (suggested) | Frontend: Vercel / Netlify / Cloudflare Pages. Backend: Render / Railway / Fly.io / any Docker host. DB: managed MySQL |

## Key decisions (summary)
1. **Cookie-based JWT auth** (HttpOnly) + refresh token rotation + CSRF token. See `SECURITY.md`.
2. **Same-origin in dev** via Vite proxy (`/api`, `/ws`) so cookies work without CORS pain.
3. **Send over STOMP, persist first, then fan out** to each member's personal queue (`/user/queue/...`). This avoids per-conversation subscription management and makes membership changes instant.
4. **Cursor pagination** using message id, not offset.
5. **Storage behind an interface**, so Cloudinary/S3/local can be swapped.
6. **Flyway owns the schema**; Hibernate only validates.
