package com.vanni.util;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses and renders mention tokens (<@userId> and <@all>) outside inline/fenced code spans.
 */
public final class MentionParser {

    public static final int MAX_MENTIONS_PER_MESSAGE = 20;

    private static final Pattern MENTION_TOKEN_PATTERN = Pattern.compile("<@(\\d+|all)>");

    private MentionParser() {}

    public record ParseResult(
        List<Long> userIds,
        boolean mentionsAll
    ) {}

    /**
     * Extracts unique valid mention tokens outside code spans (`...` or ```...```).
     * Tokens whose userId is not in {@code activeMemberIds} are ignored (left as literal text).
     * {@code <@all>} is accepted only when {@code allowAll} is true.
     */
    public static ParseResult parse(String content, Set<Long> activeMemberIds, boolean allowAll) {
        if (content == null || content.isEmpty()) {
            return new ParseResult(List.of(), false);
        }

        List<int[]> codeRanges = findCodeSpanRanges(content);
        Matcher matcher = MENTION_TOKEN_PATTERN.matcher(content);

        Set<Long> uniqueIds = new LinkedHashSet<>();
        boolean mentionsAll = false;

        while (matcher.find()) {
            if (isInsideRanges(matcher.start(), codeRanges)) {
                continue;
            }
            String token = matcher.group(1);
            if ("all".equals(token)) {
                if (allowAll) {
                    mentionsAll = true;
                }
                continue;
            }
            if (uniqueIds.size() >= MAX_MENTIONS_PER_MESSAGE) {
                continue;
            }
            try {
                long id = Long.parseLong(token);
                if (activeMemberIds != null && activeMemberIds.contains(id)) {
                    uniqueIds.add(id);
                }
            } catch (NumberFormatException ignored) {
                // Non-representable numeric ID left as literal text
            }
        }

        return new ParseResult(new ArrayList<>(uniqueIds), mentionsAll);
    }

    /**
     * Renders <@userId> and <@all> tokens to readable @Name / @all text for previews,
     * notifications, and search indexing. Unknown tokens remain literal.
     */
    public static String renderDisplayText(String content, Map<Long, String> userNamesById, boolean mentionsAll) {
        if (content == null || content.isEmpty()) {
            return content;
        }

        List<int[]> codeRanges = findCodeSpanRanges(content);
        Matcher matcher = MENTION_TOKEN_PATTERN.matcher(content);
        StringBuilder sb = new StringBuilder(content.length());
        int lastEnd = 0;

        while (matcher.find()) {
            sb.append(content, lastEnd, matcher.start());
            if (isInsideRanges(matcher.start(), codeRanges)) {
                sb.append(matcher.group(0));
            } else {
                String token = matcher.group(1);
                if ("all".equals(token)) {
                    sb.append(mentionsAll ? "@all" : matcher.group(0));
                } else {
                    String resolved = null;
                    try {
                        long id = Long.parseLong(token);
                        if (userNamesById != null) {
                            resolved = userNamesById.get(id);
                        }
                    } catch (NumberFormatException ignored) {
                        // keep literal
                    }
                    if (resolved != null) {
                        sb.append('@').append(resolved);
                    } else {
                        sb.append(matcher.group(0));
                    }
                }
            }
            lastEnd = matcher.end();
        }
        sb.append(content, lastEnd, content.length());
        return sb.toString();
    }

    private static List<int[]> findCodeSpanRanges(String text) {
        List<int[]> ranges = new ArrayList<>();
        int n = text.length();
        int i = 0;
        while (i < n) {
            if (text.charAt(i) == '`') {
                int tickCount = 0;
                while (i + tickCount < n && text.charAt(i + tickCount) == '`') {
                    tickCount++;
                }
                String closing = "`".repeat(tickCount);
                int closeIdx = text.indexOf(closing, i + tickCount);
                if (closeIdx != -1) {
                    // Ensure exact closing run length when tickCount >= 3 or inline backtick
                    ranges.add(new int[] { i, closeIdx + tickCount });
                    i = closeIdx + tickCount;
                    continue;
                }
                i += tickCount;
            } else {
                i++;
            }
        }
        return ranges;
    }

    private static boolean isInsideRanges(int pos, List<int[]> ranges) {
        for (int[] range : ranges) {
            if (pos >= range[0] && pos < range[1]) {
                return true;
            }
        }
        return false;
    }
}
