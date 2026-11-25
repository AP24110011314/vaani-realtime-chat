package com.vanni.service;

import com.vanni.entity.ConversationMember;
import com.vanni.entity.NotifyMode;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class NotificationPolicyTest {

    private ConversationMember memberWithMode(NotifyMode mode) {
        ConversationMember m = new ConversationMember();
        m.setNotifyMode(mode);
        m.setMuted(mode == NotifyMode.NONE);
        return m;
    }

    @Test
    void neverNotifiesSender() {
        assertThat(NotificationPolicy.shouldNotify(memberWithMode(NotifyMode.ALL), true, true, true)).isFalse();
        assertThat(NotificationPolicy.shouldNotify(memberWithMode(NotifyMode.MENTIONS), true, true, true)).isFalse();
        assertThat(NotificationPolicy.shouldNotify(memberWithMode(NotifyMode.NONE), true, true, true)).isFalse();
    }

    @Test
    void modeAllNotifiesForPlainMentionAndReply() {
        ConversationMember m = memberWithMode(NotifyMode.ALL);
        assertThat(NotificationPolicy.shouldNotify(m, false, false, false)).isTrue();
        assertThat(NotificationPolicy.shouldNotify(m, false, true, false)).isTrue();
        assertThat(NotificationPolicy.shouldNotify(m, false, false, true)).isTrue();
    }

    @Test
    void modeMentionsNotifiesOnlyForMentionOrReplyToMe() {
        ConversationMember m = memberWithMode(NotifyMode.MENTIONS);
        assertThat(NotificationPolicy.shouldNotify(m, false, false, false)).isFalse();
        assertThat(NotificationPolicy.shouldNotify(m, false, true, false)).isTrue();
        assertThat(NotificationPolicy.shouldNotify(m, false, false, true)).isTrue();
    }

    @Test
    void modeNoneNeverTriggersNotification() {
        ConversationMember m = memberWithMode(NotifyMode.NONE);
        assertThat(NotificationPolicy.shouldNotify(m, false, false, false)).isFalse();
        assertThat(NotificationPolicy.shouldNotify(m, false, true, false)).isFalse();
        assertThat(NotificationPolicy.shouldNotify(m, false, false, true)).isFalse();
    }
}
