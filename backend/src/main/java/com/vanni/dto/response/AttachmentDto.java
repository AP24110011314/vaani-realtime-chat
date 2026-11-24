package com.vanni.dto.response;

public record AttachmentDto(
    Long id,
    String fileName,
    String mimeType,
    long size,
    String url,
    Integer width,
    Integer height
) {}
