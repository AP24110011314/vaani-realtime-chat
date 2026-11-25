package com.vanni.dto.response;

import java.time.Instant;
import java.util.List;

public record ScheduledMessageDto(
    Long id,
    Long conversationId,
    String conversationTitle,
    String conversationType,
    String content,
    Long replyToId,
    Instant scheduledFor,
    String status,
    String failureReason,
    int attempts,
    Long sentMessageId,
    List<AttachmentDto> attachments,
    Instant createdAt,
    Instant updatedAt
) {}
