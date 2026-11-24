package com.vanni.dto.response;

public record UserMeResponse(
    Long id,
    String name,
    String email,
    String avatarUrl,
    String about,
    boolean showLastSeen,
    boolean showReadReceipts
) {}
