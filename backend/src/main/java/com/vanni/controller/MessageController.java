package com.vanni.controller;

import com.vanni.dto.request.SendMessageRequest;
import com.vanni.dto.response.MessageDto;
import com.vanni.security.CurrentUser;
import com.vanni.security.UserPrincipal;
import com.vanni.service.MessageService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/conversations/{id}/messages")
public class MessageController {

    private final MessageService messageService;

    public MessageController(MessageService messageService) {
        this.messageService = messageService;
    }

    @GetMapping
    public ResponseEntity<List<MessageDto>> getMessages(
            @CurrentUser UserPrincipal principal,
            @PathVariable Long id,
            @RequestParam(required = false) Long before,
            @RequestParam(required = false) Long after,
            @RequestParam(required = false, defaultValue = "30") int size
    ) {
        return ResponseEntity.ok(messageService.getHistory(id, principal.id(), before, after, size));
    }

    @PostMapping
    public ResponseEntity<MessageDto> sendMessage(
            @CurrentUser UserPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody SendMessageRequest req
    ) {
        MessageDto dto = messageService.send(id, principal.id(), req);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }
}
