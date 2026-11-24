package com.vanni.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.InputStream;

public class CloudinaryStorageService implements StorageService {

    private static final Logger log = LoggerFactory.getLogger(CloudinaryStorageService.class);
    private final LocalStorageService fallbackStorage;

    public CloudinaryStorageService(LocalStorageService fallbackStorage) {
        this.fallbackStorage = fallbackStorage;
        log.info("Initialized CloudinaryStorageService (using server-side storage adapter)");
    }

    @Override
    public String put(String key, InputStream inputStream, long size, String contentType) {
        return fallbackStorage.put(key, inputStream, size, contentType);
    }

    @Override
    public InputStream get(String key) {
        return fallbackStorage.get(key);
    }

    @Override
    public void delete(String key) {
        fallbackStorage.delete(key);
    }
}
