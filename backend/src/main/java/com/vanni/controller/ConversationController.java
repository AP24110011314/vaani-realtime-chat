package com.vanni.controller;

import com.vanni.dto.request.AddMembersRequest;
import com.vanni.dto.request.ConversationSettingsRequest;
import com.vanni.dto.request.CreateDirectConversationRequest;
import com.vanni.dto.request.CreateGroupRequest;
import com.vanni.dto.request.SetRoleRequest;
import com.vanni.dto.request.UpdateGroupRequest;
import com.vanni.dto.response.ConversationDto;
import com.vanni.security.CurrentUser;
import com.vanni.security.UserPrincipal;
import com.vanni.service.ConversationService;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/conversations")
public class ConversationController {

    private final ConversationService conversationService;

    public ConversationController(ConversationService conversationService) {
        this.conversationService = conversationService;
    }

    @GetMapping
    public ResponseEntity<List<ConversationDto>> getConversations(
            @CurrentUser UserPrincipal principal,
            @RequestParam(required = false, defaultValue = "false") boolean archived
    ) {
        return ResponseEntity.ok(conversationService.getConversations(principal.id(), archived));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ConversationDto> getConversation(
            @CurrentUser UserPrincipal principal,
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(conversationService.getConversation(id, principal.id()));
    }

    @PostMapping("/direct")
    public ResponseEntity<ConversationDto> createOrGetDirect(
            @CurrentUser UserPrincipal principal,
            @Valid @RequestBody CreateDirectConversationRequest req
    ) {
        ConversationDto dto = conversationService.getOrCreateDirect(principal.id(), req.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @PostMapping("/groups")
    public ResponseEntity<ConversationDto> createGroup(
            @CurrentUser UserPrincipal principal,
            @Valid @RequestBody CreateGroupRequest req
    ) {
        ConversationDto dto = conversationService.createGroup(principal.id(), req);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ConversationDto> updateGroup(
            @CurrentUser UserPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody UpdateGroupRequest req
    ) {
        ConversationDto dto = conversationService.updateGroup(id, principal.id(), req);
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/{id}/members")
    public ResponseEntity<ConversationDto> addMembers(
            @CurrentUser UserPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody AddMembersRequest req
    ) {
        ConversationDto dto = conversationService.addMembers(id, principal.id(), req);
        return ResponseEntity.ok(dto);
    }

    @DeleteMapping("/{id}/members/{userId}")
    public ResponseEntity<Void> removeMember(
            @CurrentUser UserPrincipal principal,
            @PathVariable Long id,
            @PathVariable Long userId
    ) {
        conversationService.removeMember(id, principal.id(), userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/leave")
    public ResponseEntity<Void> leaveGroup(
            @CurrentUser UserPrincipal principal,
            @PathVariable Long id
    ) {
        conversationService.leave(id, principal.id());
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/members/{userId}/role")
    public ResponseEntity<ConversationDto> setRole(
            @CurrentUser UserPrincipal principal,
            @PathVariable Long id,
            @PathVariable Long userId,
            @Valid @RequestBody SetRoleRequest req
    ) {
        ConversationDto dto = conversationService.setRole(id, principal.id(), userId, req.role());
        return ResponseEntity.ok(dto);
    }

    @PatchMapping("/{id}/settings")
    public ResponseEntity<ConversationDto> updateSettings(
            @CurrentUser UserPrincipal principal,
            @PathVariable Long id,
            @RequestBody ConversationSettingsRequest req
    ) {
        ConversationDto dto = conversationService.updateSettings(id, principal.id(), req);
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/{id}/avatar")
    public ResponseEntity<ConversationDto> uploadAvatar(
            @CurrentUser UserPrincipal principal,
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file
    ) {
        ConversationDto dto = conversationService.uploadGroupAvatar(id, principal.id(), file);
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/{id}/avatar")
    public ResponseEntity<Resource> getAvatar(@PathVariable Long id) {
        return conversationService.serveGroupAvatar(id);
    }
}
