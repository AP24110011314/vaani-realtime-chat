package com.vanni.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@ConditionalOnProperty(name = "app.ai.provider", havingValue = "fake")
public class FakeAiSummaryService implements AiSummaryService {

    private static final Pattern LINE_PATTERN = Pattern.compile("^\\[#(\\d+)]\\s+\\S+\\s+([^:]+):\\s*(.+)$");
    private final ObjectMapper objectMapper;

    public FakeAiSummaryService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public AiResult summarize(String transcript, boolean truncated) {
        List<Long> allIds = new ArrayList<>();
        List<Map<String, Object>> keyPoints = new ArrayList<>();
        List<Map<String, Object>> decisions = new ArrayList<>();
        List<Map<String, Object>> actionItems = new ArrayList<>();
        List<Map<String, Object>> forYou = new ArrayList<>();

        for (String line : transcript.split("\n")) {
            Matcher m = LINE_PATTERN.matcher(line.trim());
            if (!m.matches()) continue;
            Long id = Long.parseLong(m.group(1));
            String sender = m.group(2).trim();
            String body = m.group(3).trim();
            allIds.add(id);

            String lower = body.toLowerCase(Locale.ROOT);
            if ((lower.contains("@you") || lower.contains("for you")) && forYou.size() < 4) {
                forYou.add(Map.of("text", sender + " mentioned you: " + shorten(body), "messageIds", List.of(id)));
            } else if ((lower.contains("decided") || lower.contains("agreed") || lower.contains("ship on")) && decisions.size() < 4) {
                decisions.add(Map.of("text", shorten(body), "messageIds", List.of(id)));
            } else if ((lower.contains("please") || lower.contains("fix") || lower.contains("todo")) && actionItems.size() < 4) {
                actionItems.add(Map.of("who", sender, "what", shorten(body), "messageIds", List.of(id)));
            } else if (keyPoints.size() < 5) {
                keyPoints.add(Map.of("text", sender + ": " + shorten(body), "messageIds", List.of(id)));
            }
        }

        if (keyPoints.isEmpty() && !allIds.isEmpty()) {
            keyPoints.add(Map.of("text", "Recent messages covered active updates.", "messageIds", List.of(allIds.get(0))));
        }

        String overview = "You missed " + allIds.size() + " messages covering recent discussion and updates."
            + (truncated ? " (Oldest messages were omitted to stay within context limits.)" : "");

        Map<String, Object> json = new LinkedHashMap<>();
        json.put("overview", overview);
        json.put("keyPoints", keyPoints);
        json.put("decisions", decisions);
        json.put("actionItems", actionItems);
        json.put("forYou", forYou);

        return new AiResult(objectMapper.writeValueAsString(json), Math.max(50, transcript.length() / 4), 120);
    }

    private static String shorten(String s) {
        return s.length() <= 140 ? s : s.substring(0, 137) + "...";
    }
}
