package com.vanni.controller;

import com.vanni.dto.request.SendMessageRequest;
import com.vanni.dto.response.MessageDto;
import com.vanni.exception.ApiException;
import com.vanni.security.CurrentUser;
import com.vanni.security.RateLimiterService;
import com.vanni.security.UserPrincipal;
import com.vanni.service.MessageService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/conversations/{id}/messages")
public class MessageController {

    private final MessageService messageService;
    private final RateLimiterService rateLimiterService;

    public MessageController(MessageService messageService, RateLimiterService rateLimiterService) {
        this.messageService = messageService;
        this.rateLimiterService = rateLimiterService;
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
        if (!rateLimiterService.tryConsumeMessageSend(principal.id())) {
            throw new ApiException(
                HttpStatus.TOO_MANY_REQUESTS,
                "RATE_LIMITED",
                "Too many messages sent. Please slow down.",
                Map.of("retryAfterSeconds", "10")
            );
        }
        MessageDto dto = messageService.send(id, principal.id(), req);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }
}
