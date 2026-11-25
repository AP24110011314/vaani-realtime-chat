package com.vanni.dto.response;

public record UserMeResponse(
    Long id,
    String name,
    String email,
    String avatarUrl,
    String about,
    boolean showLastSeen,
    boolean showReadReceipts,
    boolean linkPreviewsEnabled
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
        this(id, name, email, avatarUrl, about, showLastSeen, showReadReceipts, true);
    }
}
