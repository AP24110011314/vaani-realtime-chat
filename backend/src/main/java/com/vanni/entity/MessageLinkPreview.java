package com.vanni.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "message_link_previews")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessageLinkPreview {

    @EmbeddedId
    private MessageLinkPreviewId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("messageId")
    @JoinColumn(name = "message_id", nullable = false)
    private Message message;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("previewId")
    @JoinColumn(name = "preview_id", nullable = false)
    private LinkPreview preview;

    @Column(nullable = false, columnDefinition = "TINYINT NOT NULL DEFAULT 0")
    @Builder.Default
    private byte position = 0;

    public MessageLinkPreview(Message message, LinkPreview preview, int position) {
        this.id = new MessageLinkPreviewId(message.getId(), preview.getId());
        this.message = message;
        this.preview = preview;
        this.position = (byte) position;
    }
}
