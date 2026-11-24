package com.vanni.controller;

import com.vanni.dto.request.SendMessageRequest;
import com.vanni.dto.ws.WsErrorData;
import com.vanni.dto.ws.WsSendMessagePayload;
import com.vanni.entity.ConversationMember;
import com.vanni.entity.User;
import com.vanni.exception.ApiException;
import com.vanni.repository.ConversationMemberRepository;
import com.vanni.repository.UserRepository;
import com.vanni.service.ConversationAccessService;
import com.vanni.service.EventPublisher;
import com.vanni.service.MessageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Controller
public class ChatWebSocketController {

    private static final Logger log = LoggerFactory.getLogger(ChatWebSocketController.class);

    private final MessageService messageService;
    private final EventPublisher eventPublisher;
    private final ConversationAccessService conversationAccessService;
    private final ConversationMemberRepository conversationMemberRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    private final ConcurrentHashMap<String, Long> typingThrottles = new ConcurrentHashMap<>();

    public ChatWebSocketController(
            MessageService messageService,
            EventPublisher eventPublisher,
            ConversationAccessService conversationAccessService,
            ConversationMemberRepository conversationMemberRepository,
            UserRepository userRepository) {
        this.messageService = messageService;
        this.eventPublisher = eventPublisher;
        this.conversationAccessService = conversationAccessService;
        this.conversationMemberRepository = conversationMemberRepository;
        this.userRepository = userRepository;
        this.objectMapper = new JsonMapper();
    }

    @MessageMapping("chat.send")
    public void handleSendMessage(@Payload Object payloadObj, Principal principal) {
        Long senderId = Long.parseLong(principal.getName());
        String clientMessageId = null;

        try {
            String json;
            if (payloadObj instanceof byte[] bytes) {
                json = new String(bytes, StandardCharsets.UTF_8);
            } else {
                json = payloadObj.toString();
            }

            JsonNode node = objectMapper.readTree(json);
            if (node.has("clientMessageId") && !node.get("clientMessageId").isNull()) {
                clientMessageId = node.get("clientMessageId").asText();
            }

            Long conversationId = node.has("conversationId") ? node.get("conversationId").asLong() : null;
            String content = node.has("content") ? node.get("content").asText() : "";
            Long replyToId = (node.has("replyToId") && !node.get("replyToId").isNull())
                    ? node.get("replyToId").asLong()
                    : null;

            if (conversationId == null) {
                throw new ApiException(
                        org.springframework.http.HttpStatus.BAD_REQUEST,
                        "VALIDATION_FAILED",
                        "Conversation ID is required"
                );
            }

            SendMessageRequest req = new SendMessageRequest(content, clientMessageId, replyToId);
            messageService.send(conversationId, senderId, req);
        } catch (ApiException ex) {
            log.warn("ChatWebSocketController error sending message: {}", ex.getMessage());
            WsErrorData errorData = new WsErrorData(ex.getCode(), ex.getMessage(), clientMessageId);
            eventPublisher.sendToUser(senderId, "error", errorData);
        } catch (Exception ex) {
            log.error("Unexpected error in chat.send", ex);
            WsErrorData errorData = new WsErrorData("INTERNAL_ERROR", "Failed to send message", clientMessageId);
            eventPublisher.sendToUser(senderId, "error", errorData);
        }
    }

    @MessageMapping("chat.typing")
    public void handleTyping(@Payload Object payloadObj, Principal principal) {
        Long senderId = Long.parseLong(principal.getName());
        try {
            String json;
            if (payloadObj instanceof byte[] bytes) {
                json = new String(bytes, StandardCharsets.UTF_8);
            } else {
                json = payloadObj.toString();
            }

            JsonNode node = objectMapper.readTree(json);
            Long conversationId = node.has("conversationId") ? node.get("conversationId").asLong() : null;
            boolean typing = !node.has("typing") || node.get("typing").asBoolean();

            if (conversationId == null) return;

            // Throttle: max 1 per 2 seconds per user per conversation when typing is true
            String throttleKey = senderId + ":" + conversationId;
            long now = System.currentTimeMillis();
            if (typing) {
                Long last = typingThrottles.get(throttleKey);
                if (last != null && (now - last) < 2000) {
                    return;
                }
                typingThrottles.put(throttleKey, now);
            } else {
                typingThrottles.remove(throttleKey);
            }

            // Verify active membership
            conversationAccessService.requireMember(conversationId, senderId);

            User sender = userRepository.findById(senderId).orElse(null);
            String senderName = sender != null ? sender.getName() : "Someone";

            Map<String, Object> typingData = Map.of(
                "conversationId", conversationId,
                "userId", senderId,
                "name", senderName,
                "typing", typing
            );

            // Forward typing event to all other active conversation members
            List<ConversationMember> members = conversationMemberRepository.findByConversationIdAndLeftAtIsNull(conversationId);
            for (ConversationMember m : members) {
                if (!m.getUser().getId().equals(senderId)) {
                    eventPublisher.sendToUser(m.getUser().getId(), "typing", typingData);
                }
            }
        } catch (Exception ex) {
            log.debug("Error handling typing frame from user {}: {}", senderId, ex.getMessage());
        }
    }
}
