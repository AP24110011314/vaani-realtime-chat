package com.vanni.dto.response;

import java.time.Instant;

public record InviteDto(
    Long id,
    Long conversationId,
    String url,
    String codePrefix,
    UserSummaryResponse createdBy,
    Instant expiresAt,
    Integer maxUses,
    int useCount,
    boolean requiresApproval,
    String status,
    Instant revokedAt,
    Instant createdAt
) {}
