package com.vanni.service;

import com.vanni.config.AiProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

@Service
@ConditionalOnProperty(name = "app.ai.provider", havingValue = "auto")
public class AutoAiSummaryService implements AiSummaryService {

    private static final Logger log = LoggerFactory.getLogger(AutoAiSummaryService.class);

    private final AiProperties props;
    private final GeminiAiSummaryService gemini;
    private final AnthropicAiSummaryService anthropic;
    private final FakeAiSummaryService fake;

    public AutoAiSummaryService(AiProperties props, ObjectMapper objectMapper) {
        this.props = props;
        this.gemini = new GeminiAiSummaryService(props);
        this.anthropic = new AnthropicAiSummaryService(props);
        this.fake = new FakeAiSummaryService(objectMapper);
    }

    @Override
    public AiResult summarize(String transcript, boolean truncated) {
        if (props.getGeminiApiKey() != null && !props.getGeminiApiKey().isBlank()) {
            log.debug("Using Gemini provider for Catch Me Up");
            return gemini.summarize(transcript, truncated);
        }
        if (props.getApiKey() != null && !props.getApiKey().isBlank()) {
            log.debug("Using Anthropic provider for Catch Me Up");
            return anthropic.summarize(transcript, truncated);
        }
        log.debug("No external AI API key set; using local fallback Catch Me Up summarizer");
        return fake.summarize(transcript, truncated);
    }
}
