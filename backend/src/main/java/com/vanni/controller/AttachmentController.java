package com.vanni.controller;

import com.vanni.dto.response.AttachmentDto;
import com.vanni.security.CurrentUser;
import com.vanni.security.UserPrincipal;
import com.vanni.service.AttachmentService;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/attachments")
public class AttachmentController {

    private final AttachmentService attachmentService;

    public AttachmentController(AttachmentService attachmentService) {
        this.attachmentService = attachmentService;
    }

    @PostMapping
    public ResponseEntity<AttachmentDto> upload(
            @CurrentUser UserPrincipal principal,
            @RequestParam("file") MultipartFile file
    ) {
        AttachmentDto dto = attachmentService.uploadAttachment(principal.id(), file);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Resource> download(
            @CurrentUser UserPrincipal principal,
            @PathVariable Long id
    ) {
        return attachmentService.serveAttachment(id, principal.id());
    }
}
