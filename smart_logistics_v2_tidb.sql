-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 19, 2026 at 08:31 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `smart_logistics_v2`
--

-- --------------------------------------------------------

--
-- Table structure for table `attendance_records`
--

CREATE TABLE `attendance_records` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `work_date` date NOT NULL,
  `check_in` datetime DEFAULT NULL,
  `check_in_photo` varchar(255) DEFAULT NULL,
  `check_in_lat` double DEFAULT NULL,
  `check_in_lng` double DEFAULT NULL,
  `check_out` datetime DEFAULT NULL,
  `check_out_photo` varchar(255) DEFAULT NULL,
  `check_out_lat` double DEFAULT NULL,
  `check_out_lng` double DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_INCREMENT=67;

--
-- Dumping data for table `attendance_records`
--

INSERT INTO `attendance_records` (`id`, `user_id`, `work_date`, `check_in`, `check_in_photo`, `check_in_lat`, `check_in_lng`, `check_out`, `check_out_photo`, `check_out_lat`, `check_out_lng`, `created_at`) VALUES
(1, 1, '2026-10-09', '2026-10-09 08:00:00', NULL, NULL, NULL, '2026-10-09 12:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(2, 2, '2026-10-09', '2026-10-09 08:00:00', NULL, NULL, NULL, '2026-10-09 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(3, 3, '2026-10-09', '2026-10-09 08:00:00', NULL, NULL, NULL, '2026-10-09 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(4, 4, '2026-10-09', '2026-10-09 08:00:00', NULL, NULL, NULL, '2026-10-09 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(5, 5, '2026-10-09', '2026-10-09 08:00:00', NULL, NULL, NULL, '2026-10-09 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(6, 6, '2026-10-09', '2026-10-09 08:00:00', NULL, NULL, NULL, '2026-10-09 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(7, 7, '2026-10-09', '2026-10-09 08:00:00', NULL, NULL, NULL, '2026-10-09 12:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(8, 8, '2026-10-09', '2026-10-09 08:00:00', NULL, NULL, NULL, '2026-10-09 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(9, 9, '2026-10-09', '2026-10-09 08:00:00', NULL, NULL, NULL, '2026-10-09 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(10, 10, '2026-10-09', '2026-10-09 08:00:00', NULL, NULL, NULL, '2026-10-09 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(11, 11, '2026-10-09', '2026-10-09 08:00:00', NULL, NULL, NULL, '2026-10-09 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(12, 12, '2026-10-09', '2026-10-09 08:00:00', NULL, NULL, NULL, '2026-10-09 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(13, 13, '2026-10-09', '2026-10-09 08:00:00', NULL, NULL, NULL, '2026-10-09 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(14, 14, '2026-10-09', '2026-10-09 08:00:00', NULL, NULL, NULL, '2026-10-09 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(15, 15, '2026-10-09', '2026-10-09 08:00:00', NULL, NULL, NULL, '2026-10-09 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(16, 16, '2026-10-09', '2026-10-09 08:00:00', NULL, NULL, NULL, '2026-10-09 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(17, 17, '2026-10-09', '2026-10-09 08:00:00', NULL, NULL, NULL, '2026-10-09 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(18, 18, '2026-10-09', '2026-10-09 08:00:00', NULL, NULL, NULL, '2026-10-09 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(19, 19, '2026-10-09', '2026-10-09 08:00:00', NULL, NULL, NULL, '2026-10-09 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(32, 1, '2026-10-09', '2026-10-09 13:00:00', NULL, NULL, NULL, '2026-10-09 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(33, 7, '2026-10-09', '2026-10-09 13:00:00', NULL, NULL, NULL, '2026-10-09 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(35, 1, '2026-10-08', '2026-10-08 08:00:00', NULL, NULL, NULL, '2026-10-08 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(36, 2, '2026-10-08', '2026-10-08 08:00:00', NULL, NULL, NULL, '2026-10-08 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(37, 3, '2026-10-08', '2026-10-08 08:00:00', NULL, NULL, NULL, '2026-10-08 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(38, 4, '2026-10-08', '2026-10-08 08:00:00', NULL, NULL, NULL, '2026-10-08 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(39, 5, '2026-10-08', '2026-10-08 08:00:00', NULL, NULL, NULL, '2026-10-08 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(40, 6, '2026-10-08', '2026-10-08 08:00:00', NULL, NULL, NULL, '2026-10-08 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(41, 7, '2026-10-08', '2026-10-08 08:00:00', NULL, NULL, NULL, '2026-10-08 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(42, 8, '2026-10-08', '2026-10-08 08:00:00', NULL, NULL, NULL, '2026-10-08 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(43, 9, '2026-10-08', '2026-10-08 08:00:00', NULL, NULL, NULL, '2026-10-08 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(44, 10, '2026-10-08', '2026-10-08 08:00:00', NULL, NULL, NULL, '2026-10-08 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(45, 11, '2026-10-08', '2026-10-08 08:00:00', NULL, NULL, NULL, '2026-10-08 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(46, 12, '2026-10-08', '2026-10-08 08:00:00', NULL, NULL, NULL, '2026-10-08 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(47, 13, '2026-10-08', '2026-10-08 08:00:00', NULL, NULL, NULL, '2026-10-08 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(48, 14, '2026-10-08', '2026-10-08 08:00:00', NULL, NULL, NULL, '2026-10-08 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(49, 15, '2026-10-08', '2026-10-08 08:00:00', NULL, NULL, NULL, '2026-10-08 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(50, 16, '2026-10-08', '2026-10-08 08:00:00', NULL, NULL, NULL, '2026-10-08 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(51, 17, '2026-10-08', '2026-10-08 08:00:00', NULL, NULL, NULL, '2026-10-08 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(52, 18, '2026-10-08', '2026-10-08 08:00:00', NULL, NULL, NULL, '2026-10-08 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(53, 19, '2026-10-08', '2026-10-08 08:00:00', NULL, NULL, NULL, '2026-10-08 17:00:00', NULL, NULL, NULL, '2026-10-10 03:11:12'),
(66, 9, '2026-10-10', '2026-10-10 11:15:14', '/uploads/attendance-1791605714207-f05d7662af07.jpg', 10.822621000000002, 106.68739, NULL, NULL, NULL, NULL, '2026-10-10 04:15:14');

-- --------------------------------------------------------

--
-- Table structure for table `chat_messages`
--

CREATE TABLE `chat_messages` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `session_id` bigint(20) NOT NULL,
  `sender_type` enum('customer','agent','bot') NOT NULL,
  `sender_id` int(11) DEFAULT NULL,
  `message` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_INCREMENT=5;

--
-- Dumping data for table `chat_messages`
--

INSERT INTO `chat_messages` (`id`, `session_id`, `sender_type`, `sender_id`, `message`, `created_at`) VALUES
(1, 1, 'customer', NULL, 'ewdf', '2026-10-10 04:17:35'),
(2, 1, 'bot', NULL, 'Mình chưa hiểu rõ câu hỏi. Bạn có thể hỏi về tra cứu vận đơn, cước phí, thời gian giao, cách gửi hàng, COD hoặc hàng hoàn. Nếu cần người hỗ trợ, hãy chọn “Gặp nhân viên CSKH”.', '2026-10-10 04:17:35'),
(3, 2, 'customer', NULL, 'h', '2026-10-10 04:17:43'),
(4, 2, 'bot', NULL, 'Mình chưa hiểu rõ câu hỏi. Bạn có thể hỏi về tra cứu vận đơn, cước phí, thời gian giao, cách gửi hàng, COD hoặc hàng hoàn. Nếu cần người hỗ trợ, hãy chọn “Gặp nhân viên CSKH”.', '2026-10-10 04:17:43');

-- --------------------------------------------------------

--
-- Table structure for table `chat_sessions`
--

CREATE TABLE `chat_sessions` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `mode` enum('ai','live') NOT NULL,
  `customer_user_id` int(11) DEFAULT NULL,
  `customer_name` varchar(255) NOT NULL,
  `customer_phone` varchar(50) DEFAULT NULL,
  `guest_token_hash` char(64) NOT NULL,
  `status` enum('waiting','active','closed') NOT NULL DEFAULT 'waiting',
  `assigned_agent_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_INCREMENT=3;

--
-- Dumping data for table `chat_sessions`
--

INSERT INTO `chat_sessions` (`id`, `mode`, `customer_user_id`, `customer_name`, `customer_phone`, `guest_token_hash`, `status`, `assigned_agent_id`, `created_at`, `updated_at`) VALUES
(1, 'ai', NULL, 'Khách hàng', NULL, 'd6473f63a6467295e8f5ad1483bb44a83c3569ca7efa5c4206d21ac98358a262', 'active', NULL, '2026-10-10 04:17:32', '2026-10-10 04:17:35'),
(2, 'ai', NULL, 'Khách hàng', NULL, 'ba75867025fa6c30fd6c2d42c2fe97238c64b3c5ac6242f16b0cd5b1ae6d390b', 'active', NULL, '2026-10-10 04:17:41', '2026-10-10 04:17:44');

-- --------------------------------------------------------

--
-- Table structure for table `cod_settlements`
--

CREATE TABLE `cod_settlements` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `shop_id` int(11) NOT NULL,
  `total_cod` decimal(12,2) NOT NULL DEFAULT 0.00,
  `total_shipping_fee` decimal(12,2) NOT NULL DEFAULT 0.00,
  `total_service_fee` decimal(12,2) NOT NULL DEFAULT 0.00,
  `total_insurance_fee` decimal(12,2) NOT NULL DEFAULT 0.00,
  `total_paid` decimal(12,2) NOT NULL DEFAULT 0.00,
  `order_count` int(11) NOT NULL DEFAULT 0,
  `settled_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_INCREMENT=2;

--
-- Dumping data for table `cod_settlements`
--

INSERT INTO `cod_settlements` (`id`, `shop_id`, `total_cod`, `total_shipping_fee`, `total_service_fee`, `total_insurance_fee`, `total_paid`, `order_count`, `settled_at`) VALUES
(1, 6, 450000.00, 25000.00, 0.00, 0.00, 425000.00, 1, '2026-10-10 04:13:31');

-- --------------------------------------------------------

--
-- Table structure for table `department_leaders`
--

CREATE TABLE `department_leaders` (
  `department` varchar(255) NOT NULL,
  `user_id` int(11) NOT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `department_leaders`
--

INSERT INTO `department_leaders` (`department`, `user_id`, `assigned_at`) VALUES
('Phòng Kho', 5, '2026-10-10 03:11:12'),
('Phòng Nhân Sự', 2, '2026-10-10 03:11:12'),
('Phòng Nội Dung', 8, '2026-10-10 03:11:12'),
('Phòng Tài Chính', 4, '2026-10-10 03:11:12'),
('Phòng Điều Phối', 3, '2026-10-10 03:11:12');

-- --------------------------------------------------------

--
-- Table structure for table `department_reports`
--

CREATE TABLE `department_reports` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `created_by` int(11) NOT NULL,
  `department` varchar(255) NOT NULL,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `attachment_url` varchar(255) DEFAULT NULL,
  `status` varchar(30) DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_INCREMENT=5;

--
-- Dumping data for table `department_reports`
--

INSERT INTO `department_reports` (`id`, `created_by`, `department`, `title`, `content`, `attachment_url`, `status`, `created_at`) VALUES
(1, 1, 'Phòng Điều Phối', 'Báo cáo hoạt động tuần', 'Tuần này có 18 đơn hàng mới, trong đó 3 đơn chậm do thời tiết.', NULL, 'pending', '2026-10-10 03:11:12'),
(2, 3, 'Phòng Điều Phối', 'Báo cáo điều phối tuần mẫu', 'Đã xử lý 42 đơn hàng; 38 đơn giao thành công, 4 đơn đang chờ xác nhận. Hai tài xế hoàn thành tuyến đúng kế hoạch.', NULL, 'pending', '2026-10-10 03:11:12'),
(3, 2, 'Phòng Nhân Sự', 'Tổng hợp chấm công tháng mẫu', 'Tỷ lệ đi làm đúng giờ đạt 96%. Đã ghi nhận hai ca trong ngày cho giám đốc và tài xế để kiểm tra quy trình chấm công nhiều ca.', NULL, 'approved', '2026-10-10 03:11:12'),
(4, 5, 'Phòng Kho', 'Đề xuất kiểm kê kho mẫu', 'Đề xuất kiểm kê bổ sung nhóm hàng tồn quá 30 ngày và đối chiếu số liệu trước khi chốt báo cáo tuần.', NULL, 'rejected', '2026-10-10 03:11:12');

-- --------------------------------------------------------

--
-- Table structure for table `driver_cash_remittances`
--

CREATE TABLE `driver_cash_remittances` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `driver_id` int(11) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `status` enum('pending','received') NOT NULL DEFAULT 'pending',
  `received_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `received_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_INCREMENT=2;

--
-- Dumping data for table `driver_cash_remittances`
--

INSERT INTO `driver_cash_remittances` (`id`, `driver_id`, `amount`, `status`, `received_by`, `created_at`, `received_at`) VALUES
(1, 10, 700000.00, 'pending', NULL, '2026-10-10 04:10:14', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `driver_dispatch_profiles`
--

CREATE TABLE `driver_dispatch_profiles` (
  `driver_id` int(11) NOT NULL,
  `max_active_orders` int(11) NOT NULL DEFAULT 10,
  `max_payload_kg` decimal(10,2) NOT NULL DEFAULT 100.00,
  `service_areas` text NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `driver_expense_claims`
--

CREATE TABLE `driver_expense_claims` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `driver_id` int(11) NOT NULL,
  `expense_type` enum('toll','parking','fuel','other') NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `note` varchar(500) NOT NULL,
  `receipt_image` varchar(255) NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `reviewed_by` int(11) DEFAULT NULL,
  `review_note` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `reviewed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `driver_incidents`
--

CREATE TABLE `driver_incidents` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `driver_id` int(11) NOT NULL,
  `incident_type` enum('accident','vehicle_breakdown','traffic','other') NOT NULL,
  `description` text NOT NULL,
  `lat` double DEFAULT NULL,
  `lng` double DEFAULT NULL,
  `status` enum('open','acknowledged','resolved') NOT NULL DEFAULT 'open',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `driver_positions`
--

CREATE TABLE `driver_positions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) DEFAULT NULL,
  `shipper_id` int(11) NOT NULL,
  `lat` double NOT NULL,
  `lng` double NOT NULL,
  `route_status` varchar(50) DEFAULT 'moving',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `driver_routes`
--

CREATE TABLE `driver_routes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `shipper_id` int(11) DEFAULT NULL,
  `warehouse_lat` double DEFAULT 10.762622,
  `warehouse_lng` double DEFAULT 106.660172,
  `pickup_lat` double DEFAULT 10.7605,
  `pickup_lng` double DEFAULT 106.6545,
  `delivery_lat` double DEFAULT 10.7745,
  `delivery_lng` double DEFAULT 106.6665,
  `route_status` varchar(50) DEFAULT 'assigned',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_INCREMENT=6;

--
-- Dumping data for table `driver_routes`
--

INSERT INTO `driver_routes` (`id`, `order_id`, `shipper_id`, `warehouse_lat`, `warehouse_lng`, `pickup_lat`, `pickup_lng`, `delivery_lat`, `delivery_lng`, `route_status`, `created_at`) VALUES
(1, 2, 9, 10.762622, 106.660172, 10.7605, 106.6545, 10.7745, 106.6665, 'assigned', '2026-10-10 03:11:12'),
(2, 3, 10, 10.762622, 106.660172, 10.7605, 106.6545, 10.7745, 106.6665, 'assigned', '2026-10-10 03:11:12'),
(3, 6, 11, 10.762622, 106.660172, 10.7605, 106.6545, 10.7745, 106.6665, 'assigned', '2026-10-10 03:11:12'),
(4, 17, 10, 10.762622, 106.660172, 10.8231, 106.6881, 10.764234602865823, 106.70052659075036, 'delivery', '2026-10-10 03:40:27');

-- --------------------------------------------------------

--
-- Table structure for table `driver_wallets`
--

CREATE TABLE `driver_wallets` (
  `driver_id` int(11) NOT NULL,
  `balance` decimal(12,2) NOT NULL DEFAULT 0.00,
  `reserved_balance` decimal(12,2) NOT NULL DEFAULT 0.00,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `driver_wallets`
--

INSERT INTO `driver_wallets` (`driver_id`, `balance`, `reserved_balance`, `updated_at`) VALUES
(10, 5000000.00, 700000.00, '2026-10-10 04:09:18');

-- --------------------------------------------------------

--
-- Table structure for table `driver_wallet_reservations`
--

CREATE TABLE `driver_wallet_reservations` (
  `order_id` int(11) NOT NULL,
  `driver_id` int(11) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `status` enum('reserved','released') NOT NULL DEFAULT 'reserved',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `released_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `driver_wallet_reservations`
--

INSERT INTO `driver_wallet_reservations` (`order_id`, `driver_id`, `amount`, `status`, `created_at`, `released_at`) VALUES
(17, 10, 700000.00, 'reserved', '2026-10-10 04:09:18', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `driver_wallet_transactions`
--

CREATE TABLE `driver_wallet_transactions` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `driver_id` int(11) NOT NULL,
  `order_id` int(11) DEFAULT NULL,
  `transaction_type` enum('deposit','reserve','release') NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_INCREMENT=3;

--
-- Dumping data for table `driver_wallet_transactions`
--

INSERT INTO `driver_wallet_transactions` (`id`, `driver_id`, `order_id`, `transaction_type`, `amount`, `note`, `created_by`, `created_at`) VALUES
(1, 10, NULL, 'deposit', 5000000.00, 'Kế toán xác nhận đã nhận tiền ký quỹ', 4, '2026-10-10 03:54:37'),
(2, 10, 17, 'reserve', 700000.00, 'Giữ ký quỹ khi phân công đơn COD', NULL, '2026-10-10 04:09:18');

-- --------------------------------------------------------

--
-- Table structure for table `employee_payroll_adjustments`
--

CREATE TABLE `employee_payroll_adjustments` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `payroll_month` char(7) NOT NULL,
  `adjustment_type` enum('bonus','deduction') NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `reason` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `employee_salaries`
--

CREATE TABLE `employee_salaries` (
  `user_id` int(11) NOT NULL,
  `monthly_salary` decimal(12,2) NOT NULL DEFAULT 0.00,
  `allowance` decimal(12,2) NOT NULL DEFAULT 0.00,
  `bonus_per_delivery` decimal(12,2) NOT NULL DEFAULT 0.00,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `employee_salaries`
--

INSERT INTO `employee_salaries` (`user_id`, `monthly_salary`, `allowance`, `bonus_per_delivery`, `updated_at`) VALUES
(1, 45000000.00, 10000000.00, 0.00, '2026-10-10 03:11:12'),
(2, 18000000.00, 3000000.00, 0.00, '2026-10-10 03:11:12'),
(3, 20000000.00, 4000000.00, 0.00, '2026-10-10 03:11:12'),
(4, 16000000.00, 2500000.00, 0.00, '2026-10-10 03:11:12'),
(5, 15000000.00, 2000000.00, 0.00, '2026-10-10 03:11:12'),
(6, 12000000.00, 1500000.00, 0.00, '2026-10-10 03:11:12'),
(7, 12000000.00, 4000000.00, 0.00, '2026-10-10 03:11:12'),
(8, 15000000.00, 2000000.00, 0.00, '2026-10-10 03:11:12'),
(9, 12000000.00, 4000000.00, 0.00, '2026-10-10 03:11:12'),
(10, 12000000.00, 4000000.00, 0.00, '2026-10-10 03:11:12'),
(11, 12000000.00, 4000000.00, 0.00, '2026-10-10 03:11:12'),
(12, 10000000.00, 0.00, 0.00, '2026-10-10 03:11:12'),
(13, 15000000.00, 2000000.00, 0.00, '2026-10-10 03:11:12'),
(14, 15000000.00, 2000000.00, 0.00, '2026-10-10 03:11:12'),
(15, 20000000.00, 4000000.00, 0.00, '2026-10-10 03:11:12'),
(16, 16000000.00, 2500000.00, 0.00, '2026-10-10 03:11:12'),
(17, 18000000.00, 3000000.00, 0.00, '2026-10-10 03:11:12'),
(18, 15000000.00, 2000000.00, 0.00, '2026-10-10 03:11:12'),
(19, 12000000.00, 1500000.00, 0.00, '2026-10-10 03:11:12');

-- --------------------------------------------------------

--
-- Table structure for table `job_applications`
--

CREATE TABLE `job_applications` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `job_title` varchar(255) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(50) NOT NULL,
  `experience` text DEFAULT NULL,
  `message` text DEFAULT NULL,
  `status` enum('new','reviewing','accepted','rejected') NOT NULL DEFAULT 'new',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_INCREMENT=4;

--
-- Dumping data for table `job_applications`
--

INSERT INTO `job_applications` (`id`, `job_title`, `full_name`, `email`, `phone`, `experience`, `message`, `status`, `created_at`) VALUES
(1, 'Tài xế giao nhận', 'Đỗ Minh Phúc', 'ungvien.phuc@example.com', '0902000001', '3 năm giao hàng nội thành, thông thạo các tuyến TP. Hồ Chí Minh.', 'Có thể nhận việc theo ca sáng.', 'new', '2026-10-10 03:11:12'),
(2, 'Nhân viên điều phối', 'Nguyễn Hà My', 'ungvien.my@example.com', '0902000002', '2 năm theo dõi đơn hàng và điều phối đội giao nhận.', 'Mong muốn làm việc tại văn phòng TP. Hồ Chí Minh.', 'reviewing', '2026-10-10 03:11:12'),
(3, 'Nhân viên kho', 'Trần Đức Long', 'ungvien.long@example.com', '0902000003', 'Từng kiểm kê và phân loại hàng hóa tại kho thương mại điện tử.', 'Có thể làm việc theo ca.', 'accepted', '2026-10-10 03:11:12');

-- --------------------------------------------------------

--
-- Table structure for table `leave_requests`
--

CREATE TABLE `leave_requests` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `reason` text NOT NULL,
  `status` varchar(30) DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_INCREMENT=5;

--
-- Dumping data for table `leave_requests`
--

INSERT INTO `leave_requests` (`id`, `user_id`, `reason`, `status`, `created_at`) VALUES
(1, 9, 'Xin nghỉ phép một ngày để giải quyết việc gia đình.', 'pending', '2026-10-10 03:11:12'),
(2, 14, 'Xin đổi ca và nghỉ phép ngày thứ Bảy tuần này.', 'pending', '2026-10-10 03:11:12'),
(3, 10, 'Đề nghị nghỉ phép đã được quản lý xác nhận.', 'approved', '2026-10-10 03:11:12'),
(4, 7, 'Xin nghỉ phép 1 ngày do gia đình có việc cần xử lý.', 'approved', '2026-10-10 03:11:12');

-- --------------------------------------------------------

--
-- Table structure for table `linehaul_trips`
--

CREATE TABLE `linehaul_trips` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `trip_code` varchar(40) NOT NULL,
  `vehicle_plate` varchar(30) NOT NULL,
  `truck_id` int(11) DEFAULT NULL,
  `driver_id` int(11) DEFAULT NULL,
  `source_warehouse_id` int(11) NOT NULL,
  `destination_warehouse_id` int(11) NOT NULL,
  `status` enum('planned','loading','in_transit','arrived','completed','cancelled') NOT NULL DEFAULT 'planned',
  `departed_at` datetime DEFAULT NULL,
  `arrived_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_INCREMENT=3;

--
-- Dumping data for table `linehaul_trips`
--

INSERT INTO `linehaul_trips` (`id`, `trip_code`, `vehicle_plate`, `truck_id`, `driver_id`, `source_warehouse_id`, `destination_warehouse_id`, `status`, `departed_at`, `arrived_at`, `created_at`) VALUES
(1, 'TRIP-MV1UW8KW-52C4', '51C-12334', 1, 12, 2, 1, 'completed', '2026-10-10 10:51:06', '2026-10-10 10:52:03', '2026-10-10 03:50:21'),
(2, 'TRIP-MV1UZ5HB-7ED1', '51C-12334', 1, 12, 1, 3, 'completed', '2026-10-10 10:53:22', '2026-10-10 10:53:56', '2026-10-10 03:52:37');

-- --------------------------------------------------------

--
-- Table structure for table `linehaul_trip_bags`
--

CREATE TABLE `linehaul_trip_bags` (
  `trip_id` bigint(20) NOT NULL,
  `bag_id` bigint(20) NOT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `driver_scanned_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `linehaul_trip_bags`
--

INSERT INTO `linehaul_trip_bags` (`trip_id`, `bag_id`, `assigned_at`, `driver_scanned_at`) VALUES
(1, 1, '2026-10-10 03:50:33', '2026-10-10 10:51:04'),
(2, 3, '2026-10-10 03:53:05', '2026-10-10 10:53:21');

-- --------------------------------------------------------

--
-- Table structure for table `linehaul_trip_positions`
--

CREATE TABLE `linehaul_trip_positions` (
  `trip_id` bigint(20) NOT NULL,
  `driver_id` int(11) NOT NULL,
  `lat` double NOT NULL,
  `lng` double NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `linehaul_trip_positions`
--

INSERT INTO `linehaul_trip_positions` (`trip_id`, `driver_id`, `lat`, `lng`, `updated_at`) VALUES
(1, 12, 10.822353, 106.687524, '2026-10-10 03:51:09');

-- --------------------------------------------------------

--
-- Table structure for table `news_articles`
--

CREATE TABLE `news_articles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `summary` text DEFAULT NULL,
  `content` longtext DEFAULT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `category` varchar(100) DEFAULT 'Tin tức',
  `status` enum('draft','published') DEFAULT 'published',
  `created_by` varchar(255) DEFAULT 'content_team',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_INCREMENT=9;

--
-- Dumping data for table `news_articles`
--

INSERT INTO `news_articles` (`id`, `title`, `slug`, `summary`, `content`, `image_url`, `category`, `status`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 'Smart Logistics nâng cấp hệ thống tracking mới', 'smart-logistics-nang-cap-he-thong-tracking-moi', 'Hệ thống theo dõi đơn hàng được cập nhật để giảm sai sót trong quá trình giao nhận.', '<p>Smart Logistics vừa triển khai hệ thống tracking mới nhằm giúp khách hàng theo dõi đơn hàng trong thời gian thực.</p><p>Với công nghệ cập nhật, các đơn hàng được phản hồi nhanh hơn, giảm tỷ lệ chậm trễ và tối ưu hóa quy trình vận chuyển.</p>', 'https://images.unsplash.com/photo-1586528116311-ad8ed7c663be?auto=format&fit=crop&w=800&q=80', 'Tin tức', 'published', 'content_team', '2026-10-10 03:11:12', '2026-10-10 03:11:12'),
(2, 'Cách tối ưu chi phí vận chuyển cho shop online', 'cach-toi-uu-chi-phi-van-chuyen-cho-shop-online', 'Bốn cách giúp doanh nghiệp giảm chi phí logistics mà vẫn giữ chất lượng giao hàng tốt.', '<p>Để tối ưu chi phí vận chuyển, doanh nghiệp cần theo dõi trọng lượng, địa điểm giao hàng và thời điểm vận chuyển hiệu quả.</p><p>Smart Logistics khuyến nghị khách hàng lựa chọn gói cước phù hợp để tránh phát sinh chi phí bất ngờ.</p>', 'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=800&q=80', 'Hướng dẫn', 'published', 'content_team', '2026-10-10 03:11:12', '2026-10-10 03:11:12'),
(3, 'Đội ngũ tài xế và kho vận đồng bộ trên dashboard mới', 'doi-ngu-tai-xe-va-kho-van-dong-bo-tren-dashboard-moi', 'Dashboard mới cho phép đội ngũ vận hành làm việc đồng bộ và cập nhật tiến độ kịp thời.', '<p>Bộ phận vận hành và kho vận đang làm việc chung trên dashboard mới, giúp theo dõi trạng thái đơn hàng liên tục.</p><p>Điều này giúp rút ngắn thời gian xử lý, nâng cao độ chính xác và hiệu quả điều phối.</p>', 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=800&q=80', 'Công nghệ', 'published', 'content_team', '2026-10-10 03:11:12', '2026-10-10 03:11:12'),
(4, 'Hướng dẫn chuẩn bị hàng trước khi gửi', 'huong-dan-chuan-bi-hang-truoc-khi-gui', 'Các bước đóng gói giúp hàng hóa an toàn và rút ngắn thời gian xử lý tại kho.', '<p>Chọn thùng vừa kích thước, chèn vật liệu chống sốc và dán kín các cạnh.</p><p>Ghi rõ mã đơn bên ngoài kiện hàng và tách riêng hàng dễ vỡ để được xử lý phù hợp.</p>', 'https://images.unsplash.com/photo-1607082349566-187342175e2f?auto=format&fit=crop&w=1200&q=80', 'Hướng dẫn', 'published', 'content_team', '2026-10-10 03:11:12', '2026-10-10 03:11:12'),
(5, 'Mở rộng mạng lưới giao nhận khu vực phía Nam', 'mo-rong-mang-luoi-giao-nhan-phia-nam', 'Smart Logistics bổ sung điểm trung chuyển để tăng tốc độ giao hàng liên tỉnh.', '<p>Điểm trung chuyển mới giúp các tuyến nội vùng được phân loại sớm hơn.</p><p>Đội điều phối sẽ theo dõi sản lượng theo ngày để điều chỉnh lịch xe linh hoạt.</p>', 'https://images.unsplash.com/photo-1586528116311-ad8ed7c663be?auto=format&fit=crop&w=1200&q=80', 'Tin tức', 'published', 'content_team', '2026-10-10 03:11:12', '2026-10-10 03:11:12'),
(6, 'Quy trình đối soát COD minh bạch', 'quy-trinh-doi-soat-cod-minh-bach', 'Shop có thể kiểm tra số đơn, số tiền thu hộ và lịch sử thanh toán theo từng đợt.', '<p>Mỗi đợt đối soát tổng hợp đơn giao thành công và số tiền tài xế đã thu.</p><p>Vui lòng đối chiếu mã vận đơn trước khi xác nhận thanh toán.</p>', 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=80', 'Hướng dẫn', 'published', 'content_team', '2026-10-10 03:11:12', '2026-10-10 03:11:12'),
(7, 'Tuyển tài xế giao nhận trong tháng 10', 'tuyen-tai-xe-giao-nhan-thang-10', 'Smart Logistics mở rộng đội giao nhận và tiếp nhận hồ sơ tài xế toàn thời gian.', '<p>Ứng viên cần có giấy phép lái xe phù hợp, điện thoại thông minh và thông tin cư trú rõ ràng.</p><p>Hồ sơ có thể gửi qua trang Tuyển dụng để bộ phận nhân sự liên hệ.</p>', 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80', 'Tuyển dụng', 'published', 'content_team', '2026-10-10 03:11:12', '2026-10-10 03:11:12'),
(8, 'Quét mã vạch giúp kiểm soát tồn kho', 'quet-ma-vach-kiem-soat-ton-kho', 'Quy trình quét mã đồng bộ trạng thái kiện hàng giữa kho và đội điều phối.', '<p>Mỗi lần nhận, xuất hoặc phân loại kiện hàng cần quét mã vận đơn để cập nhật trạng thái.</p><p>Thao tác này giúp giảm nhập liệu thủ công và dễ tra soát khi phát sinh chênh lệch.</p>', 'https://images.unsplash.com/photo-1580674285054-bed31e145f59?auto=format&fit=crop&w=1200&q=80', 'Công nghệ', 'published', 'content_team', '2026-10-10 03:11:12', '2026-10-10 03:11:12');

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `recipient_user_id` int(11) NOT NULL,
  `order_id` int(11) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_INCREMENT=13;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `recipient_user_id`, `order_id`, `title`, `message`, `is_read`, `created_at`) VALUES
(1, 19, 17, 'Đã tiếp nhận vận đơn', 'Đơn VTP041B28516DVN đã được gửi đến Điều phối.', 0, '2026-10-10 03:39:35'),
(2, 9, 17, 'Có nhiệm vụ vận chuyển mới', 'Đơn VTP041B28516DVN: lấy hàng tại Shop.', 0, '2026-10-10 03:40:27'),
(3, 19, 17, 'Cập nhật luân chuyển vận đơn', 'Đơn VTP041B28516DVN đang được lấy hàng tại Shop.', 0, '2026-10-10 03:40:27'),
(4, 19, 17, 'Cập nhật trạng thái vận đơn', 'Đơn VTP041B28516DVN đã chuyển sang trạng thái đã lấy hàng, chờ nhập kho.', 0, '2026-10-10 03:42:40'),
(5, 19, 17, 'Cập nhật luân chuyển vận đơn', 'Đã nhận hàng tại kho con nguồn. Chờ Điều phối chuyển về kho tổng. Vị trí lưu kho: A1-01.', 0, '2026-10-10 03:43:39'),
(6, 10, 17, 'Có nhiệm vụ vận chuyển mới', 'Đơn VTP041B28516DVN: giao hàng đến người nhận.', 0, '2026-10-10 04:09:18'),
(7, 19, 17, 'Cập nhật luân chuyển vận đơn', 'Đơn VTP041B28516DVN đang được giao hàng đến người nhận.', 0, '2026-10-10 04:09:18'),
(8, 19, 17, 'Cập nhật trạng thái vận đơn', 'Đơn VTP041B28516DVN đã chuyển sang trạng thái đang giao.', 0, '2026-10-10 04:09:34'),
(9, 19, 17, 'Cập nhật trạng thái vận đơn', 'Đơn VTP041B28516DVN đã chuyển sang trạng thái giao thành công.', 0, '2026-10-10 04:09:50'),
(10, 1, 5, 'Shop yêu cầu giao lại', 'Đơn SLTEST260904VN có yêu cầu giao lại. Vui lòng kiểm tra thông tin trong hồ sơ RMA.', 0, '2026-10-10 04:10:36'),
(11, 3, 5, 'Shop yêu cầu giao lại', 'Đơn SLTEST260904VN có yêu cầu giao lại. Vui lòng kiểm tra thông tin trong hồ sơ RMA.', 0, '2026-10-10 04:10:37'),
(12, 15, 5, 'Shop yêu cầu giao lại', 'Đơn SLTEST260904VN có yêu cầu giao lại. Vui lòng kiểm tra thông tin trong hồ sơ RMA.', 0, '2026-10-10 04:10:37');

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tracking_code` varchar(100) NOT NULL,
  `shop_id` int(11) DEFAULT NULL,
  `shipper_id` int(11) DEFAULT NULL,
  `pickup_shipper_id` int(11) DEFAULT NULL,
  `central_transfer_shipper_id` int(11) DEFAULT NULL,
  `destination_transfer_shipper_id` int(11) DEFAULT NULL,
  `delivery_shipper_id` int(11) DEFAULT NULL,
  `origin_warehouse_id` int(11) DEFAULT NULL,
  `destination_warehouse_id` int(11) DEFAULT NULL,
  `current_warehouse_id` int(11) DEFAULT NULL,
  `storage_bin_id` bigint(20) DEFAULT NULL,
  `cross_docked` tinyint(1) NOT NULL DEFAULT 0,
  `shop_address` text DEFAULT NULL,
  `shop_province` varchar(255) DEFAULT 'Hồ Chí Minh',
  `shop_lat` double DEFAULT 10.762622,
  `shop_lng` double DEFAULT 106.660172,
  `receiver_name` varchar(255) NOT NULL,
  `receiver_phone` varchar(50) NOT NULL,
  `receiver_address` text NOT NULL,
  `receiver_lat` double DEFAULT NULL,
  `receiver_lng` double DEFAULT NULL,
  `customer_email` varchar(255) DEFAULT NULL,
  `cod_amount` decimal(12,2) DEFAULT 0.00,
  `shipping_fee` decimal(12,2) DEFAULT 0.00,
  `fee_payer` enum('sender','receiver') NOT NULL DEFAULT 'sender',
  `weight_kg` decimal(8,2) DEFAULT 1.00,
  `length` decimal(8,2) DEFAULT 0.00,
  `width` decimal(8,2) DEFAULT 0.00,
  `height` decimal(8,2) DEFAULT 0.00,
  `item_value` decimal(12,2) DEFAULT 0.00,
  `distance_km` decimal(10,2) DEFAULT 0.00,
  `is_remote_area` tinyint(1) DEFAULT 0,
  `service_type` varchar(50) DEFAULT 'standard',
  `is_fragile` tinyint(1) DEFAULT 0,
  `vehicle_type` varchar(50) DEFAULT 'motorbike',
  `destination_province` varchar(255) DEFAULT 'Hồ Chí Minh',
  `cod_collected` tinyint(1) NOT NULL DEFAULT 0,
  `cod_collected_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `cod_payment_method` enum('cash','bank_transfer') DEFAULT NULL,
  `cod_settlement_id` int(11) DEFAULT NULL,
  `cod_remittance_id` bigint(20) DEFAULT NULL,
  `service_fee` decimal(12,2) NOT NULL DEFAULT 0.00,
  `insurance_fee` decimal(12,2) NOT NULL DEFAULT 0.00,
  `is_cod_paid` tinyint(1) DEFAULT 0,
  `proof_image` varchar(255) DEFAULT NULL,
  `signature_image` varchar(255) DEFAULT NULL,
  `fail_reason` text DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_INCREMENT=18;

--
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`id`, `tracking_code`, `shop_id`, `shipper_id`, `pickup_shipper_id`, `central_transfer_shipper_id`, `destination_transfer_shipper_id`, `delivery_shipper_id`, `origin_warehouse_id`, `destination_warehouse_id`, `current_warehouse_id`, `storage_bin_id`, `cross_docked`, `shop_address`, `shop_province`, `shop_lat`, `shop_lng`, `receiver_name`, `receiver_phone`, `receiver_address`, `receiver_lat`, `receiver_lng`, `customer_email`, `cod_amount`, `shipping_fee`, `fee_payer`, `weight_kg`, `length`, `width`, `height`, `item_value`, `distance_km`, `is_remote_area`, `service_type`, `is_fragile`, `vehicle_type`, `destination_province`, `cod_collected`, `cod_collected_amount`, `cod_payment_method`, `cod_settlement_id`, `cod_remittance_id`, `service_fee`, `insurance_fee`, `is_cod_paid`, `proof_image`, `signature_image`, `fail_reason`, `status`, `created_at`, `updated_at`) VALUES
(1, 'TVP828141VN', 6, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 'Hồ Chí Minh', 10.762622, 106.660172, 'Lê Tấn', '0999999999', 'Đà Nẵng', NULL, NULL, NULL, 1000000.00, 420000.00, 'sender', 1.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 'standard', 0, 'motorbike', 'Hồ Chí Minh', 0, 0.00, NULL, NULL, NULL, 0.00, 0.00, 0, NULL, NULL, NULL, 'pending', '2026-10-10 03:11:12', '2026-10-10 03:11:12'),
(2, 'SLTEST260901VN', 19, NULL, 9, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 'Hồ Chí Minh', 10.762622, 106.660172, 'Nguyễn Thị Mai', '0901000001', 'Quận 1, TP. Hồ Chí Minh', NULL, NULL, 'khach01@example.com', 850000.00, 28000.00, 'sender', 1.20, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 'standard', 0, 'motorbike', 'Hồ Chí Minh', 0, 0.00, NULL, NULL, NULL, 0.00, 0.00, 0, NULL, NULL, NULL, 'picking', '2026-10-10 03:11:12', '2026-10-10 03:11:12'),
(3, 'SLTEST260902VN', 19, NULL, NULL, NULL, NULL, 10, NULL, NULL, NULL, NULL, 0, NULL, 'Hồ Chí Minh', 10.762622, 106.660172, 'Trần Quốc Bảo', '0901000002', 'Quận 3, TP. Hồ Chí Minh', NULL, NULL, 'khach02@example.com', 1250000.00, 32000.00, 'sender', 2.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 'express', 0, 'motorbike', 'Hồ Chí Minh', 0, 0.00, NULL, NULL, NULL, 0.00, 0.00, 0, NULL, NULL, NULL, 'delivering', '2026-10-10 03:11:12', '2026-10-10 03:11:12'),
(4, 'SLTEST260903VN', 6, NULL, NULL, NULL, NULL, 10, NULL, NULL, NULL, NULL, 0, NULL, 'Hồ Chí Minh', 10.762622, 106.660172, 'Lê Minh Châu', '0901000003', 'Thủ Đức, TP. Hồ Chí Minh', NULL, NULL, 'khach03@example.com', 450000.00, 25000.00, 'sender', 0.80, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 'standard', 0, 'motorbike', 'Hồ Chí Minh', 0, 0.00, NULL, 1, NULL, 0.00, 0.00, 1, NULL, NULL, NULL, 'completed', '2026-10-10 03:11:12', '2026-10-10 04:13:31'),
(5, 'SLTEST260904VN', 6, NULL, NULL, NULL, NULL, 10, NULL, NULL, NULL, NULL, 0, NULL, 'Hồ Chí Minh', 10.762622, 106.660172, 'Phạm Gia Hân', '0901000004', 'Dĩ An, Bình Dương', NULL, NULL, 'khach04@example.com', 720000.00, 35000.00, 'sender', 1.50, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 'economy', 0, 'motorbike', 'Hồ Chí Minh', 0, 0.00, NULL, NULL, NULL, 0.00, 0.00, 0, NULL, NULL, NULL, 'returning', '2026-10-10 03:11:12', '2026-10-10 03:11:12'),
(6, 'SLTEST260905VN', 19, NULL, NULL, NULL, NULL, 11, NULL, NULL, NULL, NULL, 0, NULL, 'Hồ Chí Minh', 10.762622, 106.660172, 'Võ Thành Đạt', '0901000005', 'Gò Vấp, TP. Hồ Chí Minh', NULL, NULL, 'khach05@example.com', 2000000.00, 30000.00, 'sender', 3.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 'express', 0, 'motorbike', 'Hồ Chí Minh', 0, 0.00, NULL, NULL, NULL, 0.00, 0.00, 0, NULL, NULL, NULL, 'delivering', '2026-10-10 03:11:12', '2026-10-10 03:11:12'),
(7, 'SLTEST260906VN', 6, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 'Hồ Chí Minh', 10.762622, 106.660172, 'Ngô Thanh Tùng', '0901000006', 'Biên Hòa, Đồng Nai', NULL, NULL, 'khach06@example.com', 310000.00, 42000.00, 'sender', 0.50, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 'economy', 0, 'motorbike', 'Hồ Chí Minh', 0, 0.00, NULL, NULL, NULL, 0.00, 0.00, 0, NULL, NULL, NULL, 'in_warehouse', '2026-10-10 03:11:12', '2026-10-10 03:11:12'),
(8, 'SLTEST260907VN', 19, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, 'Hồ Chí Minh', 10.762622, 106.660172, 'Đặng Thu Trang', '0901000007', 'Quận 7, TP. Hồ Chí Minh', NULL, NULL, 'khach07@example.com', 980000.00, 29000.00, 'sender', 1.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 'standard', 0, 'motorbike', 'Hồ Chí Minh', 0, 0.00, NULL, NULL, NULL, 0.00, 0.00, 0, NULL, NULL, NULL, 'pending', '2026-10-10 03:11:12', '2026-10-10 03:11:12'),
(9, 'SLTEST260908VN', 19, NULL, NULL, NULL, NULL, 11, NULL, NULL, NULL, NULL, 0, NULL, 'Hồ Chí Minh', 10.762622, 106.660172, 'Hoàng Minh Đức', '0901000008', 'Tân Bình, TP. Hồ Chí Minh', NULL, NULL, 'khach08@example.com', 560000.00, 26000.00, 'sender', 1.10, 0.00, 0.00, 0.00, 0.00, 0.00, 0, 'standard', 0, 'motorbike', 'Hồ Chí Minh', 0, 0.00, NULL, NULL, NULL, 0.00, 0.00, 0, NULL, NULL, NULL, 'completed', '2026-10-10 03:11:12', '2026-10-10 03:11:12'),
(17, 'VTP041B28516DVN', 19, NULL, 9, NULL, NULL, 10, 2, 3, 3, NULL, 0, 'Số 2 Nguyễn Văn Bảo, Phường 4, Gò Vấp, TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 10.8231, 106.6881, 'Nguyễn Thị Mai Test', '0901000010', 'Ủy ban nhân dân phường Khánh Hội, 104, Đường Bến Vân Đồn, Khu phố 2, Phường Khánh Hội, Thành phố Hồ Chí Minh, 72822, Việt Nam', 10.764234602865823, 106.70052659075036, NULL, 700000.00, 31000.00, 'sender', 1.00, 10.00, 10.00, 10.00, 0.00, 6.68, 0, 'standard', 0, 'motorbike', 'TP. Hồ Chí Minh', 1, 700000.00, 'cash', NULL, 1, 0.00, 0.00, 0, '/uploads/pod-1791605390721-d59a60fac7b0e1ea.png', '/uploads/pod-1791605390747-4e1a446fc70db06b.png', NULL, 'completed', '2026-10-10 03:39:35', '2026-10-10 04:10:14');

-- --------------------------------------------------------

--
-- Table structure for table `order_status_history`
--

CREATE TABLE `order_status_history` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL,
  `from_status` varchar(50) DEFAULT NULL,
  `to_status` varchar(50) NOT NULL,
  `note` text DEFAULT NULL,
  `proof_image` varchar(255) DEFAULT NULL,
  `signature_image` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_INCREMENT=8;

--
-- Dumping data for table `order_status_history`
--

INSERT INTO `order_status_history` (`id`, `order_id`, `from_status`, `to_status`, `note`, `proof_image`, `signature_image`, `created_at`) VALUES
(1, 17, NULL, 'pending', 'Shop tạo đơn hàng', NULL, NULL, '2026-10-10 03:39:35'),
(2, 17, 'pending', 'picking', 'Điều phối phân công tài xế lấy hàng tại Shop', NULL, NULL, '2026-10-10 03:40:27'),
(3, 17, 'picking', 'picked_up', NULL, NULL, NULL, '2026-10-10 03:42:40'),
(4, 17, 'picked_up', 'at_origin_warehouse', 'Nhập kho tại vị trí A1-01', NULL, NULL, '2026-10-10 03:43:39'),
(5, 17, 'at_destination_warehouse', 'at_destination_warehouse', 'Điều phối phân công tài xế giao hàng đến người nhận', NULL, NULL, '2026-10-10 04:09:18'),
(6, 17, 'at_destination_warehouse', 'delivering', NULL, NULL, NULL, '2026-10-10 04:09:34'),
(7, 17, 'delivering', 'completed', NULL, '/uploads/pod-1791605390721-d59a60fac7b0e1ea.png', '/uploads/pod-1791605390747-4e1a446fc70db06b.png', '2026-10-10 04:09:50');

-- --------------------------------------------------------

--
-- Table structure for table `service_requests`
--

CREATE TABLE `service_requests` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `plan_name` varchar(100) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(50) NOT NULL,
  `message` text DEFAULT NULL,
  `status` enum('new','contacted','closed') NOT NULL DEFAULT 'new',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_INCREMENT=4;

--
-- Dumping data for table `service_requests`
--

INSERT INTO `service_requests` (`id`, `plan_name`, `full_name`, `email`, `phone`, `message`, `status`, `created_at`) VALUES
(1, 'Doanh nghiệp', 'Lê Thanh Bình', 'shop.binh@example.com', '0903000001', 'Cần tư vấn bảng giá giao hàng liên tỉnh cho khoảng 500 đơn mỗi tháng.', 'new', '2026-10-10 03:11:12'),
(2, 'Cửa hàng trực tuyến', 'Phạm Ngọc Anh', 'shop.anh@example.com', '0903000002', 'Muốn kết nối quy trình lấy hàng hằng ngày và đối soát COD.', 'contacted', '2026-10-10 03:11:12'),
(3, 'Tiết kiệm', 'Võ Hoàng Sơn', 'shop.son@example.com', '0903000003', 'Đang so sánh chi phí giao hàng cho cửa hàng mới mở.', 'closed', '2026-10-10 03:11:12');

-- --------------------------------------------------------

--
-- Table structure for table `shipment_bags`
--

CREATE TABLE `shipment_bags` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `bag_code` varchar(40) NOT NULL,
  `source_warehouse_id` int(11) NOT NULL,
  `destination_warehouse_id` int(11) NOT NULL,
  `status` enum('open','sealed','in_transit','received') NOT NULL DEFAULT 'open',
  `created_by` int(11) DEFAULT NULL,
  `sealed_at` datetime DEFAULT NULL,
  `received_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_INCREMENT=4;

--
-- Dumping data for table `shipment_bags`
--

INSERT INTO `shipment_bags` (`id`, `bag_code`, `source_warehouse_id`, `destination_warehouse_id`, `status`, `created_by`, `sealed_at`, `received_at`, `created_at`) VALUES
(1, 'BAG-MV1URM9Q-BDFA4D', 2, 1, 'received', 14, '2026-10-10 10:47:07', '2026-10-10 10:52:03', '2026-10-10 03:46:45'),
(2, 'BAG-MV1UUYFT-C245DA', 2, 1, 'open', 14, NULL, NULL, '2026-10-10 03:49:21'),
(3, 'BAG-MV1UZDHH-39DB2D', 1, 3, 'received', 5, '2026-10-10 10:52:57', '2026-10-10 10:53:56', '2026-10-10 03:52:47');

-- --------------------------------------------------------

--
-- Table structure for table `shipment_bag_orders`
--

CREATE TABLE `shipment_bag_orders` (
  `bag_id` bigint(20) NOT NULL,
  `order_id` int(11) NOT NULL,
  `added_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `shipment_bag_orders`
--

INSERT INTO `shipment_bag_orders` (`bag_id`, `order_id`, `added_at`) VALUES
(1, 17, '2026-10-10 03:47:00'),
(3, 17, '2026-10-10 03:52:54');

-- --------------------------------------------------------

--
-- Table structure for table `shop_api_keys`
--

CREATE TABLE `shop_api_keys` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `shop_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `key_prefix` varchar(24) NOT NULL,
  `key_hash` char(64) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `last_used_at` datetime DEFAULT NULL,
  `revoked_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `shop_redelivery_requests`
--

CREATE TABLE `shop_redelivery_requests` (
  `order_id` int(11) NOT NULL,
  `shop_id` int(11) NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `request_note` text NOT NULL,
  `requested_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `reviewed_at` datetime DEFAULT NULL,
  `reviewed_by` int(11) DEFAULT NULL,
  `review_note` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `shop_redelivery_requests`
--

INSERT INTO `shop_redelivery_requests` (`order_id`, `shop_id`, `status`, `request_note`, `requested_at`, `reviewed_at`, `reviewed_by`, `review_note`) VALUES
(5, 6, 'pending', 'csdkjvfghrh', '2026-10-10 04:10:36', NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `shop_webhook_configs`
--

CREATE TABLE `shop_webhook_configs` (
  `shop_id` int(11) NOT NULL,
  `target_url` varchar(2048) DEFAULT NULL,
  `secret_ciphertext` text DEFAULT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `trucks`
--

CREATE TABLE `trucks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `vehicle_plate` varchar(30) NOT NULL,
  `max_payload_kg` decimal(10,2) NOT NULL DEFAULT 0.00,
  `status` enum('ready','in_transit','maintenance') NOT NULL DEFAULT 'ready',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_INCREMENT=2;

--
-- Dumping data for table `trucks`
--

INSERT INTO `trucks` (`id`, `vehicle_plate`, `max_payload_kg`, `status`, `created_at`, `updated_at`) VALUES
(1, '51C-12334', 10000.00, 'ready', '2026-10-10 03:50:10', '2026-10-10 03:53:56');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `shop_address` text DEFAULT NULL,
  `shop_province` varchar(255) DEFAULT 'TP. Hồ Chí Minh',
  `shop_lat` double DEFAULT NULL,
  `shop_lng` double DEFAULT NULL,
  `role` varchar(50) NOT NULL DEFAULT 'customer',
  `warehouse_id` int(11) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_INCREMENT=20;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `email`, `password`, `full_name`, `phone`, `shop_address`, `shop_province`, `shop_lat`, `shop_lng`, `role`, `warehouse_id`, `status`, `created_at`) VALUES
(1, 'admin@smartlogistics.vn', '123', 'Trần Minh Thảo', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'director', NULL, 'active', '2026-10-10 03:11:12'),
(2, 'hr@smartlogistics.vn', 'scrypt$a09e716913238780fd24cea0e93fad6f$8a7464b7a8d07ae12935b09deb5c5cce4847c8fbd0187a0db9dcf9a13a0a1ec7009b5f30a4c93ef7ab85b35d2d4ee5ce037260852b1d63e5080fb07e73b9ea68', 'Trương Phòng Nhân Sự', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'hr_manager', NULL, 'active', '2026-10-10 03:11:12'),
(3, 'dieu_hanh@smartlogistics.vn', 'scrypt$acf696091f3fbf1d4b76610035d4cb62$3b9ca5837145876461b6682cab1831fc4ee42d351866f112676eff2496fc930a0d330dc10ea4b002dee7d83aaf70a6033b6ffbbe5332e6077292a78fe3bbc002', 'Diệu Hành', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'fleet_manager', NULL, 'active', '2026-10-10 03:11:12'),
(4, 'ketoan@smartlogistics.vn', 'scrypt$f4ecaf9c3d02506493eeadf4e0595791$9d1cb82c3515587d017c204a0fadd10d46f59f62bdf9cb9445b473f92864b2b33573f2ef146ede92947ba61076b6841c7cfa4aba681d0008fa8e41054d1fc934', 'Nguyễn Thị Kế Toán', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'accountant', NULL, 'active', '2026-10-10 03:11:12'),
(5, 'kho@smartlogistics.vn', 'scrypt$60e1e60415c02ee7dcfe10f2751dffde$9dde96c743648db633502471b56ab5b4739e242ff470ae10fe271db2d8e9c4ff9f00fb81f3d541215f4e1180367dff8e2a72476edf67bfd1a53f5ac813a03c3d', 'Trần Vũ Thủ Kho', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'warehouse_manager', 1, 'active', '2026-10-10 03:11:12'),
(6, 'shop@smartlogistics.vn', 'scrypt$b29949a9956f4b709527bde010598104$7733dda70e06ea748e32ccb0b1a60180b44bda96a33433740248ce13af1308d4f00309c86530997f14483653fdaaf33e64d63690a7592d0e2baa0df76f1ac4c9', 'Cửa Hàng Trần Minh', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'shop', NULL, 'active', '2026-10-10 03:11:12'),
(7, 'taixe1@smartlogistics.vn', '123', 'Nguyễn Văn Bửu Tài', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'pickup_driver', NULL, 'active', '2026-10-10 03:11:12'),
(8, 'content@smartlogistics.vn', '123', 'Phòng ban nội dung', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'content_manager', NULL, 'active', '2026-10-10 03:11:12'),
(9, 'taixe2@smartlogistics.vn', 'scrypt$d098e6eaf71194e3a507bf93cef6bdc3$d50a95eb8e55091910bf8cb6b5c42f35756d713fdb8f29c8cd8ba8bbb6a9ed9a60cacb7ca0df0d256ad02148cbf356e4ee75c5658a739ca3b3f6044df517382b', 'Bùi Quang Huy', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'pickup_driver', NULL, 'active', '2026-10-10 03:11:12'),
(10, 'taixe3@smartlogistics.vn', 'scrypt$b671c0a69c7a4837bdda74f9f2484495$430bf810a72578d9d27519530e7ef04bbaabcfd37f01be75fa1a5cff1ac0d7b8801df915bc0b73c9117cf5afe80c1e317204f9b5b3d6efdd1d98344cf2ad9661', 'Lê Hoàng Nam', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'delivery_driver', NULL, 'active', '2026-10-10 03:11:12'),
(11, 'taixe4@smartlogistics.vn', '123', 'Phạm Quốc Đạt', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'delivery_driver', NULL, 'active', '2026-10-10 03:11:12'),
(12, 'taixe_tai1@smartlogistics.vn', 'scrypt$bb6d37db225ff37f7efb308b49a7d66a$cc90883a46c1a2f2d4f2e7b31324292e9357e5ac2a6ba0b111f0d95cc67c2993c9d564398f1eefe3b5b353504dc34aa65bc96ef96cdafa3e7d6d35663ccd9273', 'Nguyễn Văn Tải', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'linehaul_driver', NULL, 'active', '2026-10-10 03:11:12'),
(13, 'kho3@smartlogistics.vn', 'scrypt$4b94c69e5f629d7bbfc9a15fef9ed2b1$168c937336c16f0b5f53ae73b4b21a17121040e18855e5445e8a473030e06e5dc8e62bbd3a65e96d6e076efcd8122aa2174f5585f4909e860c82b00f65449500', 'Trần Thị Thu Thủ Kho', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'warehouse_manager', 3, 'active', '2026-10-10 03:11:12'),
(14, 'kho2@smartlogistics.vn', 'scrypt$8f87803fd1c0686bd947fb7a99bfd5c6$bac413355a2bd00285c4080ef8b9b31e56bea44259655d8961171c7ca902f3e408ab5784800478ccaff1127bb30e2cc80283744cc90d0da311ec05915ec64269', 'Võ Khánh Linh', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'warehouse_manager', 2, 'active', '2026-10-10 03:11:12'),
(15, 'dieu_hanh2@smartlogistics.vn', '123', 'Lê Gia Bảo', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'fleet_manager', NULL, 'active', '2026-10-10 03:11:12'),
(16, 'ketoan2@smartlogistics.vn', '123', 'Phạm Hải Yến', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'accountant', NULL, 'active', '2026-10-10 03:11:12'),
(17, 'hr2@smartlogistics.vn', '123', 'Nguyễn Ngọc Mai', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'hr_manager', NULL, 'active', '2026-10-10 03:11:12'),
(18, 'content2@smartlogistics.vn', '123', 'Đặng Thu Hà', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'content_manager', NULL, 'active', '2026-10-10 03:11:12'),
(19, 'shop2@smartlogistics.vn', 'scrypt$3f082e6ae6373aeed6ab0e687b27486a$4d7b727f3d9aae727dd6fc3743a78e8bbf9c6c65d3a8f06c9e53b34258b9ac7c30f021b1b64a899a0907ef25716cfc2d2fea1c0a835aed9ebca0584f2408e3f6', 'Công ty Minh Long', NULL, 'Số 2 Nguyễn Văn Bảo, Phường 4, Gò Vấp, TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 10.8231, 106.6881, 'shop', NULL, 'active', '2026-10-10 03:11:12');

-- --------------------------------------------------------

--
-- Table structure for table `warehouses`
--

CREATE TABLE `warehouses` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `warehouse_type` enum('central','ward') NOT NULL,
  `ward_name` varchar(120) NOT NULL,
  `name` varchar(255) NOT NULL,
  `address` text DEFAULT NULL,
  `lat` double DEFAULT NULL,
  `lng` double DEFAULT NULL,
  `is_configured` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_INCREMENT=5;

--
-- Dumping data for table `warehouses`
--

INSERT INTO `warehouses` (`id`, `warehouse_type`, `ward_name`, `name`, `address`, `lat`, `lng`, `is_configured`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'central', '__CENTRAL__', 'Kho tổng Smart Logistics', '10.762622, 106.660172, TP. Hồ Chí Minh', 10.762622, 106.660172, 1, 1, '2026-10-10 03:11:11', '2026-10-10 03:11:11'),
(2, 'ward', 'Gò Vấp', 'Kho con Gò Vấp', 'Số 2 Nguyễn Văn Bảo, Phường 4, Gò Vấp, TP. Hồ Chí Minh', 10.8231, 106.6881, 1, 1, '2026-10-10 03:11:11', '2026-10-10 03:11:11'),
(3, 'ward', 'Quận 1', 'Kho con Quận 1', 'Số 15 Lê Duẩn, Bến Nghé, Quận 1, TP. Hồ Chí Minh', 10.7798, 106.699, 1, 1, '2026-10-10 03:11:11', '2026-10-10 03:11:11');

-- --------------------------------------------------------

--
-- Table structure for table `warehouse_bin_locations`
--

CREATE TABLE `warehouse_bin_locations` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `warehouse_id` int(11) NOT NULL,
  `bin_code` varchar(80) NOT NULL,
  `bin_name` varchar(120) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci AUTO_INCREMENT=2;

--
-- Dumping data for table `warehouse_bin_locations`
--

INSERT INTO `warehouse_bin_locations` (`id`, `warehouse_id`, `bin_code`, `bin_name`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 2, 'A1-01', '1', 1, '2026-10-10 03:43:27', '2026-10-10 03:43:27');

-- --------------------------------------------------------

--
-- Table structure for table `warehouse_inventory_audits`
--

CREATE TABLE `warehouse_inventory_audits` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `warehouse_id` int(11) NOT NULL,
  `created_by` int(11) NOT NULL,
  `status` enum('open','completed') NOT NULL DEFAULT 'open',
  `expected_count` int(11) NOT NULL DEFAULT 0,
  `scanned_count` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `completed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `warehouse_inventory_audit_items`
--

CREATE TABLE `warehouse_inventory_audit_items` (
  `audit_id` bigint(20) NOT NULL,
  `order_id` int(11) NOT NULL,
  `tracking_code` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `warehouse_inventory_audit_scans`
--

CREATE TABLE `warehouse_inventory_audit_scans` (
  `audit_id` bigint(20) NOT NULL,
  `scan_code` varchar(100) NOT NULL,
  `order_id` int(11) DEFAULT NULL,
  `scanned_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--

-- TiDB base table required by the project's migrations.
CREATE TABLE `driver_route_stops` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `driver_id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `task_type` enum('pickup','delivery','return') NOT NULL,
  `stop_order` int(11) NOT NULL,
  `lat` double NOT NULL,
  `lng` double NOT NULL,
  `address` text NOT NULL,
  `status` enum('planned','completed') NOT NULL DEFAULT 'planned',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_driver_route_stop` (`driver_id`,`task_type`,`order_id`),
  KEY `idx_driver_route_stop_order` (`driver_id`,`task_type`,`stop_order`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- Indexes for dumped tables
--

--
-- Indexes for table `attendance_records`
--
ALTER TABLE `attendance_records`
  ADD KEY `idx_attendance_user_date` (`user_id`,`work_date`),
  ADD KEY `idx_attendance_work_date` (`work_date`);

--
-- Indexes for table `chat_messages`
--
ALTER TABLE `chat_messages`
  ADD KEY `idx_chat_messages_session` (`session_id`,`id`);

--
-- Indexes for table `chat_sessions`
--
ALTER TABLE `chat_sessions`
  ADD KEY `idx_chat_sessions_queue` (`mode`,`status`,`updated_at`),
  ADD KEY `idx_chat_sessions_agent` (`assigned_agent_id`,`status`);

--
-- Indexes for table `cod_settlements`
--
ALTER TABLE `cod_settlements`
  ADD KEY `idx_cod_settlements_shop` (`shop_id`,`settled_at`);

--
-- Indexes for table `department_leaders`
--
ALTER TABLE `department_leaders`
  ADD PRIMARY KEY (`department`),
  ADD KEY `idx_department_leader_user` (`user_id`);

--
-- Indexes for table `department_reports`
--


--
-- Indexes for table `driver_cash_remittances`
--
ALTER TABLE `driver_cash_remittances`
  ADD KEY `idx_driver_cash_remittance` (`driver_id`,`status`,`created_at`);

--
-- Indexes for table `driver_dispatch_profiles`
--
ALTER TABLE `driver_dispatch_profiles`
  ADD PRIMARY KEY (`driver_id`);

--
-- Indexes for table `driver_expense_claims`
--
ALTER TABLE `driver_expense_claims`
  ADD KEY `idx_driver_expense_status` (`status`,`created_at`),
  ADD KEY `idx_driver_expense_owner` (`driver_id`,`created_at`);

--
-- Indexes for table `driver_incidents`
--
ALTER TABLE `driver_incidents`
  ADD KEY `idx_driver_incidents_status` (`status`,`created_at`);

--
-- Indexes for table `driver_positions`
--
ALTER TABLE `driver_positions`
  ADD KEY `idx_shipper_id` (`shipper_id`),
  ADD KEY `idx_order_id` (`order_id`);

--
-- Indexes for table `driver_routes`
--
ALTER TABLE `driver_routes`
  ADD UNIQUE KEY `order_id` (`order_id`),
  ADD KEY `idx_shipper_id` (`shipper_id`);

--
-- Indexes for table `driver_wallets`
--
ALTER TABLE `driver_wallets`
  ADD PRIMARY KEY (`driver_id`);

--
-- Indexes for table `driver_wallet_reservations`
--
ALTER TABLE `driver_wallet_reservations`
  ADD PRIMARY KEY (`order_id`),
  ADD KEY `idx_driver_wallet_reservation` (`driver_id`,`status`);

--
-- Indexes for table `driver_wallet_transactions`
--
ALTER TABLE `driver_wallet_transactions`
  ADD KEY `idx_driver_wallet_transactions` (`driver_id`,`created_at`),
  ADD KEY `idx_driver_wallet_order` (`order_id`);

--
-- Indexes for table `employee_payroll_adjustments`
--
ALTER TABLE `employee_payroll_adjustments`
  ADD KEY `idx_payroll_adjustment_user_month` (`user_id`,`payroll_month`);

--
-- Indexes for table `employee_salaries`
--
ALTER TABLE `employee_salaries`
  ADD PRIMARY KEY (`user_id`);

--
-- Indexes for table `job_applications`
--
ALTER TABLE `job_applications`
  ADD KEY `idx_job_applications_status` (`status`,`created_at`);

--
-- Indexes for table `leave_requests`
--


--
-- Indexes for table `linehaul_trips`
--
ALTER TABLE `linehaul_trips`
  ADD UNIQUE KEY `trip_code` (`trip_code`),
  ADD KEY `idx_linehaul_trip_status` (`status`,`created_at`);

--
-- Indexes for table `linehaul_trip_bags`
--
ALTER TABLE `linehaul_trip_bags`
  ADD PRIMARY KEY (`trip_id`,`bag_id`),
  ADD UNIQUE KEY `uq_linehaul_bag_trip` (`bag_id`);

--
-- Indexes for table `linehaul_trip_positions`
--
ALTER TABLE `linehaul_trip_positions`
  ADD PRIMARY KEY (`trip_id`),
  ADD KEY `idx_linehaul_position_driver` (`driver_id`);

--
-- Indexes for table `news_articles`
--
ALTER TABLE `news_articles`
  ADD UNIQUE KEY `slug` (`slug`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD KEY `idx_notifications_recipient` (`recipient_user_id`,`is_read`,`created_at`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD UNIQUE KEY `tracking_code` (`tracking_code`),
  ADD KEY `idx_shop_id` (`shop_id`),
  ADD KEY `idx_shipper_id` (`shipper_id`),
  ADD KEY `idx_pickup_shipper_id` (`pickup_shipper_id`),
  ADD KEY `idx_central_transfer_shipper_id` (`central_transfer_shipper_id`),
  ADD KEY `idx_destination_transfer_shipper_id` (`destination_transfer_shipper_id`),
  ADD KEY `idx_delivery_shipper_id` (`delivery_shipper_id`),
  ADD KEY `idx_origin_warehouse_id` (`origin_warehouse_id`),
  ADD KEY `idx_destination_warehouse_id` (`destination_warehouse_id`),
  ADD KEY `idx_current_warehouse_id` (`current_warehouse_id`),
  ADD KEY `idx_status` (`status`);

--
-- Indexes for table `order_status_history`
--
ALTER TABLE `order_status_history`
  ADD KEY `idx_order_status_history_order` (`order_id`,`created_at`);

--
-- Indexes for table `service_requests`
--
ALTER TABLE `service_requests`
  ADD KEY `idx_service_requests_status` (`status`,`created_at`);

--
-- Indexes for table `shipment_bags`
--
ALTER TABLE `shipment_bags`
  ADD UNIQUE KEY `bag_code` (`bag_code`),
  ADD KEY `idx_shipment_bags_route` (`source_warehouse_id`,`destination_warehouse_id`,`status`);

--
-- Indexes for table `shipment_bag_orders`
--
ALTER TABLE `shipment_bag_orders`
  ADD PRIMARY KEY (`bag_id`,`order_id`),
  ADD KEY `idx_shipment_bag_orders_order` (`order_id`);

--
-- Indexes for table `shop_api_keys`
--
ALTER TABLE `shop_api_keys`
  ADD UNIQUE KEY `key_hash` (`key_hash`),
  ADD KEY `idx_shop_api_keys_owner` (`shop_id`,`revoked_at`,`created_at`);

--
-- Indexes for table `shop_redelivery_requests`
--
ALTER TABLE `shop_redelivery_requests`
  ADD PRIMARY KEY (`order_id`),
  ADD KEY `idx_redelivery_shop_status` (`shop_id`,`status`,`requested_at`);

--
-- Indexes for table `shop_webhook_configs`
--
ALTER TABLE `shop_webhook_configs`
  ADD PRIMARY KEY (`shop_id`);

--
-- Indexes for table `trucks`
--
ALTER TABLE `trucks`
  ADD UNIQUE KEY `vehicle_plate` (`vehicle_plate`),
  ADD KEY `idx_trucks_status` (`status`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `warehouses`
--
ALTER TABLE `warehouses`
  ADD UNIQUE KEY `uq_warehouse_ward` (`ward_name`),
  ADD KEY `idx_warehouse_type_active` (`warehouse_type`,`is_active`);

--
-- Indexes for table `warehouse_bin_locations`
--
ALTER TABLE `warehouse_bin_locations`
  ADD UNIQUE KEY `uq_warehouse_bin_code` (`warehouse_id`,`bin_code`),
  ADD KEY `idx_warehouse_bin_active` (`warehouse_id`,`is_active`);

--
-- Indexes for table `warehouse_inventory_audits`
--
ALTER TABLE `warehouse_inventory_audits`
  ADD KEY `idx_inventory_audit_warehouse` (`warehouse_id`,`status`,`created_at`);

--
-- Indexes for table `warehouse_inventory_audit_items`
--
ALTER TABLE `warehouse_inventory_audit_items`
  ADD PRIMARY KEY (`audit_id`,`order_id`),
  ADD UNIQUE KEY `uq_inventory_audit_code` (`audit_id`,`tracking_code`);

--
-- Indexes for table `warehouse_inventory_audit_scans`
--
ALTER TABLE `warehouse_inventory_audit_scans`
  ADD PRIMARY KEY (`audit_id`,`scan_code`),
  ADD KEY `idx_inventory_audit_scan_order` (`audit_id`,`order_id`);

--
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
