package com.vanni.dto.ws;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record WsSendMessagePayload(
    @NotNull(message = "Conversation ID is required")
    Long conversationId,

    @Size(max = 36)
    String clientMessageId,

    @NotBlank(message = "Message content is required")
    @Size(max = 4000, message = "Message content cannot exceed 4000 characters")
    String content,

    Long replyToId
) {}
