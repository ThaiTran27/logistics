-- UP
ALTER TABLE chat_sessions
  ADD COLUMN expires_at DATETIME NULL AFTER guest_token_hash;

UPDATE chat_sessions
SET expires_at = DATE_ADD(created_at, INTERVAL 24 HOUR)
WHERE expires_at IS NULL;

ALTER TABLE chat_sessions
  MODIFY COLUMN expires_at DATETIME NOT NULL,
  ADD KEY idx_chat_sessions_expiry (expires_at);

-- DOWN
ALTER TABLE chat_sessions
  DROP INDEX idx_chat_sessions_expiry,
  DROP COLUMN expires_at;
