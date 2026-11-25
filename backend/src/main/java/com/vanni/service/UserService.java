package com.vanni.service;

import com.vanni.dto.request.UpdateUserRequest;
import com.vanni.dto.response.UserMeResponse;
import com.vanni.dto.response.UserSummaryResponse;
import com.vanni.entity.User;
import com.vanni.exception.ApiException;
import com.vanni.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@Transactional
public class UserService {

    private final UserRepository userRepository;
    private final PresenceService presenceService;
    private final ConversationService conversationService;
    private final com.vanni.repository.BlockRepository blockRepository;

    public UserService(
            UserRepository userRepository,
            PresenceService presenceService,
            @org.springframework.context.annotation.Lazy ConversationService conversationService,
            com.vanni.repository.BlockRepository blockRepository) {
        this.userRepository = userRepository;
        this.presenceService = presenceService;
        this.conversationService = conversationService;
        this.blockRepository = blockRepository;
    }

    @Transactional(readOnly = true)
    public UserMeResponse getMe(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));
        return AuthService.toUserMe(user);
    }

    public UserMeResponse updateMe(Long userId, UpdateUserRequest req) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));

        boolean profileChanged = false;
        if (req.name() != null && !req.name().isBlank()) {
            user.setName(req.name().trim());
            profileChanged = true;
        }
        if (req.about() != null) {
            user.setAbout(req.about().trim());
            profileChanged = true;
        }
        if (req.showLastSeen() != null) {
            user.setShowLastSeen(req.showLastSeen());
        }
        if (req.showReadReceipts() != null) {
            user.setShowReadReceipts(req.showReadReceipts());
        }

        user = userRepository.save(user);
        if (profileChanged) {
            conversationService.broadcastUserConversationsUpdated(userId);
        }
        return AuthService.toUserMe(user);
    }

    @Transactional(readOnly = true)
    public UserSummaryResponse getUser(Long userId) {
        return getUser(userId, null);
    }

    @Transactional(readOnly = true)
    public UserSummaryResponse getUser(Long userId, Long requesterId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));
        boolean blocked = requesterId != null && !requesterId.equals(userId)
            && blockRepository.isBlockedEitherWay(requesterId, userId);
        if (blocked) {
            return new UserSummaryResponse(
                user.getId(),
                user.getName(),
                user.getAvatarUrl(),
                null,
                false,
                null,
                null
            );
        }
        return toUserSummary(user, null, requesterId);
    }

    @Transactional(readOnly = true)
    public List<UserSummaryResponse> search(Long currentUserId, String query, int page, int size) {
        if (query == null || query.trim().length() < 2) {
            return List.of();
        }

        String searchPattern = "%" + query.trim().toLowerCase() + "%";
        int limit = Math.min(Math.max(size, 1), 20);
        Pageable pageable = PageRequest.of(Math.max(page, 0), limit);

        return userRepository.searchUsers(currentUserId, searchPattern, pageable).stream()
            .map(this::toUserSummary)
            .toList();
    }

    public void blockUser(Long blockerId, Long blockedId) {
        if (blockerId.equals(blockedId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_OPERATION", "Cannot block yourself");
        }
        User blocker = userRepository.findById(blockerId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));
        User blocked = userRepository.findById(blockedId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Target user not found"));

        if (!blockRepository.existsByBlockerIdAndBlockedId(blockerId, blockedId)) {
            com.vanni.entity.Block block = com.vanni.entity.Block.builder()
                .blocker(blocker)
                .blocked(blocked)
                .build();
            blockRepository.save(block);
        }
    }

    public void unblockUser(Long blockerId, Long blockedId) {
        blockRepository.findByBlockerIdAndBlockedId(blockerId, blockedId)
            .ifPresent(blockRepository::delete);
    }

    @Transactional(readOnly = true)
    public List<UserSummaryResponse> getBlockedUsers(Long userId) {
        return blockRepository.findByBlockerIdWithUser(userId).stream()
            .map(b -> toUserSummary(b.getBlocked()))
            .toList();
    }

    public UserSummaryResponse toUserSummary(User user) {
        return toUserSummary(user, null);
    }

    public UserSummaryResponse toUserSummary(User user, com.vanni.entity.MemberRole role) {
        return toUserSummary(user, role, null);
    }

    public UserSummaryResponse toUserSummary(User user, com.vanni.entity.MemberRole role, Long requesterId) {
        boolean isSelf = requesterId != null && requesterId.equals(user.getId());
        boolean hidePresence = !isSelf && !user.isShowLastSeen();
        boolean online = !hidePresence && presenceService.isOnline(user.getId());
        Instant lastSeen = user.isShowLastSeen() ? user.getLastSeenAt() : null;
        return new UserSummaryResponse(
            user.getId(),
            user.getName(),
            user.getAvatarUrl(),
            user.getAbout(),
            online,
            lastSeen,
            role
        );
    }
}
