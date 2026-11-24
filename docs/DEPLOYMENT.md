# Vanni - Deployment Plan

## Topology (recommended)
```
 https://vanni.example.com        -> static frontend (Vercel/Netlify/Cloudflare Pages) 
 https://api.vanni.example.com    -> Spring Boot container (Render/Railway/Fly.io/VPS), WebSocket enabled
 Managed MySQL 8.4                -> PlanetScale-compatible/RDS/Cloud SQL/DO Managed
 Object storage                   -> Cloudinary or S3-compatible bucket
```
**Cookie note:** cookies must be shared between `vanni.example.com` and `api.vanni.example.com`. Use same-site (same registrable domain), `SameSite=Lax/Strict`, `Secure`, and set `Domain=.vanni.example.com` **or** put both behind one reverse proxy (`/api` and `/ws` forwarded) which is simpler and avoids CORS. Cross-site hosting on different registrable domains (e.g. `vercel.app` + `onrender.com`) will break cookie auth; avoid it or add a proxy rewrite.

## Backend container (`backend/Dockerfile`)
```dockerfile
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY . .
RUN ./mvnw -q -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
ENV SERVER_PORT=8080
EXPOSE 8080
USER 1000
ENTRYPOINT ["java","-jar","/app/app.jar"]
```

## Frontend build
```bash
cd frontend && npm ci && npm run build      # outputs dist/
```
Add SPA fallback (`/* -> /index.html`). If frontend and API are on different hosts, set `VITE_API_BASE` and `VITE_WS_PATH`/URL accordingly.

## Production environment variables
`SPRING_PROFILES_ACTIVE=prod`, `SERVER_PORT`, `DB_*`, `JWT_SECRET` (>= 64 random chars), `COOKIE_SECURE=true`, `ALLOWED_ORIGINS=https://vanni.example.com`, `STORAGE_PROVIDER`, storage credentials, `MAX_UPLOAD_MB`.

## Checklist
- [ ] HTTPS everywhere; HSTS enabled.
- [ ] Platform supports WebSockets and long-lived connections (check idle timeouts > 60 s; heartbeats are 10 s).
- [ ] Flyway runs on startup against the managed DB; DB user has least privilege (no DROP in prod if possible).
- [ ] Automated daily DB backups and a tested restore.
- [ ] `ddl-auto=validate`, springdoc disabled, actuator limited to `health`.
- [ ] CORS/Origin restricted to production origin.
- [ ] Rate limits on.
- [ ] Logs shipped; alerting on 5xx and WS error spikes.
- [ ] Single backend instance (in-memory broker). To scale horizontally: RabbitMQ STOMP relay + Redis presence + sticky sessions.

## CI/CD (GitHub Actions)
- `ci.yml`: on PR -> backend `./mvnw verify` (Testcontainers), frontend `npm ci && npm test -- --run && npm run build`.
- `deploy.yml`: on tag/main -> build image, push, deploy; frontend auto-deploys from the host.

## Release steps
1. Merge to `main`, ensure CI green.
2. Tag `v1.0.0` (git tag only; commit rule still applies to phases).
3. Deploy backend, run smoke test (`/actuator/health`, register, send message).
4. Deploy frontend.
5. Verify with two real devices.
