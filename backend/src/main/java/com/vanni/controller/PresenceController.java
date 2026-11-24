package com.vanni.controller;

import com.vanni.dto.response.PresenceDto;
import com.vanni.service.PresenceService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.List;

@RestController
@RequestMapping("/api/presence")
public class PresenceController {

    private final PresenceService presenceService;

    public PresenceController(PresenceService presenceService) {
        this.presenceService = presenceService;
    }

    @GetMapping
    public ResponseEntity<List<PresenceDto>> getPresence(
            @RequestParam(value = "userIds", required = false) List<Long> userIds,
            @AuthenticationPrincipal Long currentUserId) {
        if (userIds == null || userIds.isEmpty()) {
            return ResponseEntity.ok(Collections.emptyList());
        }
        List<PresenceDto> list = presenceService.getPresence(userIds, currentUserId);
        return ResponseEntity.ok(list);
    }
}
