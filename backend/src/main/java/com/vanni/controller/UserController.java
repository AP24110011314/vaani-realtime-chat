package com.vanni.controller;

import com.vanni.dto.request.UpdateUserRequest;
import com.vanni.dto.response.UserMeResponse;
import com.vanni.dto.response.UserSummaryResponse;
import com.vanni.security.CurrentUser;
import com.vanni.security.UserPrincipal;
import com.vanni.service.AttachmentService;
import com.vanni.service.UserService;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final AttachmentService attachmentService;

    public UserController(UserService userService, AttachmentService attachmentService) {
        this.userService = userService;
        this.attachmentService = attachmentService;
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

    @PostMapping("/me/avatar")
    public ResponseEntity<UserMeResponse> uploadAvatar(
            @CurrentUser UserPrincipal principal,
            @RequestParam("file") MultipartFile file
    ) {
        return ResponseEntity.ok(attachmentService.uploadAvatar(principal.id(), file));
    }

    @DeleteMapping("/me/avatar")
    public ResponseEntity<UserMeResponse> deleteAvatar(@CurrentUser UserPrincipal principal) {
        return ResponseEntity.ok(attachmentService.deleteAvatar(principal.id()));
    }

    @GetMapping("/{id}/avatar")
    public ResponseEntity<Resource> getAvatar(@PathVariable Long id) {
        return attachmentService.serveAvatar(id);
    }

    @GetMapping
    public ResponseEntity<List<UserSummaryResponse>> searchUsers(
            @CurrentUser UserPrincipal principal,
            @RequestParam(required = false, defaultValue = "") String query,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(userService.search(principal.id(), query, page, size));
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserSummaryResponse> getUser(@PathVariable Long id) {
        return ResponseEntity.ok(userService.getUser(id));
    }

    @PostMapping("/{id}/block")
    public ResponseEntity<Void> blockUser(
            @CurrentUser UserPrincipal principal,
            @PathVariable Long id
    ) {
        userService.blockUser(principal.id(), id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/block")
    public ResponseEntity<Void> unblockUser(
            @CurrentUser UserPrincipal principal,
            @PathVariable Long id
    ) {
        userService.unblockUser(principal.id(), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/blocked")
    public ResponseEntity<List<UserSummaryResponse>> getBlockedUsers(@CurrentUser UserPrincipal principal) {
        return ResponseEntity.ok(userService.getBlockedUsers(principal.id()));
    }
}
