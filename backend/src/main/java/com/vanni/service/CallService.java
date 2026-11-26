package com.vanni.service;

import com.vanni.config.CallProperties;
import com.vanni.dto.response.UserSummaryResponse;
import com.vanni.entity.*;
import com.vanni.exception.ApiException;
import com.vanni.repository.*;
import com.vanni.security.RateLimiterService;
import com.vanni.service.CallSessionRegistry.CallSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ScheduledFuture;

@Service
public class CallService {

    private static final Logger log = LoggerFactory.getLogger(CallService.class);
    private static final int MAX_SIGNAL_PAYLOAD_BYTES = 16 * 1024;
    private static final Set<String> ALLOWED_SIGNAL_KINDS = Set.of("offer", "answer", "candidate");

    private final CallSessionRegistry registry;
    private final CallProperties callProperties;
    private final ConversationAccessService conversationAccessService;
    private final ConversationMemberRepository conversationMemberRepository;
    private final ConversationRepository conversationRepository;
    private final UserRepository userRepository;
    private final BlockRepository blockRepository;
    private final CallLogRepository callLogRepository;
    private final UserService userService;
    private final MessageService messageService;
    private final EventPublisher eventPublisher;
    private final RateLimiterService rateLimiterService;
    private final TransactionTemplate txTemplate;

    public CallService(
            CallSessionRegistry registry,
            CallProperties callProperties,
            ConversationAccessService conversationAccessService,
            ConversationMemberRepository conversationMemberRepository,
            ConversationRepository conversationRepository,
            UserRepository userRepository,
            BlockRepository blockRepository,
            CallLogRepository callLogRepository,
            UserService userService,
            MessageService messageService,
            EventPublisher eventPublisher,
            RateLimiterService rateLimiterService,
            PlatformTransactionManager transactionManager) {
        this.registry = registry;
        this.callProperties = callProperties;
        this.conversationAccessService = conversationAccessService;
        this.conversationMemberRepository = conversationMemberRepository;
        this.conversationRepository = conversationRepository;
        this.userRepository = userRepository;
        this.blockRepository = blockRepository;
        this.callLogRepository = callLogRepository;
        this.userService = userService;
        this.messageService = messageService;
        this.eventPublisher = eventPublisher;
        this.rateLimiterService = rateLimiterService;
        this.txTemplate = new TransactionTemplate(transactionManager);
    }

    public CallSession invite(Long callerId, Long conversationId, CallType callType, String clientCallId) {
        if (conversationId == null || callType == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "conversationId and callType are required");
        }

        String clientKey = (clientCallId != null && !clientCallId.isBlank())
            ? callerId + ":" + clientCallId.trim()
            : null;
        if (clientKey != null) {
            String existingId = registry.getByClientCallId(clientKey);
            if (existingId != null) {
                Optional<CallSession> existingSession = registry.get(existingId);
                if (existingSession.isPresent()) {
                    return existingSession.get();
                }
            }
        }

        record InviteContext(Long convId, UserSummaryResponse callerSummary, Long calleeId) {}
        InviteContext ctx = txTemplate.execute(status -> {
            ConversationMember callerMember = conversationAccessService.requireMember(conversationId, callerId);
            Conversation conv = callerMember.getConversation();
            if (conv.getType() != ConversationType.DIRECT) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "DIRECT_ONLY", "Calls are only supported in direct conversations");
            }
            List<ConversationMember> members = conversationMemberRepository.findByConversationIdAndLeftAtIsNull(conversationId);
            User callee = members.stream()
                .map(ConversationMember::getUser)
                .filter(u -> !u.getId().equals(callerId))
                .findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "NO_PEER", "Recipient is not in this conversation"));

            if (blockRepository.isBlockedEitherWay(callerId, callee.getId())) {
                throw new ApiException(HttpStatus.FORBIDDEN, "USER_BLOCKED", "Cannot call a blocked user");
            }
            return new InviteContext(conv.getId(), userService.toUserSummary(callerMember.getUser()), callee.getId());
        });

        if (ctx == null) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "INVITE_FAILED", "Could not initialize call");
        }

        String callId = UUID.randomUUID().toString();
        if (!registry.tryReserveCaller(callerId, callId)) {
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_IN_CALL", "You are already in another call");
        }

        Long calleeId = ctx.calleeId();
        if (!registry.tryReserveCallee(calleeId, callId)) {
            registry.releaseUserIfMatches(callerId, callId);
            Instant now = Instant.now();
            persistCallLogAndMessage(callId, conversationId, callerId, calleeId, callType, CallEndReason.BUSY, now, null, now);
            eventPublisher.sendToUser(callerId, "call.busy", Map.of(
                "callId", callId,
                "conversationId", conversationId
            ));
            return null;
        }

        UserSummaryResponse callerSummary = ctx.callerSummary();
        CallSession session = new CallSession(
            callId,
            conversationId,
            callerId,
            calleeId,
            callerSummary,
            callType,
            Instant.now()
        );
        registry.putSession(session, clientKey);

        ScheduledFuture<?> ringTimeout = registry.schedule(
            () -> onRingTimeout(callId),
            callProperties.getRingTimeoutSeconds()
        );
        session.setRingTimeoutFuture(ringTimeout);

        eventPublisher.sendToUser(calleeId, "call.incoming", Map.of(
            "callId", callId,
            "conversationId", conversationId,
            "caller", callerSummary,
            "type", callType.name()
        ));
        eventPublisher.sendToUser(callerId, "call.ringing", Map.of(
            "callId", callId,
            "conversationId", conversationId,
            "type", callType.name()
        ));
        log.info("Call started ringing: callId={} type={}", callId, callType);
        return session;
    }

    public void accept(Long userId, String callId, String sessionId) {
        CallSession session = requireParticipant(userId, callId);
        synchronized (session) {
            if (!session.getCalleeId().equals(userId)) {
                throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only the callee can accept a call");
            }
            if (session.getState() != CallState.RINGING) {
                throw new ApiException(HttpStatus.CONFLICT, "INVALID_CALL_STATE", "Call is no longer ringing");
            }
            session.setState(CallState.CONNECTING);
            if (session.getRingTimeoutFuture() != null) {
                session.getRingTimeoutFuture().cancel(false);
            }
        }

        eventPublisher.sendToUser(session.getCallerId(), "call.accepted", Map.of(
            "callId", callId,
            "conversationId", session.getConversationId()
        ));
        Map<String, Object> elsewherePayload = new HashMap<>();
        elsewherePayload.put("callId", callId);
        if (sessionId != null) {
            elsewherePayload.put("acceptedSessionId", sessionId);
        }
        eventPublisher.sendToUser(session.getCalleeId(), "call.handled_elsewhere", elsewherePayload);
    }

    public void decline(Long userId, String callId) {
        CallSession session = requireParticipant(userId, callId);
        synchronized (session) {
            if (!session.getCalleeId().equals(userId)) {
                throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only the callee can decline a call");
            }
            if (session.getState() != CallState.RINGING) {
                return;
            }
            session.setState(CallState.ENDED);
            registry.removeSession(session);
        }

        Instant endedAt = Instant.now();
        persistCallLogAndMessage(callId, session.getConversationId(), session.getCallerId(), session.getCalleeId(),
            session.getCallType(), CallEndReason.DECLINED, session.getStartedAt(), null, endedAt);

        Map<String, Object> payload = Map.of("callId", callId, "conversationId", session.getConversationId());
        eventPublisher.sendToUser(session.getCallerId(), "call.declined", payload);
        eventPublisher.sendToUser(session.getCalleeId(), "call.declined", payload);
    }

    public void cancel(Long userId, String callId) {
        CallSession session = requireParticipant(userId, callId);
        synchronized (session) {
            if (!session.getCallerId().equals(userId)) {
                throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only the caller can cancel a call");
            }
            if (session.getState() != CallState.RINGING) {
                return;
            }
            session.setState(CallState.ENDED);
            registry.removeSession(session);
        }

        Instant endedAt = Instant.now();
        persistCallLogAndMessage(callId, session.getConversationId(), session.getCallerId(), session.getCalleeId(),
            session.getCallType(), CallEndReason.CANCELLED, session.getStartedAt(), null, endedAt);

        Map<String, Object> payload = Map.of("callId", callId, "conversationId", session.getConversationId());
        eventPublisher.sendToUser(session.getCallerId(), "call.cancelled", payload);
        eventPublisher.sendToUser(session.getCalleeId(), "call.cancelled", payload);
    }

    public void end(Long userId, String callId) {
        Optional<CallSession> opt = registry.get(callId);
        if (opt.isEmpty()) {
            return;
        }
        CallSession session = opt.get();
        if (!session.isParticipant(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Not a participant of this call");
        }

        CallState previousState;
        Instant connectedAt;
        synchronized (session) {
            if (session.getState() == CallState.ENDED) {
                return;
            }
            previousState = session.getState();
            connectedAt = session.getConnectedAt();
            session.setState(CallState.ENDED);
            registry.removeSession(session);
        }

        CallEndReason reason;
        if (previousState == CallState.RINGING) {
            reason = session.getCallerId().equals(userId) ? CallEndReason.CANCELLED : CallEndReason.DECLINED;
        } else if (connectedAt != null) {
            reason = CallEndReason.COMPLETED;
        } else {
            reason = CallEndReason.DISCONNECTED;
        }

        finalizeCallEnded(session, reason);
    }

    public void updateState(Long userId, String callId, String requestedState) {
        CallSession session = requireParticipant(userId, callId);
        if (requestedState == null || requestedState.isBlank()) return;

        CallState next;
        try {
            next = CallState.valueOf(requestedState.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return;
        }

        boolean changed = false;
        synchronized (session) {
            if (session.getState() == CallState.ENDED) return;
            if (next == CallState.CONNECTED
                    && (session.getState() == CallState.CONNECTING || session.getState() == CallState.RECONNECTING)) {
                session.setState(CallState.CONNECTED);
                if (session.getConnectedAt() == null) {
                    session.setConnectedAt(Instant.now());
                }
                changed = true;
            } else if (next == CallState.RECONNECTING && session.getState() == CallState.CONNECTED) {
                session.setState(CallState.RECONNECTING);
                changed = true;
            }
        }

        if (changed) {
            Long peerId = session.otherParticipant(userId);
            Map<String, Object> stateData = Map.of("callId", callId, "state", next.name());
            eventPublisher.sendToUser(userId, "call.state", stateData);
            if (peerId != null) {
                eventPublisher.sendToUser(peerId, "call.state", stateData);
            }
        }
    }

    public void relaySignal(Long userId, String callId, String kind, String rawSerializedPayload, Object payloadObj) {
        if (callId == null || kind == null || payloadObj == null) {
            return;
        }
        Optional<CallSession> opt = registry.get(callId);
        if (opt.isEmpty()) {
            return;
        }
        CallSession session = opt.get();
        if (!session.isParticipant(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Not a participant of this call");
        }
        if (session.getState() == CallState.ENDED) {
            return;
        }
        if (!ALLOWED_SIGNAL_KINDS.contains(kind)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SIGNAL_KIND", "Unsupported signal kind");
        }
        if (rawSerializedPayload != null
                && rawSerializedPayload.getBytes(StandardCharsets.UTF_8).length > MAX_SIGNAL_PAYLOAD_BYTES) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "SIGNAL_TOO_LARGE", "Signal payload exceeds 16 KB limit");
        }
        if (!rateLimiterService.tryConsumeCallSignal(userId)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "Too many WebRTC signals");
        }

        Long peerId = session.otherParticipant(userId);
        if (peerId != null) {
            eventPublisher.sendToUser(peerId, "call.signal", Map.of(
                "callId", callId,
                "kind", kind,
                "payload", payloadObj
            ));
        }
    }

    public void onUserDisconnected(Long userId) {
        registry.getActiveCallForUser(userId).ifPresent(session -> {
            synchronized (session) {
                if (session.getState() == CallState.ENDED) return;
                if (session.getDisconnectGraceFutures().containsKey(userId)) return;
                ScheduledFuture<?> grace = registry.schedule(
                    () -> handleDisconnectTimeout(session.getCallId(), userId),
                    callProperties.getDisconnectGraceSeconds()
                );
                session.getDisconnectGraceFutures().put(userId, grace);
            }
        });
    }

    public void onUserReconnected(Long userId) {
        registry.getActiveCallForUser(userId).ifPresent(session -> {
            ScheduledFuture<?> grace = session.getDisconnectGraceFutures().remove(userId);
            if (grace != null) {
                grace.cancel(false);
            }
        });
    }

    void handleDisconnectTimeout(String callId, Long userId) {
        Optional<CallSession> opt = registry.get(callId);
        if (opt.isEmpty()) return;
        CallSession session = opt.get();
        synchronized (session) {
            if (session.getState() == CallState.ENDED) return;
            session.getDisconnectGraceFutures().remove(userId);
            session.setState(CallState.ENDED);
            registry.removeSession(session);
        }
        log.info("Call ended due to participant disconnect grace timeout: callId={}", callId);
        finalizeCallEnded(session, CallEndReason.DISCONNECTED);
    }

    void onRingTimeout(String callId) {
        Optional<CallSession> opt = registry.get(callId);
        if (opt.isEmpty()) return;
        CallSession session = opt.get();
        synchronized (session) {
            if (session.getState() != CallState.RINGING) return;
            session.setState(CallState.ENDED);
            registry.removeSession(session);
        }

        Instant endedAt = Instant.now();
        persistCallLogAndMessage(callId, session.getConversationId(), session.getCallerId(), session.getCalleeId(),
            session.getCallType(), CallEndReason.MISSED, session.getStartedAt(), null, endedAt);

        Map<String, Object> payload = Map.of("callId", callId, "conversationId", session.getConversationId());
        eventPublisher.sendToUser(session.getCallerId(), "call.missed", payload);
        eventPublisher.sendToUser(session.getCalleeId(), "call.missed", payload);
    }

    private void finalizeCallEnded(CallSession session, CallEndReason reason) {
        Instant endedAt = Instant.now();
        Instant connectedAt = session.getConnectedAt();
        int durationSec = connectedAt != null
            ? (int) Math.max(0, Duration.between(connectedAt, endedAt).getSeconds())
            : 0;

        persistCallLogAndMessage(session.getCallId(), session.getConversationId(), session.getCallerId(),
            session.getCalleeId(), session.getCallType(), reason, session.getStartedAt(), connectedAt, endedAt);

        Map<String, Object> payload = Map.of(
            "callId", session.getCallId(),
            "conversationId", session.getConversationId(),
            "reason", reason.name(),
            "durationSec", durationSec
        );
        eventPublisher.sendToUser(session.getCallerId(), "call.ended", payload);
        eventPublisher.sendToUser(session.getCalleeId(), "call.ended", payload);
    }

    private void persistCallLogAndMessage(
            String callUuid,
            Long conversationId,
            Long callerId,
            Long calleeId,
            CallType callType,
            CallEndReason reason,
            Instant startedAt,
            Instant connectedAt,
            Instant endedAt) {
        int durationSec = connectedAt != null
            ? (int) Math.max(0, Duration.between(connectedAt, endedAt).getSeconds())
            : 0;
        String label = formatCallLabel(callType, reason, durationSec);

        txTemplate.executeWithoutResult(status -> {
            Conversation conv = conversationRepository.findById(conversationId).orElseThrow();
            User caller = userRepository.findById(callerId).orElseThrow();
            User callee = userRepository.findById(calleeId).orElseThrow();

            CallLog logRow = CallLog.builder()
                .callUuid(callUuid)
                .conversation(conv)
                .caller(caller)
                .callee(callee)
                .callType(callType)
                .endReason(reason)
                .startedAt(startedAt)
                .connectedAt(connectedAt)
                .endedAt(endedAt)
                .durationSec(durationSec)
                .build();
            logRow = callLogRepository.save(logRow);

            messageService.createCallLogMessage(conv, caller, logRow, label, callerId, calleeId);
        });
    }

    public static String formatCallLabel(CallType type, CallEndReason reason, int durationSec) {
        String kindLabel = type == CallType.VIDEO ? "Video call" : "Voice call";
        String lowerKind = type == CallType.VIDEO ? "video call" : "voice call";
        return switch (reason) {
            case COMPLETED -> kindLabel + " · " + formatSec(durationSec);
            case DISCONNECTED -> durationSec > 0
                ? kindLabel + " · " + formatSec(durationSec)
                : "Disconnected " + lowerKind;
            case DECLINED -> "Declined " + lowerKind;
            case CANCELLED -> "Cancelled " + lowerKind;
            case MISSED, BUSY -> "Missed " + lowerKind;
            case FAILED -> "Failed " + lowerKind;
            case HANDLED_ELSEWHERE -> kindLabel + " answered elsewhere";
        };
    }

    private static String formatSec(int totalSec) {
        int mins = Math.max(0, totalSec) / 60;
        int secs = Math.max(0, totalSec) % 60;
        return mins + ":" + (secs < 10 ? "0" + secs : String.valueOf(secs));
    }

    private CallSession requireParticipant(Long userId, String callId) {
        CallSession session = registry.get(callId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "CALL_NOT_FOUND", "Call not found or already ended"));
        if (!session.isParticipant(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Not a participant of this call");
        }
        return session;
    }
}
