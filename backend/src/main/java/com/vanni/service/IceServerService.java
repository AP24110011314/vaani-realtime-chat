package com.vanni.service;

import com.vanni.config.CallProperties;
import com.vanni.dto.response.IceServersResponse;
import com.vanni.entity.User;
import com.vanni.exception.ApiException;
import com.vanni.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

@Service
public class IceServerService {

    private final CallProperties callProperties;
    private final UserRepository userRepository;

    public IceServerService(CallProperties callProperties, UserRepository userRepository) {
        this.callProperties = callProperties;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public IceServersResponse getIceServers(Long userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found"));

        boolean relayOnly = user.isCallsRelayOnly();
        List<IceServersResponse.IceServerDto> servers = new ArrayList<>();

        List<String> stunUrls = callProperties.parsedStunUrls();
        if (!stunUrls.isEmpty() && !relayOnly) {
            servers.add(new IceServersResponse.IceServerDto(stunUrls, null, null));
        }

        List<String> turnUrls = callProperties.parsedTurnUrls();
        String turnSecret = callProperties.getTurnSecret();
        if (!turnUrls.isEmpty() && turnSecret != null && !turnSecret.isBlank()) {
            long expiry = Instant.now().getEpochSecond() + Math.max(60, callProperties.getTurnTtlSeconds());
            String username = expiry + ":" + userId;
            String credential = computeTurnCredential(turnSecret, username);
            servers.add(new IceServersResponse.IceServerDto(turnUrls, username, credential));
        }

        return new IceServersResponse(servers, relayOnly);
    }

    public static String computeTurnCredential(String secret, String username) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA1"));
            byte[] rawHmac = mac.doFinal(username.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(rawHmac);
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to compute TURN HMAC-SHA1 credential", ex);
        }
    }
}
