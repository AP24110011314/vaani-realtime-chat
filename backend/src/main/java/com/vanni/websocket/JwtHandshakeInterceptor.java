package com.vanni.websocket;

import com.vanni.security.JwtService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.Map;

@Component
public class JwtHandshakeInterceptor implements HandshakeInterceptor {

    private static final Logger log = LoggerFactory.getLogger(JwtHandshakeInterceptor.class);
    private final JwtService jwtService;

    public JwtHandshakeInterceptor(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes
    ) {
        if (request instanceof ServletServerHttpRequest servletRequest) {
            HttpServletRequest httpRequest = servletRequest.getServletRequest();
            Cookie[] cookies = httpRequest.getCookies();
            if (cookies != null) {
                for (Cookie cookie : cookies) {
                    if ("vanni_at".equals(cookie.getName())) {
                        String token = cookie.getValue();
                        try {
                            Claims claims = jwtService.parseAndValidate(token);
                            Long userId = Long.parseLong(claims.getSubject());
                            String email = claims.get("email", String.class);
                            String name = claims.get("name", String.class);

                            WsUserPrincipal principal = new WsUserPrincipal(userId, email, name);
                            attributes.put("user_principal", principal);
                            attributes.put("userId", userId);
                            return true;
                        } catch (Exception ex) {
                            log.debug("WebSocket handshake rejected: invalid JWT token ({})", ex.getMessage());
                            response.setStatusCode(HttpStatus.UNAUTHORIZED);
                            return false;
                        }
                    }
                }
            }
        }

        log.debug("WebSocket handshake rejected: missing vanni_at cookie");
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        return false;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler, Exception exception) {
    }
}
