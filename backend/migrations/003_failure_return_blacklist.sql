-- UP
ALTER TABLE orders
  ADD COLUMN pickup_attempts INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN delivery_attempts INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN return_shipper_id INT DEFAULT NULL;

ALTER TABLE driver_route_stops
  MODIFY COLUMN task_type ENUM('pickup','delivery','return') NOT NULL;

ALTER TABLE order_events
  ADD COLUMN signature_url VARCHAR(255) DEFAULT NULL AFTER photo_url;

ALTER TABLE warehouse_inventory_audit_items
  ADD COLUMN reason_code VARCHAR(50) DEFAULT NULL,
  ADD COLUMN reason_actor_id INT DEFAULT NULL,
  ADD COLUMN reason_recorded_at DATETIME DEFAULT NULL;

ALTER TABLE warehouse_inventory_audit_scans
  ADD COLUMN reason_code VARCHAR(50) DEFAULT NULL,
  ADD COLUMN reason_actor_id INT DEFAULT NULL,
  ADD COLUMN reason_recorded_at DATETIME DEFAULT NULL;

CREATE TABLE order_blacklist (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  entry_type ENUM('phone','address') NOT NULL,
  normalized_value VARCHAR(512) NOT NULL,
  occurrence_count INT UNSIGNED NOT NULL DEFAULT 2,
  source_reason_code VARCHAR(50) NOT NULL,
  last_order_id INT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_order_blacklist_type_value (entry_type, normalized_value),
  KEY idx_order_blacklist_last_order (last_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_bomb_incidents (
  order_id INT NOT NULL,
  entry_type ENUM('phone','address') NOT NULL,
  normalized_value VARCHAR(512) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id, entry_type, normalized_value),
  KEY idx_bomb_incident_match (entry_type, normalized_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE failure_settings_003_backup (
  setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
  setting_value VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO failure_settings_003_backup (setting_key, setting_value)
SELECT setting_key, setting_value
FROM system_settings
WHERE setting_key IN ('MAX_PICKUP_ATTEMPTS', 'MAX_DELIVERY_ATTEMPTS');

INSERT INTO system_settings (setting_key, setting_value)
VALUES ('MAX_PICKUP_ATTEMPTS', '3'), ('MAX_DELIVERY_ATTEMPTS', '3')
ON DUPLICATE KEY UPDATE setting_key = VALUES(setting_key);

-- DOWN
DELETE FROM system_settings
WHERE setting_key IN ('MAX_PICKUP_ATTEMPTS', 'MAX_DELIVERY_ATTEMPTS')
  AND setting_key NOT IN (SELECT setting_key FROM failure_settings_003_backup);
INSERT INTO system_settings (setting_key, setting_value)
SELECT setting_key, setting_value FROM failure_settings_003_backup
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
DROP TABLE failure_settings_003_backup;
DROP TABLE order_bomb_incidents;
DROP TABLE order_blacklist;
ALTER TABLE warehouse_inventory_audit_scans
  DROP COLUMN reason_recorded_at,
  DROP COLUMN reason_actor_id,
  DROP COLUMN reason_code;
ALTER TABLE warehouse_inventory_audit_items
  DROP COLUMN reason_recorded_at,
  DROP COLUMN reason_actor_id,
  DROP COLUMN reason_code;
ALTER TABLE order_events DROP COLUMN signature_url;
UPDATE driver_route_stops SET task_type = 'delivery' WHERE task_type = 'return';
ALTER TABLE driver_route_stops
  MODIFY COLUMN task_type ENUM('pickup','delivery') NOT NULL;
ALTER TABLE orders
  DROP COLUMN return_shipper_id,
  DROP COLUMN delivery_attempts,
  DROP COLUMN pickup_attempts;
