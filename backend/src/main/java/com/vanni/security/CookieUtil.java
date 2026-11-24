package com.vanni.security;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Optional;

@Component
public class CookieUtil {

    private final boolean secure;

    public CookieUtil(@Value("${cookie.secure:false}") boolean secure) {
        this.secure = secure;
    }

    public void addAccessTokenCookie(HttpServletResponse response, String accessToken) {
        ResponseCookie cookie = ResponseCookie.from("vanni_at", accessToken)
            .httpOnly(true)
            .secure(secure)
            .path("/")
            .maxAge(15 * 60)
            .sameSite("Lax")
            .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    public void addRefreshTokenCookie(HttpServletResponse response, String refreshToken) {
        ResponseCookie cookie = ResponseCookie.from("vanni_rt", refreshToken)
            .httpOnly(true)
            .secure(secure)
            .path("/api/auth")
            .maxAge(7 * 24 * 3600)
            .sameSite("Strict")
            .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    public void clearAuthCookies(HttpServletResponse response) {
        ResponseCookie atCookie = ResponseCookie.from("vanni_at", "")
            .httpOnly(true)
            .secure(secure)
            .path("/")
            .maxAge(0)
            .sameSite("Lax")
            .build();
        ResponseCookie rtCookie = ResponseCookie.from("vanni_rt", "")
            .httpOnly(true)
            .secure(secure)
            .path("/api/auth")
            .maxAge(0)
            .sameSite("Strict")
            .build();
        response.addHeader(HttpHeaders.SET_COOKIE, atCookie.toString());
        response.addHeader(HttpHeaders.SET_COOKIE, rtCookie.toString());
    }

    public Optional<String> getCookieValue(HttpServletRequest request, String name) {
        if (request.getCookies() == null) {
            return Optional.empty();
        }
        return Arrays.stream(request.getCookies())
            .filter(c -> name.equals(c.getName()))
            .map(Cookie::getValue)
            .findFirst();
    }
}
