package com.vanni;

import com.vanni.entity.User;
import com.vanni.repository.RefreshTokenRepository;
import com.vanni.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class AuthIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @BeforeEach
    void setUp() {
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void register_success() throws Exception {
        String json = """
            {
                "name": "Test User",
                "email": "test@vanni.app",
                "password": "Password123"
            }
            """;

        MvcResult result = mockMvc.perform(post("/api/auth/register")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Test User"))
                .andExpect(jsonPath("$.email").value("test@vanni.app"))
                .andReturn();

        MockHttpServletResponse response = result.getResponse();
        Cookie atCookie = response.getCookie("vanni_at");
        Cookie rtCookie = response.getCookie("vanni_rt");

        assertThat(atCookie).isNotNull();
        assertThat(atCookie.isHttpOnly()).isTrue();
        assertThat(atCookie.getPath()).isEqualTo("/");

        assertThat(rtCookie).isNotNull();
        assertThat(rtCookie.isHttpOnly()).isTrue();
        assertThat(rtCookie.getPath()).isEqualTo("/api/auth");

        User user = userRepository.findByEmail("test@vanni.app").orElseThrow();
        assertThat(user.getPasswordHash()).startsWith("$2");
    }

    @Test
    void register_duplicateEmail_returns409() throws Exception {
        userRepository.save(User.builder()
                .name("Existing")
                .email("duplicate@vanni.app")
                .passwordHash(passwordEncoder.encode("Password123"))
                .build());

        String json = """
            {
                "name": "Another User",
                "email": "duplicate@vanni.app",
                "password": "Password123"
            }
            """;

        mockMvc.perform(post("/api/auth/register")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EMAIL_TAKEN"));
    }

    @Test
    void register_weakPassword_returns400() throws Exception {
        String json = """
            {
                "name": "User",
                "email": "weak@vanni.app",
                "password": "simple"
            }
            """;

        mockMvc.perform(post("/api/auth/register")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void login_success() throws Exception {
        userRepository.save(User.builder()
                .name("Login User")
                .email("login@vanni.app")
                .passwordHash(passwordEncoder.encode("Password123"))
                .build());

        String json = """
            {
                "email": "login@vanni.app",
                "password": "Password123"
            }
            """;

        mockMvc.perform(post("/api/auth/login")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("login@vanni.app"))
                .andExpect(cookie().exists("vanni_at"))
                .andExpect(cookie().exists("vanni_rt"));
    }

    @Test
    void login_badCredentials_returns401() throws Exception {
        userRepository.save(User.builder()
                .name("User")
                .email("user@vanni.app")
                .passwordHash(passwordEncoder.encode("Password123"))
                .build());

        String json = """
            {
                "email": "user@vanni.app",
                "password": "WrongPassword999"
            }
            """;

        mockMvc.perform(post("/api/auth/login")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }

    @Test
    void login_unknownEmail_returnsSame401Message() throws Exception {
        String json = """
            {
                "email": "unknown@vanni.app",
                "password": "SomePassword123"
            }
            """;

        mockMvc.perform(post("/api/auth/login")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }

    @Test
    void refresh_rotatesTokens_andReuseRevokesFamily() throws Exception {
        String registerJson = """
            {
                "name": "Refresh User",
                "email": "refresh@vanni.app",
                "password": "Password123"
            }
            """;

        MvcResult regResult = mockMvc.perform(post("/api/auth/register")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(registerJson))
                .andExpect(status().isCreated())
                .andReturn();

        Cookie oldRt = regResult.getResponse().getCookie("vanni_rt");
        assertThat(oldRt).isNotNull();

        // 1. Normal refresh with oldRt -> succeeds and gives newRt
        MvcResult refResult = mockMvc.perform(post("/api/auth/refresh")
                .with(csrf())
                .cookie(oldRt))
                .andExpect(status().isOk())
                .andReturn();

        Cookie newRt = refResult.getResponse().getCookie("vanni_rt");
        assertThat(newRt).isNotNull();
        assertThat(newRt.getValue()).isNotEqualTo(oldRt.getValue());

        // 2. Reuse of oldRt -> triggers reuse detection and revokes family
        mockMvc.perform(post("/api/auth/refresh")
                .with(csrf())
                .cookie(oldRt))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Refresh token reuse detected. All sessions revoked."));

        // 3. NewRt is now also revoked because the whole family was revoked
        mockMvc.perform(post("/api/auth/refresh")
                .with(csrf())
                .cookie(newRt))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void csrf_missingHeader_returns403() throws Exception {
        String json = """
            {
                "name": "No CSRF",
                "email": "nocsrf@vanni.app",
                "password": "Password123"
            }
            """;

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
                .andExpect(status().isForbidden());
    }

    @Test
    void getMe_requiresAuthentication() throws Exception {
        // Without cookie -> 401
        mockMvc.perform(get("/api/users/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        // Register to obtain vanni_at
        String registerJson = """
            {
                "name": "Me User",
                "email": "me@vanni.app",
                "password": "Password123"
            }
            """;

        MvcResult regResult = mockMvc.perform(post("/api/auth/register")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(registerJson))
                .andReturn();

        Cookie atCookie = regResult.getResponse().getCookie("vanni_at");

        // With vanni_at -> 200
        mockMvc.perform(get("/api/users/me").cookie(atCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Me User"))
                .andExpect(jsonPath("$.email").value("me@vanni.app"));
    }
}
