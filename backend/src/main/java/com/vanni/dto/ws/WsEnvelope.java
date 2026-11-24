package com.vanni.dto.ws;

import java.time.Instant;

public record WsEnvelope(
    String type,
    Instant ts,
    Object data
) {
    public static WsEnvelope of(String type, Object data) {
        return new WsEnvelope(type, Instant.now(), data);
    }
}
