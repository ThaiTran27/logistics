CREATE DATABASE IF NOT EXISTS smart_logistics_v2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE smart_logistics_v2;

SET FOREIGN_KEY_CHECKS = 0;
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
  receiver_name VARCHAR(255) NOT NULL,
  receiver_phone VARCHAR(50) NOT NULL,
  receiver_address TEXT NOT NULL,
  customer_email VARCHAR(255) DEFAULT NULL,
  cod_amount DECIMAL(12,2) DEFAULT 0,
  shipping_fee DECIMAL(12,2) DEFAULT 0,
  weight_kg DECIMAL(8,2) DEFAULT 1,
  width DECIMAL(8,2) DEFAULT 0,
  height DECIMAL(8,2) DEFAULT 0,
  item_value DECIMAL(12,2) DEFAULT 0,
  distance_km DECIMAL(10,2) DEFAULT 0,
  is_remote_area TINYINT(1) DEFAULT 0,
  service_type VARCHAR(50) DEFAULT 'standard',
  is_fragile TINYINT(1) DEFAULT 0,
  is_cod_paid TINYINT(1) DEFAULT 0,
  proof_image VARCHAR(255) DEFAULT NULL,
  fail_reason TEXT DEFAULT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_shop_id (shop_id),
  KEY idx_shipper_id (shipper_id),
  KEY idx_status (status)
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

CREATE TABLE department_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  created_by INT NOT NULL,
  department VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  status VARCHAR(30) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
('taixe1@smartlogistics.vn', 'driver123', 'Nguyễn Văn Bửu Tài', 'driver', 'active'),
('content@smartlogistics.vn', 'content123', 'Phòng ban nội dung', 'content_manager', 'active');

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

INSERT INTO leave_requests (user_id, reason, status) VALUES
(7, 'Xin nghỉ phép 1 ngày do gia đình có việc cần xử lý.', 'approved');

INSERT INTO department_reports (created_by, department, title, content, status) VALUES
(1, 'Phòng Điều Phối', 'Báo cáo hoạt động tuần', 'Tuần này có 18 đơn hàng mới, trong đó 3 đơn chậm do thời tiết.', 'pending');

SELECT 'Database smart_logistics_v2 đã được khởi tạo thành công!' AS status;
