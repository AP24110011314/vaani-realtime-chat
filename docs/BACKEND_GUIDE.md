# Vanni - Backend Guide (Spring Boot)

## Conventions
- Package root `com.vanni`. Layers: `controller -> service -> repository`. Entities never leave the service layer.
- DTOs are Java `record`s in `dto.request` / `dto.response`. Mapping via small mapper classes or MapStruct.
- Constructor injection only. `@Transactional` on service methods (read-only where possible).
- Controllers are thin: validate (`@Valid`), get current user id (`@AuthenticationPrincipal`), call service, return DTO.
- One `GlobalExceptionHandler` (`@RestControllerAdvice`) maps exceptions to the error shape in `API.md`.
- `spring.jpa.open-in-view=false`. Use `@EntityGraph` or DTO projections for list endpoints.
- Config via `application.yml` and env vars. Profiles: `dev` (seed data, SQL logging, springdoc), `prod`.
- Boot 4 notes: starters are more modular (use `spring-boot-starter-webmvc`, matching `*-test` starters); Jackson 3 uses the `tools.jackson` packages; Spring Security 7 - use the lambda DSL. Confirm exact artifact names in start.spring.io.

## Security configuration outline
```java
@Configuration @EnableMethodSecurity
class SecurityConfig {
  @Bean SecurityFilterChain chain(HttpSecurity http, JwtAuthFilter jwt) throws Exception {
    http.csrf(c -> c.csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                    .csrfTokenRequestHandler(new SpaCsrfTokenRequestHandler())
                    .ignoringRequestMatchers("/api/auth/login", "/api/auth/register")) // still rate limited
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(a -> a
            .requestMatchers("/api/auth/**", "/actuator/health").permitAll()
            .requestMatchers("/ws/**").authenticated()
            .anyRequest().authenticated())
        .addFilterBefore(jwt, UsernamePasswordAuthenticationFilter.class)
        .exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)));
    return http.build();
  }
}
```
(Prefer CSRF-protecting login too if time allows: the SPA first calls `GET /api/auth/csrf` to receive the cookie.)

## WebSocket configuration outline
```java
@Configuration @EnableWebSocketMessageBroker
class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
  public void registerStompEndpoints(StompEndpointRegistry r) {
    r.addEndpoint("/ws").setAllowedOriginPatterns(allowedOrigins).addInterceptors(jwtHandshakeInterceptor);
  }
  public void configureMessageBroker(MessageBrokerRegistry r) {
    r.setApplicationDestinationPrefixes("/app");
    r.enableSimpleBroker("/queue").setHeartbeatValue(new long[]{10000, 10000}).setTaskScheduler(taskScheduler);
    r.setUserDestinationPrefix("/user");
  }
  public void configureClientInboundChannel(ChannelRegistration c) { c.interceptors(wsAuthInterceptor, wsRateLimitInterceptor); }
}
```

## Service responsibilities
| Service | Key methods |
|---|---|
| AuthService | register, login, refresh (rotate), logout, changePassword |
| UserService | getMe, updateProfile, search, setAvatar, block/unblock |
| ConversationService | getOrCreateDirect, createGroup, list, addMembers, removeMember, leave, setRole, updateSettings |
| ConversationAccessService | requireMember, requireAdmin |
| MessageService | send (idempotent), history, edit, delete, react |
| ReceiptService | markDelivered, markRead, summaryFor(message) |
| PresenceService | onConnect, onDisconnect, isOnline, snapshot |
| AttachmentService | upload, link, authorizeDownload |
| EventPublisher | sendToUser, sendToConversation (fan-out to members, after commit) |

## Message send algorithm (idempotent)
```
send(userId, req):
  member = access.requireMember(req.conversationId, userId)
  if direct && blocked(either way) -> Forbidden
  validate content/attachments/replyTo belongs to same conversation
  existing = messages.findBySenderAndClientMessageId(...)  -> return it (retry safe)
  msg = save(...)
  conversation.lastMessageId/At = msg
  link attachments
  afterCommit: publisher.fanOut(conversation members, "message.created", dto)
```

## Exceptions
`ApiException(status, code, message)` base; subclasses `NotFoundException`, `ForbiddenException`, `ConflictException`, `ValidationException`, `RateLimitedException`.

## Code quality
- Checkstyle/Spotless optional; `mvn -q verify` must pass before each phase commit.
- No `System.out`. Use SLF4J. No sensitive data in logs.
