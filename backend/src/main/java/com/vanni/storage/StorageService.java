package com.vanni.storage;

import java.io.InputStream;

public interface StorageService {
    String put(String key, InputStream inputStream, long size, String contentType);
    InputStream get(String key);
    void delete(String key);
    default String getUrl(String key) {
        return "/api/attachments/file/" + key;
    }
}
