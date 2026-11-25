package com.vanni.service;

import org.apache.hc.client5.http.DnsResolver;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.config.ConnectionConfig;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManager;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.core5.http.Header;
import org.apache.hc.core5.http.HttpEntity;
import org.apache.hc.core5.http.io.SocketConfig;
import org.apache.hc.core5.util.Timeout;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.TimeUnit;

import com.vanni.util.UrlNormalizer;

@Service
public class SafeHttpFetcher {

    public static final int MAX_HTML_BYTES = 1_048_576; // 1 MB
    public static final int MAX_IMAGE_BYTES = 3_145_728; // 3 MB
    public static final int MAX_REDIRECTS = 3;
    public static final long CONNECT_TIMEOUT_MS = 3_000;
    public static final long RESPONSE_TIMEOUT_MS = 5_000;
    public static final long TOTAL_DEADLINE_MS = 8_000;
    private static final String USER_AGENT = "VanniBot/1.0";

    @FunctionalInterface
    public interface HostResolver {
        InetAddress[] resolve(String host) throws UnknownHostException;
    }

    public record FetchResult(String finalUrl, String contentType, byte[] body) {}

    public static class SafeFetchException extends RuntimeException {
        private final boolean blocked;

        public SafeFetchException(String message, boolean blocked) {
            super(message);
            this.blocked = blocked;
        }

        public SafeFetchException(String message, boolean blocked, Throwable cause) {
            super(message, cause);
            this.blocked = blocked;
        }

        public boolean isBlocked() {
            return blocked;
        }
    }

    private final boolean allowLocalhostForTests;
    private final HostResolver hostResolver;

    @Autowired
    public SafeHttpFetcher(
            @Value("${app.link-previews.allow-localhost-for-tests:false}") boolean allowLocalhostForTests,
            Environment env) {
        this(allowLocalhostForTests, InetAddress::getAllByName);
        if (allowLocalhostForTests) {
            for (String p : env.getActiveProfiles()) {
                if ("prod".equalsIgnoreCase(p)) {
                    throw new IllegalStateException("allow-localhost-for-tests cannot be enabled in prod");
                }
            }
        }
    }

    public SafeHttpFetcher(boolean allowLocalhostForTests, HostResolver hostResolver) {
        this.allowLocalhostForTests = allowLocalhostForTests;
        this.hostResolver = hostResolver;
    }

    public FetchResult fetch(String rawUrl, int maxBytes, Set<String> allowedContentTypes) {
        long deadlineNanos = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(TOTAL_DEADLINE_MS);
        String currentUrl = rawUrl;

        for (int redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
            if (System.nanoTime() > deadlineNanos) {
                throw new SafeFetchException("Request deadline exceeded", false);
            }

            UrlNormalizer.NormalizedUrl normalized = UrlNormalizer.normalizeAndValidate(currentUrl, allowLocalhostForTests)
                .orElseThrow(() -> new SafeFetchException("Invalid or disallowed URL", true));

            InetAddress pinnedIp = resolveAndValidate(normalized.asciiHost());

            HopResponse hop = executePinnedGet(normalized, pinnedIp, maxBytes, allowedContentTypes, deadlineNanos);
            if (hop.redirectLocation() != null) {
                if (redirectCount >= MAX_REDIRECTS) {
                    throw new SafeFetchException("Too many redirects", false);
                }
                URI nextUri;
                try {
                    nextUri = URI.create(normalized.normalized()).resolve(hop.redirectLocation().trim());
                } catch (IllegalArgumentException e) {
                    throw new SafeFetchException("Invalid redirect location", true, e);
                }
                currentUrl = nextUri.toString();
                continue;
            }
            return new FetchResult(normalized.normalized(), hop.contentType(), hop.body());
        }

        throw new SafeFetchException("Too many redirects", false);
    }

    /**
     * Resolve host once, reject if ANY returned IP is internal/private/reserved, and return pinned IP.
     */
    public InetAddress resolveAndValidate(String asciiHost) {
        String lookupHost = asciiHost;
        if (lookupHost.startsWith("[") && lookupHost.endsWith("]")) {
            lookupHost = lookupHost.substring(1, lookupHost.length() - 1);
        }
        InetAddress[] addresses;
        try {
            addresses = hostResolver.resolve(lookupHost);
        } catch (UnknownHostException e) {
            throw new SafeFetchException("Host could not be resolved", false, e);
        }
        if (addresses == null || addresses.length == 0) {
            throw new SafeFetchException("Host returned no addresses", false);
        }
        for (InetAddress addr : addresses) {
            if (isBlockedAddress(addr, allowLocalhostForTests)) {
                throw new SafeFetchException("Blocked private or internal IP address", true);
            }
        }
        return addresses[0];
    }

    public static boolean isBlockedAddress(InetAddress addr) {
        return isBlockedAddress(addr, false);
    }

    public static boolean isBlockedAddress(InetAddress addr, boolean allowLocalhostForTests) {
        if (addr == null) {
            return true;
        }
        if (allowLocalhostForTests && addr.isLoopbackAddress()) {
            return false;
        }
        if (addr.isAnyLocalAddress()
                || addr.isLoopbackAddress()
                || addr.isLinkLocalAddress()
                || addr.isSiteLocalAddress()
                || addr.isMulticastAddress()) {
            return true;
        }

        byte[] bytes = addr.getAddress();
        if (bytes.length == 4) {
            return isBlockedIpv4(bytes);
        }
        if (bytes.length == 16) {
            // IPv4-mapped IPv6 ::ffff:a.b.c.d
            boolean isV4Mapped = true;
            for (int i = 0; i < 10; i++) {
                if (bytes[i] != 0) {
                    isV4Mapped = false;
                    break;
                }
            }
            if (isV4Mapped && (bytes[10] & 0xFF) == 0xFF && (bytes[11] & 0xFF) == 0xFF) {
                byte[] v4 = new byte[]{bytes[12], bytes[13], bytes[14], bytes[15]};
                return isBlockedIpv4(v4);
            }
            int b0 = bytes[0] & 0xFF;
            int b1 = bytes[1] & 0xFF;
            // fc00::/7 Unique local IPv6
            if ((b0 & 0xFE) == 0xFC) return true;
            // fe80::/10 Link-local IPv6
            if (b0 == 0xFE && (b1 & 0xC0) == 0x80) return true;
            // ff00::/8 Multicast
            if (b0 == 0xFF) return true;
            // ::1 or ::
            boolean allZeroExceptLast = true;
            for (int i = 0; i < 15; i++) {
                if (bytes[i] != 0) {
                    allZeroExceptLast = false;
                    break;
                }
            }
            if (allZeroExceptLast && (bytes[15] == 0 || bytes[15] == 1)) {
                return !allowLocalhostForTests || bytes[15] == 0;
            }
        }
        return false;
    }

    private static boolean isBlockedIpv4(byte[] b) {
        int o0 = b[0] & 0xFF;
        int o1 = b[1] & 0xFF;
        // 0.0.0.0/8 (unspecified / this network)
        if (o0 == 0) return true;
        // 10.0.0.0/8 (private)
        if (o0 == 10) return true;
        // 100.64.0.0/10 (CGNAT)
        if (o0 == 100 && (o1 >= 64 && o1 <= 127)) return true;
        // 127.0.0.0/8 (loopback)
        if (o0 == 127) return true;
        // 169.254.0.0/16 (link-local + cloud metadata 169.254.169.254)
        if (o0 == 169 && o1 == 254) return true;
        // 172.16.0.0/12 (private)
        if (o0 == 172 && (o1 >= 16 && o1 <= 31)) return true;
        // 192.0.0.0/24 (IETF protocol assignments)
        if (o0 == 192 && o1 == 0 && (b[2] & 0xFF) == 0) return true;
        // 192.168.0.0/16 (private)
        if (o0 == 192 && o1 == 168) return true;
        // 198.18.0.0/15 (benchmark)
        if (o0 == 198 && (o1 == 18 || o1 == 19)) return true;
        // 224.0.0.0/4 (multicast) and 240.0.0.0/4 (reserved)
        if (o0 >= 224) return true;
        return false;
    }

    private record HopResponse(String redirectLocation, String contentType, byte[] body) {}

    private HopResponse executePinnedGet(
            UrlNormalizer.NormalizedUrl target,
            InetAddress pinnedIp,
            int maxBytes,
            Set<String> allowedContentTypes,
            long deadlineNanos) {

        String expectedHost = target.asciiHost().startsWith("[") && target.asciiHost().endsWith("]")
            ? target.asciiHost().substring(1, target.asciiHost().length() - 1)
            : target.asciiHost();

        DnsResolver pinnedResolver = new DnsResolver() {
            @Override
            public InetAddress[] resolve(String host) throws UnknownHostException {
                if (!expectedHost.equalsIgnoreCase(host)) {
                    throw new UnknownHostException("Unpinned host resolution attempted: " + host);
                }
                return new InetAddress[]{pinnedIp};
            }

            @Override
            public String resolveCanonicalHostname(String host) throws UnknownHostException {
                return host;
            }
        };

        long remainingMs = Math.max(250, TimeUnit.NANOSECONDS.toMillis(deadlineNanos - System.nanoTime()));
        long effectiveResponseTimeoutMs = Math.min(RESPONSE_TIMEOUT_MS, remainingMs);

        ConnectionConfig connConfig = ConnectionConfig.custom()
            .setConnectTimeout(Timeout.ofMilliseconds(CONNECT_TIMEOUT_MS))
            .setSocketTimeout(Timeout.ofMilliseconds(effectiveResponseTimeoutMs))
            .build();

        SocketConfig socketConfig = SocketConfig.custom()
            .setSoTimeout(Timeout.ofMilliseconds(effectiveResponseTimeoutMs))
            .build();

        PoolingHttpClientConnectionManager cm = PoolingHttpClientConnectionManagerBuilder.create()
            .setDnsResolver(pinnedResolver)
            .setDefaultConnectionConfig(connConfig)
            .setDefaultSocketConfig(socketConfig)
            .build();

        RequestConfig reqConfig = RequestConfig.custom()
            .setRedirectsEnabled(false)
            .setConnectionRequestTimeout(Timeout.ofMilliseconds(CONNECT_TIMEOUT_MS))
            .setResponseTimeout(Timeout.ofMilliseconds(effectiveResponseTimeoutMs))
            .build();

        try (cm; CloseableHttpClient client = HttpClients.custom()
                .setConnectionManager(cm)
                .setDefaultRequestConfig(reqConfig)
                .disableRedirectHandling()
                .disableCookieManagement()
                .disableAuthCaching()
                .setUserAgent(USER_AGENT)
                .build()) {

            HttpGet get = new HttpGet(target.normalized());
            return client.execute(get, response -> {
                int code = response.getCode();
                if (code >= 300 && code < 400) {
                    Header loc = response.getFirstHeader("Location");
                    if (loc == null || loc.getValue() == null || loc.getValue().isBlank()) {
                        throw new SafeFetchException("Redirect without Location header", false);
                    }
                    return new HopResponse(loc.getValue(), null, null);
                }
                if (code < 200 || code >= 300) {
                    throw new SafeFetchException("HTTP status " + code, false);
                }

                HttpEntity entity = response.getEntity();
                if (entity == null) {
                    throw new SafeFetchException("Empty response body", false);
                }

                String rawCt = entity.getContentType();
                String mime = extractMime(rawCt);
                if (allowedContentTypes != null && !allowedContentTypes.isEmpty()) {
                    if (mime == null || !allowedContentTypes.contains(mime)) {
                        throw new SafeFetchException("Disallowed content type: " + mime, false);
                    }
                }

                long declaredLen = entity.getContentLength();
                if (declaredLen > maxBytes) {
                    throw new SafeFetchException("Response exceeds maximum allowed size", false);
                }

                byte[] bytes = readBounded(entity.getContent(), maxBytes, deadlineNanos);
                return new HopResponse(null, mime, bytes);
            });
        } catch (SafeFetchException e) {
            throw e;
        } catch (IOException e) {
            throw new SafeFetchException("Failed fetching URL", false, e);
        }
    }

    private static byte[] readBounded(InputStream in, int maxBytes, long deadlineNanos) throws IOException {
        if (in == null) return new byte[0];
        ByteArrayOutputStream out = new ByteArrayOutputStream(Math.min(maxBytes, 16384));
        byte[] buf = new byte[8192];
        int total = 0;
        int n;
        while ((n = in.read(buf)) != -1) {
            if (System.nanoTime() > deadlineNanos) {
                throw new SafeFetchException("Request deadline exceeded while reading body", false);
            }
            total += n;
            if (total > maxBytes) {
                throw new SafeFetchException("Response exceeded byte limit", false);
            }
            out.write(buf, 0, n);
        }
        return out.toByteArray();
    }

    private static String extractMime(String contentTypeHeader) {
        if (contentTypeHeader == null || contentTypeHeader.isBlank()) {
            return null;
        }
        int semi = contentTypeHeader.indexOf(';');
        String base = (semi >= 0 ? contentTypeHeader.substring(0, semi) : contentTypeHeader).trim();
        return base.toLowerCase(Locale.ROOT);
    }
}
