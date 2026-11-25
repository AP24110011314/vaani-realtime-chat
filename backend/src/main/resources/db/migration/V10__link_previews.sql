CREATE TABLE link_previews (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  url_hash     CHAR(64) NOT NULL,
  url          VARCHAR(2048) NOT NULL,
  final_url    VARCHAR(2048) NULL,
  site_name    VARCHAR(100) NULL,
  title        VARCHAR(200) NULL,
  description  VARCHAR(300) NULL,
  image_key    VARCHAR(500) NULL,
  image_width  INT NULL,
  image_height INT NULL,
  status       ENUM('OK','FAILED','BLOCKED') NOT NULL,
  fetched_at   DATETIME(3) NOT NULL,
  expires_at   DATETIME(3) NOT NULL,
  CONSTRAINT uq_lp_hash UNIQUE (url_hash),
  INDEX idx_lp_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE message_link_previews (
  message_id BIGINT NOT NULL,
  preview_id BIGINT NOT NULL,
  position   TINYINT NOT NULL DEFAULT 0,
  PRIMARY KEY (message_id, preview_id),
  CONSTRAINT fk_mlp_msg FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_mlp_prev FOREIGN KEY (preview_id) REFERENCES link_previews(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE users ADD COLUMN link_previews_enabled BOOLEAN NOT NULL DEFAULT TRUE;
