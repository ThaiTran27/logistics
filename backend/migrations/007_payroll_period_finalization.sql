-- UP
ALTER TABLE orders
  ADD COLUMN promised_delivery_at DATETIME DEFAULT NULL;

ALTER TABLE order_events
  ADD KEY idx_order_events_created_at (created_at);

CREATE TABLE payroll_periods (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  payroll_month CHAR(7) NOT NULL,
  status ENUM('open','locked') NOT NULL DEFAULT 'open',
  opened_by INT DEFAULT NULL,
  locked_by INT DEFAULT NULL,
  locked_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payroll_period_month (payroll_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE payslips (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  payroll_period_id BIGINT UNSIGNED NOT NULL,
  user_id INT NOT NULL,
  gross_amount DECIMAL(15,0) NOT NULL DEFAULT 0,
  deduction_amount DECIMAL(15,0) NOT NULL DEFAULT 0,
  net_amount DECIMAL(15,0) NOT NULL DEFAULT 0,
  snapshot_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payslip_period_user (payroll_period_id, user_id),
  KEY idx_payslip_user (user_id, payroll_period_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE payslip_lines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  payslip_id BIGINT UNSIGNED NOT NULL,
  line_type VARCHAR(40) NOT NULL,
  description VARCHAR(500) NOT NULL,
  amount DECIMAL(15,0) NOT NULL,
  order_id INT DEFAULT NULL,
  source_type VARCHAR(40) DEFAULT NULL,
  source_id BIGINT UNSIGNED DEFAULT NULL,
  rule_id BIGINT UNSIGNED DEFAULT NULL,
  detail_json JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_payslip_lines_slip (payslip_id, id),
  KEY idx_payslip_lines_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE payroll_bonus_rules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  metric_type ENUM('delivery_success_rate','delivery_count','on_time_rate','attendance_rate') NOT NULL,
  minimum_value DECIMAL(8,2) NOT NULL,
  reward_amount DECIMAL(15,0) NOT NULL,
  description VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  effective_from DATE NOT NULL,
  effective_to DATE DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_payroll_bonus_effective (metric_type, is_active, effective_from, effective_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE payroll_deductions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  deduction_type ENUM('security_deposit','advance') NOT NULL,
  amount DECIMAL(15,0) NOT NULL,
  remaining_amount DECIMAL(15,0) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  status ENUM('open','settled') NOT NULL DEFAULT 'open',
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  settled_at DATETIME DEFAULT NULL,
  KEY idx_payroll_deductions_user (user_id, status, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE payroll_migration_settings_backup (
  setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
  was_present TINYINT(1) NOT NULL,
  previous_value VARCHAR(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO payroll_migration_settings_backup (setting_key, was_present, previous_value)
SELECT 'PAYROLL_EXPECTED_WORKDAYS', COUNT(*) > 0, MAX(setting_value)
FROM system_settings
WHERE setting_key = 'PAYROLL_EXPECTED_WORKDAYS';

INSERT INTO system_settings (setting_key, setting_value)
VALUES ('PAYROLL_EXPECTED_WORKDAYS', '26')
ON DUPLICATE KEY UPDATE setting_key = VALUES(setting_key);

-- Illustrative bonus thresholds; review and replace with approved policy.
INSERT INTO payroll_bonus_rules
  (metric_type, minimum_value, reward_amount, description, effective_from)
VALUES
  ('delivery_success_rate', 95, 150000, 'Thưởng tỷ lệ giao thành công từ 95%', '2026-01-01'),
  ('delivery_count', 100, 100000, 'Thưởng sản lượng từ 100 đơn giao', '2026-01-01'),
  ('on_time_rate', 95, 100000, 'Thưởng tỷ lệ giao đúng hẹn từ 95%', '2026-01-01'),
  ('attendance_rate', 95, 100000, 'Thưởng chuyên cần từ 95%', '2026-01-01');

-- DOWN
UPDATE system_settings s
JOIN payroll_migration_settings_backup b ON b.setting_key = s.setting_key
SET s.setting_value = b.previous_value
WHERE b.was_present = 1;
DELETE FROM system_settings
WHERE setting_key = 'PAYROLL_EXPECTED_WORKDAYS'
  AND EXISTS (
    SELECT 1 FROM payroll_migration_settings_backup
    WHERE setting_key = 'PAYROLL_EXPECTED_WORKDAYS' AND was_present = 0
  );
DROP TABLE payroll_deductions;
DROP TABLE payroll_bonus_rules;
DROP TABLE payslip_lines;
DROP TABLE payslips;
DROP TABLE payroll_periods;
DROP TABLE payroll_migration_settings_backup;
ALTER TABLE orders DROP COLUMN promised_delivery_at;
ALTER TABLE order_events DROP INDEX idx_order_events_created_at;
