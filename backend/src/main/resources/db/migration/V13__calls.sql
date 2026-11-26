ALTER TABLE users
    ADD COLUMN calls_relay_only BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE call_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    call_uuid VARCHAR(64) NOT NULL,
    conversation_id BIGINT NOT NULL,
    caller_id BIGINT NOT NULL,
    callee_id BIGINT NOT NULL,
    call_type ENUM('AUDIO', 'VIDEO') NOT NULL,
    end_reason ENUM('COMPLETED', 'DECLINED', 'CANCELLED', 'MISSED', 'BUSY', 'FAILED', 'DISCONNECTED', 'HANDLED_ELSEWHERE') NOT NULL,
    started_at TIMESTAMP(3) NOT NULL,
    connected_at TIMESTAMP(3) NULL,
    ended_at TIMESTAMP(3) NOT NULL,
    duration_sec INT NOT NULL DEFAULT 0,
    CONSTRAINT uk_call_logs_uuid UNIQUE (call_uuid),
    CONSTRAINT fk_call_conv FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_call_caller FOREIGN KEY (caller_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_call_callee FOREIGN KEY (callee_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_call_conv_ended (conversation_id, ended_at)
);

ALTER TABLE messages
    ADD COLUMN call_log_id BIGINT NULL,
    ADD CONSTRAINT fk_msg_call_log FOREIGN KEY (call_log_id) REFERENCES call_logs(id) ON DELETE SET NULL;
