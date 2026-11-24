package com.vanni.dto.response;

import java.time.Instant;

public record UserSummaryResponse(
    Long id,
    String name,
    String avatarUrl,
    String about,
    boolean online,
    Instant lastSeenAt
) {}
