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
