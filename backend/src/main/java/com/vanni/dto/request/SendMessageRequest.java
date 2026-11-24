package com.vanni.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SendMessageRequest(
    @NotBlank(message = "Message content is required")
    @Size(max = 4000, message = "Message content cannot exceed 4000 characters")
    String content,

    @Size(max = 36)
    String clientMessageId,

    Long replyToId
) {}
