CREATE TABLE users (
  id               BIGINT AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(80)  NOT NULL,
  email            VARCHAR(190) NOT NULL,
  password_hash    VARCHAR(100) NOT NULL,
  avatar_url       VARCHAR(500) NULL,
  about            VARCHAR(200) NULL,
  show_last_seen   BOOLEAN NOT NULL DEFAULT TRUE,
  show_read_receipts BOOLEAN NOT NULL DEFAULT TRUE,
  enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  last_seen_at     DATETIME(3) NULL,
  CONSTRAINT uq_users_email UNIQUE (email),
  INDEX idx_users_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
