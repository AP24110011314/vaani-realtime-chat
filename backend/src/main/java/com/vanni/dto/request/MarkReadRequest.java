package com.vanni.dto.request;

public record MarkReadRequest(
    Long upToMessageId,
    Long lastMessageId
) {}
