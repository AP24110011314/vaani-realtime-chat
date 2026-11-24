package com.vanni.config;

import com.vanni.websocket.JwtHandshakeInterceptor;
import com.vanni.websocket.WsAuthChannelInterceptor;
import com.vanni.websocket.WsHandshakeHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtHandshakeInterceptor jwtHandshakeInterceptor;
    private final WsHandshakeHandler wsHandshakeHandler;
    private final WsAuthChannelInterceptor wsAuthChannelInterceptor;
    private final String[] allowedOrigins;

    public WebSocketConfig(
            JwtHandshakeInterceptor jwtHandshakeInterceptor,
            WsHandshakeHandler wsHandshakeHandler,
            WsAuthChannelInterceptor wsAuthChannelInterceptor,
            @Value("${app.allowed-origins:http://localhost:5173,http://localhost:8080,http://127.0.0.1:5173}") String allowedOriginsStr
    ) {
        this.jwtHandshakeInterceptor = jwtHandshakeInterceptor;
        this.wsHandshakeHandler = wsHandshakeHandler;
        this.wsAuthChannelInterceptor = wsAuthChannelInterceptor;
        this.allowedOrigins = allowedOriginsStr.split(",");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(allowedOrigins)
                .addInterceptors(jwtHandshakeInterceptor)
                .setHandshakeHandler(wsHandshakeHandler);
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        ThreadPoolTaskScheduler taskScheduler = new ThreadPoolTaskScheduler();
        taskScheduler.setPoolSize(1);
        taskScheduler.setThreadNamePrefix("ws-heartbeat-thread-");
        taskScheduler.initialize();

        registry.enableSimpleBroker("/queue")
                .setHeartbeatValue(new long[]{10000, 10000})
                .setTaskScheduler(taskScheduler);

        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registry) {
        registry.setMessageSizeLimit(64 * 1024);
        registry.setSendBufferSizeLimit(512 * 1024);
        registry.setSendTimeLimit(20 * 1000);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(wsAuthChannelInterceptor);
    }
}
