package com.vanni;

import com.vanni.dto.response.AttachmentDto;
import com.vanni.dto.response.ConversationDto;
import com.vanni.dto.response.MessageDto;
import com.vanni.dto.response.ScheduledMessageDto;
import com.vanni.entity.Attachment;
import com.vanni.entity.Block;
import com.vanni.entity.ScheduledMessage;
import com.vanni.entity.ScheduledMessageStatus;
import com.vanni.entity.User;
import com.vanni.repository.AttachmentRepository;
import com.vanni.repository.BlockRepository;
import com.vanni.repository.MessageRepository;
import com.vanni.repository.ScheduledMessageRepository;
import com.vanni.repository.UserRepository;
import com.vanni.security.JwtService;
import com.vanni.service.AttachmentService;
import com.vanni.service.ScheduledMessageService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
    "app.schedule.min-lead-seconds=2",
    "app.schedule.poll-ms=600000"
})
public class ScheduledMessageIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;
    @Autowired private ScheduledMessageRepository scheduledMessageRepository;
    @Autowired private ScheduledMessageService scheduledMessageService;
    @Autowired private AttachmentRepository attachmentRepository;
    @Autowired private AttachmentService attachmentService;
    @Autowired private MessageRepository messageRepository;
    @Autowired private BlockRepository blockRepository;

    private final ObjectMapper objectMapper = JsonMapper.builder().build();

    private User asha;
    private User ravi;
    private User stranger;

    @BeforeEach
    void setup() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        asha = createUser("Asha " + suffix, "asha." + suffix + "@test.app");
        ravi = createUser("Ravi " + suffix, "ravi." + suffix + "@test.app");
        stranger = createUser("Stranger " + suffix, "stranger." + suffix + "@test.app");
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

    @Test
    void createListEditCancelAndOwnershipIsolation() throws Exception {
        Long convId = createDirectConv(asha, ravi);

        // Past / too-soon time rejected
        Instant tooSoon = Instant.now().plusSeconds(1);
        mockMvc.perform(post("/api/conversations/" + convId + "/scheduled")
                .with(csrf())
                .cookie(authCookie(asha))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Soon\",\"scheduledFor\":\"" + tooSoon + "\"}"))
            .andExpect(status().isBadRequest());

        // Non-member rejected with 404 (anti-enumeration via ConversationAccessService)
        Instant validTime = Instant.now().plus(2, ChronoUnit.HOURS);
        mockMvc.perform(post("/api/conversations/" + convId + "/scheduled")
                .with(csrf())
                .cookie(authCookie(stranger))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Intruder\",\"scheduledFor\":\"" + validTime + "\"}"))
            .andExpect(status().isNotFound());

        // Valid create with idempotent clientMessageId
        String clientMsgId = "sched-test-" + UUID.randomUUID();
        MvcResult createRes = mockMvc.perform(post("/api/conversations/" + convId + "/scheduled")
                .with(csrf())
                .cookie(authCookie(asha))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Hello tomorrow\",\"scheduledFor\":\"" + validTime + "\",\"clientMessageId\":\"" + clientMsgId + "\"}"))
            .andExpect(status().isCreated())
            .andReturn();
        ScheduledMessageDto created = objectMapper.readValue(createRes.getResponse().getContentAsString(), ScheduledMessageDto.class);
        assertThat(created.status()).isEqualTo("PENDING");
        assertThat(created.conversationTitle()).isEqualTo(ravi.getName());

        // Replay same clientMessageId -> returns exact same record
        MvcResult replayRes = mockMvc.perform(post("/api/conversations/" + convId + "/scheduled")
                .with(csrf())
                .cookie(authCookie(asha))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Hello tomorrow\",\"scheduledFor\":\"" + validTime + "\",\"clientMessageId\":\"" + clientMsgId + "\"}"))
            .andExpect(status().isCreated())
            .andReturn();
        ScheduledMessageDto replayed = objectMapper.readValue(replayRes.getResponse().getContentAsString(), ScheduledMessageDto.class);
        assertThat(replayed.id()).isEqualTo(created.id());

        // Ravi (peer) cannot list, edit, send-now, or delete Asha's scheduled message
        MvcResult raviList = mockMvc.perform(get("/api/scheduled")
                .cookie(authCookie(ravi)))
            .andExpect(status().is2xxSuccessful())
            .andReturn();
        ScheduledMessageDto[] raviItems = objectMapper.readValue(raviList.getResponse().getContentAsString(), ScheduledMessageDto[].class);
        assertThat(raviItems).isEmpty();

        mockMvc.perform(patch("/api/scheduled/" + created.id())
                .with(csrf())
                .cookie(authCookie(ravi))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Tampered\"}"))
            .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/scheduled/" + created.id() + "/send-now")
                .with(csrf())
                .cookie(authCookie(ravi)))
            .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/scheduled/" + created.id())
                .with(csrf())
                .cookie(authCookie(ravi)))
            .andExpect(status().isForbidden());

        // Asha updates content and time
        Instant updatedTime = Instant.now().plus(4, ChronoUnit.HOURS);
        MvcResult patchRes = mockMvc.perform(patch("/api/scheduled/" + created.id())
                .with(csrf())
                .cookie(authCookie(asha))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Updated text\",\"scheduledFor\":\"" + updatedTime + "\"}"))
            .andExpect(status().is2xxSuccessful())
            .andReturn();
        ScheduledMessageDto updated = objectMapper.readValue(patchRes.getResponse().getContentAsString(), ScheduledMessageDto.class);
        assertThat(updated.content()).isEqualTo("Updated text");

        // Asha cancels it
        mockMvc.perform(delete("/api/scheduled/" + created.id())
                .with(csrf())
                .cookie(authCookie(asha)))
            .andExpect(status().isNoContent());

        ScheduledMessage entity = scheduledMessageRepository.findById(created.id()).orElseThrow();
        assertThat(entity.getStatus()).isEqualTo(ScheduledMessageStatus.CANCELLED);
    }

    @Test
    void sendNowDeliversMessageAndProtectsAttachmentFromOrphanCleanup() throws Exception {
        Long convId = createDirectConv(asha, ravi);

        // Upload a text attachment
        MockMultipartFile file = new MockMultipartFile("file", "notes.txt", "text/plain", "Scheduled notes".getBytes(StandardCharsets.UTF_8));
        MvcResult uploadRes = mockMvc.perform(multipart("/api/attachments")
                .file(file)
                .with(csrf())
                .cookie(authCookie(asha)))
            .andExpect(status().isCreated())
            .andReturn();
        AttachmentDto attDto = objectMapper.readValue(uploadRes.getResponse().getContentAsString(), AttachmentDto.class);

        Instant future = Instant.now().plus(1, ChronoUnit.HOURS);
        MvcResult createRes = mockMvc.perform(post("/api/conversations/" + convId + "/scheduled")
                .with(csrf())
                .cookie(authCookie(asha))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"With attachment\",\"scheduledFor\":\"" + future + "\",\"attachmentIds\":[" + attDto.id() + "]}"))
            .andExpect(status().isCreated())
            .andReturn();
        ScheduledMessageDto created = objectMapper.readValue(createRes.getResponse().getContentAsString(), ScheduledMessageDto.class);

        // Even if created >24h ago, reserved attachment is NOT purged by orphan cleanup
        Attachment attEntity = attachmentRepository.findById(attDto.id()).orElseThrow();
        assertThat(attEntity.getScheduledMessage()).isNotNull();
        List<Attachment> orphans = attachmentRepository.findByMessageIsNullAndScheduledMessageIsNullAndCreatedAtBefore(
            Instant.now().plus(1, ChronoUnit.HOURS)
        );
        assertThat(orphans).extracting(Attachment::getId).doesNotContain(attDto.id());

        // Send now immediately delivers message with attachment
        MvcResult sendNowRes = mockMvc.perform(post("/api/scheduled/" + created.id() + "/send-now")
                .with(csrf())
                .cookie(authCookie(asha)))
            .andExpect(status().is2xxSuccessful())
            .andReturn();
        ScheduledMessageDto sentDto = objectMapper.readValue(sendNowRes.getResponse().getContentAsString(), ScheduledMessageDto.class);
        assertThat(sentDto.status()).isEqualTo("SENT");
        assertThat(sentDto.sentMessageId()).isNotNull();

        MvcResult historyRes = mockMvc.perform(get("/api/conversations/" + convId + "/messages")
                .cookie(authCookie(ravi)))
            .andExpect(status().is2xxSuccessful())
            .andReturn();
        MessageDto[] messages = objectMapper.readValue(historyRes.getResponse().getContentAsString(), MessageDto[].class);
        assertThat(messages).anySatisfy(m -> {
            assertThat(m.id()).isEqualTo(sentDto.sentMessageId());
            assertThat(m.content()).isEqualTo("With attachment");
            assertThat(m.attachments()).hasSize(1);
        });

        // Cannot delete already-sent scheduled message
        mockMvc.perform(delete("/api/scheduled/" + created.id())
                .with(csrf())
                .cookie(authCookie(asha)))
            .andExpect(status().isConflict());
    }

    @Test
    void concurrentSchedulersDeliverDueMessageExactlyOnce() throws Exception {
        Long convId = createDirectConv(asha, ravi);
        Instant future = Instant.now().plus(30, ChronoUnit.MINUTES);
        MvcResult createRes = mockMvc.perform(post("/api/conversations/" + convId + "/scheduled")
                .with(csrf())
                .cookie(authCookie(asha))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Concurrent batch test\",\"scheduledFor\":\"" + future + "\"}"))
            .andExpect(status().isCreated())
            .andReturn();
        ScheduledMessageDto created = objectMapper.readValue(createRes.getResponse().getContentAsString(), ScheduledMessageDto.class);

        // Move scheduled_for into the past so it's due immediately
        ScheduledMessage row = scheduledMessageRepository.findById(created.id()).orElseThrow();
        row.setScheduledFor(Instant.now().minusSeconds(5));
        scheduledMessageRepository.save(row);

        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        Callable<Integer> worker = () -> {
            ready.countDown();
            start.await();
            return scheduledMessageService.processDueMessages();
        };
        Future<Integer> f1 = pool.submit(worker);
        Future<Integer> f2 = pool.submit(worker);
        ready.await();
        start.countDown();
        int c1 = f1.get();
        int c2 = f2.get();
        pool.shutdown();

        assertThat(c1 + c2).isEqualTo(1);
        ScheduledMessage after = scheduledMessageRepository.findById(created.id()).orElseThrow();
        assertThat(after.getStatus()).isEqualTo(ScheduledMessageStatus.SENT);
        assertThat(after.getSentMessage()).isNotNull();
        assertThat(messageRepository.findLatest(convId, org.springframework.data.domain.PageRequest.of(0, 20)))
            .hasSize(1);
    }

    @Test
    void dueMessageWhenBlockedTransitionsToFailed() throws Exception {
        Long convId = createDirectConv(asha, ravi);
        Instant future = Instant.now().plus(30, ChronoUnit.MINUTES);
        MvcResult createRes = mockMvc.perform(post("/api/conversations/" + convId + "/scheduled")
                .with(csrf())
                .cookie(authCookie(asha))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"content\":\"Should fail on block\",\"scheduledFor\":\"" + future + "\"}"))
            .andExpect(status().isCreated())
            .andReturn();
        ScheduledMessageDto created = objectMapper.readValue(createRes.getResponse().getContentAsString(), ScheduledMessageDto.class);

        // Ravi blocks Asha before scheduled_for arrives
        Block block = new Block();
        block.setBlocker(ravi);
        block.setBlocked(asha);
        blockRepository.save(block);

        ScheduledMessage row = scheduledMessageRepository.findById(created.id()).orElseThrow();
        row.setScheduledFor(Instant.now().minusSeconds(5));
        scheduledMessageRepository.save(row);

        scheduledMessageService.processDueMessages();

        ScheduledMessage after = scheduledMessageRepository.findById(created.id()).orElseThrow();
        assertThat(after.getStatus()).isEqualTo(ScheduledMessageStatus.FAILED);
        assertThat(after.getFailureReason()).containsIgnoringCase("blocked");
    }
}
