-- UP
ALTER TABLE driver_cash_remittances
  ADD COLUMN work_date DATE DEFAULT NULL,
  ADD COLUMN expected_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN variance_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN variance_reason VARCHAR(500) DEFAULT NULL,
  ADD COLUMN created_by INT DEFAULT NULL;

UPDATE driver_cash_remittances
SET work_date = DATE(created_at),
    expected_amount = amount,
    variance_amount = 0
WHERE work_date IS NULL;

ALTER TABLE driver_cash_remittances
  MODIFY COLUMN work_date DATE NOT NULL;

ALTER TABLE orders
  ADD COLUMN failure_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD KEY idx_orders_cod_remittance (cod_remittance_id),
  ADD KEY idx_orders_cod_settlement (cod_settlement_id);

ALTER TABLE cod_settlements
  ADD COLUMN total_failure_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN cycle_code VARCHAR(10) NOT NULL DEFAULT 'T+1',
  ADD COLUMN period_start DATE DEFAULT NULL,
  ADD COLUMN period_end DATE DEFAULT NULL,
  ADD COLUMN transfer_file_reference VARCHAR(100) DEFAULT NULL;

CREATE TABLE cod_financial_004_setting_backup (
  setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
  setting_value VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO cod_financial_004_setting_backup (setting_key, setting_value)
SELECT setting_key, setting_value
FROM system_settings
WHERE setting_key = 'COD_SETTLEMENT_CYCLE';

INSERT INTO system_settings (setting_key, setting_value)
VALUES ('COD_SETTLEMENT_CYCLE', 'T+1')
ON DUPLICATE KEY UPDATE setting_key = VALUES(setting_key);

-- DOWN
DELETE FROM system_settings
WHERE setting_key = 'COD_SETTLEMENT_CYCLE'
  AND setting_key NOT IN (SELECT setting_key FROM cod_financial_004_setting_backup);
INSERT INTO system_settings (setting_key, setting_value)
SELECT setting_key, setting_value FROM cod_financial_004_setting_backup
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
DROP TABLE cod_financial_004_setting_backup;
ALTER TABLE cod_settlements
  DROP COLUMN transfer_file_reference,
  DROP COLUMN period_end,
  DROP COLUMN period_start,
  DROP COLUMN cycle_code,
  DROP COLUMN total_failure_fee;
ALTER TABLE orders
  DROP INDEX idx_orders_cod_settlement,
  DROP INDEX idx_orders_cod_remittance,
  DROP COLUMN failure_fee;
ALTER TABLE driver_cash_remittances
  DROP COLUMN created_by,
  DROP COLUMN variance_reason,
  DROP COLUMN variance_amount,
  DROP COLUMN expected_amount,
  DROP COLUMN work_date;
