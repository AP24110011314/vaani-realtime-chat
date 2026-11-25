package com.vanni.unit;

import com.vanni.security.CookieUtil;
import com.vanni.security.JwtService;
import com.vanni.security.RateLimiterService;
import com.vanni.security.RequestIdFilter;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SecurityAndRateLimiterUnitTest {

    @Test
    void jwtService_generateValidateRejectTamperedAndExpired() {
        String secret = "test-secret-that-is-at-least-64-characters-long-for-hmac-sha256-security";
        JwtService jwtService = new JwtService(secret, 15);

        String token = jwtService.generateAccessToken(42L, "asha@vanni.app", "Asha");
        Claims claims = jwtService.parseAndValidate(token);
        assertThat(claims.getSubject()).isEqualTo("42");
        assertThat(claims.get("email", String.class)).isEqualTo("asha@vanni.app");
        assertThat(claims.get("name", String.class)).isEqualTo("Asha");
        assertThat(jwtService.extractUserId(token)).isEqualTo(42L);

        // Tampered token rejected
        String tampered = token.substring(0, token.length() - 3) + "xyz";
        assertThatThrownBy(() -> jwtService.parseAndValidate(tampered)).isInstanceOf(JwtException.class);
        assertThat(jwtService.extractUserId(tampered)).isNull();

        // Expired token rejected
        JwtService expiredJwt = new JwtService(secret, -1);
        String expiredToken = expiredJwt.generateAccessToken(42L, "asha@vanni.app", "Asha");
        assertThatThrownBy(() -> jwtService.parseAndValidate(expiredToken)).isInstanceOf(JwtException.class);
        assertThat(jwtService.extractUserId(expiredToken)).isNull();
    }

    @Test
    void rateLimiter_enforcesAllBucketsAndExponentialLockout() {
        RateLimiterService limiter = new RateLimiterService();

        // Login bucket: 5 allowed, 6th blocked; 5 failures triggers lockout
        String key = "10.0.0.1:test@vanni.app";
        for (int i = 0; i < 5; i++) {
            assertThat(limiter.tryConsumeLogin(key)).isTrue();
            limiter.recordLoginFailure(key);
        }
        assertThat(limiter.tryConsumeLogin(key)).isFalse();
        assertThat(limiter.getLoginRetryAfterSeconds(key)).isGreaterThanOrEqualTo(50L);

        // Successful login resets failures and bucket
        limiter.resetLoginFailures(key);
        assertThat(limiter.tryConsumeLogin(key)).isTrue();

        // Register: 5/hr per IP
        for (int i = 0; i < 5; i++) {
            assertThat(limiter.tryConsumeRegister("10.0.0.2")).isTrue();
        }
        assertThat(limiter.tryConsumeRegister("10.0.0.2")).isFalse();

        // Search: 30/min per user
        for (int i = 0; i < 30; i++) {
            assertThat(limiter.tryConsumeSearch(101L)).isTrue();
        }
        assertThat(limiter.tryConsumeSearch(101L)).isFalse();

        // Message send: 30/10s per user
        for (int i = 0; i < 30; i++) {
            assertThat(limiter.tryConsumeMessageSend(102L)).isTrue();
        }
        assertThat(limiter.tryConsumeMessageSend(102L)).isFalse();

        // Upload: 20/hr per user
        for (int i = 0; i < 20; i++) {
            assertThat(limiter.tryConsumeUpload(103L)).isTrue();
        }
        assertThat(limiter.tryConsumeUpload(103L)).isFalse();
    }

    @Test
    void cookieUtil_setsSecurityFlagsForProdAndDev() {
        CookieUtil prodCookies = new CookieUtil(true);
        MockHttpServletResponse resp = new MockHttpServletResponse();
        prodCookies.addAccessTokenCookie(resp, "at-val");
        prodCookies.addRefreshTokenCookie(resp, "rt-val");

        var headers = resp.getHeaders("Set-Cookie");
        assertThat(headers).hasSize(2);
        assertThat(headers.get(0)).contains("vanni_at=at-val", "HttpOnly", "Secure", "SameSite=Lax", "Path=/");
        assertThat(headers.get(1)).contains("vanni_rt=rt-val", "HttpOnly", "Secure", "SameSite=Strict", "Path=/api/auth");

        MockHttpServletResponse clearResp = new MockHttpServletResponse();
        prodCookies.clearAuthCookies(clearResp);
        assertThat(clearResp.getHeaders("Set-Cookie")).hasSize(2);
        assertThat(clearResp.getHeaders("Set-Cookie").get(0)).contains("Max-Age=0", "Secure");
    }

    @Test
    void requestIdFilter_preservesSafeIdAndRejectsInjection() throws Exception {
        RequestIdFilter filter = new RequestIdFilter();

        // Valid request id preserved and cleaned from MDC
        MockHttpServletRequest req1 = new MockHttpServletRequest();
        req1.addHeader("X-Request-Id", "req-abc_123");
        MockHttpServletResponse resp1 = new MockHttpServletResponse();
        AtomicReference<String> seenMdc = new AtomicReference<>();
        FilterChain chain1 = (r, s) -> seenMdc.set(MDC.get(RequestIdFilter.MDC_KEY));

        filter.doFilter(req1, resp1, chain1);
        assertThat(seenMdc.get()).isEqualTo("req-abc_123");
        assertThat(resp1.getHeader("X-Request-Id")).isEqualTo("req-abc_123");
        assertThat(MDC.get(RequestIdFilter.MDC_KEY)).isNull();

        // Malicious CRLF header replaced with UUID
        MockHttpServletRequest req2 = new MockHttpServletRequest();
        req2.addHeader("X-Request-Id", "bad\r\nFAKE_LOG");
        MockHttpServletResponse resp2 = new MockHttpServletResponse();
        filter.doFilter(req2, resp2, (r, s) -> {});
        assertThat(resp2.getHeader("X-Request-Id")).isNotBlank();
        assertThat(resp2.getHeader("X-Request-Id")).doesNotContain("FAKE_LOG");
    }
}
