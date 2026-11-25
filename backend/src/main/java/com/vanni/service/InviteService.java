package com.vanni.service;

import com.vanni.dto.request.CreateInviteRequest;
import com.vanni.dto.response.*;
import com.vanni.entity.*;
import com.vanni.exception.ApiException;
import com.vanni.repository.*;
import com.vanni.security.RateLimiterService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Service
@Transactional
public class InviteService {

    private static final int MAX_ACTIVE_LINKS_PER_GROUP = 10;
    private static final int MAX_GROUP_SIZE = 256;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final GroupInviteRepository groupInviteRepository;
    private final GroupJoinRequestRepository groupJoinRequestRepository;
    private final ConversationMemberRepository conversationMemberRepository;
    private final UserRepository userRepository;
    private final ConversationAccessService conversationAccessService;
    private final ConversationService conversationService;
    private final UserService userService;
    private final EventPublisher eventPublisher;
    private final RateLimiterService rateLimiterService;
    private final String frontendUrl;

    public InviteService(
            GroupInviteRepository groupInviteRepository,
            GroupJoinRequestRepository groupJoinRequestRepository,
            ConversationMemberRepository conversationMemberRepository,
            UserRepository userRepository,
            ConversationAccessService conversationAccessService,
            ConversationService conversationService,
            UserService userService,
            EventPublisher eventPublisher,
            RateLimiterService rateLimiterService,
            @Value("${app.frontend-url:http://localhost:5173}") String frontendUrl) {
        this.groupInviteRepository = groupInviteRepository;
        this.groupJoinRequestRepository = groupJoinRequestRepository;
        this.conversationMemberRepository = conversationMemberRepository;
        this.userRepository = userRepository;
        this.conversationAccessService = conversationAccessService;
        this.conversationService = conversationService;
        this.userService = userService;
        this.eventPublisher = eventPublisher;
        this.rateLimiterService = rateLimiterService;
        this.frontendUrl = frontendUrl.endsWith("/") ? frontendUrl.substring(0, frontendUrl.length() - 1) : frontendUrl;
    }

    public InviteDto create(Long conversationId, Long adminId, CreateInviteRequest req) {
        ConversationMember adminMember = conversationAccessService.requireAdmin(conversationId, adminId);
        Conversation conv = adminMember.getConversation();
        if (conv.getType() != ConversationType.GROUP) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_OPERATION", "Invite links are only available for group chats");
        }

        Instant now = Instant.now();
        long activeCount = groupInviteRepository.countActiveByConversationId(conversationId, now);
        if (activeCount >= MAX_ACTIVE_LINKS_PER_GROUP) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVITE_LIMIT_REACHED", "Maximum of 10 active invite links per group reached");
        }

        byte[] rawBytes = new byte[32];
        SECURE_RANDOM.nextBytes(rawBytes);
        String rawCode = Base64.getUrlEncoder().withoutPadding().encodeToString(rawBytes);
        String codeHash = sha256Hex(rawCode);
        String codePrefix = rawCode.substring(0, Math.min(6, rawCode.length()));

        Instant expiresAt = (req != null && req.expiresInSeconds() != null)
            ? now.plusSeconds(req.expiresInSeconds())
            : null;
        Integer maxUses = req != null ? req.maxUses() : null;
        boolean requiresApproval = req != null && req.requiresApproval();

        GroupInvite invite = GroupInvite.builder()
            .conversation(conv)
            .codeHash(codeHash)
            .codePrefix(codePrefix)
            .createdBy(adminMember.getUser())
            .expiresAt(expiresAt)
            .maxUses(maxUses)
            .useCount(0)
            .requiresApproval(requiresApproval)
            .build();
        invite = groupInviteRepository.save(invite);

        String url = frontendUrl + "/join/" + rawCode;
        return toDto(invite, url, now);
    }

    @Transactional(readOnly = true)
    public List<InviteDto> list(Long conversationId, Long adminId) {
        ConversationMember adminMember = conversationAccessService.requireAdmin(conversationId, adminId);
        if (adminMember.getConversation().getType() != ConversationType.GROUP) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_OPERATION", "Invite links are only available for group chats");
        }
        Instant now = Instant.now();
        return groupInviteRepository.findByConversationIdOrderByCreatedAtDesc(conversationId)
            .stream()
            .map(inv -> toDto(inv, null, now))
            .toList();
    }

    public void revoke(Long conversationId, Long adminId, Long inviteId) {
        conversationAccessService.requireAdmin(conversationId, adminId);
        GroupInvite invite = groupInviteRepository.findByIdAndConversationId(inviteId, conversationId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Invite link not found"));
        if (invite.getRevokedAt() == null) {
            invite.setRevokedAt(Instant.now());
            groupInviteRepository.save(invite);
        }
    }

    @Transactional(readOnly = true)
    public InvitePreviewDto preview(String rawCode, Long userId) {
        enforceRateLimit(userId);
        if (rawCode == null || rawCode.isBlank()) {
            throw invalidInviteException();
        }
        String hash = sha256Hex(rawCode.trim());
        GroupInvite invite = groupInviteRepository.findByCodeHash(hash)
            .orElseThrow(InviteService::invalidInviteException);

        if (!isInviteUsable(invite, Instant.now())) {
            throw invalidInviteException();
        }

        Conversation conv = invite.getConversation();
        Optional<ConversationMember> existingOpt =
            conversationMemberRepository.findByConversationIdAndUserId(conv.getId(), userId);

        if (existingOpt.isPresent() && existingOpt.get().isBanned()) {
            throw invalidInviteException();
        }

        boolean alreadyMember = existingOpt.isPresent() && existingOpt.get().getLeftAt() == null;
        long memberCount = conversationMemberRepository.countByConversationIdAndLeftAtIsNull(conv.getId());

        return new InvitePreviewDto(
            conv.getId(),
            conv.getTitle(),
            conv.getAvatarUrl(),
            conv.getDescription(),
            memberCount,
            invite.isRequiresApproval(),
            alreadyMember
        );
    }

    public JoinInviteResponse join(String rawCode, Long userId) {
        enforceRateLimit(userId);
        if (rawCode == null || rawCode.isBlank()) {
            throw invalidInviteException();
        }
        String hash = sha256Hex(rawCode.trim());
        GroupInvite invite = groupInviteRepository.findByCodeHashForUpdate(hash)
            .orElseThrow(InviteService::invalidInviteException);

        Instant now = Instant.now();
        if (!isInviteUsable(invite, now)) {
            throw invalidInviteException();
        }

        Conversation conv = invite.getConversation();
        User joiningUser = userRepository.findById(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));

        Optional<ConversationMember> existingOpt =
            conversationMemberRepository.findByConversationIdAndUserId(conv.getId(), userId);

        if (existingOpt.isPresent()) {
            ConversationMember existing = existingOpt.get();
            if (existing.isBanned()) {
                throw new ApiException(HttpStatus.FORBIDDEN, "INVITE_UNAVAILABLE", "Unable to join this group with this invite link");
            }
            if (existing.getLeftAt() == null) {
                return new JoinInviteResponse("JOINED", conversationService.toDto(conv, userId), null);
            }
        }

        long currentSize = conversationMemberRepository.countByConversationIdAndLeftAtIsNull(conv.getId());
        if (currentSize >= MAX_GROUP_SIZE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "GROUP_FULL", "This group has reached its maximum size");
        }

        if (invite.isRequiresApproval()) {
            Optional<GroupJoinRequest> pendingOpt = groupJoinRequestRepository
                .findByConversationIdAndUserIdAndStatus(conv.getId(), userId, JoinRequestStatus.PENDING);
            if (pendingOpt.isPresent()) {
                return new JoinInviteResponse("PENDING", null, toJoinRequestDto(pendingOpt.get()));
            }

            invite.setUseCount(invite.getUseCount() + 1);
            groupInviteRepository.saveAndFlush(invite);

            GroupJoinRequest req = GroupJoinRequest.builder()
                .conversation(conv)
                .user(joiningUser)
                .invite(invite)
                .status(JoinRequestStatus.PENDING)
                .build();
            req = groupJoinRequestRepository.save(req);

            JoinRequestDto reqDto = toJoinRequestDto(req);
            notifyAdminsJoinRequestCreated(conv.getId(), reqDto);

            return new JoinInviteResponse("PENDING", null, reqDto);
        }

        invite.setUseCount(invite.getUseCount() + 1);
        groupInviteRepository.saveAndFlush(invite);

        addOrRestoreMember(conv, joiningUser, existingOpt.orElse(null), now);
        conversationService.createAndBroadcastSystemMessage(conv, joiningUser, joiningUser.getName() + " joined using an invite link");

        ConversationDto joinerDto = conversationService.toDto(conv, userId);
        eventPublisher.sendToUser(userId, "conversation.created", joinerDto);
        broadcastUpdatedToOthers(conv, userId);

        return new JoinInviteResponse("JOINED", joinerDto, null);
    }

    @Transactional(readOnly = true)
    public List<JoinRequestDto> listRequests(Long conversationId, Long adminId, JoinRequestStatus status) {
        conversationAccessService.requireAdmin(conversationId, adminId);
        JoinRequestStatus targetStatus = status != null ? status : JoinRequestStatus.PENDING;
        return groupJoinRequestRepository.findByConversationIdAndStatusWithUser(conversationId, targetStatus)
            .stream()
            .map(this::toJoinRequestDto)
            .toList();
    }

    public JoinRequestDto approveRequest(Long conversationId, Long adminId, Long requestId) {
        ConversationMember admin = conversationAccessService.requireAdmin(conversationId, adminId);
        GroupJoinRequest req = groupJoinRequestRepository.findByIdAndConversationId(requestId, conversationId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Join request not found"));

        if (req.getStatus() != JoinRequestStatus.PENDING) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_STATE", "Join request has already been decided");
        }

        Conversation conv = admin.getConversation();
        User targetUser = req.getUser();
        Optional<ConversationMember> existingOpt =
            conversationMemberRepository.findByConversationIdAndUserId(conversationId, targetUser.getId());

        if (existingOpt.isPresent() && existingOpt.get().isBanned()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "USER_BANNED", "Banned members must be re-added manually by an admin");
        }

        long currentSize = conversationMemberRepository.countByConversationIdAndLeftAtIsNull(conversationId);
        if (currentSize >= MAX_GROUP_SIZE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "GROUP_FULL", "This group has reached its maximum size");
        }

        // Remove any historical APPROVED row for this (conv, user) so uq_jr_pending stays satisfied
        groupJoinRequestRepository.deleteByConversationIdAndUserIdAndStatus(
            conversationId, targetUser.getId(), JoinRequestStatus.APPROVED);
        groupJoinRequestRepository.flush();

        Instant now = Instant.now();
        req.setStatus(JoinRequestStatus.APPROVED);
        req.setDecidedBy(adminId);
        req.setDecidedAt(now);
        req = groupJoinRequestRepository.save(req);

        boolean alreadyActive = existingOpt.isPresent() && existingOpt.get().getLeftAt() == null;
        if (!alreadyActive) {
            addOrRestoreMember(conv, targetUser, existingOpt.orElse(null), now);
            conversationService.createAndBroadcastSystemMessage(conv, targetUser, targetUser.getName() + " joined the group");
            eventPublisher.sendToUser(targetUser.getId(), "conversation.created", conversationService.toDto(conv, targetUser.getId()));
            broadcastUpdatedToOthers(conv, targetUser.getId());
        }

        JoinRequestDto dto = toJoinRequestDto(req);
        notifyJoinRequestDecided(conversationId, targetUser.getId(), dto);
        return dto;
    }

    public JoinRequestDto rejectRequest(Long conversationId, Long adminId, Long requestId) {
        conversationAccessService.requireAdmin(conversationId, adminId);
        GroupJoinRequest req = groupJoinRequestRepository.findByIdAndConversationId(requestId, conversationId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Join request not found"));

        if (req.getStatus() != JoinRequestStatus.PENDING) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_STATE", "Join request has already been decided");
        }

        groupJoinRequestRepository.deleteByConversationIdAndUserIdAndStatus(
            conversationId, req.getUser().getId(), JoinRequestStatus.REJECTED);
        groupJoinRequestRepository.flush();

        req.setStatus(JoinRequestStatus.REJECTED);
        req.setDecidedBy(adminId);
        req.setDecidedAt(Instant.now());
        req = groupJoinRequestRepository.save(req);

        JoinRequestDto dto = toJoinRequestDto(req);
        notifyJoinRequestDecided(conversationId, req.getUser().getId(), dto);
        return dto;
    }

    @Scheduled(cron = "0 0 * * * *")
    public void cleanupExpiredInvitesAndOldRequests() {
        Instant now = Instant.now();
        groupInviteRepository.deleteExpiredBefore(now.minus(Duration.ofDays(1)));
        groupJoinRequestRepository.deleteDecidedOlderThan(now.minus(Duration.ofDays(30)));
    }

    private void addOrRestoreMember(Conversation conv, User user, ConversationMember existing, Instant now) {
        if (existing != null) {
            existing.setLeftAt(null);
            existing.setRole(MemberRole.MEMBER);
            existing.setBanned(false);
            existing.setJoinedAt(now);
            conversationMemberRepository.save(existing);
        } else {
            ConversationMember cm = new ConversationMember(conv, user, MemberRole.MEMBER);
            cm.setJoinedAt(now);
            conversationMemberRepository.save(cm);
        }
    }

    private void broadcastUpdatedToOthers(Conversation conv, Long excludeUserId) {
        List<ConversationMember> active = conversationMemberRepository.findByConversationIdAndLeftAtIsNull(conv.getId());
        for (ConversationMember cm : active) {
            if (!cm.getUser().getId().equals(excludeUserId)) {
                eventPublisher.sendToUser(cm.getUser().getId(), "conversation.updated", conversationService.toDto(conv, cm.getUser().getId()));
            }
        }
    }

    private void notifyAdminsJoinRequestCreated(Long conversationId, JoinRequestDto reqDto) {
        List<ConversationMember> members = conversationMemberRepository.findByConversationIdAndLeftAtIsNull(conversationId);
        Map<String, Object> payload = Map.of("conversationId", conversationId, "request", reqDto);
        for (ConversationMember cm : members) {
            if (cm.getRole() == MemberRole.ADMIN) {
                eventPublisher.sendToUser(cm.getUser().getId(), "join_request.created", payload);
            }
        }
    }

    private void notifyJoinRequestDecided(Long conversationId, Long requesterId, JoinRequestDto reqDto) {
        List<ConversationMember> members = conversationMemberRepository.findByConversationIdAndLeftAtIsNull(conversationId);
        Map<String, Object> payload = Map.of("conversationId", conversationId, "request", reqDto);
        Set<Long> notified = new HashSet<>();
        for (ConversationMember cm : members) {
            if (cm.getRole() == MemberRole.ADMIN) {
                notified.add(cm.getUser().getId());
                eventPublisher.sendToUser(cm.getUser().getId(), "join_request.decided", payload);
            }
        }
        if (!notified.contains(requesterId)) {
            eventPublisher.sendToUser(requesterId, "join_request.decided", payload);
        }
    }

    private void enforceRateLimit(Long userId) {
        if (!rateLimiterService.tryConsumeInvite(userId)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "Too many invite requests. Please wait a minute.");
        }
    }

    private static ApiException invalidInviteException() {
        return new ApiException(HttpStatus.NOT_FOUND, "INVITE_INVALID", "This invite link is invalid, expired, or no longer active");
    }

    private boolean isInviteUsable(GroupInvite invite, Instant now) {
        if (invite.getRevokedAt() != null) return false;
        if (invite.getExpiresAt() != null && !invite.getExpiresAt().isAfter(now)) return false;
        if (invite.getMaxUses() != null && invite.getUseCount() >= invite.getMaxUses()) return false;
        return invite.getConversation().getType() == ConversationType.GROUP;
    }

    private InviteDto toDto(GroupInvite inv, String url, Instant now) {
        String status;
        if (inv.getRevokedAt() != null) status = "REVOKED";
        else if (inv.getExpiresAt() != null && !inv.getExpiresAt().isAfter(now)) status = "EXPIRED";
        else if (inv.getMaxUses() != null && inv.getUseCount() >= inv.getMaxUses()) status = "EXHAUSTED";
        else status = "ACTIVE";

        return new InviteDto(
            inv.getId(),
            inv.getConversation().getId(),
            url,
            inv.getCodePrefix(),
            userService.toUserSummary(inv.getCreatedBy()),
            inv.getExpiresAt(),
            inv.getMaxUses(),
            inv.getUseCount(),
            inv.isRequiresApproval(),
            status,
            inv.getRevokedAt(),
            inv.getCreatedAt()
        );
    }

    private JoinRequestDto toJoinRequestDto(GroupJoinRequest r) {
        return new JoinRequestDto(
            r.getId(),
            r.getConversation().getId(),
            userService.toUserSummary(r.getUser()),
            r.getInvite() != null ? r.getInvite().getId() : null,
            r.getStatus(),
            r.getCreatedAt(),
            r.getDecidedAt()
        );
    }

    public static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
