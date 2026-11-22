-- UP
USE smart_logistics_v2;

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  direction ENUM('outbound','exchange_in') NOT NULL DEFAULT 'outbound',
  quantity INT UNSIGNED NOT NULL,
  delivered_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  collected_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  return_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  unit_value DECIMAL(15,0) NOT NULL DEFAULT 0,
  unit_cod_amount DECIMAL(15,0) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_order_items_order_direction (order_id, direction),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @repair_columns = CONCAT_WS(', ',
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'partial_delivery_allowed') = 0, 'ADD COLUMN partial_delivery_allowed TINYINT(1) NOT NULL DEFAULT 0', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'partial_delivery_completed') = 0, 'ADD COLUMN partial_delivery_completed TINYINT(1) NOT NULL DEFAULT 0', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'is_exchange') = 0, 'ADD COLUMN is_exchange TINYINT(1) NOT NULL DEFAULT 0', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'pickup_appointment_at') = 0, 'ADD COLUMN pickup_appointment_at DATETIME NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'pickup_deadline_at') = 0, 'ADD COLUMN pickup_deadline_at DATETIME NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'promised_delivery_at') = 0, 'ADD COLUMN promised_delivery_at DATETIME NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'receiver_lat') = 0, 'ADD COLUMN receiver_lat DOUBLE NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'receiver_lng') = 0, 'ADD COLUMN receiver_lng DOUBLE NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'pickup_shipper_id') = 0, 'ADD COLUMN pickup_shipper_id INT NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'delivery_shipper_id') = 0, 'ADD COLUMN delivery_shipper_id INT NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'central_transfer_shipper_id') = 0, 'ADD COLUMN central_transfer_shipper_id INT NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'destination_transfer_shipper_id') = 0, 'ADD COLUMN destination_transfer_shipper_id INT NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'origin_warehouse_id') = 0, 'ADD COLUMN origin_warehouse_id INT NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'destination_warehouse_id') = 0, 'ADD COLUMN destination_warehouse_id INT NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'current_warehouse_id') = 0, 'ADD COLUMN current_warehouse_id INT NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'storage_bin_id') = 0, 'ADD COLUMN storage_bin_id BIGINT NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'cross_docked') = 0, 'ADD COLUMN cross_docked TINYINT(1) NOT NULL DEFAULT 0', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'cod_payment_method') = 0, 'ADD COLUMN cod_payment_method ENUM(''cash'',''bank_transfer'') NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'cod_collected_amount') = 0, 'ADD COLUMN cod_collected_amount DECIMAL(15,0) NOT NULL DEFAULT 0', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'signature_image') = 0, 'ADD COLUMN signature_image VARCHAR(255) NULL', NULL)
);
SET @repair_ddl = IF(@repair_columns = '', 'SELECT 1', CONCAT('ALTER TABLE orders ', @repair_columns));
PREPARE repair_statement FROM @repair_ddl;
EXECUTE repair_statement;
DEALLOCATE PREPARE repair_statement;

INSERT INTO order_items (order_id, item_name, direction, quantity, unit_value, unit_cod_amount)
SELECT o.id, 'Hàng hóa', 'outbound', 1, COALESCE(o.item_value, 0), COALESCE(o.cod_amount, 0)
FROM orders o
WHERE NOT EXISTS (
  SELECT 1 FROM order_items i WHERE i.order_id = o.id AND i.direction = 'outbound'
);

CREATE TABLE IF NOT EXISTS employee_salary_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  monthly_salary DECIMAL(15,0) NOT NULL DEFAULT 0,
  allowance DECIMAL(15,0) NOT NULL DEFAULT 0,
  bonus_per_delivery DECIMAL(15,0) NOT NULL DEFAULT 0,
  commission_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  tenure_raise_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL,
  effective_to DATE DEFAULT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_salary_history_effective (user_id, effective_from, effective_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO employee_salary_history
  (user_id, monthly_salary, allowance, bonus_per_delivery, commission_rate, tenure_raise_percent, effective_from)
SELECT s.user_id, s.monthly_salary, s.allowance, s.bonus_per_delivery, s.commission_rate,
       s.tenure_raise_percent, DATE(s.updated_at)
FROM employee_salaries s
WHERE NOT EXISTS (
  SELECT 1 FROM employee_salary_history h
  WHERE h.user_id = s.user_id AND h.effective_from = DATE(s.updated_at)
);

CREATE TABLE IF NOT EXISTS pay_rules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  event_type ENUM('delivery_success','pickup','failed_valid','return') NOT NULL,
  area_code VARCHAR(100) NOT NULL,
  min_weight_kg DECIMAL(8,3) NOT NULL DEFAULT 0,
  max_weight_kg DECIMAL(8,3) DEFAULT NULL,
  start_time TIME DEFAULT NULL,
  end_time TIME DEFAULT NULL,
  holiday_multiplier_milli INT UNSIGNED NOT NULL DEFAULT 1000,
  amount_vnd DECIMAL(15,0) DEFAULT NULL,
  percent_rate DECIMAL(7,3) DEFAULT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE DEFAULT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_pay_rules_lookup (event_type, area_code, effective_from, effective_to),
  KEY idx_pay_rules_weight (min_weight_kg, max_weight_kg)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO pay_rules
  (event_type, area_code, min_weight_kg, holiday_multiplier_milli, amount_vnd, effective_from)
SELECT 'delivery_success', 'GOVAP_ALL', 0, 1000, 5000, '2026-01-01'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM pay_rules WHERE event_type = 'delivery_success' AND area_code = 'GOVAP_ALL' AND effective_from = '2026-01-01');
INSERT INTO pay_rules
  (event_type, area_code, min_weight_kg, holiday_multiplier_milli, amount_vnd, effective_from)
SELECT 'pickup', 'GOVAP_ALL', 0, 1000, 3000, '2026-01-01'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM pay_rules WHERE event_type = 'pickup' AND area_code = 'GOVAP_ALL' AND effective_from = '2026-01-01');
INSERT INTO pay_rules
  (event_type, area_code, min_weight_kg, holiday_multiplier_milli, amount_vnd, effective_from)
SELECT 'failed_valid', 'GOVAP_ALL', 0, 1000, 2000, '2026-01-01'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM pay_rules WHERE event_type = 'failed_valid' AND area_code = 'GOVAP_ALL' AND effective_from = '2026-01-01');
INSERT INTO pay_rules
  (event_type, area_code, min_weight_kg, holiday_multiplier_milli, amount_vnd, effective_from)
SELECT 'return', 'GOVAP_ALL', 0, 1000, 3000, '2026-01-01'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM pay_rules WHERE event_type = 'return' AND area_code = 'GOVAP_ALL' AND effective_from = '2026-01-01');

SET @repair_columns = CONCAT_WS(', ',
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'driver_route_stops' AND column_name = 'stop_sequence') = 0, 'ADD COLUMN stop_sequence INT UNSIGNED NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'driver_route_stops' AND column_name = 'planned_eta') = 0, 'ADD COLUMN planned_eta DATETIME NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'driver_route_stops' AND column_name = 'actual_arrival') = 0, 'ADD COLUMN actual_arrival DATETIME NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'driver_route_stops' AND column_name = 'distance_from_previous_m') = 0, 'ADD COLUMN distance_from_previous_m INT UNSIGNED NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'driver_route_stops' AND column_name = 'duration_from_previous_s') = 0, 'ADD COLUMN duration_from_previous_s INT UNSIGNED NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'driver_route_stops' AND column_name = 'is_manual_override') = 0, 'ADD COLUMN is_manual_override TINYINT(1) NOT NULL DEFAULT 0', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'driver_route_stops' AND column_name = 'override_reason') = 0, 'ADD COLUMN override_reason VARCHAR(500) NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'driver_route_stops' AND column_name = 'ranking_reason') = 0, 'ADD COLUMN ranking_reason VARCHAR(500) NULL', NULL)
);
SET @repair_ddl = IF(@repair_columns = '', 'SELECT 1', CONCAT('ALTER TABLE driver_route_stops ', @repair_columns));
PREPARE repair_statement FROM @repair_ddl;
EXECUTE repair_statement;
DEALLOCATE PREPARE repair_statement;
UPDATE driver_route_stops SET stop_sequence = stop_order WHERE stop_sequence IS NULL;

SET @repair_columns = CONCAT_WS(', ',
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'driver_routes' AND column_name = 'total_distance_m') = 0, 'ADD COLUMN total_distance_m INT UNSIGNED NOT NULL DEFAULT 0', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'driver_routes' AND column_name = 'total_duration_s') = 0, 'ADD COLUMN total_duration_s INT UNSIGNED NOT NULL DEFAULT 0', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'driver_routes' AND column_name = 'is_estimated') = 0, 'ADD COLUMN is_estimated TINYINT(1) NOT NULL DEFAULT 1', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'driver_routes' AND column_name = 'optimized_at') = 0, 'ADD COLUMN optimized_at DATETIME NULL', NULL),
  IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'driver_routes' AND column_name = 'mode') = 0, 'ADD COLUMN mode ENUM(''pickup'',''delivery'') NOT NULL DEFAULT ''delivery''', NULL)
);
SET @repair_ddl = IF(@repair_columns = '', 'SELECT 1', CONCAT('ALTER TABLE driver_routes ', @repair_columns));
PREPARE repair_statement FROM @repair_ddl;
EXECUTE repair_statement;
DEALLOCATE PREPARE repair_statement;

CREATE TABLE IF NOT EXISTS driver_route_optimization_history (
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

-- DOWN
DROP TABLE IF EXISTS driver_route_optimization_history;
ALTER TABLE driver_routes
  DROP COLUMN mode,
  DROP COLUMN optimized_at,
  DROP COLUMN is_estimated,
  DROP COLUMN total_duration_s,
  DROP COLUMN total_distance_m;
ALTER TABLE driver_route_stops
  DROP COLUMN ranking_reason,
  DROP COLUMN override_reason,
  DROP COLUMN is_manual_override,
  DROP COLUMN duration_from_previous_s,
  DROP COLUMN distance_from_previous_m,
  DROP COLUMN actual_arrival,
  DROP COLUMN planned_eta,
  DROP COLUMN stop_sequence;
ALTER TABLE orders
  DROP COLUMN signature_image,
  DROP COLUMN cod_collected_amount,
  DROP COLUMN cod_payment_method,
  DROP COLUMN cross_docked,
  DROP COLUMN storage_bin_id,
  DROP COLUMN current_warehouse_id,
  DROP COLUMN destination_warehouse_id,
  DROP COLUMN origin_warehouse_id,
  DROP COLUMN destination_transfer_shipper_id,
  DROP COLUMN central_transfer_shipper_id,
  DROP COLUMN delivery_shipper_id,
  DROP COLUMN pickup_shipper_id,
  DROP COLUMN receiver_lng,
  DROP COLUMN receiver_lat,
  DROP COLUMN promised_delivery_at,
  DROP COLUMN pickup_deadline_at,
  DROP COLUMN pickup_appointment_at,
  DROP COLUMN is_exchange,
  DROP COLUMN partial_delivery_completed,
  DROP COLUMN partial_delivery_allowed;
DROP TABLE IF EXISTS pay_rules;
DROP TABLE IF EXISTS employee_salary_history;
DROP TABLE IF EXISTS order_items;
