# Vanni - Database Design (MySQL 8.4)

All schema changes go through **Flyway**. Charset `utf8mb4`, engine InnoDB, timestamps in UTC (`DATETIME(3)`).

## 1. ER summary
```
users 1---* conversation_members *---1 conversations
users 1---* messages *---1 conversations
messages 1---* message_receipts *---1 users
messages 1---* attachments
messages 1---* reactions *---1 users
users 1---* refresh_tokens
users 1---* blocks (blocker, blocked)
messages 0..1---* messages (reply_to_id)
```

## 2. `V1__init.sql`
```sql
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

CREATE TABLE refresh_tokens (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT NOT NULL,
  token_hash  CHAR(64) NOT NULL,           -- SHA-256 of the token; never store raw
  family_id   CHAR(36) NOT NULL,           -- for reuse detection
  expires_at  DATETIME(3) NOT NULL,
  revoked_at  DATETIME(3) NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  user_agent  VARCHAR(255) NULL,
  CONSTRAINT uq_rt_hash UNIQUE (token_hash),
  CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_rt_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE conversations (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  type         ENUM('DIRECT','GROUP') NOT NULL,
  title        VARCHAR(100) NULL,           -- groups only
  description  VARCHAR(300) NULL,
  avatar_url   VARCHAR(500) NULL,
  direct_key   VARCHAR(41) NULL,            -- "minUserId_maxUserId" for DIRECT, NULL for GROUP
  created_by   BIGINT NOT NULL,
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  last_message_id BIGINT NULL,              -- denormalised for fast list; no FK to avoid cycle
  last_message_at DATETIME(3) NULL,
  CONSTRAINT uq_conv_direct_key UNIQUE (direct_key),   -- prevents duplicate direct chats
  CONSTRAINT fk_conv_creator FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_conv_last_message_at (last_message_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE conversation_members (
  id                    BIGINT AUTO_INCREMENT PRIMARY KEY,
  conversation_id       BIGINT NOT NULL,
  user_id               BIGINT NOT NULL,
  role                  ENUM('MEMBER','ADMIN') NOT NULL DEFAULT 'MEMBER',
  joined_at             DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  left_at               DATETIME(3) NULL,            -- soft leave; history stays
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
  client_message_id  CHAR(36) NULL,           -- idempotency key from client
  content            TEXT NULL,               -- up to 4000 chars enforced in service
  message_type       ENUM('TEXT','IMAGE','FILE','SYSTEM') NOT NULL DEFAULT 'TEXT',
  reply_to_id        BIGINT NULL,
  created_at         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  edited_at          DATETIME(3) NULL,
  deleted_at         DATETIME(3) NULL,
  CONSTRAINT fk_msg_conv   FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_msg_sender FOREIGN KEY (sender_id) REFERENCES users(id),
  CONSTRAINT fk_msg_reply  FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL,
  CONSTRAINT uq_msg_client UNIQUE (sender_id, client_message_id),
  INDEX idx_msg_conv_id (conversation_id, id)         -- cursor pagination
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE conversations
  ADD CONSTRAINT fk_conv_last_msg FOREIGN KEY (last_message_id) REFERENCES messages(id) ON DELETE SET NULL;

CREATE TABLE message_receipts (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  message_id  BIGINT NOT NULL,
  user_id     BIGINT NOT NULL,                 -- the recipient
  status      ENUM('DELIVERED','READ') NOT NULL,
  updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_receipt UNIQUE (message_id, user_id),
  CONSTRAINT fk_mr_msg  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_mr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_mr_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE attachments (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  message_id    BIGINT NULL,                   -- NULL until linked to a message
  uploader_id   BIGINT NOT NULL,
  file_name     VARCHAR(255) NOT NULL,
  mime_type     VARCHAR(100) NOT NULL,
  file_size     BIGINT NOT NULL,
  storage_key   VARCHAR(500) NOT NULL,
  width         INT NULL,
  height        INT NULL,
  created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_att_msg  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_att_user FOREIGN KEY (uploader_id) REFERENCES users(id),
  INDEX idx_att_msg (message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE reactions (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  message_id  BIGINT NOT NULL,
  user_id     BIGINT NOT NULL,
  emoji       VARCHAR(16) NOT NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_reaction UNIQUE (message_id, user_id, emoji),
  CONSTRAINT fk_re_msg  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  CONSTRAINT fk_re_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE blocks (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  blocker_id  BIGINT NOT NULL,
  blocked_id  BIGINT NOT NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_block UNIQUE (blocker_id, blocked_id),
  CONSTRAINT fk_bl_a FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_bl_b FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
> Phases add tables gradually: Phase 2 creates `users`, `refresh_tokens`; Phase 3 adds conversations/members/messages; Phase 6 receipts; Phase 7 attachments; Phase 8 reactions/blocks. Split the above into `V1`, `V2`... migrations accordingly. Never edit a migration that has already been committed; add a new one.

## 3. Rules and design notes
1. **Direct chat uniqueness:** `direct_key = min(a,b) + "_" + max(a,b)`. Service does *get-or-create* inside a transaction; the unique index is the safety net. On duplicate-key exception, re-select and return the existing one.
2. **Membership is the permission model.** Any read/write on a conversation first checks an active `conversation_members` row (`left_at IS NULL`).
3. **Read state:** `last_read_message_id` drives unread counts: `COUNT(messages WHERE conversation_id = ? AND id > last_read_message_id AND sender_id <> me AND deleted_at IS NULL)`.
4. **Receipt meaning** (be consistent in code and UI):
   - **SENT** - message row saved in MySQL (implicit, no receipt row).
   - **DELIVERED** - recipient's client received the event and acked it.
   - **READ** - recipient had the conversation open and visible; `last_read_message_id` advanced.
   - For groups: show *delivered* when all active recipients delivered, *read* when all read; message info panel lists per-user state.
   - Receipt rows are created lazily (on ack), not for every recipient at send time.
5. **Soft delete:** set `deleted_at`, blank `content` in API responses, keep row for reply references and receipts. Attachments of deleted messages are removed from storage by a cleanup job.
6. **Pagination:** `WHERE conversation_id = ? AND id < :before ORDER BY id DESC LIMIT :size` then reverse for display.
7. **Search:** start with `LIKE` on `content` (scoped to conversations the user is in). Optional later: MySQL `FULLTEXT` index with ngram parser.
8. **Cleanup jobs (scheduled):** delete expired/revoked refresh tokens; delete orphan attachments (no `message_id` older than 24 h).
9. **Seed data** (`database/seed.sql`, dev only): 5 users (password `Password@123`, stored as BCrypt hash), 1 group, ~50 messages.
10. **Entities:** use `@Enumerated(EnumType.STRING)`, `FetchType.LAZY`, and DTO projections for list queries to avoid N+1.
