package com.vanni;

import com.vanni.dto.request.LoginRequest;
import com.vanni.dto.request.RegisterRequest;
import com.vanni.dto.request.SendMessageRequest;
import com.vanni.dto.response.ConversationDto;
import com.vanni.dto.response.MessageDto;
import com.vanni.entity.User;
import com.vanni.repository.*;
import com.vanni.security.JwtService;
import com.vanni.service.ConversationService;
import com.vanni.service.MessageService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
class SecurityChecklistIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private ConversationRepository conversationRepository;
    @Autowired
    private ConversationMemberRepository conversationMemberRepository;
    @Autowired
    private MessageRepository messageRepository;
    @Autowired
    private AttachmentRepository attachmentRepository;
    @Autowired
    private ReactionRepository reactionRepository;
    @Autowired
    private BlockRepository blockRepository;
    @Autowired
    private RefreshTokenRepository refreshTokenRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private JwtService jwtService;
    @Autowired
    private ConversationService conversationService;
    @Autowired
    private MessageService messageService;
    @Autowired
    private com.vanni.service.PresenceService presenceService;
    @Autowired
    private com.vanni.service.ReceiptService receiptService;

    private final ObjectMapper objectMapper = new JsonMapper();

    private User alice;
    private User bob;
    private User outsider;
    private Cookie aliceCookie;
    private Cookie bobCookie;
    private Cookie outsiderCookie;

    @BeforeEach
    void setUp() {
        reactionRepository.deleteAll();
        attachmentRepository.deleteAll();
        messageRepository.deleteAll();
        conversationMemberRepository.deleteAll();
        conversationRepository.deleteAll();
        blockRepository.deleteAll();
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();

        String pass = passwordEncoder.encode("Password123");
        alice = userRepository.save(User.builder().name("Alice").email("alice.sec@vanni.app").passwordHash(pass).build());
        bob = userRepository.save(User.builder().name("Bob").email("bob.sec@vanni.app").passwordHash(pass).build());
        outsider = userRepository.save(User.builder().name("Outsider").email("out.sec@vanni.app").passwordHash(pass).build());

        aliceCookie = new Cookie("vanni_at", jwtService.generateAccessToken(alice.getId(), alice.getEmail(), alice.getName()));
        bobCookie = new Cookie("vanni_at", jwtService.generateAccessToken(bob.getId(), bob.getEmail(), bob.getName()));
        outsiderCookie = new Cookie("vanni_at", jwtService.generateAccessToken(outsider.getId(), outsider.getEmail(), outsider.getName()));
    }

    @Test
    void securityHeaders_andRequestId_presentOnResponses() throws Exception {
        mockMvc.perform(get("/api/users/me")
                .cookie(aliceCookie)
                .header("X-Request-Id", "sec-check-001"))
            .andExpect(status().isOk())
            .andExpect(header().string("X-Content-Type-Options", "nosniff"))
            .andExpect(header().string("X-Frame-Options", "DENY"))
            .andExpect(header().string("Referrer-Policy", "no-referrer"))
            .andExpect(header().exists("Content-Security-Policy"))
            .andExpect(header().string("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()"))
            .andExpect(header().string("X-Request-Id", "sec-check-001"));
    }

    @Test
    void idor_outsiderCannotReadSendEditDeleteReactOrUploadIntoForeignConversation() throws Exception {
        ConversationDto conv = conversationService.getOrCreateDirect(alice.getId(), bob.getId());
        MessageDto msg = messageService.send(conv.id(), alice.getId(), new SendMessageRequest("Secret note", "c-sec-1", null, null));

        // Read messages
        mockMvc.perform(get("/api/conversations/" + conv.id() + "/messages").cookie(outsiderCookie))
            .andExpect(status().isNotFound());

        // Send message
        mockMvc.perform(post("/api/conversations/" + conv.id() + "/messages")
                .with(csrf()).cookie(outsiderCookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Intruder\",\"clientMessageId\":\"c-int-1\"}"))
            .andExpect(status().isNotFound());

        // Edit / Delete / React
        mockMvc.perform(patch("/api/messages/" + msg.id())
                .with(csrf()).cookie(outsiderCookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Hacked\"}"))
            .andExpect(status().isNotFound());

        mockMvc.perform(delete("/api/messages/" + msg.id())
                .with(csrf()).cookie(outsiderCookie))
            .andExpect(status().isNotFound());

        mockMvc.perform(put("/api/messages/" + msg.id() + "/reactions")
                .with(csrf()).cookie(outsiderCookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"emoji\":\"👍\"}"))
            .andExpect(status().isNotFound());

        // Search scoped to outsider -> never returns Alice/Bob message
        String searchBody = mockMvc.perform(get("/api/search/messages").cookie(outsiderCookie).param("q", "Secret"))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        assertThat(objectMapper.readTree(searchBody)).isEmpty();
    }

    @Test
    void csrf_missingTokenRejectedOnMutations() throws Exception {
        mockMvc.perform(patch("/api/users/me")
                .cookie(aliceCookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Alice Updated\"}"))
            .andExpect(status().isForbidden());
    }

    @Test
    void jwt_tamperedAndExpiredRejected() throws Exception {
        Cookie tampered = new Cookie("vanni_at", aliceCookie.getValue() + "tamper");
        mockMvc.perform(get("/api/users/me").cookie(tampered))
            .andExpect(status().isUnauthorized());

        JwtService expiredService = new JwtService("change-me-to-a-64-char-random-string-that-is-at-least-256-bits-long-vanni", -5);
        Cookie expired = new Cookie("vanni_at", expiredService.generateAccessToken(alice.getId(), alice.getEmail(), alice.getName()));
        mockMvc.perform(get("/api/users/me").cookie(expired))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void websocket_wrongOriginRejected() {
        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        WebSocketHttpHeaders headers = new WebSocketHttpHeaders();
        headers.add("Cookie", "vanni_at=" + aliceCookie.getValue());
        headers.add("Origin", "https://evil.example");

        String url = "ws://localhost:" + port + "/ws";
        assertThatThrownBy(() -> client.connectAsync(url, headers, new org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter() {})
            .get(3, TimeUnit.SECONDS))
            .isInstanceOf(Exception.class);
    }

    @Test
    void rateLimits_loginRegisterSearchMessagesAndUploadReturn429WithRetryAfter() throws Exception {
        // 1. Brute-force login -> 429 + Retry-After
        String badLoginJson = "{\"email\":\"alice.sec@vanni.app\",\"password\":\"WrongPass999\"}";
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/auth/login")
                    .with(csrf())
                    .header("X-Forwarded-For", "198.51.100.10")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(badLoginJson))
                .andExpect(status().isUnauthorized());
        }
        mockMvc.perform(post("/api/auth/login")
                .with(csrf())
                .header("X-Forwarded-For", "198.51.100.10")
                .contentType(MediaType.APPLICATION_JSON)
                .content(badLoginJson))
            .andExpect(status().isTooManyRequests())
            .andExpect(header().exists("Retry-After"))
            .andExpect(jsonPath("$.code").value("RATE_LIMITED"));

        // 2. Register rate limit (5/hr/IP) -> 6th returns 429
        for (int i = 0; i < 5; i++) {
            mockMvc.perform(post("/api/auth/register")
                    .with(csrf())
                    .header("X-Forwarded-For", "198.51.100.20")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"name\":\"Spam\",\"email\":\"spam" + i + "@vanni.app\",\"password\":\"Password123\"}"))
                .andExpect(status().isCreated());
        }
        mockMvc.perform(post("/api/auth/register")
                .with(csrf())
                .header("X-Forwarded-For", "198.51.100.20")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Spam6\",\"email\":\"spam6@vanni.app\",\"password\":\"Password123\"}"))
            .andExpect(status().isTooManyRequests())
            .andExpect(header().exists("Retry-After"));

        // 3. Search rate limit (30/min/user) -> 31st returns 429
        for (int i = 0; i < 30; i++) {
            mockMvc.perform(get("/api/search/messages").cookie(bobCookie).param("q", "hello"))
                .andExpect(status().isOk());
        }
        mockMvc.perform(get("/api/search/messages").cookie(bobCookie).param("q", "hello"))
            .andExpect(status().isTooManyRequests())
            .andExpect(header().exists("Retry-After"));
    }

    @Test
    void rateLimits_restSendAndUploadReturn429WithRetryAfter() throws Exception {
        ConversationDto conv = conversationService.getOrCreateDirect(alice.getId(), bob.getId());

        // REST send limit for alice (30 / 10s)
        for (int i = 0; i < 30; i++) {
            mockMvc.perform(post("/api/conversations/" + conv.id() + "/messages")
                    .with(csrf()).cookie(aliceCookie)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"content\":\"msg " + i + "\",\"clientMessageId\":\"rl-" + i + "\"}"))
                .andExpect(status().isCreated());
        }
        mockMvc.perform(post("/api/conversations/" + conv.id() + "/messages")
                .with(csrf()).cookie(aliceCookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"msg 31\",\"clientMessageId\":\"rl-31\"}"))
            .andExpect(status().isTooManyRequests())
            .andExpect(header().exists("Retry-After"));

        // Upload limit for outsider (20 / hr)
        byte[] validPngHeader = new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
        for (int i = 0; i < 20; i++) {
            MockMultipartFile file = new MockMultipartFile("file", "img" + i + ".png", "image/png", validPngHeader);
            mockMvc.perform(multipart("/api/attachments").file(file).with(csrf()).cookie(outsiderCookie))
                .andExpect(status().isCreated());
        }
        MockMultipartFile file21 = new MockMultipartFile("file", "img21.png", "image/png", validPngHeader);
        mockMvc.perform(multipart("/api/attachments").file(file21).with(csrf()).cookie(outsiderCookie))
            .andExpect(status().isTooManyRequests())
            .andExpect(header().exists("Retry-After"));
    }

    @Test
    void passwordsAndSecretsNeverInResponsesOrDtoStrings_andXssSafe() throws Exception {
        String meJson = mockMvc.perform(get("/api/users/me").cookie(aliceCookie))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        JsonNode meNode = objectMapper.readTree(meJson);
        assertThat(meNode.has("passwordHash")).isFalse();
        assertThat(meNode.has("password")).isFalse();

        // Request DTOs redact passwords in toString()
        assertThat(new LoginRequest("a@vanni.app", "Secret123").toString()).doesNotContain("Secret123");
        assertThat(new RegisterRequest("A", "a@vanni.app", "Secret123").toString()).doesNotContain("Secret123");

        // XSS payload stored cleanly in message and returned as JSON string
        ConversationDto conv = conversationService.getOrCreateDirect(bob.getId(), outsider.getId());
        String xss = "<script>alert('xss')</script>";
        String sent = mockMvc.perform(post("/api/conversations/" + conv.id() + "/messages")
                .with(csrf()).cookie(bobCookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new SendMessageRequest(xss, "xss-1", null, List.of()))))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        assertThat(objectMapper.readTree(sent).get("content").asText()).isEqualTo(xss);
    }

    @Test
    void blockedUser_cannotSeePresenceOrSearchOrDirectChat() throws Exception {
        presenceService.onSessionConnected("sec-presence-alice", alice.getId());
        try {
            mockMvc.perform(post("/api/users/" + bob.getId() + "/block")
                    .with(csrf()).cookie(aliceCookie))
                .andExpect(status().isNoContent());

            // Alice herself sees online=true
            mockMvc.perform(get("/api/presence")
                    .cookie(aliceCookie)
                    .param("userIds", alice.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].online").value(true));

            // Presence masked for blocked user even while Alice is connected
            mockMvc.perform(get("/api/presence")
                    .cookie(bobCookie)
                    .param("userIds", alice.getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].online").value(false))
                .andExpect(jsonPath("$[0].lastSeenAt").doesNotExist());
        } finally {
            presenceService.onSessionDisconnected("sec-presence-alice");
        }
    }

    @Test
    void idor_outsiderCannotDownloadGroupAvatar() throws Exception {
        ConversationDto group = conversationService.createGroup(
            alice.getId(),
            new com.vanni.dto.request.CreateGroupRequest("Avatar Group", null, List.of(bob.getId(), outsider.getId()))
        );
        byte[] validPngHeader = new byte[]{
            (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, (byte) 0xC4, (byte) 0x89,
            0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54,
            0x78, (byte) 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01,
            0x0D, 0x0A, 0x2D, (byte) 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
            (byte) 0xAE, 0x42, 0x60, (byte) 0x82
        };
        MockMultipartFile avatarFile = new MockMultipartFile("file", "grp.png", "image/png", validPngHeader);
        mockMvc.perform(multipart("/api/conversations/" + group.id() + "/avatar")
                .file(avatarFile).with(csrf()).cookie(aliceCookie))
            .andExpect(status().isOk());

        // Member can download group avatar
        mockMvc.perform(get("/api/conversations/" + group.id() + "/avatar").cookie(bobCookie))
            .andExpect(status().isOk());

        // Remove outsider, then verify outsider gets 404 (cannot download group avatar)
        mockMvc.perform(delete("/api/conversations/" + group.id() + "/members/" + outsider.getId())
                .with(csrf()).cookie(aliceCookie))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/conversations/" + group.id() + "/avatar").cookie(outsiderCookie))
            .andExpect(status().isNotFound());
    }

    @Test
    void receipts_idempotentUnderRepeatedDeliveryAndRead() {
        ConversationDto conv = conversationService.getOrCreateDirect(alice.getId(), bob.getId());
        MessageDto msg = messageService.send(conv.id(), alice.getId(), new SendMessageRequest("Receipt test", "r1", null));

        receiptService.markPendingDeliveredForUser(bob.getId());
        receiptService.markPendingDeliveredForUser(bob.getId());
        receiptService.markRead(bob.getId(), conv.id(), msg.id());
        receiptService.markRead(bob.getId(), conv.id(), msg.id());
    }

    @Test
    void auth_expiredAccessTokenRefreshedViaRefreshCookie() throws Exception {
        var loginRes = mockMvc.perform(post("/api/auth/login")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"alice.sec@vanni.app\",\"password\":\"Password123\"}"))
            .andExpect(status().isOk())
            .andReturn();

        Cookie rtCookie = loginRes.getResponse().getCookie("vanni_rt");
        assertThat(rtCookie).isNotNull();

        JwtService expiredService = new JwtService("change-me-to-a-64-char-random-string-that-is-at-least-256-bits-long-vanni", -5);
        Cookie expiredAt = new Cookie("vanni_at", expiredService.generateAccessToken(alice.getId(), alice.getEmail(), alice.getName()));

        mockMvc.perform(get("/api/users/me").cookie(expiredAt))
            .andExpect(status().isUnauthorized());

        var refreshRes = mockMvc.perform(post("/api/auth/refresh").with(csrf()).cookie(expiredAt, rtCookie))
            .andExpect(status().isOk())
            .andReturn();

        Cookie freshAt = refreshRes.getResponse().getCookie("vanni_at");
        assertThat(freshAt).isNotNull();

        mockMvc.perform(get("/api/users/me").cookie(freshAt))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email").value("alice.sec@vanni.app"));
    }
}
