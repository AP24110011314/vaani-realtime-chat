package com.vanni.service;

import com.vanni.entity.ConversationMember;
import com.vanni.entity.NotifyMode;

/**
 * Determines whether a member should receive a notification (toast / browser notification)
 * for an incoming message based on notifyMode, mentions, and replies.
 */
public final class NotificationPolicy {

    private NotificationPolicy() {}

    public static boolean shouldNotify(
            ConversationMember member,
            boolean isSender,
            boolean isMentioned,
            boolean isReplyToMe) {
        if (member == null || isSender) {
            return false;
        }
        NotifyMode mode = member.getNotifyMode();
        if (mode == null) {
            mode = member.isMuted() ? NotifyMode.NONE : NotifyMode.ALL;
        }
        return switch (mode) {
            case ALL -> true;
            case MENTIONS -> isMentioned || isReplyToMe;
            case NONE -> false;
        };
    }
}
