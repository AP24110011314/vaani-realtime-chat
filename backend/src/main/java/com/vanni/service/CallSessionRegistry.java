package com.vanni.service;

import com.vanni.dto.response.UserSummaryResponse;
import com.vanni.entity.CallState;
import com.vanni.entity.CallType;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.*;

@Component
public class CallSessionRegistry {

    public static final class CallSession {
        private final String callId;
        private final Long conversationId;
        private final Long callerId;
        private final Long calleeId;
        private final UserSummaryResponse callerSummary;
        private final CallType callType;
        private final Instant startedAt;
        private volatile CallState state = CallState.RINGING;
        private volatile Instant connectedAt;
        private volatile ScheduledFuture<?> ringTimeoutFuture;
        private final Map<Long, ScheduledFuture<?>> disconnectGraceFutures = new ConcurrentHashMap<>();

        public CallSession(
                String callId,
                Long conversationId,
                Long callerId,
                Long calleeId,
                UserSummaryResponse callerSummary,
                CallType callType,
                Instant startedAt) {
            this.callId = callId;
            this.conversationId = conversationId;
            this.callerId = callerId;
            this.calleeId = calleeId;
            this.callerSummary = callerSummary;
            this.callType = callType;
            this.startedAt = startedAt;
        }

        public String getCallId() { return callId; }
        public Long getConversationId() { return conversationId; }
        public Long getCallerId() { return callerId; }
        public Long getCalleeId() { return calleeId; }
        public UserSummaryResponse getCallerSummary() { return callerSummary; }
        public CallType getCallType() { return callType; }
        public Instant getStartedAt() { return startedAt; }
        public CallState getState() { return state; }
        public void setState(CallState state) { this.state = state; }
        public Instant getConnectedAt() { return connectedAt; }
        public void setConnectedAt(Instant connectedAt) { this.connectedAt = connectedAt; }
        public ScheduledFuture<?> getRingTimeoutFuture() { return ringTimeoutFuture; }
        public void setRingTimeoutFuture(ScheduledFuture<?> f) { this.ringTimeoutFuture = f; }
        public Map<Long, ScheduledFuture<?>> getDisconnectGraceFutures() { return disconnectGraceFutures; }

        public boolean isParticipant(Long userId) {
            return userId != null && (userId.equals(callerId) || userId.equals(calleeId));
        }

        public Long otherParticipant(Long userId) {
            if (callerId.equals(userId)) return calleeId;
            if (calleeId.equals(userId)) return callerId;
            return null;
        }
    }

    private final ConcurrentHashMap<String, CallSession> sessions = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Long, String> userActiveCall = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> clientCallIdToCallId = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);

    public Optional<CallSession> get(String callId) {
        return callId != null ? Optional.ofNullable(sessions.get(callId)) : Optional.empty();
    }

    public Optional<CallSession> getActiveCallForUser(Long userId) {
        String callId = userId != null ? userActiveCall.get(userId) : null;
        return callId != null ? get(callId) : Optional.empty();
    }

    public String getByClientCallId(String clientCallKey) {
        return clientCallKey != null ? clientCallIdToCallId.get(clientCallKey) : null;
    }

    public boolean tryReserveCaller(Long callerId, String callId) {
        return userActiveCall.putIfAbsent(callerId, callId) == null;
    }

    public boolean tryReserveCallee(Long calleeId, String callId) {
        return userActiveCall.putIfAbsent(calleeId, callId) == null;
    }

    public void releaseUserIfMatches(Long userId, String callId) {
        if (userId != null && callId != null) {
            userActiveCall.remove(userId, callId);
        }
    }

    public void putSession(CallSession session, String clientCallKey) {
        sessions.put(session.getCallId(), session);
        if (clientCallKey != null) {
            clientCallIdToCallId.put(clientCallKey, session.getCallId());
        }
    }

    public void removeSession(CallSession session) {
        if (session == null) return;
        sessions.remove(session.getCallId());
        userActiveCall.remove(session.getCallerId(), session.getCallId());
        userActiveCall.remove(session.getCalleeId(), session.getCallId());
        ScheduledFuture<?> ring = session.getRingTimeoutFuture();
        if (ring != null) {
            ring.cancel(false);
        }
        session.getDisconnectGraceFutures().values().forEach(f -> f.cancel(false));
        session.getDisconnectGraceFutures().clear();
    }

    public ScheduledFuture<?> schedule(Runnable task, long delaySeconds) {
        return scheduler.schedule(task, Math.max(1, delaySeconds), TimeUnit.SECONDS);
    }

    @PreDestroy
    public void shutdown() {
        scheduler.shutdownNow();
    }
}
