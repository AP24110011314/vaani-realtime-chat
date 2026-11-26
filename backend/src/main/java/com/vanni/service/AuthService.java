package com.vanni.service;

import com.vanni.dto.request.ChangePasswordRequest;
import com.vanni.dto.request.LoginRequest;
import com.vanni.dto.request.RegisterRequest;
import com.vanni.dto.response.UserMeResponse;
import com.vanni.entity.RefreshToken;
import com.vanni.entity.User;
import com.vanni.exception.ApiException;
import com.vanni.repository.RefreshTokenRepository;
import com.vanni.repository.UserRepository;
import com.vanni.security.JwtService;
import com.vanni.security.RateLimiterService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;

@Service
@Transactional
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RateLimiterService rateLimiterService;
    private final Duration refreshTtl;
    private final String dummyHash;

    public record AuthResult(UserMeResponse user, String accessToken, String refreshToken) {}

    public AuthService(
        UserRepository userRepository,
        RefreshTokenRepository refreshTokenRepository,
        PasswordEncoder passwordEncoder,
        JwtService jwtService,
        RateLimiterService rateLimiterService,
        @Value("${jwt.refresh-ttl-days:7}") long refreshTtlDays
    ) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.rateLimiterService = rateLimiterService;
        this.refreshTtl = Duration.ofDays(refreshTtlDays);
        this.dummyHash = passwordEncoder.encode("dummy-password-for-constant-time-comparison");
    }

    public AuthResult register(RegisterRequest req, String userAgent, String clientIp) {
        if (!rateLimiterService.tryConsumeRegister(clientIp)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "Too many registration attempts. Please try again later.");
        }

        String email = req.email().trim().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "An account with this email already exists");
        }

        User user = User.builder()
            .name(req.name().trim())
            .email(email)
            .passwordHash(passwordEncoder.encode(req.password()))
            .build();
        user = userRepository.save(user);

        return createSession(user, userAgent);
    }

    public AuthResult login(LoginRequest req, String userAgent, String clientIp) {
        String email = req.email().trim().toLowerCase();
        String rateKey = clientIp + ":" + email;

        if (!rateLimiterService.tryConsumeLogin(rateKey)) {
            long retryAfter = rateLimiterService.getLoginRetryAfterSeconds(rateKey);
            throw new ApiException(
                HttpStatus.TOO_MANY_REQUESTS,
                "RATE_LIMITED",
                "Too many login attempts. Please try again later.",
                java.util.Map.of("retryAfterSeconds", String.valueOf(retryAfter))
            );
        }

        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            passwordEncoder.matches(req.password(), dummyHash);
            rateLimiterService.recordLoginFailure(rateKey);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Invalid email or password");
        }

        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            rateLimiterService.recordLoginFailure(rateKey);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Invalid email or password");
        }

        if (!user.isEnabled()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "ACCOUNT_DISABLED", "Your account has been disabled");
        }

        rateLimiterService.resetLoginFailures(rateKey);
        return createSession(user, userAgent);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public AuthResult refresh(String rawRefreshToken, String userAgent) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Missing refresh token");
        }

        String hash = hashToken(rawRefreshToken);
        RefreshToken token = refreshTokenRepository.findByTokenHash(hash)
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Invalid or expired refresh token"));

        if (token.getExpiresAt().isBefore(Instant.now())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Refresh token expired");
        }

        if (token.getRevokedAt() != null) {
            refreshTokenRepository.revokeFamily(token.getFamilyId(), Instant.now());
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Refresh token reuse detected. All sessions revoked.");
        }

        token.setRevokedAt(Instant.now());
        refreshTokenRepository.save(token);

        User user = token.getUser();
        String newRawRefresh = generateRawToken();
        String newHash = hashToken(newRawRefresh);

        RefreshToken newToken = RefreshToken.builder()
            .user(user)
            .tokenHash(newHash)
            .familyId(token.getFamilyId())
            .expiresAt(Instant.now().plus(refreshTtl))
            .userAgent(userAgent)
            .build();
        refreshTokenRepository.save(newToken);

        String newAccess = jwtService.generateAccessToken(user.getId(), user.getEmail(), user.getName());
        return new AuthResult(toUserMe(user), newAccess, newRawRefresh);
    }

    public void logout(String rawRefreshToken) {
        if (rawRefreshToken != null && !rawRefreshToken.isBlank()) {
            String hash = hashToken(rawRefreshToken);
            refreshTokenRepository.findByTokenHash(hash).ifPresent(rt -> {
                rt.setRevokedAt(Instant.now());
                refreshTokenRepository.save(rt);
            });
        }
    }

    public void logoutAll(Long userId) {
        refreshTokenRepository.deleteAllByUserId(userId);
    }

    public void changePassword(Long userId, ChangePasswordRequest req) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));

        if (!passwordEncoder.matches(req.currentPassword(), user.getPasswordHash())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PASSWORD", "Current password does not match");
        }

        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        userRepository.save(user);
        refreshTokenRepository.deleteAllByUserId(userId);
    }

    @Scheduled(fixedRate = 3600000)
    public void cleanupExpiredTokens() {
        refreshTokenRepository.deleteExpiredOrRevokedOlderThan(Instant.now().minus(Duration.ofDays(7)));
    }

    private AuthResult createSession(User user, String userAgent) {
        String familyId = UUID.randomUUID().toString();
        String rawRefresh = generateRawToken();
        String hash = hashToken(rawRefresh);

        RefreshToken rt = RefreshToken.builder()
            .user(user)
            .tokenHash(hash)
            .familyId(familyId)
            .expiresAt(Instant.now().plus(refreshTtl))
            .userAgent(userAgent)
            .build();
        refreshTokenRepository.save(rt);

        String access = jwtService.generateAccessToken(user.getId(), user.getEmail(), user.getName());
        return new AuthResult(toUserMe(user), access, rawRefresh);
    }

    public static UserMeResponse toUserMe(User user) {
        return new UserMeResponse(
            user.getId(),
            user.getName(),
            user.getEmail(),
            user.getAvatarUrl(),
            user.getAbout(),
            user.isShowLastSeen(),
            user.isShowReadReceipts(),
            user.isLinkPreviewsEnabled(),
            user.isAiEnabled(),
            user.getAiConsentAt(),
            user.isCallsRelayOnly()
        );
    }

    private String generateRawToken() {
        return UUID.randomUUID() + "-" + UUID.randomUUID();
    }

    private String hashToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] encodedhash = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(encodedhash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }
}
