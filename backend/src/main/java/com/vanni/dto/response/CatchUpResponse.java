package com.vanni.dto.response;

import java.time.Instant;

public record CatchUpResponse(
    int messageCount,
    Long fromMessageId,
    Long toMessageId,
    boolean truncated,
    Instant generatedAt,
    CatchUpSummaryDto summary
) {}
