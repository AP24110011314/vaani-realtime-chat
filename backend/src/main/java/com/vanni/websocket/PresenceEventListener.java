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
    private final com.vanni.service.ReceiptService receiptService;
    private final com.vanni.service.CallService callService;

    public PresenceEventListener(
            PresenceService presenceService,
            com.vanni.service.ReceiptService receiptService,
            @org.springframework.context.annotation.Lazy com.vanni.service.CallService callService) {
        this.presenceService = presenceService;
        this.receiptService = receiptService;
        this.callService = callService;
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
            receiptService.markPendingDeliveredForUser(userId);
            callService.onUserReconnected(userId);
        } catch (NumberFormatException e) {
            log.warn("Non-numeric principal name on SessionConnectedEvent: {}", principal.getName());
        }
    }

    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        String sessionId = event.getSessionId();
        log.debug("Session disconnected event: session={}", sessionId);
        Long userId = presenceService.getUserIdForSession(sessionId);
        boolean allOffline = presenceService.onSessionDisconnected(sessionId);
        if (allOffline && userId != null) {
            callService.onUserDisconnected(userId);
        }
    }
}
