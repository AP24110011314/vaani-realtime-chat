package com.vanni.service;

public interface AiSummaryService {

    record AiResult(String rawJson, int inputTokens, int outputTokens) {}

    AiResult summarize(String transcript, boolean truncated);
}
