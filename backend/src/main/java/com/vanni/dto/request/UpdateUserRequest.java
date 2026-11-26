package com.vanni.dto.request;

import jakarta.validation.constraints.Size;

public record UpdateUserRequest(
    @Size(min = 2, max = 80, message = "Name must be between 2 and 80 characters")
    String name,

    @Size(max = 200, message = "About cannot exceed 200 characters")
    String about,

    Boolean showLastSeen,
    Boolean showReadReceipts,
    Boolean linkPreviewsEnabled,
    Boolean callsRelayOnly
) {
    public UpdateUserRequest(String name, String about, Boolean showLastSeen, Boolean showReadReceipts) {
        this(name, about, showLastSeen, showReadReceipts, null, null);
    }

    public UpdateUserRequest(String name, String about, Boolean showLastSeen, Boolean showReadReceipts, Boolean linkPreviewsEnabled) {
        this(name, about, showLastSeen, showReadReceipts, linkPreviewsEnabled, null);
    }
}
