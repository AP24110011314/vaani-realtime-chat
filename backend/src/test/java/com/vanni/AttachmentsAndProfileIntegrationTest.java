package com.vanni;

import com.vanni.dto.request.SendMessageRequest;
import com.vanni.dto.request.UpdateUserRequest;
import com.vanni.dto.response.AttachmentDto;
import com.vanni.dto.response.ConversationDto;
import com.vanni.dto.response.MessageDto;
import com.vanni.dto.response.UserMeResponse;
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
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
public class AttachmentsAndProfileIntegrationTest {

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
    private byte[] samplePdfBytes;

    @BeforeEach
    void setUp() throws Exception {
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

        // Create sample 10x10 PNG
        BufferedImage img = new BufferedImage(10, 10, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(img, "png", baos);
        samplePngBytes = baos.toByteArray();

        // Create sample PDF
        samplePdfBytes = "%PDF-1.4\n1 0 obj\n<< /Title (Test) >>\nendobj\ntrailer\n<<>>\n%%EOF".getBytes(StandardCharsets.UTF_8);
    }

    @Test
    void uploadAndDownloadImageAndPdf_Success() throws Exception {
        // 1. Upload PNG
        MockMultipartFile pngFile = new MockMultipartFile("file", "photo.png", "image/png", samplePngBytes);
        MvcResult pngResult = mockMvc.perform(multipart("/api/attachments")
                .file(pngFile)
                .cookie(aliceCookie)
                .with(csrf()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.fileName").value("photo.png"))
            .andExpect(jsonPath("$.mimeType").value("image/png"))
            .andExpect(jsonPath("$.width").value(10))
            .andExpect(jsonPath("$.height").value(10))
            .andReturn();

        AttachmentDto pngDto = objectMapper.readValue(pngResult.getResponse().getContentAsString(), AttachmentDto.class);

        // 2. Download PNG as uploader
        mockMvc.perform(get("/api/attachments/" + pngDto.id())
                .cookie(aliceCookie))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Type", "image/png"))
            .andExpect(header().string("X-Content-Type-Options", "nosniff"))
            .andExpect(header().string("Content-Disposition", "inline; filename=\"photo.png\""));

        // 3. Upload PDF
        MockMultipartFile pdfFile = new MockMultipartFile("file", "document.pdf", "application/pdf", samplePdfBytes);
        MvcResult pdfResult = mockMvc.perform(multipart("/api/attachments")
                .file(pdfFile)
                .cookie(aliceCookie)
                .with(csrf()))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.fileName").value("document.pdf"))
            .andExpect(jsonPath("$.mimeType").value("application/pdf"))
            .andReturn();

        AttachmentDto pdfDto = objectMapper.readValue(pdfResult.getResponse().getContentAsString(), AttachmentDto.class);

        // 4. Download PDF
        mockMvc.perform(get("/api/attachments/" + pdfDto.id())
                .cookie(aliceCookie))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Type", "application/pdf"))
            .andExpect(header().string("X-Content-Type-Options", "nosniff"))
            .andExpect(header().string("Content-Disposition", "inline; filename=\"document.pdf\""));
    }

    @Test
    void spoofedExtension_Rejected() throws Exception {
        // Spoofing: .png extension with MZ executable magic bytes
        byte[] exeBytes = new byte[] { 0x4D, 0x5A, 0x00, 0x00, 0x00, 0x00 };
        MockMultipartFile fakePng = new MockMultipartFile("file", "trojan.png", "image/png", exeBytes);

        mockMvc.perform(multipart("/api/attachments")
                .file(fakePng)
                .cookie(aliceCookie)
                .with(csrf()))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("DISALLOWED_FILE_TYPE"));

        // Script in text file
        byte[] scriptBytes = "<script>alert('xss')</script>".getBytes(StandardCharsets.UTF_8);
        MockMultipartFile fakeTxt = new MockMultipartFile("file", "payload.txt", "text/plain", scriptBytes);

        mockMvc.perform(multipart("/api/attachments")
                .file(fakeTxt)
                .cookie(aliceCookie)
                .with(csrf()))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("DISALLOWED_FILE_TYPE"));
    }

    @Test
    void oversizedFile_Rejected() throws Exception {
        // Create 11 MB dummy file
        byte[] largeBytes = new byte[11 * 1024 * 1024];
        MockMultipartFile largeFile = new MockMultipartFile("file", "large.png", "image/png", largeBytes);

        mockMvc.perform(multipart("/api/attachments")
                .file(largeFile)
                .cookie(aliceCookie)
                .with(csrf()))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("FILE_TOO_LARGE"));
    }

    @Test
    void pathTraversalFileName_Sanitized() throws Exception {
        MockMultipartFile traversalFile = new MockMultipartFile("file", "../../../../secret.png", "image/png", samplePngBytes);

        MvcResult result = mockMvc.perform(multipart("/api/attachments")
                .file(traversalFile)
                .cookie(aliceCookie)
                .with(csrf()))
            .andExpect(status().isCreated())
            .andReturn();

        AttachmentDto dto = objectMapper.readValue(result.getResponse().getContentAsString(), AttachmentDto.class);
        assertThat(dto.fileName()).doesNotContain("..").doesNotContain("/").doesNotContain("\\");
        assertThat(dto.fileName()).isEqualTo("secret.png");
    }

    @Test
    void authorization_NonMemberDownload_Returns404() throws Exception {
        // 1. Alice uploads an attachment
        MockMultipartFile pngFile = new MockMultipartFile("file", "chat.png", "image/png", samplePngBytes);
        MvcResult uploadResult = mockMvc.perform(multipart("/api/attachments")
                .file(pngFile)
                .cookie(aliceCookie)
                .with(csrf()))
            .andExpect(status().isCreated())
            .andReturn();
        AttachmentDto attDto = objectMapper.readValue(uploadResult.getResponse().getContentAsString(), AttachmentDto.class);

        // Charlie tries to download Alice's unattached file -> 404
        mockMvc.perform(get("/api/attachments/" + attDto.id())
                .cookie(charlieCookie))
            .andExpect(status().isNotFound());

        // 2. Alice creates conversation with Bob
        ConversationDto conv = conversationService.getOrCreateDirect(alice.getId(), bob.getId());

        // Alice sends message linking the attachment
        SendMessageRequest sendReq = new SendMessageRequest("Here is the picture", null, null, List.of(attDto.id()));
        mockMvc.perform(post("/api/conversations/" + conv.id() + "/messages")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(sendReq))
                .cookie(aliceCookie)
                .with(csrf()))
            .andExpect(status().isCreated());

        // Bob (member) can download
        mockMvc.perform(get("/api/attachments/" + attDto.id())
                .cookie(bobCookie))
            .andExpect(status().isOk());

        // Charlie (non-member) cannot download -> 404
        mockMvc.perform(get("/api/attachments/" + attDto.id())
                .cookie(charlieCookie))
            .andExpect(status().isNotFound());
    }

    @Test
    void foreignAttachmentIdInSend_Rejected() throws Exception {
        // Bob uploads an attachment
        MockMultipartFile pngFile = new MockMultipartFile("file", "bobs.png", "image/png", samplePngBytes);
        MvcResult uploadResult = mockMvc.perform(multipart("/api/attachments")
                .file(pngFile)
                .cookie(bobCookie)
                .with(csrf()))
            .andExpect(status().isCreated())
            .andReturn();
        AttachmentDto attDto = objectMapper.readValue(uploadResult.getResponse().getContentAsString(), AttachmentDto.class);

        ConversationDto conv = conversationService.getOrCreateDirect(alice.getId(), bob.getId());

        // Alice attempts to attach Bob's attachment -> 403 Forbidden
        SendMessageRequest sendReq = new SendMessageRequest("Stealing your file", null, null, List.of(attDto.id()));
        mockMvc.perform(post("/api/conversations/" + conv.id() + "/messages")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(sendReq))
                .cookie(aliceCookie)
                .with(csrf()))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void emptyContentWithAttachment_Allowed() throws Exception {
        MockMultipartFile pngFile = new MockMultipartFile("file", "image_only.png", "image/png", samplePngBytes);
        MvcResult uploadResult = mockMvc.perform(multipart("/api/attachments")
                .file(pngFile)
                .cookie(aliceCookie)
                .with(csrf()))
            .andExpect(status().isCreated())
            .andReturn();
        AttachmentDto attDto = objectMapper.readValue(uploadResult.getResponse().getContentAsString(), AttachmentDto.class);

        ConversationDto conv = conversationService.getOrCreateDirect(alice.getId(), bob.getId());

        // Send empty text with attachment
        SendMessageRequest sendReq = new SendMessageRequest("", null, null, List.of(attDto.id()));
        MvcResult msgResult = mockMvc.perform(post("/api/conversations/" + conv.id() + "/messages")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(sendReq))
                .cookie(aliceCookie)
                .with(csrf()))
            .andExpect(status().isCreated())
            .andReturn();

        MessageDto msgDto = objectMapper.readValue(msgResult.getResponse().getContentAsString(), MessageDto.class);
        assertThat(msgDto.type().name()).isEqualTo("IMAGE");
        assertThat(msgDto.attachments()).hasSize(1);
    }

    @Test
    void avatarUploadAndLiveUpdateInConversation() throws Exception {
        ConversationDto conv = conversationService.getOrCreateDirect(alice.getId(), bob.getId());

        // Alice uploads avatar
        MockMultipartFile avatarFile = new MockMultipartFile("file", "avatar.png", "image/png", samplePngBytes);
        mockMvc.perform(multipart("/api/users/me/avatar")
                .file(avatarFile)
                .cookie(aliceCookie)
                .with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.avatarUrl").isString());

        // Bob inspects the conversation: Alice's avatar should appear in the direct conversation DTO
        MvcResult bobsView = mockMvc.perform(get("/api/conversations/" + conv.id())
                .cookie(bobCookie))
            .andExpect(status().isOk())
            .andReturn();

        ConversationDto updatedConv = objectMapper.readValue(bobsView.getResponse().getContentAsString(), ConversationDto.class);
        assertThat(updatedConv.avatarUrl()).contains("/api/users/" + alice.getId() + "/avatar");

        // Alice deletes avatar
        mockMvc.perform(delete("/api/users/me/avatar")
                .cookie(aliceCookie)
                .with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.avatarUrl").doesNotExist());

        // Bob inspects the conversation again: avatar is null
        MvcResult bobsViewAfterDelete = mockMvc.perform(get("/api/conversations/" + conv.id())
                .cookie(bobCookie))
            .andExpect(status().isOk())
            .andReturn();

        ConversationDto clearedConv = objectMapper.readValue(bobsViewAfterDelete.getResponse().getContentAsString(), ConversationDto.class);
        assertThat(clearedConv.avatarUrl()).isNull();
    }

    @Test
    void updateProfileAbout_Success() throws Exception {
        UpdateUserRequest updateReq = new UpdateUserRequest("Alice Wonder", "Chatting on Vanni", null, null);

        mockMvc.perform(patch("/api/users/me")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updateReq))
                .cookie(aliceCookie)
                .with(csrf()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Alice Wonder"))
            .andExpect(jsonPath("$.about").value("Chatting on Vanni"));
    }
}
