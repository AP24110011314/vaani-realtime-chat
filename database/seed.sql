-- Vanni Development Seed Data (Phase 3)
-- Password for all dev users is: Password@123
-- BCrypt hash with 12 rounds:

INSERT INTO users (id, name, email, password_hash, about, enabled, show_last_seen, show_read_receipts, created_at, updated_at)
VALUES
  (1, 'Asha Sharma', 'asha@example.com', '$2a$12$uE335oG5P2R5l2QyS3mH2eqG6B9Z7v0K1x3M2sQ8WkG6aKl9P0Y2e', 'Hey there! I am using Vanni.', true, true, true, NOW(3), NOW(3)),
  (2, 'Ravi Patel', 'ravi@example.com', '$2a$12$uE335oG5P2R5l2QyS3mH2eqG6B9Z7v0K1x3M2sQ8WkG6aKl9P0Y2e', 'Available', true, true, true, NOW(3), NOW(3)),
  (3, 'Priya Singh', 'priya@example.com', '$2a$12$uE335oG5P2R5l2QyS3mH2eqG6B9Z7v0K1x3M2sQ8WkG6aKl9P0Y2e', 'At work', true, true, true, NOW(3), NOW(3)),
  (4, 'Arjun Kumar', 'arjun@example.com', '$2a$12$uE335oG5P2R5l2QyS3mH2eqG6B9Z7v0K1x3M2sQ8WkG6aKl9P0Y2e', 'Coffee & Code', true, true, true, NOW(3), NOW(3)),
  (5, 'Neha Verma', 'neha@example.com', '$2a$12$uE335oG5P2R5l2QyS3mH2eqG6B9Z7v0K1x3M2sQ8WkG6aKl9P0Y2e', 'Busy', true, true, true, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Direct conversation between Asha (1) and Ravi (2)
INSERT INTO conversations (id, type, direct_key, created_by, created_at, updated_at)
VALUES (1, 'DIRECT', '1_2', 1, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE id=id;

INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
VALUES
  (1, 1, 'MEMBER', NOW(3)),
  (1, 2, 'MEMBER', NOW(3))
ON DUPLICATE KEY UPDATE role=VALUES(role);

INSERT INTO messages (id, conversation_id, sender_id, client_message_id, content, message_type, created_at)
VALUES
  (1, 1, 1, 'seed-client-1', 'Hi Ravi! Welcome to Vanni.', 'TEXT', NOW(3)),
  (2, 1, 2, 'seed-client-2', 'Hey Asha! Glad to be here. Direct chat works great!', 'TEXT', NOW(3))
ON DUPLICATE KEY UPDATE content=VALUES(content);

UPDATE conversations SET last_message_id = 2, last_message_at = NOW(3) WHERE id = 1;
