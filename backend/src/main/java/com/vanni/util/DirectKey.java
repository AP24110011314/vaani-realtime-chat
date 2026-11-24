package com.vanni.util;

public final class DirectKey {
    private DirectKey() {}

    public static String of(Long userId1, Long userId2) {
        long min = Math.min(userId1, userId2);
        long max = Math.max(userId1, userId2);
        return min + "_" + max;
    }
}
