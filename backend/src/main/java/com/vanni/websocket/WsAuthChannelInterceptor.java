package com.vanni.websocket;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class WsAuthChannelInterceptor implements ChannelInterceptor {

    private static final Logger log = LoggerFactory.getLogger(WsAuthChannelInterceptor.class);
    private static final int MAX_FRAME_PAYLOAD_BYTES = 64 * 1024; // 64 KB

    // Per-user rate limiting: 30 messages per 10 seconds (per WEBSOCKET.md)
    private final Map<String, Bucket> userRateBuckets = new ConcurrentHashMap<>();

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
        StompCommand command = accessor.getCommand();

        if (command == null) {
            return message;
        }

        Principal user = accessor.getUser();
        String destination = accessor.getDestination();

        // 1. Validate SUBSCRIBE command
        if (StompCommand.SUBSCRIBE.equals(command)) {
            if (destination == null) {
                throw new AccessDeniedException("Destination required for subscription");
            }

            // Only /user/queue/events or translated user queue /queue/events-user* allowed
            boolean isAllowedUserQueue = destination.equals("/user/queue/events")
                    || destination.startsWith("/queue/events-user");

            if (!isAllowedUserQueue) {
                log.warn("Unauthorized SUBSCRIBE attempt to destination: {} by user: {}", destination, user != null ? user.getName() : "anonymous");
                throw new AccessDeniedException("Subscription to " + destination + " is not permitted. Only /user/queue/events is allowed.");
            }
        }

        // 2. Validate SEND command
        if (StompCommand.SEND.equals(command)) {
            // Check frame payload size
            Object payload = message.getPayload();
            if (payload instanceof byte[] bytes && bytes.length > MAX_FRAME_PAYLOAD_BYTES) {
                throw new IllegalArgumentException("Payload size exceeds maximum allowed 64KB");
            }

            // Rate limit per user
            if (user != null) {
                Bucket bucket = userRateBuckets.computeIfAbsent(user.getName(), u ->
                    Bucket.builder()
                        .addLimit(Bandwidth.builder().capacity(30).refillGreedy(30, Duration.ofSeconds(10)).build())
                        .build()
                );
                if (!bucket.tryConsume(1)) {
                    log.warn("Rate limit exceeded for user: {}", user.getName());
                    throw new AccessDeniedException("Rate limit exceeded. Please slow down.");
                }
            }
        }

        return message;
    }
}
