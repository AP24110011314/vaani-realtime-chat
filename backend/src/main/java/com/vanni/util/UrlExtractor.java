package com.vanni.util;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class UrlExtractor {

    private static final int MAX_URL_LENGTH = 2048;
    private static final Pattern URL_PATTERN = Pattern.compile("(?i)https?://[^\\s<>\"'`]+");

    private UrlExtractor() {}

    /**
     * Extract the first HTTP/HTTPS URL outside backtick code spans and mention tokens,
     * trimming trailing sentence punctuation cleanly.
     */
    public static Optional<String> extractFirstUrl(String text) {
        if (text == null || text.isBlank()) {
            return Optional.empty();
        }
        List<int[]> codeRanges = findCodeRanges(text);
        Matcher m = URL_PATTERN.matcher(text);
        while (m.find()) {
            int start = m.start();
            if (isInsideRanges(start, codeRanges)) {
                continue;
            }
            String candidate = trimTrailingPunctuation(m.group());
            if (!candidate.isEmpty() && candidate.length() <= MAX_URL_LENGTH) {
                return Optional.of(candidate);
            }
        }
        return Optional.empty();
    }

    private static String trimTrailingPunctuation(String raw) {
        String s = raw;
        while (!s.isEmpty()) {
            char last = s.charAt(s.length() - 1);
            if (last == '.' || last == ',' || last == ';' || last == '!' || last == '?'
                    || last == '\'' || last == '"' || last == ']' || last == '}') {
                s = s.substring(0, s.length() - 1);
            } else if (last == ')' && countChar(s, '(') < countChar(s, ')')) {
                s = s.substring(0, s.length() - 1);
            } else {
                break;
            }
        }
        return s;
    }

    private static int countChar(String s, char target) {
        int c = 0;
        for (int i = 0; i < s.length(); i++) {
            if (s.charAt(i) == target) c++;
        }
        return c;
    }

    private static List<int[]> findCodeRanges(String text) {
        List<int[]> ranges = new ArrayList<>();
        int i = 0;
        while (i < text.length()) {
            if (text.charAt(i) == '`') {
                int ticks = 0;
                while (i + ticks < text.length() && text.charAt(i + ticks) == '`') {
                    ticks++;
                }
                String fence = "`".repeat(ticks);
                int close = text.indexOf(fence, i + ticks);
                if (close != -1) {
                    ranges.add(new int[]{i, close + ticks});
                    i = close + ticks;
                    continue;
                }
                i += ticks;
            } else {
                i++;
            }
        }
        return ranges;
    }

    private static boolean isInsideRanges(int pos, List<int[]> ranges) {
        for (int[] r : ranges) {
            if (pos >= r[0] && pos < r[1]) {
                return true;
            }
        }
        return false;
    }
}
