package com.vanni.dto.response;

import com.vanni.entity.ConversationType;
import com.vanni.entity.MemberRole;
import com.vanni.entity.NotifyMode;
import java.time.Instant;
import java.util.List;

public record ConversationDto(
    Long id,
    ConversationType type,
    String title,
    String avatarUrl,
    String description,
    List<UserSummaryResponse> members,
    MemberRole myRole,
    boolean muted,
    NotifyMode notifyMode,
    boolean archived,
    boolean pinned,
    long unreadCount,
    long mentionUnreadCount,
    MessageDto lastMessage,
    Instant updatedAt
) {
    public ConversationDto(
        Long id,
        ConversationType type,
        String title,
        String avatarUrl,
        String description,
        List<UserSummaryResponse> members,
        MemberRole myRole,
        boolean muted,
        boolean archived,
        boolean pinned,
        long unreadCount,
        MessageDto lastMessage,
        Instant updatedAt
    ) {
        this(
            id, type, title, avatarUrl, description, members, myRole,
            muted, muted ? NotifyMode.NONE : NotifyMode.ALL,
            archived, pinned, unreadCount, 0L, lastMessage, updatedAt
        );
    }
}
