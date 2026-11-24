CREATE TABLE message_receipts (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  message_id  BIGINT NOT NULL,
  user_id     BIGINT NOT NULL,
  status      ENUM('DELIVERED','READ') NOT NULL,
  updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_receipt UNIQUE (message_id, user_id),
  CONSTRAINT fk_mr_msg  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_mr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_mr_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
