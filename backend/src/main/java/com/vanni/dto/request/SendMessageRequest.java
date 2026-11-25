package com.vanni.dto.request;

import com.vanni.entity.MessageType;
import jakarta.validation.constraints.Size;
import java.util.List;

public record SendMessageRequest(
    @Size(max = 4000, message = "Message content cannot exceed 4000 characters")
    String content,

    @Size(max = 36)
    String clientMessageId,

    Long replyToId,

    List<Long> attachmentIds,

    MessageType type
) {
    public SendMessageRequest(String content, String clientMessageId, Long replyToId) {
        this(content, clientMessageId, replyToId, null, null);
    }

    public SendMessageRequest(String content, String clientMessageId, Long replyToId, List<Long> attachmentIds) {
        this(content, clientMessageId, replyToId, attachmentIds, null);
    }
}
