package com.vanni.dto.request;

public record CatchUpRequest(
    Long fromMessageId,
    Boolean force
) {}
