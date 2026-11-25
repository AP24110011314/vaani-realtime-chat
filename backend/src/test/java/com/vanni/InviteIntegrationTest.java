package com.vanni;

import com.vanni.dto.request.AddMembersRequest;
import com.vanni.dto.request.CreateGroupRequest;
import com.vanni.dto.request.CreateInviteRequest;
import com.vanni.dto.response.*;
import com.vanni.entity.GroupInvite;
import com.vanni.entity.User;
import com.vanni.repository.GroupInviteRepository;
import com.vanni.repository.UserRepository;
import com.vanni.security.JwtService;
import com.vanni.service.InviteService;
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

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
public class InviteIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private GroupInviteRepository groupInviteRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;
    @Autowired private InviteService inviteService;

    private final ObjectMapper objectMapper = new JsonMapper();

    private User admin;
    private User member;
    private User candidate1;
    private User candidate2;
    private User candidate3;

    @BeforeEach
    void setup() {
        String s = UUID.randomUUID().toString().substring(0, 8);
        admin = saveUser("Admin_" + s, "inv_adm_" + s + "@vanni.test");
        member = saveUser("Member_" + s, "inv_mem_" + s + "@vanni.test");
        candidate1 = saveUser("Cand1_" + s, "inv_c1_" + s + "@vanni.test");
        candidate2 = saveUser("Cand2_" + s, "inv_c2_" + s + "@vanni.test");
        candidate3 = saveUser("Cand3_" + s, "inv_c3_" + s + "@vanni.test");
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
                .content(objectMapper.writeValueAsString(new CreateGroupRequest(title, "Invite test group", memberIds))))
            .andExpect(status().isCreated())
            .andReturn();
        return objectMapper.readValue(res.getResponse().getContentAsString(), ConversationDto.class);
    }

    private String extractCode(String url) {
        return url.substring(url.lastIndexOf('/') + 1);
    }

    @Test
    void inviteLifecycle_hashOnlyInDb_revoke_expiry_nonAdminForbidden_andBanEnforcement() throws Exception {
        ConversationDto group = createGroup(admin, "Invite Squad", List.of(member.getId(), candidate3.getId()));

        // Non-admin cannot create or list invites
        mockMvc.perform(post("/api/conversations/" + group.id() + "/invites")
                .cookie(authCookie(member)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreateInviteRequest(3600, 10, false))))
            .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/conversations/" + group.id() + "/invites")
                .cookie(authCookie(member)))
            .andExpect(status().isForbidden());

        // Admin creates invite
        MvcResult createRes = mockMvc.perform(post("/api/conversations/" + group.id() + "/invites")
                .cookie(authCookie(admin)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreateInviteRequest(3600, 5, false))))
            .andExpect(status().isCreated())
            .andReturn();

        InviteDto created = objectMapper.readValue(createRes.getResponse().getContentAsString(), InviteDto.class);
        assertThat(created.url()).contains("/join/");
        String rawCode = extractCode(created.url());
        assertThat(rawCode.length()).isGreaterThanOrEqualTo(40);

        // DB stores SHA-256 hash only (no plaintext code)
        GroupInvite dbInvite = groupInviteRepository.findById(created.id()).orElseThrow();
        assertThat(dbInvite.getCodeHash()).isEqualTo(InviteService.sha256Hex(rawCode));
        assertThat(dbInvite.getCodeHash()).isNotEqualTo(rawCode);
        assertThat(dbInvite.getCodePrefix()).isEqualTo(rawCode.substring(0, 6));

        // Admin list does NOT return full URL/code
        mockMvc.perform(get("/api/conversations/" + group.id() + "/invites")
                .cookie(authCookie(admin)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].url").doesNotExist())
            .andExpect(jsonPath("$[0].codePrefix").value(rawCode.substring(0, 6)));

        // Candidate1 previews and joins
        mockMvc.perform(get("/api/invites/" + rawCode)
                .cookie(authCookie(candidate1)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("Invite Squad"))
            .andExpect(jsonPath("$.memberCount").value(3));

        mockMvc.perform(post("/api/invites/" + rawCode + "/join")
                .cookie(authCookie(candidate1)).with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("JOINED"))
            .andExpect(jsonPath("$.conversation.id").value(group.id()));

        // System message created
        mockMvc.perform(get("/api/conversations/" + group.id() + "/messages")
                .cookie(authCookie(admin)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].content").value(candidate1.getName() + " joined using an invite link"));

        // Admin removes candidate1 -> banned -> cannot preview or rejoin via invite link
        mockMvc.perform(delete("/api/conversations/" + group.id() + "/members/" + candidate1.getId())
                .cookie(authCookie(admin)).with(csrf()))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/invites/" + rawCode)
                .cookie(authCookie(candidate1)))
            .andExpect(status().isNotFound());

        mockMvc.perform(post("/api/invites/" + rawCode + "/join")
                .cookie(authCookie(candidate1)).with(csrf()))
            .andExpect(status().isForbidden());

        // Admin manually re-adds candidate1 -> clears ban
        mockMvc.perform(post("/api/conversations/" + group.id() + "/members")
                .cookie(authCookie(admin)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new AddMembersRequest(List.of(candidate1.getId())))))
            .andExpect(status().isOk());

        // Revoke invite -> generic 404
        mockMvc.perform(delete("/api/conversations/" + group.id() + "/invites/" + created.id())
                .cookie(authCookie(admin)).with(csrf()))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/invites/" + rawCode)
                .cookie(authCookie(candidate2)))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("INVITE_INVALID"));

        // Unknown & expired invites fail with same generic 404
        mockMvc.perform(get("/api/invites/unknown-nonexistent-code")
                .cookie(authCookie(candidate2)))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("INVITE_INVALID"));

        InviteDto expInv = inviteService.create(group.id(), admin.getId(), new CreateInviteRequest(3600, 5, false));
        GroupInvite expRow = groupInviteRepository.findById(expInv.id()).orElseThrow();
        expRow.setExpiresAt(Instant.now().minusSeconds(10));
        groupInviteRepository.save(expRow);

        mockMvc.perform(get("/api/invites/" + extractCode(expInv.url()))
                .cookie(authCookie(candidate2)))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("INVITE_INVALID"));
    }

    @Test
    void concurrentLastUseRace_onlyOneUserSucceeds() throws Exception {
        ConversationDto group = createGroup(admin, "Race Group", List.of(member.getId(), candidate3.getId()));
        InviteDto inv = inviteService.create(group.id(), admin.getId(), new CreateInviteRequest(3600, 1, false));
        String rawCode = extractCode(inv.url());

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch go = new CountDownLatch(1);

        Callable<Boolean> task1 = () -> {
            ready.countDown();
            go.await(5, TimeUnit.SECONDS);
            try {
                inviteService.join(rawCode, candidate1.getId());
                return true;
            } catch (Exception e) {
                return false;
            }
        };
        Callable<Boolean> task2 = () -> {
            ready.countDown();
            go.await(5, TimeUnit.SECONDS);
            try {
                inviteService.join(rawCode, candidate2.getId());
                return true;
            } catch (Exception e) {
                return false;
            }
        };

        Future<Boolean> f1 = pool.submit(task1);
        Future<Boolean> f2 = pool.submit(task2);
        assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
        go.countDown();

        boolean r1 = f1.get(10, TimeUnit.SECONDS);
        boolean r2 = f2.get(10, TimeUnit.SECONDS);
        pool.shutdownNow();

        // Exactly one winner!
        assertThat(r1 ^ r2).isTrue();
        GroupInvite updated = groupInviteRepository.findById(inv.id()).orElseThrow();
        assertThat(updated.getUseCount()).isEqualTo(1);
    }

    @Test
    void approvalFlow_andRateLimit() throws Exception {
        ConversationDto group = createGroup(admin, "Approval Squad", List.of(member.getId(), candidate3.getId()));
        InviteDto inv = inviteService.create(group.id(), admin.getId(), new CreateInviteRequest(3600, 10, true));
        String rawCode = extractCode(inv.url());

        // Candidate1 requests to join -> 202 PENDING
        MvcResult joinRes = mockMvc.perform(post("/api/invites/" + rawCode + "/join")
                .cookie(authCookie(candidate1)).with(csrf()))
            .andExpect(status().isAccepted())
            .andExpect(jsonPath("$.status").value("PENDING"))
            .andReturn();
        JoinInviteResponse pendingRes = objectMapper.readValue(joinRes.getResponse().getContentAsString(), JoinInviteResponse.class);
        Long reqId = pendingRes.request().id();

        // Candidate1 is NOT a member yet
        mockMvc.perform(get("/api/conversations/" + group.id())
                .cookie(authCookie(candidate1)))
            .andExpect(status().isNotFound());

        // Admin sees 1 pending request and approves
        mockMvc.perform(get("/api/conversations/" + group.id() + "/join-requests")
                .cookie(authCookie(admin)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1));

        mockMvc.perform(post("/api/conversations/" + group.id() + "/join-requests/" + reqId + "/approve")
                .cookie(authCookie(admin)).with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("APPROVED"));

        // Candidate1 is now a member
        mockMvc.perform(get("/api/conversations/" + group.id())
                .cookie(authCookie(candidate1)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(group.id()));

        // Rate limit: 10/min/user on preview/join -> 11th returns 429
        for (int i = 0; i < 10; i++) {
            mockMvc.perform(get("/api/invites/badcode-" + i)
                    .cookie(authCookie(candidate2)))
                .andExpect(status().isNotFound());
        }
        mockMvc.perform(get("/api/invites/badcode-11")
                .cookie(authCookie(candidate2)))
            .andExpect(status().isTooManyRequests())
            .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
    }
}
