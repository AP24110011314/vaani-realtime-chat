package com.vanni.dto.response;

import com.vanni.entity.ConversationType;
import com.vanni.entity.MemberRole;
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
    boolean archived,
    boolean pinned,
    long unreadCount,
    MessageDto lastMessage,
    Instant updatedAt
) {}
