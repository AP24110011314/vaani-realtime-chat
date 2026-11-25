package com.vanni.service;

import com.vanni.dto.response.PresenceDto;
import com.vanni.entity.ConversationMember;
import com.vanni.entity.User;
import com.vanni.repository.ConversationMemberRepository;
import com.vanni.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class PresenceService {

    private static final Logger log = LoggerFactory.getLogger(PresenceService.class);

    private final UserRepository userRepository;
    private final ConversationMemberRepository conversationMemberRepository;
    private final EventPublisher eventPublisher;
    private final com.vanni.repository.BlockRepository blockRepository;

    private final ConcurrentHashMap<Long, AtomicInteger> sessionCounts = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> sessionToUser = new ConcurrentHashMap<>();

    public PresenceService(
            UserRepository userRepository,
            ConversationMemberRepository conversationMemberRepository,
            EventPublisher eventPublisher,
            com.vanni.repository.BlockRepository blockRepository) {
        this.userRepository = userRepository;
        this.conversationMemberRepository = conversationMemberRepository;
        this.eventPublisher = eventPublisher;
        this.blockRepository = blockRepository;
    }

    public void onSessionConnected(String sessionId, Long userId) {
        if (sessionId == null || userId == null) return;

        sessionToUser.put(sessionId, userId);
        AtomicInteger counter = sessionCounts.computeIfAbsent(userId, k -> new AtomicInteger(0));
        int activeSessions = counter.incrementAndGet();

        log.debug("Session connected: session={}, user={}, activeSessions={}", sessionId, userId, activeSessions);

        if (activeSessions == 1) {
            // Transitioned from offline to online
            PresenceDto presence = new PresenceDto(userId, true, null);
            broadcastPresenceToMutualMembers(userId, presence);
        }
    }

    @Transactional
    public void onSessionDisconnected(String sessionId) {
        if (sessionId == null) return;

        Long userId = sessionToUser.remove(sessionId);
        if (userId == null) return;

        AtomicInteger counter = sessionCounts.get(userId);
        if (counter != null && counter.decrementAndGet() <= 0) {
            sessionCounts.remove(userId);

            Instant now = Instant.now();
            Optional<User> userOpt = userRepository.findById(userId);
            Instant publicLastSeen = now;

            if (userOpt.isPresent()) {
                User user = userOpt.get();
                user.setLastSeenAt(now);
                userRepository.save(user);
                publicLastSeen = user.isShowLastSeen() ? now : null;
            }

            log.debug("User offline: user={}, publicLastSeen={}", userId, publicLastSeen);

            PresenceDto presence = new PresenceDto(userId, false, publicLastSeen);
            broadcastPresenceToMutualMembers(userId, presence);
        }
    }

    public boolean isOnline(Long userId) {
        if (userId == null) return false;
        AtomicInteger counter = sessionCounts.get(userId);
        return counter != null && counter.get() > 0;
    }

    @Transactional(readOnly = true)
    public List<PresenceDto> getPresence(List<Long> userIds, Long requesterId) {
        if (userIds == null || userIds.isEmpty()) {
            return Collections.emptyList();
        }

        List<User> users = userRepository.findAllById(userIds);
        List<PresenceDto> list = new ArrayList<>();

        for (User user : users) {
            boolean isSelf = requesterId != null && requesterId.equals(user.getId());
            if (!isSelf && requesterId != null && blockRepository.isBlockedEitherWay(requesterId, user.getId())) {
                list.add(new PresenceDto(user.getId(), false, null));
                continue;
            }
            if (!isSelf && !user.isShowLastSeen()) {
                list.add(new PresenceDto(user.getId(), false, null));
                continue;
            }
            boolean online = isOnline(user.getId());
            Instant lastSeen = (!online && user.isShowLastSeen()) ? user.getLastSeenAt() : null;
            list.add(new PresenceDto(user.getId(), online, lastSeen));
        }

        return list;
    }

    private void broadcastPresenceToMutualMembers(Long userId, PresenceDto presence) {
        try {
            boolean showPresence = userRepository.findById(userId)
                    .map(User::isShowLastSeen)
                    .orElse(true);
            if (!showPresence) {
                return;
            }
            Set<Long> mutualUserIds = getMutualMemberUserIds(userId);
            for (Long targetUserId : mutualUserIds) {
                if (!blockRepository.isBlockedEitherWay(userId, targetUserId)) {
                    eventPublisher.sendToUser(targetUserId, "presence.changed", presence);
                }
            }
        } catch (Exception ex) {
            log.error("Failed to broadcast presence for user {}: {}", userId, ex.getMessage());
        }
    }

    public Set<Long> getMutualMemberUserIds(Long userId) {
        List<ConversationMember> memberships = conversationMemberRepository.findByUserIdAndLeftAtIsNull(userId);
        Set<Long> mutualUserIds = new HashSet<>();

        for (ConversationMember m : memberships) {
            List<ConversationMember> convMembers =
                    conversationMemberRepository.findByConversationIdAndLeftAtIsNull(m.getConversation().getId());
            for (ConversationMember cm : convMembers) {
                if (!cm.getUser().getId().equals(userId)) {
                    mutualUserIds.add(cm.getUser().getId());
                }
            }
        }

        return mutualUserIds;
    }
}
