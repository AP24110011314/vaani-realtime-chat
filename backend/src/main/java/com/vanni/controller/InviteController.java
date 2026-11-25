package com.vanni.controller;

import com.vanni.dto.request.CreateInviteRequest;
import com.vanni.dto.response.InviteDto;
import com.vanni.dto.response.InvitePreviewDto;
import com.vanni.dto.response.JoinInviteResponse;
import com.vanni.dto.response.JoinRequestDto;
import com.vanni.entity.JoinRequestStatus;
import com.vanni.security.CurrentUser;
import com.vanni.security.UserPrincipal;
import com.vanni.service.InviteService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class InviteController {

    private final InviteService inviteService;

    public InviteController(InviteService inviteService) {
        this.inviteService = inviteService;
    }

    @PostMapping("/conversations/{id}/invites")
    public ResponseEntity<InviteDto> createInvite(
            @CurrentUser UserPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody(required = false) CreateInviteRequest req
    ) {
        InviteDto dto = inviteService.create(id, principal.id(), req);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @GetMapping("/conversations/{id}/invites")
    public ResponseEntity<List<InviteDto>> listInvites(
            @CurrentUser UserPrincipal principal,
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(inviteService.list(id, principal.id()));
    }

    @DeleteMapping("/conversations/{id}/invites/{inviteId}")
    public ResponseEntity<Void> revokeInvite(
            @CurrentUser UserPrincipal principal,
            @PathVariable Long id,
            @PathVariable Long inviteId
    ) {
        inviteService.revoke(id, principal.id(), inviteId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/invites/{code}")
    public ResponseEntity<InvitePreviewDto> previewInvite(
            @CurrentUser UserPrincipal principal,
            @PathVariable String code
    ) {
        return ResponseEntity.ok(inviteService.preview(code, principal.id()));
    }

    @PostMapping("/invites/{code}/join")
    public ResponseEntity<JoinInviteResponse> joinByInvite(
            @CurrentUser UserPrincipal principal,
            @PathVariable String code
    ) {
        JoinInviteResponse res = inviteService.join(code, principal.id());
        if ("PENDING".equals(res.status())) {
            return ResponseEntity.status(HttpStatus.ACCEPTED).body(res);
        }
        return ResponseEntity.ok(res);
    }

    @GetMapping("/conversations/{id}/join-requests")
    public ResponseEntity<List<JoinRequestDto>> listJoinRequests(
            @CurrentUser UserPrincipal principal,
            @PathVariable Long id,
            @RequestParam(required = false, defaultValue = "PENDING") JoinRequestStatus status
    ) {
        return ResponseEntity.ok(inviteService.listRequests(id, principal.id(), status));
    }

    @PostMapping("/conversations/{id}/join-requests/{requestId}/approve")
    public ResponseEntity<JoinRequestDto> approveJoinRequest(
            @CurrentUser UserPrincipal principal,
            @PathVariable Long id,
            @PathVariable Long requestId
    ) {
        return ResponseEntity.ok(inviteService.approveRequest(id, principal.id(), requestId));
    }

    @PostMapping("/conversations/{id}/join-requests/{requestId}/reject")
    public ResponseEntity<JoinRequestDto> rejectJoinRequest(
            @CurrentUser UserPrincipal principal,
            @PathVariable Long id,
            @PathVariable Long requestId
    ) {
        return ResponseEntity.ok(inviteService.rejectRequest(id, principal.id(), requestId));
    }
}
