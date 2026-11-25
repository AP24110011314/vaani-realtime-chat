package com.vanni.controller;

import com.vanni.dto.request.EditMessageRequest;
import com.vanni.dto.request.ReactionRequest;
import com.vanni.dto.response.MessageDto;
import com.vanni.security.CurrentUser;
import com.vanni.security.UserPrincipal;
import com.vanni.service.LinkPreviewService;
import com.vanni.service.MessageService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/messages")
public class MessageItemController {

    private final MessageService messageService;
    private final LinkPreviewService linkPreviewService;

    public MessageItemController(MessageService messageService, LinkPreviewService linkPreviewService) {
        this.messageService = messageService;
        this.linkPreviewService = linkPreviewService;
    }

    @PatchMapping("/{id}")
    public ResponseEntity<MessageDto> editMessage(
            @PathVariable Long id,
            @Valid @RequestBody EditMessageRequest req,
            @CurrentUser UserPrincipal principal
    ) {
        return ResponseEntity.ok(messageService.editMessage(id, principal.id(), req.content()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMessage(
            @PathVariable Long id,
            @CurrentUser UserPrincipal principal
    ) {
        messageService.deleteMessage(id, principal.id());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/reactions")
    public ResponseEntity<MessageDto> toggleReaction(
            @PathVariable Long id,
            @Valid @RequestBody ReactionRequest req,
            @CurrentUser UserPrincipal principal
    ) {
        return ResponseEntity.ok(messageService.toggleReaction(id, principal.id(), req.emoji()));
    }

    @DeleteMapping("/{id}/previews")
    public ResponseEntity<Void> removePreviews(
            @PathVariable Long id,
            @CurrentUser UserPrincipal principal
    ) {
        linkPreviewService.removePreviewsForMessage(id, principal.id());
        return ResponseEntity.noContent().build();
    }
}
