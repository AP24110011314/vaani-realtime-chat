# Architectural & Design Decisions

## 1. Spring Boot 4 Starter Web MVC and WebMvcTest
- Spring Boot 4.1.3 modularized web starters to `spring-boot-starter-webmvc` and test auto-configuration to `org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest`.
- Tested and verified with Java 21 LTS and Spring Boot 4.1.3.

## 2. Vite Proxy Configuration & Hostname
- In macOS development environments with Node 22+, Vite proxy is configured to route `/api` and `/ws` to `http://localhost:8080`.
- All ports (5173 for frontend, 8080 for backend, 3307 for Docker MySQL host port) are strictly respected.
