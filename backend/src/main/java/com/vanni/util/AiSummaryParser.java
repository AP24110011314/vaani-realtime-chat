package com.vanni.util;

import com.vanni.dto.response.CatchUpSummaryDto;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.util.*;

public final class AiSummaryParser {

    private static final int MAX_ITEMS_PER_SECTION = 8;
    private static final int MAX_OVERVIEW_CHARS = 1200;
    private static final int MAX_ITEM_TEXT_CHARS = 400;
    private static final int MAX_WHO_CHARS = 80;

    public static class InvalidSummaryResponseException extends RuntimeException {
        public InvalidSummaryResponseException(String message, Throwable cause) {
            super(message, cause);
        }

        public InvalidSummaryResponseException(String message) {
            super(message);
        }
    }

    private AiSummaryParser() {}

    public static CatchUpSummaryDto parseAndSanitize(
            String rawText,
            Set<Long> validMessageIds,
            ObjectMapper objectMapper) {
        if (rawText == null || rawText.isBlank()) {
            throw new InvalidSummaryResponseException("Empty AI response");
        }

        String json = extractJsonObject(rawText);
        Map<String, Object> root;
        try {
            root = objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception ex) {
            throw new InvalidSummaryResponseException("AI response is not valid JSON", ex);
        }

        if (root == null || !(root.get("overview") instanceof String overviewRaw) || overviewRaw.isBlank()) {
            throw new InvalidSummaryResponseException("AI response missing required overview field");
        }

        String overview = clamp(overviewRaw.trim(), MAX_OVERVIEW_CHARS);
        List<CatchUpSummaryDto.SummaryPoint> keyPoints = parsePoints(root.get("keyPoints"), validMessageIds);
        List<CatchUpSummaryDto.SummaryPoint> decisions = parsePoints(root.get("decisions"), validMessageIds);
        List<CatchUpSummaryDto.ActionItem> actionItems = parseActionItems(root.get("actionItems"), validMessageIds);
        List<CatchUpSummaryDto.SummaryPoint> forYou = parsePoints(root.get("forYou"), validMessageIds);

        return new CatchUpSummaryDto(overview, keyPoints, decisions, actionItems, forYou);
    }

    private static String extractJsonObject(String raw) {
        String s = raw.trim();
        if (s.startsWith("```")) {
            int firstNewline = s.indexOf('\n');
            if (firstNewline > 0) {
                s = s.substring(firstNewline + 1);
            }
            int lastFence = s.lastIndexOf("```");
            if (lastFence >= 0) {
                s = s.substring(0, lastFence);
            }
            s = s.trim();
        }
        int start = s.indexOf('{');
        int end = s.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw new InvalidSummaryResponseException("No JSON object found in AI response");
        }
        return s.substring(start, end + 1);
    }

    @SuppressWarnings("unchecked")
    private static List<CatchUpSummaryDto.SummaryPoint> parsePoints(Object raw, Set<Long> validMessageIds) {
        if (!(raw instanceof List<?> list)) {
            return List.of();
        }
        List<CatchUpSummaryDto.SummaryPoint> out = new ArrayList<>();
        for (Object item : list) {
            if (out.size() >= MAX_ITEMS_PER_SECTION) break;
            if (item instanceof Map<?, ?> map) {
                Object textObj = map.get("text");
                if (textObj instanceof String text && !text.isBlank()) {
                    List<Long> ids = filterMessageIds(map.get("messageIds"), validMessageIds);
                    out.add(new CatchUpSummaryDto.SummaryPoint(clamp(text.trim(), MAX_ITEM_TEXT_CHARS), ids));
                }
            }
        }
        return out;
    }

    private static List<CatchUpSummaryDto.ActionItem> parseActionItems(Object raw, Set<Long> validMessageIds) {
        if (!(raw instanceof List<?> list)) {
            return List.of();
        }
        List<CatchUpSummaryDto.ActionItem> out = new ArrayList<>();
        for (Object item : list) {
            if (out.size() >= MAX_ITEMS_PER_SECTION) break;
            if (item instanceof Map<?, ?> map) {
                Object whatObj = map.get("what");
                if (whatObj instanceof String what && !what.isBlank()) {
                    String who = map.get("who") instanceof String w && !w.isBlank()
                        ? clamp(w.trim(), MAX_WHO_CHARS)
                        : "Team";
                    List<Long> ids = filterMessageIds(map.get("messageIds"), validMessageIds);
                    out.add(new CatchUpSummaryDto.ActionItem(who, clamp(what.trim(), MAX_ITEM_TEXT_CHARS), ids));
                }
            }
        }
        return out;
    }

    private static List<Long> filterMessageIds(Object rawIds, Set<Long> validMessageIds) {
        if (!(rawIds instanceof List<?> list) || validMessageIds == null || validMessageIds.isEmpty()) {
            return List.of();
        }
        List<Long> filtered = new ArrayList<>();
        for (Object val : list) {
            if (filtered.size() >= 6) break;
            Long id = null;
            if (val instanceof Number n) {
                id = n.longValue();
            } else if (val instanceof String s) {
                try {
                    id = Long.parseLong(s.trim());
                } catch (NumberFormatException ignored) {
                    // Drop unparseable citation ID
                }
            }
            if (id != null && validMessageIds.contains(id) && !filtered.contains(id)) {
                filtered.add(id);
            }
        }
        return filtered;
    }

    private static String clamp(String text, int maxLen) {
        return text.length() <= maxLen ? text : text.substring(0, maxLen);
    }
}
