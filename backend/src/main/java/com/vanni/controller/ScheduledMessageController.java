package com.vanni.controller;

import com.vanni.dto.request.CreateScheduledMessageRequest;
import com.vanni.dto.request.UpdateScheduledMessageRequest;
import com.vanni.dto.response.ScheduledMessageDto;
import com.vanni.exception.ApiException;
import com.vanni.security.CurrentUser;
import com.vanni.security.RateLimiterService;
import com.vanni.security.UserPrincipal;
import com.vanni.service.ScheduledMessageService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ScheduledMessageController {

    private final ScheduledMessageService scheduledMessageService;
    private final RateLimiterService rateLimiterService;

    public ScheduledMessageController(
            ScheduledMessageService scheduledMessageService,
            RateLimiterService rateLimiterService) {
        this.scheduledMessageService = scheduledMessageService;
        this.rateLimiterService = rateLimiterService;
    }

    @PostMapping("/conversations/{id}/scheduled")
    public ResponseEntity<ScheduledMessageDto> create(
            @CurrentUser UserPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody CreateScheduledMessageRequest req) {
        if (!rateLimiterService.tryConsumeMessageSend(principal.id())) {
            throw new ApiException(
                HttpStatus.TOO_MANY_REQUESTS,
                "RATE_LIMITED",
                "Too many requests. Please slow down.",
                Map.of("retryAfterSeconds", "10")
            );
        }
        ScheduledMessageDto dto = scheduledMessageService.create(id, principal.id(), req);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @GetMapping("/scheduled")
    public ResponseEntity<List<ScheduledMessageDto>> list(
            @CurrentUser UserPrincipal principal,
            @RequestParam(required = false, defaultValue = "PENDING") String status,
            @RequestParam(required = false) Long conversationId) {
        return ResponseEntity.ok(scheduledMessageService.list(principal.id(), status, conversationId));
    }

    @PatchMapping("/scheduled/{id}")
    public ResponseEntity<ScheduledMessageDto> update(
            @CurrentUser UserPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody UpdateScheduledMessageRequest req) {
        return ResponseEntity.ok(scheduledMessageService.update(id, principal.id(), req));
    }

    @PostMapping("/scheduled/{id}/send-now")
    public ResponseEntity<ScheduledMessageDto> sendNow(
            @CurrentUser UserPrincipal principal,
            @PathVariable Long id) {
        return ResponseEntity.ok(scheduledMessageService.sendNow(id, principal.id()));
    }

    @DeleteMapping("/scheduled/{id}")
    public ResponseEntity<Void> cancel(
            @CurrentUser UserPrincipal principal,
            @PathVariable Long id) {
        scheduledMessageService.cancel(id, principal.id());
        return ResponseEntity.noContent().build();
    }
}
