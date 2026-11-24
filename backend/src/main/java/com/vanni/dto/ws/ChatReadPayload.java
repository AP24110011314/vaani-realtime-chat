package com.vanni.dto.ws;

public record ChatReadPayload(
    Long conversationId,
    Long upToMessageId
) {}
