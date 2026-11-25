package com.vanni.dto.response;

public record LinkPreviewDto(
    Long id,
    String url,
    String finalUrl,
    String siteName,
    String title,
    String description,
    String imageUrl,
    Integer imageWidth,
    Integer imageHeight
) {}
