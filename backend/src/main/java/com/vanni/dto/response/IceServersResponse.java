package com.vanni.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

public record IceServersResponse(
    List<IceServerDto> iceServers,
    boolean relayOnly
) {
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record IceServerDto(
        List<String> urls,
        String username,
        String credential
    ) {}
}
