package com.vanni.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RateLimiterService {

    private final Map<String, Bucket> loginBuckets = new ConcurrentHashMap<>();
    private final Map<String, Bucket> registerBuckets = new ConcurrentHashMap<>();
    private final Map<Long, Bucket> uploadBuckets = new ConcurrentHashMap<>();

    // 5 attempts per minute per key (IP + email)
    public boolean tryConsumeLogin(String key) {
        Bucket bucket = loginBuckets.computeIfAbsent(key, k -> Bucket.builder()
            .addLimit(Bandwidth.classic(5, Refill.intervally(5, Duration.ofMinutes(1))))
            .build());
        return bucket.tryConsume(1);
    }

    // 5 attempts per hour per IP
    public boolean tryConsumeRegister(String ip) {
        Bucket bucket = registerBuckets.computeIfAbsent(ip, k -> Bucket.builder()
            .addLimit(Bandwidth.classic(5, Refill.intervally(5, Duration.ofHours(1))))
            .build());
        return bucket.tryConsume(1);
    }

    // 20 uploads per hour per user
    public boolean tryConsumeUpload(Long userId) {
        Bucket bucket = uploadBuckets.computeIfAbsent(userId, k -> Bucket.builder()
            .addLimit(Bandwidth.classic(20, Refill.intervally(20, Duration.ofHours(1))))
            .build());
        return bucket.tryConsume(1);
    }
}
