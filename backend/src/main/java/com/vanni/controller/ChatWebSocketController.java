package com.vanni.controller;

import com.vanni.dto.request.SendMessageRequest;
import com.vanni.dto.ws.WsErrorData;
import com.vanni.dto.ws.WsSendMessagePayload;
import com.vanni.exception.ApiException;
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

@Controller
public class ChatWebSocketController {

    private static final Logger log = LoggerFactory.getLogger(ChatWebSocketController.class);

    private final MessageService messageService;
    private final EventPublisher eventPublisher;
    private final ObjectMapper objectMapper;

    public ChatWebSocketController(MessageService messageService, EventPublisher eventPublisher) {
        this.messageService = messageService;
        this.eventPublisher = eventPublisher;
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
}
