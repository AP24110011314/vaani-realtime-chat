package com.vanni.dto.ws;

public record WsErrorData(
    String code,
    String message,
    String clientMessageId
) {}
