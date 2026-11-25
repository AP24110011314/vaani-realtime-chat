package com.vanni.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public record CreateScheduledMessageRequest(
    @Size(max = 4000, message = "Message cannot exceed 4000 characters")
    String content,
    @NotNull(message = "scheduledFor is required")
    Instant scheduledFor,
    @Size(max = 64, message = "clientMessageId cannot exceed 64 characters")
    String clientMessageId,
    Long replyToId,
    List<Long> attachmentIds
) {}
