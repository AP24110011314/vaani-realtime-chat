package com.vanni.dto.ws;

import java.util.List;

public record ChatDeliveredPayload(
    Long conversationId,
    List<Long> messageIds,
    Long upToMessageId
) {}
