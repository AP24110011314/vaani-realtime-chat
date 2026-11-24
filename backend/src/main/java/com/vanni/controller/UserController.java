package com.vanni.controller;

import com.vanni.dto.request.UpdateUserRequest;
import com.vanni.dto.response.UserMeResponse;
import com.vanni.security.CurrentUser;
import com.vanni.security.UserPrincipal;
import com.vanni.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public ResponseEntity<UserMeResponse> getMe(@CurrentUser UserPrincipal principal) {
        return ResponseEntity.ok(userService.getMe(principal.id()));
    }

    @PatchMapping("/me")
    public ResponseEntity<UserMeResponse> updateMe(
            @CurrentUser UserPrincipal principal,
            @Valid @RequestBody UpdateUserRequest req
    ) {
        return ResponseEntity.ok(userService.updateMe(principal.id(), req));
    }
}
