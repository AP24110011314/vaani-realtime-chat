package com.vanni.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

@Component
@ConfigurationProperties(prefix = "app.calls")
@Getter
@Setter
public class CallProperties {

    private String stunUrls = "stun:stun.l.google.com:19302";
    private String turnUrls = "";
    private String turnSecret = "";
    private long turnTtlSeconds = 3600;
    private long ringTimeoutSeconds = 45;
    private long disconnectGraceSeconds = 10;

    public List<String> parsedStunUrls() {
        return splitUrls(stunUrls);
    }

    public List<String> parsedTurnUrls() {
        return splitUrls(turnUrls);
    }

    private static List<String> splitUrls(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        return Arrays.stream(raw.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .toList();
    }
}
