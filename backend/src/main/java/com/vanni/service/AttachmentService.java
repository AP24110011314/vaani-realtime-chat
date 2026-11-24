package com.vanni.service;

import com.vanni.dto.response.AttachmentDto;
import com.vanni.dto.response.UserMeResponse;
import com.vanni.entity.Attachment;
import com.vanni.entity.User;
import com.vanni.exception.ApiException;
import com.vanni.repository.AttachmentRepository;
import com.vanni.repository.ConversationMemberRepository;
import com.vanni.repository.UserRepository;
import com.vanni.security.RateLimiterService;
import com.vanni.storage.StorageService;
import com.vanni.util.MimeSniffer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class AttachmentService {

    private static final Logger log = LoggerFactory.getLogger(AttachmentService.class);

    private static final long MAX_ATTACHMENT_SIZE = 10L * 1024 * 1024; // 10 MB
    private static final long MAX_AVATAR_SIZE = 2L * 1024 * 1024; // 2 MB

    private final AttachmentRepository attachmentRepository;
    private final StorageService storageService;
    private final UserRepository userRepository;
    private final ConversationMemberRepository conversationMemberRepository;
    private final RateLimiterService rateLimiterService;
    private final ConversationService conversationService;

    public AttachmentService(
            AttachmentRepository attachmentRepository,
            StorageService storageService,
            UserRepository userRepository,
            ConversationMemberRepository conversationMemberRepository,
            RateLimiterService rateLimiterService,
            ConversationService conversationService) {
        this.attachmentRepository = attachmentRepository;
        this.storageService = storageService;
        this.userRepository = userRepository;
        this.conversationMemberRepository = conversationMemberRepository;
        this.rateLimiterService = rateLimiterService;
        this.conversationService = conversationService;
    }

    public AttachmentDto uploadAttachment(Long uploaderId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_FILE", "File cannot be empty");
        }

        // 1. Rate limiting check (20 uploads / hour / user)
        if (!rateLimiterService.tryConsumeUpload(uploaderId)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "Upload rate limit exceeded. Try again later.");
        }

        // 2. Size limit check
        if (file.getSize() > MAX_ATTACHMENT_SIZE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FILE_TOO_LARGE", "File exceeds maximum size of 10MB");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "STORAGE_ERROR", "Failed to read uploaded file");
        }

        if (bytes.length > MAX_ATTACHMENT_SIZE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FILE_TOO_LARGE", "File exceeds maximum size of 10MB");
        }

        User uploader = userRepository.findById(uploaderId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));

        // 3. Content sniffing vs allowlist and spoof detection
        MimeSniffer.SniffResult sniffResult = MimeSniffer.sniff(bytes, file.getOriginalFilename());
        String mimeType = sniffResult.mimeType();
        String safeFileName = sniffResult.safeFileName();

        // 4. Dimensions and EXIF stripping for images
        Integer width = null;
        Integer height = null;
        byte[] finalBytes = bytes;

        if (mimeType.startsWith("image/")) {
            try {
                BufferedImage img = ImageIO.read(new ByteArrayInputStream(bytes));
                if (img != null) {
                    width = img.getWidth();
                    height = img.getHeight();

                    // Strip EXIF by re-encoding JPEG/PNG
                    if ("image/jpeg".equals(mimeType)) {
                        ByteArrayOutputStream baos = new ByteArrayOutputStream();
                        BufferedImage rgbImg = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
                        Graphics2D g = rgbImg.createGraphics();
                        g.drawImage(img, 0, 0, Color.WHITE, null);
                        g.dispose();
                        if (ImageIO.write(rgbImg, "jpg", baos)) {
                            finalBytes = baos.toByteArray();
                        }
                    } else if ("image/png".equals(mimeType)) {
                        ByteArrayOutputStream baos = new ByteArrayOutputStream();
                        if (ImageIO.write(img, "png", baos)) {
                            finalBytes = baos.toByteArray();
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Could not extract image metadata or strip EXIF: {}", e.getMessage());
            }
        }

        // 5. Random storage key
        String storageKey = UUID.randomUUID().toString() + "-" + safeFileName;
        storageService.put(storageKey, new ByteArrayInputStream(finalBytes), finalBytes.length, mimeType);

        // 6. Create unattached row
        Attachment attachment = Attachment.builder()
            .message(null)
            .uploader(uploader)
            .fileName(safeFileName)
            .mimeType(mimeType)
            .fileSize((long) finalBytes.length)
            .storageKey(storageKey)
            .width(width)
            .height(height)
            .build();

        attachment = attachmentRepository.save(attachment);
        return toDto(attachment);
    }

    @Transactional(readOnly = true)
    public ResponseEntity<Resource> serveAttachment(Long attachmentId, Long userId) {
        Attachment attachment = attachmentRepository.findById(attachmentId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ATTACHMENT_NOT_FOUND", "Attachment not found"));

        // Membership check
        if (attachment.getMessage() == null) {
            // Unattached: only accessible by the uploader
            if (!attachment.getUploader().getId().equals(userId)) {
                throw new ApiException(HttpStatus.NOT_FOUND, "ATTACHMENT_NOT_FOUND", "Attachment not found");
            }
        } else {
            // Attached: only accessible by members of the conversation
            Long convId = attachment.getMessage().getConversation().getId();
            boolean isMember = conversationMemberRepository.existsByConversationIdAndUserIdAndLeftAtIsNull(convId, userId);
            if (!isMember) {
                throw new ApiException(HttpStatus.NOT_FOUND, "ATTACHMENT_NOT_FOUND", "Attachment not found");
            }
        }

        InputStream is = storageService.get(attachment.getStorageKey());
        Resource resource = new InputStreamResource(is);

        String disposition;
        if (attachment.getMimeType().startsWith("image/") || "application/pdf".equals(attachment.getMimeType())) {
            disposition = "inline; filename=\"" + attachment.getFileName() + "\"";
        } else {
            disposition = "attachment; filename=\"" + attachment.getFileName() + "\"";
        }

        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
            .header("X-Content-Type-Options", "nosniff")
            .header(HttpHeaders.CONTENT_TYPE, attachment.getMimeType())
            .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(attachment.getFileSize()))
            .body(resource);
    }

    public UserMeResponse uploadAvatar(Long userId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_FILE", "Avatar file cannot be empty");
        }

        if (file.getSize() > MAX_AVATAR_SIZE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FILE_TOO_LARGE", "Avatar exceeds maximum size of 2MB");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "STORAGE_ERROR", "Failed to read avatar file");
        }

        if (bytes.length > MAX_AVATAR_SIZE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FILE_TOO_LARGE", "Avatar exceeds maximum size of 2MB");
        }

        // Sniff image MIME
        MimeSniffer.SniffResult sniffResult = MimeSniffer.sniff(bytes, file.getOriginalFilename());
        String mime = sniffResult.mimeType();
        if (!"image/jpeg".equals(mime) && !"image/png".equals(mime) && !"image/webp".equals(mime)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DISALLOWED_FILE_TYPE", "Only JPEG, PNG, or WebP images are allowed for avatars");
        }

        // Strip EXIF and re-encode to PNG
        byte[] pngBytes;
        try {
            BufferedImage img = ImageIO.read(new ByteArrayInputStream(bytes));
            if (img == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_IMAGE", "Could not process avatar image");
            }
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(img, "png", baos);
            pngBytes = baos.toByteArray();
        } catch (IOException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_IMAGE", "Failed to process image data");
        }

        String avatarKey = "avatar-user-" + userId + ".png";
        storageService.put(avatarKey, new ByteArrayInputStream(pngBytes), pngBytes.length, "image/png");

        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));

        user.setAvatarUrl("/api/users/" + userId + "/avatar?v=" + System.currentTimeMillis());
        user = userRepository.save(user);

        // Broadcast conversation.updated to active members so avatars update live without re-login
        conversationService.broadcastUserConversationsUpdated(userId);

        return AuthService.toUserMe(user);
    }

    public UserMeResponse deleteAvatar(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));

        if (user.getAvatarUrl() != null) {
            storageService.delete("avatar-user-" + userId + ".png");
            user.setAvatarUrl(null);
            user = userRepository.save(user);
            conversationService.broadcastUserConversationsUpdated(userId);
        }

        return AuthService.toUserMe(user);
    }

    @Transactional(readOnly = true)
    public ResponseEntity<Resource> serveAvatar(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));

        if (user.getAvatarUrl() == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "AVATAR_NOT_FOUND", "User does not have an avatar");
        }

        InputStream is = storageService.get("avatar-user-" + userId + ".png");
        Resource resource = new InputStreamResource(is);

        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"avatar.png\"")
            .header("X-Content-Type-Options", "nosniff")
            .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
            .contentType(MediaType.IMAGE_PNG)
            .body(resource);
    }

    @Scheduled(cron = "0 0 * * * *")
    public void cleanupUnattachedAttachments() {
        Instant cutoff = Instant.now().minus(24, ChronoUnit.HOURS);
        List<Attachment> expired = attachmentRepository.findByMessageIsNullAndCreatedAtBefore(cutoff);
        log.info("Running scheduled cleanup for unattached attachments older than 24h. Found: {}", expired.size());
        for (Attachment att : expired) {
            try {
                storageService.delete(att.getStorageKey());
                attachmentRepository.delete(att);
            } catch (Exception e) {
                log.warn("Failed to clean up unattached attachment id {}: {}", att.getId(), e.getMessage());
            }
        }
    }

    public AttachmentDto toDto(Attachment a) {
        return new AttachmentDto(
            a.getId(),
            a.getFileName(),
            a.getMimeType(),
            a.getFileSize() != null ? a.getFileSize() : 0L,
            "/api/attachments/" + a.getId(),
            a.getWidth(),
            a.getHeight()
        );
    }
}
