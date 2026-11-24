package com.vanni.dto.response;

import com.vanni.entity.MemberRole;
import java.time.Instant;

public record UserSummaryResponse(
    Long id,
    String name,
    String avatarUrl,
    String about,
    boolean online,
    Instant lastSeenAt,
    MemberRole role
) {
    public UserSummaryResponse(Long id, String name, String avatarUrl, String about, boolean online, Instant lastSeenAt) {
        this(id, name, avatarUrl, about, online, lastSeenAt, null);
    }
}
