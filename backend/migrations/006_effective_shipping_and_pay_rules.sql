-- UP
CREATE TABLE shipping_rates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  area_code VARCHAR(100) NOT NULL,
  min_weight_kg DECIMAL(8,3) NOT NULL,
  max_weight_kg DECIMAL(8,3) DEFAULT NULL,
  service_type ENUM('economy','standard','express') NOT NULL,
  base_fee DECIMAL(15,0) NOT NULL,
  included_distance_km DECIMAL(8,3) NOT NULL DEFAULT 0,
  distance_fee_per_km DECIMAL(15,0) NOT NULL DEFAULT 0,
  included_weight_kg DECIMAL(8,3) NOT NULL DEFAULT 0,
  weight_step_kg DECIMAL(8,3) NOT NULL DEFAULT 1,
  weight_step_fee DECIMAL(15,0) NOT NULL DEFAULT 0,
  remote_area_fee DECIMAL(15,0) NOT NULL DEFAULT 0,
  fragile_fee DECIMAL(15,0) NOT NULL DEFAULT 0,
  motorbike_multiplier_milli INT UNSIGNED NOT NULL DEFAULT 1000,
  van_multiplier_milli INT UNSIGNED NOT NULL DEFAULT 1000,
  truck_multiplier_milli INT UNSIGNED NOT NULL DEFAULT 1000,
  rounding_increment DECIMAL(15,0) NOT NULL DEFAULT 1,
  effective_from DATE NOT NULL,
  effective_to DATE DEFAULT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_shipping_rates_lookup (area_code, service_type, effective_from, effective_to),
  KEY idx_shipping_rates_weight (min_weight_kg, max_weight_kg)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE pay_rules (
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

ALTER TABLE orders
  ADD COLUMN shipping_rate_id BIGINT UNSIGNED DEFAULT NULL,
  ADD COLUMN shipping_rate_snapshot JSON DEFAULT NULL,
  ADD COLUMN shipping_rate_effective_at DATETIME DEFAULT NULL,
  ADD KEY idx_orders_shipping_rate (shipping_rate_id);

CREATE TABLE employee_salary_history (
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

INSERT INTO system_settings (setting_key, setting_value)
VALUES ('HOLIDAY_DATES', '[]')
ON DUPLICATE KEY UPDATE setting_key = VALUES(setting_key);

INSERT INTO employee_salary_history
  (user_id, monthly_salary, allowance, bonus_per_delivery, commission_rate, tenure_raise_percent, effective_from)
SELECT user_id, monthly_salary, allowance, bonus_per_delivery, commission_rate, tenure_raise_percent,
       DATE(updated_at)
FROM employee_salaries;

-- Example tariff data only. Replace with the organization's approved rates.
-- These rates are illustrative defaults, not approved customer tariffs.
INSERT INTO shipping_rates
  (area_code, min_weight_kg, max_weight_kg, service_type, base_fee,
   included_distance_km, distance_fee_per_km, included_weight_kg, weight_step_kg,
   weight_step_fee, remote_area_fee, fragile_fee, motorbike_multiplier_milli,
   van_multiplier_milli, truck_multiplier_milli, rounding_increment, effective_from)
VALUES
  ('GOVAP_ALL', 0, NULL, 'economy', 18000, 5, 1700, 2, 0.5, 4500, 22000, 12000, 1000, 1500, 2500, 1000, '2026-01-01'),
  ('GOVAP_ALL', 0, NULL, 'standard', 28000, 5, 1700, 2, 0.5, 4500, 22000, 12000, 1000, 1500, 2500, 1000, '2026-01-01'),
  ('GOVAP_ALL', 0, NULL, 'express', 45000, 5, 1700, 2, 0.5, 4500, 22000, 12000, 1000, 1500, 2500, 1000, '2026-01-01');

-- Illustrative payroll rules; production amounts must be reviewed by accounting.
INSERT INTO pay_rules
  (event_type, area_code, min_weight_kg, max_weight_kg, holiday_multiplier_milli,
   amount_vnd, percent_rate, effective_from)
VALUES
  ('delivery_success', 'GOVAP_ALL', 0, NULL, 1000, 5000, NULL, '2026-01-01'),
  ('pickup', 'GOVAP_ALL', 0, NULL, 1000, 3000, NULL, '2026-01-01'),
  ('failed_valid', 'GOVAP_ALL', 0, NULL, 1000, 2000, NULL, '2026-01-01'),
  ('return', 'GOVAP_ALL', 0, NULL, 1000, 3000, NULL, '2026-01-01');

-- DOWN
DROP TABLE employee_salary_history;
DELETE FROM system_settings
WHERE setting_key = 'HOLIDAY_DATES' AND setting_value = '[]';
ALTER TABLE orders
  DROP INDEX idx_orders_shipping_rate,
  DROP COLUMN shipping_rate_effective_at,
  DROP COLUMN shipping_rate_snapshot,
  DROP COLUMN shipping_rate_id;
DROP TABLE pay_rules;
DROP TABLE shipping_rates;
