package com.vanni.dto.response;

import java.time.Instant;

public record ReceiptDetailResponse(
    Long userId,
    String name,
    String avatarUrl,
    String status,
    Instant updatedAt
) {}
