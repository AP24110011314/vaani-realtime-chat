# Phase 2 - Authentication

**Commit message:** `Add Authentication`
**Goal:** users can register, log in/out and stay signed in; protected routes work.
**Read:** `SECURITY.md` (section 1), `API.md` (Auth, Users/me), `DATABASE.md` (users, refresh_tokens)

## Backend tasks
1. Migration `V2__auth.sql`: finish `users` columns (about, privacy flags, enabled, last_seen_at) and add `refresh_tokens`.
2. Entities `User`, `RefreshToken`; repositories.
3. `JwtService` (create/validate access token, claims: sub=userId, exp), `CookieUtil` (set/clear `vanni_at`, `vanni_rt`, flags from `COOKIE_SECURE`).
4. `JwtAuthFilter` reads the cookie and sets the security context. Principal exposes numeric user id.
5. `SecurityConfig`: stateless, CSRF with cookie repository + SPA handler, permit `/api/auth/**` and `/actuator/health`, everything else authenticated, 401 entry point, security headers.
6. `AuthService`: register (lowercase email, unique check, BCrypt 12), login (generic error, dummy hash on unknown email), refresh with **rotation and reuse detection**, logout, logout-all, change-password.
7. `AuthController` + `UserController` (`GET/PATCH /users/me`) per `API.md`.
8. `GlobalExceptionHandler` with the standard error shape; validation messages per field.
9. Basic login/register rate limiting (Bucket4j).
10. Scheduled cleanup of expired refresh tokens.
11. Remove the temporary ping endpoint (or keep under `/actuator`).

## Frontend tasks
1. `api/http.js` (axios, credentials, XSRF), single-flight 401 refresh interceptor.
2. `AuthContext` (`user`, `loading`, `login`, `register`, `logout`), bootstraps via `GET /users/me`.
3. `ProtectedRoute` and `PublicOnlyRoute`; `AppRoutes`.
4. Pages: `LandingPage` (Vanni branding, Sign up / Log in), `RegisterPage`, `LoginPage` with React Hook Form + Zod (name 2-80, valid email, password >= 8 with letter + digit, confirm match), show/hide password, server error display.
5. Basic `/app` shell placeholder with user chip and Logout button.
6. Common components: `Button`, `Input`, `Spinner`, `Toast`.
7. Responsive layouts for all three public pages.

## Tests
Backend: register OK / duplicate email 409 / weak password 400; login OK / bad credentials 401 (same message for unknown email); expired token 401; refresh rotates and old token reuse revokes family; CSRF missing header 403; password stored as BCrypt.
Frontend: form validation, redirect when unauthenticated, redirect away from login when authenticated.

## Acceptance checklist
- [x] Register -> lands in `/app` signed in; cookies are HttpOnly (check DevTools).
- [x] Refresh the page keeps the session; logout clears it and `/app` redirects to `/login`.
- [x] Wrong password shows a generic error; 6th rapid attempt gets 429.
- [x] DB contains only BCrypt hashes.
- [x] Tests green; build passes.

## Commit
```bash
git add -A && git commit -m "Add Authentication"
```
