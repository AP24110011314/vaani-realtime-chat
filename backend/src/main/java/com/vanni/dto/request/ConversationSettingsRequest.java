package com.vanni.dto.request;

import com.vanni.entity.NotifyMode;

public record ConversationSettingsRequest(
    Boolean muted,
    Boolean archived,
    Boolean pinned,
    NotifyMode notifyMode
) {
    public ConversationSettingsRequest(Boolean muted, Boolean archived, Boolean pinned) {
        this(muted, archived, pinned, null);
    }
}
