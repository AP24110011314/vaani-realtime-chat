package com.vanni.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final CookieUtil cookieUtil;

    public JwtAuthFilter(JwtService jwtService, CookieUtil cookieUtil) {
        this.jwtService = jwtService;
        this.cookieUtil = cookieUtil;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        Optional<String> tokenOpt = cookieUtil.getCookieValue(request, "vanni_at");
        if (tokenOpt.isPresent()) {
            String token = tokenOpt.get();
            try {
                Claims claims = jwtService.parseAndValidate(token);
                Long userId = Long.parseLong(claims.getSubject());
                String email = claims.get("email", String.class);
                String name = claims.get("name", String.class);

                if (userId != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                    UserPrincipal principal = new UserPrincipal(userId, email, name, List.of());
                    UsernamePasswordAuthenticationToken authToken =
                            new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            } catch (Exception ignored) {
                // Invalid or expired token: context remains unauthenticated
            }
        }

        filterChain.doFilter(request, response);
    }
}
