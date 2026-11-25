package com.vanni.controller;

import com.vanni.dto.response.PresenceDto;
import com.vanni.security.CurrentUser;
import com.vanni.security.UserPrincipal;
import com.vanni.service.PresenceService;
import org.springframework.http.ResponseEntity;
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
            @CurrentUser UserPrincipal principal) {
        if (userIds == null || userIds.isEmpty()) {
            return ResponseEntity.ok(Collections.emptyList());
        }
        Long currentUserId = principal != null ? principal.id() : null;
        List<PresenceDto> list = presenceService.getPresence(userIds, currentUserId);
        return ResponseEntity.ok(list);
    }
}
