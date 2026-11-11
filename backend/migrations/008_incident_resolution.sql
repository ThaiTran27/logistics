-- UP
ALTER TABLE driver_incidents
  MODIFY COLUMN driver_id INT NULL,
  ADD COLUMN reported_by INT DEFAULT NULL,
  ADD COLUMN reason_code VARCHAR(50) DEFAULT NULL,
  ADD COLUMN fault_party ENUM('customer','shop','driver','company','force_majeure') NOT NULL DEFAULT 'company',
  ADD COLUMN customer_compensation_amount DECIMAL(15,0) NOT NULL DEFAULT 0,
  ADD COLUMN shop_compensation_amount DECIMAL(15,0) NOT NULL DEFAULT 0,
  ADD COLUMN driver_deduction_amount DECIMAL(15,0) NOT NULL DEFAULT 0,
  ADD COLUMN salary_penalty_amount DECIMAL(15,0) NOT NULL DEFAULT 0,
  ADD COLUMN declared_value DECIMAL(15,0) NOT NULL DEFAULT 0,
  ADD KEY idx_driver_incidents_fault_party (fault_party, status, created_at);

UPDATE driver_incidents
SET driver_deduction_amount = claim_amount
WHERE claim_amount > 0;

UPDATE driver_incidents i
JOIN orders o ON o.id = i.order_id
SET i.declared_value = COALESCE(o.item_value, 0);

UPDATE driver_incidents
SET reason_code = CASE incident_type
  WHEN 'customer_absent' THEN 'DL_NOT_HOME'
  WHEN 'wrong_item' THEN 'DL_GOODS_WRONG'
  WHEN 'damaged_goods' THEN 'WH_DAMAGED'
  WHEN 'lost_goods' THEN 'WH_LOST'
  ELSE reason_code
END
WHERE incident_type IN ('customer_absent','wrong_item','damaged_goods','lost_goods');

ALTER TABLE driver_wallet_transactions
  ADD COLUMN incident_id BIGINT DEFAULT NULL,
  ADD UNIQUE KEY uq_driver_wallet_incident (incident_id);

ALTER TABLE employee_payroll_adjustments
  ADD COLUMN incident_id BIGINT DEFAULT NULL,
  ADD UNIQUE KEY uq_payroll_adjustment_incident (incident_id);

-- DOWN
ALTER TABLE employee_payroll_adjustments
  DROP INDEX uq_payroll_adjustment_incident,
  DROP COLUMN incident_id;

ALTER TABLE driver_wallet_transactions
  DROP INDEX uq_driver_wallet_incident,
  DROP COLUMN incident_id;

ALTER TABLE driver_incidents
  DROP INDEX idx_driver_incidents_fault_party,
  DROP COLUMN salary_penalty_amount,
  DROP COLUMN driver_deduction_amount,
  DROP COLUMN declared_value,
  DROP COLUMN reported_by,
  DROP COLUMN shop_compensation_amount,
  DROP COLUMN customer_compensation_amount,
  DROP COLUMN fault_party,
  DROP COLUMN reason_code;
