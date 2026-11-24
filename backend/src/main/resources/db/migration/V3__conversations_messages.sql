CREATE TABLE conversations (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  type            ENUM('DIRECT','GROUP') NOT NULL,
  title           VARCHAR(100) NULL,
  description     VARCHAR(300) NULL,
  avatar_url      VARCHAR(500) NULL,
  direct_key      VARCHAR(41) NULL,
  created_by      BIGINT NOT NULL,
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  last_message_id BIGINT NULL,
  last_message_at DATETIME(3) NULL,
  CONSTRAINT uq_conv_direct_key UNIQUE (direct_key),
  CONSTRAINT fk_conv_creator FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_conv_last_message_at (last_message_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE conversation_members (
  id                    BIGINT AUTO_INCREMENT PRIMARY KEY,
  conversation_id       BIGINT NOT NULL,
  user_id               BIGINT NOT NULL,
  role                  ENUM('MEMBER','ADMIN') NOT NULL DEFAULT 'MEMBER',
  joined_at             DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  left_at               DATETIME(3) NULL,
  last_read_message_id  BIGINT NULL,
  last_read_at          DATETIME(3) NULL,
  muted                 BOOLEAN NOT NULL DEFAULT FALSE,
  archived              BOOLEAN NOT NULL DEFAULT FALSE,
  pinned                BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT uq_member UNIQUE (conversation_id, user_id),
  CONSTRAINT fk_cm_conv FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_cm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_cm_user (user_id, left_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE messages (
  id                 BIGINT AUTO_INCREMENT PRIMARY KEY,
  conversation_id    BIGINT NOT NULL,
  sender_id          BIGINT NOT NULL,
  client_message_id  CHAR(36) NULL,
  content            TEXT NULL,
  message_type       ENUM('TEXT','IMAGE','FILE','SYSTEM') NOT NULL DEFAULT 'TEXT',
  reply_to_id        BIGINT NULL,
  created_at         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  edited_at          DATETIME(3) NULL,
  deleted_at         DATETIME(3) NULL,
  CONSTRAINT fk_msg_conv   FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_msg_sender FOREIGN KEY (sender_id) REFERENCES users(id),
  CONSTRAINT fk_msg_reply  FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL,
  CONSTRAINT uq_msg_client UNIQUE (sender_id, client_message_id),
  INDEX idx_msg_conv_id (conversation_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE conversations
  ADD CONSTRAINT fk_conv_last_msg FOREIGN KEY (last_message_id) REFERENCES messages(id) ON DELETE SET NULL;
