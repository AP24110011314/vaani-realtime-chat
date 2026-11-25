package com.vanni.service;

import com.vanni.dto.request.SendMessageRequest;
import com.vanni.dto.response.AttachmentDto;
import com.vanni.dto.response.MessageDto;
import com.vanni.dto.response.ReactionDto;
import com.vanni.dto.response.ReplySnippet;
import com.vanni.entity.Attachment;
import com.vanni.entity.Conversation;
import com.vanni.entity.ConversationMember;
import com.vanni.entity.ConversationType;
import com.vanni.entity.MemberRole;
import com.vanni.entity.Message;
import com.vanni.entity.MessageReceipt;
import com.vanni.entity.MessageType;
import com.vanni.entity.Reaction;
import com.vanni.entity.User;
import com.vanni.exception.ApiException;
import com.vanni.repository.AttachmentRepository;
import com.vanni.repository.ConversationMemberRepository;
import com.vanni.repository.ConversationRepository;
import com.vanni.repository.MessageReceiptRepository;
import com.vanni.repository.MessageRepository;
import com.vanni.repository.ReactionRepository;
import com.vanni.repository.UserRepository;
import com.vanni.storage.StorageService;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Transactional
public class MessageService {

    private final MessageRepository messageRepository;
    private final ConversationRepository conversationRepository;
    private final ConversationMemberRepository conversationMemberRepository;
    private final ConversationAccessService conversationAccessService;
    private final UserService userService;
    private final EventPublisher eventPublisher;
    private final ReceiptService receiptService;
    private final MessageReceiptRepository messageReceiptRepository;
    private final AttachmentRepository attachmentRepository;
    private final ReactionRepository reactionRepository;
    private final UserRepository userRepository;
    private final StorageService storageService;
    private final com.vanni.repository.BlockRepository blockRepository;

    public MessageService(
            MessageRepository messageRepository,
            ConversationRepository conversationRepository,
            ConversationMemberRepository conversationMemberRepository,
            ConversationAccessService conversationAccessService,
            UserService userService,
            EventPublisher eventPublisher,
            ReceiptService receiptService,
            MessageReceiptRepository messageReceiptRepository,
            AttachmentRepository attachmentRepository,
            ReactionRepository reactionRepository,
            UserRepository userRepository,
            StorageService storageService,
            com.vanni.repository.BlockRepository blockRepository) {
        this.messageRepository = messageRepository;
        this.conversationRepository = conversationRepository;
        this.conversationMemberRepository = conversationMemberRepository;
        this.conversationAccessService = conversationAccessService;
        this.userService = userService;
        this.eventPublisher = eventPublisher;
        this.receiptService = receiptService;
        this.messageReceiptRepository = messageReceiptRepository;
        this.attachmentRepository = attachmentRepository;
        this.reactionRepository = reactionRepository;
        this.userRepository = userRepository;
        this.storageService = storageService;
        this.blockRepository = blockRepository;
    }

    public MessageDto send(Long conversationId, Long senderId, SendMessageRequest req) {
        String content = req.content() != null ? req.content().trim() : "";
        List<Long> attachmentIds = req.attachmentIds() != null ? req.attachmentIds() : List.of();

        if (content.isEmpty() && attachmentIds.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Message content cannot be blank when no attachments are present");
        }
        if (content.length() > 4000) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Message content exceeds 4000 characters");
        }
        for (int i = 0; i < content.length(); i++) {
            char c = content.charAt(i);
            if (Character.isISOControl(c) && c != '\n' && c != '\t' && c != '\r') {
                throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Invalid control characters in message");
            }
        }

        ConversationMember member = conversationAccessService.requireMember(conversationId, senderId);
        Conversation conv = member.getConversation();

        if (conv.getType() == ConversationType.DIRECT) {
            List<ConversationMember> cms = conversationMemberRepository.findByConversationIdAndLeftAtIsNull(conversationId);
            for (ConversationMember cm : cms) {
                if (!cm.getUser().getId().equals(senderId)) {
                    if (blockRepository.isBlockedEitherWay(senderId, cm.getUser().getId())) {
                        throw new ApiException(HttpStatus.FORBIDDEN, "USER_BLOCKED", "Cannot send message to a blocked user");
                    }
                }
            }
        }

        // Idempotency check via clientMessageId
        if (req.clientMessageId() != null && !req.clientMessageId().isBlank()) {
            Optional<Message> existing = messageRepository.findBySenderIdAndClientMessageId(senderId, req.clientMessageId().trim());
            if (existing.isPresent()) {
                MessageDto dto = toDto(existing.get(), senderId);
                eventPublisher.sendToUser(senderId, "message.created", dto);
                return dto;
            }
        }

        List<Attachment> attachments = List.of();
        if (!attachmentIds.isEmpty()) {
            attachments = attachmentRepository.findAllById(attachmentIds);
            if (attachments.size() != attachmentIds.size()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "ATTACHMENT_NOT_FOUND", "One or more attachments not found");
            }
            for (Attachment a : attachments) {
                if (!a.getUploader().getId().equals(senderId)) {
                    throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Cannot link attachment uploaded by another user");
                }
                if (a.getMessage() != null) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "ATTACHMENT_ALREADY_ATTACHED", "Attachment is already linked to a message");
                }
            }
        }

        Message replyTo = null;
        if (req.replyToId() != null) {
            replyTo = messageRepository.findByIdAndConversationId(req.replyToId(), conversationId)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "INVALID_REPLY", "Reply target message not found in this conversation"));
        }

        MessageType messageType = MessageType.TEXT;
        if (!attachments.isEmpty()) {
            boolean allImages = attachments.stream()
                .allMatch(a -> a.getMimeType() != null && a.getMimeType().startsWith("image/"));
            messageType = allImages ? MessageType.IMAGE : MessageType.FILE;
        }

        Message message = new Message();
        message.setConversation(conv);
        message.setSender(member.getUser());
        message.setClientMessageId(req.clientMessageId() != null ? req.clientMessageId().trim() : null);
        message.setContent(content.isEmpty() ? null : content);
        message.setMessageType(messageType);
        message.setReplyTo(replyTo);

        message = messageRepository.save(message);

        // Link attachments
        for (Attachment a : attachments) {
            a.setMessage(message);
            attachmentRepository.save(a);
        }

        // Update conversation last message
        conv.setLastMessage(message);
        conv.setLastMessageAt(message.getCreatedAt());
        conv.setUpdatedAt(message.getCreatedAt());
        conversationRepository.save(conv);

        // Update sender's read pointer
        member.setLastReadMessageId(message.getId());
        member.setLastReadAt(message.getCreatedAt());
        conversationMemberRepository.save(member);

        MessageDto dto = toDto(message, senderId);
        eventPublisher.sendToConversationMembers(conversationId, "message.created", dto);

        return dto;
    }

    public MessageDto editMessage(Long messageId, Long userId, String newContent) {
        if (newContent == null || newContent.trim().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Message content cannot be blank");
        }
        String trimmed = newContent.trim();
        if (trimmed.length() > 4000) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Message content exceeds 4000 characters");
        }
        for (int i = 0; i < trimmed.length(); i++) {
            char c = trimmed.charAt(i);
            if (Character.isISOControl(c) && c != '\n' && c != '\t' && c != '\r') {
                throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Invalid control characters in message");
            }
        }

        Message message = messageRepository.findById(messageId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MESSAGE_NOT_FOUND", "Message not found"));

        if (!message.getSender().getId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only the sender can edit this message");
        }

        if (message.getDeletedAt() != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "MESSAGE_DELETED", "Cannot edit a deleted message");
        }

        if (Duration.between(message.getCreatedAt(), Instant.now()).toMinutes() > 15) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "EDIT_WINDOW_EXPIRED", "Message can only be edited within 15 minutes");
        }

        message.setContent(trimmed);
        message.setEditedAt(Instant.now());
        message = messageRepository.save(message);

        // Broadcast message.updated to all active members
        List<ConversationMember> members = conversationMemberRepository.findByConversationIdAndLeftAtIsNull(message.getConversation().getId());
        for (ConversationMember m : members) {
            MessageDto memberDto = toDto(message, m.getUser().getId());
            eventPublisher.sendToUser(m.getUser().getId(), "message.updated", memberDto);
        }

        return toDto(message, userId);
    }

    public void deleteMessage(Long messageId, Long userId) {
        Message message = messageRepository.findById(messageId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MESSAGE_NOT_FOUND", "Message not found"));

        if (message.getDeletedAt() != null) {
            return; // Idempotent
        }

        boolean isSender = message.getSender().getId().equals(userId);
        boolean isGroupAdmin = false;
        if (!isSender && message.getConversation().getType() == ConversationType.GROUP) {
            Optional<ConversationMember> cm = conversationMemberRepository
                .findByConversationIdAndUserIdAndLeftAtIsNull(message.getConversation().getId(), userId);
            if (cm.isPresent() && cm.get().getRole() == MemberRole.ADMIN) {
                isGroupAdmin = true;
            }
        }

        if (!isSender && !isGroupAdmin) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only the sender or a group admin can delete this message");
        }

        // Soft delete message
        message.setDeletedAt(Instant.now());
        message.setContent(null);
        messageRepository.save(message);

        // Delete attachments from storage and repository
        List<Attachment> attachments = attachmentRepository.findByMessageId(messageId);
        for (Attachment att : attachments) {
            try {
                storageService.delete(att.getStorageKey());
                attachmentRepository.delete(att);
            } catch (Exception e) {
                // Ignore cleanup errors
            }
        }

        // Broadcast message.deleted to all members
        Map<String, Object> payload = Map.of(
            "conversationId", message.getConversation().getId(),
            "messageId", message.getId()
        );
        eventPublisher.sendToConversationMembers(message.getConversation().getId(), "message.deleted", payload);
    }

    public MessageDto toggleReaction(Long messageId, Long userId, String emoji) {
        if (emoji == null || emoji.trim().isEmpty() || emoji.length() > 32) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Valid emoji is required");
        }
        String cleanEmoji = emoji.trim();

        Message message = messageRepository.findById(messageId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MESSAGE_NOT_FOUND", "Message not found"));

        boolean isMember = conversationMemberRepository.existsByConversationIdAndUserIdAndLeftAtIsNull(
            message.getConversation().getId(), userId);
        if (!isMember) {
            throw new ApiException(HttpStatus.NOT_FOUND, "MESSAGE_NOT_FOUND", "Message not found");
        }

        if (message.getDeletedAt() != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "MESSAGE_DELETED", "Cannot react to a deleted message");
        }

        Optional<Reaction> existing = reactionRepository.findByMessageIdAndUserIdAndEmoji(messageId, userId, cleanEmoji);
        if (existing.isPresent()) {
            reactionRepository.delete(existing.get());
        } else {
            User user = userRepository.findById(userId).orElseThrow();
            Reaction reaction = Reaction.builder()
                .message(message)
                .user(user)
                .emoji(cleanEmoji)
                .build();
            reactionRepository.save(reaction);
        }

        // Broadcast message.updated to active members with viewer-specific reactedByMe
        List<ConversationMember> members = conversationMemberRepository.findByConversationIdAndLeftAtIsNull(message.getConversation().getId());
        for (ConversationMember m : members) {
            MessageDto memberDto = toDto(message, m.getUser().getId());
            eventPublisher.sendToUser(m.getUser().getId(), "message.updated", memberDto);
        }

        return toDto(message, userId);
    }

    @Transactional(readOnly = true)
    public List<MessageDto> getHistory(Long conversationId, Long userId, Long before, Long after, int size) {
        conversationAccessService.requireMember(conversationId, userId);

        int limit = Math.min(Math.max(size <= 0 ? 30 : size, 1), 100);
        Pageable pageable = PageRequest.of(0, limit);

        List<Message> messages;
        if (before != null) {
            messages = messageRepository.findBefore(conversationId, before, pageable);
        } else if (after != null) {
            messages = messageRepository.findAfter(conversationId, after, pageable);
        } else {
            messages = messageRepository.findLatest(conversationId, pageable);
        }

        if (messages.isEmpty()) {
            return List.of();
        }

        List<Long> messageIds = messages.stream().map(Message::getId).toList();
        Map<Long, List<MessageReceipt>> receiptsByMsgId = messageReceiptRepository.findByMessageIds(messageIds).stream()
            .collect(Collectors.groupingBy(r -> r.getMessage().getId()));
        List<ConversationMember> activeMembers = conversationMemberRepository.findByConversationIdAndLeftAtIsNull(conversationId);

        Map<Long, List<AttachmentDto>> attachmentsByMsgId = attachmentRepository.findByMessageIds(messageIds).stream()
            .collect(Collectors.groupingBy(
                a -> a.getMessage().getId(),
                Collectors.mapping(this::toAttachmentDto, Collectors.toList())
            ));

        Map<Long, List<Reaction>> reactionsByMsgId = reactionRepository.findByMessageIds(messageIds).stream()
            .collect(Collectors.groupingBy(r -> r.getMessage().getId()));

        return messages.stream()
            .map(m -> toDtoWithStatus(
                m,
                receiptService.computeMessageStatus(m, activeMembers, receiptsByMsgId),
                attachmentsByMsgId.getOrDefault(m.getId(), List.of()),
                aggregateReactions(reactionsByMsgId.getOrDefault(m.getId(), List.of()), userId)
            ))
            .toList();
    }

    @Transactional(readOnly = true)
    public List<MessageDto> searchMessages(Long userId, String query, Long conversationId, int page, int size) {
        if (query == null || query.trim().isEmpty()) {
            return List.of();
        }
        if (conversationId != null) {
            conversationAccessService.requireMember(conversationId, userId);
        }

        String pattern = "%" + query.trim().toLowerCase() + "%";
        int pageNum = Math.max(0, page);
        int pageSize = Math.min(Math.max(size <= 0 ? 20 : size, 1), 100);
        Pageable pageable = PageRequest.of(pageNum, pageSize);

        List<Message> messages;
        if (conversationId != null) {
            messages = messageRepository.searchInConversation(conversationId, userId, pattern, pageable);
        } else {
            messages = messageRepository.searchAcrossConversations(userId, pattern, pageable);
        }

        if (messages.isEmpty()) {
            return List.of();
        }

        List<Long> messageIds = messages.stream().map(Message::getId).toList();
        Map<Long, List<MessageReceipt>> receiptsByMsgId = messageReceiptRepository.findByMessageIds(messageIds).stream()
            .collect(Collectors.groupingBy(r -> r.getMessage().getId()));
        Map<Long, List<AttachmentDto>> attachmentsByMsgId = attachmentRepository.findByMessageIds(messageIds).stream()
            .collect(Collectors.groupingBy(
                a -> a.getMessage().getId(),
                Collectors.mapping(this::toAttachmentDto, Collectors.toList())
            ));
        Map<Long, List<Reaction>> reactionsByMsgId = reactionRepository.findByMessageIds(messageIds).stream()
            .collect(Collectors.groupingBy(r -> r.getMessage().getId()));

        return messages.stream()
            .map(m -> {
                List<ConversationMember> activeMembers = conversationMemberRepository
                    .findByConversationIdAndLeftAtIsNull(m.getConversation().getId());
                return toDtoWithStatus(
                    m,
                    receiptService.computeMessageStatus(m, activeMembers, receiptsByMsgId),
                    attachmentsByMsgId.getOrDefault(m.getId(), List.of()),
                    aggregateReactions(reactionsByMsgId.getOrDefault(m.getId(), List.of()), userId)
                );
            })
            .toList();
    }

    public MessageDto toDto(Message message) {
        return toDto(message, null);
    }

    public MessageDto toDto(Message message, Long viewerUserId) {
        List<ConversationMember> activeMembers = conversationMemberRepository.findByConversationIdAndLeftAtIsNull(message.getConversation().getId());
        List<MessageReceipt> receipts = messageReceiptRepository.findByMessageId(message.getId());
        String status = receiptService.computeMessageStatus(message, activeMembers, Map.of(message.getId(), receipts));
        List<AttachmentDto> attachments = attachmentRepository.findByMessageId(message.getId()).stream()
            .map(this::toAttachmentDto)
            .toList();
        List<Reaction> reactions = reactionRepository.findByMessageId(message.getId());
        List<ReactionDto> reactionDtos = aggregateReactions(reactions, viewerUserId);

        return toDtoWithStatus(message, status, attachments, reactionDtos);
    }

    public MessageDto toDtoWithStatus(Message message, String status) {
        return toDto(message, null);
    }

    public MessageDto toDtoWithStatus(Message message, String status, List<AttachmentDto> attachments) {
        return toDtoWithStatus(message, status, attachments, List.of());
    }

    public MessageDto toDtoWithStatus(
            Message message,
            String status,
            List<AttachmentDto> attachments,
            List<ReactionDto> reactions) {
        ReplySnippet replySnippet = null;
        if (message.getReplyTo() != null) {
            Message r = message.getReplyTo();
            String snippet = r.getDeletedAt() != null ? "This message was deleted" : r.getContent();
            if (snippet != null && snippet.length() > 60) {
                snippet = snippet.substring(0, 57) + "...";
            }
            replySnippet = new ReplySnippet(r.getId(), r.getSender().getName(), snippet);
        }

        return new MessageDto(
            message.getId(),
            message.getConversation().getId(),
            userService.toUserSummary(message.getSender()),
            message.getClientMessageId(),
            message.getDeletedAt() != null ? null : message.getContent(),
            message.getMessageType(),
            replySnippet,
            attachments != null ? attachments : List.of(),
            reactions != null ? reactions : List.of(),
            status != null ? status : "SENT",
            message.getCreatedAt(),
            message.getEditedAt(),
            message.getDeletedAt() != null
        );
    }

    public List<ReactionDto> aggregateReactions(List<Reaction> reactions, Long viewerUserId) {
        if (reactions == null || reactions.isEmpty()) {
            return List.of();
        }
        Map<String, List<Reaction>> byEmoji = reactions.stream()
            .collect(Collectors.groupingBy(Reaction::getEmoji));

        return byEmoji.entrySet().stream()
            .map(e -> new ReactionDto(
                e.getKey(),
                e.getValue().size(),
                viewerUserId != null && e.getValue().stream().anyMatch(r -> r.getUser().getId().equals(viewerUserId))
            ))
            .toList();
    }

    public AttachmentDto toAttachmentDto(Attachment a) {
        return new AttachmentDto(
            a.getId(),
            a.getFileName(),
            a.getMimeType(),
            a.getFileSize() != null ? a.getFileSize() : 0L,
            "/api/attachments/" + a.getId(),
            a.getWidth(),
            a.getHeight()
        );
    }
}
