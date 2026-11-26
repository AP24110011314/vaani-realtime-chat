package com.vanni.controller;

import com.vanni.dto.response.IceServersResponse;
import com.vanni.security.CurrentUser;
import com.vanni.security.UserPrincipal;
import com.vanni.service.IceServerService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/calls")
public class CallController {

    private final IceServerService iceServerService;

    public CallController(IceServerService iceServerService) {
        this.iceServerService = iceServerService;
    }

    @GetMapping("/ice-servers")
    public ResponseEntity<IceServersResponse> getIceServers(@CurrentUser UserPrincipal principal) {
        return ResponseEntity.ok(iceServerService.getIceServers(principal.id()));
    }
}
