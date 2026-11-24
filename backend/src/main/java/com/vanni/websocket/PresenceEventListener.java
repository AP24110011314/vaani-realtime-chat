package com.vanni.websocket;

import com.vanni.service.PresenceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;

@Component
public class PresenceEventListener {

    private static final Logger log = LoggerFactory.getLogger(PresenceEventListener.class);

    private final PresenceService presenceService;

    public PresenceEventListener(PresenceService presenceService) {
        this.presenceService = presenceService;
    }

    @EventListener
    public void handleSessionConnected(SessionConnectedEvent event) {
        Principal principal = event.getUser();
        if (principal == null) return;

        try {
            Long userId = Long.parseLong(principal.getName());
            String sessionId = SimpMessageHeaderAccessor.getSessionId(event.getMessage().getHeaders());
            log.debug("Session connected event: user={}, session={}", userId, sessionId);
            presenceService.onSessionConnected(sessionId, userId);
        } catch (NumberFormatException e) {
            log.warn("Non-numeric principal name on SessionConnectedEvent: {}", principal.getName());
        }
    }

    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        log.debug("Session disconnected event: session={}", sessionId);
        presenceService.onSessionDisconnected(sessionId);
    }
}
