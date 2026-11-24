package com.vanni;

import com.vanni.entity.User;
import com.vanni.repository.*;
import com.vanni.security.JwtService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class ConversationIntegrationTest {

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
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    private User user1;
    private User user2;
    private User user3;
    private Cookie user1Cookie;
    private Cookie user2Cookie;
    private Cookie user3Cookie;

    @BeforeEach
    void setUp() {
        messageRepository.deleteAll();
        conversationMemberRepository.deleteAll();
        conversationRepository.deleteAll();
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();

        String encodedPassword = passwordEncoder.encode("Password123");

        user1 = new User();
        user1.setName("Alice");
        user1.setEmail("alice@vanni.app");
        user1.setPasswordHash(encodedPassword);
        user1.setEnabled(true);
        user1 = userRepository.save(user1);

        user2 = new User();
        user2.setName("Bob");
        user2.setEmail("bob@vanni.app");
        user2.setPasswordHash(encodedPassword);
        user2.setEnabled(true);
        user2 = userRepository.save(user2);

        user3 = new User();
        user3.setName("Charlie");
        user3.setEmail("charlie@vanni.app");
        user3.setPasswordHash(encodedPassword);
        user3.setEnabled(true);
        user3 = userRepository.save(user3);

        user1Cookie = new Cookie("vanni_at", jwtService.generateAccessToken(user1.getId(), user1.getEmail(), user1.getName()));
        user2Cookie = new Cookie("vanni_at", jwtService.generateAccessToken(user2.getId(), user2.getEmail(), user2.getName()));
        user3Cookie = new Cookie("vanni_at", jwtService.generateAccessToken(user3.getId(), user3.getEmail(), user3.getName()));
    }

    @Test
    void getOrCreateDirect_idempotent() throws Exception {
        String reqBody = String.format("{\"userId\": %d}", user2.getId());

        // First call creates conversation
        MvcResult res1 = mockMvc.perform(post("/api/conversations/direct")
                .with(csrf())
                .cookie(user1Cookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content(reqBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.type").value("DIRECT"))
                .andExpect(jsonPath("$.title").value("Bob"))
                .andReturn();

        Number convId1 = com.jayway.jsonpath.JsonPath.read(res1.getResponse().getContentAsString(), "$.id");

        // Second call from user1 returns the same conversation
        MvcResult res2 = mockMvc.perform(post("/api/conversations/direct")
                .with(csrf())
                .cookie(user1Cookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content(reqBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(convId1))
                .andReturn();

        // Third call from user2 towards user1 also returns the same conversation
        String reverseReq = String.format("{\"userId\": %d}", user1.getId());
        mockMvc.perform(post("/api/conversations/direct")
                .with(csrf())
                .cookie(user2Cookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content(reverseReq))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(convId1))
                .andExpect(jsonPath("$.title").value("Alice"));

        assertThat(conversationRepository.count()).isEqualTo(1);
    }

    @Test
    void getOrCreateDirect_cannotChatWithSelf() throws Exception {
        String reqBody = String.format("{\"userId\": %d}", user1.getId());

        mockMvc.perform(post("/api/conversations/direct")
                .with(csrf())
                .cookie(user1Cookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content(reqBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_PARTICIPANT"));
    }

    @Test
    void nonMemberCannotReadOrSend() throws Exception {
        // Create conversation between user1 and user2
        String reqBody = String.format("{\"userId\": %d}", user2.getId());
        MvcResult res = mockMvc.perform(post("/api/conversations/direct")
                .with(csrf())
                .cookie(user1Cookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content(reqBody))
                .andExpect(status().isCreated())
                .andReturn();

        Number convId = com.jayway.jsonpath.JsonPath.read(res.getResponse().getContentAsString(), "$.id");

        // User3 attempts to view conversation details
        mockMvc.perform(get("/api/conversations/" + convId)
                .cookie(user3Cookie))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        // User3 attempts to read message history
        mockMvc.perform(get("/api/conversations/" + convId + "/messages")
                .cookie(user3Cookie))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        // User3 attempts to send message
        mockMvc.perform(post("/api/conversations/" + convId + "/messages")
                .with(csrf())
                .cookie(user3Cookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\": \"Intruder message\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void sendMessage_duplicateClientMessageId_returnsSameMessage() throws Exception {
        String directReq = String.format("{\"userId\": %d}", user2.getId());
        MvcResult res = mockMvc.perform(post("/api/conversations/direct")
                .with(csrf())
                .cookie(user1Cookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content(directReq))
                .andExpect(status().isCreated())
                .andReturn();

        Number convId = com.jayway.jsonpath.JsonPath.read(res.getResponse().getContentAsString(), "$.id");

        String sendJson = """
            {
                "clientMessageId": "c018a4a2-1b1e-450e-9400-b6154e1a0001",
                "content": "Hello Bob!"
            }
            """;

        MvcResult msgRes1 = mockMvc.perform(post("/api/conversations/" + convId + "/messages")
                .with(csrf())
                .cookie(user1Cookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content(sendJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.content").value("Hello Bob!"))
                .andReturn();

        Number msgId1 = com.jayway.jsonpath.JsonPath.read(msgRes1.getResponse().getContentAsString(), "$.id");

        // Send again with same clientMessageId
        MvcResult msgRes2 = mockMvc.perform(post("/api/conversations/" + convId + "/messages")
                .with(csrf())
                .cookie(user1Cookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content(sendJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(msgId1))
                .andExpect(jsonPath("$.content").value("Hello Bob!"))
                .andReturn();

        assertThat(messageRepository.count()).isEqualTo(1);
    }

    @Test
    void sendMessage_blankContent_rejected() throws Exception {
        String directReq = String.format("{\"userId\": %d}", user2.getId());
        MvcResult res = mockMvc.perform(post("/api/conversations/direct")
                .with(csrf())
                .cookie(user1Cookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content(directReq))
                .andExpect(status().isCreated())
                .andReturn();

        Number convId = com.jayway.jsonpath.JsonPath.read(res.getResponse().getContentAsString(), "$.id");

        mockMvc.perform(post("/api/conversations/" + convId + "/messages")
                .with(csrf())
                .cookie(user1Cookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\": \"   \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void messagePagination_orderAndCursor() throws Exception {
        String directReq = String.format("{\"userId\": %d}", user2.getId());
        MvcResult res = mockMvc.perform(post("/api/conversations/direct")
                .with(csrf())
                .cookie(user1Cookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content(directReq))
                .andExpect(status().isCreated())
                .andReturn();

        Number convId = com.jayway.jsonpath.JsonPath.read(res.getResponse().getContentAsString(), "$.id");

        // Send 5 messages
        for (int i = 1; i <= 5; i++) {
            mockMvc.perform(post("/api/conversations/" + convId + "/messages")
                    .with(csrf())
                    .cookie(user1Cookie)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"content\": \"Message " + i + "\"}"))
                    .andExpect(status().isCreated());
        }

        // Fetch page 1: size = 2 (latest 2 messages: Msg 5 and Msg 4)
        MvcResult page1 = mockMvc.perform(get("/api/conversations/" + convId + "/messages")
                .cookie(user1Cookie)
                .param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].content").value("Message 5"))
                .andExpect(jsonPath("$[1].content").value("Message 4"))
                .andReturn();

        Number msg4Id = com.jayway.jsonpath.JsonPath.read(page1.getResponse().getContentAsString(), "$[1].id");

        // Fetch page 2: before = msg4Id, size = 2 (Msg 3 and Msg 2)
        mockMvc.perform(get("/api/conversations/" + convId + "/messages")
                .cookie(user1Cookie)
                .param("before", msg4Id.toString())
                .param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].content").value("Message 3"))
                .andExpect(jsonPath("$[1].content").value("Message 2"));
    }

    @Test
    void searchUsers_filtersAndExcludesSelf() throws Exception {
        // Query "li" matches Alice and Charlie, but caller is Alice so only Charlie should return
        mockMvc.perform(get("/api/users")
                .cookie(user1Cookie)
                .param("query", "li"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Charlie"));

        // Query "bob" matches Bob
        mockMvc.perform(get("/api/users")
                .cookie(user1Cookie)
                .param("query", "bob"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].name").value("Bob"));

        // Query shorter than 2 chars returns empty list
        mockMvc.perform(get("/api/users")
                .cookie(user1Cookie)
                .param("query", "b"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }
}
