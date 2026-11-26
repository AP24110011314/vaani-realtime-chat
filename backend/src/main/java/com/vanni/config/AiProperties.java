package com.vanni.config;

import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.ai")
@Getter
@Setter
public class AiProperties {

    private boolean featuresEnabled = false;
    private String provider = "gemini";
    private String apiKey = "";
    private String model = "claude-haiku-4-5";
    private String geminiApiKey = "";
    private String geminiModel = "gemini-flash-latest";
    private String geminiBaseUrl = "https://generativelanguage.googleapis.com";
    private int maxInputChars = 60000;
    private int timeoutSeconds = 30;
    private int ratePerHour = 10;
    private int ratePerDay = 30;

    @PostConstruct
    public void validate() {
        if (!featuresEnabled) return;
        if ("anthropic".equalsIgnoreCase(provider) && (apiKey == null || apiKey.isBlank())) {
            throw new IllegalStateException("ANTHROPIC_API_KEY must be set when AI_FEATURES_ENABLED=true and AI_PROVIDER=anthropic");
        }
        if ("gemini".equalsIgnoreCase(provider) && (geminiApiKey == null || geminiApiKey.isBlank())) {
            throw new IllegalStateException("GEMINI_API_KEY must be set when AI_FEATURES_ENABLED=true and AI_PROVIDER=gemini");
        }
    }
}
