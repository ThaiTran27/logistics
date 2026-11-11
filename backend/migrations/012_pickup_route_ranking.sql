-- UP
ALTER TABLE driver_route_stops
  ADD COLUMN ranking_reason VARCHAR(500) NULL;

ALTER TABLE orders
  ADD COLUMN pickup_deadline_at DATETIME NULL;

INSERT INTO system_settings (setting_key, setting_value) VALUES
  ('PICKUP_FIFO_BUCKET_MINUTES', '30'),
  ('PICKUP_MAX_WAIT_MINUTES', '120'),
  ('PICKUP_SLA_MINUTES', '120'),
  ('PICKUP_PRIORITY_ORDER', 'fifo,deadline,distance')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- DOWN
DELETE FROM system_settings
WHERE setting_key IN (
  'PICKUP_FIFO_BUCKET_MINUTES',
  'PICKUP_MAX_WAIT_MINUTES',
  'PICKUP_SLA_MINUTES',
  'PICKUP_PRIORITY_ORDER'
);

ALTER TABLE orders DROP COLUMN pickup_deadline_at;
ALTER TABLE driver_route_stops DROP COLUMN ranking_reason;
