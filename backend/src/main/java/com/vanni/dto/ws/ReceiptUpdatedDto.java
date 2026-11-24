package com.vanni.dto.ws;

public record ReceiptUpdatedDto(
    Long conversationId,
    Long messageId,
    Long userId,
    String status,
    Long upToMessageId
) {
    public ReceiptUpdatedDto(Long conversationId, Long messageId, Long userId, String status) {
        this(conversationId, messageId, userId, status, null);
    }
}
