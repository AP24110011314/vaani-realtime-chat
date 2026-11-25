package com.vanni.dto.response;

import java.util.List;

public record AttachmentDto(
    Long id,
    String fileName,
    String mimeType,
    long size,
    String url,
    Integer width,
    Integer height,
    Integer durationMs,
    List<Integer> waveform
) {
    public AttachmentDto(Long id, String fileName, String mimeType, long size, String url, Integer width, Integer height) {
        this(id, fileName, mimeType, size, url, width, height, null, null);
    }
}
