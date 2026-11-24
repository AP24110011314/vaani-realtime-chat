package com.vanni;

import com.vanni.dto.request.AddMembersRequest;
import com.vanni.dto.request.CreateGroupRequest;
import com.vanni.dto.request.SetRoleRequest;
import com.vanni.dto.request.UpdateGroupRequest;
import com.vanni.dto.response.PresenceDto;
import com.vanni.entity.*;
import com.vanni.repository.*;
import com.vanni.security.JwtService;
import com.vanni.service.PresenceService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
public class GroupAndPresenceIntegrationTest {

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

    @Autowired
    private PresenceService presenceService;

    private final ObjectMapper objectMapper = new JsonMapper();

    private User alice;
    private User bob;
    private User charlie;
    private User outsider;

    private Cookie aliceCookie;
    private Cookie bobCookie;
    private Cookie charlieCookie;
    private Cookie outsiderCookie;

    @BeforeEach
    void setUp() {
        messageRepository.deleteAll();
        conversationMemberRepository.deleteAll();
        conversationRepository.deleteAll();
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();

        String pass = passwordEncoder.encode("Password123");

        alice = new User();
        alice.setName("Alice");
        alice.setEmail("alice@vanni.app");
        alice.setPasswordHash(pass);
        alice.setShowLastSeen(true);
        alice = userRepository.save(alice);

        bob = new User();
        bob.setName("Bob");
        bob.setEmail("bob@vanni.app");
        bob.setPasswordHash(pass);
        bob.setShowLastSeen(false); // Privacy test
        bob = userRepository.save(bob);

        charlie = new User();
        charlie.setName("Charlie");
        charlie.setEmail("charlie@vanni.app");
        charlie.setPasswordHash(pass);
        charlie.setShowLastSeen(true);
        charlie = userRepository.save(charlie);

        outsider = new User();
        outsider.setName("Outsider");
        outsider.setEmail("outsider@vanni.app");
        outsider.setPasswordHash(pass);
        outsider.setShowLastSeen(true);
        outsider = userRepository.save(outsider);

        aliceCookie = new Cookie("vanni_at", jwtService.generateAccessToken(alice.getId(), alice.getEmail(), alice.getName()));
        bobCookie = new Cookie("vanni_at", jwtService.generateAccessToken(bob.getId(), bob.getEmail(), bob.getName()));
        charlieCookie = new Cookie("vanni_at", jwtService.generateAccessToken(charlie.getId(), charlie.getEmail(), charlie.getName()));
        outsiderCookie = new Cookie("vanni_at", jwtService.generateAccessToken(outsider.getId(), outsider.getEmail(), outsider.getName()));
    }

    @Test
    void createGroup_success_andSystemMessageCreated() throws Exception {
        CreateGroupRequest req = new CreateGroupRequest("Engineering", "Tech discussions", List.of(bob.getId(), charlie.getId()));

        String responseJson = mockMvc.perform(post("/api/conversations/groups")
                .with(csrf())
                .cookie(aliceCookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.type").value("GROUP"))
                .andExpect(jsonPath("$.title").value("Engineering"))
                .andExpect(jsonPath("$.myRole").value("ADMIN"))
                .andExpect(jsonPath("$.members.length()").value(3))
                .andReturn().getResponse().getContentAsString();

        Long convId = objectMapper.readTree(responseJson).get("id").asLong();

        // Check system message was persisted
        List<Message> messages = messageRepository.findAll();
        assertThat(messages).hasSize(1);
        assertThat(messages.get(0).getMessageType()).isEqualTo(MessageType.SYSTEM);
        assertThat(messages.get(0).getContent()).contains("Alice created group \"Engineering\"");
        assertThat(messages.get(0).getConversation().getId()).isEqualTo(convId);
    }

    @Test
    void createGroup_tooFewMembers_fails() throws Exception {
        // Less than 2 other members
        CreateGroupRequest req = new CreateGroupRequest("Just Two", "Desc", List.of(bob.getId()));

        mockMvc.perform(post("/api/conversations/groups")
                .with(csrf())
                .cookie(aliceCookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void permissionMatrix_memberVsAdminVsOutsider() throws Exception {
        // 1. Alice creates group with Bob and Charlie
        CreateGroupRequest req = new CreateGroupRequest("Admins Only", "Desc", List.of(bob.getId(), charlie.getId()));
        String res = mockMvc.perform(post("/api/conversations/groups")
                .with(csrf())
                .cookie(aliceCookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        Long convId = objectMapper.readTree(res).get("id").asLong();

        // 2. Bob (MEMBER) tries to update title -> 403
        UpdateGroupRequest updateReq = new UpdateGroupRequest("Bob Title", null);
        mockMvc.perform(patch("/api/conversations/" + convId)
                .with(csrf())
                .cookie(bobCookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        // 3. Outsider tries to update title -> 404 NOT_FOUND (prevent information leakage)
        mockMvc.perform(patch("/api/conversations/" + convId)
                .with(csrf())
                .cookie(outsiderCookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        // 4. Bob tries to remove Charlie -> 403
        mockMvc.perform(delete("/api/conversations/" + convId + "/members/" + charlie.getId())
                .with(csrf())
                .cookie(bobCookie))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        // 5. Bob tries to change role -> 403
        SetRoleRequest roleReq = new SetRoleRequest(MemberRole.ADMIN);
        mockMvc.perform(patch("/api/conversations/" + convId + "/members/" + bob.getId() + "/role")
                .with(csrf())
                .cookie(bobCookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(roleReq)))
                .andExpect(status().isForbidden());

        // 6. Alice (ADMIN) promotes Bob to ADMIN -> 200
        mockMvc.perform(patch("/api/conversations/" + convId + "/members/" + bob.getId() + "/role")
                .with(csrf())
                .cookie(aliceCookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(roleReq)))
                .andExpect(status().isOk());

        // 7. Bob (now ADMIN) can update title -> 200
        mockMvc.perform(patch("/api/conversations/" + convId)
                .with(csrf())
                .cookie(bobCookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updateReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Bob Title"));
    }

    @Test
    void lastAdminLeaves_promotesOldestMember() throws Exception {
        CreateGroupRequest req = new CreateGroupRequest("Auto Promote", "Desc", List.of(bob.getId(), charlie.getId()));
        String res = mockMvc.perform(post("/api/conversations/groups")
                .with(csrf())
                .cookie(aliceCookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        Long convId = objectMapper.readTree(res).get("id").asLong();

        // Alice is only ADMIN. Alice leaves.
        mockMvc.perform(post("/api/conversations/" + convId + "/leave")
                .with(csrf())
                .cookie(aliceCookie))
                .andExpect(status().isNoContent());

        // Bob should be promoted to ADMIN
        ConversationMember bobMember = conversationMemberRepository
                .findByConversationIdAndUserIdAndLeftAtIsNull(convId, bob.getId()).orElseThrow();
        assertThat(bobMember.getRole()).isEqualTo(MemberRole.ADMIN);

        // System message should indicate Bob is now an admin
        List<Message> messages = messageRepository.findAll();
        boolean hasAdminMsg = messages.stream().anyMatch(m -> m.getContent() != null && m.getContent().contains("Bob is now an admin"));
        assertThat(hasAdminMsg).isTrue();
    }

    @Test
    void removedUser_cannotSendOrRead() throws Exception {
        CreateGroupRequest req = new CreateGroupRequest("Kick Group", "Desc", List.of(bob.getId(), charlie.getId()));
        String res = mockMvc.perform(post("/api/conversations/groups")
                .with(csrf())
                .cookie(aliceCookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        Long convId = objectMapper.readTree(res).get("id").asLong();

        // Alice removes Bob
        mockMvc.perform(delete("/api/conversations/" + convId + "/members/" + bob.getId())
                .with(csrf())
                .cookie(aliceCookie))
                .andExpect(status().isNoContent());

        // Bob tries to read messages -> 404 NOT_FOUND
        mockMvc.perform(get("/api/conversations/" + convId + "/messages")
                .cookie(bobCookie))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        // Bob tries to send a message -> 404 NOT_FOUND
        String sendJson = """
            { "content": "Let me back in!", "clientMessageId": "bob-msg-1" }
            """;
        mockMvc.perform(post("/api/conversations/" + convId + "/messages")
                .with(csrf())
                .cookie(bobCookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content(sendJson))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void presence_multiTabAndPrivacy() throws Exception {
        Long aliceId = alice.getId();
        Long bobId = bob.getId(); // bob has showLastSeen = false

        assertThat(presenceService.isOnline(aliceId)).isFalse();

        // 1. Tab 1 connects
        presenceService.onSessionConnected("tab-1", aliceId);
        assertThat(presenceService.isOnline(aliceId)).isTrue();

        // 2. Tab 2 connects
        presenceService.onSessionConnected("tab-2", aliceId);
        assertThat(presenceService.isOnline(aliceId)).isTrue();

        // 3. Tab 1 disconnects -> still online because tab 2 is open
        presenceService.onSessionDisconnected("tab-1");
        assertThat(presenceService.isOnline(aliceId)).isTrue();

        // 4. Tab 2 disconnects -> now offline
        presenceService.onSessionDisconnected("tab-2");
        assertThat(presenceService.isOnline(aliceId)).isFalse();

        // Check lastSeenAt in DB for Alice
        User aliceDb = userRepository.findById(aliceId).orElseThrow();
        assertThat(aliceDb.getLastSeenAt()).isNotNull();

        // 5. REST presence endpoint check
        // Alice has showLastSeen = true -> lastSeenAt should not be null
        List<PresenceDto> presenceList = presenceService.getPresence(List.of(aliceId, bobId), aliceId);
        assertThat(presenceList).hasSize(2);

        PresenceDto alicePresence = presenceList.stream().filter(p -> p.userId().equals(aliceId)).findFirst().orElseThrow();
        assertThat(alicePresence.online()).isFalse();
        assertThat(alicePresence.lastSeenAt()).isNotNull();

        // Bob has showLastSeen = false -> lastSeenAt should be null
        PresenceDto bobPresence = presenceList.stream().filter(p -> p.userId().equals(bobId)).findFirst().orElseThrow();
        assertThat(bobPresence.online()).isFalse();
        assertThat(bobPresence.lastSeenAt()).isNull();

        // Endpoint test
        mockMvc.perform(get("/api/presence")
                .cookie(aliceCookie)
                .param("userIds", aliceId + "," + bobId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }
}
