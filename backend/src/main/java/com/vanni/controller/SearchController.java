package com.vanni.controller;

import com.vanni.dto.response.MessageDto;
import com.vanni.exception.ApiException;
import com.vanni.security.CurrentUser;
import com.vanni.security.RateLimiterService;
import com.vanni.security.UserPrincipal;
import com.vanni.service.MessageService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/search")
public class SearchController {

    private final MessageService messageService;
    private final RateLimiterService rateLimiterService;

    public SearchController(MessageService messageService, RateLimiterService rateLimiterService) {
        this.messageService = messageService;
        this.rateLimiterService = rateLimiterService;
    }

    @GetMapping("/messages")
    public ResponseEntity<List<MessageDto>> searchMessages(
            @CurrentUser UserPrincipal principal,
            @RequestParam(required = false, defaultValue = "") String q,
            @RequestParam(required = false) Long conversationId,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "20") int size
    ) {
        if (!rateLimiterService.tryConsumeSearch(principal.id())) {
            throw new ApiException(
                HttpStatus.TOO_MANY_REQUESTS,
                "RATE_LIMITED",
                "Too many search requests. Please try again shortly.",
                Map.of("retryAfterSeconds", "60")
            );
        }
        return ResponseEntity.ok(messageService.searchMessages(principal.id(), q, conversationId, page, size));
    }
}
