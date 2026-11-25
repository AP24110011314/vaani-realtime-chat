package com.vanni.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

import java.io.Serializable;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class MessageLinkPreviewId implements Serializable {

    @Column(name = "message_id")
    private Long messageId;

    @Column(name = "preview_id")
    private Long previewId;
}
