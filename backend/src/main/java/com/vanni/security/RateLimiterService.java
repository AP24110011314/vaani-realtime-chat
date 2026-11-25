package com.vanni.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RateLimiterService {

    private static final long MAX_LOCKOUT_SECONDS = 900; // 15 minutes

    private static final class LoginAttemptState {
        int consecutiveFailures;
        Instant lockoutUntil;
    }

    private final Map<String, Bucket> loginBuckets = new ConcurrentHashMap<>();
    private final Map<String, LoginAttemptState> loginFailures = new ConcurrentHashMap<>();
    private final Map<String, Bucket> registerBuckets = new ConcurrentHashMap<>();
    private final Map<Long, Bucket> searchBuckets = new ConcurrentHashMap<>();
    private final Map<Long, Bucket> messageSendBuckets = new ConcurrentHashMap<>();
    private final Map<Long, Bucket> uploadBuckets = new ConcurrentHashMap<>();
    private final Map<Long, Bucket> mentionAllBuckets = new ConcurrentHashMap<>();
    private final Map<Long, Bucket> inviteBuckets = new ConcurrentHashMap<>();

    // 5 attempts per minute per key (IP + email), plus exponential lockout after repeated failures
    public boolean tryConsumeLogin(String key) {
        LoginAttemptState state = loginFailures.get(key);
        if (state != null && state.lockoutUntil != null && Instant.now().isBefore(state.lockoutUntil)) {
            return false;
        }
        Bucket bucket = loginBuckets.computeIfAbsent(key, k -> Bucket.builder()
            .addLimit(Bandwidth.builder().capacity(5).refillIntervally(5, Duration.ofMinutes(1)).build())
            .build());
        return bucket.tryConsume(1);
    }

    public void recordLoginFailure(String key) {
        loginFailures.compute(key, (k, existing) -> {
            LoginAttemptState state = existing != null ? existing : new LoginAttemptState();
            state.consecutiveFailures++;
            if (state.consecutiveFailures >= 5) {
                int exponent = Math.min(state.consecutiveFailures - 5, 4);
                long lockoutSeconds = Math.min(60L << exponent, MAX_LOCKOUT_SECONDS);
                state.lockoutUntil = Instant.now().plusSeconds(lockoutSeconds);
            }
            return state;
        });
    }

    public void resetLoginFailures(String key) {
        loginFailures.remove(key);
        loginBuckets.remove(key);
    }

    public long getLoginRetryAfterSeconds(String key) {
        LoginAttemptState state = loginFailures.get(key);
        if (state != null && state.lockoutUntil != null) {
            long remaining = Duration.between(Instant.now(), state.lockoutUntil).getSeconds();
            if (remaining > 0) {
                return remaining;
            }
        }
        return 60L;
    }

    // 5 attempts per hour per IP
    public boolean tryConsumeRegister(String ip) {
        Bucket bucket = registerBuckets.computeIfAbsent(ip, k -> Bucket.builder()
            .addLimit(Bandwidth.builder().capacity(5).refillIntervally(5, Duration.ofHours(1)).build())
            .build());
        return bucket.tryConsume(1);
    }

    // 30 searches per minute per user
    public boolean tryConsumeSearch(Long userId) {
        Bucket bucket = searchBuckets.computeIfAbsent(userId, k -> Bucket.builder()
            .addLimit(Bandwidth.builder().capacity(30).refillIntervally(30, Duration.ofMinutes(1)).build())
            .build());
        return bucket.tryConsume(1);
    }

    // 30 message sends per 10 seconds per user (REST parity with WebSocket)
    public boolean tryConsumeMessageSend(Long userId) {
        Bucket bucket = messageSendBuckets.computeIfAbsent(userId, k -> Bucket.builder()
            .addLimit(Bandwidth.builder().capacity(30).refillIntervally(30, Duration.ofSeconds(10)).build())
            .build());
        return bucket.tryConsume(1);
    }

    // 20 uploads per hour per user
    public boolean tryConsumeUpload(Long userId) {
        Bucket bucket = uploadBuckets.computeIfAbsent(userId, k -> Bucket.builder()
            .addLimit(Bandwidth.builder().capacity(20).refillIntervally(20, Duration.ofHours(1)).build())
            .build());
        return bucket.tryConsume(1);
    }

    // 1 @all mention per 5 minutes per group
    public boolean tryConsumeMentionAll(Long conversationId) {
        Bucket bucket = mentionAllBuckets.computeIfAbsent(conversationId, k -> Bucket.builder()
            .addLimit(Bandwidth.builder().capacity(1).refillIntervally(1, Duration.ofMinutes(5)).build())
            .build());
        return bucket.tryConsume(1);
    }

    // 10 invite preview/join attempts per minute per user
    public boolean tryConsumeInvite(Long userId) {
        Bucket bucket = inviteBuckets.computeIfAbsent(userId, k -> Bucket.builder()
            .addLimit(Bandwidth.builder().capacity(10).refillIntervally(10, Duration.ofMinutes(1)).build())
            .build());
        return bucket.tryConsume(1);
    }
}
