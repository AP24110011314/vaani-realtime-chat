CREATE TABLE message_mentions (
  message_id BIGINT NOT NULL,
  user_id    BIGINT NOT NULL,
  PRIMARY KEY (message_id, user_id),
  CONSTRAINT fk_mm_msg  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_mm_user FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  INDEX idx_mm_user (user_id, message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE messages ADD COLUMN mentions_all BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE conversation_members
  ADD COLUMN notify_mode ENUM('ALL','MENTIONS','NONE') NOT NULL DEFAULT 'ALL';

UPDATE conversation_members SET notify_mode = 'NONE' WHERE muted = TRUE;
