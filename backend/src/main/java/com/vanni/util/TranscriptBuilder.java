package com.vanni.util;

import com.vanni.entity.Attachment;
import com.vanni.entity.Message;
import com.vanni.entity.MessageType;

import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class TranscriptBuilder {

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneOffset.UTC);
    private static final Pattern MENTION_TOKEN = Pattern.compile("<@(\\d+|all)>");

    public record BuildResult(
        String transcript,
        int messageCount,
        Long fromMessageId,
        Long toMessageId,
        boolean truncated,
        Set<Long> includedMessageIds
    ) {}

    private TranscriptBuilder() {}

    public static BuildResult build(
            List<Message> chronologicalMessages,
            Long currentUserId,
            Map<Long, String> memberNamesById,
            Map<Long, List<Attachment>> attachmentsByMsgId,
            int maxInputChars,
            boolean alreadyTruncatedByCount) {
        if (chronologicalMessages == null || chronologicalMessages.isEmpty()) {
            return new BuildResult("", 0, null, null, alreadyTruncatedByCount, Set.of());
        }

        List<LineEntry> lines = new ArrayList<>();
        for (Message m : chronologicalMessages) {
            if (m.getDeletedAt() != null || m.getMessageType() == MessageType.SYSTEM) {
                continue;
            }
            String senderLabel = (m.getSender() != null && m.getSender().getId().equals(currentUserId))
                ? "You"
                : sanitizeInline(m.getSender() != null ? m.getSender().getName() : "Member", 60);

            String body = formatMessageBody(m, currentUserId, memberNamesById, attachmentsByMsgId);
            if (body.isEmpty()) {
                continue;
            }
            String ts = m.getCreatedAt() != null ? TIME_FMT.format(m.getCreatedAt()) : "--:--";
            String formatted = "[#" + m.getId() + "] " + ts + " " + senderLabel + ": " + body;
            lines.add(new LineEntry(m.getId(), formatted));
        }

        if (lines.isEmpty()) {
            return new BuildResult("", 0, null, null, alreadyTruncatedByCount, Set.of());
        }

        // Keep newest lines first when enforcing maxInputChars
        int budget = Math.max(500, maxInputChars);
        Deque<LineEntry> kept = new ArrayDeque<>();
        int totalChars = 0;
        boolean droppedOldest = alreadyTruncatedByCount;

        for (int i = lines.size() - 1; i >= 0; i--) {
            LineEntry entry = lines.get(i);
            int lineCost = entry.line().length() + (kept.isEmpty() ? 0 : 1);
            if (totalChars + lineCost > budget && !kept.isEmpty()) {
                droppedOldest = true;
                break;
            }
            if (entry.line().length() > budget) {
                entry = new LineEntry(entry.id(), entry.line().substring(0, budget));
                droppedOldest = true;
            }
            kept.addFirst(entry);
            totalChars += lineCost;
        }

        StringBuilder sb = new StringBuilder(totalChars);
        Set<Long> includedIds = new LinkedHashSet<>();
        Long firstId = null;
        Long lastId = null;

        for (LineEntry entry : kept) {
            if (!sb.isEmpty()) {
                sb.append('\n');
            }
            sb.append(entry.line());
            includedIds.add(entry.id());
            if (firstId == null) {
                firstId = entry.id();
            }
            lastId = entry.id();
        }

        return new BuildResult(sb.toString(), kept.size(), firstId, lastId, droppedOldest, Collections.unmodifiableSet(includedIds));
    }

    private static String formatMessageBody(
            Message m,
            Long currentUserId,
            Map<Long, String> memberNamesById,
            Map<Long, List<Attachment>> attachmentsByMsgId) {
        StringBuilder body = new StringBuilder();
        if (m.getContent() != null && !m.getContent().isBlank()) {
            body.append(resolveMentions(m.getContent().trim(), currentUserId, memberNamesById));
        }

        List<Attachment> atts = attachmentsByMsgId != null
            ? attachmentsByMsgId.getOrDefault(m.getId(), List.of())
            : List.of();
        if (!atts.isEmpty()) {
            for (Attachment att : atts) {
                if (!body.isEmpty()) {
                    body.append(' ');
                }
                if (m.getMessageType() == MessageType.VOICE) {
                    int sec = att.getDurationMs() != null ? Math.max(1, att.getDurationMs() / 1000) : 0;
                    body.append("[voice: ").append(sec).append("s]");
                } else {
                    body.append("[file: ").append(sanitizeInline(att.getFileName(), 80)).append(']');
                }
            }
        }
        return body.toString().replace('\r', ' ').replace('\n', ' ').trim();
    }

    private static String resolveMentions(String text, Long currentUserId, Map<Long, String> memberNamesById) {
        Matcher matcher = MENTION_TOKEN.matcher(text);
        StringBuilder sb = new StringBuilder();
        while (matcher.find()) {
            String token = matcher.group(1);
            String replacement;
            if ("all".equals(token)) {
                replacement = "@all";
            } else {
                long uid = Long.parseLong(token);
                if (Objects.equals(uid, currentUserId)) {
                    replacement = "@You";
                } else {
                    String name = memberNamesById != null ? memberNamesById.get(uid) : null;
                    replacement = "@" + (name != null ? sanitizeInline(name, 60) : "Member");
                }
            }
            matcher.appendReplacement(sb, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(sb);
        return sb.toString();
    }

    private static String sanitizeInline(String s, int maxLen) {
        if (s == null) return "";
        String cleaned = s.replace('\r', ' ').replace('\n', ' ').trim();
        return cleaned.length() > maxLen ? cleaned.substring(0, maxLen) : cleaned;
    }

    private record LineEntry(Long id, String line) {}
}
