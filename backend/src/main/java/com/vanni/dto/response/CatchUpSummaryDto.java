package com.vanni.dto.response;

import java.util.List;

public record CatchUpSummaryDto(
    String overview,
    List<SummaryPoint> keyPoints,
    List<SummaryPoint> decisions,
    List<ActionItem> actionItems,
    List<SummaryPoint> forYou
) {
    public record SummaryPoint(String text, List<Long> messageIds) {}

    public record ActionItem(String who, String what, List<Long> messageIds) {}
}
