CREATE TABLE group_invites (
  id                BIGINT AUTO_INCREMENT PRIMARY KEY,
  conversation_id   BIGINT NOT NULL,
  code_hash         CHAR(64) NOT NULL,
  code_prefix       CHAR(6)  NOT NULL,
  created_by        BIGINT NOT NULL,
  expires_at        DATETIME(3) NULL,
  max_uses          INT NULL,
  use_count         INT NOT NULL DEFAULT 0,
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at        DATETIME(3) NULL,
  created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_invite_hash UNIQUE (code_hash),
  CONSTRAINT fk_gi_conv FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_gi_user FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_gi_conv (conversation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE group_join_requests (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT NOT NULL,
  user_id         BIGINT NOT NULL,
  invite_id       BIGINT NULL,
  status          ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  decided_by      BIGINT NULL,
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  decided_at      DATETIME(3) NULL,
  CONSTRAINT fk_jr_conv FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_jr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_jr_inv  FOREIGN KEY (invite_id) REFERENCES group_invites(id) ON DELETE SET NULL,
  INDEX idx_jr_conv_status (conversation_id, status),
  CONSTRAINT uq_jr_pending UNIQUE (conversation_id, user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE conversation_members ADD COLUMN banned BOOLEAN NOT NULL DEFAULT FALSE;
