package com.vanni.util;

import com.vanni.exception.ApiException;
import org.springframework.http.HttpStatus;

import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.Set;

public class MimeSniffer {

    private static final Set<String> ALLOWED_MIMES = Set.of(
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "application/pdf",
        "text/plain",
        "application/zip",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );

    private static final Set<String> BLOCKED_EXTENSIONS = Set.of(
        "exe", "sh", "bat", "cmd", "js", "html", "htm", "svg", "vbs", "jar", "ps1", "py", "bin", "msi", "dll", "so", "dylib", "com"
    );

    private static final Set<String> TEXT_EXTENSIONS = Set.of(
        "txt", "csv", "tsv", "log", "json", "md"
    );

    public record SniffResult(String mimeType, String safeFileName) {}

    public static SniffResult sniff(byte[] data, String originalFilename) {
        if (data == null || data.length == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_FILE", "File is empty");
        }

        // 1. Sanitize filename and extract extension
        String rawName = originalFilename != null ? originalFilename : "file";
        Path p = Paths.get(rawName).getFileName();
        String baseName = p != null ? p.toString() : "file";
        // Remove path traversal and risky characters
        baseName = baseName.replace("..", "").replace("/", "").replace("\\", "").trim();
        if (baseName.isEmpty() || baseName.equals(".")) {
            baseName = "file";
        }

        String ext = "";
        int dot = baseName.lastIndexOf('.');
        if (dot >= 0) {
            ext = baseName.substring(dot + 1).toLowerCase(Locale.ROOT);
        }

        // 2. Reject blocked extensions immediately
        if (BLOCKED_EXTENSIONS.contains(ext)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DISALLOWED_FILE_TYPE", "File extension is not permitted");
        }

        // 3. Executable / script magic byte detection - reject immediately
        if (isExecutableOrScript(data)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DISALLOWED_FILE_TYPE", "Executable or script content detected");
        }

        // 4. Detect MIME from magic bytes
        String detectedMime = detectMime(data, ext);

        if (detectedMime == null || !ALLOWED_MIMES.contains(detectedMime)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DISALLOWED_FILE_TYPE", "File type is not permitted or unrecognized");
        }

        // 5. Cross-check extension against detected MIME (anti-spoofing)
        validateExtensionAgainstMime(ext, detectedMime);

        // Sanitize final file name
        String safeBase = baseName.replaceAll("[^a-zA-Z0-9._-]", "_");
        if (safeBase.length() > 100) {
            safeBase = safeBase.substring(0, 100);
        }

        return new SniffResult(detectedMime, safeBase);
    }

    private static boolean isExecutableOrScript(byte[] data) {
        // DOS / PE executable (MZ)
        if (data.length >= 2 && data[0] == 0x4D && data[1] == 0x5A) {
            return true;
        }
        // ELF binary
        if (data.length >= 4 && data[0] == 0x7F && data[1] == 0x45 && data[2] == 0x4C && data[3] == 0x46) {
            return true;
        }
        // Java class file
        if (data.length >= 4 && (data[0] & 0xFF) == 0xCA && (data[1] & 0xFF) == 0xFE && (data[2] & 0xFF) == 0xBA && (data[3] & 0xFF) == 0xBE) {
            return true;
        }
        // Mach-O binary
        if (data.length >= 4) {
            int b0 = data[0] & 0xFF;
            int b1 = data[1] & 0xFF;
            int b2 = data[2] & 0xFF;
            int b3 = data[3] & 0xFF;
            if ((b0 == 0xFE && b1 == 0xED && b2 == 0xFA && (b3 == 0xCE || b3 == 0xCF)) ||
                ((b0 == 0xCE || b0 == 0xCF) && b1 == 0xFA && b2 == 0xED && b3 == 0xFE)) {
                return true;
            }
        }
        // Shebang script (#! ...)
        if (data.length >= 2 && data[0] == '#' && data[1] == '!') {
            return true;
        }
        return false;
    }

    private static String detectMime(byte[] data, String ext) {
        // JPEG: FF D8 FF
        if (data.length >= 3 && (data[0] & 0xFF) == 0xFF && (data[1] & 0xFF) == 0xD8 && (data[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }

        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (data.length >= 8 && (data[0] & 0xFF) == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47 &&
            data[4] == 0x0D && data[5] == 0x0A && data[6] == 0x1A && data[7] == 0x0A) {
            return "image/png";
        }

        // GIF: GIF87a or GIF89a
        if (data.length >= 6 && data[0] == 'G' && data[1] == 'I' && data[2] == 'F' && data[3] == '8' &&
            (data[4] == '7' || data[4] == '9') && data[5] == 'a') {
            return "image/gif";
        }

        // WEBP: RIFF....WEBP
        if (data.length >= 12 && data[0] == 'R' && data[1] == 'I' && data[2] == 'F' && data[3] == 'F' &&
            data[8] == 'W' && data[9] == 'E' && data[10] == 'B' && data[11] == 'P') {
            return "image/webp";
        }

        // PDF: %PDF-
        if (data.length >= 5 && data[0] == '%' && data[1] == 'P' && data[2] == 'D' && data[3] == 'F' && data[4] == '-') {
            return "application/pdf";
        }

        // ZIP / OOXML: PK\x03\x04 or PK\x05\x06 or PK\x07\x08
        if (data.length >= 4 && data[0] == 0x50 && data[1] == 0x4B &&
            (data[2] == 0x03 || data[2] == 0x05 || data[2] == 0x07) &&
            (data[3] == 0x04 || data[3] == 0x06 || data[3] == 0x08)) {
            if ("docx".equals(ext)) {
                return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            } else if ("xlsx".equals(ext)) {
                return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            } else if ("pptx".equals(ext)) {
                return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
            } else if ("zip".equals(ext)) {
                return "application/zip";
            }
            return "application/zip";
        }

        // OLE2 (legacy DOC): D0 CF 11 E0 A1 B1 1A E1
        if (data.length >= 8 && (data[0] & 0xFF) == 0xD0 && (data[1] & 0xFF) == 0xCF &&
            (data[2] & 0xFF) == 0x11 && (data[3] & 0xFF) == 0xE0 && (data[4] & 0xFF) == 0xA1 &&
            (data[5] & 0xFF) == 0xB1 && (data[6] & 0xFF) == 0x1A && (data[7] & 0xFF) == 0xE1) {
            if ("doc".equals(ext)) {
                return "application/msword";
            }
            return "application/msword";
        }

        // Plain Text check
        if (TEXT_EXTENSIONS.contains(ext)) {
            // Check for binary 0x00 null bytes in preview
            int checkLen = Math.min(data.length, 1024);
            for (int i = 0; i < checkLen; i++) {
                if (data[i] == 0) {
                    return null; // Binary data disguised with text extension
                }
            }
            String sample = new String(data, 0, checkLen, StandardCharsets.UTF_8).toLowerCase(Locale.ROOT);
            if (sample.contains("<html") || sample.contains("<script") || sample.contains("<?php") ||
                sample.contains("<svg") || sample.contains("<!doctype")) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "DISALLOWED_FILE_TYPE", "HTML or script content not allowed in text uploads");
            }
            return "text/plain";
        }

        return null;
    }

    private static void validateExtensionAgainstMime(String ext, String mime) {
        if ("png".equals(ext) && !"image/png".equals(mime)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DISALLOWED_FILE_TYPE", "File content does not match .png extension");
        }
        if (("jpg".equals(ext) || "jpeg".equals(ext)) && !"image/jpeg".equals(mime)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DISALLOWED_FILE_TYPE", "File content does not match JPEG extension");
        }
        if ("gif".equals(ext) && !"image/gif".equals(mime)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DISALLOWED_FILE_TYPE", "File content does not match .gif extension");
        }
        if ("webp".equals(ext) && !"image/webp".equals(mime)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DISALLOWED_FILE_TYPE", "File content does not match .webp extension");
        }
        if ("pdf".equals(ext) && !"application/pdf".equals(mime)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DISALLOWED_FILE_TYPE", "File content does not match .pdf extension");
        }
    }
}
