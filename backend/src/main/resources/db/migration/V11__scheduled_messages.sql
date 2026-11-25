CREATE TABLE scheduled_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    conversation_id BIGINT NOT NULL,
    sender_id BIGINT NOT NULL,
    client_message_id VARCHAR(64) NOT NULL,
    content TEXT NULL,
    reply_to_id BIGINT NULL,
    scheduled_for TIMESTAMP(3) NOT NULL,
    status ENUM('PENDING', 'SENDING', 'SENT', 'CANCELLED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    failure_reason VARCHAR(500) NULL,
    attempts INT NOT NULL DEFAULT 0,
    sent_message_id BIGINT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT uk_scheduled_client_id UNIQUE (sender_id, client_message_id),
    CONSTRAINT fk_sched_conv FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_sched_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_sched_reply FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL,
    CONSTRAINT fk_sched_sent_msg FOREIGN KEY (sent_message_id) REFERENCES messages(id) ON DELETE SET NULL,
    INDEX idx_sched_due (status, scheduled_for),
    INDEX idx_sched_sender_conv (sender_id, conversation_id, status, scheduled_for)
);

ALTER TABLE attachments
    ADD COLUMN scheduled_message_id BIGINT NULL AFTER message_id,
    ADD CONSTRAINT fk_attach_scheduled FOREIGN KEY (scheduled_message_id) REFERENCES scheduled_messages(id) ON DELETE SET NULL,
    ADD INDEX idx_attach_scheduled (scheduled_message_id);
