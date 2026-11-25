package com.vanni;

import com.sun.net.httpserver.HttpServer;
import com.vanni.dto.request.EditMessageRequest;
import com.vanni.dto.request.SendMessageRequest;
import com.vanni.dto.request.UpdateUserRequest;
import com.vanni.dto.response.ConversationDto;
import com.vanni.dto.response.MessageDto;
import com.vanni.entity.User;
import com.vanni.repository.UserRepository;
import com.vanni.security.JwtService;
import com.vanni.service.LinkPreviewService;
import com.vanni.service.MessageService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@TestPropertySource(properties = "app.link-previews.allow-localhost-for-tests=true")
public class LinkPreviewIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;
    @Autowired private LinkPreviewService linkPreviewService;
    @Autowired private MessageService messageService;

    private final ObjectMapper objectMapper = JsonMapper.builder().build();

    private User asha;
    private User ravi;
    private HttpServer mockSite;
    private final AtomicInteger pageFetchCount = new AtomicInteger();

    @BeforeEach
    void setup() throws Exception {
        String s = UUID.randomUUID().toString().substring(0, 8);
        asha = createUser("Asha LP " + s, "asha.lp." + s + "@vanni.app");
        ravi = createUser("Ravi LP " + s, "ravi.lp." + s + "@vanni.app");

        BufferedImage wideImg = new BufferedImage(800, 400, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = wideImg.createGraphics();
        g.setColor(new Color(13, 148, 136));
        g.fillRect(0, 0, 800, 400);
        g.dispose();
        ByteArrayOutputStream imgOut = new ByteArrayOutputStream();
        ImageIO.write(wideImg, "png", imgOut);
        byte[] pngBytes = imgOut.toByteArray();

        mockSite = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        mockSite.createContext("/article", ex -> {
            pageFetchCount.incrementAndGet();
            String html = """
                <html>
                  <head>
                    <meta property="og:site_name" content="Vanni News" />
                    <meta property="og:title" content="Glass UI Launch &amp; Benchmarks" />
                    <meta property="og:description" content="Real-time messaging benchmarks and walkthrough." />
                    <meta property="og:image" content="/banner.png" />
                  </head>
                  <body>Hello</body>
                </html>
                """;
            byte[] b = html.getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().set("Content-Type", "text/html; charset=utf-8");
            ex.sendResponseHeaders(200, b.length);
            try (OutputStream os = ex.getResponseBody()) { os.write(b); }
        });
        mockSite.createContext("/banner.png", ex -> {
            ex.getResponseHeaders().set("Content-Type", "image/png");
            ex.sendResponseHeaders(200, pngBytes.length);
            try (OutputStream os = ex.getResponseBody()) { os.write(pngBytes); }
        });
        mockSite.start();
    }

    @AfterEach
    void tearDown() {
        if (mockSite != null) {
            mockSite.stop(0);
        }
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

    private MessageDto waitForPreviews(Long convId, Long viewerId, Long msgId) throws InterruptedException {
        for (int i = 0; i < 80; i++) {
            MessageDto dto = messageService.getHistory(convId, viewerId, null, null, 20).stream()
                .filter(m -> m.id().equals(msgId))
                .findFirst()
                .orElseThrow();
            if (!dto.previews().isEmpty()) {
                return dto;
            }
            Thread.sleep(50);
        }
        throw new AssertionError("Timed out waiting for async link preview on message " + msgId);
    }

    @Test
    void fetchesCachesResizesPreviewImageAndRespectsUserControls() throws Exception {
        MvcResult convRes = mockMvc.perform(post("/api/conversations/direct")
                .cookie(authCookie(asha)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(java.util.Map.of("userId", ravi.getId()))))
            .andExpect(status().is2xxSuccessful())
            .andReturn();
        ConversationDto conv = objectMapper.readValue(convRes.getResponse().getContentAsString(), ConversationDto.class);

        int port = mockSite.getAddress().getPort();
        String articleUrl = "http://127.0.0.1:" + port + "/article?run=" + UUID.randomUUID();

        // 1. Send message with URL -> returns immediately with empty previews
        SendMessageRequest req1 = new SendMessageRequest("Check this out " + articleUrl, UUID.randomUUID().toString(), null);
        MvcResult msgRes = mockMvc.perform(post("/api/conversations/" + conv.id() + "/messages")
                .cookie(authCookie(asha)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req1)))
            .andExpect(status().isCreated())
            .andReturn();
        MessageDto initialDto = objectMapper.readValue(msgRes.getResponse().getContentAsString(), MessageDto.class);
        assertThat(initialDto.previews()).isEmpty();

        // Wait for @Async link preview worker to populate preview on initialDto
        MessageDto updatedDto = waitForPreviews(conv.id(), ravi.getId(), initialDto.id());

        assertThat(updatedDto.previews()).hasSize(1);
        var preview = updatedDto.previews().get(0);
        assertThat(preview.siteName()).isEqualTo("Vanni News");
        assertThat(preview.title()).isEqualTo("Glass UI Launch & Benchmarks");
        assertThat(preview.imageWidth()).isEqualTo(600);
        assertThat(preview.imageUrl()).isEqualTo("/api/previews/" + preview.id() + "/image");
        assertThat(pageFetchCount.get()).isEqualTo(1);

        // 2. Preview image endpoint requires auth and returns nosniff + resized image
        mockMvc.perform(get(preview.imageUrl())).andExpect(status().isUnauthorized());
        mockMvc.perform(get(preview.imageUrl()).cookie(authCookie(ravi)))
            .andExpect(status().is2xxSuccessful())
            .andExpect(header().string("X-Content-Type-Options", "nosniff"))
            .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "private, max-age=86400"));

        // 3. Second message with exact same URL hits cache (no second HTTP fetch)
        SendMessageRequest req2 = new SendMessageRequest("Again: " + articleUrl, UUID.randomUUID().toString(), null);
        MvcResult msg2Res = mockMvc.perform(post("/api/conversations/" + conv.id() + "/messages")
                .cookie(authCookie(ravi)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req2)))
            .andExpect(status().isCreated())
            .andReturn();
        MessageDto dto2 = objectMapper.readValue(msg2Res.getResponse().getContentAsString(), MessageDto.class);
        waitForPreviews(conv.id(), ravi.getId(), dto2.id());
        assertThat(pageFetchCount.get()).isEqualTo(1);

        // 4. Non-sender cannot delete message previews -> 403; sender succeeds -> 204
        mockMvc.perform(delete("/api/messages/" + initialDto.id() + "/previews")
                .cookie(authCookie(ravi)).with(csrf()))
            .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/messages/" + initialDto.id() + "/previews")
                .cookie(authCookie(asha)).with(csrf()))
            .andExpect(status().isNoContent());

        MessageDto afterRemove = messageService.getHistory(conv.id(), asha.getId(), null, null, 20).stream()
            .filter(m -> m.id().equals(initialDto.id()))
            .findFirst()
            .orElseThrow();
        assertThat(afterRemove.previews()).isEmpty();

        // 5. Blocked private metadata URL yields zero previews
        SendMessageRequest ssrfReq = new SendMessageRequest("http://169.254.169.254/latest/meta-data", UUID.randomUUID().toString(), null);
        MvcResult ssrfRes = mockMvc.perform(post("/api/conversations/" + conv.id() + "/messages")
                .cookie(authCookie(asha)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(ssrfReq)))
            .andExpect(status().isCreated())
            .andReturn();
        MessageDto ssrfDto = objectMapper.readValue(ssrfRes.getResponse().getContentAsString(), MessageDto.class);
        linkPreviewService.processMessageInternal(ssrfDto.id(), asha.getId());
        MessageDto ssrfAfter = messageService.getHistory(conv.id(), asha.getId(), null, null, 20).stream()
            .filter(m -> m.id().equals(ssrfDto.id())).findFirst().orElseThrow();
        assertThat(ssrfAfter.previews()).isEmpty();

        // 6. Editing text of dto2 keeping same URL keeps preview; deleting message clears preview
        mockMvc.perform(patch("/api/messages/" + dto2.id())
                .cookie(authCookie(ravi)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new EditMessageRequest("Edited label " + articleUrl))))
            .andExpect(status().is2xxSuccessful())
            .andExpect(jsonPath("$.previews.length()").value(1));

        mockMvc.perform(delete("/api/messages/" + dto2.id())
                .cookie(authCookie(ravi)).with(csrf()))
            .andExpect(status().isNoContent());
        MessageDto deletedDto = messageService.getHistory(conv.id(), ravi.getId(), null, null, 20).stream()
            .filter(m -> m.id().equals(dto2.id())).findFirst().orElseThrow();
        assertThat(deletedDto.previews()).isEmpty();

        // 7. User linkPreviewsEnabled setting persists
        mockMvc.perform(patch("/api/users/me")
                .cookie(authCookie(asha)).with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new UpdateUserRequest(null, null, null, null, false))))
            .andExpect(status().is2xxSuccessful())
            .andExpect(jsonPath("$.linkPreviewsEnabled").value(false));
    }
}
