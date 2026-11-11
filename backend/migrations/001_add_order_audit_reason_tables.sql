-- UP
CREATE TABLE order_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  from_status VARCHAR(50) DEFAULT NULL,
  to_status VARCHAR(50) NOT NULL,
  actor_id INT DEFAULT NULL,
  actor_role VARCHAR(50) DEFAULT NULL,
  reason_code VARCHAR(50) DEFAULT NULL,
  note TEXT DEFAULT NULL,
  lat DECIMAL(10,7) DEFAULT NULL,
  lng DECIMAL(10,7) DEFAULT NULL,
  photo_url VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_order_events_order_created (order_id, created_at, id),
  KEY idx_order_events_actor_created (actor_id, created_at),
  KEY idx_order_events_reason_code (reason_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_id INT DEFAULT NULL,
  actor_role VARCHAR(50) DEFAULT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(100) DEFAULT NULL,
  old_value JSON DEFAULT NULL,
  new_value JSON DEFAULT NULL,
  ip VARCHAR(45) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_logs_actor_created (actor_id, created_at, id),
  KEY idx_audit_logs_entity (entity_type, entity_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE reason_codes (
  code VARCHAR(50) NOT NULL PRIMARY KEY,
  group_type ENUM('PICKUP','WAREHOUSE','DELIVERY') NOT NULL,
  fault_party ENUM('customer','shop','driver','company','force_majeure') NOT NULL,
  pay_driver_fail_fee TINYINT(1) NOT NULL DEFAULT 0,
  allow_retry TINYINT(1) NOT NULL DEFAULT 0,
  counts_attempt TINYINT(1) NOT NULL DEFAULT 1,
  require_evidence TINYINT(1) NOT NULL DEFAULT 0,
  create_incident TINYINT(1) NOT NULL DEFAULT 0,
  description VARCHAR(255) NOT NULL,
  KEY idx_reason_codes_group (group_type),
  KEY idx_reason_codes_fault_party (fault_party)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO reason_codes
  (code, group_type, fault_party, pay_driver_fail_fee, allow_retry, counts_attempt, require_evidence, create_incident, description)
VALUES
  ('PU_NO_CONTACT', 'PICKUP', 'customer', 1, 1, 1, 0, 0, 'Không liên hệ được người gửi tại điểm lấy'),
  ('PU_NOT_READY', 'PICKUP', 'shop', 1, 1, 1, 0, 0, 'Shop chưa chuẩn bị hàng để bàn giao'),
  ('PU_SHOP_CANCEL', 'PICKUP', 'shop', 0, 0, 1, 1, 0, 'Shop yêu cầu hủy lấy hàng'),
  ('PU_WRONG_ADDRESS', 'PICKUP', 'shop', 1, 1, 1, 1, 0, 'Địa chỉ lấy hàng không chính xác'),
  ('PU_QTY_MISMATCH', 'PICKUP', 'shop', 1, 1, 1, 1, 0, 'Số lượng hàng thực tế không khớp thông tin'),
  ('PU_PROHIBITED_GOODS', 'PICKUP', 'shop', 0, 0, 1, 1, 1, 'Hàng hóa thuộc danh mục cấm vận chuyển'),
  ('PU_BAD_PACKING', 'PICKUP', 'shop', 0, 1, 1, 1, 1, 'Đóng gói không đạt yêu cầu vận chuyển'),
  ('WH_SHORT', 'WAREHOUSE', 'company', 0, 0, 1, 1, 1, 'Kiểm kê thiếu hàng tại kho'),
  ('WH_OVER', 'WAREHOUSE', 'company', 0, 0, 0, 1, 1, 'Kiểm kê thừa hàng tại kho'),
  ('WH_DAMAGED', 'WAREHOUSE', 'company', 0, 0, 1, 1, 1, 'Phát hiện hàng hư hỏng tại kho'),
  ('WH_LOST', 'WAREHOUSE', 'company', 0, 0, 1, 1, 1, 'Phát hiện hàng thất lạc tại kho'),
  ('DL_NO_CONTACT', 'DELIVERY', 'customer', 1, 1, 1, 1, 0, 'Không liên hệ được người nhận'),
  ('DL_RESCHEDULE', 'DELIVERY', 'customer', 0, 1, 0, 0, 0, 'Người nhận đề nghị hẹn giao lại'),
  ('DL_REFUSED', 'DELIVERY', 'customer', 1, 0, 1, 1, 0, 'Người nhận từ chối nhận hàng'),
  ('DL_WRONG_ADDRESS', 'DELIVERY', 'customer', 1, 1, 1, 1, 0, 'Địa chỉ giao hàng không chính xác'),
  ('DL_WRONG_PHONE', 'DELIVERY', 'customer', 1, 1, 1, 1, 0, 'Số điện thoại người nhận không chính xác'),
  ('DL_NOT_HOME', 'DELIVERY', 'customer', 1, 1, 1, 1, 0, 'Không có người nhận tại địa chỉ giao'),
  ('DL_NO_CASH', 'DELIVERY', 'customer', 1, 1, 1, 1, 0, 'Người nhận chưa chuẩn bị khoản tiền cần thanh toán'),
  ('DL_GOODS_WRONG', 'DELIVERY', 'shop', 0, 0, 1, 1, 1, 'Hàng giao không đúng đơn đặt hàng'),
  ('DL_HARD_ACCESS', 'DELIVERY', 'force_majeure', 0, 1, 0, 1, 0, 'Không thể tiếp cận địa điểm giao an toàn'),
  ('DL_BOMB', 'DELIVERY', 'force_majeure', 0, 0, 1, 1, 1, 'Phát hiện nguy cơ vật liệu nổ hoặc đe dọa an toàn'),
  ('DL_FORCE_MAJEURE', 'DELIVERY', 'force_majeure', 0, 1, 0, 1, 1, 'Sự kiện bất khả kháng cản trở việc giao hàng'),
  ('DL_DRIVER_ACCIDENT', 'DELIVERY', 'driver', 0, 1, 1, 1, 1, 'Tài xế gặp tai nạn trong quá trình giao hàng');

-- DOWN
DROP TABLE reason_codes;
DROP TABLE audit_logs;
DROP TABLE order_events;
