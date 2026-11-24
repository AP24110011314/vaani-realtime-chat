package com.vanni.service;

import com.vanni.dto.request.SendMessageRequest;
import com.vanni.dto.response.MessageDto;
import com.vanni.dto.response.ReplySnippet;
import com.vanni.entity.Conversation;
import com.vanni.entity.ConversationMember;
import com.vanni.entity.Message;
import com.vanni.entity.MessageType;
import com.vanni.exception.ApiException;
import com.vanni.repository.ConversationMemberRepository;
import com.vanni.repository.ConversationRepository;
import com.vanni.repository.MessageRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class MessageService {

    private final MessageRepository messageRepository;
    private final ConversationRepository conversationRepository;
    private final ConversationMemberRepository conversationMemberRepository;
    private final ConversationAccessService conversationAccessService;
    private final UserService userService;
    private final EventPublisher eventPublisher;

    public MessageService(
            MessageRepository messageRepository,
            ConversationRepository conversationRepository,
            ConversationMemberRepository conversationMemberRepository,
            ConversationAccessService conversationAccessService,
            UserService userService,
            EventPublisher eventPublisher) {
        this.messageRepository = messageRepository;
        this.conversationRepository = conversationRepository;
        this.conversationMemberRepository = conversationMemberRepository;
        this.conversationAccessService = conversationAccessService;
        this.userService = userService;
        this.eventPublisher = eventPublisher;
    }

    public MessageDto send(Long conversationId, Long senderId, SendMessageRequest req) {
        if (req.content() == null || req.content().trim().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Message content cannot be blank");
        }
        String content = req.content().trim();
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

        Message replyTo = null;
        if (req.replyToId() != null) {
            replyTo = messageRepository.findByIdAndConversationId(req.replyToId(), conversationId)
                .orElse(null);
        }

        Message message = new Message();
        message.setConversation(conv);
        message.setSender(member.getUser());
        message.setClientMessageId(req.clientMessageId() != null ? req.clientMessageId().trim() : null);
        message.setContent(content);
        message.setMessageType(MessageType.TEXT);
        message.setReplyTo(replyTo);

        message = messageRepository.save(message);

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

        return messages.stream().map(this::toDto).toList();
    }

    public MessageDto toDto(Message message) {
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
            List.of(),
            List.of(),
            "SENT",
            message.getCreatedAt(),
            message.getEditedAt(),
            message.getDeletedAt() != null
        );
    }
}
