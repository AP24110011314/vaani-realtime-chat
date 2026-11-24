package com.vanni.controller;

import com.vanni.dto.request.MarkReadRequest;
import com.vanni.dto.response.ReceiptDetailResponse;
import com.vanni.security.CurrentUser;
import com.vanni.security.UserPrincipal;
import com.vanni.service.ReceiptService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class ReceiptController {

    private final ReceiptService receiptService;

    public ReceiptController(ReceiptService receiptService) {
        this.receiptService = receiptService;
    }

    @PostMapping("/conversations/{id}/read")
    public ResponseEntity<Void> markRead(
            @PathVariable Long id,
            @RequestBody(required = false) MarkReadRequest req,
            @CurrentUser UserPrincipal principal
    ) {
        Long upToId = req != null ? (req.upToMessageId() != null ? req.upToMessageId() : req.lastMessageId()) : null;
        receiptService.markRead(principal.id(), id, upToId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/messages/{id}/receipts")
    public ResponseEntity<List<ReceiptDetailResponse>> getReceipts(
            @PathVariable Long id,
            @CurrentUser UserPrincipal principal
    ) {
        return ResponseEntity.ok(receiptService.getReceiptsForMessage(id, principal.id()));
    }
}
