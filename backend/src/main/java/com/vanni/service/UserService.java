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

import java.util.List;

@Service
@Transactional
public class UserService {

    private final UserRepository userRepository;
    private final PresenceService presenceService;
    private final ConversationService conversationService;

    public UserService(
            UserRepository userRepository,
            PresenceService presenceService,
            @org.springframework.context.annotation.Lazy ConversationService conversationService) {
        this.userRepository = userRepository;
        this.presenceService = presenceService;
        this.conversationService = conversationService;
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
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));
        return toUserSummary(user);
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

    public UserSummaryResponse toUserSummary(User user) {
        return toUserSummary(user, null);
    }

    public UserSummaryResponse toUserSummary(User user, com.vanni.entity.MemberRole role) {
        boolean online = presenceService.isOnline(user.getId());
        return new UserSummaryResponse(
            user.getId(),
            user.getName(),
            user.getAvatarUrl(),
            user.getAbout(),
            online,
            user.isShowLastSeen() ? user.getLastSeenAt() : null,
            role
        );
    }
}
