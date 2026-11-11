-- UP
ALTER TABLE driver_route_stops
  ADD COLUMN stop_sequence INT UNSIGNED NULL,
  ADD COLUMN planned_eta DATETIME NULL,
  ADD COLUMN actual_arrival DATETIME NULL,
  ADD COLUMN distance_from_previous_m INT UNSIGNED NULL,
  ADD COLUMN duration_from_previous_s INT UNSIGNED NULL,
  ADD COLUMN is_manual_override TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN override_reason VARCHAR(500) NULL;

UPDATE driver_route_stops SET stop_sequence = stop_order WHERE stop_sequence IS NULL;

ALTER TABLE driver_routes
  ADD COLUMN total_distance_m INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN total_duration_s INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN is_estimated TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN optimized_at DATETIME NULL,
  ADD COLUMN mode ENUM('pickup','delivery') NOT NULL DEFAULT 'delivery';

ALTER TABLE orders
  ADD COLUMN pickup_appointment_at DATETIME NULL;

CREATE TABLE driver_route_optimization_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  driver_id INT NOT NULL,
  mode ENUM('pickup','delivery') NOT NULL,
  actor_id INT NULL,
  actor_role VARCHAR(50) NOT NULL DEFAULT 'system',
  reason ENUM('new_order','cancelled','failed','reassigned','off_route','manual','stop_completed','initial') NOT NULL,
  is_estimated TINYINT(1) NOT NULL DEFAULT 0,
  total_distance_m INT UNSIGNED NOT NULL DEFAULT 0,
  total_duration_s INT UNSIGNED NOT NULL DEFAULT 0,
  route_snapshot JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_route_history_driver (driver_id, mode, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO system_settings (setting_key, setting_value) VALUES
  ('ROUTE_PRIORITY_EXPRESS_SECONDS', '1800'),
  ('ROUTE_PRIORITY_SLA_SECONDS', '1200'),
  ('ROUTE_PRIORITY_FAILED_SECONDS', '900'),
  ('ROUTE_PRIORITY_APPOINTMENT_SECONDS', '600'),
  ('ROUTE_NEAR_SLA_HOURS', '2'),
  ('ROUTE_DEVIATION_THRESHOLD_M', '300'),
  ('ROUTE_MAX_ACTIVE_STOPS', '60')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- DOWN
DELETE FROM system_settings WHERE setting_key IN (
  'ROUTE_PRIORITY_EXPRESS_SECONDS',
  'ROUTE_PRIORITY_SLA_SECONDS',
  'ROUTE_PRIORITY_FAILED_SECONDS',
  'ROUTE_PRIORITY_APPOINTMENT_SECONDS',
  'ROUTE_NEAR_SLA_HOURS',
  'ROUTE_DEVIATION_THRESHOLD_M',
  'ROUTE_MAX_ACTIVE_STOPS'
);

DROP TABLE driver_route_optimization_history;
ALTER TABLE orders DROP COLUMN pickup_appointment_at;
ALTER TABLE driver_routes
  DROP COLUMN mode,
  DROP COLUMN optimized_at,
  DROP COLUMN is_estimated,
  DROP COLUMN total_duration_s,
  DROP COLUMN total_distance_m;
ALTER TABLE driver_route_stops
  DROP COLUMN override_reason,
  DROP COLUMN is_manual_override,
  DROP COLUMN duration_from_previous_s,
  DROP COLUMN distance_from_previous_m,
  DROP COLUMN actual_arrival,
  DROP COLUMN planned_eta,
  DROP COLUMN stop_sequence;
