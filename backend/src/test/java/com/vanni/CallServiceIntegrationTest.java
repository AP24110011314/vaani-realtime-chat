package com.vanni;

import com.vanni.dto.response.ConversationDto;
import com.vanni.dto.response.IceServersResponse;
import com.vanni.dto.response.MessageDto;
import com.vanni.entity.*;
import com.vanni.exception.ApiException;
import com.vanni.repository.*;
import com.vanni.security.JwtService;
import com.vanni.service.CallService;
import com.vanni.service.CallSessionRegistry;
import com.vanni.service.CallSessionRegistry.CallSession;
import com.vanni.service.IceServerService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
    "app.calls.stun-urls=stun:stun.example.com:3478",
    "app.calls.turn-urls=turn:turn.example.com:3478?transport=udp",
    "app.calls.turn-secret=super-secret-turn-key-for-tests",
    "app.calls.turn-ttl-seconds=3600",
    "app.calls.ring-timeout-seconds=1",
    "app.calls.disconnect-grace-seconds=1"
})
public class CallServiceIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;
    @Autowired private CallService callService;
    @Autowired private CallSessionRegistry registry;
    @Autowired private CallLogRepository callLogRepository;
    @Autowired private MessageRepository messageRepository;
    @Autowired private BlockRepository blockRepository;

    private final ObjectMapper objectMapper = JsonMapper.builder().build();

    private User asha;
    private User ravi;
    private User meera;

    @BeforeEach
    void setup() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        asha = createUser("Asha " + suffix, "asha." + suffix + "@call.app");
        ravi = createUser("Ravi " + suffix, "ravi." + suffix + "@call.app");
        meera = createUser("Meera " + suffix, "meera." + suffix + "@call.app");
    }

    private User createUser(String name, String email) {
        User u = new User();
        u.setName(name);
        u.setEmail(email);
        u.setPasswordHash(passwordEncoder.encode("Password123"));
        return userRepository.save(u);
    }

    private Cookie authCookie(User u) {
        return new Cookie("vanni_at", jwtService.generateAccessToken(u.getId(), u.getEmail(), u.getName()));
    }

    private Long createDirectConv(User u1, User u2) throws Exception {
        MvcResult res = mockMvc.perform(post("/api/conversations/direct")
                .with(csrf())
                .cookie(authCookie(u1))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userId\":" + u2.getId() + "}"))
            .andExpect(status().is2xxSuccessful())
            .andReturn();
        return objectMapper.readValue(res.getResponse().getContentAsString(), ConversationDto.class).id();
    }

    private Long createGroupConv(User creator, User... members) throws Exception {
        String ids = java.util.Arrays.stream(members).map(u -> String.valueOf(u.getId())).collect(java.util.stream.Collectors.joining(","));
        MvcResult res = mockMvc.perform(post("/api/conversations/groups")
                .with(csrf())
                .cookie(authCookie(creator))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Call Group\",\"memberIds\":[" + ids + "]}"))
            .andExpect(status().is2xxSuccessful())
            .andReturn();
        return objectMapper.readValue(res.getResponse().getContentAsString(), ConversationDto.class).id();
    }

    @Test
    void iceServersFormatHmacCredentialsAndRespectRelayOnlySetting() throws Exception {
        MvcResult res1 = mockMvc.perform(get("/api/calls/ice-servers")
                .cookie(authCookie(asha)))
            .andExpect(status().isOk())
            .andReturn();
        IceServersResponse ice1 = objectMapper.readValue(res1.getResponse().getContentAsString(), IceServersResponse.class);
        assertThat(ice1.relayOnly()).isFalse();
        assertThat(ice1.iceServers()).hasSize(2);
        IceServersResponse.IceServerDto turn = ice1.iceServers().get(1);
        assertThat(turn.username()).endsWith(":" + asha.getId());
        assertThat(turn.credential()).isEqualTo(
            IceServerService.computeTurnCredential("super-secret-turn-key-for-tests", turn.username())
        );
        assertThat(res1.getResponse().getContentAsString()).doesNotContain("super-secret-turn-key-for-tests");

        // Enable callsRelayOnly via PATCH /api/users/me
        mockMvc.perform(patch("/api/users/me")
                .with(csrf())
                .cookie(authCookie(asha))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"callsRelayOnly\":true}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.callsRelayOnly").value(true));

        MvcResult res2 = mockMvc.perform(get("/api/calls/ice-servers")
                .cookie(authCookie(asha)))
            .andExpect(status().isOk())
            .andReturn();
        IceServersResponse ice2 = objectMapper.readValue(res2.getResponse().getContentAsString(), IceServersResponse.class);
        assertThat(ice2.relayOnly()).isTrue();
        assertThat(ice2.iceServers()).hasSize(1);
        assertThat(ice2.iceServers().get(0).urls().get(0)).startsWith("turn:");
    }

    @Test
    void stateMachineEnforcesTransitionsAuthorizationSignalSecurityAndCallLogs() throws Exception {
        Long directId = createDirectConv(asha, ravi);
        Long groupId = createGroupConv(asha, ravi, meera);

        // Group calls blocked
        assertThatThrownBy(() -> callService.invite(asha.getId(), groupId, CallType.VIDEO, null))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("direct");

        // Asha invites Ravi
        CallSession session = callService.invite(asha.getId(), directId, CallType.VIDEO, "c1");
        assertThat(session).isNotNull();
        assertThat(session.getState()).isEqualTo(CallState.RINGING);

        // Caller cannot accept own invite
        assertThatThrownBy(() -> callService.accept(asha.getId(), session.getCallId(), "s1"))
            .isInstanceOf(ApiException.class);

        // Meera calls busy Ravi -> returns null, leaves Ravi's call intact, frees Meera
        Long meeraRaviId = createDirectConv(meera, ravi);
        assertThat(callService.invite(meera.getId(), meeraRaviId, CallType.AUDIO, null)).isNull();
        assertThat(registry.getActiveCallForUser(meera.getId())).isEmpty();
        assertThat(registry.getActiveCallForUser(ravi.getId())).isPresent();

        // Ravi accepts; second accept rejected
        callService.accept(ravi.getId(), session.getCallId(), "tab-1");
        assertThat(session.getState()).isEqualTo(CallState.CONNECTING);
        assertThatThrownBy(() -> callService.accept(ravi.getId(), session.getCallId(), "tab-2"))
            .isInstanceOf(ApiException.class);

        // Signal validations
        assertThatThrownBy(() -> callService.relaySignal(meera.getId(), session.getCallId(), "offer", "{}", Map.of()))
            .isInstanceOf(ApiException.class);
        String huge = "a".repeat(17 * 1024);
        assertThatThrownBy(() -> callService.relaySignal(asha.getId(), session.getCallId(), "offer", huge, Map.of("sdp", huge)))
            .isInstanceOf(ApiException.class);
        callService.relaySignal(asha.getId(), session.getCallId(), "offer", "{\"sdp\":\"v=0\"}", Map.of("sdp", "v=0"));

        // Connected -> End writes COMPLETED call log & CALL message
        callService.updateState(asha.getId(), session.getCallId(), "CONNECTED");
        assertThat(session.getState()).isEqualTo(CallState.CONNECTED);

        callService.end(asha.getId(), session.getCallId());
        assertThat(registry.getActiveCallForUser(asha.getId())).isEmpty();
        assertThat(registry.getActiveCallForUser(ravi.getId())).isEmpty();

        List<CallLog> logs = callLogRepository.findTop20ByConversationIdOrderByEndedAtDesc(directId);
        assertThat(logs).hasSize(1);
        assertThat(logs.get(0).getEndReason()).isEqualTo(CallEndReason.COMPLETED);

        MvcResult histRes = mockMvc.perform(get("/api/conversations/" + directId + "/messages")
                .cookie(authCookie(ravi)))
            .andExpect(status().isOk())
            .andReturn();
        MessageDto[] msgs = objectMapper.readValue(histRes.getResponse().getContentAsString(), MessageDto[].class);
        assertThat(msgs).anySatisfy(m -> {
            assertThat(m.type()).isEqualTo(MessageType.CALL);
            assertThat(m.content()).startsWith("Video call");
            assertThat(m.callLog()).isNotNull();
            assertThat(m.callLog().endReason()).isEqualTo("COMPLETED");
        });
    }

    @Test
    void ringTimeoutDisconnectGraceBlockDeclineAndCancelWorkCleanly() throws Exception {
        Long directId = createDirectConv(asha, ravi);

        // 1. Ring timeout -> MISSED (ring-timeout-seconds=1)
        CallSession missedSession = callService.invite(asha.getId(), directId, CallType.AUDIO, null);
        Thread.sleep(1400);
        assertThat(registry.get(missedSession.getCallId())).isEmpty();
        assertThat(registry.getActiveCallForUser(asha.getId())).isEmpty();
        assertThat(callLogRepository.findTop20ByConversationIdOrderByEndedAtDesc(directId))
            .anySatisfy(l -> assertThat(l.getEndReason()).isEqualTo(CallEndReason.MISSED));

        // 2. Cancel by caller
        CallSession cancelSession = callService.invite(asha.getId(), directId, CallType.AUDIO, null);
        callService.cancel(asha.getId(), cancelSession.getCallId());
        assertThat(registry.getActiveCallForUser(ravi.getId())).isEmpty();

        // 3. Decline by callee
        CallSession declineSession = callService.invite(asha.getId(), directId, CallType.VIDEO, null);
        callService.decline(ravi.getId(), declineSession.getCallId());
        assertThat(registry.getActiveCallForUser(asha.getId())).isEmpty();

        // 4. Disconnect grace timeout -> DISCONNECTED (disconnect-grace-seconds=1)
        CallSession graceSession = callService.invite(asha.getId(), directId, CallType.AUDIO, null);
        callService.accept(ravi.getId(), graceSession.getCallId(), "tab-1");
        callService.onUserDisconnected(ravi.getId());
        Thread.sleep(1400);
        assertThat(registry.get(graceSession.getCallId())).isEmpty();
        assertThat(callLogRepository.findTop20ByConversationIdOrderByEndedAtDesc(directId).get(0).getEndReason())
            .isEqualTo(CallEndReason.DISCONNECTED);

        // 5. Blocked user cannot call
        Block block = new Block();
        block.setBlocker(ravi);
        block.setBlocked(asha);
        blockRepository.save(block);
        assertThatThrownBy(() -> callService.invite(asha.getId(), directId, CallType.AUDIO, null))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("blocked");
    }
}
