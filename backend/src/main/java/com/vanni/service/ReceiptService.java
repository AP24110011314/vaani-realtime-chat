package com.vanni.service;

import com.vanni.dto.response.ReceiptDetailResponse;
import com.vanni.dto.ws.ReceiptUpdatedDto;
import com.vanni.entity.*;
import com.vanni.exception.ApiException;
import com.vanni.repository.ConversationMemberRepository;
import com.vanni.repository.MessageReceiptRepository;
import com.vanni.repository.MessageRepository;
import com.vanni.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class ReceiptService {

    private static final Logger log = LoggerFactory.getLogger(ReceiptService.class);

    private final MessageReceiptRepository messageReceiptRepository;
    private final MessageRepository messageRepository;
    private final ConversationMemberRepository conversationMemberRepository;
    private final ConversationAccessService conversationAccessService;
    private final UserRepository userRepository;
    private final EventPublisher eventPublisher;

    public ReceiptService(
            MessageReceiptRepository messageReceiptRepository,
            MessageRepository messageRepository,
            ConversationMemberRepository conversationMemberRepository,
            ConversationAccessService conversationAccessService,
            UserRepository userRepository,
            EventPublisher eventPublisher) {
        this.messageReceiptRepository = messageReceiptRepository;
        this.messageRepository = messageRepository;
        this.conversationMemberRepository = conversationMemberRepository;
        this.conversationAccessService = conversationAccessService;
        this.userRepository = userRepository;
        this.eventPublisher = eventPublisher;
    }

    public void markDelivered(Long userId, Long conversationId, List<Long> messageIds, Long upToMessageId) {
        ConversationMember member = conversationAccessService.requireMember(conversationId, userId);
        User recipient = member.getUser();

        List<Message> targetMessages;
        if (messageIds != null && !messageIds.isEmpty()) {
            targetMessages = messageRepository.findAllById(messageIds).stream()
                .filter(m -> m.getConversation().getId().equals(conversationId) && !m.getSender().getId().equals(userId))
                .toList();
        } else if (upToMessageId != null) {
            targetMessages = messageRepository.findUpToMessage(conversationId, upToMessageId, userId);
        } else {
            return;
        }

        Instant now = Instant.now();
        for (Message msg : targetMessages) {
            int inserted = messageReceiptRepository.insertIgnoreReceipt(msg.getId(), userId, ReceiptStatus.DELIVERED.name(), now);
            if (inserted > 0) {
                eventPublisher.sendToUser(
                    msg.getSender().getId(),
                    "receipt.updated",
                    new ReceiptUpdatedDto(conversationId, msg.getId(), userId, "DELIVERED")
                );
            }
            // If already DELIVERED or READ, do not downgrade
        }
    }

    public void markRead(Long userId, Long conversationId, Long upToMessageId) {
        ConversationMember member = conversationAccessService.requireMember(conversationId, userId);
        User reader = member.getUser();

        if (upToMessageId == null) {
            Optional<Message> latest = messageRepository.findTopByConversationIdOrderByIdDesc(conversationId);
            if (latest.isEmpty()) {
                return;
            }
            upToMessageId = latest.get().getId();
        }

        // Monotonically advance last_read_message_id
        Long currentLastRead = member.getLastReadMessageId();
        if (currentLastRead == null || upToMessageId > currentLastRead) {
            member.setLastReadMessageId(upToMessageId);
            member.setLastReadAt(Instant.now());
            conversationMemberRepository.save(member);
        }

        // Emit unread.updated to reader's tabs
        long unreadCount = messageRepository.countUnread(conversationId, member.getLastReadMessageId(), userId);
        eventPublisher.sendToUser(userId, "unread.updated", Map.of(
            "conversationId", conversationId,
            "unreadCount", unreadCount
        ));

        // Upsert READ receipts for unread messages sent by others (sorted + pre-checked to avoid S-to-X deadlocks)
        Instant now = Instant.now();
        List<Message> targetMessages = messageRepository.findUpToMessage(conversationId, upToMessageId, userId)
            .stream()
            .sorted(Comparator.comparing(Message::getId))
            .toList();
        if (targetMessages.isEmpty()) {
            return;
        }
        List<Long> targetIds = targetMessages.stream().map(Message::getId).toList();
        Map<Long, ReceiptStatus> existingStatusByMsg = messageReceiptRepository.findByUserIdAndMessageIds(userId, targetIds)
            .stream()
            .collect(Collectors.toMap(r -> r.getMessage().getId(), MessageReceipt::getStatus, (a, b) -> a));

        for (Message msg : targetMessages) {
            ReceiptStatus existing = existingStatusByMsg.get(msg.getId());
            if (existing == ReceiptStatus.READ) {
                continue;
            }
            boolean transitionedToRead;
            if (existing == ReceiptStatus.DELIVERED) {
                transitionedToRead = messageReceiptRepository.upgradeToRead(msg.getId(), userId, now) > 0;
            } else {
                int inserted = messageReceiptRepository.insertIgnoreReceipt(msg.getId(), userId, ReceiptStatus.READ.name(), now);
                transitionedToRead = inserted > 0 || messageReceiptRepository.upgradeToRead(msg.getId(), userId, now) > 0;
            }

            // Respect show_read_receipts privacy:
            // Still update own unread state, but do not emit READ to sender if reader disabled read receipts
            if (transitionedToRead) {
                if (reader.isShowReadReceipts()) {
                    eventPublisher.sendToUser(
                        msg.getSender().getId(),
                        "receipt.updated",
                        new ReceiptUpdatedDto(conversationId, msg.getId(), userId, "READ")
                    );
                } else {
                    // If reader has read receipts disabled, ensure sender has at least DELIVERED
                    eventPublisher.sendToUser(
                        msg.getSender().getId(),
                        "receipt.updated",
                        new ReceiptUpdatedDto(conversationId, msg.getId(), userId, "DELIVERED")
                    );
                }
            }
        }
    }

    public void markPendingDeliveredForUser(Long userId) {
        User recipient = userRepository.findById(userId).orElse(null);
        if (recipient == null) return;

        List<ConversationMember> activeMemberships = conversationMemberRepository.findByUserIdAndLeftAtIsNull(userId);
        Instant now = Instant.now();
        for (ConversationMember cm : activeMemberships) {
            Long convId = cm.getConversation().getId();
            List<Message> pending = messageRepository.findMessagesWithoutReceiptFromUser(convId, userId);
            for (Message msg : pending) {
                int inserted = messageReceiptRepository.insertIgnoreReceipt(msg.getId(), userId, ReceiptStatus.DELIVERED.name(), now);
                if (inserted > 0) {
                    eventPublisher.sendToUser(
                        msg.getSender().getId(),
                        "receipt.updated",
                        new ReceiptUpdatedDto(convId, msg.getId(), userId, "DELIVERED")
                    );
                }
            }
        }
    }

    @Transactional(readOnly = true)
    public List<ReceiptDetailResponse> getReceiptsForMessage(Long messageId, Long requesterId) {
        Message msg = messageRepository.findById(messageId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MESSAGE_NOT_FOUND", "Message not found"));

        if (!msg.getSender().getId().equals(requesterId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only the message sender can view receipts");
        }

        List<ConversationMember> activeMembers = conversationMemberRepository.findByConversationIdAndLeftAtIsNull(msg.getConversation().getId());
        List<MessageReceipt> receipts = messageReceiptRepository.findWithUserByMessageId(messageId);
        Map<Long, MessageReceipt> receiptMap = receipts.stream()
            .collect(Collectors.toMap(r -> r.getUser().getId(), r -> r, (a, b) -> a));

        List<ReceiptDetailResponse> result = new ArrayList<>();
        for (ConversationMember cm : activeMembers) {
            User user = cm.getUser();
            if (user.getId().equals(requesterId)) {
                continue;
            }

            MessageReceipt r = receiptMap.get(user.getId());
            String status = "SENT";
            Instant updatedAt = null;
            if (r != null) {
                if (r.getStatus() == ReceiptStatus.READ) {
                    // Respect privacy
                    status = user.isShowReadReceipts() ? "READ" : "DELIVERED";
                } else {
                    status = "DELIVERED";
                }
                updatedAt = r.getUpdatedAt();
            }

            result.add(new ReceiptDetailResponse(
                user.getId(),
                user.getName(),
                user.getAvatarUrl(),
                status,
                updatedAt
            ));
        }

        return result;
    }

    @Transactional(readOnly = true)
    public String computeMessageStatus(Message msg, List<ConversationMember> activeMembers, Map<Long, List<MessageReceipt>> receiptsByMessageId) {
        if (msg.getMessageType() == MessageType.SYSTEM) {
            return "SENT";
        }

        List<MessageReceipt> receipts = receiptsByMessageId.getOrDefault(msg.getId(), List.of());
        Map<Long, MessageReceipt> userReceipts = receipts.stream()
            .collect(Collectors.toMap(r -> r.getUser().getId(), r -> r, (a, b) -> a));

        Long senderId = msg.getSender().getId();
        List<ConversationMember> recipients = activeMembers.stream()
            .filter(m -> !m.getUser().getId().equals(senderId))
            .toList();

        if (recipients.isEmpty()) {
            return "SENT";
        }

        ConversationType type = msg.getConversation().getType();
        if (type == ConversationType.DIRECT) {
            User otherUser = recipients.getFirst().getUser();
            MessageReceipt r = userReceipts.get(otherUser.getId());
            if (r == null) {
                return "SENT";
            }
            if (r.getStatus() == ReceiptStatus.READ) {
                return otherUser.isShowReadReceipts() ? "READ" : "DELIVERED";
            }
            return "DELIVERED";
        } else {
            // Group: DELIVERED when all active recipients delivered, READ when all read
            boolean allDelivered = true;
            boolean allRead = true;

            for (ConversationMember rm : recipients) {
                User user = rm.getUser();
                MessageReceipt r = userReceipts.get(user.getId());
                if (r == null) {
                    allDelivered = false;
                    allRead = false;
                    break;
                }
                if (r.getStatus() != ReceiptStatus.READ || !user.isShowReadReceipts()) {
                    allRead = false;
                }
            }

            if (allRead) {
                return "READ";
            }
            if (allDelivered) {
                return "DELIVERED";
            }
            return "SENT";
        }
    }
}
