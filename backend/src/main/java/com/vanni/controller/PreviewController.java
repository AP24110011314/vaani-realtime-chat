package com.vanni.controller;

import com.vanni.service.LinkPreviewService;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/previews")
public class PreviewController {

    private final LinkPreviewService linkPreviewService;

    public PreviewController(LinkPreviewService linkPreviewService) {
        this.linkPreviewService = linkPreviewService;
    }

    @GetMapping("/{id}/image")
    public ResponseEntity<Resource> getPreviewImage(@PathVariable Long id) {
        return linkPreviewService.servePreviewImage(id);
    }
}
