package com.vanni.websocket;

import java.security.Principal;

public record WsUserPrincipal(
    Long userId,
    String email,
    String name
) implements Principal {
    @Override
    public String getName() {
        return userId.toString();
    }
}
