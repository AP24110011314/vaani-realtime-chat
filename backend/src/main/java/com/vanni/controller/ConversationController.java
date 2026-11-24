package com.vanni.controller;

import com.vanni.dto.request.CreateDirectConversationRequest;
import com.vanni.dto.response.ConversationDto;
import com.vanni.security.CurrentUser;
import com.vanni.security.UserPrincipal;
import com.vanni.service.ConversationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
}
