package com.vanni.dto.response;

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
    List<?> reactions,
    String status,
    Instant createdAt,
    Instant editedAt,
    boolean deleted
) {}
