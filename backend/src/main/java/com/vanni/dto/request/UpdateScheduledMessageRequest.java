package com.vanni.dto.request;

import jakarta.validation.constraints.Size;

import java.time.Instant;

public record UpdateScheduledMessageRequest(
    @Size(max = 4000, message = "Message cannot exceed 4000 characters")
    String content,
    Instant scheduledFor
) {}
