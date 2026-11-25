package com.vanni.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "message_mentions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class MessageMention {

    @EmbeddedId
    private MessageMentionId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("messageId")
    @JoinColumn(name = "message_id", nullable = false)
    private Message message;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("userId")
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    public MessageMention(Message message, User user) {
        this.id = new MessageMentionId(message.getId(), user.getId());
        this.message = message;
        this.user = user;
    }
}
