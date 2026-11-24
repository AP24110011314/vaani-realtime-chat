package com.vanni.dto.request;

import jakarta.validation.constraints.NotNull;

public record CreateDirectConversationRequest(
    @NotNull(message = "Target userId is required")
    Long userId
) {}
