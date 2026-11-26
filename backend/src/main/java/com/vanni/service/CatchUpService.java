package com.vanni.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.vanni.config.AiProperties;
import com.vanni.dto.request.CatchUpRequest;
import com.vanni.dto.response.CatchUpResponse;
import com.vanni.dto.response.CatchUpSummaryDto;
import com.vanni.entity.*;
import com.vanni.exception.ApiException;
import com.vanni.repository.*;
import com.vanni.util.AiSummaryParser;
import com.vanni.util.TranscriptBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CatchUpService {

    private static final Logger log = LoggerFactory.getLogger(CatchUpService.class);
    private static final int MIN_MESSAGES_TO_SUMMARIZE = 5;
    private static final int MAX_MESSAGES_PER_SUMMARY = 300;
    private static final String FEATURE_CATCH_UP = "CATCH_UP";

    private final AiProperties aiProperties;
    private final UserRepository userRepository;
    private final ConversationAccessService conversationAccessService;
    private final ConversationMemberRepository conversationMemberRepository;
    private final MessageRepository messageRepository;
    private final AttachmentRepository attachmentRepository;
    private final AiUsageRepository aiUsageRepository;
    private final AiSummaryService aiSummaryService;
    private final ObjectMapper objectMapper;

    private final Cache<String, CatchUpResponse> summaryCache = Caffeine.newBuilder()
        .maximumSize(500)
        .expireAfterWrite(Duration.ofMinutes(10))
        .build();

    public CatchUpService(
            AiProperties aiProperties,
            UserRepository userRepository,
            ConversationAccessService conversationAccessService,
            ConversationMemberRepository conversationMemberRepository,
            MessageRepository messageRepository,
            AttachmentRepository attachmentRepository,
            AiUsageRepository aiUsageRepository,
            AiSummaryService aiSummaryService,
            ObjectMapper objectMapper) {
        this.aiProperties = aiProperties;
        this.userRepository = userRepository;
        this.conversationAccessService = conversationAccessService;
        this.conversationMemberRepository = conversationMemberRepository;
        this.messageRepository = messageRepository;
        this.attachmentRepository = attachmentRepository;
        this.aiUsageRepository = aiUsageRepository;
        this.aiSummaryService = aiSummaryService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public CatchUpResponse catchUp(Long conversationId, Long userId, CatchUpRequest req) {
        if (!aiProperties.isFeaturesEnabled()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "AI_NOT_ENABLED",
                "AI summaries are disabled on this server.");
        }

        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));
        if (!user.isAiEnabled()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "AI_NOT_ENABLED",
                "Enable AI features in Settings before using Catch Me Up.");
        }

        ConversationMember member = conversationAccessService.requireMember(conversationId, userId);

        Instant now = Instant.now();
        List<String> countedStatuses = List.of("SUCCESS", "BAD_RESPONSE", "FAILED");
        long hourlyCount = aiUsageRepository.countByUserIdAndStatusInAndCreatedAtAfter(
            userId, countedStatuses, now.minus(1, ChronoUnit.HOURS));
        if (hourlyCount >= aiProperties.getRatePerHour()) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED",
                "You have reached the hourly AI summary limit. Please try again later.",
                Map.of("retryAfterSeconds", "3600"));
        }
        long dailyCount = aiUsageRepository.countByUserIdAndStatusInAndCreatedAtAfter(
            userId, countedStatuses, now.minus(24, ChronoUnit.HOURS));
        if (dailyCount >= aiProperties.getRatePerDay()) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED",
                "You have reached the daily AI summary limit. Please try again tomorrow.",
                Map.of("retryAfterSeconds", "86400"));
        }

        Long requestedFromId = req != null ? req.fromMessageId() : null;
        Long effectiveFromId = requestedFromId != null ? requestedFromId : member.getLastReadMessageId();

        // Fetch newest MAX_MESSAGES_PER_SUMMARY + 1 to detect truncation cleanly while respecting joinedAt
        List<Message> descMessages = messageRepository.findCatchUpMessagesDesc(
            conversationId,
            member.getJoinedAt(),
            effectiveFromId,
            PageRequest.of(0, MAX_MESSAGES_PER_SUMMARY + 1)
        );

        boolean truncatedByCount = descMessages.size() > MAX_MESSAGES_PER_SUMMARY;
        List<Message> cappedDesc = truncatedByCount ? descMessages.subList(0, MAX_MESSAGES_PER_SUMMARY) : descMessages;

        if (cappedDesc.size() < MIN_MESSAGES_TO_SUMMARIZE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "NOTHING_TO_SUMMARISE",
                "You need at least " + MIN_MESSAGES_TO_SUMMARIZE + " missed messages to summarize.");
        }

        List<Message> chronological = new ArrayList<>(cappedDesc);
        Collections.reverse(chronological);

        List<Long> msgIds = chronological.stream().map(Message::getId).toList();
        Map<Long, List<Attachment>> attachmentsByMsgId = msgIds.isEmpty()
            ? Map.of()
            : attachmentRepository.findByMessageIds(msgIds).stream()
                .filter(a -> a.getMessage() != null)
                .collect(Collectors.groupingBy(a -> a.getMessage().getId()));

        Map<Long, String> memberNames = conversationMemberRepository
            .findByConversationIdAndLeftAtIsNull(conversationId).stream()
            .collect(Collectors.toMap(cm -> cm.getUser().getId(), cm -> cm.getUser().getName(), (a, b) -> a));

        TranscriptBuilder.BuildResult built = TranscriptBuilder.build(
            chronological,
            userId,
            memberNames,
            attachmentsByMsgId,
            aiProperties.getMaxInputChars(),
            truncatedByCount
        );

        if (built.messageCount() < MIN_MESSAGES_TO_SUMMARIZE || built.transcript().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "NOTHING_TO_SUMMARISE",
                "Not enough text messages to summarize.");
        }

        String cacheKey = userId + ":" + conversationId + ":" + built.fromMessageId() + ":" + built.toMessageId();
        boolean force = req != null && Boolean.TRUE.equals(req.force());
        if (!force) {
            CatchUpResponse cached = summaryCache.getIfPresent(cacheKey);
            if (cached != null) {
                log.info("Returning cached Catch-Up summary for user={} conv={}", userId, conversationId);
                return cached;
            }
        }

        CatchUpSummaryDto parsedSummary = null;
        int totalInputTokens = 0;
        int totalOutputTokens = 0;

        for (int parseAttempt = 0; parseAttempt < 2; parseAttempt++) {
            AiSummaryService.AiResult aiResult;
            try {
                aiResult = aiSummaryService.summarize(built.transcript(), built.truncated());
            } catch (ApiException ex) {
                recordUsage(user, member.getConversation(), totalInputTokens, totalOutputTokens, "FAILED");
                throw ex;
            }
            totalInputTokens += aiResult.inputTokens();
            totalOutputTokens += aiResult.outputTokens();

            try {
                parsedSummary = AiSummaryParser.parseAndSanitize(
                    aiResult.rawJson(),
                    built.includedMessageIds(),
                    objectMapper
                );
                break;
            } catch (AiSummaryParser.InvalidSummaryResponseException ex) {
                log.warn("Invalid AI summary JSON format on attempt {} for conv={}", parseAttempt + 1, conversationId);
                if (parseAttempt == 1) {
                    recordUsage(user, member.getConversation(), totalInputTokens, totalOutputTokens, "BAD_RESPONSE");
                    throw new ApiException(HttpStatus.BAD_GATEWAY, "AI_BAD_RESPONSE",
                        "AI returned an unreadable summary. Please try again.");
                }
            }
        }

        recordUsage(user, member.getConversation(), totalInputTokens, totalOutputTokens, "SUCCESS");

        CatchUpResponse response = new CatchUpResponse(
            built.messageCount(),
            built.fromMessageId(),
            built.toMessageId(),
            built.truncated(),
            Instant.now(),
            parsedSummary
        );
        summaryCache.put(cacheKey, response);
        return response;
    }

    private void recordUsage(User user, Conversation conv, int inTokens, int outTokens, String status) {
        AiUsage usage = AiUsage.builder()
            .user(user)
            .conversation(conv)
            .feature(FEATURE_CATCH_UP)
            .inputTokens(inTokens)
            .outputTokens(outTokens)
            .status(status)
            .build();
        aiUsageRepository.save(usage);
    }
}
