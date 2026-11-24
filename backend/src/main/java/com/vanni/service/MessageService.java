package com.vanni.service;

import com.vanni.dto.request.SendMessageRequest;
import com.vanni.dto.response.AttachmentDto;
import com.vanni.dto.response.MessageDto;
import com.vanni.dto.response.ReplySnippet;
import com.vanni.entity.Attachment;
import com.vanni.entity.Conversation;
import com.vanni.entity.ConversationMember;
import com.vanni.entity.Message;
import com.vanni.entity.MessageReceipt;
import com.vanni.entity.MessageType;
import com.vanni.exception.ApiException;
import com.vanni.repository.AttachmentRepository;
import com.vanni.repository.ConversationMemberRepository;
import com.vanni.repository.ConversationRepository;
import com.vanni.repository.MessageReceiptRepository;
import com.vanni.repository.MessageRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    public MessageService(
            MessageRepository messageRepository,
            ConversationRepository conversationRepository,
            ConversationMemberRepository conversationMemberRepository,
            ConversationAccessService conversationAccessService,
            UserService userService,
            EventPublisher eventPublisher,
            ReceiptService receiptService,
            MessageReceiptRepository messageReceiptRepository,
            AttachmentRepository attachmentRepository) {
        this.messageRepository = messageRepository;
        this.conversationRepository = conversationRepository;
        this.conversationMemberRepository = conversationMemberRepository;
        this.conversationAccessService = conversationAccessService;
        this.userService = userService;
        this.eventPublisher = eventPublisher;
        this.receiptService = receiptService;
        this.messageReceiptRepository = messageReceiptRepository;
        this.attachmentRepository = attachmentRepository;
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

        // Idempotency check via clientMessageId
        if (req.clientMessageId() != null && !req.clientMessageId().isBlank()) {
            Optional<Message> existing = messageRepository.findBySenderIdAndClientMessageId(senderId, req.clientMessageId().trim());
            if (existing.isPresent()) {
                MessageDto dto = toDto(existing.get());
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
                .orElse(null);
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

        MessageDto dto = toDto(message);
        eventPublisher.sendToConversationMembers(conversationId, "message.created", dto);

        return dto;
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

        return messages.stream()
            .map(m -> toDtoWithStatus(
                m,
                receiptService.computeMessageStatus(m, activeMembers, receiptsByMsgId),
                attachmentsByMsgId.getOrDefault(m.getId(), List.of())
            ))
            .toList();
    }

    public MessageDto toDto(Message message) {
        List<ConversationMember> activeMembers = conversationMemberRepository.findByConversationIdAndLeftAtIsNull(message.getConversation().getId());
        List<MessageReceipt> receipts = messageReceiptRepository.findByMessageId(message.getId());
        String status = receiptService.computeMessageStatus(message, activeMembers, Map.of(message.getId(), receipts));
        List<AttachmentDto> attachments = attachmentRepository.findByMessageId(message.getId()).stream()
            .map(this::toAttachmentDto)
            .toList();
        return toDtoWithStatus(message, status, attachments);
    }

    public MessageDto toDtoWithStatus(Message message, String status) {
        List<AttachmentDto> attachments = attachmentRepository.findByMessageId(message.getId()).stream()
            .map(this::toAttachmentDto)
            .toList();
        return toDtoWithStatus(message, status, attachments);
    }

    public MessageDto toDtoWithStatus(Message message, String status, List<AttachmentDto> attachments) {
        ReplySnippet replySnippet = null;
        if (message.getReplyTo() != null) {
            Message r = message.getReplyTo();
            String snippet = r.getContent();
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
            List.of(),
            status != null ? status : "SENT",
            message.getCreatedAt(),
            message.getEditedAt(),
            message.getDeletedAt() != null
        );
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
