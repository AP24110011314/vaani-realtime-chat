package com.vanni.service;

import com.vanni.dto.request.CreateScheduledMessageRequest;
import com.vanni.dto.request.SendMessageRequest;
import com.vanni.dto.request.UpdateScheduledMessageRequest;
import com.vanni.dto.response.AttachmentDto;
import com.vanni.dto.response.MessageDto;
import com.vanni.dto.response.ScheduledMessageDto;
import com.vanni.entity.*;
import com.vanni.exception.ApiException;
import com.vanni.repository.*;
import com.vanni.util.MentionParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ScheduledMessageService {

    private static final Logger log = LoggerFactory.getLogger(ScheduledMessageService.class);
    private static final int MAX_ATTEMPTS = 3;

    private final ScheduledMessageRepository scheduledMessageRepository;
    private final ConversationAccessService conversationAccessService;
    private final ConversationMemberRepository conversationMemberRepository;
    private final BlockRepository blockRepository;
    private final MessageRepository messageRepository;
    private final AttachmentRepository attachmentRepository;
    private final AttachmentService attachmentService;
    private final MessageService messageService;
    private final EventPublisher eventPublisher;
    private final TransactionTemplate requiresNewTx;

    @Value("${app.schedule.min-lead-seconds:60}")
    private long minLeadSeconds;

    @Value("${app.schedule.max-days:365}")
    private long maxDays;

    @Value("${app.schedule.max-pending-per-user:50}")
    private int maxPendingPerUser;

    public ScheduledMessageService(
            ScheduledMessageRepository scheduledMessageRepository,
            ConversationAccessService conversationAccessService,
            ConversationMemberRepository conversationMemberRepository,
            BlockRepository blockRepository,
            MessageRepository messageRepository,
            AttachmentRepository attachmentRepository,
            AttachmentService attachmentService,
            MessageService messageService,
            EventPublisher eventPublisher,
            PlatformTransactionManager transactionManager) {
        this.scheduledMessageRepository = scheduledMessageRepository;
        this.conversationAccessService = conversationAccessService;
        this.conversationMemberRepository = conversationMemberRepository;
        this.blockRepository = blockRepository;
        this.messageRepository = messageRepository;
        this.attachmentRepository = attachmentRepository;
        this.attachmentService = attachmentService;
        this.messageService = messageService;
        this.eventPublisher = eventPublisher;
        this.requiresNewTx = new TransactionTemplate(transactionManager);
        this.requiresNewTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Transactional
    public ScheduledMessageDto create(Long conversationId, Long senderId, CreateScheduledMessageRequest req) {
        String content = req.content() != null ? req.content().trim() : "";
        List<Long> attachmentIds = req.attachmentIds() != null ? req.attachmentIds() : List.of();

        validateContent(content, !attachmentIds.isEmpty());
        validateScheduledFor(req.scheduledFor());

        ConversationMember member = conversationAccessService.requireMember(conversationId, senderId);
        Conversation conv = member.getConversation();

        if (conv.getType() == ConversationType.DIRECT) {
            List<ConversationMember> activeMembers = conversationMemberRepository.findByConversationIdAndLeftAtIsNull(conversationId);
            for (ConversationMember cm : activeMembers) {
                if (!cm.getUser().getId().equals(senderId) && blockRepository.isBlockedEitherWay(senderId, cm.getUser().getId())) {
                    throw new ApiException(HttpStatus.FORBIDDEN, "USER_BLOCKED", "Cannot schedule message to a blocked user");
                }
            }
        }

        String clientMessageId = (req.clientMessageId() != null && !req.clientMessageId().isBlank())
            ? req.clientMessageId().trim()
            : UUID.randomUUID().toString();

        Optional<ScheduledMessage> existing = scheduledMessageRepository.findBySenderIdAndClientMessageId(senderId, clientMessageId);
        if (existing.isPresent()) {
            return toDto(existing.get(), attachmentRepository.findByScheduledMessageId(existing.get().getId()), senderId);
        }

        long pendingCount = scheduledMessageRepository.countBySenderIdAndStatus(senderId, ScheduledMessageStatus.PENDING);
        if (pendingCount >= maxPendingPerUser) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "SCHEDULE_LIMIT_REACHED",
                "You can have at most " + maxPendingPerUser + " pending scheduled messages");
        }

        List<Attachment> attachments = List.of();
        if (!attachmentIds.isEmpty()) {
            attachments = attachmentRepository.findAllById(attachmentIds);
            if (attachments.size() != attachmentIds.size()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "ATTACHMENT_NOT_FOUND", "One or more attachments not found");
            }
            for (Attachment a : attachments) {
                if (!a.getUploader().getId().equals(senderId)) {
                    throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Cannot schedule attachment uploaded by another user");
                }
                if (a.getMessage() != null || a.getScheduledMessage() != null) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "ATTACHMENT_ALREADY_ATTACHED", "Attachment is already in use");
                }
                if (a.getDurationMs() != null || (a.getMimeType() != null && a.getMimeType().startsWith("audio/"))) {
                    if (!content.isEmpty() || attachments.size() != 1) {
                        throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Voice attachments cannot be combined with text or other files");
                    }
                }
            }
        }

        Message replyTo = null;
        if (req.replyToId() != null) {
            replyTo = messageRepository.findByIdAndConversationId(req.replyToId(), conversationId)
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "INVALID_REPLY", "Reply target message not found in this conversation"));
        }

        ScheduledMessage sm = ScheduledMessage.builder()
            .conversation(conv)
            .sender(member.getUser())
            .clientMessageId(clientMessageId)
            .content(content.isEmpty() ? null : content)
            .replyTo(replyTo)
            .scheduledFor(req.scheduledFor())
            .status(ScheduledMessageStatus.PENDING)
            .attempts(0)
            .build();
        sm = scheduledMessageRepository.save(sm);

        for (Attachment a : attachments) {
            a.setScheduledMessage(sm);
            attachmentRepository.save(a);
        }

        ScheduledMessageDto dto = toDto(sm, attachments, senderId);
        eventPublisher.sendToUser(senderId, "scheduled.created", dto);
        return dto;
    }

    @Transactional(readOnly = true)
    public List<ScheduledMessageDto> list(Long senderId, String statusParam, Long conversationId) {
        ScheduledMessageStatus statusFilter = ScheduledMessageStatus.PENDING;
        if (statusParam != null && !statusParam.isBlank()) {
            if ("ALL".equalsIgnoreCase(statusParam.trim())) {
                statusFilter = null;
            } else {
                try {
                    statusFilter = ScheduledMessageStatus.valueOf(statusParam.trim().toUpperCase(Locale.ROOT));
                } catch (IllegalArgumentException ex) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Invalid scheduled message status");
                }
            }
        }

        List<ScheduledMessage> list = scheduledMessageRepository.findForSender(senderId, statusFilter, conversationId);
        if (list.isEmpty()) {
            return List.of();
        }

        List<Long> ids = list.stream().map(ScheduledMessage::getId).toList();
        Map<Long, List<Attachment>> attachmentsBySchedId = attachmentRepository.findByScheduledMessageIds(ids).stream()
            .filter(a -> a.getScheduledMessage() != null)
            .collect(Collectors.groupingBy(a -> a.getScheduledMessage().getId()));

        List<ScheduledMessageDto> result = new ArrayList<>(list.size());
        for (ScheduledMessage sm : list) {
            result.add(toDto(sm, attachmentsBySchedId.getOrDefault(sm.getId(), List.of()), senderId));
        }
        return result;
    }

    @Transactional
    public ScheduledMessageDto update(Long id, Long senderId, UpdateScheduledMessageRequest req) {
        ScheduledMessage sm = requireOwned(id, senderId);
        if (sm.getStatus() != ScheduledMessageStatus.PENDING) {
            throw new ApiException(HttpStatus.CONFLICT, "SCHEDULE_NOT_PENDING", "Only pending scheduled messages can be edited");
        }

        List<Attachment> attachments = attachmentRepository.findByScheduledMessageId(id);

        if (req.content() != null) {
            String trimmed = req.content().trim();
            validateContent(trimmed, !attachments.isEmpty());
            sm.setContent(trimmed.isEmpty() ? null : trimmed);
        }
        if (req.scheduledFor() != null) {
            validateScheduledFor(req.scheduledFor());
            sm.setScheduledFor(req.scheduledFor());
        }
        if (req.content() == null && req.scheduledFor() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "No fields to update");
        }

        sm = scheduledMessageRepository.save(sm);
        ScheduledMessageDto dto = toDto(sm, attachments, senderId);
        eventPublisher.sendToUser(senderId, "scheduled.updated", dto);
        return dto;
    }

    @Transactional
    public void cancel(Long id, Long senderId) {
        ScheduledMessage sm = requireOwned(id, senderId);
        if (sm.getStatus() == ScheduledMessageStatus.SENT) {
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_SENT", "Message was already sent");
        }
        if (sm.getStatus() == ScheduledMessageStatus.SENDING) {
            throw new ApiException(HttpStatus.CONFLICT, "CURRENTLY_SENDING", "Message is currently being delivered");
        }
        if (sm.getStatus() == ScheduledMessageStatus.CANCELLED) {
            return;
        }

        sm.setStatus(ScheduledMessageStatus.CANCELLED);
        scheduledMessageRepository.save(sm);

        List<Attachment> attachments = attachmentRepository.findByScheduledMessageId(id);
        for (Attachment a : attachments) {
            a.setScheduledMessage(null);
            attachmentRepository.save(a);
        }

        eventPublisher.sendToUser(senderId, "scheduled.cancelled", Map.of(
            "id", sm.getId(),
            "conversationId", sm.getConversation().getId()
        ));
    }

    public ScheduledMessageDto sendNow(Long id, Long senderId) {
        Boolean claimed = requiresNewTx.execute(status -> {
            ScheduledMessage sm = requireOwned(id, senderId);
            if (sm.getStatus() != ScheduledMessageStatus.PENDING) {
                throw new ApiException(HttpStatus.CONFLICT, "SCHEDULE_NOT_PENDING", "Scheduled message is no longer pending");
            }
            int updated = scheduledMessageRepository.claimSinglePending(id, Instant.now());
            return updated == 1;
        });

        if (!Boolean.TRUE.equals(claimed)) {
            throw new ApiException(HttpStatus.CONFLICT, "SCHEDULE_NOT_PENDING", "Scheduled message is already being processed");
        }

        return deliverSingle(id, true);
    }

    public int processDueMessages() {
        List<Long> dueIds = requiresNewTx.execute(status -> {
            Instant now = Instant.now();
            List<Long> ids = scheduledMessageRepository.findDueIdsForUpdateSkipLocked(now, 20);
            if (!ids.isEmpty()) {
                scheduledMessageRepository.transitionBatchStatus(ids, ScheduledMessageStatus.PENDING, ScheduledMessageStatus.SENDING, now);
            }
            return ids;
        });

        if (dueIds == null || dueIds.isEmpty()) {
            return 0;
        }

        for (Long id : dueIds) {
            deliverSingle(id, false);
        }
        return dueIds.size();
    }

    ScheduledMessageDto deliverSingle(Long scheduledId, boolean rethrowOnBusinessFailure) {
        try {
            MessageDto deliveredMessage = requiresNewTx.execute(status -> {
                ScheduledMessage sm = scheduledMessageRepository.findById(scheduledId)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SCHEDULE_NOT_FOUND", "Scheduled message not found"));

                List<Attachment> attachments = attachmentRepository.findByScheduledMessageId(scheduledId);
                List<Long> attachmentIds = attachments.stream().map(Attachment::getId).toList();
                boolean isVoice = attachments.size() == 1
                    && attachments.get(0).getDurationMs() != null
                    && attachments.get(0).getMimeType() != null
                    && attachments.get(0).getMimeType().startsWith("audio/");

                SendMessageRequest sendReq = new SendMessageRequest(
                    sm.getContent(),
                    sm.getClientMessageId(),
                    sm.getReplyTo() != null ? sm.getReplyTo().getId() : null,
                    attachmentIds,
                    isVoice ? MessageType.VOICE : null
                );

                MessageDto msgDto = messageService.sendScheduled(
                    sm.getConversation().getId(),
                    sm.getSender().getId(),
                    sendReq,
                    sm.getId()
                );

                sm.setStatus(ScheduledMessageStatus.SENT);
                sm.setAttempts((sm.getAttempts() != null ? sm.getAttempts() : 0) + 1);
                sm.setFailureReason(null);
                sm.setSentMessage(messageRepository.getReferenceById(msgDto.id()));
                scheduledMessageRepository.save(sm);

                return msgDto;
            });

            ScheduledMessageDto finalDto = requiresNewTx.execute(status -> {
                ScheduledMessage sm = scheduledMessageRepository.findById(scheduledId).orElseThrow();
                ScheduledMessageDto dto = toDto(sm, List.of(), sm.getSender().getId());
                eventPublisher.sendToUser(sm.getSender().getId(), "scheduled.sent", dto);
                return dto;
            });
            log.info("Delivered scheduled message id={} as messageId={}", scheduledId, deliveredMessage != null ? deliveredMessage.id() : null);
            return finalDto;
        } catch (ApiException ex) {
            log.warn("Permanent delivery failure for scheduled message id={}: {}", scheduledId, ex.getCode());
            markFailed(scheduledId, ex.getMessage());
            if (rethrowOnBusinessFailure) {
                throw ex;
            }
            return null;
        } catch (DataAccessException | IllegalStateException ex) {
            log.warn("Transient failure for scheduled message id={}: {}", scheduledId, ex.getMessage());
            handleRetryOrFail(scheduledId, "Temporary delivery error");
            if (rethrowOnBusinessFailure) {
                throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "DELIVERY_FAILED", "Failed to deliver scheduled message");
            }
            return null;
        } catch (Exception ex) {
            log.warn("Unexpected failure for scheduled message id={}: {}", scheduledId, ex.getMessage());
            markFailed(scheduledId, "Delivery failed");
            if (rethrowOnBusinessFailure) {
                throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "DELIVERY_FAILED", "Failed to deliver scheduled message");
            }
            return null;
        }
    }

    private void markFailed(Long scheduledId, String reason) {
        requiresNewTx.executeWithoutResult(status -> {
            scheduledMessageRepository.findById(scheduledId).ifPresent(sm -> {
                sm.setStatus(ScheduledMessageStatus.FAILED);
                sm.setAttempts((sm.getAttempts() != null ? sm.getAttempts() : 0) + 1);
                sm.setFailureReason(truncateReason(reason));
                scheduledMessageRepository.save(sm);

                List<Attachment> attachments = attachmentRepository.findByScheduledMessageId(scheduledId);
                for (Attachment a : attachments) {
                    a.setScheduledMessage(null);
                    attachmentRepository.save(a);
                }

                ScheduledMessageDto dto = toDto(sm, List.of(), sm.getSender().getId());
                eventPublisher.sendToUser(sm.getSender().getId(), "scheduled.failed", dto);
            });
        });
    }

    private void handleRetryOrFail(Long scheduledId, String reason) {
        requiresNewTx.executeWithoutResult(status -> {
            scheduledMessageRepository.findById(scheduledId).ifPresent(sm -> {
                int nextAttempts = (sm.getAttempts() != null ? sm.getAttempts() : 0) + 1;
                sm.setAttempts(nextAttempts);
                if (nextAttempts < MAX_ATTEMPTS) {
                    sm.setStatus(ScheduledMessageStatus.PENDING);
                    sm.setScheduledFor(Instant.now().plusSeconds(30));
                    sm.setFailureReason(truncateReason(reason));
                    scheduledMessageRepository.save(sm);
                } else {
                    sm.setStatus(ScheduledMessageStatus.FAILED);
                    sm.setFailureReason(truncateReason(reason));
                    scheduledMessageRepository.save(sm);

                    List<Attachment> attachments = attachmentRepository.findByScheduledMessageId(scheduledId);
                    for (Attachment a : attachments) {
                        a.setScheduledMessage(null);
                        attachmentRepository.save(a);
                    }

                    ScheduledMessageDto dto = toDto(sm, List.of(), sm.getSender().getId());
                    eventPublisher.sendToUser(sm.getSender().getId(), "scheduled.failed", dto);
                }
            });
        });
    }

    private ScheduledMessage requireOwned(Long id, Long senderId) {
        ScheduledMessage sm = scheduledMessageRepository.findById(id)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "SCHEDULE_NOT_FOUND", "Scheduled message not found"));
        if (!sm.getSender().getId().equals(senderId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Not allowed to access this scheduled message");
        }
        return sm;
    }

    private void validateContent(String trimmed, boolean hasAttachments) {
        if (trimmed.isEmpty() && !hasAttachments) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Message content cannot be blank when no attachments are present");
        }
        if (trimmed.length() > 4000) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Message content exceeds 4000 characters");
        }
        for (int i = 0; i < trimmed.length(); i++) {
            char c = trimmed.charAt(i);
            if (Character.isISOControl(c) && c != '\n' && c != '\t' && c != '\r') {
                throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Invalid control characters in message");
            }
        }
    }

    private void validateScheduledFor(Instant scheduledFor) {
        if (scheduledFor == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "scheduledFor is required");
        }
        Instant now = Instant.now();
        Instant minTime = now.plusSeconds(Math.max(1, minLeadSeconds));
        Instant maxTime = now.plus(maxDays, ChronoUnit.DAYS);
        if (scheduledFor.isBefore(minTime)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SCHEDULE_TIME",
                "Scheduled time must be at least " + minLeadSeconds + " seconds in the future");
        }
        if (scheduledFor.isAfter(maxTime)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SCHEDULE_TIME",
                "Scheduled time cannot be more than " + maxDays + " days in the future");
        }
    }

    private ScheduledMessageDto toDto(ScheduledMessage sm, List<Attachment> attachments, Long senderId) {
        Conversation conv = sm.getConversation();
        String title = conv.getTitle();
        if (conv.getType() == ConversationType.DIRECT) {
            List<ConversationMember> members = conversationMemberRepository.findByConversationIdAndLeftAtIsNull(conv.getId());
            title = members.stream()
                .map(ConversationMember::getUser)
                .filter(u -> !u.getId().equals(senderId))
                .map(User::getName)
                .findFirst()
                .orElse("Direct Chat");
        }

        List<AttachmentDto> attachmentDtos = attachments != null
            ? attachments.stream().map(attachmentService::toDto).toList()
            : List.of();

        return new ScheduledMessageDto(
            sm.getId(),
            conv.getId(),
            title,
            conv.getType().name(),
            sm.getContent(),
            sm.getReplyTo() != null ? sm.getReplyTo().getId() : null,
            sm.getScheduledFor(),
            sm.getStatus().name(),
            sm.getFailureReason(),
            sm.getAttempts() != null ? sm.getAttempts() : 0,
            sm.getSentMessage() != null ? sm.getSentMessage().getId() : null,
            attachmentDtos,
            sm.getCreatedAt(),
            sm.getUpdatedAt()
        );
    }

    private static String truncateReason(String reason) {
        if (reason == null) return null;
        return reason.length() > 490 ? reason.substring(0, 490) : reason;
    }
}
