package com.vanni.storage;

import java.io.IOException;
import java.io.InputStream;

public interface StorageService {
    String put(String key, InputStream inputStream, long size, String contentType);
    InputStream get(String key);
    void delete(String key);

    default InputStream getRange(String key, long offset, long length) {
        InputStream full = get(key);
        try {
            long skipped = 0;
            while (skipped < offset) {
                long s = full.skip(offset - skipped);
                if (s <= 0) {
                    if (full.read() == -1) break;
                    skipped++;
                } else {
                    skipped += s;
                }
            }
            byte[] slice = full.readNBytes((int) Math.min(length, Integer.MAX_VALUE));
            full.close();
            return new java.io.ByteArrayInputStream(slice);
        } catch (IOException e) {
            throw new RuntimeException("Failed to read storage byte range", e);
        }
    }

    default String getUrl(String key) {
        return "/api/attachments/file/" + key;
    }
}
