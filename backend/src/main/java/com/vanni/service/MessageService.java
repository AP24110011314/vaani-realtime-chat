package com.vanni.service;

import com.vanni.dto.request.SendMessageRequest;
import com.vanni.dto.response.AttachmentDto;
import com.vanni.dto.response.MentionDto;
import com.vanni.dto.response.MessageDto;
import com.vanni.dto.response.ReactionDto;
import com.vanni.dto.response.ReplySnippet;
import com.vanni.entity.Attachment;
import com.vanni.entity.Conversation;
import com.vanni.entity.ConversationMember;
import com.vanni.entity.ConversationType;
import com.vanni.entity.MemberRole;
import com.vanni.entity.Message;
import com.vanni.entity.MessageMention;
import com.vanni.entity.MessageReceipt;
import com.vanni.entity.MessageType;
import com.vanni.entity.Reaction;
import com.vanni.entity.User;
import com.vanni.exception.ApiException;
import com.vanni.repository.AttachmentRepository;
import com.vanni.repository.ConversationMemberRepository;
import com.vanni.repository.ConversationRepository;
import com.vanni.repository.MessageMentionRepository;
import com.vanni.repository.MessageReceiptRepository;
import com.vanni.repository.MessageRepository;
import com.vanni.repository.ReactionRepository;
import com.vanni.repository.UserRepository;
import com.vanni.security.RateLimiterService;
import com.vanni.storage.StorageService;
import com.vanni.util.MentionParser;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
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
    private final MessageMentionRepository messageMentionRepository;
    private final RateLimiterService rateLimiterService;

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
            com.vanni.repository.BlockRepository blockRepository,
            MessageMentionRepository messageMentionRepository,
            RateLimiterService rateLimiterService) {
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
        this.messageMentionRepository = messageMentionRepository;
        this.rateLimiterService = rateLimiterService;
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
        List<ConversationMember> activeMembers = conversationMemberRepository.findByConversationIdAndLeftAtIsNull(conversationId);

        if (conv.getType() == ConversationType.DIRECT) {
            for (ConversationMember cm : activeMembers) {
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

        // Parse mentions for group conversations (server is the authority)
        MentionParser.ParseResult parseResult = new MentionParser.ParseResult(List.of(), false);
        if (conv.getType() == ConversationType.GROUP && !content.isEmpty()) {
            Set<Long> activeMemberIds = activeMembers.stream()
                .map(cm -> cm.getUser().getId())
                .collect(Collectors.toSet());
            boolean isAdmin = member.getRole() == MemberRole.ADMIN;
            parseResult = MentionParser.parse(content, activeMemberIds, isAdmin);
            if (parseResult.mentionsAll() && !rateLimiterService.tryConsumeMentionAll(conversationId)) {
                throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "You can only mention @all once every 5 minutes");
            }
        }

        boolean requestedVoice = req.type() == MessageType.VOICE;
        boolean hasVoiceAttachment = attachments.stream()
            .anyMatch(a -> a.getDurationMs() != null || (a.getMimeType() != null && a.getMimeType().startsWith("audio/")));

        MessageType messageType = MessageType.TEXT;
        if (requestedVoice || hasVoiceAttachment) {
            if (!content.isEmpty()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Voice messages cannot contain text");
            }
            if (attachments.size() != 1
                    || attachments.get(0).getDurationMs() == null
                    || attachments.get(0).getMimeType() == null
                    || !attachments.get(0).getMimeType().startsWith("audio/")) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Voice messages require exactly one voice attachment");
            }
            messageType = MessageType.VOICE;
        } else if (!attachments.isEmpty()) {
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
        message.setMentionsAll(parseResult.mentionsAll());

        message = messageRepository.save(message);

        // Persist validated mention rows
        Map<Long, User> memberUsersById = activeMembers.stream()
            .collect(Collectors.toMap(cm -> cm.getUser().getId(), ConversationMember::getUser, (a, b) -> a));
        List<MessageMention> savedMentions = new java.util.ArrayList<>();
        for (Long mentionedId : parseResult.userIds()) {
            User targetUser = memberUsersById.get(mentionedId);
            if (targetUser != null) {
                savedMentions.add(messageMentionRepository.save(new MessageMention(message, targetUser)));
            }
        }

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

        List<AttachmentDto> attachmentDtos = attachments.stream().map(this::toAttachmentDto).toList();
        List<MentionDto> mentionDtos = toMentionDtos(savedMentions);
        Long replyToSenderId = replyTo != null ? replyTo.getSender().getId() : null;
        Set<Long> mentionedUserIds = savedMentions.stream().map(mm -> mm.getUser().getId()).collect(Collectors.toSet());

        MessageDto senderDto = null;
        for (ConversationMember cm : activeMembers) {
            Long recipientId = cm.getUser().getId();
            boolean isSender = recipientId.equals(senderId);
            boolean isMentioned = conv.getType() == ConversationType.GROUP
                && !isSender
                && (message.isMentionsAll() || mentionedUserIds.contains(recipientId));
            boolean isReplyToMe = !isSender && replyToSenderId != null && replyToSenderId.equals(recipientId);
            boolean notify = NotificationPolicy.shouldNotify(cm, isSender, isMentioned, isReplyToMe);

            MessageDto recipientDto = toDtoWithStatus(
                message,
                "SENT",
                attachmentDtos,
                List.of(),
                mentionDtos,
                isMentioned,
                notify
            );
            if (isSender) {
                senderDto = recipientDto;
            }
            eventPublisher.sendToUser(recipientId, "message.created", recipientDto);
        }

        return senderDto != null ? senderDto : toDtoWithStatus(message, "SENT", attachmentDtos, List.of(), mentionDtos, false, false);
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

        ConversationMember senderMember = conversationAccessService.requireMember(message.getConversation().getId(), userId);

        if (!message.getSender().getId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only the sender can edit this message");
        }

        if (message.getDeletedAt() != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "MESSAGE_DELETED", "Cannot edit a deleted message");
        }
        if (message.getMessageType() == MessageType.VOICE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_OPERATION", "Voice messages cannot be edited");
        }

        if (Duration.between(message.getCreatedAt(), Instant.now()).toMinutes() > 15) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "EDIT_WINDOW_EXPIRED", "Message can only be edited within 15 minutes");
        }

        Long convId = message.getConversation().getId();
        List<ConversationMember> members = conversationMemberRepository.findByConversationIdAndLeftAtIsNull(convId);

        boolean hadMentionsAll = message.isMentionsAll();
        MentionParser.ParseResult parseResult = new MentionParser.ParseResult(List.of(), false);
        if (message.getConversation().getType() == ConversationType.GROUP) {
            Set<Long> activeMemberIds = members.stream().map(cm -> cm.getUser().getId()).collect(Collectors.toSet());
            boolean isAdmin = senderMember.getRole() == MemberRole.ADMIN;
            parseResult = MentionParser.parse(trimmed, activeMemberIds, isAdmin);
            if (parseResult.mentionsAll() && !hadMentionsAll && !rateLimiterService.tryConsumeMentionAll(convId)) {
                throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "You can only mention @all once every 5 minutes");
            }
        }

        message.setContent(trimmed);
        message.setMentionsAll(parseResult.mentionsAll());
        message.setEditedAt(Instant.now());
        message = messageRepository.save(message);

        // Rebuild message_mentions without re-notifying
        messageMentionRepository.deleteByMessageId(messageId);
        messageMentionRepository.flush();
        Map<Long, User> memberUsersById = members.stream()
            .collect(Collectors.toMap(cm -> cm.getUser().getId(), ConversationMember::getUser, (a, b) -> a));
        for (Long mentionedId : parseResult.userIds()) {
            User targetUser = memberUsersById.get(mentionedId);
            if (targetUser != null) {
                messageMentionRepository.save(new MessageMention(message, targetUser));
            }
        }

        // Broadcast message.updated to all active members (notify=false to prevent re-notifying on edit)
        for (ConversationMember m : members) {
            MessageDto memberDto = toDto(message, m.getUser().getId(), false);
            eventPublisher.sendToUser(m.getUser().getId(), "message.updated", memberDto);
        }

        return toDto(message, userId, false);
    }

    public void deleteMessage(Long messageId, Long userId) {
        Message message = messageRepository.findById(messageId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MESSAGE_NOT_FOUND", "Message not found"));

        ConversationMember cm = conversationAccessService.requireMember(message.getConversation().getId(), userId);

        if (message.getDeletedAt() != null) {
            return; // Idempotent
        }

        boolean isSender = message.getSender().getId().equals(userId);
        boolean isGroupAdmin = message.getConversation().getType() == ConversationType.GROUP
            && cm.getRole() == MemberRole.ADMIN;

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

        Map<Long, List<MentionDto>> mentionsByMsgId = messageMentionRepository.findByMessageIdsWithUser(messageIds).stream()
            .collect(Collectors.groupingBy(
                mm -> mm.getMessage().getId(),
                Collectors.mapping(mm -> new MentionDto(mm.getUser().getId(), mm.getUser().getName()), Collectors.toList())
            ));

        return messages.stream()
            .map(m -> {
                List<MentionDto> msgMentions = mentionsByMsgId.getOrDefault(m.getId(), List.of());
                boolean mentionsMe = isMentionedViewer(m, msgMentions, userId);
                return toDtoWithStatus(
                    m,
                    receiptService.computeMessageStatus(m, activeMembers, receiptsByMsgId),
                    attachmentsByMsgId.getOrDefault(m.getId(), List.of()),
                    aggregateReactions(reactionsByMsgId.getOrDefault(m.getId(), List.of()), userId),
                    msgMentions,
                    mentionsMe,
                    false
                );
            })
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

        String trimmedLower = query.trim().toLowerCase();
        String pattern = "%" + trimmedLower + "%";
        boolean matchAll = "all".contains(trimmedLower) || "@all".contains(trimmedLower);
        int pageNum = Math.max(0, page);
        int pageSize = Math.min(Math.max(size <= 0 ? 20 : size, 1), 100);
        Pageable pageable = PageRequest.of(pageNum, pageSize);

        List<Message> messages;
        if (conversationId != null) {
            messages = messageRepository.searchInConversation(conversationId, userId, pattern, matchAll, pageable);
        } else {
            messages = messageRepository.searchAcrossConversations(userId, pattern, matchAll, pageable);
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
        Map<Long, List<MentionDto>> mentionsByMsgId = messageMentionRepository.findByMessageIdsWithUser(messageIds).stream()
            .collect(Collectors.groupingBy(
                mm -> mm.getMessage().getId(),
                Collectors.mapping(mm -> new MentionDto(mm.getUser().getId(), mm.getUser().getName()), Collectors.toList())
            ));

        return messages.stream()
            .map(m -> {
                List<ConversationMember> activeMembers = conversationMemberRepository
                    .findByConversationIdAndLeftAtIsNull(m.getConversation().getId());
                List<MentionDto> msgMentions = mentionsByMsgId.getOrDefault(m.getId(), List.of());
                return toDtoWithStatus(
                    m,
                    receiptService.computeMessageStatus(m, activeMembers, receiptsByMsgId),
                    attachmentsByMsgId.getOrDefault(m.getId(), List.of()),
                    aggregateReactions(reactionsByMsgId.getOrDefault(m.getId(), List.of()), userId),
                    msgMentions,
                    isMentionedViewer(m, msgMentions, userId),
                    false
                );
            })
            // Ensure search matches rendered mention names (@Name), never raw <@id> token strings
            .filter(dto -> dto.previewText() != null && dto.previewText().toLowerCase().contains(trimmedLower))
            .toList();
    }

    public MessageDto toDto(Message message) {
        return toDto(message, null, false);
    }

    public MessageDto toDto(Message message, Long viewerUserId) {
        return toDto(message, viewerUserId, false);
    }

    public MessageDto toDto(Message message, Long viewerUserId, boolean notify) {
        List<ConversationMember> activeMembers = conversationMemberRepository.findByConversationIdAndLeftAtIsNull(message.getConversation().getId());
        List<MessageReceipt> receipts = messageReceiptRepository.findByMessageId(message.getId());
        String status = receiptService.computeMessageStatus(message, activeMembers, Map.of(message.getId(), receipts));
        List<AttachmentDto> attachments = attachmentRepository.findByMessageId(message.getId()).stream()
            .map(this::toAttachmentDto)
            .toList();
        List<Reaction> reactions = reactionRepository.findByMessageId(message.getId());
        List<ReactionDto> reactionDtos = aggregateReactions(reactions, viewerUserId);
        List<MentionDto> mentions = toMentionDtos(messageMentionRepository.findByMessageIdWithUser(message.getId()));
        boolean mentionsMe = isMentionedViewer(message, mentions, viewerUserId);

        return toDtoWithStatus(message, status, attachments, reactionDtos, mentions, mentionsMe, notify);
    }

    public MessageDto toDtoWithStatus(Message message, String status) {
        return toDto(message, null, false);
    }

    public MessageDto toDtoWithStatus(Message message, String status, List<AttachmentDto> attachments) {
        return toDtoWithStatus(message, status, attachments, List.of());
    }

    public MessageDto toDtoWithStatus(
            Message message,
            String status,
            List<AttachmentDto> attachments,
            List<ReactionDto> reactions) {
        return toDtoWithStatus(message, status, attachments, reactions, List.of(), false, false);
    }

    public MessageDto toDtoWithStatus(
            Message message,
            String status,
            List<AttachmentDto> attachments,
            List<ReactionDto> reactions,
            List<MentionDto> mentions,
            boolean mentionsMe,
            boolean notify) {
        List<MentionDto> safeMentions = mentions != null ? mentions : List.of();
        Map<Long, String> namesById = new HashMap<>();
        for (MentionDto md : safeMentions) {
            namesById.put(md.userId(), md.name());
        }

        ReplySnippet replySnippet = null;
        if (message.getReplyTo() != null) {
            Message r = message.getReplyTo();
            String snippet;
            if (r.getDeletedAt() != null) {
                snippet = "This message was deleted";
            } else if (r.getMessageType() == MessageType.VOICE) {
                List<Attachment> replyAtts = attachmentRepository.findByMessageId(r.getId());
                Integer durMs = replyAtts.isEmpty() ? null : replyAtts.get(0).getDurationMs();
                snippet = formatVoicePreview(durMs);
            } else {
                List<MessageMention> replyMentions = messageMentionRepository.findByMessageIdWithUser(r.getId());
                Map<Long, String> replyNames = replyMentions.stream()
                    .collect(Collectors.toMap(mm -> mm.getUser().getId(), mm -> mm.getUser().getName(), (a, b) -> a));
                snippet = MentionParser.renderDisplayText(r.getContent(), replyNames, r.isMentionsAll());
            }
            if (snippet != null && snippet.length() > 60) {
                snippet = snippet.substring(0, 57) + "...";
            }
            replySnippet = new ReplySnippet(r.getId(), r.getSender().getName(), snippet);
        }

        String rawContent = message.getDeletedAt() != null ? null : message.getContent();
        String previewText;
        if (message.getDeletedAt() != null) {
            previewText = null;
        } else if (message.getMessageType() == MessageType.VOICE) {
            Integer durMs = (attachments != null && !attachments.isEmpty()) ? attachments.get(0).durationMs() : null;
            previewText = formatVoicePreview(durMs);
        } else {
            previewText = rawContent != null
                ? MentionParser.renderDisplayText(rawContent, namesById, message.isMentionsAll())
                : null;
        }

        return new MessageDto(
            message.getId(),
            message.getConversation().getId(),
            userService.toUserSummary(message.getSender()),
            message.getClientMessageId(),
            rawContent,
            message.getMessageType(),
            replySnippet,
            attachments != null ? attachments : List.of(),
            reactions != null ? reactions : List.of(),
            status != null ? status : "SENT",
            message.getCreatedAt(),
            message.getEditedAt(),
            message.getDeletedAt() != null,
            safeMentions,
            message.isMentionsAll(),
            mentionsMe,
            notify,
            previewText
        );
    }

    private List<MentionDto> toMentionDtos(List<MessageMention> mentions) {
        if (mentions == null || mentions.isEmpty()) {
            return List.of();
        }
        return mentions.stream()
            .map(mm -> new MentionDto(mm.getUser().getId(), mm.getUser().getName()))
            .toList();
    }

    private boolean isMentionedViewer(Message message, List<MentionDto> mentions, Long viewerUserId) {
        if (viewerUserId == null || message.getDeletedAt() != null) {
            return false;
        }
        if (message.getConversation().getType() != ConversationType.GROUP) {
            return false;
        }
        if (message.getSender().getId().equals(viewerUserId)) {
            return false;
        }
        if (message.isMentionsAll()) {
            return true;
        }
        return mentions != null && mentions.stream().anyMatch(m -> m.userId().equals(viewerUserId));
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

    private static String formatVoicePreview(Integer durationMs) {
        int totalSec = durationMs != null ? Math.max(0, Math.round(durationMs / 1000.0f)) : 0;
        return String.format("Voice message %d:%02d", totalSec / 60, totalSec % 60);
    }

    public AttachmentDto toAttachmentDto(Attachment a) {
        return new AttachmentDto(
            a.getId(),
            a.getFileName(),
            a.getMimeType(),
            a.getFileSize() != null ? a.getFileSize() : 0L,
            "/api/attachments/" + a.getId(),
            a.getWidth(),
            a.getHeight(),
            a.getDurationMs(),
            AttachmentService.decodeWaveformInts(a.getWaveform())
        );
    }
}
