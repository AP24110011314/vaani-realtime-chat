package com.vanni.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;

@Service
public class JwtService {

    private final SecretKey key;
    private final Duration accessTtl;

    public JwtService(
        @Value("${jwt.secret:change-me-to-a-64-char-random-string-that-is-at-least-256-bits-long-vanni}") String secret,
        @Value("${jwt.access-ttl-minutes:15}") long accessTtlMinutes
    ) {
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            byte[] padded = new byte[32];
            System.arraycopy(keyBytes, 0, padded, 0, keyBytes.length);
            keyBytes = padded;
        }
        this.key = Keys.hmacShaKeyFor(keyBytes);
        this.accessTtl = Duration.ofMinutes(accessTtlMinutes);
    }

    public String generateAccessToken(Long userId, String email, String name) {
        Instant now = Instant.now();
        Instant expiry = now.plus(accessTtl);

        return Jwts.builder()
            .subject(userId.toString())
            .claim("email", email)
            .claim("name", name)
            .issuedAt(Date.from(now))
            .expiration(Date.from(expiry))
            .signWith(key)
            .compact();
    }

    public Claims parseAndValidate(String token) {
        return Jwts.parser()
            .verifyWith(key)
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }

    public Long extractUserId(String token) {
        try {
            Claims claims = parseAndValidate(token);
            return Long.parseLong(claims.getSubject());
        } catch (JwtException | NumberFormatException e) {
            return null;
        }
    }
}
