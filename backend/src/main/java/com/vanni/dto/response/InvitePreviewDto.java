package com.vanni.dto.response;

public record InvitePreviewDto(
    Long conversationId,
    String title,
    String avatarUrl,
    String description,
    long memberCount,
    boolean requiresApproval,
    boolean alreadyMember
) {}
