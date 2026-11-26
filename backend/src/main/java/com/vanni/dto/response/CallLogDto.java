package com.vanni.dto.response;

import java.time.Instant;

public record CallLogDto(
    Long id,
    String callUuid,
    String callType,
    String endReason,
    Long callerId,
    Long calleeId,
    int durationSec,
    Instant startedAt,
    Instant endedAt
) {}
