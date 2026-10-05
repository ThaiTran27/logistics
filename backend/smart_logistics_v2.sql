CREATE DATABASE IF NOT EXISTS smart_logistics_v2
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE smart_logistics_v2;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS driver_positions;
DROP TABLE IF EXISTS driver_routes;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_sessions;
DROP TABLE IF EXISTS driver_wallet_transactions;
DROP TABLE IF EXISTS driver_wallet_reservations;
DROP TABLE IF EXISTS driver_wallets;
DROP TABLE IF EXISTS driver_cash_remittances;
DROP TABLE IF EXISTS driver_expense_claims;
DROP TABLE IF EXISTS cod_settlements;
DROP TABLE IF EXISTS shop_redelivery_requests;
DROP TABLE IF EXISTS shop_webhook_configs;
DROP TABLE IF EXISTS shop_api_keys;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS warehouse_bin_locations;
DROP TABLE IF EXISTS warehouse_inventory_audit_scans;
DROP TABLE IF EXISTS warehouse_inventory_audit_items;
DROP TABLE IF EXISTS warehouse_inventory_audits;
DROP TABLE IF EXISTS driver_dispatch_profiles;
DROP TABLE IF EXISTS warehouses;
DROP TABLE IF EXISTS order_status_history;
DROP TABLE IF EXISTS service_requests;
DROP TABLE IF EXISTS job_applications;
DROP TABLE IF EXISTS attendance_records;
DROP TABLE IF EXISTS employee_salaries;
DROP TABLE IF EXISTS department_leaders;
DROP TABLE IF EXISTS leave_requests;
DROP TABLE IF EXISTS department_reports;
DROP TABLE IF EXISTS news_articles;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'customer',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tracking_code VARCHAR(100) NOT NULL UNIQUE,
  shop_id INT NULL,
  shipper_id INT NULL,
  pickup_shipper_id INT NULL,
  central_transfer_shipper_id INT NULL,
  destination_transfer_shipper_id INT NULL,
  delivery_shipper_id INT NULL,
  origin_warehouse_id INT NULL,
  destination_warehouse_id INT NULL,
  current_warehouse_id INT NULL,
  storage_bin_id BIGINT NULL,
  cross_docked TINYINT(1) NOT NULL DEFAULT 0,
  shop_address TEXT DEFAULT NULL,
  shop_province VARCHAR(255) DEFAULT 'Hồ Chí Minh',
  shop_lat DOUBLE DEFAULT 10.762622,
  shop_lng DOUBLE DEFAULT 106.660172,
  receiver_name VARCHAR(255) NOT NULL,
  receiver_phone VARCHAR(50) NOT NULL,
  receiver_address TEXT NOT NULL,
  receiver_lat DOUBLE DEFAULT NULL,
  receiver_lng DOUBLE DEFAULT NULL,
  customer_email VARCHAR(255) DEFAULT NULL,
  cod_amount DECIMAL(12,2) DEFAULT 0,
  shipping_fee DECIMAL(12,2) DEFAULT 0,
  fee_payer ENUM('sender','receiver') NOT NULL DEFAULT 'sender',
  delivery_otp CHAR(6) DEFAULT NULL,
  weight_kg DECIMAL(8,2) DEFAULT 1,
  length DECIMAL(8,2) DEFAULT 0,
  width DECIMAL(8,2) DEFAULT 0,
  height DECIMAL(8,2) DEFAULT 0,
  item_value DECIMAL(12,2) DEFAULT 0,
  distance_km DECIMAL(10,2) DEFAULT 0,
  is_remote_area TINYINT(1) DEFAULT 0,
  service_type VARCHAR(50) DEFAULT 'standard',
  is_fragile TINYINT(1) DEFAULT 0,
  vehicle_type VARCHAR(50) DEFAULT 'motorbike',
  destination_province VARCHAR(255) DEFAULT 'Hồ Chí Minh',
  cod_collected TINYINT(1) NOT NULL DEFAULT 0,
  cod_collected_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  cod_payment_method ENUM('cash','bank_transfer') DEFAULT NULL,
  cod_settlement_id INT NULL,
  cod_remittance_id BIGINT NULL,
  service_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  insurance_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_cod_paid TINYINT(1) DEFAULT 0,
  proof_image VARCHAR(255) DEFAULT NULL,
  signature_image VARCHAR(255) DEFAULT NULL,
  fail_reason TEXT DEFAULT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_shop_id (shop_id),
  KEY idx_shipper_id (shipper_id),
  KEY idx_pickup_shipper_id (pickup_shipper_id),
  KEY idx_central_transfer_shipper_id (central_transfer_shipper_id),
  KEY idx_destination_transfer_shipper_id (destination_transfer_shipper_id),
  KEY idx_delivery_shipper_id (delivery_shipper_id),
  KEY idx_origin_warehouse_id (origin_warehouse_id),
  KEY idx_destination_warehouse_id (destination_warehouse_id),
  KEY idx_current_warehouse_id (current_warehouse_id),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_status_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  from_status VARCHAR(50) DEFAULT NULL,
  to_status VARCHAR(50) NOT NULL,
  note TEXT DEFAULT NULL,
  proof_image VARCHAR(255) DEFAULT NULL,
  signature_image VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_order_status_history_order (order_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE notifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  recipient_user_id INT NOT NULL,
  order_id INT DEFAULT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notifications_recipient (recipient_user_id, is_read, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chat_sessions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  mode ENUM('ai','live') NOT NULL,
  customer_user_id INT DEFAULT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50) DEFAULT NULL,
  guest_token_hash CHAR(64) NOT NULL,
  status ENUM('waiting','active','closed') NOT NULL DEFAULT 'waiting',
  assigned_agent_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_chat_sessions_queue (mode, status, updated_at),
  KEY idx_chat_sessions_agent (assigned_agent_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE chat_messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT NOT NULL,
  sender_type ENUM('customer','agent','bot') NOT NULL,
  sender_id INT DEFAULT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_chat_messages_session (session_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE warehouses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  warehouse_type ENUM('central','ward') NOT NULL,
  ward_name VARCHAR(120) NOT NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT DEFAULT NULL,
  lat DOUBLE DEFAULT NULL,
  lng DOUBLE DEFAULT NULL,
  is_configured TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_warehouse_ward (ward_name),
  KEY idx_warehouse_type_active (warehouse_type, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE warehouse_bin_locations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  warehouse_id INT NOT NULL,
  bin_code VARCHAR(80) NOT NULL,
  bin_name VARCHAR(120) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_warehouse_bin_code (warehouse_id, bin_code),
  KEY idx_warehouse_bin_active (warehouse_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE warehouse_inventory_audits (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  warehouse_id INT NOT NULL,
  created_by INT NOT NULL,
  status ENUM('open','completed') NOT NULL DEFAULT 'open',
  expected_count INT NOT NULL DEFAULT 0,
  scanned_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME DEFAULT NULL,
  KEY idx_inventory_audit_warehouse (warehouse_id, status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE warehouse_inventory_audit_items (
  audit_id BIGINT NOT NULL,
  order_id INT NOT NULL,
  tracking_code VARCHAR(100) NOT NULL,
  PRIMARY KEY (audit_id, order_id),
  UNIQUE KEY uq_inventory_audit_code (audit_id, tracking_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE warehouse_inventory_audit_scans (
  audit_id BIGINT NOT NULL,
  scan_code VARCHAR(100) NOT NULL,
  order_id INT DEFAULT NULL,
  scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (audit_id, scan_code),
  KEY idx_inventory_audit_scan_order (audit_id, order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE driver_dispatch_profiles (
  driver_id INT PRIMARY KEY,
  max_active_orders INT NOT NULL DEFAULT 10,
  max_payload_kg DECIMAL(10,2) NOT NULL DEFAULT 100,
  service_areas TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO warehouses (warehouse_type, ward_name, name, address, lat, lng, is_configured, is_active)
VALUES ('central', '__CENTRAL__', 'Kho tổng Smart Logistics', '10.762622, 106.660172, TP. Hồ Chí Minh', 10.762622, 106.660172, 1, 1);

CREATE TABLE cod_settlements (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  shop_id INT NOT NULL,
  total_cod DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_shipping_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_service_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_insurance_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
  order_count INT NOT NULL DEFAULT 0,
  settled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_cod_settlements_shop (shop_id, settled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE shop_api_keys (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  shop_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  key_prefix VARCHAR(24) NOT NULL,
  key_hash CHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME DEFAULT NULL,
  revoked_at DATETIME DEFAULT NULL,
  KEY idx_shop_api_keys_owner (shop_id, revoked_at, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE shop_webhook_configs (
  shop_id INT PRIMARY KEY,
  target_url VARCHAR(2048) DEFAULT NULL,
  secret_ciphertext TEXT DEFAULT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE shop_redelivery_requests (
  order_id INT PRIMARY KEY,
  shop_id INT NOT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  request_note TEXT NOT NULL,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME DEFAULT NULL,
  reviewed_by INT DEFAULT NULL,
  review_note TEXT DEFAULT NULL,
  KEY idx_redelivery_shop_status (shop_id, status, requested_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE shipment_bags (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  bag_code VARCHAR(40) NOT NULL UNIQUE,
  source_warehouse_id INT NOT NULL,
  destination_warehouse_id INT NOT NULL,
  status ENUM('open','sealed','in_transit','received') NOT NULL DEFAULT 'open',
  created_by INT DEFAULT NULL,
  sealed_at DATETIME DEFAULT NULL,
  received_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_shipment_bags_route (source_warehouse_id, destination_warehouse_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE shipment_bag_orders (
  bag_id BIGINT NOT NULL,
  order_id INT NOT NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (bag_id, order_id),
  KEY idx_shipment_bag_orders_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE linehaul_trips (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  trip_code VARCHAR(40) NOT NULL UNIQUE,
  vehicle_plate VARCHAR(30) NOT NULL,
  driver_id INT DEFAULT NULL,
  source_warehouse_id INT NOT NULL,
  destination_warehouse_id INT NOT NULL,
  status ENUM('planned','loading','in_transit','completed','cancelled') NOT NULL DEFAULT 'planned',
  departed_at DATETIME DEFAULT NULL,
  arrived_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_linehaul_trip_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE linehaul_trip_bags (
  trip_id BIGINT NOT NULL,
  bag_id BIGINT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  driver_scanned_at DATETIME DEFAULT NULL,
  PRIMARY KEY (trip_id, bag_id),
  UNIQUE KEY uq_linehaul_bag_trip (bag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE driver_cash_remittances (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  driver_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status ENUM('pending','received') NOT NULL DEFAULT 'pending',
  received_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  received_at DATETIME DEFAULT NULL,
  KEY idx_driver_cash_remittance (driver_id, status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE driver_expense_claims (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  driver_id INT NOT NULL,
  expense_type ENUM('toll','parking','fuel','other') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  note VARCHAR(500) NOT NULL,
  receipt_image VARCHAR(255) NOT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewed_by INT DEFAULT NULL,
  review_note VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME DEFAULT NULL,
  KEY idx_driver_expense_status (status, created_at),
  KEY idx_driver_expense_owner (driver_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE driver_wallets (
  driver_id INT PRIMARY KEY,
  balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  reserved_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE driver_wallet_reservations (
  order_id INT PRIMARY KEY,
  driver_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status ENUM('reserved','released') NOT NULL DEFAULT 'reserved',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  released_at DATETIME DEFAULT NULL,
  KEY idx_driver_wallet_reservation (driver_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE driver_wallet_transactions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  driver_id INT NOT NULL,
  order_id INT DEFAULT NULL,
  transaction_type ENUM('deposit','reserve','release') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  note VARCHAR(255) DEFAULT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_driver_wallet_transactions (driver_id, created_at),
  KEY idx_driver_wallet_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE driver_incidents (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  driver_id INT NOT NULL,
  incident_type ENUM('accident','vehicle_breakdown','traffic','other') NOT NULL,
  description TEXT NOT NULL,
  lat DOUBLE DEFAULT NULL,
  lng DOUBLE DEFAULT NULL,
  status ENUM('open','acknowledged','resolved') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_driver_incidents_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE employee_payroll_adjustments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  payroll_month CHAR(7) NOT NULL,
  adjustment_type ENUM('bonus','deduction') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_payroll_adjustment_user_month (user_id, payroll_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE service_requests (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  plan_name VARCHAR(100) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  message TEXT DEFAULT NULL,
  status ENUM('new','contacted','closed') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_service_requests_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE job_applications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  job_title VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  experience TEXT DEFAULT NULL,
  message TEXT DEFAULT NULL,
  status ENUM('new','reviewing','accepted','rejected') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_job_applications_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE news_articles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  summary TEXT,
  content LONGTEXT,
  image_url VARCHAR(255) DEFAULT NULL,
  category VARCHAR(100) DEFAULT 'Tin tức',
  status ENUM('draft','published') DEFAULT 'published',
  created_by VARCHAR(255) DEFAULT 'content_team',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE driver_routes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL UNIQUE,
  shipper_id INT NULL,
  warehouse_lat DOUBLE DEFAULT 10.762622,
  warehouse_lng DOUBLE DEFAULT 106.660172,
  pickup_lat DOUBLE DEFAULT 10.7605,
  pickup_lng DOUBLE DEFAULT 106.6545,
  delivery_lat DOUBLE DEFAULT 10.7745,
  delivery_lng DOUBLE DEFAULT 106.6665,
  route_status VARCHAR(50) DEFAULT 'assigned',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_shipper_id (shipper_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE driver_positions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NULL,
  shipper_id INT NOT NULL,
  lat DOUBLE NOT NULL,
  lng DOUBLE NOT NULL,
  route_status VARCHAR(50) DEFAULT 'moving',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_shipper_id (shipper_id),
  KEY idx_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE department_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  created_by INT NOT NULL,
  department VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  attachment_url VARCHAR(255) DEFAULT NULL,
  status VARCHAR(30) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE attendance_records (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  work_date DATE NOT NULL,
  check_in DATETIME DEFAULT NULL,
  check_in_photo VARCHAR(255) DEFAULT NULL,
  check_in_lat DOUBLE DEFAULT NULL,
  check_in_lng DOUBLE DEFAULT NULL,
  check_out DATETIME DEFAULT NULL,
  check_out_photo VARCHAR(255) DEFAULT NULL,
  check_out_lat DOUBLE DEFAULT NULL,
  check_out_lng DOUBLE DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_attendance_user_date (user_id, work_date),
  KEY idx_attendance_work_date (work_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE employee_salaries (
  user_id INT PRIMARY KEY,
  monthly_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
  allowance DECIMAL(12,2) NOT NULL DEFAULT 0,
  bonus_per_delivery DECIMAL(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE department_leaders (
  department VARCHAR(255) PRIMARY KEY,
  user_id INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_department_leader_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE leave_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(30) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO users (email, password, full_name, role, status) VALUES
  ('admin@smartlogistics.vn', 'admin123', 'Trần Minh Thảo', 'director', 'active'),
  ('hr@smartlogistics.vn', 'hr123', 'Trương Phòng Nhân Sự', 'hr_manager', 'active'),
  ('dieu_hanh@smartlogistics.vn', 'dieu_hanh123', 'Diệu Hành', 'fleet_manager', 'active'),
  ('ketoan@smartlogistics.vn', 'ketoan123', 'Nguyễn Thị Kế Toán', 'accountant', 'active'),
  ('kho@smartlogistics.vn', 'kho123', 'Trần Vũ Thủ Kho', 'warehouse_manager', 'active'),
  ('shop@smartlogistics.vn', 'shop123', 'Cửa Hàng Trần Minh', 'shop', 'active'),
  ('taixe1@smartlogistics.vn', 'driver123', 'Nguyễn Văn Bửu Tài', 'pickup_driver', 'active'),
  ('content@smartlogistics.vn', 'content123', 'Phòng ban nội dung', 'content_manager', 'active');

INSERT INTO users (email, password, full_name, role, status) VALUES
  ('taixe2@smartlogistics.vn', 'driver123', 'Bùi Quang Huy', 'pickup_driver', 'active'),
  ('taixe3@smartlogistics.vn', 'driver123', 'Lê Hoàng Nam', 'delivery_driver', 'active'),
  ('taixe4@smartlogistics.vn', 'driver123', 'Phạm Quốc Đạt', 'delivery_driver', 'active'),
  ('kho2@smartlogistics.vn', 'staff123', 'Võ Khánh Linh', 'warehouse_manager', 'active'),
  ('dieu_hanh2@smartlogistics.vn', 'staff123', 'Lê Gia Bảo', 'fleet_manager', 'active'),
  ('ketoan2@smartlogistics.vn', 'staff123', 'Phạm Hải Yến', 'accountant', 'active'),
  ('hr2@smartlogistics.vn', 'staff123', 'Nguyễn Ngọc Mai', 'hr_manager', 'active'),
  ('content2@smartlogistics.vn', 'staff123', 'Đặng Thu Hà', 'content_manager', 'active'),
  ('shop2@smartlogistics.vn', 'shop123', 'Công ty Minh Long', 'shop', 'active')
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name), role = VALUES(role), status = VALUES(status);

INSERT INTO orders (
  tracking_code, shop_id, shipper_id, receiver_name, receiver_phone, receiver_address,
  customer_email, cod_amount, shipping_fee, weight_kg, width, height, item_value,
  distance_km, is_remote_area, service_type, is_fragile, is_cod_paid, proof_image,
  fail_reason, status
) VALUES (
  'TVP828141VN', 6, NULL, 'Lê Tấn', '0999999999', 'Đà Nẵng', NULL,
  1000000.00, 420000.00, 1.00, 0.00, 0.00, 0.00,
  0.00, 0, 'standard', 0, 0, NULL, NULL, 'pending'
);

INSERT INTO orders (
  tracking_code, shop_id, pickup_shipper_id, delivery_shipper_id, receiver_name, receiver_phone, receiver_address,
  customer_email, cod_amount, shipping_fee, weight_kg, service_type, status
)
SELECT seed_orders.tracking_code, shop.id,
  CASE WHEN seed_orders.status = 'picking' THEN driver.id ELSE NULL END,
  CASE WHEN seed_orders.status IN ('delivering', 'completed', 'returning') THEN driver.id ELSE NULL END,
  seed_orders.receiver_name,
  seed_orders.receiver_phone, seed_orders.receiver_address, seed_orders.customer_email,
  seed_orders.cod_amount, seed_orders.shipping_fee, seed_orders.weight_kg,
  seed_orders.service_type, seed_orders.status
FROM (
  SELECT 'SLTEST260901VN' AS tracking_code, 'shop2@smartlogistics.vn' AS shop_email, 'taixe2@smartlogistics.vn' AS driver_email,
    'Nguyễn Thị Mai' AS receiver_name, '0901000001' AS receiver_phone, 'Quận 1, TP. Hồ Chí Minh' AS receiver_address,
    'khach01@example.com' AS customer_email, 850000 AS cod_amount, 28000 AS shipping_fee, 1.2 AS weight_kg, 'standard' AS service_type, 'picking' AS status
  UNION ALL SELECT 'SLTEST260902VN', 'shop2@smartlogistics.vn', 'taixe3@smartlogistics.vn', 'Trần Quốc Bảo', '0901000002', 'Quận 3, TP. Hồ Chí Minh', 'khach02@example.com', 1250000, 32000, 2.0, 'express', 'delivering'
  UNION ALL SELECT 'SLTEST260903VN', 'shop@smartlogistics.vn', 'taixe3@smartlogistics.vn', 'Lê Minh Châu', '0901000003', 'Thủ Đức, TP. Hồ Chí Minh', 'khach03@example.com', 450000, 25000, 0.8, 'standard', 'completed'
  UNION ALL SELECT 'SLTEST260904VN', 'shop@smartlogistics.vn', 'taixe3@smartlogistics.vn', 'Phạm Gia Hân', '0901000004', 'Dĩ An, Bình Dương', 'khach04@example.com', 720000, 35000, 1.5, 'economy', 'returning'
  UNION ALL SELECT 'SLTEST260905VN', 'shop2@smartlogistics.vn', 'taixe4@smartlogistics.vn', 'Võ Thành Đạt', '0901000005', 'Gò Vấp, TP. Hồ Chí Minh', 'khach05@example.com', 2000000, 30000, 3.0, 'express', 'delivering'
  UNION ALL SELECT 'SLTEST260906VN', 'shop@smartlogistics.vn', '', 'Ngô Thanh Tùng', '0901000006', 'Biên Hòa, Đồng Nai', 'khach06@example.com', 310000, 42000, 0.5, 'economy', 'in_warehouse'
  UNION ALL SELECT 'SLTEST260907VN', 'shop2@smartlogistics.vn', '', 'Đặng Thu Trang', '0901000007', 'Quận 7, TP. Hồ Chí Minh', 'khach07@example.com', 980000, 29000, 1.0, 'standard', 'pending'
  UNION ALL SELECT 'SLTEST260908VN', 'shop2@smartlogistics.vn', 'taixe4@smartlogistics.vn', 'Hoàng Minh Đức', '0901000008', 'Tân Bình, TP. Hồ Chí Minh', 'khach08@example.com', 560000, 26000, 1.1, 'standard', 'completed'
) AS seed_orders
JOIN users shop ON shop.email = seed_orders.shop_email
LEFT JOIN users driver ON driver.email = seed_orders.driver_email
WHERE NOT EXISTS (SELECT 1 FROM orders existing WHERE existing.tracking_code = seed_orders.tracking_code);

INSERT INTO driver_routes (order_id, shipper_id, route_status)
SELECT o.id, COALESCE(o.delivery_shipper_id, o.pickup_shipper_id), 'assigned'
FROM orders o
WHERE o.tracking_code IN ('SLTEST260901VN', 'SLTEST260902VN', 'SLTEST260905VN')
  AND COALESCE(o.delivery_shipper_id, o.pickup_shipper_id) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM driver_routes route WHERE route.order_id = o.id);

INSERT INTO news_articles (title, slug, summary, content, image_url, category, status, created_by) VALUES
  (
    'Smart Logistics nâng cấp hệ thống tracking mới',
    'smart-logistics-nang-cap-he-thong-tracking-moi',
    'Hệ thống theo dõi đơn hàng được cập nhật để giảm sai sót trong quá trình giao nhận.',
    '<p>Smart Logistics vừa triển khai hệ thống tracking mới nhằm giúp khách hàng theo dõi đơn hàng trong thời gian thực.</p><p>Với công nghệ cập nhật, các đơn hàng được phản hồi nhanh hơn, giảm tỷ lệ chậm trễ và tối ưu hóa quy trình vận chuyển.</p>',
    'https://images.unsplash.com/photo-1586528116311-ad8ed7c663be?auto=format&fit=crop&w=800&q=80',
    'Tin tức',
    'published',
    'content_team'
  ),
  (
    'Cách tối ưu chi phí vận chuyển cho shop online',
    'cach-toi-uu-chi-phi-van-chuyen-cho-shop-online',
    'Bốn cách giúp doanh nghiệp giảm chi phí logistics mà vẫn giữ chất lượng giao hàng tốt.',
    '<p>Để tối ưu chi phí vận chuyển, doanh nghiệp cần theo dõi trọng lượng, địa điểm giao hàng và thời điểm vận chuyển hiệu quả.</p><p>Smart Logistics khuyến nghị khách hàng lựa chọn gói cước phù hợp để tránh phát sinh chi phí bất ngờ.</p>',
    'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=800&q=80',
    'Hướng dẫn',
    'published',
    'content_team'
  ),
  (
    'Đội ngũ tài xế và kho vận đồng bộ trên dashboard mới',
    'doi-ngu-tai-xe-va-kho-van-dong-bo-tren-dashboard-moi',
    'Dashboard mới cho phép đội ngũ vận hành làm việc đồng bộ và cập nhật tiến độ kịp thời.',
    '<p>Bộ phận vận hành và kho vận đang làm việc chung trên dashboard mới, giúp theo dõi trạng thái đơn hàng liên tục.</p><p>Điều này giúp rút ngắn thời gian xử lý, nâng cao độ chính xác và hiệu quả điều phối.</p>',
    'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=800&q=80',
    'Công nghệ',
    'published',
    'content_team'
  );

INSERT INTO news_articles (title, slug, summary, content, image_url, category, status, created_by)
SELECT 'Hướng dẫn chuẩn bị hàng trước khi gửi', 'huong-dan-chuan-bi-hang-truoc-khi-gui',
  'Các bước đóng gói giúp hàng hóa an toàn và rút ngắn thời gian xử lý tại kho.',
  '<p>Chọn thùng vừa kích thước, chèn vật liệu chống sốc và dán kín các cạnh.</p><p>Ghi rõ mã đơn bên ngoài kiện hàng và tách riêng hàng dễ vỡ để được xử lý phù hợp.</p>',
  'https://images.unsplash.com/photo-1607082349566-187342175e2f?auto=format&fit=crop&w=1200&q=80',
  'Hướng dẫn', 'published', 'content_team'
WHERE NOT EXISTS (SELECT 1 FROM news_articles WHERE slug = 'huong-dan-chuan-bi-hang-truoc-khi-gui');

INSERT INTO news_articles (title, slug, summary, content, image_url, category, status, created_by)
SELECT 'Mở rộng mạng lưới giao nhận khu vực phía Nam', 'mo-rong-mang-luoi-giao-nhan-phia-nam',
  'Smart Logistics bổ sung điểm trung chuyển để tăng tốc độ giao hàng liên tỉnh.',
  '<p>Điểm trung chuyển mới giúp các tuyến nội vùng được phân loại sớm hơn.</p><p>Đội điều phối sẽ theo dõi sản lượng theo ngày để điều chỉnh lịch xe linh hoạt.</p>',
  'https://images.unsplash.com/photo-1586528116311-ad8ed7c663be?auto=format&fit=crop&w=1200&q=80',
  'Tin tức', 'published', 'content_team'
WHERE NOT EXISTS (SELECT 1 FROM news_articles WHERE slug = 'mo-rong-mang-luoi-giao-nhan-phia-nam');

INSERT INTO news_articles (title, slug, summary, content, image_url, category, status, created_by)
SELECT 'Quy trình đối soát COD minh bạch', 'quy-trinh-doi-soat-cod-minh-bach',
  'Shop có thể kiểm tra số đơn, số tiền thu hộ và lịch sử thanh toán theo từng đợt.',
  '<p>Mỗi đợt đối soát tổng hợp đơn giao thành công và số tiền tài xế đã thu.</p><p>Vui lòng đối chiếu mã vận đơn trước khi xác nhận thanh toán.</p>',
  'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=80',
  'Hướng dẫn', 'published', 'content_team'
WHERE NOT EXISTS (SELECT 1 FROM news_articles WHERE slug = 'quy-trinh-doi-soat-cod-minh-bach');

INSERT INTO news_articles (title, slug, summary, content, image_url, category, status, created_by)
SELECT 'Tuyển tài xế giao nhận trong tháng 10', 'tuyen-tai-xe-giao-nhan-thang-10',
  'Smart Logistics mở rộng đội giao nhận và tiếp nhận hồ sơ tài xế toàn thời gian.',
  '<p>Ứng viên cần có giấy phép lái xe phù hợp, điện thoại thông minh và thông tin cư trú rõ ràng.</p><p>Hồ sơ có thể gửi qua trang Tuyển dụng để bộ phận nhân sự liên hệ.</p>',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
  'Tuyển dụng', 'published', 'content_team'
WHERE NOT EXISTS (SELECT 1 FROM news_articles WHERE slug = 'tuyen-tai-xe-giao-nhan-thang-10');

INSERT INTO news_articles (title, slug, summary, content, image_url, category, status, created_by)
SELECT 'Quét mã vạch giúp kiểm soát tồn kho', 'quet-ma-vach-kiem-soat-ton-kho',
  'Quy trình quét mã đồng bộ trạng thái kiện hàng giữa kho và đội điều phối.',
  '<p>Mỗi lần nhận, xuất hoặc phân loại kiện hàng cần quét mã vận đơn để cập nhật trạng thái.</p><p>Thao tác này giúp giảm nhập liệu thủ công và dễ tra soát khi phát sinh chênh lệch.</p>',
  'https://images.unsplash.com/photo-1580674285054-bed31e145f59?auto=format&fit=crop&w=1200&q=80',
  'Công nghệ', 'published', 'content_team'
WHERE NOT EXISTS (SELECT 1 FROM news_articles WHERE slug = 'quet-ma-vach-kiem-soat-ton-kho');

INSERT INTO job_applications (job_title, full_name, email, phone, experience, message, status)
SELECT 'Tài xế giao nhận', 'Đỗ Minh Phúc', 'ungvien.phuc@example.com', '0902000001',
  '3 năm giao hàng nội thành, thông thạo các tuyến TP. Hồ Chí Minh.', 'Có thể nhận việc theo ca sáng.', 'new'
WHERE NOT EXISTS (SELECT 1 FROM job_applications WHERE email = 'ungvien.phuc@example.com');

INSERT INTO job_applications (job_title, full_name, email, phone, experience, message, status)
SELECT 'Nhân viên điều phối', 'Nguyễn Hà My', 'ungvien.my@example.com', '0902000002',
  '2 năm theo dõi đơn hàng và điều phối đội giao nhận.', 'Mong muốn làm việc tại văn phòng TP. Hồ Chí Minh.', 'reviewing'
WHERE NOT EXISTS (SELECT 1 FROM job_applications WHERE email = 'ungvien.my@example.com');

INSERT INTO job_applications (job_title, full_name, email, phone, experience, message, status)
SELECT 'Nhân viên kho', 'Trần Đức Long', 'ungvien.long@example.com', '0902000003',
  'Từng kiểm kê và phân loại hàng hóa tại kho thương mại điện tử.', 'Có thể làm việc theo ca.', 'accepted'
WHERE NOT EXISTS (SELECT 1 FROM job_applications WHERE email = 'ungvien.long@example.com');

INSERT INTO service_requests (plan_name, full_name, email, phone, message, status)
SELECT 'Doanh nghiệp', 'Lê Thanh Bình', 'shop.binh@example.com', '0903000001',
  'Cần tư vấn bảng giá giao hàng liên tỉnh cho khoảng 500 đơn mỗi tháng.', 'new'
WHERE NOT EXISTS (SELECT 1 FROM service_requests WHERE email = 'shop.binh@example.com');

INSERT INTO service_requests (plan_name, full_name, email, phone, message, status)
SELECT 'Cửa hàng trực tuyến', 'Phạm Ngọc Anh', 'shop.anh@example.com', '0903000002',
  'Muốn kết nối quy trình lấy hàng hằng ngày và đối soát COD.', 'contacted'
WHERE NOT EXISTS (SELECT 1 FROM service_requests WHERE email = 'shop.anh@example.com');

INSERT INTO service_requests (plan_name, full_name, email, phone, message, status)
SELECT 'Tiết kiệm', 'Võ Hoàng Sơn', 'shop.son@example.com', '0903000003',
  'Đang so sánh chi phí giao hàng cho cửa hàng mới mở.', 'closed'
WHERE NOT EXISTS (SELECT 1 FROM service_requests WHERE email = 'shop.son@example.com');

INSERT INTO leave_requests (user_id, reason, status)
SELECT u.id, 'Xin nghỉ phép một ngày để giải quyết việc gia đình.', 'pending'
FROM users u
WHERE u.email = 'taixe2@smartlogistics.vn'
  AND NOT EXISTS (SELECT 1 FROM leave_requests l WHERE l.user_id = u.id AND l.reason = 'Xin nghỉ phép một ngày để giải quyết việc gia đình.');

INSERT INTO leave_requests (user_id, reason, status)
SELECT u.id, 'Xin đổi ca và nghỉ phép ngày thứ Bảy tuần này.', 'pending'
FROM users u
WHERE u.email = 'kho2@smartlogistics.vn'
  AND NOT EXISTS (SELECT 1 FROM leave_requests l WHERE l.user_id = u.id AND l.reason = 'Xin đổi ca và nghỉ phép ngày thứ Bảy tuần này.');

INSERT INTO leave_requests (user_id, reason, status)
SELECT u.id, 'Đề nghị nghỉ phép đã được quản lý xác nhận.', 'approved'
FROM users u
WHERE u.email = 'taixe3@smartlogistics.vn'
  AND NOT EXISTS (SELECT 1 FROM leave_requests l WHERE l.user_id = u.id AND l.reason = 'Đề nghị nghỉ phép đã được quản lý xác nhận.');

INSERT INTO leave_requests (user_id, reason, status) VALUES
  (7, 'Xin nghỉ phép 1 ngày do gia đình có việc cần xử lý.', 'approved');

INSERT INTO department_reports (created_by, department, title, content, status) VALUES
  (1, 'Phòng Điều Phối', 'Báo cáo hoạt động tuần', 'Tuần này có 18 đơn hàng mới, trong đó 3 đơn chậm do thời tiết.', 'pending');

INSERT INTO attendance_records (user_id, work_date, check_in, check_out)
SELECT u.id,
  DATE_SUB(CURDATE(), INTERVAL 1 DAY),
  TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '08:00:00'),
  TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), CASE WHEN u.id IN (1, 7) THEN '12:00:00' ELSE '17:00:00' END)
FROM users u
WHERE u.role != 'customer'
  AND NOT EXISTS (
    SELECT 1 FROM attendance_records a
    WHERE a.user_id = u.id
      AND a.work_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
      AND a.check_in = TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '08:00:00')
  );

INSERT INTO attendance_records (user_id, work_date, check_in, check_out)
SELECT u.id,
  DATE_SUB(CURDATE(), INTERVAL 1 DAY),
  TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '13:00:00'),
  TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '17:00:00')
FROM users u
WHERE u.id IN (1, 7)
  AND NOT EXISTS (
    SELECT 1 FROM attendance_records a
    WHERE a.user_id = u.id
      AND a.work_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
      AND a.check_in = TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '13:00:00')
  );

INSERT INTO attendance_records (user_id, work_date, check_in, check_out)
SELECT u.id,
  DATE_SUB(CURDATE(), INTERVAL 2 DAY),
  TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '08:00:00'),
  TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '17:00:00')
FROM users u
WHERE u.role != 'customer'
  AND NOT EXISTS (
    SELECT 1 FROM attendance_records a
    WHERE a.user_id = u.id
      AND a.work_date = DATE_SUB(CURDATE(), INTERVAL 2 DAY)
      AND a.check_in = TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 2 DAY), '08:00:00')
  );

INSERT INTO employee_salaries (user_id, monthly_salary, allowance)
SELECT id,
  CASE role
    WHEN 'director' THEN 45000000
    WHEN 'hr_manager' THEN 18000000
    WHEN 'fleet_manager' THEN 20000000
    WHEN 'accountant' THEN 16000000
    WHEN 'warehouse_manager' THEN 15000000
    WHEN 'shop' THEN 12000000
    WHEN 'pickup_driver' THEN 12000000
    WHEN 'delivery_driver' THEN 12000000
    WHEN 'content_manager' THEN 15000000
    ELSE 10000000
  END,
  CASE role
    WHEN 'director' THEN 10000000
    WHEN 'hr_manager' THEN 3000000
    WHEN 'fleet_manager' THEN 4000000
    WHEN 'accountant' THEN 2500000
    WHEN 'warehouse_manager' THEN 2000000
    WHEN 'shop' THEN 1500000
    WHEN 'pickup_driver' THEN 4000000
    WHEN 'delivery_driver' THEN 4000000
    WHEN 'content_manager' THEN 2000000
    ELSE 0
  END
FROM users
WHERE role != 'customer'
ON DUPLICATE KEY UPDATE
  monthly_salary = IF(employee_salaries.monthly_salary = 0, VALUES(monthly_salary), employee_salaries.monthly_salary),
  allowance = IF(employee_salaries.allowance = 0, VALUES(allowance), employee_salaries.allowance);

INSERT INTO department_leaders (department, user_id) VALUES
  ('Phòng Tài Chính', 4),
  ('Phòng Điều Phối', 3),
  ('Phòng Kho', 5),
  ('Phòng Nhân Sự', 2),
  ('Phòng Nội Dung', 8)
ON DUPLICATE KEY UPDATE user_id = VALUES(user_id);

INSERT INTO department_reports (created_by, department, title, content, status)
SELECT 3, 'Phòng Điều Phối', 'Báo cáo điều phối tuần mẫu', 'Đã xử lý 42 đơn hàng; 38 đơn giao thành công, 4 đơn đang chờ xác nhận. Hai tài xế hoàn thành tuyến đúng kế hoạch.', 'pending'
WHERE NOT EXISTS (SELECT 1 FROM department_reports WHERE title = 'Báo cáo điều phối tuần mẫu');

INSERT INTO department_reports (created_by, department, title, content, status)
SELECT 2, 'Phòng Nhân Sự', 'Tổng hợp chấm công tháng mẫu', 'Tỷ lệ đi làm đúng giờ đạt 96%. Đã ghi nhận hai ca trong ngày cho giám đốc và tài xế để kiểm tra quy trình chấm công nhiều ca.', 'approved'
WHERE NOT EXISTS (SELECT 1 FROM department_reports WHERE title = 'Tổng hợp chấm công tháng mẫu');

INSERT INTO department_reports (created_by, department, title, content, status)
SELECT 5, 'Phòng Kho', 'Đề xuất kiểm kê kho mẫu', 'Đề xuất kiểm kê bổ sung nhóm hàng tồn quá 30 ngày và đối chiếu số liệu trước khi chốt báo cáo tuần.', 'rejected'
WHERE NOT EXISTS (SELECT 1 FROM department_reports WHERE title = 'Đề xuất kiểm kê kho mẫu');

SELECT 'Database smart_logistics_v2 đã được khởi tạo thành công!' AS status;
