package com.vanni.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.vanni.entity.MessageType;
import java.time.Instant;
import java.util.List;

public record MessageDto(
    Long id,
    Long conversationId,
    UserSummaryResponse sender,
    String clientMessageId,
    String content,
    MessageType type,
    ReplySnippet replyTo,
    List<AttachmentDto> attachments,
    List<ReactionDto> reactions,
    String status,
    Instant createdAt,
    Instant editedAt,
    boolean deleted,
    List<MentionDto> mentions,
    boolean mentionsAll,
    boolean mentionsMe,
    @JsonProperty("notify") boolean shouldNotify,
    String previewText
) {
    public MessageDto(
        Long id,
        Long conversationId,
        UserSummaryResponse sender,
        String clientMessageId,
        String content,
        MessageType type,
        ReplySnippet replyTo,
        List<AttachmentDto> attachments,
        List<ReactionDto> reactions,
        String status,
        Instant createdAt,
        Instant editedAt,
        boolean deleted
    ) {
        this(
            id, conversationId, sender, clientMessageId, content, type,
            replyTo, attachments, reactions, status, createdAt, editedAt, deleted,
            List.of(), false, false, true, content
        );
    }
}
