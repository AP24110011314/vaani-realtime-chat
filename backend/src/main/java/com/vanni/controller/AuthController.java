package com.vanni.controller;

import com.vanni.dto.request.ChangePasswordRequest;
import com.vanni.dto.request.LoginRequest;
import com.vanni.dto.request.RegisterRequest;
import com.vanni.dto.response.UserMeResponse;
import com.vanni.security.CookieUtil;
import com.vanni.security.CurrentUser;
import com.vanni.security.UserPrincipal;
import com.vanni.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final CookieUtil cookieUtil;

    public AuthController(AuthService authService, CookieUtil cookieUtil) {
        this.authService = authService;
        this.cookieUtil = cookieUtil;
    }

    @PostMapping("/register")
    public ResponseEntity<UserMeResponse> register(
            @Valid @RequestBody RegisterRequest req,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        String userAgent = request.getHeader(HttpHeaders.USER_AGENT);
        String clientIp = getClientIp(request);
        AuthService.AuthResult res = authService.register(req, userAgent, clientIp);

        cookieUtil.addAccessTokenCookie(response, res.accessToken());
        cookieUtil.addRefreshTokenCookie(response, res.refreshToken());
        return ResponseEntity.status(HttpStatus.CREATED).body(res.user());
    }

    @PostMapping("/login")
    public ResponseEntity<UserMeResponse> login(
            @Valid @RequestBody LoginRequest req,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        String userAgent = request.getHeader(HttpHeaders.USER_AGENT);
        String clientIp = getClientIp(request);
        AuthService.AuthResult res = authService.login(req, userAgent, clientIp);

        cookieUtil.addAccessTokenCookie(response, res.accessToken());
        cookieUtil.addRefreshTokenCookie(response, res.refreshToken());
        return ResponseEntity.ok(res.user());
    }

    @PostMapping("/refresh")
    public ResponseEntity<UserMeResponse> refresh(
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        String rawRefresh = cookieUtil.getCookieValue(request, "vanni_rt").orElse(null);
        String userAgent = request.getHeader(HttpHeaders.USER_AGENT);
        AuthService.AuthResult res = authService.refresh(rawRefresh, userAgent);

        cookieUtil.addAccessTokenCookie(response, res.accessToken());
        cookieUtil.addRefreshTokenCookie(response, res.refreshToken());
        return ResponseEntity.ok(res.user());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        String rawRefresh = cookieUtil.getCookieValue(request, "vanni_rt").orElse(null);
        authService.logout(rawRefresh);
        cookieUtil.clearAuthCookies(response);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/logout-all")
    public ResponseEntity<Void> logoutAll(
            @CurrentUser UserPrincipal principal,
            HttpServletResponse response
    ) {
        authService.logoutAll(principal.id());
        cookieUtil.clearAuthCookies(response);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/change-password")
    public ResponseEntity<Void> changePassword(
            @CurrentUser UserPrincipal principal,
            @Valid @RequestBody ChangePasswordRequest req,
            HttpServletResponse response
    ) {
        authService.changePassword(principal.id(), req);
        cookieUtil.clearAuthCookies(response);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/csrf")
    public ResponseEntity<Void> csrf() {
        return ResponseEntity.ok().build();
    }

    private String getClientIp(HttpServletRequest request) {
        String xf = request.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) {
            return xf.split(",")[0].trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "unknown";
    }
}
