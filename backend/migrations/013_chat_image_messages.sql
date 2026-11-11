-- UP
ALTER TABLE chat_messages
  ADD COLUMN image_url VARCHAR(500) DEFAULT NULL AFTER message;

-- DOWN
ALTER TABLE chat_messages
  DROP COLUMN image_url;
