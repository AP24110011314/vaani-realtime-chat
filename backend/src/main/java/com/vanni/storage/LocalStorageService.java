package com.vanni.storage;

import com.vanni.exception.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.*;

@Service
public class LocalStorageService implements StorageService {

    private static final Logger log = LoggerFactory.getLogger(LocalStorageService.class);

    private final Path storageDir;

    public LocalStorageService(@Value("${storage.local.dir:./uploads}") String dirPath) {
        this.storageDir = Paths.get(dirPath).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.storageDir);
            log.info("Initialized local storage at: {}", this.storageDir);
        } catch (IOException e) {
            log.error("Could not initialize local storage at: {}", this.storageDir, e);
            throw new RuntimeException("Could not initialize storage directory", e);
        }
    }

    @Override
    public String put(String key, InputStream inputStream, long size, String contentType) {
        try {
            Path targetFile = storageDir.resolve(key).normalize();
            if (!targetFile.startsWith(storageDir)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PATH", "Path traversal detected");
            }
            Files.copy(inputStream, targetFile, StandardCopyOption.REPLACE_EXISTING);
            return key;
        } catch (IOException e) {
            log.error("Failed to store file with key {}", key, e);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "STORAGE_ERROR", "Failed to save file to storage");
        }
    }

    @Override
    public InputStream get(String key) {
        try {
            Path targetFile = storageDir.resolve(key).normalize();
            if (!targetFile.startsWith(storageDir) || !Files.exists(targetFile)) {
                throw new ApiException(HttpStatus.NOT_FOUND, "FILE_NOT_FOUND", "File not found in storage");
            }
            return Files.newInputStream(targetFile);
        } catch (IOException e) {
            log.error("Failed to read file with key {}", key, e);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "STORAGE_ERROR", "Failed to read file from storage");
        }
    }

    @Override
    public InputStream getRange(String key, long offset, long length) {
        try {
            Path targetFile = storageDir.resolve(key).normalize();
            if (!targetFile.startsWith(storageDir) || !Files.exists(targetFile)) {
                throw new ApiException(HttpStatus.NOT_FOUND, "FILE_NOT_FOUND", "File not found in storage");
            }
            RandomAccessFile raf = new RandomAccessFile(targetFile.toFile(), "r");
            raf.seek(offset);
            return new BoundedRandomAccessInputStream(raf, length);
        } catch (IOException e) {
            log.error("Failed to read range for key {}", key, e);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "STORAGE_ERROR", "Failed to read file range from storage");
        }
    }

    private static final class BoundedRandomAccessInputStream extends InputStream {
        private final RandomAccessFile raf;
        private long remaining;

        BoundedRandomAccessInputStream(RandomAccessFile raf, long length) {
            this.raf = raf;
            this.remaining = length;
        }

        @Override
        public int read() throws IOException {
            if (remaining <= 0) return -1;
            int b = raf.read();
            if (b != -1) remaining--;
            return b;
        }

        @Override
        public int read(byte[] b, int off, int len) throws IOException {
            if (remaining <= 0) return -1;
            int toRead = (int) Math.min(len, remaining);
            int read = raf.read(b, off, toRead);
            if (read > 0) remaining -= read;
            return read;
        }

        @Override
        public void close() throws IOException {
            raf.close();
        }
    }

    @Override
    public void delete(String key) {
        try {
            Path targetFile = storageDir.resolve(key).normalize();
            if (targetFile.startsWith(storageDir)) {
                Files.deleteIfExists(targetFile);
            }
        } catch (IOException e) {
            log.warn("Failed to delete file with key {}: {}", key, e.getMessage());
        }
    }
}
