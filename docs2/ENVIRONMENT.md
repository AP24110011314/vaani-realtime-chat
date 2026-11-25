# Vanni - Environment, Ports and macOS Setup

## Ports
| Service | Port | Notes |
|---|---|---|
| Frontend (Vite) | **5173** | `strictPort: true` so it never silently moves |
| Backend (Spring Boot) | **8080** | `server.port=${SERVER_PORT:8080}` |
| MySQL (Docker host port) | **3307** | Container still listens on 3306 internally; 3307 avoids clashing with a Homebrew MySQL |
| Optional MinIO | 9000 / 9001 | only if testing S3 locally |

### Ports to avoid on a MacBook
- **5000** and **7000**: used by the macOS *AirPlay Receiver* (Control Center) since Monterey. Do not use them anywhere in this project.
- 3000 and 8000 are free on most machines but are not used here to keep things consistent.
- If a port is busy: `lsof -nP -iTCP:8080 -sTCP:LISTEN` then change the port via env var. Do not kill system processes.

## Prerequisites (macOS)
```bash
# Homebrew packages
brew install openjdk@21 node@22 git
brew install --cask docker           # Docker Desktop

# Make Java 21 visible
sudo ln -sfn $(brew --prefix openjdk@21)/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-21.jdk
java -version                         # should print 21.x
node -v && npm -v
```
Apple Silicon (M-series) works natively; use the `mysql:8.4` image (multi-arch).

## Repository layout
```
vanni/
  backend/        Spring Boot app
  frontend/       React app
  database/       schema reference + seed.sql
  docs/           these docs
  docker-compose.yml
  .env.example
  .gitignore
  README.md  CLAUDE.md
```

## docker-compose.yml (root)
```yaml
services:
  mysql:
    image: mysql:8.4
    container_name: vanni-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD:-rootpass}
      MYSQL_DATABASE: vanni
      MYSQL_USER: ${DB_USER:-vanni}
      MYSQL_PASSWORD: ${DB_PASSWORD:-vannipass}
    ports:
      - "3307:3306"
    command: ["--character-set-server=utf8mb4", "--collation-server=utf8mb4_0900_ai_ci"]
    volumes:
      - vanni_mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-uroot", "-p${DB_ROOT_PASSWORD:-rootpass}"]
      interval: 10s
      timeout: 5s
      retries: 10
volumes:
  vanni_mysql_data:
```
`utf8mb4` is required so emoji store correctly.

## Environment variables
`.env.example` (commit this) - copy to `.env` (never commit):
```properties
# Backend
SERVER_PORT=8080
DB_HOST=localhost
DB_PORT=3307
DB_NAME=vanni
DB_USER=vanni
DB_PASSWORD=vannipass
JWT_SECRET=change-me-to-a-64-char-random-string
JWT_ACCESS_TTL_MINUTES=15
JWT_REFRESH_TTL_DAYS=7
COOKIE_SECURE=false
ALLOWED_ORIGINS=http://localhost:5173
STORAGE_PROVIDER=local          # local | cloudinary | s3
STORAGE_LOCAL_DIR=./uploads
MAX_UPLOAD_MB=10
CLOUDINARY_URL=
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=

# Frontend (Vite; only VITE_* are exposed to the browser - never put secrets here)
VITE_API_BASE=/api
VITE_WS_PATH=/ws
```
Generate a secret: `openssl rand -base64 64`.

## Spring configuration (`application.yml`)
```yaml
server:
  port: ${SERVER_PORT:8080}
spring:
  application:
    name: vanni
  datasource:
    url: jdbc:mysql://${DB_HOST:localhost}:${DB_PORT:3307}/${DB_NAME:vanni}?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
    username: ${DB_USER:vanni}
    password: ${DB_PASSWORD:vannipass}
  jpa:
    hibernate:
      ddl-auto: validate
    open-in-view: false
  flyway:
    enabled: true
  servlet:
    multipart:
      max-file-size: ${MAX_UPLOAD_MB:10}MB
      max-request-size: ${MAX_UPLOAD_MB:10}MB
```
Store all timestamps in **UTC**; the browser formats them in local time.

## Vite proxy (`frontend/vite.config.js`)
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: false },
      '/ws':  { target: 'ws://localhost:8080', ws: true, changeOrigin: false },
    },
  },
})
```

## Run commands
```bash
docker compose up -d mysql                     # database
cd backend && ./mvnw spring-boot:run           # http://localhost:8080
cd frontend && npm install && npm run dev      # http://localhost:5173
```
Use two browsers (or one normal + one private window) to test two users at once.

## Advanced features: extra configuration (Phases 11-17)

### Extra ports (none are 5000 or 7000)
| Service | Port | Notes |
|---|---|---|
| coturn (STUN/TURN) | 3478 UDP+TCP | optional, Phase 17 |
| coturn TLS | 5349 | production only |
| coturn relay range | 49160-49200 UDP | production only |

### Additional `.env.example` entries
```properties
# Link previews (Phase 14)
LINK_PREVIEW_ENABLED=true
LINK_PREVIEW_ALLOW_PRIVATE_HOSTS=false      # NEVER true outside automated tests
LINK_PREVIEW_MAX_HTML_KB=1024
LINK_PREVIEW_MAX_IMAGE_KB=3072

# Scheduled messages (Phase 15)
SCHEDULE_MIN_LEAD_SECONDS=60                # use 5 for e2e tests
SCHEDULE_MAX_DAYS=90
SCHEDULE_MAX_PENDING=50

# AI (Phase 16)
AI_FEATURES_ENABLED=false
ANTHROPIC_API_KEY=
AI_MODEL=claude-haiku-5-5
AI_MAX_INPUT_CHARS=60000
AI_TIMEOUT_SECONDS=30
AI_RATE_PER_HOUR=10
AI_RATE_PER_DAY=30

# Calls (Phase 17)
STUN_URLS=stun:stun.l.google.com:19302
TURN_URLS=                                  # e.g. turn:turn.example.com:3478?transport=udp,turn:turn.example.com:3478?transport=tcp
TURN_SECRET=                                # same value as coturn static-auth-secret
TURN_TTL_SECONDS=3600
CALL_RING_TIMEOUT_SECONDS=45
```

### Optional coturn service (`docker-compose.calls.yml`)
```yaml
services:
  coturn:
    image: coturn/coturn:4.6
    container_name: vanni-coturn
    network_mode: host            # works on Linux servers; Docker Desktop for Mac does not support host networking
    command: >
      -n --log-file=stdout --fingerprint --use-auth-secret
      --static-auth-secret=${TURN_SECRET} --realm=vanni
      --listening-port=3478 --min-port=49160 --max-port=49200
      --no-multicast-peers --no-cli
      --denied-peer-ip=10.0.0.0-10.255.255.255
      --denied-peer-ip=172.16.0.0-172.31.255.255
      --denied-peer-ip=192.168.0.0-192.168.255.255
      --denied-peer-ip=127.0.0.0-127.255.255.255
      --denied-peer-ip=169.254.0.0-169.254.255.255
```
On a MacBook: skip TURN for local testing (two browser windows on the same machine connect directly). Use a small cloud VM running this file when you need cross-network testing.

### Dev tips
- Camera/microphone need `http://localhost:5173` (secure context). If you open the app via your LAN IP (e.g. `http://192.168.x.x:5173`) from a phone, the browser will block camera and microphone unless you serve HTTPS (use `vite --host` with a local certificate, e.g. mkcert, or a tunnel such as Cloudflare Tunnel).
- Playwright for calls: launch Chromium with `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`.
