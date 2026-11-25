package com.vanni.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.vanni.dto.response.LinkPreviewDto;
import com.vanni.dto.response.MessageDto;
import com.vanni.entity.*;
import com.vanni.exception.ApiException;
import com.vanni.repository.*;
import com.vanni.security.RateLimiterService;
import com.vanni.storage.StorageService;
import com.vanni.util.MimeSniffer;
import com.vanni.util.UrlExtractor;
import com.vanni.util.UrlNormalizer;
import net.coobird.thumbnailator.Thumbnails;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;

@Service
public class LinkPreviewService {

    private static final Logger log = LoggerFactory.getLogger(LinkPreviewService.class);
    private static final Duration OK_TTL = Duration.ofHours(24);
    private static final Duration FAILURE_TTL = Duration.ofHours(1);
    private static final int MAX_IMAGE_WIDTH = 600;
    private static final int MAX_PER_DOMAIN_CONCURRENT = 2;

    private final LinkPreviewRepository linkPreviewRepository;
    private final MessageLinkPreviewRepository messageLinkPreviewRepository;
    private final MessageRepository messageRepository;
    private final ConversationMemberRepository conversationMemberRepository;
    private final SafeHttpFetcher safeHttpFetcher;
    private final StorageService storageService;
    private final RateLimiterService rateLimiterService;
    private final EventPublisher eventPublisher;
    private final MessageService messageService;
    private final TransactionTemplate transactionTemplate;
    private final boolean allowLocalhostForTests;

    private final Cache<String, LinkPreviewDto> hotCache = Caffeine.newBuilder()
        .maximumSize(500)
        .expireAfterWrite(Duration.ofMinutes(15))
        .build();

    private final ConcurrentHashMap<String, Semaphore> domainSemaphores = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Object> urlLocks = new ConcurrentHashMap<>();

    public LinkPreviewService(
            LinkPreviewRepository linkPreviewRepository,
            MessageLinkPreviewRepository messageLinkPreviewRepository,
            MessageRepository messageRepository,
            ConversationMemberRepository conversationMemberRepository,
            SafeHttpFetcher safeHttpFetcher,
            StorageService storageService,
            RateLimiterService rateLimiterService,
            EventPublisher eventPublisher,
            @Lazy MessageService messageService,
            PlatformTransactionManager transactionManager,
            @Value("${app.link-previews.allow-localhost-for-tests:false}") boolean allowLocalhostForTests) {
        this.linkPreviewRepository = linkPreviewRepository;
        this.messageLinkPreviewRepository = messageLinkPreviewRepository;
        this.messageRepository = messageRepository;
        this.conversationMemberRepository = conversationMemberRepository;
        this.safeHttpFetcher = safeHttpFetcher;
        this.storageService = storageService;
        this.rateLimiterService = rateLimiterService;
        this.eventPublisher = eventPublisher;
        this.messageService = messageService;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.allowLocalhostForTests = allowLocalhostForTests;
    }

    @Async("linkPreviewExecutor")
    public void processMessageAsync(Long messageId, Long requesterId) {
        try {
            processMessageInternal(messageId, requesterId);
        } catch (Exception e) {
            log.warn("Async link preview task failed for message {}: {}", messageId, e.getClass().getSimpleName());
        }
    }

    public void processMessageInternal(Long messageId, Long requesterId) {
        Message msg = messageRepository.findById(messageId).orElse(null);
        if (msg == null || msg.getDeletedAt() != null || msg.getMessageType() == MessageType.VOICE) {
            return;
        }
        Optional<String> extractedOpt = UrlExtractor.extractFirstUrl(msg.getContent());
        if (extractedOpt.isEmpty()) {
            return;
        }
        Optional<UrlNormalizer.NormalizedUrl> normalizedOpt =
            UrlNormalizer.normalizeAndValidate(extractedOpt.get(), allowLocalhostForTests);
        if (normalizedOpt.isEmpty()) {
            return;
        }

        UrlNormalizer.NormalizedUrl normalized = normalizedOpt.get();
        LinkPreview preview = getOrFetchPreview(normalized, requesterId);
        if (preview == null || preview.getStatus() != LinkPreviewStatus.OK) {
            return;
        }

        transactionTemplate.executeWithoutResult(tx -> {
            Message freshMsg = messageRepository.findById(messageId).orElse(null);
            if (freshMsg == null || freshMsg.getDeletedAt() != null) {
                return;
            }
            Optional<String> currentUrl = UrlExtractor.extractFirstUrl(freshMsg.getContent());
            if (currentUrl.isEmpty() || !currentUrl.get().equals(extractedOpt.get())) {
                return;
            }

            messageLinkPreviewRepository.deleteByMessageId(messageId);
            messageLinkPreviewRepository.flush();
            LinkPreview managedPreview = linkPreviewRepository.findById(preview.getId()).orElse(preview);
            messageLinkPreviewRepository.save(new MessageLinkPreview(freshMsg, managedPreview, 0));

            List<ConversationMember> members =
                conversationMemberRepository.findByConversationIdAndLeftAtIsNull(freshMsg.getConversation().getId());
            for (ConversationMember cm : members) {
                MessageDto updatedDto = messageService.toDto(freshMsg, cm.getUser().getId(), false);
                eventPublisher.sendToUser(cm.getUser().getId(), "message.updated", updatedDto);
            }
        });
    }

    public LinkPreview getOrFetchPreview(UrlNormalizer.NormalizedUrl normalized, Long requesterId) {
        Object lock = urlLocks.computeIfAbsent(normalized.urlHash(), k -> new Object());
        synchronized (lock) {
            Instant now = Instant.now();
            Optional<LinkPreview> existingOpt = linkPreviewRepository.findByUrlHash(normalized.urlHash());
            if (existingOpt.isPresent()) {
                LinkPreview existing = existingOpt.get();
                if (existing.getExpiresAt().isAfter(now)) {
                    if (existing.getStatus() == LinkPreviewStatus.OK) {
                        hotCache.put(normalized.urlHash(), toDto(existing));
                    }
                    return existing;
                }
            }

            if (requesterId != null && !rateLimiterService.tryConsumeLinkPreview(requesterId)) {
                log.info("Link preview rate limit hit for host {}", normalized.asciiHost());
                return null;
            }

            Semaphore sem = domainSemaphores.computeIfAbsent(normalized.asciiHost(), h -> new Semaphore(MAX_PER_DOMAIN_CONCURRENT));
            if (!sem.tryAcquire()) {
                log.info("Link preview domain concurrency skipped for host {}", normalized.asciiHost());
                return null;
            }

            try {
                return fetchAndStore(normalized, existingOpt.orElse(null));
            } finally {
                sem.release();
            }
        }
    }

    private LinkPreview fetchAndStore(UrlNormalizer.NormalizedUrl normalized, LinkPreview existingRow) {
        Instant now = Instant.now();
        String finalUrl = normalized.normalized();
        String siteName = null;
        String title = null;
        String description = null;
        String imageKey = existingRow != null ? existingRow.getImageKey() : null;
        Integer imageWidth = existingRow != null ? existingRow.getImageWidth() : null;
        Integer imageHeight = existingRow != null ? existingRow.getImageHeight() : null;
        LinkPreviewStatus status;

        try {
            SafeHttpFetcher.FetchResult page = safeHttpFetcher.fetch(
                normalized.normalized(),
                SafeHttpFetcher.MAX_HTML_BYTES,
                Set.of("text/html", "application/xhtml+xml")
            );
            finalUrl = truncate(page.finalUrl(), 2048);
            String html = new String(page.body(), StandardCharsets.UTF_8);
            Document doc = Jsoup.parse(html, finalUrl);

            title = firstNonBlank(
                metaContent(doc, "meta[property=og:title]"),
                metaContent(doc, "meta[name=twitter:title]"),
                doc.title()
            );
            description = firstNonBlank(
                metaContent(doc, "meta[property=og:description]"),
                metaContent(doc, "meta[name=twitter:description]"),
                metaContent(doc, "meta[name=description]")
            );
            siteName = firstNonBlank(
                metaContent(doc, "meta[property=og:site_name]"),
                safeHost(finalUrl)
            );

            title = truncate(title, 200);
            description = truncate(description, 300);
            siteName = truncate(siteName, 100);

            String rawImg = firstNonBlank(
                metaContent(doc, "meta[property=og:image]"),
                metaContent(doc, "meta[name=twitter:image]"),
                metaContent(doc, "meta[name=twitter:image:src]")
            );

            if (rawImg != null && !rawImg.isBlank()) {
                try {
                    String resolvedImgUrl = URI.create(finalUrl).resolve(rawImg.trim()).toString();
                    StoredPreviewImage storedImg = fetchAndStoreImage(resolvedImgUrl);
                    if (storedImg != null) {
                        if (imageKey != null && !imageKey.equals(storedImg.key())) {
                            storageService.delete(imageKey);
                        }
                        imageKey = storedImg.key();
                        imageWidth = storedImg.width();
                        imageHeight = storedImg.height();
                    }
                } catch (Exception ignored) {
                    // Metadata preview still saved even if preview image failed
                }
            }

            if (title == null && description == null && imageKey == null) {
                status = LinkPreviewStatus.FAILED;
            } else {
                status = LinkPreviewStatus.OK;
            }
            log.info("Link preview fetch host={} result={}", normalized.asciiHost(), status);
        } catch (SafeHttpFetcher.SafeFetchException e) {
            status = e.isBlocked() ? LinkPreviewStatus.BLOCKED : LinkPreviewStatus.FAILED;
            log.info("Link preview fetch host={} result={}", normalized.asciiHost(), status);
        } catch (Exception e) {
            status = LinkPreviewStatus.FAILED;
            log.info("Link preview fetch host={} result={}", normalized.asciiHost(), status);
        }

        LinkPreview entity = existingRow != null ? existingRow : new LinkPreview();
        entity.setUrlHash(normalized.urlHash());
        entity.setUrl(normalized.normalized());
        entity.setFinalUrl(finalUrl);
        entity.setSiteName(siteName);
        entity.setTitle(title);
        entity.setDescription(description);
        entity.setImageKey(imageKey);
        entity.setImageWidth(imageWidth);
        entity.setImageHeight(imageHeight);
        entity.setStatus(status);
        entity.setFetchedAt(now);
        entity.setExpiresAt(now.plus(status == LinkPreviewStatus.OK ? OK_TTL : FAILURE_TTL));

        try {
            entity = linkPreviewRepository.save(entity);
        } catch (DataIntegrityViolationException ex) {
            entity = linkPreviewRepository.findByUrlHash(normalized.urlHash()).orElse(entity);
        }

        if (entity.getStatus() == LinkPreviewStatus.OK) {
            hotCache.put(normalized.urlHash(), toDto(entity));
        }
        return entity;
    }

    private record StoredPreviewImage(String key, int width, int height) {}

    private StoredPreviewImage fetchAndStoreImage(String resolvedImageUrl) {
        SafeHttpFetcher.FetchResult imgRes = safeHttpFetcher.fetch(
            resolvedImageUrl,
            SafeHttpFetcher.MAX_IMAGE_BYTES,
            Set.of("image/jpeg", "image/png", "image/gif", "image/webp")
        );
        byte[] bytes = imgRes.body();
        if (bytes == null || bytes.length == 0) {
            return null;
        }
        MimeSniffer.SniffResult sniffed = MimeSniffer.sniff(bytes, "preview");
        String mime = sniffed.mimeType();
        if (!"image/jpeg".equals(mime) && !"image/png".equals(mime)
                && !"image/gif".equals(mime) && !"image/webp".equals(mime)) {
            return null;
        }

        try {
            BufferedImage bi = ImageIO.read(new ByteArrayInputStream(bytes));
            if (bi == null || bi.getWidth() <= 0 || bi.getHeight() <= 0) {
                return null;
            }
            int outWidth = bi.getWidth();
            int outHeight = bi.getHeight();
            String outputFormat = bi.getColorModel().hasAlpha() ? "png" : "jpg";
            String outputMime = "png".equals(outputFormat) ? "image/png" : "image/jpeg";

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            if (outWidth > MAX_IMAGE_WIDTH) {
                outHeight = Math.max(1, (int) Math.round((double) outHeight * MAX_IMAGE_WIDTH / outWidth));
                outWidth = MAX_IMAGE_WIDTH;
                Thumbnails.of(bi)
                    .size(outWidth, outHeight)
                    .outputFormat(outputFormat)
                    .outputQuality(0.85f)
                    .toOutputStream(baos);
            } else {
                Thumbnails.of(bi)
                    .scale(1.0)
                    .outputFormat(outputFormat)
                    .outputQuality(0.85f)
                    .toOutputStream(baos);
            }

            byte[] finalBytes = baos.toByteArray();
            String key = "lp-" + UUID.randomUUID() + "." + outputFormat;
            storageService.put(key, new ByteArrayInputStream(finalBytes), finalBytes.length, outputMime);
            return new StoredPreviewImage(key, outWidth, outHeight);
        } catch (Exception e) {
            return null;
        }
    }

    @Transactional(readOnly = true)
    public ResponseEntity<Resource> servePreviewImage(Long previewId) {
        LinkPreview preview = linkPreviewRepository.findById(previewId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "PREVIEW_NOT_FOUND", "Preview image not found"));
        if (preview.getImageKey() == null || preview.getStatus() != LinkPreviewStatus.OK) {
            throw new ApiException(HttpStatus.NOT_FOUND, "PREVIEW_NOT_FOUND", "Preview image not found");
        }
        InputStream is = storageService.get(preview.getImageKey());
        String contentType = preview.getImageKey().endsWith(".png") ? "image/png" : "image/jpeg";
        return ResponseEntity.ok()
            .header("X-Content-Type-Options", "nosniff")
            .header(HttpHeaders.CACHE_CONTROL, "private, max-age=86400")
            .header(HttpHeaders.CONTENT_TYPE, contentType)
            .body(new InputStreamResource(is));
    }

    @Transactional
    public void removePreviewsForMessage(Long messageId, Long userId) {
        Message message = messageRepository.findById(messageId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MESSAGE_NOT_FOUND", "Message not found"));
        if (!message.getSender().getId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only the sender can remove link previews");
        }
        messageLinkPreviewRepository.deleteByMessageId(messageId);
        messageLinkPreviewRepository.flush();

        List<ConversationMember> members =
            conversationMemberRepository.findByConversationIdAndLeftAtIsNull(message.getConversation().getId());
        for (ConversationMember cm : members) {
            MessageDto updatedDto = messageService.toDto(message, cm.getUser().getId(), false);
            eventPublisher.sendToUser(cm.getUser().getId(), "message.updated", updatedDto);
        }
    }

    @Scheduled(cron = "0 15 * * * *")
    @Transactional
    public void cleanupExpiredPreviews() {
        List<LinkPreview> expired = linkPreviewRepository.findByExpiresAtBefore(Instant.now());
        for (LinkPreview lp : expired) {
            if (lp.getImageKey() != null) {
                storageService.delete(lp.getImageKey());
            }
            linkPreviewRepository.delete(lp);
        }
    }

    public static LinkPreviewDto toDto(LinkPreview lp) {
        if (lp == null || lp.getStatus() != LinkPreviewStatus.OK) {
            return null;
        }
        String imageUrl = lp.getImageKey() != null ? "/api/previews/" + lp.getId() + "/image" : null;
        return new LinkPreviewDto(
            lp.getId(),
            lp.getUrl(),
            lp.getFinalUrl(),
            lp.getSiteName(),
            lp.getTitle(),
            lp.getDescription(),
            imageUrl,
            lp.getImageWidth(),
            lp.getImageHeight()
        );
    }

    private static String metaContent(Document doc, String cssQuery) {
        Element el = doc.selectFirst(cssQuery);
        if (el == null) return null;
        String val = el.attr("content");
        return val != null && !val.isBlank() ? val.trim() : null;
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                return v.trim();
            }
        }
        return null;
    }

    private static String safeHost(String url) {
        try {
            return URI.create(url).getHost();
        } catch (Exception e) {
            return null;
        }
    }

    private static String truncate(String s, int max) {
        if (s == null || s.isBlank()) return null;
        String clean = s.replaceAll("\\s+", " ").trim();
        return clean.length() > max ? clean.substring(0, max) : clean;
    }
}
