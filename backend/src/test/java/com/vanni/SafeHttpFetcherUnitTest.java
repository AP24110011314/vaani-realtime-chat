package com.vanni;

import com.sun.net.httpserver.HttpServer;
import com.vanni.service.SafeHttpFetcher;
import com.vanni.util.UrlExtractor;
import com.vanni.util.UrlNormalizer;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

public class SafeHttpFetcherUnitTest {

    @Test
    void urlExtractorAndNormalizerRejectUnsafeInputs() {
        // Trims trailing punctuation cleanly & ignores code spans
        assertThat(UrlExtractor.extractFirstUrl("See `http://ignore.example` then visit https://example.com/wiki/Test_(page)."))
            .contains("https://example.com/wiki/Test_(page)");

        // Disallowed schemes
        assertThat(UrlNormalizer.normalizeAndValidate("file:///etc/passwd")).isEmpty();
        assertThat(UrlNormalizer.normalizeAndValidate("gopher://127.0.0.1:11211/1")).isEmpty();
        assertThat(UrlNormalizer.normalizeAndValidate("ftp://example.com/file")).isEmpty();

        // Embedded credentials
        assertThat(UrlNormalizer.normalizeAndValidate("https://user:pass@example.com/a")).isEmpty();

        // Non-80/443 ports
        assertThat(UrlNormalizer.normalizeAndValidate("http://example.com:8080/a")).isEmpty();
        assertThat(UrlNormalizer.normalizeAndValidate("https://example.com:22/")).isEmpty();

        // Local & obfuscated IPs
        assertThat(UrlNormalizer.normalizeAndValidate("http://localhost/admin")).isEmpty();
        assertThat(UrlNormalizer.normalizeAndValidate("http://svc.internal/metrics")).isEmpty();
        assertThat(UrlNormalizer.normalizeAndValidate("http://printer.local/")).isEmpty();
        assertThat(UrlNormalizer.normalizeAndValidate("http://2130706433/")).isEmpty(); // decimal 127.0.0.1
        assertThat(UrlNormalizer.normalizeAndValidate("http://0x7f000001/")).isEmpty(); // hex 127.0.0.1
        assertThat(UrlNormalizer.normalizeAndValidate("http://0177.0.0.1/")).isEmpty(); // octal 127.0.0.1

        // IDN punycode normalization & default port removal
        UrlNormalizer.NormalizedUrl idn = UrlNormalizer.normalizeAndValidate("https://Bücher.example:443/a#frag").orElseThrow();
        assertThat(idn.asciiHost()).isEqualTo("xn--bcher-kva.example");
        assertThat(idn.normalized()).isEqualTo("https://xn--bcher-kva.example/a");
    }

    @Test
    void blocksAllPrivateLoopbackLinkLocalCgnatMulticastAndMappedV6() throws Exception {
        String[] blocked = {
            "127.0.0.1", "127.10.20.30",
            "10.0.0.1", "10.255.255.254",
            "172.16.0.1", "172.31.255.1",
            "192.168.0.1", "192.168.100.50",
            "169.254.169.254", "169.254.0.1",
            "100.64.0.1", "100.127.255.254",
            "0.0.0.0", "224.0.0.1", "255.255.255.255",
            "::1", "::", "fc00::1", "fd12:3456::1", "fe80::1",
            "::ffff:127.0.0.1", "::ffff:169.254.169.254", "::ffff:10.0.0.1"
        };
        for (String ip : blocked) {
            InetAddress addr = InetAddress.getByName(ip);
            assertThat(SafeHttpFetcher.isBlockedAddress(addr))
                .as("Expected IP to be blocked: %s", ip)
                .isTrue();
        }

        // Mapped IPv4 bytes tested directly (in case OS InetAddress normalizes ::ffff: to Inet4Address)
        byte[] v4MappedLoopback = new byte[]{0,0,0,0,0,0,0,0,0,0,(byte)0xff,(byte)0xff,127,0,0,1};
        assertThat(SafeHttpFetcher.isBlockedAddress(InetAddress.getByAddress(v4MappedLoopback))).isTrue();

        assertThat(SafeHttpFetcher.isBlockedAddress(InetAddress.getByName("93.184.216.34"))).isFalse();
        assertThat(SafeHttpFetcher.isBlockedAddress(InetAddress.getByName("1.1.1.1"))).isFalse();
        assertThat(SafeHttpFetcher.isBlockedAddress(InetAddress.getByName("2606:4700:4700::1111"))).isFalse();
    }

    @Test
    void rejectsDnsRebindingMixedResultsAndPinningWorks() throws Exception {
        InetAddress pub = InetAddress.getByAddress("rebind.example", new byte[]{93, (byte) 184, (byte) 216, 34});
        InetAddress priv = InetAddress.getByAddress("rebind.example", new byte[]{127, 0, 0, 1});

        // 1. Mixed public + private answer rejected before any socket connect
        SafeHttpFetcher mixedFetcher = new SafeHttpFetcher(false, host -> new InetAddress[]{pub, priv});
        assertThatThrownBy(() -> mixedFetcher.resolveAndValidate("rebind.example"))
            .isInstanceOf(SafeHttpFetcher.SafeFetchException.class)
            .satisfies(e -> assertThat(((SafeHttpFetcher.SafeFetchException) e).isBlocked()).isTrue());

        // 2. Rebinding simulation: resolver returns public on 1st call and private on 2nd call ->
        // fetch must resolve only once and pin to 1st IP (never consults resolver 2nd time for same hop)
        AtomicInteger resolveCalls = new AtomicInteger();
        HttpServer srv = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        try {
            srv.createContext("/rebind", ex -> {
                byte[] b = "<html><title>Ok</title></html>".getBytes(StandardCharsets.UTF_8);
                ex.getResponseHeaders().set("Content-Type", "text/html");
                ex.sendResponseHeaders(200, b.length);
                try (OutputStream os = ex.getResponseBody()) { os.write(b); }
            });
            srv.start();
            int port = srv.getAddress().getPort();

            // Simulate resolver returning loopback for test server on 1st call, and metadata IP on 2nd call
            InetAddress allowedFirst = InetAddress.getByAddress("rebinder.example", new byte[]{127, 0, 0, 1});
            InetAddress poisonSecond = InetAddress.getByAddress("rebinder.example", new byte[]{(byte) 169, (byte) 254, (byte) 169, (byte) 254});

            SafeHttpFetcher pinnedFetcher = new SafeHttpFetcher(true, host -> {
                if (resolveCalls.getAndIncrement() == 0) {
                    return new InetAddress[]{allowedFirst};
                }
                return new InetAddress[]{poisonSecond};
            });

            SafeHttpFetcher.FetchResult res = pinnedFetcher.fetch(
                "http://rebinder.example:" + port + "/rebind",
                SafeHttpFetcher.MAX_HTML_BYTES,
                Set.of("text/html")
            );
            assertThat(new String(res.body(), StandardCharsets.UTF_8)).contains("Ok");
            assertThat(resolveCalls.get()).isEqualTo(1);
        } finally {
            srv.stop(0);
        }
    }

    @Test
    void enforcesRedirectLimitPrivateRedirectBlockOversizeAndContentType() throws Exception {
        HttpServer srv = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        try {
            srv.createContext("/redir-meta", ex -> {
                ex.getResponseHeaders().set("Location", "http://169.254.169.254/latest/meta-data");
                ex.sendResponseHeaders(302, -1);
            });
            srv.createContext("/hop1", ex -> {
                ex.getResponseHeaders().set("Location", "/hop2");
                ex.sendResponseHeaders(302, -1);
            });
            srv.createContext("/hop2", ex -> {
                ex.getResponseHeaders().set("Location", "/hop3");
                ex.sendResponseHeaders(302, -1);
            });
            srv.createContext("/hop3", ex -> {
                ex.getResponseHeaders().set("Location", "/hop4");
                ex.sendResponseHeaders(302, -1);
            });
            srv.createContext("/hop4", ex -> {
                ex.getResponseHeaders().set("Location", "/end");
                ex.sendResponseHeaders(302, -1);
            });
            srv.createContext("/json", ex -> {
                byte[] b = "{\"ok\":true}".getBytes(StandardCharsets.UTF_8);
                ex.getResponseHeaders().set("Content-Type", "application/json");
                ex.sendResponseHeaders(200, b.length);
                try (OutputStream os = ex.getResponseBody()) { os.write(b); }
            });
            srv.createContext("/big", ex -> {
                byte[] b = new byte[SafeHttpFetcher.MAX_HTML_BYTES + 1024];
                ex.getResponseHeaders().set("Content-Type", "text/html");
                ex.sendResponseHeaders(200, b.length);
                try (OutputStream os = ex.getResponseBody()) { os.write(b); }
            });
            srv.start();
            int port = srv.getAddress().getPort();

            // Local test server allowed for test; still redirect target 169.254.169.254 MUST be blocked
            SafeHttpFetcher fetcher = new SafeHttpFetcher(true, InetAddress::getAllByName);

            assertThatThrownBy(() -> fetcher.fetch("http://127.0.0.1:" + port + "/redir-meta", SafeHttpFetcher.MAX_HTML_BYTES, Set.of("text/html")))
                .isInstanceOf(SafeHttpFetcher.SafeFetchException.class)
                .satisfies(e -> assertThat(((SafeHttpFetcher.SafeFetchException) e).isBlocked()).isTrue());

            // > 3 redirects rejected
            assertThatThrownBy(() -> fetcher.fetch("http://127.0.0.1:" + port + "/hop1", SafeHttpFetcher.MAX_HTML_BYTES, Set.of("text/html")))
                .isInstanceOf(SafeHttpFetcher.SafeFetchException.class)
                .hasMessageContaining("redirects");

            // Non-HTML rejected
            assertThatThrownBy(() -> fetcher.fetch("http://127.0.0.1:" + port + "/json", SafeHttpFetcher.MAX_HTML_BYTES, Set.of("text/html")))
                .isInstanceOf(SafeHttpFetcher.SafeFetchException.class)
                .hasMessageContaining("Disallowed content type");

            // Oversized body rejected
            assertThatThrownBy(() -> fetcher.fetch("http://127.0.0.1:" + port + "/big", SafeHttpFetcher.MAX_HTML_BYTES, Set.of("text/html")))
                .isInstanceOf(SafeHttpFetcher.SafeFetchException.class);
        } finally {
            srv.stop(0);
        }
    }
}
