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
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class AttachmentService {

    private static final Logger log = LoggerFactory.getLogger(AttachmentService.class);

    private static final long MAX_ATTACHMENT_SIZE = 10L * 1024 * 1024; // 10 MB
    private static final long MAX_AVATAR_SIZE = 2L * 1024 * 1024; // 2 MB
    private static final int MAX_VOICE_DURATION_MS = 300_000; // 5 minutes
    private static final int WAVEFORM_BARS = 64;

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

    public AttachmentDto uploadVoice(Long uploaderId, MultipartFile file, Integer durationMs, String waveformBase64) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_FILE", "Audio file cannot be empty");
        }
        if (!rateLimiterService.tryConsumeUpload(uploaderId)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED", "Upload rate limit exceeded. Try again later.");
        }
        if (durationMs == null || durationMs <= 0 || durationMs > MAX_VOICE_DURATION_MS) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_DURATION", "Voice duration must be between 1 ms and 5 minutes");
        }
        if (waveformBase64 == null || waveformBase64.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_WAVEFORM", "Waveform is required");
        }
        byte[] waveformBytes;
        try {
            waveformBytes = Base64.getDecoder().decode(waveformBase64.trim());
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_WAVEFORM", "Waveform must be valid base64");
        }
        if (waveformBytes.length != WAVEFORM_BARS) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_WAVEFORM", "Waveform must contain exactly 64 bytes");
        }
        if (file.getSize() > MAX_ATTACHMENT_SIZE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FILE_TOO_LARGE", "Audio exceeds maximum size of 10MB");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "STORAGE_ERROR", "Failed to read audio file");
        }
        if (bytes.length > MAX_ATTACHMENT_SIZE) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FILE_TOO_LARGE", "Audio exceeds maximum size of 10MB");
        }

        User uploader = userRepository.findById(uploaderId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));

        MimeSniffer.SniffResult sniffResult = MimeSniffer.sniffAudio(bytes, file.getOriginalFilename());
        String mimeType = sniffResult.mimeType();
        String safeFileName = sniffResult.safeFileName();

        String storageKey = UUID.randomUUID() + "-" + safeFileName;
        storageService.put(storageKey, new ByteArrayInputStream(bytes), bytes.length, mimeType);

        Attachment attachment = Attachment.builder()
            .message(null)
            .uploader(uploader)
            .fileName(safeFileName)
            .mimeType(mimeType)
            .fileSize((long) bytes.length)
            .storageKey(storageKey)
            .durationMs(durationMs)
            .waveform(waveformBytes)
            .build();

        attachment = attachmentRepository.save(attachment);
        return toDto(attachment);
    }

    @Transactional(readOnly = true)
    public ResponseEntity<Resource> serveAttachment(Long attachmentId, Long userId) {
        return serveAttachment(attachmentId, userId, null);
    }

    @Transactional(readOnly = true)
    public ResponseEntity<Resource> serveAttachment(Long attachmentId, Long userId, String rangeHeader) {
        Attachment attachment = attachmentRepository.findById(attachmentId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ATTACHMENT_NOT_FOUND", "Attachment not found"));

        // Membership check
        if (attachment.getMessage() == null) {
            if (!attachment.getUploader().getId().equals(userId)) {
                throw new ApiException(HttpStatus.NOT_FOUND, "ATTACHMENT_NOT_FOUND", "Attachment not found");
            }
        } else {
            Long convId = attachment.getMessage().getConversation().getId();
            boolean isMember = conversationMemberRepository.existsByConversationIdAndUserIdAndLeftAtIsNull(convId, userId);
            if (!isMember) {
                throw new ApiException(HttpStatus.NOT_FOUND, "ATTACHMENT_NOT_FOUND", "Attachment not found");
            }
        }

        long totalSize = attachment.getFileSize() != null ? attachment.getFileSize() : 0L;
        String mime = attachment.getMimeType() != null ? attachment.getMimeType() : "application/octet-stream";
        String disposition = (mime.startsWith("image/") || "application/pdf".equals(mime) || mime.startsWith("audio/"))
            ? "inline; filename=\"" + attachment.getFileName() + "\""
            : "attachment; filename=\"" + attachment.getFileName() + "\"";

        if (rangeHeader != null && !rangeHeader.isBlank()) {
            long[] range = parseByteRange(rangeHeader.trim(), totalSize);
            if (range == null) {
                return ResponseEntity.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                    .header(HttpHeaders.CONTENT_RANGE, "bytes */" + totalSize)
                    .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                    .build();
            }
            long start = range[0];
            long end = range[1];
            long contentLength = end - start + 1;
            InputStream slice = storageService.getRange(attachment.getStorageKey(), start, contentLength);
            return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=3600")
                .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .header(HttpHeaders.CONTENT_RANGE, "bytes " + start + "-" + end + "/" + totalSize)
                .header(HttpHeaders.CONTENT_TYPE, mime)
                .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(contentLength))
                .body(new InputStreamResource(slice));
        }

        InputStream is = storageService.get(attachment.getStorageKey());
        Resource resource = new InputStreamResource(is);

        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
            .header("X-Content-Type-Options", "nosniff")
            .header(HttpHeaders.CACHE_CONTROL, "private, max-age=3600")
            .header(HttpHeaders.ACCEPT_RANGES, "bytes")
            .header(HttpHeaders.CONTENT_TYPE, mime)
            .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(totalSize))
            .body(resource);
    }

    private long[] parseByteRange(String header, long totalSize) {
        if (totalSize <= 0 || !header.startsWith("bytes=")) {
            return null;
        }
        String spec = header.substring("bytes=".length()).trim();
        int comma = spec.indexOf(',');
        if (comma >= 0) {
            spec = spec.substring(0, comma).trim();
        }
        int dash = spec.indexOf('-');
        if (dash < 0) {
            return null;
        }
        String startPart = spec.substring(0, dash).trim();
        String endPart = spec.substring(dash + 1).trim();
        try {
            long start;
            long end;
            if (startPart.isEmpty()) {
                if (endPart.isEmpty()) return null;
                long suffix = Long.parseLong(endPart);
                if (suffix <= 0) return null;
                start = Math.max(0L, totalSize - suffix);
                end = totalSize - 1;
            } else {
                start = Long.parseLong(startPart);
                end = endPart.isEmpty() ? totalSize - 1 : Math.min(Long.parseLong(endPart), totalSize - 1);
            }
            if (start < 0 || start >= totalSize || start > end) {
                return null;
            }
            return new long[]{start, end};
        } catch (NumberFormatException e) {
            return null;
        }
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
            a.getHeight(),
            a.getDurationMs(),
            decodeWaveformInts(a.getWaveform())
        );
    }

    public static List<Integer> decodeWaveformInts(byte[] raw) {
        if (raw == null || raw.length == 0) {
            return null;
        }
        List<Integer> list = new ArrayList<>(raw.length);
        for (byte b : raw) {
            list.add(b & 0xFF);
        }
        return list;
    }
}
