package com.vanni.dto.response;

import java.time.Instant;

public record UserMeResponse(
    Long id,
    String name,
    String email,
    String avatarUrl,
    String about,
    boolean showLastSeen,
    boolean showReadReceipts,
    boolean linkPreviewsEnabled,
    boolean aiEnabled,
    Instant aiConsentAt,
    boolean callsRelayOnly
) {
    public UserMeResponse(
        Long id,
        String name,
        String email,
        String avatarUrl,
        String about,
        boolean showLastSeen,
        boolean showReadReceipts
    ) {
        this(id, name, email, avatarUrl, about, showLastSeen, showReadReceipts, true, false, null, false);
    }

    public UserMeResponse(
        Long id,
        String name,
        String email,
        String avatarUrl,
        String about,
        boolean showLastSeen,
        boolean showReadReceipts,
        boolean linkPreviewsEnabled
    ) {
        this(id, name, email, avatarUrl, about, showLastSeen, showReadReceipts, linkPreviewsEnabled, false, null, false);
    }

    public UserMeResponse(
        Long id,
        String name,
        String email,
        String avatarUrl,
        String about,
        boolean showLastSeen,
        boolean showReadReceipts,
        boolean linkPreviewsEnabled,
        boolean aiEnabled,
        Instant aiConsentAt
    ) {
        this(id, name, email, avatarUrl, about, showLastSeen, showReadReceipts, linkPreviewsEnabled, aiEnabled, aiConsentAt, false);
    }
}
