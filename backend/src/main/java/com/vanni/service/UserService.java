package com.vanni.service;

import com.vanni.dto.request.UpdateUserRequest;
import com.vanni.dto.response.UserMeResponse;
import com.vanni.entity.User;
import com.vanni.exception.ApiException;
import com.vanni.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
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

        if (req.name() != null && !req.name().isBlank()) {
            user.setName(req.name().trim());
        }
        if (req.about() != null) {
            user.setAbout(req.about().trim());
        }
        if (req.showLastSeen() != null) {
            user.setShowLastSeen(req.showLastSeen());
        }
        if (req.showReadReceipts() != null) {
            user.setShowReadReceipts(req.showReadReceipts());
        }

        user = userRepository.save(user);
        return AuthService.toUserMe(user);
    }
}
