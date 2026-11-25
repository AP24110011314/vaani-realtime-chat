package com.vanni.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record CreateInviteRequest(
    @Min(60) @Max(2592000) Integer expiresInSeconds,
    @Min(1) @Max(1000) Integer maxUses,
    boolean requiresApproval
) {}
