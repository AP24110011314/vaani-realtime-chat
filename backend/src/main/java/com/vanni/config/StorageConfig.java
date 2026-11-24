package com.vanni.config;

import com.vanni.storage.CloudinaryStorageService;
import com.vanni.storage.LocalStorageService;
import com.vanni.storage.StorageService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableScheduling
public class StorageConfig {

    @Value("${storage.provider:local}")
    private String storageProvider;

    @Bean
    @Primary
    public StorageService storageService(LocalStorageService localStorageService) {
        if ("cloudinary".equalsIgnoreCase(storageProvider)) {
            return new CloudinaryStorageService(localStorageService);
        }
        return localStorageService;
    }
}
