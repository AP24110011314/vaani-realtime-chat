package com.vanni;

import com.vanni.dto.request.ConversationSettingsRequest;
import com.vanni.dto.request.CreateDirectConversationRequest;
import com.vanni.dto.request.CreateGroupRequest;
import com.vanni.dto.request.EditMessageRequest;
import com.vanni.dto.request.MarkReadRequest;
import com.vanni.dto.request.SendMessageRequest;
import com.vanni.dto.response.ConversationDto;
import com.vanni.dto.response.MessageDto;
import com.vanni.entity.NotifyMode;
import com.vanni.entity.User;
import com.vanni.repository.ConversationRepository;
import com.vanni.repository.MessageMentionRepository;
import com.vanni.repository.MessageRepository;
import com.vanni.repository.UserRepository;
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
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
public class MentionsIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private ConversationRepository conversationRepository;
    @Autowired private MessageRepository messageRepository;
    @Autowired private MessageMentionRepository messageMentionRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;

    private final ObjectMapper objectMapper = new JsonMapper();

    private User adminUser;
    private User memberB;
    private User memberC;
    private User outsider;

    @BeforeEach
    void setup() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        adminUser = saveUser("Admin_" + suffix, "admin_" + suffix + "@vanni.test");
        memberB = saveUser("Bob_" + suffix, "bob_" + suffix + "@vanni.test");
        memberC = saveUser("Carol_<script>alert(1)</script>_" + suffix, "carol_" + suffix + "@vanni.test");
        outsider = saveUser("Outsider_" + suffix, "out_" + suffix + "@vanni.test");
    }

    private User saveUser(String name, String email) {
        User u = new User();
        u.setName(name);
        u.setEmail(email);
        u.setPasswordHash(passwordEncoder.encode("Password123!"));
        return userRepository.save(u);
    }

    private Cookie authCookie(User u) {
        return new Cookie("vanni_at", jwtService.generateAccessToken(u.getId(), u.getEmail(), u.getName()));
    }

    private ConversationDto createGroup(User creator, String title, List<Long> memberIds) throws Exception {
        MvcResult res = mockMvc.perform(post("/api/conversations/groups")
                .cookie(authCookie(creator)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreateGroupRequest(title, "Mentions test group", memberIds))))
            .andExpect(status().isCreated())
            .andReturn();
        return objectMapper.readValue(res.getResponse().getContentAsString(), ConversationDto.class);
    }

    @Test
    void mentionLifecycle_unreadBadge_clearOnRead_renameUpdates_xssSafe_andSearch() throws Exception {
        ConversationDto group = createGroup(adminUser, "Mention Team", List.of(memberB.getId(), memberC.getId()));

        // Bob sets notifyMode = MENTIONS
        mockMvc.perform(patch("/api/conversations/" + group.id() + "/settings")
                .cookie(authCookie(memberB)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ConversationSettingsRequest(null, null, null, NotifyMode.MENTIONS))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.notifyMode").value("MENTIONS"))
            .andExpect(jsonPath("$.muted").value(false));

        // Admin mentions Bob + invalid outsider + invalid ID
        String raw = "Hello <@" + memberB.getId() + "> and <@" + outsider.getId() + "> and <@999999>";
        MvcResult sendRes = mockMvc.perform(post("/api/conversations/" + group.id() + "/messages")
                .cookie(authCookie(adminUser)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new SendMessageRequest(raw, UUID.randomUUID().toString(), null, null))))
            .andExpect(status().isCreated())
            .andReturn();

        MessageDto sent = objectMapper.readValue(sendRes.getResponse().getContentAsString(), MessageDto.class);
        assertThat(sent.mentions()).hasSize(1);
        assertThat(sent.mentions().get(0).userId()).isEqualTo(memberB.getId());
        assertThat(sent.mentions().get(0).name()).isEqualTo(memberB.getName());
        assertThat(sent.mentionsMe()).isFalse(); // sender is not "mentioned" as recipient
        assertThat(sent.previewText()).contains("@" + memberB.getName());
        assertThat(sent.previewText()).contains("<@" + outsider.getId() + ">"); // invalid non-member remains literal

        // Bob sees mentionUnreadCount == 1
        mockMvc.perform(get("/api/conversations/" + group.id())
                .cookie(authCookie(memberB)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.mentionUnreadCount").value(1));

        // Carol (not mentioned) sees mentionUnreadCount == 0
        mockMvc.perform(get("/api/conversations/" + group.id())
                .cookie(authCookie(memberC)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.mentionUnreadCount").value(0));

        // Bob reads the conversation -> mentionUnreadCount clears to 0
        mockMvc.perform(post("/api/conversations/" + group.id() + "/read")
                .cookie(authCookie(memberB)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new MarkReadRequest(sent.id(), sent.id()))))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/conversations/" + group.id())
                .cookie(authCookie(memberB)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.mentionUnreadCount").value(0));

        // Search by Bob's name finds the message; searching by raw token "<@id>" does NOT
        mockMvc.perform(get("/api/search/messages")
                .param("q", memberB.getName())
                .param("conversationId", String.valueOf(group.id()))
                .cookie(authCookie(adminUser)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(sent.id()));

        mockMvc.perform(get("/api/search/messages")
                .param("q", "<@" + memberB.getId() + ">")
                .param("conversationId", String.valueOf(group.id()))
                .cookie(authCookie(adminUser)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isEmpty());

        // Rename Bob -> history pill reflects new name automatically
        String newBobName = "BobbyRenamed_" + UUID.randomUUID().toString().substring(0, 6);
        memberB.setName(newBobName);
        userRepository.save(memberB);

        mockMvc.perform(get("/api/conversations/" + group.id() + "/messages")
                .cookie(authCookie(adminUser)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].mentions[0].name").value(newBobName))
            .andExpect(jsonPath("$[0].previewText").value(org.hamcrest.Matchers.containsString("@" + newBobName)));

        // Edit message to mention Carol (with XSS payload in name) instead of Bob -> no re-notify
        MvcResult editRes = mockMvc.perform(patch("/api/messages/" + sent.id())
                .cookie(authCookie(adminUser)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new EditMessageRequest("Ping <@" + memberC.getId() + ">"))))
            .andExpect(status().isOk())
            .andReturn();
        MessageDto edited = objectMapper.readValue(editRes.getResponse().getContentAsString(), MessageDto.class);
        assertThat(edited.mentions()).hasSize(1);
        assertThat(edited.mentions().get(0).name()).contains("<script>alert(1)</script>");
        assertThat(edited.shouldNotify()).isFalse();
    }

    @Test
    void mentionAll_adminOnly_andRateLimited_andMentionableExcludesRemovedMembers() throws Exception {
        ConversationDto group = createGroup(adminUser, "Admin All Team", List.of(memberB.getId(), memberC.getId()));

        // Non-admin Bob sends <@all> -> ignored (mentionsAll = false)
        mockMvc.perform(post("/api/conversations/" + group.id() + "/messages")
                .cookie(authCookie(memberB)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new SendMessageRequest("Hey <@all>", UUID.randomUUID().toString(), null, null))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.mentionsAll").value(false));

        // Admin sends <@all> -> accepted; second <@all> within 5 min -> 429 RATE_LIMITED
        mockMvc.perform(post("/api/conversations/" + group.id() + "/messages")
                .cookie(authCookie(adminUser)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new SendMessageRequest("Heads up <@all>", UUID.randomUUID().toString(), null, null))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.mentionsAll").value(true));

        mockMvc.perform(post("/api/conversations/" + group.id() + "/messages")
                .cookie(authCookie(adminUser)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new SendMessageRequest("Again <@all>", UUID.randomUUID().toString(), null, null))))
            .andExpect(status().isTooManyRequests())
            .andExpect(jsonPath("$.code").value("RATE_LIMITED"));

        // Mentionable endpoint lists Bob & Carol (not self), and after removing Carol she disappears
        mockMvc.perform(get("/api/conversations/" + group.id() + "/mentionable")
                .cookie(authCookie(adminUser)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2));

        mockMvc.perform(delete("/api/conversations/" + group.id() + "/members/" + memberC.getId())
                .cookie(authCookie(adminUser)).with(csrf()))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/conversations/" + group.id() + "/mentionable")
                .cookie(authCookie(adminUser)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].id").value(memberB.getId()));

        // Direct chat mentionable returns empty
        MvcResult dmRes = mockMvc.perform(post("/api/conversations/direct")
                .cookie(authCookie(adminUser)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreateDirectConversationRequest(memberB.getId()))))
            .andExpect(status().isCreated())
            .andReturn();
        ConversationDto dm = objectMapper.readValue(dmRes.getResponse().getContentAsString(), ConversationDto.class);
        mockMvc.perform(get("/api/conversations/" + dm.id() + "/mentionable")
                .cookie(authCookie(adminUser)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isEmpty());
    }
}
