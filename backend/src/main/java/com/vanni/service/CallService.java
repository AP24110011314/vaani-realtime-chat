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
    private static final int MAX_GROUP_CALL_PARTICIPANTS = 8;
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

        record InviteContext(
            Long convId,
            boolean isGroup,
            String groupTitle,
            UserSummaryResponse callerSummary,
            List<UserSummaryResponse> peers
        ) {}

        InviteContext ctx = txTemplate.execute(status -> {
            ConversationMember callerMember = conversationAccessService.requireMember(conversationId, callerId);
            Conversation conv = callerMember.getConversation();
            boolean isGroup = conv.getType() == ConversationType.GROUP;
            List<ConversationMember> members = conversationMemberRepository.findByConversationIdAndLeftAtIsNull(conversationId);
            List<User> otherUsers = members.stream()
                .map(ConversationMember::getUser)
                .filter(u -> !u.getId().equals(callerId))
                .toList();

            if (!isGroup) {
                User callee = otherUsers.stream()
                    .findFirst()
                    .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "NO_PEER", "Recipient is not in this conversation"));
                if (blockRepository.isBlockedEitherWay(callerId, callee.getId())) {
                    throw new ApiException(HttpStatus.FORBIDDEN, "USER_BLOCKED", "Cannot call a blocked user");
                }
                return new InviteContext(
                    conv.getId(),
                    false,
                    null,
                    userService.toUserSummary(callerMember.getUser()),
                    List.of(userService.toUserSummary(callee))
                );
            }

            List<UserSummaryResponse> eligiblePeers = otherUsers.stream()
                .filter(u -> !blockRepository.isBlockedEitherWay(callerId, u.getId()))
                .map(userService::toUserSummary)
                .toList();
            if (eligiblePeers.isEmpty()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "NO_PEER", "No eligible group members available to call");
            }
            return new InviteContext(
                conv.getId(),
                true,
                conv.getTitle(),
                userService.toUserSummary(callerMember.getUser()),
                eligiblePeers
            );
        });

        if (ctx == null) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "INVITE_FAILED", "Could not initialize call");
        }

        if (!ctx.isGroup()) {
            return startDirectCall(callerId, conversationId, callType, clientKey, ctx.callerSummary(), ctx.peers().get(0));
        }

        // If this group already has an active call, join the caller into it cleanly
        Optional<CallSession> activeGroupCall = registry.getActiveCallForConversation(conversationId);
        if (activeGroupCall.isPresent()) {
            CallSession existing = activeGroupCall.get();
            if (existing.isGroup() && existing.getState() != CallState.ENDED) {
                if (!existing.getJoinedUserIds().contains(callerId)) {
                    joinGroupSession(callerId, existing, ctx.callerSummary(), null);
                }
                return existing;
            }
        }

        return startGroupCall(callerId, conversationId, ctx.groupTitle(), callType, clientKey, ctx.callerSummary(), ctx.peers());
    }

    private CallSession startDirectCall(
            Long callerId,
            Long conversationId,
            CallType callType,
            String clientKey,
            UserSummaryResponse callerSummary,
            UserSummaryResponse calleeSummary) {
        String callId = UUID.randomUUID().toString();
        if (!registry.tryReserveCaller(callerId, callId)) {
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_IN_CALL", "You are already in another call");
        }

        Long calleeId = calleeSummary.id();
        if (!registry.tryReserveCallee(calleeId, callId)) {
            registry.releaseUserIfMatches(callerId, callId);
            Instant now = Instant.now();
            persistCallLogAndMessage(callId, conversationId, callerId, calleeId, callType, CallEndReason.BUSY,
                now, null, now, Set.of(callerId, calleeId));
            eventPublisher.sendToUser(callerId, "call.busy", Map.of(
                "callId", callId,
                "conversationId", conversationId
            ));
            return null;
        }

        CallSession session = new CallSession(
            callId,
            conversationId,
            false,
            null,
            callerId,
            calleeId,
            callerSummary,
            callType,
            Instant.now()
        );
        session.getParticipantSummaries().put(calleeId, calleeSummary);
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
            "type", callType.name(),
            "isGroup", false
        ));
        eventPublisher.sendToUser(callerId, "call.ringing", Map.of(
            "callId", callId,
            "conversationId", conversationId,
            "type", callType.name(),
            "isGroup", false
        ));
        log.info("Call started ringing: callId={} type={}", callId, callType);
        return session;
    }

    private CallSession startGroupCall(
            Long callerId,
            Long conversationId,
            String groupTitle,
            CallType callType,
            String clientKey,
            UserSummaryResponse callerSummary,
            List<UserSummaryResponse> peers) {
        String callId = UUID.randomUUID().toString();
        if (!registry.tryReserveCaller(callerId, callId)) {
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_IN_CALL", "You are already in another call");
        }

        List<UserSummaryResponse> availablePeers = peers.stream()
            .filter(p -> registry.getActiveCallForUser(p.id()).isEmpty())
            .toList();
        if (availablePeers.isEmpty()) {
            registry.releaseUserIfMatches(callerId, callId);
            Long fallbackCallee = peers.get(0).id();
            Instant now = Instant.now();
            persistCallLogAndMessage(callId, conversationId, callerId, fallbackCallee, callType, CallEndReason.BUSY,
                now, null, now, Set.of(callerId));
            eventPublisher.sendToUser(callerId, "call.busy", Map.of(
                "callId", callId,
                "conversationId", conversationId
            ));
            return null;
        }

        Long primaryCalleeId = availablePeers.get(0).id();
        CallSession session = new CallSession(
            callId,
            conversationId,
            true,
            groupTitle,
            callerId,
            primaryCalleeId,
            callerSummary,
            callType,
            Instant.now()
        );
        for (UserSummaryResponse peer : peers) {
            session.getParticipantSummaries().put(peer.id(), peer);
            session.getAllParticipantIds().add(peer.id());
        }
        for (UserSummaryResponse peer : availablePeers) {
            session.getInvitedUserIds().add(peer.id());
        }

        registry.putSession(session, clientKey);

        ScheduledFuture<?> ringTimeout = registry.schedule(
            () -> onRingTimeout(callId),
            callProperties.getRingTimeoutSeconds()
        );
        session.setRingTimeoutFuture(ringTimeout);

        Map<String, Object> incomingPayload = new HashMap<>();
        incomingPayload.put("callId", callId);
        incomingPayload.put("conversationId", conversationId);
        incomingPayload.put("caller", callerSummary);
        incomingPayload.put("type", callType.name());
        incomingPayload.put("isGroup", true);
        incomingPayload.put("conversationTitle", groupTitle != null ? groupTitle : "Group call");
        incomingPayload.put("participantCount", 1);

        for (UserSummaryResponse peer : availablePeers) {
            eventPublisher.sendToUser(peer.id(), "call.incoming", incomingPayload);
        }

        Map<String, Object> ringingPayload = new HashMap<>();
        ringingPayload.put("callId", callId);
        ringingPayload.put("conversationId", conversationId);
        ringingPayload.put("type", callType.name());
        ringingPayload.put("isGroup", true);
        ringingPayload.put("conversationTitle", groupTitle != null ? groupTitle : "Group call");
        ringingPayload.put("participants", List.of(callerSummary));
        eventPublisher.sendToUser(callerId, "call.ringing", ringingPayload);

        log.info("Group call started ringing: callId={} type={} invitees={}", callId, callType, availablePeers.size());
        return session;
    }

    public void accept(Long userId, String callId, String sessionId) {
        CallSession session = requireParticipant(userId, callId);
        if (!session.isGroup()) {
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
            return;
        }

        UserSummaryResponse joinerSummary = txTemplate.execute(status -> {
            ConversationMember member = conversationAccessService.requireMember(session.getConversationId(), userId);
            return userService.toUserSummary(member.getUser());
        });
        joinGroupSession(userId, session, joinerSummary, sessionId);
    }

    private void joinGroupSession(Long userId, CallSession session, UserSummaryResponse joinerSummary, String sessionId) {
        List<UserSummaryResponse> existingPeers;
        synchronized (session) {
            if (session.getState() == CallState.ENDED) {
                throw new ApiException(HttpStatus.CONFLICT, "INVALID_CALL_STATE", "Call has already ended");
            }
            if (session.getJoinedUserIds().contains(userId)) {
                return;
            }
            if (session.getJoinedUserIds().size() >= MAX_GROUP_CALL_PARTICIPANTS) {
                throw new ApiException(HttpStatus.CONFLICT, "CALL_FULL",
                    "Group calls support up to " + MAX_GROUP_CALL_PARTICIPANTS + " participants");
            }
            if (!registry.tryReserveUser(userId, session.getCallId())) {
                throw new ApiException(HttpStatus.CONFLICT, "ALREADY_IN_CALL", "You are already in another call");
            }

            existingPeers = session.getJoinedUserIds().stream()
                .map(id -> session.getParticipantSummaries().get(id))
                .filter(Objects::nonNull)
                .toList();

            session.getJoinedUserIds().add(userId);
            session.getInvitedUserIds().remove(userId);
            session.getDeclinedUserIds().remove(userId);
            session.getAllParticipantIds().add(userId);
            if (joinerSummary != null) {
                session.getParticipantSummaries().put(userId, joinerSummary);
            }

            if (session.getJoinedUserIds().size() >= 2 && session.getState() == CallState.RINGING) {
                session.setState(CallState.CONNECTING);
                if (session.getRingTimeoutFuture() != null) {
                    session.getRingTimeoutFuture().cancel(false);
                }
            }
        }

        Map<String, Object> elsewherePayload = new HashMap<>();
        elsewherePayload.put("callId", session.getCallId());
        if (sessionId != null) {
            elsewherePayload.put("acceptedSessionId", sessionId);
        }
        eventPublisher.sendToUser(userId, "call.handled_elsewhere", elsewherePayload);

        Map<String, Object> joinedPayload = new HashMap<>();
        joinedPayload.put("callId", session.getCallId());
        joinedPayload.put("conversationId", session.getConversationId());
        joinedPayload.put("isGroup", true);
        joinedPayload.put("conversationTitle", session.getConversationTitle() != null ? session.getConversationTitle() : "Group call");
        joinedPayload.put("type", session.getCallType().name());
        joinedPayload.put("peers", existingPeers);
        eventPublisher.sendToUser(userId, "call.joined", joinedPayload);

        Map<String, Object> participantJoinedPayload = new HashMap<>();
        participantJoinedPayload.put("callId", session.getCallId());
        participantJoinedPayload.put("conversationId", session.getConversationId());
        participantJoinedPayload.put("user", joinerSummary);
        for (UserSummaryResponse existingPeer : existingPeers) {
            eventPublisher.sendToUser(existingPeer.id(), "call.participant_joined", participantJoinedPayload);
        }
    }

    public void decline(Long userId, String callId) {
        CallSession session = requireParticipant(userId, callId);
        if (!session.isGroup()) {
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
                session.getCallType(), CallEndReason.DECLINED, session.getStartedAt(), null, endedAt,
                Set.of(session.getCallerId(), session.getCalleeId()));

            Map<String, Object> payload = Map.of("callId", callId, "conversationId", session.getConversationId());
            eventPublisher.sendToUser(session.getCallerId(), "call.declined", payload);
            eventPublisher.sendToUser(session.getCalleeId(), "call.declined", payload);
            return;
        }

        boolean shouldEndAll = false;
        synchronized (session) {
            if (session.getCallerId().equals(userId)) {
                throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Caller cannot decline own group call");
            }
            if (session.getState() == CallState.ENDED) {
                return;
            }
            session.getInvitedUserIds().remove(userId);
            session.getDeclinedUserIds().add(userId);
            registry.releaseUserIfMatches(userId, callId);
            if (session.getJoinedUserIds().size() <= 1 && session.getInvitedUserIds().isEmpty()) {
                shouldEndAll = true;
                session.setState(CallState.ENDED);
                registry.removeSession(session);
            }
        }

        Map<String, Object> declinedPayload = Map.of("callId", callId, "conversationId", session.getConversationId());
        eventPublisher.sendToUser(userId, "call.declined", declinedPayload);

        if (shouldEndAll) {
            Instant endedAt = Instant.now();
            persistCallLogAndMessage(callId, session.getConversationId(), session.getCallerId(), session.getCalleeId(),
                session.getCallType(), CallEndReason.DECLINED, session.getStartedAt(), null, endedAt,
                session.getAllParticipantIds());
            eventPublisher.sendToUser(session.getCallerId(), "call.declined", declinedPayload);
        }
    }

    public void cancel(Long userId, String callId) {
        CallSession session = requireParticipant(userId, callId);
        if (!session.isGroup()) {
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
                session.getCallType(), CallEndReason.CANCELLED, session.getStartedAt(), null, endedAt,
                Set.of(session.getCallerId(), session.getCalleeId()));

            Map<String, Object> payload = Map.of("callId", callId, "conversationId", session.getConversationId());
            eventPublisher.sendToUser(session.getCallerId(), "call.cancelled", payload);
            eventPublisher.sendToUser(session.getCalleeId(), "call.cancelled", payload);
            return;
        }

        Set<Long> targets;
        synchronized (session) {
            if (!session.getCallerId().equals(userId)) {
                throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only the caller can cancel a call");
            }
            if (session.getState() == CallState.ENDED) {
                return;
            }
            if (session.getJoinedUserIds().size() >= 2) {
                // Other participants already joined — let caller leave without cancelling everyone else
                leaveGroupParticipant(session, userId, CallEndReason.COMPLETED);
                return;
            }
            targets = new HashSet<>(session.getInvitedUserIds());
            targets.add(userId);
            session.setState(CallState.ENDED);
            registry.removeSession(session);
        }

        Instant endedAt = Instant.now();
        persistCallLogAndMessage(callId, session.getConversationId(), session.getCallerId(), session.getCalleeId(),
            session.getCallType(), CallEndReason.CANCELLED, session.getStartedAt(), null, endedAt,
            session.getAllParticipantIds());

        Map<String, Object> payload = Map.of("callId", callId, "conversationId", session.getConversationId());
        targets.forEach(uid -> eventPublisher.sendToUser(uid, "call.cancelled", payload));
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

        if (!session.isGroup()) {
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
            return;
        }

        leaveGroupParticipant(session, userId, null);
    }

    private void leaveGroupParticipant(CallSession session, Long userId, CallEndReason overrideReason) {
        boolean finalizeAll = false;
        CallEndReason finalReason = CallEndReason.COMPLETED;
        List<Long> remainingJoined = List.of();
        Set<Long> unjoinedInvitees = Set.of();

        synchronized (session) {
            if (session.getState() == CallState.ENDED) {
                return;
            }
            ScheduledFuture<?> grace = session.getDisconnectGraceFutures().remove(userId);
            if (grace != null) {
                grace.cancel(false);
            }
            session.getJoinedUserIds().remove(userId);
            session.getInvitedUserIds().remove(userId);
            registry.releaseUserIfMatches(userId, session.getCallId());

            if (session.getJoinedUserIds().size() >= 2) {
                remainingJoined = new ArrayList<>(session.getJoinedUserIds());
            } else {
                finalizeAll = true;
                CallState prev = session.getState();
                Instant connectedAt = session.getConnectedAt();
                if (overrideReason != null) {
                    finalReason = overrideReason;
                } else if (prev == CallState.RINGING && connectedAt == null) {
                    finalReason = session.getCallerId().equals(userId) ? CallEndReason.CANCELLED : CallEndReason.DECLINED;
                } else if (connectedAt != null) {
                    finalReason = CallEndReason.COMPLETED;
                } else {
                    finalReason = CallEndReason.DISCONNECTED;
                }
                remainingJoined = new ArrayList<>(session.getJoinedUserIds());
                unjoinedInvitees = new HashSet<>(session.getInvitedUserIds());
                session.setState(CallState.ENDED);
                registry.removeSession(session);
            }
        }

        if (!finalizeAll) {
            UserSummaryResponse leftUser = session.getParticipantSummaries().get(userId);
            Map<String, Object> leftPayload = new HashMap<>();
            leftPayload.put("callId", session.getCallId());
            leftPayload.put("conversationId", session.getConversationId());
            leftPayload.put("userId", userId);
            leftPayload.put("name", leftUser != null ? leftUser.name() : "Participant");
            for (Long remainingId : remainingJoined) {
                eventPublisher.sendToUser(remainingId, "call.participant_left", leftPayload);
            }
            eventPublisher.sendToUser(userId, "call.ended", Map.of(
                "callId", session.getCallId(),
                "conversationId", session.getConversationId(),
                "reason", (overrideReason != null ? overrideReason : CallEndReason.COMPLETED).name(),
                "durationSec", 0
            ));
            return;
        }

        Instant endedAt = Instant.now();
        Instant connectedAt = session.getConnectedAt();
        int durationSec = connectedAt != null
            ? (int) Math.max(0, Duration.between(connectedAt, endedAt).getSeconds())
            : 0;

        persistCallLogAndMessage(session.getCallId(), session.getConversationId(), session.getCallerId(),
            session.getCalleeId(), session.getCallType(), finalReason, session.getStartedAt(), connectedAt, endedAt,
            session.getAllParticipantIds());

        Map<String, Object> endPayload = Map.of(
            "callId", session.getCallId(),
            "conversationId", session.getConversationId(),
            "reason", finalReason.name(),
            "durationSec", durationSec
        );
        Set<Long> endRecipients = new HashSet<>(remainingJoined);
        endRecipients.add(userId);
        endRecipients.forEach(uid -> eventPublisher.sendToUser(uid, "call.ended", endPayload));

        String inviteeEvent = finalReason == CallEndReason.CANCELLED ? "call.cancelled" : "call.ended";
        unjoinedInvitees.forEach(uid -> eventPublisher.sendToUser(uid, inviteeEvent, endPayload));
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
        List<Long> notifyTargets = List.of();
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
            if (changed && session.isGroup()) {
                notifyTargets = session.getJoinedUserIds().stream()
                    .filter(uid -> !uid.equals(userId))
                    .toList();
            }
        }

        if (changed) {
            Map<String, Object> stateData = Map.of("callId", callId, "state", next.name(), "userId", userId);
            eventPublisher.sendToUser(userId, "call.state", stateData);
            if (!session.isGroup()) {
                Long peerId = session.otherParticipant(userId);
                if (peerId != null) {
                    eventPublisher.sendToUser(peerId, "call.state", stateData);
                }
            } else {
                notifyTargets.forEach(uid -> eventPublisher.sendToUser(uid, "call.state", stateData));
            }
        }
    }

    public void relaySignal(Long userId, String callId, String kind, String rawSerializedPayload, Object payloadObj) {
        relaySignal(userId, callId, kind, rawSerializedPayload, payloadObj, null);
    }

    public void relaySignal(Long userId, String callId, String kind, String rawSerializedPayload, Object payloadObj, Long targetUserId) {
        if (callId == null || kind == null || payloadObj == null) {
            return;
        }
        Optional<CallSession> opt = registry.get(callId);
        if (opt.isEmpty()) {
            return;
        }
        CallSession session = opt.get();
        if (!session.isJoined(userId)) {
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

        Long recipientId;
        if (!session.isGroup()) {
            Long directPeer = session.otherParticipant(userId);
            if (targetUserId != null && !targetUserId.equals(directPeer)) {
                throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Target user is not in this call");
            }
            recipientId = directPeer;
        } else {
            if (targetUserId == null || targetUserId.equals(userId) || !session.isJoined(targetUserId)) {
                throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Target participant is not active in this group call");
            }
            recipientId = targetUserId;
        }

        if (recipientId != null) {
            eventPublisher.sendToUser(recipientId, "call.signal", Map.of(
                "callId", callId,
                "fromUserId", userId,
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
        if (!session.isGroup()) {
            synchronized (session) {
                if (session.getState() == CallState.ENDED) return;
                session.getDisconnectGraceFutures().remove(userId);
                session.setState(CallState.ENDED);
                registry.removeSession(session);
            }
            log.info("Call ended due to participant disconnect grace timeout: callId={}", callId);
            finalizeCallEnded(session, CallEndReason.DISCONNECTED);
            return;
        }

        log.info("Removing disconnected participant from group call: callId={} userId={}", callId, userId);
        leaveGroupParticipant(session, userId, CallEndReason.DISCONNECTED);
    }

    void onRingTimeout(String callId) {
        Optional<CallSession> opt = registry.get(callId);
        if (opt.isEmpty()) return;
        CallSession session = opt.get();
        Set<Long> missedRecipients;
        synchronized (session) {
            if (session.getState() != CallState.RINGING) return;
            if (session.isGroup() && session.getJoinedUserIds().size() >= 2) {
                return;
            }
            missedRecipients = new HashSet<>(session.getInvitedUserIds());
            missedRecipients.add(session.getCallerId());
            if (!session.isGroup() && session.getCalleeId() != null) {
                missedRecipients.add(session.getCalleeId());
            }
            session.setState(CallState.ENDED);
            registry.removeSession(session);
        }

        Instant endedAt = Instant.now();
        persistCallLogAndMessage(callId, session.getConversationId(), session.getCallerId(), session.getCalleeId(),
            session.getCallType(), CallEndReason.MISSED, session.getStartedAt(), null, endedAt,
            session.getAllParticipantIds());

        Map<String, Object> payload = Map.of("callId", callId, "conversationId", session.getConversationId());
        missedRecipients.forEach(uid -> eventPublisher.sendToUser(uid, "call.missed", payload));
    }

    private void finalizeCallEnded(CallSession session, CallEndReason reason) {
        Instant endedAt = Instant.now();
        Instant connectedAt = session.getConnectedAt();
        int durationSec = connectedAt != null
            ? (int) Math.max(0, Duration.between(connectedAt, endedAt).getSeconds())
            : 0;

        persistCallLogAndMessage(session.getCallId(), session.getConversationId(), session.getCallerId(),
            session.getCalleeId(), session.getCallType(), reason, session.getStartedAt(), connectedAt, endedAt,
            session.getAllParticipantIds());

        Map<String, Object> payload = Map.of(
            "callId", session.getCallId(),
            "conversationId", session.getConversationId(),
            "reason", reason.name(),
            "durationSec", durationSec
        );
        eventPublisher.sendToUser(session.getCallerId(), "call.ended", payload);
        if (session.getCalleeId() != null) {
            eventPublisher.sendToUser(session.getCalleeId(), "call.ended", payload);
        }
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
            Instant endedAt,
            Set<Long> recipientIds) {
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

            Long[] targetIds = (recipientIds == null || recipientIds.isEmpty())
                ? new Long[] { callerId, calleeId }
                : recipientIds.toArray(Long[]::new);
            messageService.createCallLogMessage(conv, caller, logRow, label, targetIds);
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
