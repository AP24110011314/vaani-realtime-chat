package com.vanni.util;

import java.net.IDN;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;

public final class UrlNormalizer {

    public static final int MAX_URL_LENGTH = 2048;
    private static final Pattern STRICT_IPV4 = Pattern.compile(
        "^(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}$"
    );
    private static final Pattern PURE_DIGITS = Pattern.compile("^\\d+$");
    private static final Pattern HEX_OR_OCTAL_IP = Pattern.compile("^(0x[0-9a-f]+|0[0-7]+)(\\..+)?$", Pattern.CASE_INSENSITIVE);

    public record NormalizedUrl(String normalized, String urlHash, String scheme, String asciiHost, int port) {}

    private UrlNormalizer() {}

    public static Optional<NormalizedUrl> normalizeAndValidate(String rawUrl) {
        return normalizeAndValidate(rawUrl, false);
    }

    public static Optional<NormalizedUrl> normalizeAndValidate(String rawUrl, boolean allowLocalhostForTests) {
        if (rawUrl == null || rawUrl.isBlank() || rawUrl.length() > MAX_URL_LENGTH) {
            return Optional.empty();
        }
        String trimmed = rawUrl.trim();
        // Convert any Unicode host labels to IDNA ASCII before java.net.URI parses strict ASCII syntax
        String preNormalized = encodeUnicodeAuthority(trimmed);
        URI uri;
        try {
            uri = URI.create(preNormalized);
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }

        String scheme = uri.getScheme();
        if (scheme == null) {
            return Optional.empty();
        }
        String lowerScheme = scheme.toLowerCase(Locale.ROOT);
        if (!"http".equals(lowerScheme) && !"https".equals(lowerScheme)) {
            return Optional.empty();
        }

        // Reject embedded user:pass@ credentials
        if (uri.getRawUserInfo() != null) {
            return Optional.empty();
        }

        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            return Optional.empty();
        }

        int port = uri.getPort();
        if (port != -1 && port != 80 && port != 443 && !allowLocalhostForTests) {
            return Optional.empty();
        }

        String asciiHost;
        try {
            String stripped = host.endsWith(".") ? host.substring(0, host.length() - 1) : host;
            if (stripped.startsWith("[") && stripped.endsWith("]")) {
                asciiHost = stripped.toLowerCase(Locale.ROOT);
            } else {
                asciiHost = IDN.toASCII(stripped, IDN.ALLOW_UNASSIGNED).toLowerCase(Locale.ROOT);
            }
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }

        if (asciiHost.isBlank()) {
            return Optional.empty();
        }

        if (!allowLocalhostForTests) {
            if ("localhost".equals(asciiHost)
                    || asciiHost.endsWith(".localhost")
                    || asciiHost.endsWith(".local")
                    || asciiHost.endsWith(".internal")) {
                return Optional.empty();
            }
            // Reject decimal-only, hex, or octal IP obfuscation (e.g. 2130706433, 0x7f000001, 0177.0.0.1)
            if (PURE_DIGITS.matcher(asciiHost).matches() || HEX_OR_OCTAL_IP.matcher(asciiHost).matches()) {
                return Optional.empty();
            }
            // Also block dotted numeric forms that aren't valid strict IPv4 (catches mixed octal/hex octets like 127.0x0.0.1)
            if (looksNumericDotted(asciiHost) && !STRICT_IPV4.matcher(asciiHost).matches()) {
                return Optional.empty();
            }
        }

        int effectivePort = (port == 80 && "http".equals(lowerScheme)) || (port == 443 && "https".equals(lowerScheme))
            ? -1
            : port;

        String rawPath = uri.getRawPath();
        String path = (rawPath == null || rawPath.isEmpty()) ? "/" : rawPath;
        String query = uri.getRawQuery();

        StringBuilder sb = new StringBuilder();
        sb.append(lowerScheme).append("://").append(asciiHost);
        if (effectivePort != -1) {
            sb.append(':').append(effectivePort);
        }
        sb.append(path);
        if (query != null) {
            sb.append('?').append(query);
        }

        String normalized = sb.toString();
        if (normalized.length() > MAX_URL_LENGTH) {
            return Optional.empty();
        }
        return Optional.of(new NormalizedUrl(normalized, sha256(normalized), lowerScheme, asciiHost, effectivePort == -1 ? ("https".equals(lowerScheme) ? 443 : 80) : effectivePort));
    }

    private static String encodeUnicodeAuthority(String raw) {
        int schemeEnd = raw.indexOf("://");
        if (schemeEnd <= 0) return raw;
        int authStart = schemeEnd + 3;
        int pathStart = raw.length();
        for (int i = authStart; i < raw.length(); i++) {
            char c = raw.charAt(i);
            if (c == '/' || c == '?' || c == '#') {
                pathStart = i;
                break;
            }
        }
        String authority = raw.substring(authStart, pathStart);
        int atIdx = authority.lastIndexOf('@');
        if (atIdx >= 0) {
            // Preserve userinfo so URI.getRawUserInfo() rejects it cleanly
            return raw;
        }
        int colonIdx = authority.startsWith("[") ? authority.indexOf(':', authority.indexOf(']')) : authority.lastIndexOf(':');
        String hostPart = colonIdx > 0 ? authority.substring(0, colonIdx) : authority;
        String portPart = colonIdx > 0 ? authority.substring(colonIdx) : "";
        try {
            String ascii = hostPart.startsWith("[") ? hostPart : IDN.toASCII(hostPart, IDN.ALLOW_UNASSIGNED);
            return raw.substring(0, authStart) + ascii + portPart + raw.substring(pathStart);
        } catch (IllegalArgumentException e) {
            return raw;
        }
    }

    private static boolean looksNumericDotted(String host) {
        if (!host.contains(".")) return false;
        String[] parts = host.split("\\.", -1);
        for (String p : parts) {
            if (p.isEmpty()) return true;
            if (!p.matches("^(0x[0-9a-f]+|\\d+)$")) {
                return false;
            }
        }
        return true;
    }

    public static String sha256(String value) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
