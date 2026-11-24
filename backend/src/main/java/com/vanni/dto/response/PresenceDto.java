package com.vanni.dto.response;

import java.time.Instant;

public record PresenceDto(
    Long userId,
    boolean online,
    Instant lastSeenAt
) {}
