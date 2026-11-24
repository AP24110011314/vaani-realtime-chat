package com.vanni;

import com.vanni.dto.request.CreateGroupRequest;
import com.vanni.dto.request.MarkReadRequest;
import com.vanni.dto.request.SendMessageRequest;
import com.vanni.dto.response.ConversationDto;
import com.vanni.dto.response.MessageDto;
import com.vanni.entity.*;
import com.vanni.repository.*;
import com.vanni.security.JwtService;
import com.vanni.service.ConversationService;
import com.vanni.service.MessageService;
import com.vanni.service.ReceiptService;
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
public class ReceiptsIntegrationTest {

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
    private MessageReceiptRepository messageReceiptRepository;

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
    private ReceiptService receiptService;

    private final ObjectMapper objectMapper = new JsonMapper();

    private User alice;
    private User bob;
    private User charlie;

    private Cookie aliceCookie;
    private Cookie bobCookie;
    private Cookie charlieCookie;

    @BeforeEach
    void setUp() {
        messageReceiptRepository.deleteAll();
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
        alice.setShowReadReceipts(true);
        alice = userRepository.save(alice);

        bob = new User();
        bob.setName("Bob");
        bob.setEmail("bob@vanni.app");
        bob.setPasswordHash(pass);
        bob.setShowReadReceipts(true);
        bob = userRepository.save(bob);

        charlie = new User();
        charlie.setName("Charlie");
        charlie.setEmail("charlie@vanni.app");
        charlie.setPasswordHash(pass);
        charlie.setShowReadReceipts(true);
        charlie = userRepository.save(charlie);

        aliceCookie = new Cookie("vanni_at", jwtService.generateAccessToken(alice.getId(), alice.getEmail(), alice.getName()));
        bobCookie = new Cookie("vanni_at", jwtService.generateAccessToken(bob.getId(), bob.getEmail(), bob.getName()));
        charlieCookie = new Cookie("vanni_at", jwtService.generateAccessToken(charlie.getId(), charlie.getEmail(), charlie.getName()));
    }

    @Test
    void receiptNeverDowngrades_fromReadToDelivered() {
        ConversationDto conv = conversationService.getOrCreateDirect(alice.getId(), bob.getId());
        MessageDto msg = messageService.send(conv.id(), alice.getId(), new SendMessageRequest("Hello Bob", null, null));

        // Bob marks as READ
        receiptService.markRead(bob.getId(), conv.id(), msg.id());

        MessageReceipt r = messageReceiptRepository.findByMessageIdAndUserId(msg.id(), bob.getId()).orElseThrow();
        assertThat(r.getStatus()).isEqualTo(ReceiptStatus.READ);

        // Bob subsequently calls markDelivered
        receiptService.markDelivered(bob.getId(), conv.id(), List.of(msg.id()), null);

        // Must still be READ
        MessageReceipt rAfter = messageReceiptRepository.findByMessageIdAndUserId(msg.id(), bob.getId()).orElseThrow();
        assertThat(rAfter.getStatus()).isEqualTo(ReceiptStatus.READ);
    }

    @Test
    void unreadCountTracking_advancesMonotonically() {
        ConversationDto conv = conversationService.getOrCreateDirect(alice.getId(), bob.getId());

        MessageDto msg1 = messageService.send(conv.id(), alice.getId(), new SendMessageRequest("Msg 1", null, null));
        MessageDto msg2 = messageService.send(conv.id(), alice.getId(), new SendMessageRequest("Msg 2", null, null));
        MessageDto msg3 = messageService.send(conv.id(), alice.getId(), new SendMessageRequest("Msg 3", null, null));

        ConversationMember bobMember = conversationMemberRepository.findByConversationIdAndUserId(conv.id(), bob.getId()).orElseThrow();
        long unreadInitial = messageRepository.countUnread(conv.id(), bobMember.getLastReadMessageId(), bob.getId());
        assertThat(unreadInitial).isEqualTo(3);

        // Bob reads up to msg2
        receiptService.markRead(bob.getId(), conv.id(), msg2.id());

        bobMember = conversationMemberRepository.findByConversationIdAndUserId(conv.id(), bob.getId()).orElseThrow();
        assertThat(bobMember.getLastReadMessageId()).isEqualTo(msg2.id());
        long unreadAfterMsg2 = messageRepository.countUnread(conv.id(), bobMember.getLastReadMessageId(), bob.getId());
        assertThat(unreadAfterMsg2).isEqualTo(1);

        // Bob reads up to msg3
        receiptService.markRead(bob.getId(), conv.id(), msg3.id());

        bobMember = conversationMemberRepository.findByConversationIdAndUserId(conv.id(), bob.getId()).orElseThrow();
        assertThat(bobMember.getLastReadMessageId()).isEqualTo(msg3.id());
        long unreadAfterMsg3 = messageRepository.countUnread(conv.id(), bobMember.getLastReadMessageId(), bob.getId());
        assertThat(unreadAfterMsg3).isEqualTo(0);
    }

    @Test
    void groupReceiptAggregation_deliveredWhenAllDelivered_readWhenAllRead() {
        ConversationDto group = conversationService.createGroup(
            alice.getId(),
            new CreateGroupRequest("Vanni Devs", "Team group", List.of(bob.getId(), charlie.getId()))
        );

        MessageDto msg = messageService.send(group.id(), alice.getId(), new SendMessageRequest("Team update", null, null));

        // Initial status: SENT
        MessageDto fetched1 = messageService.getHistory(group.id(), alice.getId(), null, null, 10).getFirst();
        assertThat(fetched1.status()).isEqualTo("SENT");

        // Bob marks delivered
        receiptService.markDelivered(bob.getId(), group.id(), List.of(msg.id()), null);
        MessageDto fetched2 = messageService.getHistory(group.id(), alice.getId(), null, null, 10).getFirst();
        assertThat(fetched2.status()).isEqualTo("SENT"); // Charlie hasn't received yet

        // Charlie marks delivered
        receiptService.markDelivered(charlie.getId(), group.id(), List.of(msg.id()), null);
        MessageDto fetched3 = messageService.getHistory(group.id(), alice.getId(), null, null, 10).getFirst();
        assertThat(fetched3.status()).isEqualTo("DELIVERED");

        // Bob marks read
        receiptService.markRead(bob.getId(), group.id(), msg.id());
        MessageDto fetched4 = messageService.getHistory(group.id(), alice.getId(), null, null, 10).getFirst();
        assertThat(fetched4.status()).isEqualTo("DELIVERED"); // Charlie only delivered

        // Charlie marks read
        receiptService.markRead(charlie.getId(), group.id(), msg.id());
        MessageDto fetched5 = messageService.getHistory(group.id(), alice.getId(), null, null, 10).getFirst();
        assertThat(fetched5.status()).isEqualTo("READ");
    }

    @Test
    void privacyFlagHidesReadReceipts_senderSeesDeliveredOnly() {
        // Bob turns off read receipts
        bob.setShowReadReceipts(false);
        userRepository.save(bob);

        ConversationDto conv = conversationService.getOrCreateDirect(alice.getId(), bob.getId());
        MessageDto msg = messageService.send(conv.id(), alice.getId(), new SendMessageRequest("Secret message", null, null));

        // Bob reads it
        receiptService.markRead(bob.getId(), conv.id(), msg.id());

        // Alice views message: should only see DELIVERED, not READ
        MessageDto aliceView = messageService.getHistory(conv.id(), alice.getId(), null, null, 10).getFirst();
        assertThat(aliceView.status()).isEqualTo("DELIVERED");

        // Bob's unread count must still be 0
        ConversationMember bobMember = conversationMemberRepository.findByConversationIdAndUserId(conv.id(), bob.getId()).orElseThrow();
        long bobUnread = messageRepository.countUnread(conv.id(), bobMember.getLastReadMessageId(), bob.getId());
        assertThat(bobUnread).isEqualTo(0);

        // Receipts detail endpoint masks to DELIVERED
        var receipts = receiptService.getReceiptsForMessage(msg.id(), alice.getId());
        assertThat(receipts).hasSize(1);
        assertThat(receipts.getFirst().status()).isEqualTo("DELIVERED");
    }

    @Test
    void reconnectDeliversPendingMessages() {
        ConversationDto conv = conversationService.getOrCreateDirect(alice.getId(), bob.getId());
        MessageDto msg = messageService.send(conv.id(), alice.getId(), new SendMessageRequest("Offline message", null, null));

        // Bob is offline (no receipt yet)
        assertThat(messageReceiptRepository.findByMessageIdAndUserId(msg.id(), bob.getId())).isEmpty();

        // Bob connects
        receiptService.markPendingDeliveredForUser(bob.getId());

        // Receipt should now exist with DELIVERED
        MessageReceipt r = messageReceiptRepository.findByMessageIdAndUserId(msg.id(), bob.getId()).orElseThrow();
        assertThat(r.getStatus()).isEqualTo(ReceiptStatus.DELIVERED);

        MessageDto aliceView = messageService.getHistory(conv.id(), alice.getId(), null, null, 10).getFirst();
        assertThat(aliceView.status()).isEqualTo("DELIVERED");
    }

    @Test
    void restEndpoints_markReadAndGetReceipts() throws Exception {
        ConversationDto conv = conversationService.getOrCreateDirect(alice.getId(), bob.getId());
        MessageDto msg = messageService.send(conv.id(), alice.getId(), new SendMessageRequest("Test REST read", null, null));

        // Bob calls POST /api/conversations/{id}/read
        mockMvc.perform(post("/api/conversations/" + conv.id() + "/read")
                .with(csrf())
                .cookie(bobCookie)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new MarkReadRequest(msg.id(), null))))
            .andExpect(status().isNoContent());

        // Alice calls GET /api/messages/{id}/receipts -> 200
        mockMvc.perform(get("/api/messages/" + msg.id() + "/receipts")
                .cookie(aliceCookie))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].userId").value(bob.getId()))
            .andExpect(jsonPath("$[0].status").value("READ"));

        // Bob calling GET /api/messages/{id}/receipts -> 403 Forbidden (Bob is recipient, not sender)
        mockMvc.perform(get("/api/messages/" + msg.id() + "/receipts")
                .cookie(bobCookie))
            .andExpect(status().isForbidden());
    }
}
