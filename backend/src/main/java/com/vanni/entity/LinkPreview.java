package com.vanni.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "link_previews")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LinkPreview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "url_hash", nullable = false, unique = true, length = 64, columnDefinition = "CHAR(64)")
    private String urlHash;

    @Column(nullable = false, length = 2048)
    private String url;

    @Column(name = "final_url", length = 2048)
    private String finalUrl;

    @Column(name = "site_name", length = 100)
    private String siteName;

    @Column(length = 200)
    private String title;

    @Column(length = 300)
    private String description;

    @Column(name = "image_key", length = 500)
    private String imageKey;

    @Column(name = "image_width")
    private Integer imageWidth;

    @Column(name = "image_height")
    private Integer imageHeight;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "ENUM('OK','FAILED','BLOCKED')")
    private LinkPreviewStatus status;

    @Column(name = "fetched_at", nullable = false)
    private Instant fetchedAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;
}
