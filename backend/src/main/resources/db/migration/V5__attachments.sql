CREATE TABLE attachments (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  message_id    BIGINT NULL,
  uploader_id   BIGINT NOT NULL,
  file_name     VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(100) NOT NULL,
  file_size     BIGINT NOT NULL,
  storage_key   VARCHAR(500) NOT NULL,
  width         INT NULL,
  height        INT NULL,
  created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_att_msg  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_att_user FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_att_msg (message_id),
  INDEX idx_att_uploader (uploader_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
