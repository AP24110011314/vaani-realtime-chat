package com.vanni;

import com.vanni.dto.request.CreateGroupRequest;
import com.vanni.dto.request.EditMessageRequest;
import com.vanni.dto.request.SendMessageRequest;
import com.vanni.dto.response.AttachmentDto;
import com.vanni.dto.response.ConversationDto;
import com.vanni.dto.response.MessageDto;
import com.vanni.entity.MessageType;
import com.vanni.entity.User;
import com.vanni.repository.UserRepository;
import com.vanni.security.JwtService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
public class VoiceIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;

    private final ObjectMapper objectMapper = JsonMapper.builder().build();

    private User asha;
    private User ravi;
    private User friend;
    private User stranger;

    @BeforeEach
    void setup() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        asha = createUser("Asha Voice " + suffix, "asha.v." + suffix + "@vanni.app");
        ravi = createUser("Ravi Voice " + suffix, "ravi.v." + suffix + "@vanni.app");
        friend = createUser("Friend Voice " + suffix, "friend.v." + suffix + "@vanni.app");
        stranger = createUser("Stranger Voice " + suffix, "str.v." + suffix + "@vanni.app");
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

    private byte[] validWaveformBytes() {
        byte[] b = new byte[64];
        for (int i = 0; i < 64; i++) {
            b[i] = (byte) ((i * 4) & 0xFF);
        }
        return b;
    }

    private byte[] fakeWebmBytes() {
        // EBML header + mock Opus payload (32 bytes)
        byte[] payload = "WEBM_OPUS_AUDIO_TEST_BYTES_12345".getBytes(StandardCharsets.UTF_8);
        byte[] data = new byte[4 + payload.length];
        data[0] = 0x1A;
        data[1] = 0x45;
        data[2] = (byte) 0xDF;
        data[3] = (byte) 0xA3;
        System.arraycopy(payload, 0, data, 4, payload.length);
        return data;
    }

    private byte[] fakeMp4AudioBytes() {
        byte[] data = new byte[24];
        data[4] = 'f';
        data[5] = 't';
        data[6] = 'y';
        data[7] = 'p';
        data[8] = 'M';
        data[9] = '4';
        data[10] = 'A';
        data[11] = ' ';
        return data;
    }

    @Test
    void uploadValidationRejectsSpoofedTooLongTooLargeBadWaveform() throws Exception {
        String wf64 = Base64.getEncoder().encodeToString(validWaveformBytes());
        String wfShort = Base64.getEncoder().encodeToString(new byte[16]);

        // 1. Disguised executable as .webm -> 400
        byte[] mzSpoof = new byte[]{0x4D, 0x5A, 0x00, 0x01, 0x02, 0x03};
        mockMvc.perform(multipart("/api/attachments/voice")
                .file(new MockMultipartFile("file", "voice.webm", "audio/webm", mzSpoof))
                .param("durationMs", "3000")
                .param("waveform", wf64)
                .cookie(authCookie(asha)).with(csrf()))
            .andExpect(status().isBadRequest());

        // 2. HTML disguised as .mp4 -> 400
        mockMvc.perform(multipart("/api/attachments/voice")
                .file(new MockMultipartFile("file", "clip.mp4", "audio/mp4", "<html><script>1</script></html>".getBytes()))
                .param("durationMs", "3000")
                .param("waveform", wf64)
                .cookie(authCookie(asha)).with(csrf()))
            .andExpect(status().isBadRequest());

        // 3. Duration > 5 min (300001 ms) -> 400
        mockMvc.perform(multipart("/api/attachments/voice")
                .file(new MockMultipartFile("file", "note.webm", "audio/webm", fakeWebmBytes()))
                .param("durationMs", "300001")
                .param("waveform", wf64)
                .cookie(authCookie(asha)).with(csrf()))
            .andExpect(status().isBadRequest());

        // 4. Duration <= 0 -> 400
        mockMvc.perform(multipart("/api/attachments/voice")
                .file(new MockMultipartFile("file", "note.webm", "audio/webm", fakeWebmBytes()))
                .param("durationMs", "0")
                .param("waveform", wf64)
                .cookie(authCookie(asha)).with(csrf()))
            .andExpect(status().isBadRequest());

        // 5. Bad waveform length (16 instead of 64) -> 400
        mockMvc.perform(multipart("/api/attachments/voice")
                .file(new MockMultipartFile("file", "note.webm", "audio/webm", fakeWebmBytes()))
                .param("durationMs", "5000")
                .param("waveform", wfShort)
                .cookie(authCookie(asha)).with(csrf()))
            .andExpect(status().isBadRequest());

        // 6. Too large (> 10MB) -> 400
        byte[] over10Mb = new byte[(10 * 1024 * 1024) + 128];
        over10Mb[0] = 0x1A;
        over10Mb[1] = 0x45;
        over10Mb[2] = (byte) 0xDF;
        over10Mb[3] = (byte) 0xA3;
        mockMvc.perform(multipart("/api/attachments/voice")
                .file(new MockMultipartFile("file", "huge.webm", "audio/webm", over10Mb))
                .param("durationMs", "5000")
                .param("waveform", wf64)
                .cookie(authCookie(asha)).with(csrf()))
            .andExpect(status().isBadRequest());
    }

    @Test
    void voiceMessageLifecycleRangeSupportAndAuthorization() throws Exception {
        // Create group with Asha + Ravi + Friend (Stranger is not a member)
        CreateGroupRequest groupReq = new CreateGroupRequest("Voice Room", "", List.of(ravi.getId(), friend.getId()));
        MvcResult convRes = mockMvc.perform(post("/api/conversations/groups")
                .cookie(authCookie(asha)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(groupReq)))
            .andExpect(status().isCreated())
            .andReturn();
        ConversationDto conv = objectMapper.readValue(convRes.getResponse().getContentAsString(), ConversationDto.class);

        byte[] audioBytes = fakeWebmBytes();
        String wf64 = Base64.getEncoder().encodeToString(validWaveformBytes());

        // Upload valid voice note (42s)
        MvcResult upRes = mockMvc.perform(multipart("/api/attachments/voice")
                .file(new MockMultipartFile("file", "voice.webm", "audio/webm", audioBytes))
                .param("durationMs", "42000")
                .param("waveform", wf64)
                .cookie(authCookie(asha)).with(csrf()))
            .andExpect(status().isCreated())
            .andReturn();
        AttachmentDto voiceAtt = objectMapper.readValue(upRes.getResponse().getContentAsString(), AttachmentDto.class);
        assertThat(voiceAtt.mimeType()).isEqualTo("audio/webm");
        assertThat(voiceAtt.durationMs()).isEqualTo(42000);
        assertThat(voiceAtt.waveform()).hasSize(64);
        assertThat(voiceAtt.waveform().get(63)).isEqualTo(63 * 4);

        // Also verify Safari audio/mp4 (ftypM4A) upload succeeds
        mockMvc.perform(multipart("/api/attachments/voice")
                .file(new MockMultipartFile("file", "safari.mp4", "audio/mp4", fakeMp4AudioBytes()))
                .param("durationMs", "2000")
                .param("waveform", wf64)
                .cookie(authCookie(asha)).with(csrf()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.mimeType").value("audio/x-m4a"));

        // Foreign attachment ID rejected (Ravi cannot attach Asha's voice note)
        SendMessageRequest foreignReq = new SendMessageRequest(null, UUID.randomUUID().toString(), null, List.of(voiceAtt.id()), MessageType.VOICE);
        mockMvc.perform(post("/api/conversations/" + conv.id() + "/messages")
                .cookie(authCookie(ravi)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(foreignReq)))
            .andExpect(status().isForbidden());

        // Cannot attach text with VOICE type
        SendMessageRequest textWithVoiceReq = new SendMessageRequest("hello", UUID.randomUUID().toString(), null, List.of(voiceAtt.id()), MessageType.VOICE);
        mockMvc.perform(post("/api/conversations/" + conv.id() + "/messages")
                .cookie(authCookie(asha)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(textWithVoiceReq)))
            .andExpect(status().isBadRequest());

        // Send valid VOICE message
        SendMessageRequest sendReq = new SendMessageRequest(null, UUID.randomUUID().toString(), null, List.of(voiceAtt.id()), MessageType.VOICE);
        MvcResult msgRes = mockMvc.perform(post("/api/conversations/" + conv.id() + "/messages")
                .cookie(authCookie(asha)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(sendReq)))
            .andExpect(status().isCreated())
            .andReturn();
        MessageDto msgDto = objectMapper.readValue(msgRes.getResponse().getContentAsString(), MessageDto.class);
        assertThat(msgDto.type()).isEqualTo(MessageType.VOICE);
        assertThat(msgDto.previewText()).isEqualTo("Voice message 0:42");
        assertThat(msgDto.attachments()).hasSize(1);

        // Cannot edit VOICE message
        mockMvc.perform(patch("/api/messages/" + msgDto.id())
                .cookie(authCookie(asha)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new EditMessageRequest("tamper"))))
            .andExpect(status().isBadRequest());

        // Conversation list shows previewText "Voice message 0:42"
        mockMvc.perform(get("/api/conversations").cookie(authCookie(ravi)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].lastMessage.previewText").value("Voice message 0:42"));

        // Non-member cannot stream -> 404
        mockMvc.perform(get("/api/attachments/" + voiceAtt.id()).cookie(authCookie(stranger)))
            .andExpect(status().isNotFound());

        // Member downloads full audio -> 200 OK with Accept-Ranges & inline & nosniff & private Cache-Control
        mockMvc.perform(get("/api/attachments/" + voiceAtt.id()).cookie(authCookie(ravi)))
            .andExpect(status().isOk())
            .andExpect(header().string(HttpHeaders.ACCEPT_RANGES, "bytes"))
            .andExpect(header().string("X-Content-Type-Options", "nosniff"))
            .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "private, max-age=3600"))
            .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"voice.webm\""))
            .andExpect(content().bytes(audioBytes));

        // Member seeks with HTTP Range -> 206 Partial Content with exact byte slice
        MvcResult rangeRes = mockMvc.perform(get("/api/attachments/" + voiceAtt.id())
                .header(HttpHeaders.RANGE, "bytes=4-11")
                .cookie(authCookie(ravi)))
            .andExpect(status().isPartialContent())
            .andExpect(header().string(HttpHeaders.CONTENT_RANGE, "bytes 4-11/" + audioBytes.length))
            .andExpect(header().string(HttpHeaders.CONTENT_LENGTH, "8"))
            .andReturn();
        assertThat(rangeRes.getResponse().getContentAsByteArray()).isEqualTo("WEBM_OPU".getBytes(StandardCharsets.UTF_8));

        // Out-of-bounds Range -> 416
        mockMvc.perform(get("/api/attachments/" + voiceAtt.id())
                .header(HttpHeaders.RANGE, "bytes=99999-100000")
                .cookie(authCookie(ravi)))
            .andExpect(status().isRequestedRangeNotSatisfiable())
            .andExpect(header().string(HttpHeaders.CONTENT_RANGE, "bytes */" + audioBytes.length));
    }
}
