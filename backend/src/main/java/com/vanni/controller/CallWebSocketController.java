package com.vanni.controller;

import com.vanni.entity.CallType;
import com.vanni.exception.ApiException;
import com.vanni.service.CallService;
import com.vanni.service.EventPublisher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.security.Principal;
import java.util.Locale;
import java.util.Map;

@Controller
public class CallWebSocketController {

    private static final Logger log = LoggerFactory.getLogger(CallWebSocketController.class);

    private final CallService callService;
    private final EventPublisher eventPublisher;
    private final ObjectMapper objectMapper;

    public CallWebSocketController(CallService callService, EventPublisher eventPublisher, ObjectMapper objectMapper) {
        this.callService = callService;
        this.eventPublisher = eventPublisher;
        this.objectMapper = objectMapper;
    }

    @MessageMapping("call.invite")
    public void handleInvite(@Payload Object payloadObj, Principal principal) {
        if (principal == null) return;
        Long userId = Long.parseLong(principal.getName());
        try {
            Map<String, Object> map = parseMap(payloadObj);
            Long conversationId = toLong(map.get("conversationId"));
            String typeRaw = map.get("type") instanceof String s ? s.trim().toUpperCase(Locale.ROOT) : "AUDIO";
            CallType callType = CallType.valueOf(typeRaw);
            String clientCallId = map.get("clientCallId") instanceof String c ? c : null;
            callService.invite(userId, conversationId, callType, clientCallId);
        } catch (ApiException ex) {
            sendCallError(userId, null, ex.getCode(), ex.getMessage());
        } catch (Exception ex) {
            log.warn("Invalid call.invite from user={}: {}", userId, ex.getClass().getSimpleName());
            sendCallError(userId, null, "VALIDATION_FAILED", "Invalid call invitation");
        }
    }

    @MessageMapping("call.accept")
    public void handleAccept(@Payload Object payloadObj, Principal principal, SimpMessageHeaderAccessor headers) {
        if (principal == null) return;
        Long userId = Long.parseLong(principal.getName());
        String callId = null;
        try {
            Map<String, Object> map = parseMap(payloadObj);
            callId = asString(map.get("callId"));
            String sessionId = headers != null ? headers.getSessionId() : null;
            callService.accept(userId, callId, sessionId);
        } catch (ApiException ex) {
            sendCallError(userId, callId, ex.getCode(), ex.getMessage());
        } catch (Exception ex) {
            log.warn("Invalid call.accept from user={}: {}", userId, ex.getClass().getSimpleName());
        }
    }

    @MessageMapping("call.decline")
    public void handleDecline(@Payload Object payloadObj, Principal principal) {
        if (principal == null) return;
        Long userId = Long.parseLong(principal.getName());
        try {
            Map<String, Object> map = parseMap(payloadObj);
            callService.decline(userId, asString(map.get("callId")));
        } catch (ApiException ex) {
            sendCallError(userId, null, ex.getCode(), ex.getMessage());
        } catch (Exception ex) {
            log.debug("Ignoring invalid call.decline from user={}", userId);
        }
    }

    @MessageMapping("call.cancel")
    public void handleCancel(@Payload Object payloadObj, Principal principal) {
        if (principal == null) return;
        Long userId = Long.parseLong(principal.getName());
        try {
            Map<String, Object> map = parseMap(payloadObj);
            callService.cancel(userId, asString(map.get("callId")));
        } catch (ApiException ex) {
            sendCallError(userId, null, ex.getCode(), ex.getMessage());
        } catch (Exception ex) {
            log.debug("Ignoring invalid call.cancel from user={}", userId);
        }
    }

    @MessageMapping("call.end")
    public void handleEnd(@Payload Object payloadObj, Principal principal) {
        if (principal == null) return;
        Long userId = Long.parseLong(principal.getName());
        try {
            Map<String, Object> map = parseMap(payloadObj);
            callService.end(userId, asString(map.get("callId")));
        } catch (ApiException ex) {
            sendCallError(userId, null, ex.getCode(), ex.getMessage());
        } catch (Exception ex) {
            log.debug("Ignoring invalid call.end from user={}", userId);
        }
    }

    @MessageMapping("call.state")
    public void handleState(@Payload Object payloadObj, Principal principal) {
        if (principal == null) return;
        Long userId = Long.parseLong(principal.getName());
        try {
            Map<String, Object> map = parseMap(payloadObj);
            callService.updateState(userId, asString(map.get("callId")), asString(map.get("state")));
        } catch (Exception ex) {
            log.debug("Ignoring invalid call.state from user={}", userId);
        }
    }

    @MessageMapping("call.signal")
    public void handleSignal(@Payload Object payloadObj, Principal principal) {
        if (principal == null) return;
        Long userId = Long.parseLong(principal.getName());
        try {
            String rawJson = extractJsonString(payloadObj);
            Map<String, Object> map = objectMapper.readValue(rawJson, new TypeReference<>() {});
            String callId = asString(map.get("callId"));
            String kind = asString(map.get("kind"));
            Long targetUserId = toLong(map.get("targetUserId"));
            Object signalPayload = map.get("payload");
            callService.relaySignal(userId, callId, kind, rawJson, signalPayload, targetUserId);
        } catch (ApiException ex) {
            sendCallError(userId, null, ex.getCode(), ex.getMessage());
        } catch (Exception ex) {
            log.warn("Rejected call.signal from user={}: {}", userId, ex.getClass().getSimpleName());
        }
    }

    private void sendCallError(Long userId, String callId, String code, String message) {
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("code", code);
        body.put("message", message);
        if (callId != null) {
            body.put("callId", callId);
        }
        eventPublisher.sendToUser(userId, "call.error", body);
    }

    private Map<String, Object> parseMap(Object payloadObj) {
        return objectMapper.readValue(extractJsonString(payloadObj), new TypeReference<>() {});
    }

    private static String extractJsonString(Object payloadObj) {
        if (payloadObj instanceof byte[] bytes) {
            return new String(bytes, StandardCharsets.UTF_8);
        }
        return payloadObj != null ? payloadObj.toString() : "{}";
    }

    private static String asString(Object o) {
        return o instanceof String s ? s : null;
    }

    private static Long toLong(Object o) {
        if (o instanceof Number n) return n.longValue();
        if (o instanceof String s && !s.isBlank()) return Long.parseLong(s.trim());
        return null;
    }
}
