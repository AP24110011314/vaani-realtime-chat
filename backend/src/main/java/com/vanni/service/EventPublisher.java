package com.vanni.service;

import com.vanni.dto.ws.WsEnvelope;
import com.vanni.entity.ConversationMember;
import com.vanni.repository.ConversationMemberRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.List;

@Service
public class EventPublisher {

    private static final Logger log = LoggerFactory.getLogger(EventPublisher.class);

    private final SimpMessagingTemplate messagingTemplate;
    private final ConversationMemberRepository conversationMemberRepository;

    public EventPublisher(SimpMessagingTemplate messagingTemplate, ConversationMemberRepository conversationMemberRepository) {
        this.messagingTemplate = messagingTemplate;
        this.conversationMemberRepository = conversationMemberRepository;
    }

    public void sendToUser(Long userId, String type, Object data) {
        runAfterCommitOrNow(() -> {
            try {
                WsEnvelope envelope = new WsEnvelope(type, Instant.now(), data);
                messagingTemplate.convertAndSendToUser(userId.toString(), "/queue/events", envelope);
            } catch (Exception ex) {
                log.error("Failed to send WebSocket event '{}' to user {}: {}", type, userId, ex.getMessage());
            }
        });
    }

    public void sendToConversationMembers(Long conversationId, String type, Object data) {
        runAfterCommitOrNow(() -> {
            List<ConversationMember> members = conversationMemberRepository.findByConversationIdAndLeftAtIsNull(conversationId);
            WsEnvelope envelope = new WsEnvelope(type, Instant.now(), data);
            for (ConversationMember member : members) {
                try {
                    messagingTemplate.convertAndSendToUser(member.getUser().getId().toString(), "/queue/events", envelope);
                } catch (Exception ex) {
                    log.error("Failed to send WebSocket event '{}' to user {}: {}", type, member.getUser().getId(), ex.getMessage());
                }
            }
        });
    }

    private void runAfterCommitOrNow(Runnable task) {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    task.run();
                }
            });
        } else {
            task.run();
        }
    }
}
