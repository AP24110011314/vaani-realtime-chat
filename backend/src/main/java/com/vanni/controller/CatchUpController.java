package com.vanni.controller;

import com.vanni.dto.request.CatchUpRequest;
import com.vanni.dto.response.CatchUpResponse;
import com.vanni.security.CurrentUser;
import com.vanni.security.UserPrincipal;
import com.vanni.service.CatchUpService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/conversations/{id}/catch-up")
public class CatchUpController {

    private final CatchUpService catchUpService;

    public CatchUpController(CatchUpService catchUpService) {
        this.catchUpService = catchUpService;
    }

    @PostMapping
    public ResponseEntity<CatchUpResponse> catchUp(
            @CurrentUser UserPrincipal principal,
            @PathVariable Long id,
            @RequestBody(required = false) CatchUpRequest req) {
        return ResponseEntity.ok(catchUpService.catchUp(id, principal.id(), req));
    }
}
