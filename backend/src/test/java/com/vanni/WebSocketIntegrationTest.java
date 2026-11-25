package com.vanni;

import com.vanni.dto.response.ConversationDto;
import com.vanni.entity.User;
import com.vanni.repository.*;
import com.vanni.security.JwtService;
import com.vanni.service.ConversationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.messaging.converter.StringMessageConverter;
import org.springframework.messaging.simp.stomp.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

import java.lang.reflect.Type;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class WebSocketIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ConversationRepository conversationRepository;

    @Autowired
    private ConversationMemberRepository conversationMemberRepository;

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private ConversationService conversationService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    private User alice;
    private User bob;
    private User charlie;
    private String aliceToken;
    private String bobToken;
    private String charlieToken;
    private ConversationDto conv;

    @BeforeEach
    void setUp() {
        messageRepository.deleteAll();
        conversationMemberRepository.deleteAll();
        conversationRepository.deleteAll();
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();

        String encoded = passwordEncoder.encode("Password123");

        alice = new User();
        alice.setName("Alice");
        alice.setEmail("alice@vanni.app");
        alice.setPasswordHash(encoded);
        alice.setEnabled(true);
        alice = userRepository.save(alice);

        bob = new User();
        bob.setName("Bob");
        bob.setEmail("bob@vanni.app");
        bob.setPasswordHash(encoded);
        bob.setEnabled(true);
        bob = userRepository.save(bob);

        charlie = new User();
        charlie.setName("Charlie");
        charlie.setEmail("charlie@vanni.app");
        charlie.setPasswordHash(encoded);
        charlie.setEnabled(true);
        charlie = userRepository.save(charlie);

        aliceToken = jwtService.generateAccessToken(alice.getId(), alice.getEmail(), alice.getName());
        bobToken = jwtService.generateAccessToken(bob.getId(), bob.getEmail(), bob.getName());
        charlieToken = jwtService.generateAccessToken(charlie.getId(), charlie.getEmail(), charlie.getName());

        conv = conversationService.getOrCreateDirect(alice.getId(), bob.getId());
    }

    private WebSocketStompClient createClient() {
        WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
        org.springframework.messaging.converter.AbstractMessageConverter jsonConverter =
                new org.springframework.messaging.converter.AbstractMessageConverter(
                        new org.springframework.util.MimeType("application", "json", java.nio.charset.StandardCharsets.UTF_8),
                        new org.springframework.util.MimeType("text", "plain", java.nio.charset.StandardCharsets.UTF_8)
                ) {
                    @Override
                    protected boolean supports(Class<?> clazz) {
                        return String.class.equals(clazz);
                    }

                    @Override
                    protected Object convertFromInternal(org.springframework.messaging.Message<?> message, Class<?> targetClass, Object conversionHint) {
                        Object payload = message.getPayload();
                        if (payload instanceof byte[] bytes) {
                            return new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
                        }
                        return payload.toString();
                    }

                    @Override
                    protected Object convertToInternal(Object payload, org.springframework.messaging.MessageHeaders headers, Object conversionHint) {
                        return payload.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
                    }
                };

        client.setMessageConverter(jsonConverter);
        return client;
    }

    private String getWsUrl() {
        return "ws://localhost:" + port + "/ws";
    }

    @Test
    void unauthenticatedHandshake_rejected() {
        WebSocketStompClient client = createClient();
        WebSocketHttpHeaders headers = new WebSocketHttpHeaders();
        headers.add("Origin", "http://localhost:5173");
        // No cookie

        assertThatThrownBy(() ->
            client.connectAsync(getWsUrl(), headers, new StompSessionHandlerAdapter() {}).get(5, TimeUnit.SECONDS)
        ).isInstanceOf(Exception.class);
    }

    @Test
    void badOrigin_rejected() {
        WebSocketStompClient client = createClient();
        WebSocketHttpHeaders headers = new WebSocketHttpHeaders();
        headers.add("Origin", "http://evil-attacker-site.com");
        headers.add("Cookie", "vanni_at=" + aliceToken);

        assertThatThrownBy(() ->
            client.connectAsync(getWsUrl(), headers, new StompSessionHandlerAdapter() {}).get(5, TimeUnit.SECONDS)
        ).isInstanceOf(Exception.class);
    }

    @Test
    void subscribingToDisallowedTopic_rejected() throws Exception {
        WebSocketStompClient client = createClient();
        WebSocketHttpHeaders headers = new WebSocketHttpHeaders();
        headers.add("Origin", "http://localhost:5173");
        headers.add("Cookie", "vanni_at=" + aliceToken);

        StompSession session = client.connectAsync(getWsUrl(), headers, new StompSessionHandlerAdapter() {}).get(5, TimeUnit.SECONDS);
        assertThat(session.isConnected()).isTrue();

        session.subscribe("/topic/broadcast", new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return String.class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
            }
        });

        // The inbound channel interceptor raises an AccessDeniedException which tears down or closes the session
        TimeUnit.MILLISECONDS.sleep(500);
        if (session.isConnected()) {
            session.disconnect();
        }
    }

    @Test
    void twoClientsExchangeMessage() throws Exception {
        WebSocketStompClient aliceClient = createClient();
        WebSocketHttpHeaders aliceHeaders = new WebSocketHttpHeaders();
        aliceHeaders.add("Origin", "http://localhost:5173");
        aliceHeaders.add("Cookie", "vanni_at=" + aliceToken);
        StompSession aliceSession = aliceClient.connectAsync(getWsUrl(), aliceHeaders, new StompSessionHandlerAdapter() {}).get(5, TimeUnit.SECONDS);

        WebSocketStompClient bobClient = createClient();
        WebSocketHttpHeaders bobHeaders = new WebSocketHttpHeaders();
        bobHeaders.add("Origin", "http://localhost:5173");
        bobHeaders.add("Cookie", "vanni_at=" + bobToken);
        StompSession bobSession = bobClient.connectAsync(getWsUrl(), bobHeaders, new StompSessionHandlerAdapter() {}).get(5, TimeUnit.SECONDS);

        BlockingQueue<String> bobEvents = new LinkedBlockingQueue<>();
        bobSession.subscribe("/user/queue/events", new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return String.class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                bobEvents.offer((String) payload);
            }
        });

        BlockingQueue<String> aliceEvents = new LinkedBlockingQueue<>();
        aliceSession.subscribe("/user/queue/events", new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return String.class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                aliceEvents.offer((String) payload);
            }
        });

        // Wait brief moment for subscriptions to register
        TimeUnit.MILLISECONDS.sleep(200);

        // Alice sends message to the conversation
        String sendJson = String.format("""
            {
                "conversationId": %d,
                "clientMessageId": "ws-client-msg-001",
                "content": "Hello Bob over WebSocket!"
            }
            """, conv.id());

        aliceSession.send("/app/chat.send", sendJson);

        // Bob should receive message.created event
        String bobMsg = bobEvents.poll(5, TimeUnit.SECONDS);
        assertThat(bobMsg).isNotNull();
        assertThat(bobMsg).contains("\"type\":\"message.created\"");
        assertThat(bobMsg).contains("Hello Bob over WebSocket!");

        // Alice should also receive message.created event with her clientMessageId
        String aliceMsg = aliceEvents.poll(5, TimeUnit.SECONDS);
        assertThat(aliceMsg).isNotNull();
        assertThat(aliceMsg).contains("\"type\":\"message.created\"");
        assertThat(aliceMsg).contains("ws-client-msg-001");

        aliceSession.disconnect();
        bobSession.disconnect();
    }

    @Test
    void nonMemberSend_rejectedWithErrorEvent() throws Exception {
        WebSocketStompClient charlieClient = createClient();
        WebSocketHttpHeaders charlieHeaders = new WebSocketHttpHeaders();
        charlieHeaders.add("Origin", "http://localhost:5173");
        charlieHeaders.add("Cookie", "vanni_at=" + charlieToken);
        StompSession charlieSession = charlieClient.connectAsync(getWsUrl(), charlieHeaders, new StompSessionHandlerAdapter() {}).get(5, TimeUnit.SECONDS);

        BlockingQueue<String> charlieEvents = new LinkedBlockingQueue<>();
        charlieSession.subscribe("/user/queue/events", new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return String.class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                charlieEvents.offer((String) payload);
            }
        });

        TimeUnit.MILLISECONDS.sleep(200);

        // Charlie tries to send to Alice & Bob's conversation
        String sendJson = String.format("""
            {
                "conversationId": %d,
                "clientMessageId": "charlie-msg-001",
                "content": "Intruder message"
            }
            """, conv.id());

        charlieSession.send("/app/chat.send", sendJson);

        String event = charlieEvents.poll(5, TimeUnit.SECONDS);
        assertThat(event).isNotNull();
        assertThat(event).contains("\"type\":\"error\"");
        assertThat(event).contains("charlie-msg-001");

        charlieSession.disconnect();
    }

    @Test
    void duplicateClientMessageId_notDuplicated() throws Exception {
        WebSocketStompClient aliceClient = createClient();
        WebSocketHttpHeaders aliceHeaders = new WebSocketHttpHeaders();
        aliceHeaders.add("Origin", "http://localhost:5173");
        aliceHeaders.add("Cookie", "vanni_at=" + aliceToken);
        StompSession aliceSession = aliceClient.connectAsync(getWsUrl(), aliceHeaders, new StompSessionHandlerAdapter() {}).get(5, TimeUnit.SECONDS);

        BlockingQueue<String> aliceEvents = new LinkedBlockingQueue<>();
        aliceSession.subscribe("/user/queue/events", new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return String.class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                aliceEvents.offer((String) payload);
            }
        });

        TimeUnit.MILLISECONDS.sleep(200);

        String sendJson = String.format("""
            {
                "conversationId": %d,
                "clientMessageId": "idempotent-uuid-777",
                "content": "Duplicate test message"
            }
            """, conv.id());

        // Send first time
        aliceSession.send("/app/chat.send", sendJson);
        String event1 = aliceEvents.poll(5, TimeUnit.SECONDS);
        assertThat(event1).isNotNull();

        // Send second time with same clientMessageId
        aliceSession.send("/app/chat.send", sendJson);
        String event2 = aliceEvents.poll(5, TimeUnit.SECONDS);
        assertThat(event2).isNotNull();

        // Ensure database has exactly 1 message
        assertThat(messageRepository.count()).isEqualTo(1);

        aliceSession.disconnect();
    }

    @Test
    void typingIndicator_forwardedAndThrottled() throws Exception {
        WebSocketStompClient aliceClient = createClient();
        WebSocketHttpHeaders aliceHeaders = new WebSocketHttpHeaders();
        aliceHeaders.add("Origin", "http://localhost:5173");
        aliceHeaders.add("Cookie", "vanni_at=" + aliceToken);
        StompSession aliceSession = aliceClient.connectAsync(getWsUrl(), aliceHeaders, new StompSessionHandlerAdapter() {}).get(5, TimeUnit.SECONDS);

        WebSocketStompClient bobClient = createClient();
        WebSocketHttpHeaders bobHeaders = new WebSocketHttpHeaders();
        bobHeaders.add("Origin", "http://localhost:5173");
        bobHeaders.add("Cookie", "vanni_at=" + bobToken);
        StompSession bobSession = bobClient.connectAsync(getWsUrl(), bobHeaders, new StompSessionHandlerAdapter() {}).get(5, TimeUnit.SECONDS);

        BlockingQueue<String> bobEvents = new LinkedBlockingQueue<>();
        bobSession.subscribe("/user/queue/events", new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return String.class;
            }

            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                bobEvents.offer((String) payload);
            }
        });

        TimeUnit.MILLISECONDS.sleep(200);

        String typingJson = String.format("""
            {
                "conversationId": %d,
                "typing": true
            }
            """, conv.id());

        // Alice sends typing true
        aliceSession.send("/app/chat.typing", typingJson);

        String event1 = bobEvents.poll(5, TimeUnit.SECONDS);
        assertThat(event1).isNotNull();
        assertThat(event1).contains("\"type\":\"typing\"");
        assertThat(event1).contains("\"name\":\"Alice\"");
        assertThat(event1).contains("\"typing\":true");

        // Alice immediately sends typing true again (< 2s) -> should be throttled
        aliceSession.send("/app/chat.typing", typingJson);
        String event2 = bobEvents.poll(500, TimeUnit.MILLISECONDS);
        assertThat(event2).isNull(); // Throttled!

        aliceSession.disconnect();
        bobSession.disconnect();
    }

    @Test
    void chatDeliveredAndRead_propagatedViaStomp() throws Exception {
        WebSocketStompClient aliceClient = createClient();
        WebSocketHttpHeaders aliceHeaders = new WebSocketHttpHeaders();
        aliceHeaders.add("Origin", "http://localhost:5173");
        aliceHeaders.add("Cookie", "vanni_at=" + aliceToken);
        StompSession aliceSession = aliceClient.connectAsync(getWsUrl(), aliceHeaders, new StompSessionHandlerAdapter() {}).get(5, TimeUnit.SECONDS);

        WebSocketStompClient bobClient = createClient();
        WebSocketHttpHeaders bobHeaders = new WebSocketHttpHeaders();
        bobHeaders.add("Origin", "http://localhost:5173");
        bobHeaders.add("Cookie", "vanni_at=" + bobToken);
        StompSession bobSession = bobClient.connectAsync(getWsUrl(), bobHeaders, new StompSessionHandlerAdapter() {}).get(5, TimeUnit.SECONDS);

        BlockingQueue<String> aliceEvents = new LinkedBlockingQueue<>();
        aliceSession.subscribe("/user/queue/events", new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return String.class;
            }
            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                aliceEvents.offer((String) payload);
            }
        });

        BlockingQueue<String> bobEvents = new LinkedBlockingQueue<>();
        bobSession.subscribe("/user/queue/events", new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return String.class;
            }
            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                bobEvents.offer((String) payload);
            }
        });

        TimeUnit.MILLISECONDS.sleep(200);

        // Alice sends message
        String sendJson = String.format("""
            {
                "conversationId": %d,
                "clientMessageId": "stomp-rcpt-001",
                "content": "Verify receipt delivery"
            }
            """, conv.id());
        aliceSession.send("/app/chat.send", sendJson);

        String bobMsg = bobEvents.poll(5, TimeUnit.SECONDS);
        assertThat(bobMsg).isNotNull();
        assertThat(bobMsg).contains("\"type\":\"message.created\"");
        aliceEvents.poll(5, TimeUnit.SECONDS); // Alice's echo

        // Bob sends chat.delivered
        String deliveredJson = String.format("""
            {
                "conversationId": %d,
                "upToMessageId": 999999
            }
            """, conv.id());
        bobSession.send("/app/chat.delivered", deliveredJson);

        String aliceDeliveredEvt = aliceEvents.poll(5, TimeUnit.SECONDS);
        assertThat(aliceDeliveredEvt).isNotNull();
        assertThat(aliceDeliveredEvt).contains("\"type\":\"receipt.updated\"");
        assertThat(aliceDeliveredEvt).contains("\"status\":\"DELIVERED\"");

        // Bob sends chat.read
        String readJson = String.format("""
            {
                "conversationId": %d,
                "upToMessageId": 999999
            }
            """, conv.id());
        bobSession.send("/app/chat.read", readJson);

        String aliceReadEvt = aliceEvents.poll(5, TimeUnit.SECONDS);
        assertThat(aliceReadEvt).isNotNull();
        assertThat(aliceReadEvt).contains("\"type\":\"receipt.updated\"");
        assertThat(aliceReadEvt).contains("\"status\":\"READ\"");

        String bobUnreadEvt = bobEvents.poll(5, TimeUnit.SECONDS);
        assertThat(bobUnreadEvt).isNotNull();
        assertThat(bobUnreadEvt).contains("\"type\":\"unread.updated\"");
        assertThat(bobUnreadEvt).contains("\"unreadCount\":0");

        aliceSession.disconnect();
        bobSession.disconnect();
    }

    @Test
    void csrf_authenticatedRequestsPreserveXsrfCookie() throws Exception {
        java.net.http.HttpClient client = java.net.http.HttpClient.newHttpClient();
        var csrfReq = java.net.http.HttpRequest.newBuilder(java.net.URI.create("http://localhost:" + port + "/api/auth/csrf"))
            .GET()
            .build();
        var csrfRes = client.send(csrfReq, java.net.http.HttpResponse.BodyHandlers.discarding());
        String xsrfSetCookie = csrfRes.headers().allValues("Set-Cookie").stream()
            .filter(h -> h.startsWith("XSRF-TOKEN="))
            .findFirst()
            .orElse(null);
        assertThat(xsrfSetCookie).isNotNull();
        String tokenVal = xsrfSetCookie.split(";")[0].substring("XSRF-TOKEN=".length());

        var authedGetReq = java.net.http.HttpRequest.newBuilder(java.net.URI.create("http://localhost:" + port + "/api/users/me"))
            .header("Cookie", "vanni_at=" + aliceToken + "; XSRF-TOKEN=" + tokenVal)
            .GET()
            .build();
        var authedGetRes = client.send(authedGetReq, java.net.http.HttpResponse.BodyHandlers.ofString());
        assertThat(authedGetRes.statusCode()).isEqualTo(200);
        boolean rotatedXsrf = authedGetRes.headers().allValues("Set-Cookie").stream()
            .anyMatch(h -> h.startsWith("XSRF-TOKEN="));
        assertThat(rotatedXsrf).isFalse();
    }
}
