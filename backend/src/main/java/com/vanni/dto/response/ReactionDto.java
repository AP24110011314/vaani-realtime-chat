package com.vanni.dto.response;

public record ReactionDto(
    String emoji,
    long count,
    boolean reactedByMe
) {}
