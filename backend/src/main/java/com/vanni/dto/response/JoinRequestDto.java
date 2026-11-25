package com.vanni.dto.response;

import com.vanni.entity.JoinRequestStatus;
import java.time.Instant;

public record JoinRequestDto(
    Long id,
    Long conversationId,
    UserSummaryResponse user,
    Long inviteId,
    JoinRequestStatus status,
    Instant createdAt,
    Instant decidedAt
) {}
