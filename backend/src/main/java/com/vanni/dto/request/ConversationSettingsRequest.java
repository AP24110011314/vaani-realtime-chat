package com.vanni.dto.request;

public record ConversationSettingsRequest(
    Boolean muted,
    Boolean archived,
    Boolean pinned
) {}
