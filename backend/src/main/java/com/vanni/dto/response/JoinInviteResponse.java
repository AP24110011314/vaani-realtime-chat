package com.vanni.dto.response;

public record JoinInviteResponse(
    String status,
    ConversationDto conversation,
    JoinRequestDto request
) {}
