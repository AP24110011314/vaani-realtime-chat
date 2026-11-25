package com.vanni;

import com.vanni.dto.request.CreateDirectConversationRequest;
import com.vanni.dto.request.ConversationSettingsRequest;
import com.vanni.dto.request.CreateGroupRequest;
import com.vanni.dto.request.EditMessageRequest;
import com.vanni.dto.request.ReactionRequest;
import com.vanni.dto.request.SendMessageRequest;
import com.vanni.dto.request.UpdateGroupRequest;
import com.vanni.dto.response.ConversationDto;
import com.vanni.dto.response.MessageDto;
import com.vanni.entity.Conversation;
import com.vanni.entity.ConversationMember;
import com.vanni.entity.ConversationType;
import com.vanni.entity.MemberRole;
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
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
public class EnhancementsIntegrationTest {

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

    private final ObjectMapper objectMapper = new JsonMapper();

    private User alice;
    private User bob;
    private User charlie;

    private Cookie aliceCookie;
    private Cookie bobCookie;
    private Cookie charlieCookie;

    private byte[] samplePngBytes;

    @BeforeEach
    void setUp() throws Exception {
        reactionRepository.deleteAll();
        blockRepository.deleteAll();
        attachmentRepository.deleteAll();
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
        alice = userRepository.save(alice);

        bob = new User();
        bob.setName("Bob");
        bob.setEmail("bob@vanni.app");
        bob.setPasswordHash(pass);
        bob = userRepository.save(bob);

        charlie = new User();
        charlie.setName("Charlie");
        charlie.setEmail("charlie@vanni.app");
        charlie.setPasswordHash(pass);
        charlie = userRepository.save(charlie);

        aliceCookie = new Cookie("vanni_at", jwtService.generateAccessToken(alice.getId(), alice.getEmail(), alice.getName()));
        bobCookie = new Cookie("vanni_at", jwtService.generateAccessToken(bob.getId(), bob.getEmail(), bob.getName()));
        charlieCookie = new Cookie("vanni_at", jwtService.generateAccessToken(charlie.getId(), charlie.getEmail(), charlie.getName()));

        BufferedImage img = new BufferedImage(10, 10, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(img, "png", baos);
        samplePngBytes = baos.toByteArray();
    }

    @Test
    void testMessageEditAndValidation() throws Exception {
        ConversationDto conv = conversationService.getOrCreateDirect(alice.getId(), bob.getId());
        MessageDto sent = messageService.send(conv.id(), alice.getId(), new SendMessageRequest("Original content", null, null, null));

        // Alice edits her message
        MvcResult editRes = mockMvc.perform(patch("/api/messages/" + sent.id())
                .cookie(aliceCookie)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new EditMessageRequest("Edited content"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("Edited content"))
                .andExpect(jsonPath("$.editedAt").isNotEmpty())
                .andReturn();

        // Bob tries to edit Alice's message -> 403
        mockMvc.perform(patch("/api/messages/" + sent.id())
                .cookie(bobCookie)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new EditMessageRequest("Hacked content"))))
                .andExpect(status().isForbidden());

        // Blank content -> 400
        mockMvc.perform(patch("/api/messages/" + sent.id())
                .cookie(aliceCookie)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new EditMessageRequest("   "))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void testMessageSoftDeleteAndGroupAdmin() throws Exception {
        ConversationDto conv = conversationService.createGroup(alice.getId(), new CreateGroupRequest("Test Group", "Desc", List.of(bob.getId(), charlie.getId())));
        // Bob sends a message in the group
        MessageDto sent = messageService.send(conv.id(), bob.getId(), new SendMessageRequest("Bob message", null, null, null));

        // Alice (group admin) deletes Bob's message
        mockMvc.perform(delete("/api/messages/" + sent.id())
                .cookie(aliceCookie)
                .with(csrf()))
                .andExpect(status().isNoContent());

        // Check history -> message is deleted, content is null
        MvcResult histRes = mockMvc.perform(get("/api/conversations/" + conv.id() + "/messages")
                .cookie(bobCookie))
                .andExpect(status().isOk())
                .andReturn();

        MessageDto[] msgs = objectMapper.readValue(histRes.getResponse().getContentAsString(), MessageDto[].class);
        MessageDto deletedMsg = java.util.Arrays.stream(msgs).filter(m -> m.id().equals(sent.id())).findFirst().orElseThrow();
        assertThat(deletedMsg.deleted()).isTrue();
        assertThat(deletedMsg.content()).isNull();

        // Attempting to edit a deleted message returns 400
        mockMvc.perform(patch("/api/messages/" + sent.id())
                .cookie(bobCookie)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new EditMessageRequest("Revived"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void testReplyValidation() throws Exception {
        ConversationDto conv1 = conversationService.getOrCreateDirect(alice.getId(), bob.getId());
        ConversationDto conv2 = conversationService.getOrCreateDirect(alice.getId(), charlie.getId());

        MessageDto m1 = messageService.send(conv1.id(), alice.getId(), new SendMessageRequest("Msg 1 in Conv 1", null, null, null));

        // Replying in conv2 to a message in conv1 should fail with 400
        mockMvc.perform(post("/api/conversations/" + conv2.id() + "/messages")
                .cookie(aliceCookie)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new SendMessageRequest("Reply across conv", null, m1.id(), null))))
                .andExpect(status().isBadRequest());

        // Replying in conv1 to m1 should succeed and include reply snippet
        mockMvc.perform(post("/api/conversations/" + conv1.id() + "/messages")
                .cookie(bobCookie)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new SendMessageRequest("Reply in same conv", null, m1.id(), null))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.replyTo.id").value(m1.id()))
                .andExpect(jsonPath("$.replyTo.senderName").value("Alice"))
                .andExpect(jsonPath("$.replyTo.snippet").value("Msg 1 in Conv 1"));
    }

    @Test
    void testReactionsToggle() throws Exception {
        ConversationDto conv = conversationService.getOrCreateDirect(alice.getId(), bob.getId());
        MessageDto sent = messageService.send(conv.id(), alice.getId(), new SendMessageRequest("React to me", null, null, null));

        // Alice reacts with 👍
        mockMvc.perform(put("/api/messages/" + sent.id() + "/reactions")
                .cookie(aliceCookie)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ReactionRequest("👍"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reactions[0].emoji").value("👍"))
                .andExpect(jsonPath("$.reactions[0].count").value(1))
                .andExpect(jsonPath("$.reactions[0].reactedByMe").value(true));

        // Bob reacts with 👍 as well
        mockMvc.perform(put("/api/messages/" + sent.id() + "/reactions")
                .cookie(bobCookie)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ReactionRequest("👍"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reactions[0].count").value(2))
                .andExpect(jsonPath("$.reactions[0].reactedByMe").value(true));

        // Alice toggles 👍 off
        mockMvc.perform(put("/api/messages/" + sent.id() + "/reactions")
                .cookie(aliceCookie)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ReactionRequest("👍"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reactions[0].count").value(1))
                .andExpect(jsonPath("$.reactions[0].reactedByMe").value(false));
    }

    @Test
    void testConversationSettingsAndOrdering() throws Exception {
        ConversationDto conv1 = conversationService.getOrCreateDirect(alice.getId(), bob.getId());
        ConversationDto conv2 = conversationService.getOrCreateDirect(alice.getId(), charlie.getId());

        // Alice pins conv1
        mockMvc.perform(patch("/api/conversations/" + conv1.id() + "/settings")
                .cookie(aliceCookie)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ConversationSettingsRequest(false, false, true))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pinned").value(true));

        // Alice lists conversations -> conv1 is first because it's pinned
        MvcResult listRes = mockMvc.perform(get("/api/conversations")
                .cookie(aliceCookie))
                .andExpect(status().isOk())
                .andReturn();

        ConversationDto[] list = objectMapper.readValue(listRes.getResponse().getContentAsString(), ConversationDto[].class);
        assertThat(list).hasSize(2);
        assertThat(list[0].id()).isEqualTo(conv1.id());
        assertThat(list[0].pinned()).isTrue();

        // Alice archives conv1
        mockMvc.perform(patch("/api/conversations/" + conv1.id() + "/settings")
                .cookie(aliceCookie)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new ConversationSettingsRequest(false, true, true))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.archived").value(true));

        // Default list excludes archived conv1
        MvcResult unarchivedRes = mockMvc.perform(get("/api/conversations")
                .cookie(aliceCookie))
                .andExpect(status().isOk())
                .andReturn();
        ConversationDto[] unarchivedList = objectMapper.readValue(unarchivedRes.getResponse().getContentAsString(), ConversationDto[].class);
        assertThat(unarchivedList).hasSize(1);
        assertThat(unarchivedList[0].id()).isEqualTo(conv2.id());

        // Archived filter returns conv1
        MvcResult archivedRes = mockMvc.perform(get("/api/conversations?archived=true")
                .cookie(aliceCookie))
                .andExpect(status().isOk())
                .andReturn();
        ConversationDto[] archivedList = objectMapper.readValue(archivedRes.getResponse().getContentAsString(), ConversationDto[].class);
        assertThat(archivedList).hasSize(1);
        assertThat(archivedList[0].id()).isEqualTo(conv1.id());
    }

    @Test
    void testMessageSearch() throws Exception {
        ConversationDto conv1 = conversationService.getOrCreateDirect(alice.getId(), bob.getId());
        ConversationDto conv2 = conversationService.getOrCreateDirect(bob.getId(), charlie.getId());

        messageService.send(conv1.id(), alice.getId(), new SendMessageRequest("Secret project launch", null, null, null));
        messageService.send(conv2.id(), bob.getId(), new SendMessageRequest("Secret party plans", null, null, null));

        // Alice searches across conversations for "Secret"
        // Should only find the message in conv1, NOT conv2
        mockMvc.perform(get("/api/search/messages?q=secret")
                .cookie(aliceCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].content").value("Secret project launch"))
                .andExpect(jsonPath("$[0].conversationId").value(conv1.id()));

        // Search scoped to conv1
        mockMvc.perform(get("/api/search/messages?q=secret&conversationId=" + conv1.id())
                .cookie(aliceCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        // Alice searching in conv2 (not a member) -> 404
        mockMvc.perform(get("/api/search/messages?q=secret&conversationId=" + conv2.id())
                .cookie(aliceCookie))
                .andExpect(status().isNotFound());
    }

    @Test
    void testBlockAndUnblockEnforcement() throws Exception {
        ConversationDto conv = conversationService.getOrCreateDirect(alice.getId(), bob.getId());

        // Alice blocks Bob
        mockMvc.perform(post("/api/users/" + bob.getId() + "/block")
                .cookie(aliceCookie)
                .with(csrf()))
                .andExpect(status().isNoContent());

        // Alice verifies blocked list
        mockMvc.perform(get("/api/users/blocked")
                .cookie(aliceCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(bob.getId()));

        // Bob tries to getOrCreateDirect with Alice -> 403 USER_BLOCKED
        mockMvc.perform(post("/api/conversations/direct")
                .cookie(bobCookie)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreateDirectConversationRequest(alice.getId()))))
                .andExpect(status().isForbidden());

        // Bob tries to send message in existing direct conversation -> 403 USER_BLOCKED
        mockMvc.perform(post("/api/conversations/" + conv.id() + "/messages")
                .cookie(bobCookie)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new SendMessageRequest("Hello Alice", null, null, null))))
                .andExpect(status().isForbidden());

        // Alice searches users for "Bob" -> Bob is filtered out
        mockMvc.perform(get("/api/users?query=Bob")
                .cookie(aliceCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        // Alice unblocks Bob
        mockMvc.perform(delete("/api/users/" + bob.getId() + "/block")
                .cookie(aliceCookie)
                .with(csrf()))
                .andExpect(status().isNoContent());

        // Now Bob can message Alice again
        mockMvc.perform(post("/api/conversations/" + conv.id() + "/messages")
                .cookie(bobCookie)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new SendMessageRequest("Unblocked now!", null, null, null))))
                .andExpect(status().isCreated());
    }

    @Test
    void testGroupAvatarAndDescription() throws Exception {
        ConversationDto conv = conversationService.createGroup(alice.getId(), new CreateGroupRequest("Tech Group", "Initial desc", List.of(bob.getId(), charlie.getId())));

        // Alice updates description
        mockMvc.perform(patch("/api/conversations/" + conv.id())
                .cookie(aliceCookie)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new UpdateGroupRequest(null, "Updated topic"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("Updated topic"));

        // Alice (admin) uploads group avatar
        MockMultipartFile avatarFile = new MockMultipartFile("file", "avatar.png", "image/png", samplePngBytes);
        mockMvc.perform(multipart("/api/conversations/" + conv.id() + "/avatar")
                .file(avatarFile)
                .cookie(aliceCookie)
                .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarUrl").isNotEmpty());

        // Bob (non-admin) tries to upload group avatar -> 403
        mockMvc.perform(multipart("/api/conversations/" + conv.id() + "/avatar")
                .file(avatarFile)
                .cookie(bobCookie)
                .with(csrf()))
                .andExpect(status().isForbidden());

        // Anyone in the group can fetch the avatar
        mockMvc.perform(get("/api/conversations/" + conv.id() + "/avatar")
                .cookie(bobCookie))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG));
    }
}
