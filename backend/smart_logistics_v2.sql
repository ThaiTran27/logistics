-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 01, 2026 at 03:08 PM
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
  `id` bigint(20) NOT NULL,
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
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `attendance_records`
--

INSERT INTO `attendance_records` (`id`, `user_id`, `work_date`, `check_in`, `check_in_photo`, `check_in_lat`, `check_in_lng`, `check_out`, `check_out_photo`, `check_out_lat`, `check_out_lng`, `created_at`) VALUES
(1, 1, '2026-10-19', '2026-10-19 08:00:00', NULL, NULL, NULL, '2026-10-19 12:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(2, 2, '2026-10-19', '2026-10-19 08:00:00', NULL, NULL, NULL, '2026-10-19 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(3, 3, '2026-10-19', '2026-10-19 08:00:00', NULL, NULL, NULL, '2026-10-19 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(4, 4, '2026-10-19', '2026-10-19 08:00:00', NULL, NULL, NULL, '2026-10-19 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(5, 5, '2026-10-19', '2026-10-19 08:00:00', NULL, NULL, NULL, '2026-10-19 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(6, 6, '2026-10-19', '2026-10-19 08:00:00', NULL, NULL, NULL, '2026-10-19 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(7, 7, '2026-10-19', '2026-10-19 08:00:00', NULL, NULL, NULL, '2026-10-19 12:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(8, 8, '2026-10-19', '2026-10-19 08:00:00', NULL, NULL, NULL, '2026-10-19 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(9, 9, '2026-10-19', '2026-10-19 08:00:00', NULL, NULL, NULL, '2026-10-19 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(10, 10, '2026-10-19', '2026-10-19 08:00:00', NULL, NULL, NULL, '2026-10-19 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(11, 11, '2026-10-19', '2026-10-19 08:00:00', NULL, NULL, NULL, '2026-10-19 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(12, 12, '2026-10-19', '2026-10-19 08:00:00', NULL, NULL, NULL, '2026-10-19 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(13, 13, '2026-10-19', '2026-10-19 08:00:00', NULL, NULL, NULL, '2026-10-19 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(14, 14, '2026-10-19', '2026-10-19 08:00:00', NULL, NULL, NULL, '2026-10-19 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(15, 15, '2026-10-19', '2026-10-19 08:00:00', NULL, NULL, NULL, '2026-10-19 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(16, 16, '2026-10-19', '2026-10-19 08:00:00', NULL, NULL, NULL, '2026-10-19 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(17, 17, '2026-10-19', '2026-10-19 08:00:00', NULL, NULL, NULL, '2026-10-19 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(18, 18, '2026-10-19', '2026-10-19 08:00:00', NULL, NULL, NULL, '2026-10-19 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(19, 19, '2026-10-19', '2026-10-19 08:00:00', NULL, NULL, NULL, '2026-10-19 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(32, 1, '2026-10-19', '2026-10-19 13:00:00', NULL, NULL, NULL, '2026-10-19 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(33, 7, '2026-10-19', '2026-10-19 13:00:00', NULL, NULL, NULL, '2026-10-19 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(35, 1, '2026-10-18', '2026-10-18 08:00:00', NULL, NULL, NULL, '2026-10-18 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(36, 2, '2026-10-18', '2026-10-18 08:00:00', NULL, NULL, NULL, '2026-10-18 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(37, 3, '2026-10-18', '2026-10-18 08:00:00', NULL, NULL, NULL, '2026-10-18 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(38, 4, '2026-10-18', '2026-10-18 08:00:00', NULL, NULL, NULL, '2026-10-18 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(39, 5, '2026-10-18', '2026-10-18 08:00:00', NULL, NULL, NULL, '2026-10-18 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(40, 6, '2026-10-18', '2026-10-18 08:00:00', NULL, NULL, NULL, '2026-10-18 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(41, 7, '2026-10-18', '2026-10-18 08:00:00', NULL, NULL, NULL, '2026-10-18 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(42, 8, '2026-10-18', '2026-10-18 08:00:00', NULL, NULL, NULL, '2026-10-18 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(43, 9, '2026-10-18', '2026-10-18 08:00:00', NULL, NULL, NULL, '2026-10-18 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(44, 10, '2026-10-18', '2026-10-18 08:00:00', NULL, NULL, NULL, '2026-10-18 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(45, 11, '2026-10-18', '2026-10-18 08:00:00', NULL, NULL, NULL, '2026-10-18 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(46, 12, '2026-10-18', '2026-10-18 08:00:00', NULL, NULL, NULL, '2026-10-18 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(47, 13, '2026-10-18', '2026-10-18 08:00:00', NULL, NULL, NULL, '2026-10-18 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(48, 14, '2026-10-18', '2026-10-18 08:00:00', NULL, NULL, NULL, '2026-10-18 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(49, 15, '2026-10-18', '2026-10-18 08:00:00', NULL, NULL, NULL, '2026-10-18 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(50, 16, '2026-10-18', '2026-10-18 08:00:00', NULL, NULL, NULL, '2026-10-18 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(51, 17, '2026-10-18', '2026-10-18 08:00:00', NULL, NULL, NULL, '2026-10-18 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(52, 18, '2026-10-18', '2026-10-18 08:00:00', NULL, NULL, NULL, '2026-10-18 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34'),
(53, 19, '2026-10-18', '2026-10-18 08:00:00', NULL, NULL, NULL, '2026-10-18 17:00:00', NULL, NULL, NULL, '2026-10-20 05:15:34');

-- --------------------------------------------------------

--
-- Table structure for table `audit_logs`
--

CREATE TABLE `audit_logs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `actor_id` int(11) DEFAULT NULL,
  `actor_role` varchar(50) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `entity_type` varchar(100) NOT NULL,
  `entity_id` varchar(100) DEFAULT NULL,
  `old_value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_value`)),
  `new_value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_value`)),
  `ip` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `audit_logs`
--

INSERT INTO `audit_logs` (`id`, `actor_id`, `actor_role`, `action`, `entity_type`, `entity_id`, `old_value`, `new_value`, `ip`, `created_at`) VALUES
(1, 3, 'fleet_manager', 'driver.dispatch_profile.updated', 'driver_dispatch_profile', '10', '{\"max_active_orders\":10,\"max_payload_kg\":100,\"max_order_value\":\"0\",\"service_areas\":\"\"}', '{\"max_active_orders\":10,\"max_payload_kg\":100,\"max_order_value\":\"0\",\"service_areas\":\"Thông Tây Hội, Gò Vấp\"}', '::1', '2026-10-21 04:01:07'),
(2, 3, 'fleet_manager', 'driver.dispatch_profile.updated', 'driver_dispatch_profile', '10', '{\"max_active_orders\":10,\"max_payload_kg\":100,\"max_order_value\":0,\"service_areas\":\"Thông Tây Hội, Gò Vấp\"}', '{\"max_active_orders\":10,\"max_payload_kg\":100,\"max_order_value\":\"0\",\"service_areas\":\"\"}', '::1', '2026-10-21 04:01:17'),
(3, NULL, 'shop', 'shop.self_register', 'user', '20', NULL, '{\"role\":\"shop\"}', '::1', '2026-10-21 10:26:36'),
(4, 4, 'accountant', 'driver_wallet.deposit', 'driver_wallet', '11', '{\"balance\":\"0\",\"reserved_balance\":\"0\"}', '{\"balance\":\"1000000\",\"reserved_balance\":\"0\",\"amount\":\"1000000\",\"note\":null}', '::1', '2026-10-21 10:56:07'),
(5, 3, 'fleet_manager', 'driver_wallet.reserve', 'driver_wallet_reservation', '19', '{\"status\":null}', '{\"driver_id\":11,\"amount\":\"530000\",\"status\":\"reserved\"}', '::1', '2026-10-21 10:59:19'),
(6, 3, 'fleet_manager', 'driver_wallet.reserve', 'driver_wallet_reservation', '18', '{\"status\":null}', '{\"driver_id\":11,\"amount\":\"300000\",\"status\":\"reserved\"}', '::1', '2026-10-21 10:59:22'),
(7, NULL, 'guest', 'chat.session.create_after_existing', 'chat_session', '3', '{\"previous_session_id\":2,\"previous_status\":\"active\"}', '{\"session_id\":3,\"order_id\":18,\"driver_id\":11}', '::1', '2026-10-21 11:06:52'),
(8, NULL, 'shop', 'shop.self_register', 'user', '21', NULL, '{\"role\":\"shop\"}', '::1', '2026-10-24 11:40:43'),
(9, NULL, 'anonymous', 'auth.login.locked', 'login_lockout', 'e86bb0056eb2551cf43865ff2181cd7a830b4cbb242da4c20d2b3ffe6ba4eb5e', NULL, '{\"scopes\":[\"ip\",\"account\"],\"max_failed_attempts\":5,\"window_minutes\":15}', '::1', '2026-10-24 11:59:11'),
(10, 4, 'accountant', 'driver_wallet.deposit', 'driver_wallet', '10', '{\"balance\":\"0\",\"reserved_balance\":\"0\"}', '{\"balance\":\"1000000\",\"reserved_balance\":\"0\",\"amount\":\"1000000\",\"note\":null}', '::1', '2026-10-24 12:31:24'),
(11, 4, 'accountant', 'driver_wallet.deposit', 'driver_wallet', '11', '{\"balance\":\"1000000\",\"reserved_balance\":\"830000\"}', '{\"balance\":\"2000000\",\"reserved_balance\":\"830000\",\"amount\":\"1000000\",\"note\":null}', '::1', '2026-10-24 12:31:37'),
(12, 5, 'warehouse_manager', 'driver_wallet.reserve', 'driver_wallet_reservation', '20', '{\"status\":null}', '{\"driver_id\":11,\"amount\":\"540000\",\"status\":\"reserved\"}', '::1', '2026-10-24 12:31:49'),
(13, 11, 'delivery_driver', 'driver_cash_remittance.create', 'driver_cash_remittance', '1', '{\"order_ids\":[20],\"cod_remittance_id\":null}', '{\"driver_id\":11,\"work_date\":\"2026-10-24\",\"order_ids\":[20],\"expected_amount\":\"540000\",\"actual_amount\":\"540000\",\"variance_amount\":\"0\",\"variance_reason\":null,\"status\":\"pending\"}', '::1', '2026-10-24 12:38:54'),
(14, 4, 'accountant', 'driver_wallet_reservation.release', 'driver_wallet_reservation', '20', '{\"status\":\"reserved\",\"reserved_balance\":\"1370000\"}', '{\"status\":\"released\",\"reserved_balance\":\"830000\"}', '::1', '2026-10-24 12:40:36'),
(15, 4, 'accountant', 'driver_cash_remittance.receive', 'driver_cash_remittance', '1', '{\"status\":\"pending\",\"received_by\":null}', '{\"status\":\"received\",\"received_by\":4,\"order_ids\":[20]}', '::1', '2026-10-24 12:40:36'),
(16, 4, 'accountant', 'driver_wallet.deposit', 'driver_wallet', '10', '{\"balance\":\"1000000\",\"reserved_balance\":\"0\"}', '{\"balance\":\"1200000\",\"reserved_balance\":\"0\",\"amount\":\"200000\",\"note\":null}', '::1', '2026-10-25 07:01:12'),
(17, 4, 'accountant', 'driver_wallet.deposit', 'driver_wallet', '11', '{\"balance\":\"2000000\",\"reserved_balance\":\"830000\"}', '{\"balance\":\"4000000\",\"reserved_balance\":\"830000\",\"amount\":\"2000000\",\"note\":null}', '::1', '2026-10-25 07:01:16'),
(18, 4, 'accountant', 'driver_wallet.deposit', 'driver_wallet', '10', '{\"balance\":\"1200000\",\"reserved_balance\":\"0\"}', '{\"balance\":\"3200000\",\"reserved_balance\":\"0\",\"amount\":\"2000000\",\"note\":null}', '::1', '2026-10-25 07:01:45'),
(19, 5, 'warehouse_manager', 'driver_wallet.reserve', 'driver_wallet_reservation', '21', '{\"status\":null}', '{\"driver_id\":10,\"amount\":\"700000\",\"status\":\"reserved\"}', '::1', '2026-10-25 07:24:11'),
(20, 4, 'accountant', 'driver_wallet.deposit', 'driver_wallet', '10', '{\"balance\":\"3200000\",\"reserved_balance\":\"700000\"}', '{\"balance\":\"5200000\",\"reserved_balance\":\"700000\",\"amount\":\"2000000\",\"note\":null}', '::1', '2026-10-25 07:25:36'),
(21, NULL, 'guest', 'chat.session.create_after_existing', 'chat_session', '6', '{\"previous_session_id\":5,\"previous_status\":\"active\"}', '{\"session_id\":6,\"order_id\":21,\"driver_id\":10}', '::1', '2026-10-25 07:30:04'),
(22, 10, 'delivery_driver', 'driver_cash_remittance.create', 'driver_cash_remittance', '2', '{\"order_ids\":[21],\"cod_remittance_id\":null}', '{\"driver_id\":10,\"work_date\":\"2026-10-25\",\"order_ids\":[21],\"expected_amount\":\"700000\",\"actual_amount\":\"700000\",\"variance_amount\":\"0\",\"variance_reason\":null,\"status\":\"pending\"}', '::1', '2026-10-25 07:46:31');

-- --------------------------------------------------------

--
-- Table structure for table `chat_messages`
--

CREATE TABLE `chat_messages` (
  `id` bigint(20) NOT NULL,
  `session_id` bigint(20) NOT NULL,
  `sender_type` enum('customer','agent','driver','bot') NOT NULL,
  `sender_id` int(11) DEFAULT NULL,
  `message` text NOT NULL,
  `image_url` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `chat_messages`
--

INSERT INTO `chat_messages` (`id`, `session_id`, `sender_type`, `sender_id`, `message`, `image_url`, `created_at`) VALUES
(1, 1, 'driver', 11, 'xin chào', NULL, '2026-10-21 11:01:53'),
(2, 1, 'driver', 11, 'Chào bạn', NULL, '2026-10-21 11:07:11'),
(3, 3, 'customer', NULL, 'lô', NULL, '2026-10-21 11:07:22'),
(4, 3, 'driver', 11, 'Chào bạn chờ nhé', NULL, '2026-10-21 11:07:46'),
(5, 3, 'customer', NULL, 'ok', NULL, '2026-10-21 11:07:57'),
(6, 6, 'driver', 10, 'xin chào', NULL, '2026-10-25 07:30:28'),
(7, 6, 'customer', NULL, 'hi', NULL, '2026-10-25 07:30:43'),
(8, 6, 'driver', 10, 'chào', NULL, '2026-10-25 07:32:24'),
(9, 6, 'customer', NULL, 'chào', NULL, '2026-10-25 07:32:32');

-- --------------------------------------------------------

--
-- Table structure for table `chat_sessions`
--

CREATE TABLE `chat_sessions` (
  `id` bigint(20) NOT NULL,
  `mode` enum('ai','live') NOT NULL,
  `customer_user_id` int(11) DEFAULT NULL,
  `order_id` int(11) DEFAULT NULL,
  `driver_id` int(11) DEFAULT NULL,
  `customer_name` varchar(255) NOT NULL,
  `customer_phone` varchar(50) DEFAULT NULL,
  `guest_token_hash` char(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `status` enum('waiting','active','closed') NOT NULL DEFAULT 'waiting',
  `assigned_agent_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `chat_sessions`
--

INSERT INTO `chat_sessions` (`id`, `mode`, `customer_user_id`, `order_id`, `driver_id`, `customer_name`, `customer_phone`, `guest_token_hash`, `expires_at`, `status`, `assigned_agent_id`, `created_at`, `updated_at`) VALUES
(1, 'live', NULL, 18, 11, 'Nguyễn Quốc Thịnh', '0901857203', '17aaa6c7a8706e07bd417a81e542d49116e4f8cb4da6e415b281e0501b8be23a', '2026-10-22 18:01:39', 'active', NULL, '2026-10-21 11:01:39', '2026-10-21 11:07:11'),
(2, 'live', NULL, 18, 11, 'Nguyễn Quốc Thịnh', '0901857203', '3477ba53b5dc57bed4159b0a2e3806da9f8d4d29d6d52729048e6e29ad6d5343', '2026-10-22 18:01:39', 'active', NULL, '2026-10-21 11:01:39', '2026-10-21 11:01:39'),
(3, 'live', NULL, 18, 11, 'Nguyễn Quốc Thịnh', '0901857203', 'ad3c7f8b7167f5f5ddebce48ddd423bb5bb5a30a58bf8ac58e390e1192542552', '2026-10-22 18:06:52', 'active', NULL, '2026-10-21 11:06:52', '2026-10-21 11:07:57'),
(4, 'live', NULL, 21, 10, 'Nguyễn Trọng Phúc', '0912345678', 'f30f8197a8e7c884ee41a3b1c097486766f6faeb985ee51401d87a0975278b56', '2026-10-26 14:28:10', 'active', NULL, '2026-10-25 07:28:10', '2026-10-25 07:28:10'),
(5, 'live', NULL, 21, 10, 'Nguyễn Trọng Phúc', '0912345678', 'dd7c60cca1dd6d7eccb77c742ccf723fd2510ee24df1b429d8613bcfb5ae0403', '2026-10-26 14:28:10', 'active', NULL, '2026-10-25 07:28:10', '2026-10-25 07:28:10'),
(6, 'live', NULL, 21, 10, 'Nguyễn Trọng Phúc', '0912345678', '1703b8834084b05e378f23e26019cf101eda9bc1fa96f748d9cf0327b4c317ea', '2026-10-26 14:30:04', 'active', NULL, '2026-10-25 07:30:04', '2026-10-25 07:32:32');

-- --------------------------------------------------------

--
-- Table structure for table `cod_financial_004_setting_backup`
--

CREATE TABLE `cod_financial_004_setting_backup` (
  `setting_key` varchar(100) NOT NULL,
  `setting_value` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cod_settlements`
--

CREATE TABLE `cod_settlements` (
  `id` bigint(20) NOT NULL,
  `shop_id` int(11) NOT NULL,
  `total_cod` decimal(15,0) NOT NULL DEFAULT 0,
  `total_shipping_fee` decimal(15,0) NOT NULL DEFAULT 0,
  `total_service_fee` decimal(15,0) NOT NULL DEFAULT 0,
  `total_insurance_fee` decimal(15,0) NOT NULL DEFAULT 0,
  `total_paid` decimal(15,0) NOT NULL DEFAULT 0,
  `order_count` int(11) NOT NULL DEFAULT 0,
  `payment_method` enum('bank_transfer','cash') NOT NULL DEFAULT 'bank_transfer',
  `payment_reference` varchar(100) DEFAULT NULL,
  `paid_by` int(11) DEFAULT NULL,
  `settled_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `total_failure_fee` decimal(15,0) NOT NULL DEFAULT 0,
  `cycle_code` varchar(10) NOT NULL DEFAULT 'T+1',
  `period_start` date DEFAULT NULL,
  `period_end` date DEFAULT NULL,
  `transfer_file_reference` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
('Phòng Kho', 5, '2026-10-20 05:15:34'),
('Phòng Nhân Sự', 2, '2026-10-20 05:15:34'),
('Phòng Nội Dung', 8, '2026-10-20 05:15:34'),
('Phòng Tài Chính', 4, '2026-10-20 05:15:34'),
('Phòng Điều Phối', 3, '2026-10-20 05:15:34');

-- --------------------------------------------------------

--
-- Table structure for table `department_reports`
--

CREATE TABLE `department_reports` (
  `id` int(11) NOT NULL,
  `created_by` int(11) NOT NULL,
  `department` varchar(255) NOT NULL,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `attachment_url` varchar(255) DEFAULT NULL,
  `status` varchar(30) DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `department_reports`
--

INSERT INTO `department_reports` (`id`, `created_by`, `department`, `title`, `content`, `attachment_url`, `status`, `created_at`) VALUES
(1, 1, 'Phòng Điều Phối', 'Báo cáo hoạt động tuần', 'Tuần này có 18 đơn hàng mới, trong đó 3 đơn chậm do thời tiết.', NULL, 'pending', '2026-10-20 05:15:34'),
(2, 3, 'Phòng Điều Phối', 'Báo cáo điều phối tuần mẫu', 'Đã xử lý 42 đơn hàng; 38 đơn giao thành công, 4 đơn đang chờ xác nhận. Hai tài xế hoàn thành tuyến đúng kế hoạch.', NULL, 'pending', '2026-10-20 05:15:34'),
(3, 2, 'Phòng Nhân Sự', 'Tổng hợp chấm công tháng mẫu', 'Tỷ lệ đi làm đúng giờ đạt 96%. Đã ghi nhận hai ca trong ngày cho giám đốc và tài xế để kiểm tra quy trình chấm công nhiều ca.', NULL, 'approved', '2026-10-20 05:15:34'),
(4, 5, 'Phòng Kho', 'Đề xuất kiểm kê kho mẫu', 'Đề xuất kiểm kê bổ sung nhóm hàng tồn quá 30 ngày và đối chiếu số liệu trước khi chốt báo cáo tuần.', NULL, 'rejected', '2026-10-20 05:15:34');

-- --------------------------------------------------------

--
-- Table structure for table `driver_cash_remittances`
--

CREATE TABLE `driver_cash_remittances` (
  `id` bigint(20) NOT NULL,
  `driver_id` int(11) NOT NULL,
  `amount` decimal(15,0) NOT NULL,
  `status` enum('pending','received') NOT NULL DEFAULT 'pending',
  `received_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `received_at` datetime DEFAULT NULL,
  `work_date` date NOT NULL,
  `expected_amount` decimal(15,0) NOT NULL DEFAULT 0,
  `variance_amount` decimal(15,0) NOT NULL DEFAULT 0,
  `variance_reason` varchar(500) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `driver_cash_remittances`
--

INSERT INTO `driver_cash_remittances` (`id`, `driver_id`, `amount`, `status`, `received_by`, `created_at`, `received_at`, `work_date`, `expected_amount`, `variance_amount`, `variance_reason`, `created_by`) VALUES
(1, 11, 540000, 'received', 4, '2026-10-24 12:38:54', '2026-10-24 19:40:36', '2026-10-24', 540000, 0, NULL, 11),
(2, 10, 700000, 'pending', NULL, '2026-10-25 07:46:31', NULL, '2026-10-25', 700000, 0, NULL, 10);

-- --------------------------------------------------------

--
-- Table structure for table `driver_dispatch_profiles`
--

CREATE TABLE `driver_dispatch_profiles` (
  `driver_id` int(11) NOT NULL,
  `max_active_orders` int(11) NOT NULL DEFAULT 10,
  `max_payload_kg` decimal(10,2) NOT NULL DEFAULT 100.00,
  `max_order_value` decimal(15,0) NOT NULL DEFAULT 0,
  `service_areas` text NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `driver_dispatch_profiles`
--

INSERT INTO `driver_dispatch_profiles` (`driver_id`, `max_active_orders`, `max_payload_kg`, `max_order_value`, `service_areas`, `updated_at`) VALUES
(10, 10, 100.00, 0, '', '2026-10-21 04:01:17');

-- --------------------------------------------------------

--
-- Table structure for table `driver_expense_claims`
--

CREATE TABLE `driver_expense_claims` (
  `id` bigint(20) NOT NULL,
  `driver_id` int(11) NOT NULL,
  `expense_type` enum('toll','parking','fuel','other') NOT NULL,
  `amount` decimal(15,0) NOT NULL,
  `note` varchar(500) NOT NULL,
  `receipt_image` varchar(255) NOT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `reviewed_by` int(11) DEFAULT NULL,
  `review_note` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `reviewed_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `driver_expense_claims`
--

INSERT INTO `driver_expense_claims` (`id`, `driver_id`, `expense_type`, `amount`, `note`, `receipt_image`, `status`, `reviewed_by`, `review_note`, `created_at`, `reviewed_at`) VALUES
(1, 11, 'parking', 7000, 'Phí gửi giữ xe', '/uploads/pod-1792634067870-43ace58c52a2e2d0.png', 'pending', NULL, NULL, '2026-10-22 01:54:28', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `driver_incidents`
--

CREATE TABLE `driver_incidents` (
  `id` bigint(20) NOT NULL,
  `driver_id` int(11) DEFAULT NULL,
  `order_id` int(11) DEFAULT NULL,
  `incident_type` enum('accident','vehicle_breakdown','traffic','wrong_item','customer_absent','damaged_goods','lost_goods','other') NOT NULL,
  `description` text NOT NULL,
  `evidence_url` varchar(255) DEFAULT NULL,
  `claim_amount` decimal(15,0) NOT NULL DEFAULT 0,
  `lat` double DEFAULT NULL,
  `lng` double DEFAULT NULL,
  `status` enum('open','acknowledged','resolved') NOT NULL DEFAULT 'open',
  `reviewed_by` int(11) DEFAULT NULL,
  `review_note` varchar(500) DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `reported_by` int(11) DEFAULT NULL,
  `reason_code` varchar(50) DEFAULT NULL,
  `fault_party` enum('customer','shop','driver','company','force_majeure') NOT NULL DEFAULT 'company',
  `customer_compensation_amount` decimal(15,0) NOT NULL DEFAULT 0,
  `shop_compensation_amount` decimal(15,0) NOT NULL DEFAULT 0,
  `driver_deduction_amount` decimal(15,0) NOT NULL DEFAULT 0,
  `salary_penalty_amount` decimal(15,0) NOT NULL DEFAULT 0,
  `declared_value` decimal(15,0) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `driver_positions`
--

CREATE TABLE `driver_positions` (
  `id` int(11) NOT NULL,
  `order_id` int(11) DEFAULT NULL,
  `shipper_id` int(11) NOT NULL,
  `lat` double NOT NULL,
  `lng` double NOT NULL,
  `route_status` varchar(50) DEFAULT 'moving',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `driver_routes`
--

CREATE TABLE `driver_routes` (
  `id` int(11) NOT NULL,
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
  `total_distance_m` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `total_duration_s` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `is_estimated` tinyint(1) NOT NULL DEFAULT 1,
  `optimized_at` datetime DEFAULT NULL,
  `mode` enum('pickup','delivery') NOT NULL DEFAULT 'delivery'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `driver_routes`
--

INSERT INTO `driver_routes` (`id`, `order_id`, `shipper_id`, `warehouse_lat`, `warehouse_lng`, `pickup_lat`, `pickup_lng`, `delivery_lat`, `delivery_lng`, `route_status`, `created_at`, `total_distance_m`, `total_duration_s`, `is_estimated`, `optimized_at`, `mode`) VALUES
(5, 19, 11, 10.8231, 106.6881, 10.844544716289441, 106.63749934956395, 10.821920205215696, 106.68623173789061, 'delivery', '2026-10-21 10:31:59', 612, 83, 0, '2026-10-22 08:44:28', 'delivery'),
(6, 18, 11, 10.8231, 106.6881, 10.832302564714512, 106.66731165730474, 10.81722752096813, 106.6838286464891, 'delivery', '2026-10-21 10:31:59', 2293, 255, 0, '2026-10-21 18:12:38', 'delivery'),
(9, 21, 10, 10.8231, 106.6881, 10.846352316508511, 106.65761084279973, 10.827938770470546, 106.67527899997424, 'delivery', '2026-10-24 12:12:19', 1675, 123, 0, '2026-10-25 14:33:54', 'delivery'),
(10, 20, 11, 10.8231, 106.6881, 10.846352316508511, 106.65761084279973, 10.825442546751006, 106.69632920954423, 'delivery', '2026-10-24 12:12:21', 1602, 180, 0, '2026-10-24 19:35:15', 'delivery'),
(12, 23, 7, 10.8231, 106.6881, 10.846352316508511, 106.65761084279973, 10.82013585450258, 106.68395561385009, 'pickup', '2026-10-25 07:17:46', 9778, 663, 0, '2026-10-25 14:17:52', 'pickup'),
(13, 22, 7, 10.8231, 106.6881, 10.846352316508511, 106.65761084279973, 10.819208189353622, 106.68451524723001, 'pickup', '2026-10-25 07:17:52', 9778, 663, 0, '2026-10-25 14:17:52', 'pickup');

-- --------------------------------------------------------

--
-- Table structure for table `driver_route_optimization_history`
--

CREATE TABLE `driver_route_optimization_history` (
  `id` bigint(20) NOT NULL,
  `driver_id` int(11) NOT NULL,
  `mode` enum('pickup','delivery') NOT NULL,
  `actor_id` int(11) DEFAULT NULL,
  `actor_role` varchar(50) NOT NULL DEFAULT 'system',
  `reason` enum('new_order','cancelled','failed','reassigned','off_route','manual','stop_completed','initial') NOT NULL,
  `is_estimated` tinyint(1) NOT NULL DEFAULT 0,
  `total_distance_m` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `total_duration_s` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `route_snapshot` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`route_snapshot`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `driver_route_optimization_history`
--

INSERT INTO `driver_route_optimization_history` (`id`, `driver_id`, `mode`, `actor_id`, `actor_role`, `reason`, `is_estimated`, `total_distance_m`, `total_duration_s`, `route_snapshot`, `created_at`) VALUES
(1, 9, 'pickup', NULL, 'system', 'new_order', 0, 12956, 855, '[{\"sequence\":1,\"order_ids\":[19],\"address\":\"Hẻm 965/27 Quang Trung, Phường An Hội Tây, TP. Hồ Chí Minh\",\"ranking_reason\":\"Khung 17:00-17:30, hạn SLA 19:29, cách 6.6 km\",\"eta\":\"2026-10-21T10:39:31.622Z\",\"distance_from_previous_m\":6617}]', '2026-10-21 10:31:59'),
(2, 9, 'pickup', NULL, 'system', 'new_order', 0, 13486, 911, '[{\"sequence\":1,\"order_ids\":[18],\"address\":\"Hẻm 499 Quang Trung, Phường Gò Vấp, Gò Vấp, TP. Hồ Chí Minh\",\"ranking_reason\":\"Khung 17:00-17:30, hạn SLA 19:24, cách 3.0 km\",\"eta\":\"2026-10-21T10:35:19.018Z\",\"distance_from_previous_m\":3019},{\"sequence\":2,\"order_ids\":[19],\"address\":\"Hẻm 965/27 Quang Trung, Phường An Hội Tây, TP. Hồ Chí Minh\",\"ranking_reason\":\"Khung 17:00-17:30, hạn SLA 19:29, cách 4.1 km\",\"eta\":\"2026-10-21T10:40:28.318Z\",\"distance_from_previous_m\":4129}]', '2026-10-21 10:31:59'),
(3, 9, 'pickup', 3, 'fleet_manager', 'manual', 0, 13486, 911, '[{\"sequence\":1,\"order_ids\":[18],\"address\":\"Hẻm 499 Quang Trung, Phường Gò Vấp, Gò Vấp, TP. Hồ Chí Minh\",\"ranking_reason\":\"Khung 17:00-17:30, hạn SLA 19:24, cách 3.0 km\",\"eta\":\"2026-10-21T10:38:41.144Z\",\"distance_from_previous_m\":3019},{\"sequence\":2,\"order_ids\":[19],\"address\":\"Hẻm 965/27 Quang Trung, Phường An Hội Tây, TP. Hồ Chí Minh\",\"ranking_reason\":\"Khung 17:00-17:30, hạn SLA 19:29, cách 4.1 km\",\"eta\":\"2026-10-21T10:43:50.444Z\",\"distance_from_previous_m\":4129}]', '2026-10-21 10:35:22'),
(4, 9, 'pickup', 9, 'pickup_driver', 'stop_completed', 0, 12956, 855, '[{\"sequence\":1,\"order_ids\":[19],\"address\":\"Hẻm 965/27 Quang Trung, Phường An Hội Tây, TP. Hồ Chí Minh\",\"ranking_reason\":\"Khung 17:00-17:30, hạn SLA 19:29, cách 6.6 km\",\"eta\":\"2026-10-21T10:44:19.319Z\",\"distance_from_previous_m\":6617}]', '2026-10-21 10:36:47'),
(5, 9, 'pickup', 9, 'pickup_driver', 'stop_completed', 0, 0, 0, '[]', '2026-10-21 10:37:43'),
(6, 11, 'delivery', NULL, 'system', 'new_order', 0, 612, 83, '[{\"sequence\":1,\"order_ids\":[19],\"address\":\"Hẻm 300/21 Nguyễn Thái Sơn, Phường Hạnh Thông, TP. Hồ Chí Minh\",\"ranking_reason\":null,\"eta\":\"2026-10-21T11:00:42.966Z\",\"distance_from_previous_m\":612}]', '2026-10-21 10:59:20'),
(7, 11, 'delivery', NULL, 'system', 'new_order', 0, 2293, 255, '[{\"sequence\":1,\"order_ids\":[18],\"address\":\"Hẻm 166/5 Lê Lợi, Phường Hạnh Thông, TP. Hồ Chí Minh\",\"ranking_reason\":null,\"eta\":\"2026-10-21T11:01:27.175Z\",\"distance_from_previous_m\":1360},{\"sequence\":2,\"order_ids\":[19],\"address\":\"Hẻm 300/21 Nguyễn Thái Sơn, Phường Hạnh Thông, TP. Hồ Chí Minh\",\"ranking_reason\":null,\"eta\":\"2026-10-21T11:03:37.975Z\",\"distance_from_previous_m\":933}]', '2026-10-21 10:59:22'),
(8, 11, 'delivery', 11, 'delivery_driver', 'stop_completed', 0, 2293, 255, '[{\"sequence\":1,\"order_ids\":[18],\"address\":\"Hẻm 166/5 Lê Lợi, Phường Hạnh Thông, TP. Hồ Chí Minh\",\"ranking_reason\":null,\"eta\":\"2026-10-21T11:10:24.652Z\",\"distance_from_previous_m\":1360},{\"sequence\":2,\"order_ids\":[19],\"address\":\"Hẻm 300/21 Nguyễn Thái Sơn, Phường Hạnh Thông, TP. Hồ Chí Minh\",\"ranking_reason\":null,\"eta\":\"2026-10-21T11:12:35.452Z\",\"distance_from_previous_m\":933}]', '2026-10-21 11:08:20'),
(9, 11, 'delivery', 11, 'delivery_driver', 'stop_completed', 0, 2293, 255, '[{\"sequence\":1,\"order_ids\":[18],\"address\":\"Hẻm 166/5 Lê Lợi, Phường Hạnh Thông, TP. Hồ Chí Minh\",\"ranking_reason\":null,\"eta\":\"2026-10-21T11:14:42.454Z\",\"distance_from_previous_m\":1360},{\"sequence\":2,\"order_ids\":[19],\"address\":\"Hẻm 300/21 Nguyễn Thái Sơn, Phường Hạnh Thông, TP. Hồ Chí Minh\",\"ranking_reason\":null,\"eta\":\"2026-10-21T11:16:53.254Z\",\"distance_from_previous_m\":933}]', '2026-10-21 11:12:38'),
(10, 11, 'delivery', 11, 'delivery_driver', 'stop_completed', 0, 612, 83, '[{\"sequence\":1,\"order_ids\":[19],\"address\":\"Hẻm 300/21 Nguyễn Thái Sơn, Phường Hạnh Thông, TP. Hồ Chí Minh\",\"ranking_reason\":null,\"eta\":\"2026-10-22T01:45:51.121Z\",\"distance_from_previous_m\":612}]', '2026-10-22 01:44:28'),
(11, 11, 'delivery', 11, 'delivery_driver', 'failed', 1, 0, 0, '[]', '2026-10-22 01:47:11'),
(12, 9, 'pickup', NULL, 'system', 'new_order', 0, 9778, 663, '[{\"sequence\":1,\"order_ids\":[21],\"address\":\"Hẻm 15 Đường số 4, Phường Thông Tây Hội, TP. Hồ Chí Minh\",\"ranking_reason\":\"Khung 18:30-19:00, hạn SLA 20:54, cách 4.9 km\",\"eta\":\"2026-10-24T12:17:48.803Z\",\"distance_from_previous_m\":4887}]', '2026-10-24 12:12:19'),
(13, 7, 'pickup', NULL, 'system', 'new_order', 0, 9778, 663, '[{\"sequence\":1,\"order_ids\":[20],\"address\":\"Hẻm 15 Đường số 4, Phường Thông Tây Hội, TP. Hồ Chí Minh\",\"ranking_reason\":\"Khung 18:30-19:00, hạn SLA 20:43, cách 4.9 km\",\"eta\":\"2026-10-24T12:17:51.384Z\",\"distance_from_previous_m\":4887}]', '2026-10-24 12:12:21'),
(14, 7, 'pickup', 7, 'pickup_driver', 'stop_completed', 0, 0, 0, '[]', '2026-10-24 12:17:12'),
(15, 11, 'delivery', NULL, 'system', 'new_order', 0, 1602, 180, '[{\"sequence\":1,\"order_ids\":[20],\"address\":\"Hẻm 80/22 Dương Quảng Hàm, Phường An Nhơn, TP. Hồ Chí Minh\",\"ranking_reason\":null,\"eta\":\"2026-10-24T12:34:49.150Z\",\"distance_from_previous_m\":1602}]', '2026-10-24 12:31:49'),
(16, 11, 'delivery', 11, 'delivery_driver', 'stop_completed', 0, 1602, 180, '[{\"sequence\":1,\"order_ids\":[20],\"address\":\"Hẻm 80/22 Dương Quảng Hàm, Phường An Nhơn, TP. Hồ Chí Minh\",\"ranking_reason\":null,\"eta\":\"2026-10-24T12:38:15.597Z\",\"distance_from_previous_m\":1602}]', '2026-10-24 12:35:15'),
(17, 11, 'delivery', 11, 'delivery_driver', 'stop_completed', 1, 0, 0, '[]', '2026-10-24 12:38:19'),
(18, 7, 'pickup', NULL, 'system', 'new_order', 0, 9778, 663, '[{\"sequence\":1,\"order_ids\":[23],\"address\":\"Hẻm 15 Đường số 4, Phường Thông Tây Hội, TP. Hồ Chí Minh\",\"ranking_reason\":\"Khung 14:00-14:30, hạn SLA 16:16, cách 4.9 km\",\"eta\":\"2026-10-25T07:23:16.639Z\",\"distance_from_previous_m\":4887}]', '2026-10-25 07:17:47'),
(19, 7, 'pickup', NULL, 'system', 'new_order', 0, 9778, 663, '[{\"sequence\":1,\"order_ids\":[23,22],\"address\":\"Hẻm 15 Đường số 4, Phường Thông Tây Hội, TP. Hồ Chí Minh\",\"ranking_reason\":\"Khung 14:00-14:30, hạn SLA 16:04, cách 4.9 km\",\"eta\":\"2026-10-25T07:23:22.580Z\",\"distance_from_previous_m\":4887}]', '2026-10-25 07:17:52'),
(20, 9, 'pickup', 9, 'pickup_driver', 'stop_completed', 0, 0, 0, '[]', '2026-10-25 07:19:00'),
(21, 10, 'delivery', NULL, 'system', 'new_order', 0, 1675, 123, '[{\"sequence\":1,\"order_ids\":[21],\"address\":\"Hẻm 133 Quang Trung, Phường Gò Vấp, TP. Hồ Chí Minh\",\"ranking_reason\":null,\"eta\":\"2026-10-25T07:26:14.323Z\",\"distance_from_previous_m\":1675}]', '2026-10-25 07:24:11'),
(22, 10, 'delivery', 10, 'delivery_driver', 'stop_completed', 0, 1675, 123, '[{\"sequence\":1,\"order_ids\":[21],\"address\":\"Hẻm 133 Quang Trung, Phường Gò Vấp, TP. Hồ Chí Minh\",\"ranking_reason\":null,\"eta\":\"2026-10-25T07:35:57.258Z\",\"distance_from_previous_m\":1675}]', '2026-10-25 07:33:54'),
(23, 10, 'delivery', 10, 'delivery_driver', 'stop_completed', 1, 0, 0, '[]', '2026-10-25 07:40:00');

-- --------------------------------------------------------

--
-- Table structure for table `driver_route_stops`
--

CREATE TABLE `driver_route_stops` (
  `id` bigint(20) NOT NULL,
  `driver_id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `task_type` enum('pickup','delivery','return') NOT NULL,
  `stop_order` int(11) NOT NULL,
  `lat` double NOT NULL,
  `lng` double NOT NULL,
  `address` text NOT NULL,
  `status` enum('planned','completed') NOT NULL DEFAULT 'planned',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `stop_sequence` int(10) UNSIGNED DEFAULT NULL,
  `planned_eta` datetime DEFAULT NULL,
  `actual_arrival` datetime DEFAULT NULL,
  `distance_from_previous_m` int(10) UNSIGNED DEFAULT NULL,
  `duration_from_previous_s` int(10) UNSIGNED DEFAULT NULL,
  `is_manual_override` tinyint(1) NOT NULL DEFAULT 0,
  `override_reason` varchar(500) DEFAULT NULL,
  `ranking_reason` varchar(500) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `driver_route_stops`
--

INSERT INTO `driver_route_stops` (`id`, `driver_id`, `order_id`, `task_type`, `stop_order`, `lat`, `lng`, `address`, `status`, `created_at`, `stop_sequence`, `planned_eta`, `actual_arrival`, `distance_from_previous_m`, `duration_from_previous_s`, `is_manual_override`, `override_reason`, `ranking_reason`) VALUES
(2, 9, 19, 'pickup', 1, 10.844544716289441, 106.63749934956395, 'Hẻm 965/27 Quang Trung, Phường An Hội Tây, TP. Hồ Chí Minh', 'completed', '2026-10-21 10:31:59', 1, '2026-10-21 10:44:19', '2026-10-21 17:37:43', 6617, 452, 0, NULL, 'Khung 17:00-17:30, hạn SLA 19:29, cách 6.6 km'),
(3, 9, 18, 'pickup', 1, 10.832302564714512, 106.66731165730474, 'Hẻm 499 Quang Trung, Phường Gò Vấp, Gò Vấp, TP. Hồ Chí Minh', 'completed', '2026-10-21 10:31:59', 1, '2026-10-21 10:38:41', '2026-10-21 17:36:46', 3019, 199, 0, NULL, 'Khung 17:00-17:30, hạn SLA 19:24, cách 3.0 km'),
(4, 11, 19, 'delivery', 1, 10.821920205215696, 106.68623173789061, 'Hẻm 300/21 Nguyễn Thái Sơn, Phường Hạnh Thông, TP. Hồ Chí Minh', 'completed', '2026-10-21 10:59:19', 1, '2026-10-22 01:45:51', '2026-10-22 08:47:11', 612, 83, 0, NULL, NULL),
(5, 11, 18, 'delivery', 1, 10.81722752096813, 106.6838286464891, 'Hẻm 166/5 Lê Lợi, Phường Hạnh Thông, TP. Hồ Chí Minh', 'completed', '2026-10-21 10:59:22', 1, '2026-10-21 11:14:42', '2026-10-22 08:44:28', 1360, 125, 0, NULL, NULL),
(6, 9, 21, 'pickup', 1, 10.846352316508511, 106.65761084279973, 'Hẻm 15 Đường số 4, Phường Thông Tây Hội, TP. Hồ Chí Minh', 'completed', '2026-10-24 12:12:19', 1, '2026-10-24 12:17:48', '2026-10-25 14:19:00', 4887, 330, 0, NULL, 'Khung 18:30-19:00, hạn SLA 20:54, cách 4.9 km'),
(7, 7, 20, 'pickup', 1, 10.846352316508511, 106.65761084279973, 'Hẻm 15 Đường số 4, Phường Thông Tây Hội, TP. Hồ Chí Minh', 'completed', '2026-10-24 12:12:21', 1, '2026-10-24 12:17:51', '2026-10-24 19:17:12', 4887, 330, 0, NULL, 'Khung 18:30-19:00, hạn SLA 20:43, cách 4.9 km'),
(8, 11, 20, 'delivery', 1, 10.825442546751006, 106.69632920954423, 'Hẻm 80/22 Dương Quảng Hàm, Phường An Nhơn, TP. Hồ Chí Minh', 'completed', '2026-10-24 12:31:49', 1, '2026-10-24 12:38:15', '2026-10-24 19:38:19', 1602, 180, 0, NULL, NULL),
(9, 7, 23, 'pickup', 1, 10.846352316508511, 106.65761084279973, 'Hẻm 15 Đường số 4, Phường Thông Tây Hội, TP. Hồ Chí Minh', 'planned', '2026-10-25 07:17:46', 1, '2026-10-25 07:23:22', NULL, 4887, 330, 0, NULL, 'Khung 14:00-14:30, hạn SLA 16:04, cách 4.9 km'),
(10, 7, 22, 'pickup', 1, 10.846352316508511, 106.65761084279973, 'Hẻm 15 Đường số 4, Phường Thông Tây Hội, TP. Hồ Chí Minh', 'planned', '2026-10-25 07:17:52', 1, '2026-10-25 07:23:22', NULL, 4887, 330, 0, NULL, 'Khung 14:00-14:30, hạn SLA 16:04, cách 4.9 km'),
(11, 10, 21, 'delivery', 1, 10.827938770470546, 106.67527899997424, 'Hẻm 133 Quang Trung, Phường Gò Vấp, TP. Hồ Chí Minh', 'completed', '2026-10-25 07:24:11', 1, '2026-10-25 07:35:57', '2026-10-25 14:40:00', 1675, 123, 0, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `driver_wallets`
--

CREATE TABLE `driver_wallets` (
  `driver_id` int(11) NOT NULL,
  `balance` decimal(15,0) NOT NULL DEFAULT 0,
  `reserved_balance` decimal(15,0) NOT NULL DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `driver_wallets`
--

INSERT INTO `driver_wallets` (`driver_id`, `balance`, `reserved_balance`, `updated_at`) VALUES
(10, 5200000, 700000, '2026-10-25 07:25:36'),
(11, 4000000, 830000, '2026-10-25 07:01:16');

-- --------------------------------------------------------

--
-- Table structure for table `driver_wallet_reservations`
--

CREATE TABLE `driver_wallet_reservations` (
  `order_id` int(11) NOT NULL,
  `driver_id` int(11) NOT NULL,
  `amount` decimal(15,0) NOT NULL,
  `status` enum('reserved','released') NOT NULL DEFAULT 'reserved',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `released_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `driver_wallet_reservations`
--

INSERT INTO `driver_wallet_reservations` (`order_id`, `driver_id`, `amount`, `status`, `created_at`, `released_at`) VALUES
(18, 11, 300000, 'reserved', '2026-10-21 10:59:22', NULL),
(19, 11, 530000, 'reserved', '2026-10-21 10:59:19', NULL),
(20, 11, 540000, 'released', '2026-10-24 12:31:49', '2026-10-24 19:40:36'),
(21, 10, 700000, 'reserved', '2026-10-25 07:24:11', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `driver_wallet_transactions`
--

CREATE TABLE `driver_wallet_transactions` (
  `id` bigint(20) NOT NULL,
  `driver_id` int(11) NOT NULL,
  `order_id` int(11) DEFAULT NULL,
  `transaction_type` enum('deposit','reserve','release','deduction') NOT NULL,
  `amount` decimal(15,0) NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `incident_id` bigint(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `driver_wallet_transactions`
--

INSERT INTO `driver_wallet_transactions` (`id`, `driver_id`, `order_id`, `transaction_type`, `amount`, `note`, `created_by`, `created_at`, `incident_id`) VALUES
(1, 11, NULL, 'deposit', 1000000, 'Kế toán xác nhận đã nhận tiền ký quỹ', 4, '2026-10-21 10:56:07', NULL),
(2, 11, 19, 'reserve', 530000, 'Giữ ký quỹ khi phân công đơn COD', NULL, '2026-10-21 10:59:19', NULL),
(3, 11, 18, 'reserve', 300000, 'Giữ ký quỹ khi phân công đơn COD', NULL, '2026-10-21 10:59:22', NULL),
(4, 10, NULL, 'deposit', 1000000, 'Kế toán xác nhận đã nhận tiền ký quỹ', 4, '2026-10-24 12:31:24', NULL),
(5, 11, NULL, 'deposit', 1000000, 'Kế toán xác nhận đã nhận tiền ký quỹ', 4, '2026-10-24 12:31:37', NULL),
(6, 11, 20, 'reserve', 540000, 'Giữ ký quỹ khi phân công đơn COD', NULL, '2026-10-24 12:31:49', NULL),
(7, 11, 20, 'release', 540000, 'Kế toán xác nhận đã nhận COD tiền mặt', 4, '2026-10-24 12:40:36', NULL),
(8, 10, NULL, 'deposit', 200000, 'Kế toán xác nhận đã nhận tiền ký quỹ', 4, '2026-10-25 07:01:12', NULL),
(9, 11, NULL, 'deposit', 2000000, 'Kế toán xác nhận đã nhận tiền ký quỹ', 4, '2026-10-25 07:01:16', NULL),
(10, 10, NULL, 'deposit', 2000000, 'Kế toán xác nhận đã nhận tiền ký quỹ', 4, '2026-10-25 07:01:45', NULL),
(11, 10, 21, 'reserve', 700000, 'Giữ ký quỹ khi phân công đơn COD', NULL, '2026-10-25 07:24:11', NULL),
(12, 10, NULL, 'deposit', 2000000, 'Kế toán xác nhận đã nhận tiền ký quỹ', 4, '2026-10-25 07:25:36', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `employee_payroll_adjustments`
--

CREATE TABLE `employee_payroll_adjustments` (
  `id` bigint(20) NOT NULL,
  `user_id` int(11) NOT NULL,
  `payroll_month` char(7) NOT NULL,
  `adjustment_type` enum('bonus','deduction') NOT NULL,
  `amount` decimal(15,0) NOT NULL,
  `reason` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `incident_id` bigint(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `employee_salaries`
--

CREATE TABLE `employee_salaries` (
  `user_id` int(11) NOT NULL,
  `monthly_salary` decimal(15,0) NOT NULL DEFAULT 0,
  `allowance` decimal(15,0) NOT NULL DEFAULT 0,
  `bonus_per_delivery` decimal(15,0) NOT NULL DEFAULT 0,
  `commission_rate` decimal(5,2) NOT NULL DEFAULT 0.00,
  `tenure_raise_percent` decimal(5,2) NOT NULL DEFAULT 0.00,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `employee_salaries`
--

INSERT INTO `employee_salaries` (`user_id`, `monthly_salary`, `allowance`, `bonus_per_delivery`, `commission_rate`, `tenure_raise_percent`, `updated_at`) VALUES
(1, 45000000, 10000000, 0, 0.00, 0.00, '2026-10-20 05:15:34'),
(2, 18000000, 3000000, 0, 0.00, 0.00, '2026-10-20 05:15:34'),
(3, 20000000, 4000000, 0, 0.00, 0.00, '2026-10-20 05:15:34'),
(4, 16000000, 2500000, 0, 0.00, 0.00, '2026-10-20 05:15:34'),
(5, 15000000, 2000000, 0, 0.00, 0.00, '2026-10-20 05:15:34'),
(6, 12000000, 1500000, 0, 0.00, 0.00, '2026-10-20 05:15:34'),
(7, 12000000, 4000000, 0, 0.00, 0.00, '2026-10-20 05:15:34'),
(8, 15000000, 2000000, 0, 0.00, 0.00, '2026-10-20 05:15:34'),
(9, 12000000, 4000000, 0, 0.00, 0.00, '2026-10-20 05:15:34'),
(10, 12000000, 4000000, 0, 0.00, 0.00, '2026-10-20 05:15:34'),
(11, 12000000, 4000000, 0, 0.00, 0.00, '2026-10-20 05:15:34'),
(12, 10000000, 0, 0, 0.00, 0.00, '2026-10-20 05:15:34'),
(13, 15000000, 2000000, 0, 0.00, 0.00, '2026-10-20 05:15:34'),
(14, 15000000, 2000000, 0, 0.00, 0.00, '2026-10-20 05:15:34'),
(15, 20000000, 4000000, 0, 0.00, 0.00, '2026-10-20 05:15:34'),
(16, 16000000, 2500000, 0, 0.00, 0.00, '2026-10-20 05:15:34'),
(17, 18000000, 3000000, 0, 0.00, 0.00, '2026-10-20 05:15:34'),
(18, 15000000, 2000000, 0, 0.00, 0.00, '2026-10-20 05:15:34'),
(19, 12000000, 1500000, 0, 0.00, 0.00, '2026-10-20 05:15:34');

-- --------------------------------------------------------

--
-- Table structure for table `employee_salary_history`
--

CREATE TABLE `employee_salary_history` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(11) NOT NULL,
  `monthly_salary` decimal(15,0) NOT NULL DEFAULT 0,
  `allowance` decimal(15,0) NOT NULL DEFAULT 0,
  `bonus_per_delivery` decimal(15,0) NOT NULL DEFAULT 0,
  `commission_rate` decimal(5,2) NOT NULL DEFAULT 0.00,
  `tenure_raise_percent` decimal(5,2) NOT NULL DEFAULT 0.00,
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `employee_salary_history`
--

INSERT INTO `employee_salary_history` (`id`, `user_id`, `monthly_salary`, `allowance`, `bonus_per_delivery`, `commission_rate`, `tenure_raise_percent`, `effective_from`, `effective_to`, `created_by`, `created_at`) VALUES
(1, 1, 45000000, 10000000, 0, 0.00, 0.00, '2026-10-20', NULL, NULL, '2026-10-20 13:53:57'),
(2, 2, 18000000, 3000000, 0, 0.00, 0.00, '2026-10-20', NULL, NULL, '2026-10-20 13:53:57'),
(3, 3, 20000000, 4000000, 0, 0.00, 0.00, '2026-10-20', NULL, NULL, '2026-10-20 13:53:57'),
(4, 4, 16000000, 2500000, 0, 0.00, 0.00, '2026-10-20', NULL, NULL, '2026-10-20 13:53:57'),
(5, 5, 15000000, 2000000, 0, 0.00, 0.00, '2026-10-20', NULL, NULL, '2026-10-20 13:53:57'),
(6, 6, 12000000, 1500000, 0, 0.00, 0.00, '2026-10-20', NULL, NULL, '2026-10-20 13:53:57'),
(7, 7, 12000000, 4000000, 0, 0.00, 0.00, '2026-10-20', NULL, NULL, '2026-10-20 13:53:57'),
(8, 8, 15000000, 2000000, 0, 0.00, 0.00, '2026-10-20', NULL, NULL, '2026-10-20 13:53:57'),
(9, 9, 12000000, 4000000, 0, 0.00, 0.00, '2026-10-20', NULL, NULL, '2026-10-20 13:53:57'),
(10, 10, 12000000, 4000000, 0, 0.00, 0.00, '2026-10-20', NULL, NULL, '2026-10-20 13:53:57'),
(11, 11, 12000000, 4000000, 0, 0.00, 0.00, '2026-10-20', NULL, NULL, '2026-10-20 13:53:57'),
(12, 12, 10000000, 0, 0, 0.00, 0.00, '2026-10-20', NULL, NULL, '2026-10-20 13:53:57'),
(13, 13, 15000000, 2000000, 0, 0.00, 0.00, '2026-10-20', NULL, NULL, '2026-10-20 13:53:57'),
(14, 14, 15000000, 2000000, 0, 0.00, 0.00, '2026-10-20', NULL, NULL, '2026-10-20 13:53:57'),
(15, 15, 20000000, 4000000, 0, 0.00, 0.00, '2026-10-20', NULL, NULL, '2026-10-20 13:53:57'),
(16, 16, 16000000, 2500000, 0, 0.00, 0.00, '2026-10-20', NULL, NULL, '2026-10-20 13:53:57'),
(17, 17, 18000000, 3000000, 0, 0.00, 0.00, '2026-10-20', NULL, NULL, '2026-10-20 13:53:57'),
(18, 18, 15000000, 2000000, 0, 0.00, 0.00, '2026-10-20', NULL, NULL, '2026-10-20 13:53:57'),
(19, 19, 12000000, 1500000, 0, 0.00, 0.00, '2026-10-20', NULL, NULL, '2026-10-20 13:53:57');

-- --------------------------------------------------------

--
-- Table structure for table `failure_settings_003_backup`
--

CREATE TABLE `failure_settings_003_backup` (
  `setting_key` varchar(100) NOT NULL,
  `setting_value` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `job_applications`
--

CREATE TABLE `job_applications` (
  `id` bigint(20) NOT NULL,
  `job_title` varchar(255) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(50) NOT NULL,
  `experience` text DEFAULT NULL,
  `message` text DEFAULT NULL,
  `status` enum('new','reviewing','accepted','rejected') NOT NULL DEFAULT 'new',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `job_applications`
--

INSERT INTO `job_applications` (`id`, `job_title`, `full_name`, `email`, `phone`, `experience`, `message`, `status`, `created_at`) VALUES
(1, 'Tài xế giao nhận', 'Đỗ Minh Phúc', 'ungvien.phuc@example.com', '0902000001', '3 năm giao hàng nội thành, thông thạo các tuyến TP. Hồ Chí Minh.', 'Có thể nhận việc theo ca sáng.', 'new', '2026-10-20 05:15:34'),
(2, 'Nhân viên điều phối', 'Nguyễn Hà My', 'ungvien.my@example.com', '0902000002', '2 năm theo dõi đơn hàng và điều phối đội giao nhận.', 'Mong muốn làm việc tại văn phòng TP. Hồ Chí Minh.', 'reviewing', '2026-10-20 05:15:34'),
(3, 'Nhân viên kho', 'Trần Đức Long', 'ungvien.long@example.com', '0902000003', 'Từng kiểm kê và phân loại hàng hóa tại kho thương mại điện tử.', 'Có thể làm việc theo ca.', 'accepted', '2026-10-20 05:15:34');

-- --------------------------------------------------------

--
-- Table structure for table `leave_requests`
--

CREATE TABLE `leave_requests` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `reason` text NOT NULL,
  `status` varchar(30) DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `leave_requests`
--

INSERT INTO `leave_requests` (`id`, `user_id`, `reason`, `status`, `created_at`) VALUES
(1, 9, 'Xin nghỉ phép một ngày để giải quyết việc gia đình.', 'pending', '2026-10-20 05:15:34'),
(2, 14, 'Xin đổi ca và nghỉ phép ngày thứ Bảy tuần này.', 'pending', '2026-10-20 05:15:34'),
(3, 10, 'Đề nghị nghỉ phép đã được quản lý xác nhận.', 'approved', '2026-10-20 05:15:34'),
(4, 7, 'Xin nghỉ phép 1 ngày do gia đình có việc cần xử lý.', 'approved', '2026-10-20 05:15:34');

-- --------------------------------------------------------

--
-- Table structure for table `linehaul_trips`
--

CREATE TABLE `linehaul_trips` (
  `id` bigint(20) NOT NULL,
  `trip_code` varchar(40) NOT NULL,
  `vehicle_plate` varchar(30) NOT NULL,
  `truck_id` int(11) DEFAULT NULL,
  `driver_id` int(11) DEFAULT NULL,
  `source_warehouse_id` int(11) NOT NULL,
  `destination_warehouse_id` int(11) NOT NULL,
  `status` enum('planned','loading','in_transit','arrived','completed','cancelled') NOT NULL DEFAULT 'planned',
  `departed_at` datetime DEFAULT NULL,
  `arrived_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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

-- --------------------------------------------------------

--
-- Table structure for table `news_articles`
--

CREATE TABLE `news_articles` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `summary` text DEFAULT NULL,
  `content` longtext DEFAULT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `category` varchar(100) DEFAULT 'Tin tức',
  `status` enum('draft','published') DEFAULT 'published',
  `created_by` varchar(255) DEFAULT 'content_team',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `news_articles`
--

INSERT INTO `news_articles` (`id`, `title`, `slug`, `summary`, `content`, `image_url`, `category`, `status`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 'Smart Logistics nâng cấp hệ thống tracking mới', 'smart-logistics-nang-cap-he-thong-tracking-moi', 'Hệ thống theo dõi đơn hàng được cập nhật để giảm sai sót trong quá trình giao nhận.', '<p>Smart Logistics vừa triển khai hệ thống tracking mới nhằm giúp khách hàng theo dõi đơn hàng trong thời gian thực.</p><p>Với công nghệ cập nhật, các đơn hàng được phản hồi nhanh hơn, giảm tỷ lệ chậm trễ và tối ưu hóa quy trình vận chuyển.</p>', 'https://images.unsplash.com/photo-1586528116311-ad8ed7c663be?auto=format&fit=crop&w=800&q=80', 'Tin tức', 'published', 'content_team', '2026-10-20 05:15:34', '2026-10-20 05:15:34'),
(2, 'Cách tối ưu chi phí vận chuyển cho shop online', 'cach-toi-uu-chi-phi-van-chuyen-cho-shop-online', 'Bốn cách giúp doanh nghiệp giảm chi phí logistics mà vẫn giữ chất lượng giao hàng tốt.', '<p>Để tối ưu chi phí vận chuyển, doanh nghiệp cần theo dõi trọng lượng, địa điểm giao hàng và thời điểm vận chuyển hiệu quả.</p><p>Smart Logistics khuyến nghị khách hàng lựa chọn gói cước phù hợp để tránh phát sinh chi phí bất ngờ.</p>', 'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=800&q=80', 'Hướng dẫn', 'published', 'content_team', '2026-10-20 05:15:34', '2026-10-20 05:15:34'),
(3, 'Đội ngũ tài xế và kho vận đồng bộ trên dashboard mới', 'doi-ngu-tai-xe-va-kho-van-dong-bo-tren-dashboard-moi', 'Dashboard mới cho phép đội ngũ vận hành làm việc đồng bộ và cập nhật tiến độ kịp thời.', '<p>Bộ phận vận hành và kho vận đang làm việc chung trên dashboard mới, giúp theo dõi trạng thái đơn hàng liên tục.</p><p>Điều này giúp rút ngắn thời gian xử lý, nâng cao độ chính xác và hiệu quả điều phối.</p>', 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=800&q=80', 'Công nghệ', 'published', 'content_team', '2026-10-20 05:15:34', '2026-10-20 05:15:34'),
(4, 'Hướng dẫn chuẩn bị hàng trước khi gửi', 'huong-dan-chuan-bi-hang-truoc-khi-gui', 'Các bước đóng gói giúp hàng hóa an toàn và rút ngắn thời gian xử lý tại kho.', '<p>Chọn thùng vừa kích thước, chèn vật liệu chống sốc và dán kín các cạnh.</p><p>Ghi rõ mã đơn bên ngoài kiện hàng và tách riêng hàng dễ vỡ để được xử lý phù hợp.</p>', 'https://images.unsplash.com/photo-1607082349566-187342175e2f?auto=format&fit=crop&w=1200&q=80', 'Hướng dẫn', 'published', 'content_team', '2026-10-20 05:15:34', '2026-10-20 05:15:34'),
(5, 'Mở rộng mạng lưới giao nhận khu vực phía Nam', 'mo-rong-mang-luoi-giao-nhan-phia-nam', 'Smart Logistics bổ sung điểm trung chuyển để tăng tốc độ giao hàng liên tỉnh.', '<p>Điểm trung chuyển mới giúp các tuyến nội vùng được phân loại sớm hơn.</p><p>Đội điều phối sẽ theo dõi sản lượng theo ngày để điều chỉnh lịch xe linh hoạt.</p>', 'https://images.unsplash.com/photo-1586528116311-ad8ed7c663be?auto=format&fit=crop&w=1200&q=80', 'Tin tức', 'published', 'content_team', '2026-10-20 05:15:34', '2026-10-20 05:15:34'),
(6, 'Quy trình đối soát COD minh bạch', 'quy-trinh-doi-soat-cod-minh-bach', 'Shop có thể kiểm tra số đơn, số tiền thu hộ và lịch sử thanh toán theo từng đợt.', '<p>Mỗi đợt đối soát tổng hợp đơn giao thành công và số tiền tài xế đã thu.</p><p>Vui lòng đối chiếu mã vận đơn trước khi xác nhận thanh toán.</p>', 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=80', 'Hướng dẫn', 'published', 'content_team', '2026-10-20 05:15:34', '2026-10-20 05:15:34'),
(7, 'Tuyển tài xế giao nhận trong tháng 10', 'tuyen-tai-xe-giao-nhan-thang-10', 'Smart Logistics mở rộng đội giao nhận và tiếp nhận hồ sơ tài xế toàn thời gian.', '<p>Ứng viên cần có giấy phép lái xe phù hợp, điện thoại thông minh và thông tin cư trú rõ ràng.</p><p>Hồ sơ có thể gửi qua trang Tuyển dụng để bộ phận nhân sự liên hệ.</p>', 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80', 'Tuyển dụng', 'published', 'content_team', '2026-10-20 05:15:34', '2026-10-20 05:15:34'),
(8, 'Quét mã vạch giúp kiểm soát tồn kho', 'quet-ma-vach-kiem-soat-ton-kho', 'Quy trình quét mã đồng bộ trạng thái kiện hàng giữa kho và đội điều phối.', '<p>Mỗi lần nhận, xuất hoặc phân loại kiện hàng cần quét mã vận đơn để cập nhật trạng thái.</p><p>Thao tác này giúp giảm nhập liệu thủ công và dễ tra soát khi phát sinh chênh lệch.</p>', 'https://images.unsplash.com/photo-1580674285054-bed31e145f59?auto=format&fit=crop&w=1200&q=80', 'Công nghệ', 'published', 'content_team', '2026-10-20 05:15:34', '2026-10-20 05:15:34');

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` bigint(20) NOT NULL,
  `recipient_user_id` int(11) NOT NULL,
  `order_id` int(11) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `recipient_user_id`, `order_id`, `title`, `message`, `is_read`, `created_at`) VALUES
(5, 6, 18, 'Đã tiếp nhận vận đơn', 'Đơn VTPC80783744BVN đã được gửi đến Điều phối.', 0, '2026-10-21 10:24:38'),
(6, 20, 19, 'Đã tiếp nhận vận đơn', 'Đơn VTP06D58F50A1VN đã được gửi đến Điều phối.', 0, '2026-10-21 10:29:56'),
(7, 9, 19, 'Có nhiệm vụ vận chuyển mới', 'Đơn VTP06D58F50A1VN: lấy hàng tại Shop.', 0, '2026-10-21 10:31:59'),
(8, 20, 19, 'Cập nhật luân chuyển vận đơn', 'Đơn VTP06D58F50A1VN đang được lấy hàng tại Shop.', 0, '2026-10-21 10:31:59'),
(9, 9, 18, 'Có nhiệm vụ vận chuyển mới', 'Đơn VTPC80783744BVN: lấy hàng tại Shop.', 0, '2026-10-21 10:31:59'),
(10, 6, 18, 'Cập nhật luân chuyển vận đơn', 'Đơn VTPC80783744BVN đang được lấy hàng tại Shop.', 0, '2026-10-21 10:31:59'),
(11, 6, 18, 'Cập nhật trạng thái vận đơn', 'Đơn VTPC80783744BVN đã chuyển sang trạng thái picked_up.', 0, '2026-10-21 10:36:46'),
(12, 20, 19, 'Cập nhật trạng thái vận đơn', 'Đơn VTP06D58F50A1VN đã chuyển sang trạng thái picked_up.', 0, '2026-10-21 10:37:43'),
(13, 20, 19, 'Cập nhật luân chuyển vận đơn', 'Đã nhập kho tổng Gò Vấp, chờ phân công tài xế giao. Vị trí lưu kho: A1-01.', 0, '2026-10-21 10:43:18'),
(14, 6, 18, 'Cập nhật luân chuyển vận đơn', 'Đã nhập kho tổng Gò Vấp, chờ phân công tài xế giao. Vị trí lưu kho: A1-01.', 0, '2026-10-21 10:43:47'),
(15, 11, 19, 'Có nhiệm vụ vận chuyển mới', 'Đơn VTP06D58F50A1VN: giao hàng đến người nhận.', 0, '2026-10-21 10:59:20'),
(16, 20, 19, 'Cập nhật luân chuyển vận đơn', 'Đơn VTP06D58F50A1VN đang được giao hàng đến người nhận.', 0, '2026-10-21 10:59:20'),
(17, 11, 18, 'Có nhiệm vụ vận chuyển mới', 'Đơn VTPC80783744BVN: giao hàng đến người nhận.', 0, '2026-10-21 10:59:22'),
(18, 6, 18, 'Cập nhật luân chuyển vận đơn', 'Đơn VTPC80783744BVN đang được giao hàng đến người nhận.', 0, '2026-10-21 10:59:22'),
(19, 6, 18, 'Cập nhật trạng thái vận đơn', 'Đơn VTPC80783744BVN đã chuyển sang trạng thái delivering.', 0, '2026-10-21 11:08:19'),
(20, 20, 19, 'Cập nhật trạng thái vận đơn', 'Đơn VTP06D58F50A1VN đã chuyển sang trạng thái delivering.', 0, '2026-10-21 11:12:37'),
(21, 6, 18, 'Cập nhật trạng thái vận đơn', 'Đơn VTPC80783744BVN đã chuyển sang trạng thái completed.', 0, '2026-10-22 01:44:28'),
(22, 20, 19, 'Cập nhật trạng thái vận đơn', 'Đơn VTP06D58F50A1VN đã chuyển sang trạng thái at_central_warehouse.', 0, '2026-10-22 01:47:11'),
(23, 21, 20, 'Đã tiếp nhận vận đơn', 'Đơn VTP42701305C0VN đã được gửi đến Điều phối.', 0, '2026-10-24 11:43:31'),
(24, 21, 21, 'Đã tiếp nhận vận đơn', 'Đơn VTP92F20BC21FVN đã được gửi đến Điều phối.', 0, '2026-10-24 11:54:10'),
(25, 9, 21, 'Có nhiệm vụ vận chuyển mới', 'Đơn VTP92F20BC21FVN: lấy hàng tại Shop.', 0, '2026-10-24 12:12:19'),
(26, 21, 21, 'Cập nhật luân chuyển vận đơn', 'Đơn VTP92F20BC21FVN đang được lấy hàng tại Shop.', 0, '2026-10-24 12:12:19'),
(27, 21, 20, 'Cập nhật luân chuyển vận đơn', 'Đơn VTP42701305C0VN đang được lấy hàng tại Shop.', 0, '2026-10-24 12:12:21'),
(28, 7, 20, 'Có nhiệm vụ vận chuyển mới', 'Đơn VTP42701305C0VN: lấy hàng tại Shop.', 0, '2026-10-24 12:12:21'),
(29, 21, 20, 'Cập nhật trạng thái vận đơn', 'Đơn VTP42701305C0VN đã chuyển sang trạng thái picked_up.', 0, '2026-10-24 12:17:12'),
(30, 21, 20, 'Cập nhật luân chuyển vận đơn', 'Đã nhập kho tổng Gò Vấp, chờ phân công tài xế giao. Vị trí lưu kho: A1-03.', 0, '2026-10-24 12:27:45'),
(31, 11, 20, 'Có nhiệm vụ vận chuyển mới', 'Đơn VTP42701305C0VN: giao hàng đến người nhận.', 0, '2026-10-24 12:31:49'),
(32, 21, 20, 'Cập nhật luân chuyển vận đơn', 'Đơn VTP42701305C0VN đang được giao hàng đến người nhận.', 0, '2026-10-24 12:31:49'),
(33, 21, 20, 'Cập nhật trạng thái vận đơn', 'Đơn VTP42701305C0VN đã chuyển sang trạng thái delivering.', 0, '2026-10-24 12:35:15'),
(34, 21, 20, 'Cập nhật trạng thái vận đơn', 'Đơn VTP42701305C0VN đã chuyển sang trạng thái completed.', 0, '2026-10-24 12:38:19'),
(35, 21, 22, 'Đã tiếp nhận vận đơn', 'Đơn VTP2288CF0575VN đã được gửi đến Điều phối.', 0, '2026-10-25 07:04:38'),
(36, 21, 23, 'Đã tiếp nhận vận đơn', 'Đơn VTP34066821A5VN đã được gửi đến Điều phối.', 0, '2026-10-25 07:16:49'),
(37, 7, 23, 'Có nhiệm vụ vận chuyển mới', 'Đơn VTP34066821A5VN: lấy hàng tại Shop.', 0, '2026-10-25 07:17:47'),
(38, 21, 23, 'Cập nhật luân chuyển vận đơn', 'Đơn VTP34066821A5VN đang được lấy hàng tại Shop.', 0, '2026-10-25 07:17:47'),
(39, 7, 22, 'Có nhiệm vụ vận chuyển mới', 'Đơn VTP2288CF0575VN: lấy hàng tại Shop.', 0, '2026-10-25 07:17:52'),
(40, 21, 22, 'Cập nhật luân chuyển vận đơn', 'Đơn VTP2288CF0575VN đang được lấy hàng tại Shop.', 0, '2026-10-25 07:17:52'),
(41, 21, 21, 'Cập nhật trạng thái vận đơn', 'Đơn VTP92F20BC21FVN đã chuyển sang trạng thái picked_up.', 0, '2026-10-25 07:19:00'),
(42, 21, 21, 'Cập nhật luân chuyển vận đơn', 'Đã nhập kho tổng Gò Vấp, chờ phân công tài xế giao. Vị trí lưu kho: A1-01.', 0, '2026-10-25 07:22:04'),
(43, 21, 21, 'Cập nhật luân chuyển vận đơn', 'Đơn VTP92F20BC21FVN đang được giao hàng đến người nhận.', 0, '2026-10-25 07:24:11'),
(44, 10, 21, 'Có nhiệm vụ vận chuyển mới', 'Đơn VTP92F20BC21FVN: giao hàng đến người nhận.', 0, '2026-10-25 07:24:11'),
(45, 21, 21, 'Cập nhật trạng thái vận đơn', 'Đơn VTP92F20BC21FVN đã chuyển sang trạng thái delivering.', 0, '2026-10-25 07:33:54'),
(46, 21, 21, 'Cập nhật trạng thái vận đơn', 'Đơn VTP92F20BC21FVN đã chuyển sang trạng thái completed.', 0, '2026-10-25 07:40:00');

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `id` int(11) NOT NULL,
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
  `cod_amount` decimal(15,0) DEFAULT 0,
  `shipping_fee` decimal(15,0) DEFAULT 0,
  `fee_payer` enum('sender','receiver') NOT NULL DEFAULT 'sender',
  `weight_kg` decimal(8,2) DEFAULT 1.00,
  `length` decimal(8,2) DEFAULT 0.00,
  `width` decimal(8,2) DEFAULT 0.00,
  `height` decimal(8,2) DEFAULT 0.00,
  `item_value` decimal(15,0) DEFAULT 0,
  `distance_km` decimal(10,2) DEFAULT 0.00,
  `is_remote_area` tinyint(1) DEFAULT 0,
  `service_type` varchar(50) DEFAULT 'standard',
  `is_fragile` tinyint(1) DEFAULT 0,
  `vehicle_type` varchar(50) DEFAULT 'motorbike',
  `destination_province` varchar(255) DEFAULT 'Hồ Chí Minh',
  `cod_collected` tinyint(1) NOT NULL DEFAULT 0,
  `cod_collected_amount` decimal(15,0) NOT NULL DEFAULT 0,
  `cod_payment_method` enum('cash','bank_transfer') DEFAULT NULL,
  `cod_settlement_id` int(11) DEFAULT NULL,
  `cod_remittance_id` bigint(20) DEFAULT NULL,
  `service_fee` decimal(15,0) NOT NULL DEFAULT 0,
  `insurance_fee` decimal(15,0) NOT NULL DEFAULT 0,
  `is_cod_paid` tinyint(1) DEFAULT 0,
  `proof_image` varchar(255) DEFAULT NULL,
  `signature_image` varchar(255) DEFAULT NULL,
  `fail_reason` text DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `pickup_attempts` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `delivery_attempts` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `return_shipper_id` int(11) DEFAULT NULL,
  `failure_fee` decimal(15,0) NOT NULL DEFAULT 0,
  `shipping_rate_id` bigint(20) UNSIGNED DEFAULT NULL,
  `shipping_rate_snapshot` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`shipping_rate_snapshot`)),
  `shipping_rate_effective_at` datetime DEFAULT NULL,
  `promised_delivery_at` datetime DEFAULT NULL,
  `partial_delivery_allowed` tinyint(1) NOT NULL DEFAULT 0,
  `partial_delivery_completed` tinyint(1) NOT NULL DEFAULT 0,
  `is_exchange` tinyint(1) NOT NULL DEFAULT 0,
  `pickup_appointment_at` datetime DEFAULT NULL,
  `pickup_deadline_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`id`, `tracking_code`, `shop_id`, `shipper_id`, `pickup_shipper_id`, `central_transfer_shipper_id`, `destination_transfer_shipper_id`, `delivery_shipper_id`, `origin_warehouse_id`, `destination_warehouse_id`, `current_warehouse_id`, `storage_bin_id`, `cross_docked`, `shop_address`, `shop_province`, `shop_lat`, `shop_lng`, `receiver_name`, `receiver_phone`, `receiver_address`, `receiver_lat`, `receiver_lng`, `customer_email`, `cod_amount`, `shipping_fee`, `fee_payer`, `weight_kg`, `length`, `width`, `height`, `item_value`, `distance_km`, `is_remote_area`, `service_type`, `is_fragile`, `vehicle_type`, `destination_province`, `cod_collected`, `cod_collected_amount`, `cod_payment_method`, `cod_settlement_id`, `cod_remittance_id`, `service_fee`, `insurance_fee`, `is_cod_paid`, `proof_image`, `signature_image`, `fail_reason`, `status`, `created_at`, `updated_at`, `pickup_attempts`, `delivery_attempts`, `return_shipper_id`, `failure_fee`, `shipping_rate_id`, `shipping_rate_snapshot`, `shipping_rate_effective_at`, `promised_delivery_at`, `partial_delivery_allowed`, `partial_delivery_completed`, `is_exchange`, `pickup_appointment_at`, `pickup_deadline_at`) VALUES
(18, 'VTPC80783744BVN', 6, NULL, 9, NULL, NULL, 11, 1, 1, 1, NULL, 0, 'Hẻm 499 Quang Trung, Phường Gò Vấp, Gò Vấp, TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 10.832302564714512, 106.66731165730474, 'Nguyễn Quốc Thịnh', '0901857203', 'Hẻm 166/5 Lê Lợi, Phường Hạnh Thông, TP. Hồ Chí Minh', 10.81722752096813, 106.6838286464891, 'thinhthinh112233thinh@gmail.com', 300000, 28000, 'sender', 1.00, 10.00, 10.00, 10.00, 300000, 2.46, 0, 'standard', 0, 'motorbike', 'TP. Hồ Chí Minh', 1, 300000, 'cash', NULL, NULL, 0, 0, 0, '/uploads/pod-1792633467861-c28a25de2bd37d3b.jpg', '/uploads/pod-1792633467892-5b9ecb4876986f28.png', NULL, 'completed', '2026-10-21 10:24:38', '2026-10-22 01:44:28', 0, 0, NULL, 0, 2, '{\"id\":2,\"area_code\":\"GOVAP_ALL\",\"min_weight_kg\":\"0\",\"max_weight_kg\":null,\"service_type\":\"standard\",\"base_fee\":\"28000\",\"included_distance_km\":\"5\",\"distance_fee_per_km\":\"1700\",\"included_weight_kg\":\"2\",\"weight_step_kg\":\"0.5\",\"weight_step_fee\":\"4500\",\"remote_area_fee\":\"22000\",\"fragile_fee\":\"12000\",\"motorbike_multiplier_milli\":\"1000\",\"van_multiplier_milli\":\"1500\",\"truck_multiplier_milli\":\"2500\",\"rounding_increment\":\"1000\",\"effective_from\":\"2025-12-31\",\"effective_to\":null}', '2026-10-21 17:24:38', NULL, 0, 0, 0, NULL, NULL),
(19, 'VTP06D58F50A1VN', 20, NULL, 9, NULL, NULL, NULL, 1, 1, 1, NULL, 0, 'Hẻm 965/27 Quang Trung, Phường An Hội Tây, TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 10.844544716289441, 106.63749934956395, 'Trần Minh Thái', '0974783784', 'Hẻm 300/21 Nguyễn Thái Sơn, Phường Hạnh Thông, TP. Hồ Chí Minh', 10.821920205215696, 106.68623173789061, 'thai@gmail.com', 500000, 30000, 'receiver', 2.00, 10.00, 10.00, 10.00, 500000, 5.89, 0, 'standard', 0, 'motorbike', 'TP. Hồ Chí Minh', 0, 0, NULL, NULL, NULL, 0, 0, 0, '/uploads/pod-1792633631446-74249b1a1671a2bf.jpg', NULL, 'Không liên hệ được người nhận', 'at_central_warehouse', '2026-10-21 10:29:56', '2026-10-22 01:47:11', 0, 1, NULL, 0, 2, '{\"id\":2,\"area_code\":\"GOVAP_ALL\",\"min_weight_kg\":\"0\",\"max_weight_kg\":null,\"service_type\":\"standard\",\"base_fee\":\"28000\",\"included_distance_km\":\"5\",\"distance_fee_per_km\":\"1700\",\"included_weight_kg\":\"2\",\"weight_step_kg\":\"0.5\",\"weight_step_fee\":\"4500\",\"remote_area_fee\":\"22000\",\"fragile_fee\":\"12000\",\"motorbike_multiplier_milli\":\"1000\",\"van_multiplier_milli\":\"1500\",\"truck_multiplier_milli\":\"2500\",\"rounding_increment\":\"1000\",\"effective_from\":\"2025-12-31\",\"effective_to\":null}', '2026-10-21 17:29:56', NULL, 0, 0, 0, NULL, NULL),
(20, 'VTP42701305C0VN', 21, NULL, 7, NULL, NULL, 11, 1, 1, 1, NULL, 0, 'Hẻm 15 Đường số 4, Phường Thông Tây Hội, TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 10.846352316508511, 106.65761084279973, 'Nguyễn Quốc Thịnh', '0901867203', 'Hẻm 80/22 Dương Quảng Hàm, Phường An Nhơn, TP. Hồ Chí Minh', 10.825442546751006, 106.69632920954423, NULL, 500000, 40000, 'receiver', 2.00, 15.00, 10.00, 10.00, 500000, 4.83, 0, 'standard', 1, 'motorbike', 'TP. Hồ Chí Minh', 1, 540000, 'cash', NULL, 1, 0, 0, 0, '/uploads/pod-1792845499226-ebc0e460a79cb057.jpg', '/uploads/pod-1792845499253-ee856c5634a14bf5.png', NULL, 'completed', '2026-10-24 11:43:31', '2026-10-24 12:38:54', 0, 0, NULL, 0, 2, '{\"id\":2,\"area_code\":\"GOVAP_ALL\",\"min_weight_kg\":\"0\",\"max_weight_kg\":null,\"service_type\":\"standard\",\"base_fee\":\"28000\",\"included_distance_km\":\"5\",\"distance_fee_per_km\":\"1700\",\"included_weight_kg\":\"2\",\"weight_step_kg\":\"0.5\",\"weight_step_fee\":\"4500\",\"remote_area_fee\":\"22000\",\"fragile_fee\":\"12000\",\"motorbike_multiplier_milli\":\"1000\",\"van_multiplier_milli\":\"1500\",\"truck_multiplier_milli\":\"2500\",\"rounding_increment\":\"1000\",\"effective_from\":\"2025-12-31\",\"effective_to\":null}', '2026-10-24 18:43:31', NULL, 0, 0, 0, NULL, NULL),
(21, 'VTP92F20BC21FVN', 21, NULL, 9, NULL, NULL, 10, 1, 1, 1, NULL, 0, 'Hẻm 15 Đường số 4, Phường Thông Tây Hội, TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 10.846352316508511, 106.65761084279973, 'Nguyễn Trọng Phúc', '0912345678', 'Hẻm 133 Quang Trung, Phường Gò Vấp, TP. Hồ Chí Minh', 10.827938770470546, 106.67527899997424, NULL, 700000, 55000, 'sender', 5.00, 10.00, 10.00, 10.00, 700000, 2.81, 0, 'standard', 0, 'motorbike', 'TP. Hồ Chí Minh', 1, 700000, 'cash', NULL, 2, 0, 0, 0, '/uploads/pod-1792913999934-7c992aa7735f966e.jpg', '/uploads/pod-1792913999951-be17c1e13dc6c4d4.png', NULL, 'completed', '2026-10-24 11:54:10', '2026-10-25 07:46:31', 0, 0, NULL, 0, 2, '{\"id\":2,\"area_code\":\"GOVAP_ALL\",\"min_weight_kg\":\"0\",\"max_weight_kg\":null,\"service_type\":\"standard\",\"base_fee\":\"28000\",\"included_distance_km\":\"5\",\"distance_fee_per_km\":\"1700\",\"included_weight_kg\":\"2\",\"weight_step_kg\":\"0.5\",\"weight_step_fee\":\"4500\",\"remote_area_fee\":\"22000\",\"fragile_fee\":\"12000\",\"motorbike_multiplier_milli\":\"1000\",\"van_multiplier_milli\":\"1500\",\"truck_multiplier_milli\":\"2500\",\"rounding_increment\":\"1000\",\"effective_from\":\"2025-12-31\",\"effective_to\":null}', '2026-10-24 18:54:10', NULL, 0, 0, 0, NULL, NULL),
(22, 'VTP2288CF0575VN', 21, NULL, 7, NULL, NULL, NULL, 1, 1, NULL, NULL, 0, 'Hẻm 15 Đường số 4, Phường Thông Tây Hội, TP. Hồ Chí Minh', 'Gò Vấp, TP. Hồ Chí Minh', 10.846352316508511, 106.65761084279973, 'Nguyễn Quốc Thịnh', '0901857203', 'Hẻm 118/9 Đường Lê Lợi, Phường Hạnh Thông, TP. Hồ Chí Minh', 10.819208189353622, 106.68451524723001, NULL, 500000, 28000, 'receiver', 1.00, 10.00, 10.00, 10.00, 0, 4.21, 0, 'standard', 0, 'motorbike', 'TP. Hồ Chí Minh', 0, 0, NULL, NULL, NULL, 0, 0, 0, NULL, NULL, NULL, 'picking', '2026-10-25 07:04:38', '2026-10-25 07:17:52', 0, 0, NULL, 0, 2, '{\"id\":2,\"area_code\":\"GOVAP_ALL\",\"min_weight_kg\":\"0\",\"max_weight_kg\":null,\"service_type\":\"standard\",\"base_fee\":\"28000\",\"included_distance_km\":\"5\",\"distance_fee_per_km\":\"1700\",\"included_weight_kg\":\"2\",\"weight_step_kg\":\"0.5\",\"weight_step_fee\":\"4500\",\"remote_area_fee\":\"22000\",\"fragile_fee\":\"12000\",\"motorbike_multiplier_milli\":\"1000\",\"van_multiplier_milli\":\"1500\",\"truck_multiplier_milli\":\"2500\",\"rounding_increment\":\"1000\",\"effective_from\":\"2025-12-31\",\"effective_to\":null}', '2026-10-25 14:04:38', NULL, 0, 0, 0, NULL, NULL),
(23, 'VTP34066821A5VN', 21, NULL, 7, NULL, NULL, NULL, 1, 1, NULL, NULL, 0, 'Hẻm 15 Đường số 4, Phường Thông Tây Hội, TP. Hồ Chí Minh', 'Gò Vấp, TP. Hồ Chí Minh', 10.846352316508511, 106.65761084279973, 'Trần Minh Thái', '0901234567', 'số nhà 15 ,Hẻm 216 Nguyễn Thái Sơn, Phường Hạnh Thông, TP. Hồ Chí Minh', 10.82013585450258, 106.68395561385009, NULL, 500000, 40000, 'sender', 1.00, 10.00, 10.00, 10.00, 0, 4.10, 0, 'standard', 1, 'motorbike', 'TP. Hồ Chí Minh', 0, 0, NULL, NULL, NULL, 0, 0, 0, NULL, NULL, NULL, 'picking', '2026-10-25 07:16:49', '2026-10-25 07:17:46', 0, 0, NULL, 0, 2, '{\"id\":2,\"area_code\":\"GOVAP_ALL\",\"min_weight_kg\":\"0\",\"max_weight_kg\":null,\"service_type\":\"standard\",\"base_fee\":\"28000\",\"included_distance_km\":\"5\",\"distance_fee_per_km\":\"1700\",\"included_weight_kg\":\"2\",\"weight_step_kg\":\"0.5\",\"weight_step_fee\":\"4500\",\"remote_area_fee\":\"22000\",\"fragile_fee\":\"12000\",\"motorbike_multiplier_milli\":\"1000\",\"van_multiplier_milli\":\"1500\",\"truck_multiplier_milli\":\"2500\",\"rounding_increment\":\"1000\",\"effective_from\":\"2025-12-31\",\"effective_to\":null}', '2026-10-25 14:16:49', NULL, 0, 0, 0, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `order_blacklist`
--

CREATE TABLE `order_blacklist` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `entry_type` enum('phone','address') NOT NULL,
  `normalized_value` varchar(512) NOT NULL,
  `occurrence_count` int(10) UNSIGNED NOT NULL DEFAULT 2,
  `source_reason_code` varchar(50) NOT NULL,
  `last_order_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_bomb_incidents`
--

CREATE TABLE `order_bomb_incidents` (
  `order_id` int(11) NOT NULL,
  `entry_type` enum('phone','address') NOT NULL,
  `normalized_value` varchar(512) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_events`
--

CREATE TABLE `order_events` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `order_id` int(11) NOT NULL,
  `from_status` varchar(50) DEFAULT NULL,
  `to_status` varchar(50) NOT NULL,
  `actor_id` int(11) DEFAULT NULL,
  `actor_role` varchar(50) DEFAULT NULL,
  `reason_code` varchar(50) DEFAULT NULL,
  `note` text DEFAULT NULL,
  `lat` decimal(10,7) DEFAULT NULL,
  `lng` decimal(10,7) DEFAULT NULL,
  `photo_url` varchar(255) DEFAULT NULL,
  `signature_url` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `order_events`
--

INSERT INTO `order_events` (`id`, `order_id`, `from_status`, `to_status`, `actor_id`, `actor_role`, `reason_code`, `note`, `lat`, `lng`, `photo_url`, `signature_url`, `created_at`) VALUES
(4, 18, NULL, 'pending', 6, 'shop', NULL, 'Shop tạo đơn hàng', NULL, NULL, NULL, NULL, '2026-10-21 10:24:38'),
(5, 19, NULL, 'pending', 20, 'shop', NULL, 'Shop tạo đơn hàng', NULL, NULL, NULL, NULL, '2026-10-21 10:29:56'),
(6, 19, 'pending', 'picking', 3, 'fleet_manager', NULL, 'Điều phối phân công tài xế lấy hàng tại Shop', NULL, NULL, NULL, NULL, '2026-10-21 10:31:59'),
(7, 18, 'pending', 'picking', 3, 'fleet_manager', NULL, 'Điều phối phân công tài xế lấy hàng tại Shop', NULL, NULL, NULL, NULL, '2026-10-21 10:31:59'),
(8, 18, 'picking', 'picked_up', 9, 'pickup_driver', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-21 10:36:46'),
(9, 19, 'picking', 'picked_up', 9, 'pickup_driver', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-21 10:37:43'),
(10, 19, 'picked_up', 'at_central_warehouse', 5, 'warehouse_manager', NULL, 'Nhập kho tại vị trí A1-01', NULL, NULL, NULL, NULL, '2026-10-21 10:43:18'),
(11, 18, 'picked_up', 'at_central_warehouse', 5, 'warehouse_manager', NULL, 'Nhập kho tại vị trí A1-01', NULL, NULL, NULL, NULL, '2026-10-21 10:43:47'),
(12, 19, 'at_central_warehouse', 'at_central_warehouse', 3, 'fleet_manager', NULL, 'Điều phối phân công tài xế giao hàng đến người nhận', NULL, NULL, NULL, NULL, '2026-10-21 10:59:19'),
(13, 18, 'at_central_warehouse', 'at_central_warehouse', 3, 'fleet_manager', NULL, 'Điều phối phân công tài xế giao hàng đến người nhận', NULL, NULL, NULL, NULL, '2026-10-21 10:59:22'),
(14, 18, 'at_central_warehouse', 'delivering', 11, 'delivery_driver', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-21 11:08:19'),
(15, 19, 'at_central_warehouse', 'delivering', 11, 'delivery_driver', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-21 11:12:37'),
(16, 18, 'delivering', 'completed', 11, 'delivery_driver', NULL, NULL, 10.8341945, 105.8686606, '/uploads/pod-1792633467861-c28a25de2bd37d3b.jpg', '/uploads/pod-1792633467892-5b9ecb4876986f28.png', '2026-10-22 01:44:28'),
(17, 19, 'delivering', 'delivery_failed', 11, 'delivery_driver', 'DL_NO_CONTACT', 'Không liên hệ được người nhận', 10.8341985, 105.8687745, '/uploads/pod-1792633631446-74249b1a1671a2bf.jpg', NULL, '2026-10-22 01:47:11'),
(18, 19, 'delivery_failed', 'at_central_warehouse', 11, 'delivery_driver', NULL, 'Đơn được đưa về kho tổng để giao lại.', NULL, NULL, NULL, NULL, '2026-10-22 01:47:11'),
(19, 20, NULL, 'pending', 21, 'shop', NULL, 'Shop tạo đơn hàng', NULL, NULL, NULL, NULL, '2026-10-24 11:43:31'),
(20, 21, NULL, 'pending', 21, 'shop', NULL, 'Shop tạo đơn hàng', NULL, NULL, NULL, NULL, '2026-10-24 11:54:10'),
(21, 21, 'pending', 'picking', 3, 'fleet_manager', NULL, 'Điều phối phân công tài xế lấy hàng tại Shop', NULL, NULL, NULL, NULL, '2026-10-24 12:12:19'),
(22, 20, 'pending', 'picking', 3, 'fleet_manager', NULL, 'Điều phối phân công tài xế lấy hàng tại Shop', NULL, NULL, NULL, NULL, '2026-10-24 12:12:21'),
(23, 20, 'picking', 'picked_up', 7, 'pickup_driver', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-24 12:17:12'),
(24, 20, 'picked_up', 'at_central_warehouse', 5, 'warehouse_manager', NULL, 'Nhập kho tại vị trí A1-03', NULL, NULL, NULL, NULL, '2026-10-24 12:27:45'),
(25, 20, 'at_central_warehouse', 'at_central_warehouse', 5, 'warehouse_manager', NULL, 'Điều phối phân công tài xế giao hàng đến người nhận', NULL, NULL, NULL, NULL, '2026-10-24 12:31:49'),
(26, 20, 'at_central_warehouse', 'delivering', 11, 'delivery_driver', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-24 12:35:15'),
(27, 20, 'delivering', 'completed', 11, 'delivery_driver', NULL, NULL, 10.8336676, 105.8683533, '/uploads/pod-1792845499226-ebc0e460a79cb057.jpg', '/uploads/pod-1792845499253-ee856c5634a14bf5.png', '2026-10-24 12:38:19'),
(28, 22, NULL, 'pending', 21, 'shop', NULL, 'Shop tạo đơn hàng', NULL, NULL, NULL, NULL, '2026-10-25 07:04:38'),
(29, 23, NULL, 'pending', 21, 'shop', NULL, 'Shop tạo đơn hàng', NULL, NULL, NULL, NULL, '2026-10-25 07:16:49'),
(30, 23, 'pending', 'picking', 3, 'fleet_manager', NULL, 'Điều phối phân công tài xế lấy hàng tại Shop', NULL, NULL, NULL, NULL, '2026-10-25 07:17:46'),
(31, 22, 'pending', 'picking', 3, 'fleet_manager', NULL, 'Điều phối phân công tài xế lấy hàng tại Shop', NULL, NULL, NULL, NULL, '2026-10-25 07:17:52'),
(32, 21, 'picking', 'picked_up', 9, 'pickup_driver', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-25 07:19:00'),
(33, 21, 'picked_up', 'at_central_warehouse', 5, 'warehouse_manager', NULL, 'Nhập kho tại vị trí A1-01', NULL, NULL, NULL, NULL, '2026-10-25 07:22:04'),
(34, 21, 'at_central_warehouse', 'at_central_warehouse', 5, 'warehouse_manager', NULL, 'Điều phối phân công tài xế giao hàng đến người nhận', NULL, NULL, NULL, NULL, '2026-10-25 07:24:11'),
(35, 21, 'at_central_warehouse', 'delivering', 10, 'delivery_driver', NULL, NULL, NULL, NULL, NULL, NULL, '2026-10-25 07:33:54'),
(36, 21, 'delivering', 'completed', 10, 'delivery_driver', NULL, NULL, 10.8228421, 106.6877312, '/uploads/pod-1792913999934-7c992aa7735f966e.jpg', '/uploads/pod-1792913999951-be17c1e13dc6c4d4.png', '2026-10-25 07:40:00');

-- --------------------------------------------------------

--
-- Table structure for table `order_items`
--

CREATE TABLE `order_items` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `order_id` int(11) NOT NULL,
  `item_name` varchar(255) NOT NULL,
  `direction` enum('outbound','exchange_in') NOT NULL DEFAULT 'outbound',
  `quantity` int(10) UNSIGNED NOT NULL,
  `delivered_quantity` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `collected_quantity` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `return_quantity` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `unit_value` decimal(15,0) NOT NULL DEFAULT 0,
  `unit_cod_amount` decimal(15,0) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `order_items`
--

INSERT INTO `order_items` (`id`, `order_id`, `item_name`, `direction`, `quantity`, `delivered_quantity`, `collected_quantity`, `return_quantity`, `unit_value`, `unit_cod_amount`, `created_at`) VALUES
(17, 18, 'Hàng hóa', 'outbound', 1, 1, 0, 0, 300000, 300000, '2026-10-21 10:24:38'),
(18, 19, 'Hàng hóa', 'outbound', 1, 0, 0, 0, 500000, 500000, '2026-10-21 10:29:56'),
(19, 20, 'Hàng hóa', 'outbound', 1, 1, 0, 0, 500000, 500000, '2026-10-24 11:43:31'),
(20, 21, 'Hàng hóa', 'outbound', 1, 1, 0, 0, 700000, 700000, '2026-10-24 11:54:10'),
(21, 22, 'Hàng hóa', 'outbound', 1, 0, 0, 0, 0, 500000, '2026-10-25 07:04:38'),
(22, 23, 'Hàng hóa', 'outbound', 1, 0, 0, 0, 0, 500000, '2026-10-25 07:16:49');

-- --------------------------------------------------------

--
-- Table structure for table `order_status_history`
--

CREATE TABLE `order_status_history` (
  `id` bigint(20) NOT NULL,
  `order_id` int(11) NOT NULL,
  `from_status` varchar(50) DEFAULT NULL,
  `to_status` varchar(50) NOT NULL,
  `note` text DEFAULT NULL,
  `proof_image` varchar(255) DEFAULT NULL,
  `signature_image` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `order_status_history`
--

INSERT INTO `order_status_history` (`id`, `order_id`, `from_status`, `to_status`, `note`, `proof_image`, `signature_image`, `created_at`) VALUES
(4, 18, NULL, 'pending', 'Shop tạo đơn hàng', NULL, NULL, '2026-10-21 10:24:38'),
(5, 19, NULL, 'pending', 'Shop tạo đơn hàng', NULL, NULL, '2026-10-21 10:29:56'),
(6, 19, 'pending', 'picking', 'Điều phối phân công tài xế lấy hàng tại Shop', NULL, NULL, '2026-10-21 10:31:59'),
(7, 18, 'pending', 'picking', 'Điều phối phân công tài xế lấy hàng tại Shop', NULL, NULL, '2026-10-21 10:31:59'),
(8, 18, 'picking', 'picked_up', NULL, NULL, NULL, '2026-10-21 10:36:46'),
(9, 19, 'picking', 'picked_up', NULL, NULL, NULL, '2026-10-21 10:37:43'),
(10, 19, 'picked_up', 'at_central_warehouse', 'Nhập kho tại vị trí A1-01', NULL, NULL, '2026-10-21 10:43:18'),
(11, 18, 'picked_up', 'at_central_warehouse', 'Nhập kho tại vị trí A1-01', NULL, NULL, '2026-10-21 10:43:47'),
(12, 19, 'at_central_warehouse', 'at_central_warehouse', 'Điều phối phân công tài xế giao hàng đến người nhận', NULL, NULL, '2026-10-21 10:59:19'),
(13, 18, 'at_central_warehouse', 'at_central_warehouse', 'Điều phối phân công tài xế giao hàng đến người nhận', NULL, NULL, '2026-10-21 10:59:22'),
(14, 18, 'at_central_warehouse', 'delivering', NULL, NULL, NULL, '2026-10-21 11:08:19'),
(15, 19, 'at_central_warehouse', 'delivering', NULL, NULL, NULL, '2026-10-21 11:12:37'),
(16, 18, 'delivering', 'completed', NULL, '/uploads/pod-1792633467861-c28a25de2bd37d3b.jpg', '/uploads/pod-1792633467892-5b9ecb4876986f28.png', '2026-10-22 01:44:28'),
(17, 19, 'delivering', 'delivery_failed', 'Không liên hệ được người nhận', '/uploads/pod-1792633631446-74249b1a1671a2bf.jpg', NULL, '2026-10-22 01:47:11'),
(18, 19, 'delivery_failed', 'at_central_warehouse', 'Đơn được đưa về kho tổng để giao lại.', NULL, NULL, '2026-10-22 01:47:11'),
(19, 20, NULL, 'pending', 'Shop tạo đơn hàng', NULL, NULL, '2026-10-24 11:43:31'),
(20, 21, NULL, 'pending', 'Shop tạo đơn hàng', NULL, NULL, '2026-10-24 11:54:10'),
(21, 21, 'pending', 'picking', 'Điều phối phân công tài xế lấy hàng tại Shop', NULL, NULL, '2026-10-24 12:12:19'),
(22, 20, 'pending', 'picking', 'Điều phối phân công tài xế lấy hàng tại Shop', NULL, NULL, '2026-10-24 12:12:21'),
(23, 20, 'picking', 'picked_up', NULL, NULL, NULL, '2026-10-24 12:17:12'),
(24, 20, 'picked_up', 'at_central_warehouse', 'Nhập kho tại vị trí A1-03', NULL, NULL, '2026-10-24 12:27:45'),
(25, 20, 'at_central_warehouse', 'at_central_warehouse', 'Điều phối phân công tài xế giao hàng đến người nhận', NULL, NULL, '2026-10-24 12:31:49'),
(26, 20, 'at_central_warehouse', 'delivering', NULL, NULL, NULL, '2026-10-24 12:35:15'),
(27, 20, 'delivering', 'completed', NULL, '/uploads/pod-1792845499226-ebc0e460a79cb057.jpg', '/uploads/pod-1792845499253-ee856c5634a14bf5.png', '2026-10-24 12:38:19'),
(28, 22, NULL, 'pending', 'Shop tạo đơn hàng', NULL, NULL, '2026-10-25 07:04:38'),
(29, 23, NULL, 'pending', 'Shop tạo đơn hàng', NULL, NULL, '2026-10-25 07:16:49'),
(30, 23, 'pending', 'picking', 'Điều phối phân công tài xế lấy hàng tại Shop', NULL, NULL, '2026-10-25 07:17:46'),
(31, 22, 'pending', 'picking', 'Điều phối phân công tài xế lấy hàng tại Shop', NULL, NULL, '2026-10-25 07:17:52'),
(32, 21, 'picking', 'picked_up', NULL, NULL, NULL, '2026-10-25 07:19:00'),
(33, 21, 'picked_up', 'at_central_warehouse', 'Nhập kho tại vị trí A1-01', NULL, NULL, '2026-10-25 07:22:04'),
(34, 21, 'at_central_warehouse', 'at_central_warehouse', 'Điều phối phân công tài xế giao hàng đến người nhận', NULL, NULL, '2026-10-25 07:24:11'),
(35, 21, 'at_central_warehouse', 'delivering', NULL, NULL, NULL, '2026-10-25 07:33:54'),
(36, 21, 'delivering', 'completed', NULL, '/uploads/pod-1792913999934-7c992aa7735f966e.jpg', '/uploads/pod-1792913999951-be17c1e13dc6c4d4.png', '2026-10-25 07:40:00');

-- --------------------------------------------------------

--
-- Table structure for table `payroll_bonus_rules`
--

CREATE TABLE `payroll_bonus_rules` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `metric_type` enum('delivery_success_rate','delivery_count','on_time_rate','attendance_rate') NOT NULL,
  `minimum_value` decimal(8,2) NOT NULL,
  `reward_amount` decimal(15,0) NOT NULL,
  `description` varchar(255) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `payroll_bonus_rules`
--

INSERT INTO `payroll_bonus_rules` (`id`, `metric_type`, `minimum_value`, `reward_amount`, `description`, `is_active`, `effective_from`, `effective_to`, `created_at`) VALUES
(1, 'delivery_success_rate', 95.00, 150000, 'Thưởng tỷ lệ giao thành công từ 95%', 1, '2026-01-01', NULL, '2026-10-20 14:51:08'),
(2, 'delivery_count', 100.00, 100000, 'Thưởng sản lượng từ 100 đơn giao', 1, '2026-01-01', NULL, '2026-10-20 14:51:08'),
(3, 'on_time_rate', 95.00, 100000, 'Thưởng tỷ lệ giao đúng hẹn từ 95%', 1, '2026-01-01', NULL, '2026-10-20 14:51:08'),
(4, 'attendance_rate', 95.00, 100000, 'Thưởng chuyên cần từ 95%', 1, '2026-01-01', NULL, '2026-10-20 14:51:08');

-- --------------------------------------------------------

--
-- Table structure for table `payroll_deductions`
--

CREATE TABLE `payroll_deductions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(11) NOT NULL,
  `deduction_type` enum('security_deposit','advance') NOT NULL,
  `amount` decimal(15,0) NOT NULL,
  `remaining_amount` decimal(15,0) NOT NULL,
  `reason` varchar(255) NOT NULL,
  `status` enum('open','settled') NOT NULL DEFAULT 'open',
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `settled_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payroll_migration_settings_backup`
--

CREATE TABLE `payroll_migration_settings_backup` (
  `setting_key` varchar(100) NOT NULL,
  `was_present` tinyint(1) NOT NULL,
  `previous_value` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `payroll_migration_settings_backup`
--

INSERT INTO `payroll_migration_settings_backup` (`setting_key`, `was_present`, `previous_value`) VALUES
('PAYROLL_EXPECTED_WORKDAYS', 0, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `payroll_periods`
--

CREATE TABLE `payroll_periods` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `payroll_month` char(7) NOT NULL,
  `status` enum('open','locked') NOT NULL DEFAULT 'open',
  `opened_by` int(11) DEFAULT NULL,
  `locked_by` int(11) DEFAULT NULL,
  `locked_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payslips`
--

CREATE TABLE `payslips` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `payroll_period_id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(11) NOT NULL,
  `gross_amount` decimal(15,0) NOT NULL DEFAULT 0,
  `deduction_amount` decimal(15,0) NOT NULL DEFAULT 0,
  `net_amount` decimal(15,0) NOT NULL DEFAULT 0,
  `snapshot_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`snapshot_json`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payslip_lines`
--

CREATE TABLE `payslip_lines` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `payslip_id` bigint(20) UNSIGNED NOT NULL,
  `line_type` varchar(40) NOT NULL,
  `description` varchar(500) NOT NULL,
  `amount` decimal(15,0) NOT NULL,
  `order_id` int(11) DEFAULT NULL,
  `source_type` varchar(40) DEFAULT NULL,
  `source_id` bigint(20) UNSIGNED DEFAULT NULL,
  `rule_id` bigint(20) UNSIGNED DEFAULT NULL,
  `detail_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`detail_json`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pay_rules`
--

CREATE TABLE `pay_rules` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `event_type` enum('delivery_success','pickup','failed_valid','return') NOT NULL,
  `area_code` varchar(100) NOT NULL,
  `min_weight_kg` decimal(8,3) NOT NULL DEFAULT 0.000,
  `max_weight_kg` decimal(8,3) DEFAULT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `holiday_multiplier_milli` int(10) UNSIGNED NOT NULL DEFAULT 1000,
  `amount_vnd` decimal(15,0) DEFAULT NULL,
  `percent_rate` decimal(7,3) DEFAULT NULL,
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `pay_rules`
--

INSERT INTO `pay_rules` (`id`, `event_type`, `area_code`, `min_weight_kg`, `max_weight_kg`, `start_time`, `end_time`, `holiday_multiplier_milli`, `amount_vnd`, `percent_rate`, `effective_from`, `effective_to`, `created_by`, `created_at`) VALUES
(1, 'delivery_success', 'GOVAP_ALL', 0.000, NULL, NULL, NULL, 1000, 5000, NULL, '2026-01-01', NULL, NULL, '2026-10-20 14:49:09'),
(2, 'pickup', 'GOVAP_ALL', 0.000, NULL, NULL, NULL, 1000, 3000, NULL, '2026-01-01', NULL, NULL, '2026-10-20 14:49:09'),
(3, 'failed_valid', 'GOVAP_ALL', 0.000, NULL, NULL, NULL, 1000, 2000, NULL, '2026-01-01', NULL, NULL, '2026-10-20 14:49:09'),
(4, 'return', 'GOVAP_ALL', 0.000, NULL, NULL, NULL, 1000, 3000, NULL, '2026-01-01', NULL, NULL, '2026-10-20 14:49:09');

-- --------------------------------------------------------

--
-- Table structure for table `reason_codes`
--

CREATE TABLE `reason_codes` (
  `code` varchar(50) NOT NULL,
  `group_type` enum('PICKUP','WAREHOUSE','DELIVERY') NOT NULL,
  `fault_party` enum('customer','shop','driver','company','force_majeure') NOT NULL,
  `pay_driver_fail_fee` tinyint(1) NOT NULL DEFAULT 0,
  `allow_retry` tinyint(1) NOT NULL DEFAULT 0,
  `counts_attempt` tinyint(1) NOT NULL DEFAULT 1,
  `require_evidence` tinyint(1) NOT NULL DEFAULT 0,
  `create_incident` tinyint(1) NOT NULL DEFAULT 0,
  `description` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `reason_codes`
--

INSERT INTO `reason_codes` (`code`, `group_type`, `fault_party`, `pay_driver_fail_fee`, `allow_retry`, `counts_attempt`, `require_evidence`, `create_incident`, `description`) VALUES
('DL_BOMB', 'DELIVERY', 'force_majeure', 0, 0, 1, 1, 1, 'Phát hiện nguy cơ vật liệu nổ hoặc đe dọa an toàn'),
('DL_DRIVER_ACCIDENT', 'DELIVERY', 'driver', 0, 1, 1, 1, 1, 'Tài xế gặp tai nạn trong quá trình giao hàng'),
('DL_FORCE_MAJEURE', 'DELIVERY', 'force_majeure', 0, 1, 0, 1, 1, 'Sự kiện bất khả kháng cản trở việc giao hàng'),
('DL_GOODS_WRONG', 'DELIVERY', 'shop', 0, 0, 1, 1, 1, 'Hàng giao không đúng đơn đặt hàng'),
('DL_HARD_ACCESS', 'DELIVERY', 'force_majeure', 0, 1, 0, 1, 0, 'Không thể tiếp cận địa điểm giao an toàn'),
('DL_NOT_HOME', 'DELIVERY', 'customer', 1, 1, 1, 1, 0, 'Không có người nhận tại địa chỉ giao'),
('DL_NO_CASH', 'DELIVERY', 'customer', 1, 1, 1, 1, 0, 'Người nhận chưa chuẩn bị khoản tiền cần thanh toán'),
('DL_NO_CONTACT', 'DELIVERY', 'customer', 1, 1, 1, 1, 0, 'Không liên hệ được người nhận'),
('DL_REFUSED', 'DELIVERY', 'customer', 1, 0, 1, 1, 0, 'Người nhận từ chối nhận hàng'),
('DL_RESCHEDULE', 'DELIVERY', 'customer', 0, 1, 0, 0, 0, 'Người nhận đề nghị hẹn giao lại'),
('DL_WRONG_ADDRESS', 'DELIVERY', 'customer', 1, 1, 1, 1, 0, 'Địa chỉ giao hàng không chính xác'),
('DL_WRONG_PHONE', 'DELIVERY', 'customer', 1, 1, 1, 1, 0, 'Số điện thoại người nhận không chính xác'),
('PU_BAD_PACKING', 'PICKUP', 'shop', 0, 1, 1, 1, 1, 'Đóng gói không đạt yêu cầu vận chuyển'),
('PU_NOT_READY', 'PICKUP', 'shop', 1, 1, 1, 0, 0, 'Shop chưa chuẩn bị hàng để bàn giao'),
('PU_NO_CONTACT', 'PICKUP', 'customer', 1, 1, 1, 0, 0, 'Không liên hệ được người gửi tại điểm lấy'),
('PU_PROHIBITED_GOODS', 'PICKUP', 'shop', 0, 0, 1, 1, 1, 'Hàng hóa thuộc danh mục cấm vận chuyển'),
('PU_QTY_MISMATCH', 'PICKUP', 'shop', 1, 1, 1, 1, 0, 'Số lượng hàng thực tế không khớp thông tin'),
('PU_SHOP_CANCEL', 'PICKUP', 'shop', 0, 0, 1, 1, 0, 'Shop yêu cầu hủy lấy hàng'),
('PU_WRONG_ADDRESS', 'PICKUP', 'shop', 1, 1, 1, 1, 0, 'Địa chỉ lấy hàng không chính xác'),
('WH_DAMAGED', 'WAREHOUSE', 'company', 0, 0, 1, 1, 1, 'Phát hiện hàng hư hỏng tại kho'),
('WH_LOST', 'WAREHOUSE', 'company', 0, 0, 1, 1, 1, 'Phát hiện hàng thất lạc tại kho'),
('WH_OVER', 'WAREHOUSE', 'company', 0, 0, 0, 1, 1, 'Kiểm kê thừa hàng tại kho'),
('WH_SHORT', 'WAREHOUSE', 'company', 0, 0, 1, 1, 1, 'Kiểm kê thiếu hàng tại kho');

-- --------------------------------------------------------

--
-- Table structure for table `schema_migrations`
--

CREATE TABLE `schema_migrations` (
  `filename` varchar(255) NOT NULL,
  `applied_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `schema_migrations`
--

INSERT INTO `schema_migrations` (`filename`, `applied_at`) VALUES
('001_add_order_audit_reason_tables.sql', '2026-10-20 09:22:13'),
('002_single_govap_central_warehouse.sql', '2026-10-20 09:22:13'),
('003_failure_return_blacklist.sql', '2026-10-20 09:22:13'),
('004_cod_financial_integrity.sql', '2026-10-20 13:53:56'),
('005_integer_vnd_money.sql', '2026-10-20 13:53:56'),
('006_effective_shipping_and_pay_rules.sql', '2026-10-20 14:49:09'),
('007_payroll_period_finalization.sql', '2026-10-20 14:51:08'),
('008_incident_resolution.sql', '2026-10-20 14:51:10'),
('009_order_items_partial_exchange.sql', '2026-10-20 14:51:10'),
('010_chat_token_expiry.sql', '2026-10-20 14:51:10'),
('011_driver_route_optimization.sql', '2026-10-21 04:41:39'),
('012_pickup_route_ranking.sql', '2026-10-21 06:06:24'),
('013_chat_image_messages.sql', '2026-11-01 14:00:51');

-- --------------------------------------------------------

--
-- Table structure for table `service_requests`
--

CREATE TABLE `service_requests` (
  `id` bigint(20) NOT NULL,
  `plan_name` varchar(100) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(50) NOT NULL,
  `message` text DEFAULT NULL,
  `status` enum('new','contacted','closed') NOT NULL DEFAULT 'new',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `service_requests`
--

INSERT INTO `service_requests` (`id`, `plan_name`, `full_name`, `email`, `phone`, `message`, `status`, `created_at`) VALUES
(1, 'Doanh nghiệp', 'Lê Thanh Bình', 'shop.binh@example.com', '0903000001', 'Cần tư vấn bảng giá giao hàng liên tỉnh cho khoảng 500 đơn mỗi tháng.', 'new', '2026-10-20 05:15:34'),
(2, 'Cửa hàng trực tuyến', 'Phạm Ngọc Anh', 'shop.anh@example.com', '0903000002', 'Muốn kết nối quy trình lấy hàng hằng ngày và đối soát COD.', 'contacted', '2026-10-20 05:15:34'),
(3, 'Tiết kiệm', 'Võ Hoàng Sơn', 'shop.son@example.com', '0903000003', 'Đang so sánh chi phí giao hàng cho cửa hàng mới mở.', 'closed', '2026-10-20 05:15:34');

-- --------------------------------------------------------

--
-- Table structure for table `shipment_bags`
--

CREATE TABLE `shipment_bags` (
  `id` bigint(20) NOT NULL,
  `bag_code` varchar(40) NOT NULL,
  `source_warehouse_id` int(11) NOT NULL,
  `destination_warehouse_id` int(11) NOT NULL,
  `status` enum('open','sealed','in_transit','received') NOT NULL DEFAULT 'open',
  `created_by` int(11) DEFAULT NULL,
  `sealed_at` datetime DEFAULT NULL,
  `received_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `shipment_bag_orders`
--

CREATE TABLE `shipment_bag_orders` (
  `bag_id` bigint(20) NOT NULL,
  `order_id` int(11) NOT NULL,
  `added_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `shipping_rates`
--

CREATE TABLE `shipping_rates` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `area_code` varchar(100) NOT NULL,
  `min_weight_kg` decimal(8,3) NOT NULL,
  `max_weight_kg` decimal(8,3) DEFAULT NULL,
  `service_type` enum('economy','standard','express') NOT NULL,
  `base_fee` decimal(15,0) NOT NULL,
  `included_distance_km` decimal(8,3) NOT NULL DEFAULT 0.000,
  `distance_fee_per_km` decimal(15,0) NOT NULL DEFAULT 0,
  `included_weight_kg` decimal(8,3) NOT NULL DEFAULT 0.000,
  `weight_step_kg` decimal(8,3) NOT NULL DEFAULT 1.000,
  `weight_step_fee` decimal(15,0) NOT NULL DEFAULT 0,
  `remote_area_fee` decimal(15,0) NOT NULL DEFAULT 0,
  `fragile_fee` decimal(15,0) NOT NULL DEFAULT 0,
  `motorbike_multiplier_milli` int(10) UNSIGNED NOT NULL DEFAULT 1000,
  `van_multiplier_milli` int(10) UNSIGNED NOT NULL DEFAULT 1000,
  `truck_multiplier_milli` int(10) UNSIGNED NOT NULL DEFAULT 1000,
  `rounding_increment` decimal(15,0) NOT NULL DEFAULT 1,
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `shipping_rates`
--

INSERT INTO `shipping_rates` (`id`, `area_code`, `min_weight_kg`, `max_weight_kg`, `service_type`, `base_fee`, `included_distance_km`, `distance_fee_per_km`, `included_weight_kg`, `weight_step_kg`, `weight_step_fee`, `remote_area_fee`, `fragile_fee`, `motorbike_multiplier_milli`, `van_multiplier_milli`, `truck_multiplier_milli`, `rounding_increment`, `effective_from`, `effective_to`, `created_by`, `created_at`) VALUES
(1, 'GOVAP_ALL', 0.000, NULL, 'economy', 18000, 5.000, 1700, 2.000, 0.500, 4500, 22000, 12000, 1000, 1500, 2500, 1000, '2026-01-01', NULL, NULL, '2026-10-20 13:53:57'),
(2, 'GOVAP_ALL', 0.000, NULL, 'standard', 28000, 5.000, 1700, 2.000, 0.500, 4500, 22000, 12000, 1000, 1500, 2500, 1000, '2026-01-01', NULL, NULL, '2026-10-20 13:53:57'),
(3, 'GOVAP_ALL', 0.000, NULL, 'express', 45000, 5.000, 1700, 2.000, 0.500, 4500, 22000, 12000, 1000, 1500, 2500, 1000, '2026-01-01', NULL, NULL, '2026-10-20 13:53:57');

-- --------------------------------------------------------

--
-- Table structure for table `shop_api_keys`
--

CREATE TABLE `shop_api_keys` (
  `id` bigint(20) NOT NULL,
  `shop_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `key_prefix` varchar(24) NOT NULL,
  `key_hash` char(64) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `last_used_at` datetime DEFAULT NULL,
  `revoked_at` datetime DEFAULT NULL
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
-- Table structure for table `system_settings`
--

CREATE TABLE `system_settings` (
  `setting_key` varchar(100) NOT NULL,
  `setting_value` varchar(255) NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `system_settings`
--

INSERT INTO `system_settings` (`setting_key`, `setting_value`, `updated_at`) VALUES
('central_warehouse_id', '1', '2026-10-20 09:22:13'),
('COD_SETTLEMENT_CYCLE', 'T+1', '2026-10-20 13:53:56'),
('HOLIDAY_DATES', '[]', '2026-10-20 13:53:57'),
('MAX_DELIVERY_ATTEMPTS', '3', '2026-10-20 09:22:13'),
('MAX_PICKUP_ATTEMPTS', '3', '2026-10-20 09:22:13'),
('PAYROLL_EXPECTED_WORKDAYS', '26', '2026-10-20 14:49:10'),
('PICKUP_FIFO_BUCKET_MINUTES', '30', '2026-10-21 06:06:24'),
('PICKUP_MAX_WAIT_MINUTES', '120', '2026-10-21 06:06:24'),
('PICKUP_PRIORITY_ORDER', 'fifo,deadline,distance', '2026-10-21 06:06:24'),
('PICKUP_SLA_MINUTES', '120', '2026-10-21 06:06:24'),
('ROUTE_DEVIATION_THRESHOLD_M', '300', '2026-10-21 04:41:39'),
('ROUTE_MAX_ACTIVE_STOPS', '60', '2026-10-21 04:41:39'),
('ROUTE_NEAR_SLA_HOURS', '2', '2026-10-21 04:41:39'),
('ROUTE_PRIORITY_APPOINTMENT_SECONDS', '600', '2026-10-21 04:41:39'),
('ROUTE_PRIORITY_EXPRESS_SECONDS', '1800', '2026-10-21 04:41:39'),
('ROUTE_PRIORITY_FAILED_SECONDS', '900', '2026-10-21 04:41:39'),
('ROUTE_PRIORITY_SLA_SECONDS', '1200', '2026-10-21 04:41:39');

-- --------------------------------------------------------

--
-- Table structure for table `trucks`
--

CREATE TABLE `trucks` (
  `id` int(11) NOT NULL,
  `vehicle_plate` varchar(30) NOT NULL,
  `max_payload_kg` decimal(10,2) NOT NULL DEFAULT 0.00,
  `status` enum('ready','in_transit','maintenance') NOT NULL DEFAULT 'ready',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
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
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `email`, `password`, `full_name`, `phone`, `shop_address`, `shop_province`, `shop_lat`, `shop_lng`, `role`, `warehouse_id`, `status`, `created_at`) VALUES
(1, 'admin@smartlogistics.vn', 'scrypt$bfe3769c99ac2545f84020ec0e5b0a48$be8236b597a09351bfe58a507f2aed2f7325b16b0ab84cbb19d8ce6cd61d18acaa99aa49b6ff7f61d7fa4f16661bc8bfa950deb53cf5e121e5ff90cfe4d89a56', 'Trần Minh Thảo', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'director', NULL, 'active', '2026-10-20 05:15:34'),
(2, 'hr@smartlogistics.vn', 'scrypt$14df649e2a6c6695e34455739a99393b$e20662558ca2aea1b6d8571bac3d1792e3d9fb656bd1ca59e30a3079fd23e8f8141498d1572992ad38fbb7a25faf5a5ec2e0764e77888b02f893209dd5b40fd9', 'Trương Phòng Nhân Sự', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'hr_manager', NULL, 'active', '2026-10-20 05:15:34'),
(3, 'dieu_hanh@smartlogistics.vn', 'scrypt$44f7c8df9de1d1ad7f1fa504302728db$37f8ac2f696ffb8dabbd41a552a31307c6beff70f9aad826460817d7ff25cae37b58df93f4fea716b7c7697edbcc81b8ffe47d3a06384d0a3eed13ee9ae74cda', 'Diệu Hành', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'fleet_manager', NULL, 'active', '2026-10-20 05:15:34'),
(4, 'ketoan@smartlogistics.vn', 'scrypt$ae9682cc60eaf9ba7b96461dc74c7fc7$782ea2dea6b7ef9411d11068996ee5732bf56a7d2faa7a6e56cb5ecd58fe9e281ddeae30e893be7993c90577c3753778aecafed1f549a9c903acbfa7141f63fc', 'Nguyễn Thị Kế Toán', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'accountant', NULL, 'active', '2026-10-20 05:15:34'),
(5, 'kho@smartlogistics.vn', 'scrypt$72f2b00b5b1308c10f5065c7b6aeb165$52c5411f7cc27004db7798cc079f20adcbac32bbc6155ee0f4d993269298407bf58a26e3c7713ba16aba2ffc29fafd1bfd5d591ec26bb710a71356eaa8fdb4b2', 'Trần Vũ Thủ Kho', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'warehouse_manager', 1, 'active', '2026-10-20 05:15:34'),
(6, 'shop@smartlogistics.vn', 'scrypt$1990a358133ff254e1f33290d3e011a1$b97783c652294c093209146e7fbe86909d85128c77ab60a018ffa7a2aced2ac145e86de2cf3f58e120329fedc8e87bbd095035c6c314c6454c98e163d3af780c', 'Cửa Hàng Trần Minh', NULL, 'Hẻm 499 Quang Trung, Phường Gò Vấp, Gò Vấp, TP. Hồ Chí Minh', 'Gò Vấp, TP. Hồ Chí Minh', 10.832302564714512, 106.66731165730474, 'shop', NULL, 'active', '2026-10-20 05:15:34'),
(7, 'taixe1@smartlogistics.vn', 'scrypt$a5e283354f26a45cee406ad5f65e43a8$0c7c45a2ca53e913e20e2d74e894425f18db19e0de8d6f6d39b89345dd1ea0fae0cea67f611d44283d0b30ff6352e6923775c5280f5210e46cd2ead4f7f14eab', 'Nguyễn Văn Bửu Tài', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'pickup_driver', NULL, 'active', '2026-10-20 05:15:34'),
(8, 'content@smartlogistics.vn', '123', 'Phòng ban nội dung', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'content_manager', NULL, 'active', '2026-10-20 05:15:34'),
(9, 'taixe2@smartlogistics.vn', 'scrypt$d8e0bf3accde18946c85d4c4e8776bce$b0e25109e671fe8874199f4f6aeec1b7997b0f6b456c2d3f7aa1bac661afa45ce314a3e00e7e751809a649261193da2ab7ff96b5d5eb1b805505811f7936994f', 'Bùi Quang Huy', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'pickup_driver', NULL, 'active', '2026-10-20 05:15:34'),
(10, 'taixe3@smartlogistics.vn', 'scrypt$355c0d620ee8728aeaf5753bbaf9af2f$256a24abc4ff5cd9688dd01b164c110d7b3ff55c8aa382c3cf94fa9aa6a092d262b3e043fc6d3ce877a05a7b285bf1cc3bc6c8187c29a5cc86178b03b17392ee', 'Lê Hoàng Nam', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'delivery_driver', NULL, 'active', '2026-10-20 05:15:34'),
(11, 'taixe4@smartlogistics.vn', 'scrypt$3ada595f7884a9496d2651c502903e1e$cd51ab3747b1413f3834659dd57f74d786b5b7e74b45f6ccdfa75331520ca31e93b070837a30514bc744767c087570fff6860d1e21ff1861c281d4d42b6f19c8', 'Phạm Quốc Đạt', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'delivery_driver', NULL, 'active', '2026-10-20 05:15:34'),
(12, 'taixe_tai1@smartlogistics.vn', '123', 'Nguyễn Văn Tải', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'linehaul_driver', NULL, 'active', '2026-10-20 05:15:34'),
(13, 'kho3@smartlogistics.vn', '123', 'Trần Thị Thu Thủ Kho', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'warehouse_manager', 1, 'active', '2026-10-20 05:15:34'),
(14, 'kho2@smartlogistics.vn', 'scrypt$f849bd255c024e1564f076c9a090704e$1a0a46c0790facba2e6f062b4efe5126cbece0a79cfc8e68c30ba28738faf83b229c350a4eac797a04dd7f114e39bb0a7399adb825c8475e4f68dc07a5a5f998', 'Võ Khánh Linh', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'warehouse_manager', 1, 'active', '2026-10-20 05:15:34'),
(15, 'dieu_hanh2@smartlogistics.vn', '123', 'Lê Gia Bảo', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'fleet_manager', NULL, 'active', '2026-10-20 05:15:34'),
(16, 'ketoan2@smartlogistics.vn', '123', 'Phạm Hải Yến', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'accountant', NULL, 'active', '2026-10-20 05:15:34'),
(17, 'hr2@smartlogistics.vn', '123', 'Nguyễn Ngọc Mai', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'hr_manager', NULL, 'active', '2026-10-20 05:15:34'),
(18, 'content2@smartlogistics.vn', '123', 'Đặng Thu Hà', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'content_manager', NULL, 'active', '2026-10-20 05:15:34'),
(19, 'shop2@smartlogistics.vn', '123', 'Công ty Minh Long', NULL, NULL, 'TP. Hồ Chí Minh', NULL, NULL, 'shop', NULL, 'active', '2026-10-20 05:15:34'),
(20, 'nqtstore@smartlogistics.vn', 'scrypt$925e3468c39fabf5b6bded470d930cac$067ea925943cbc7d46999cdb954ee2c1ba75a0bef55a9a6547551f62ded3c062196b3bdfff0b778df30325756eaf4fcf8741c9c6532972c032f5fa64ae41450b', 'NQT Store', '0373636732', 'Hẻm 965/27 Quang Trung, Phường An Hội Tây, TP. Hồ Chí Minh', 'Gò Vấp, TP. Hồ Chí Minh', 10.844544716289441, 106.63749934956395, 'shop', NULL, 'active', '2026-10-21 10:26:36'),
(21, 'shopdientu@gmail.com', 'scrypt$9715253e0dd235c7a920039d1423f9f6$62acbbc54168d80b5dc9abb61f9812257c9393ec67e048faf32ad9c59ab88a1fffa3ba45db271f43d4e4a5de9d14f533ebd460befd7bcd78cb6f3b2f94e2c4f0', 'Shop Điện Tử', '0876565432', 'Hẻm 15 Đường số 4, Phường Thông Tây Hội, TP. Hồ Chí Minh', 'Gò Vấp, TP. Hồ Chí Minh', 10.846352316508511, 106.65761084279973, 'shop', NULL, 'active', '2026-10-24 11:40:43');

-- --------------------------------------------------------

--
-- Table structure for table `warehouses`
--

CREATE TABLE `warehouses` (
  `id` int(11) NOT NULL,
  `warehouse_type` enum('central','ward') NOT NULL,
  `ward_name` varchar(120) NOT NULL,
  `name` varchar(255) NOT NULL,
  `address` text DEFAULT NULL,
  `lat` double DEFAULT NULL,
  `lng` double DEFAULT NULL,
  `is_configured` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `warehouses`
--

INSERT INTO `warehouses` (`id`, `warehouse_type`, `ward_name`, `name`, `address`, `lat`, `lng`, `is_configured`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'central', '__CENTRAL__', 'Kho tổng Gò Vấp', 'Số 2 Nguyễn Văn Bảo, Gò Vấp, TP. Hồ Chí Minh', 10.8231, 106.6881, 1, 1, '2026-10-20 05:15:33', '2026-10-20 09:22:13'),
(2, 'ward', 'Gò Vấp', 'Kho con Gò Vấp', 'Số 2 Nguyễn Văn Bảo, Phường 4, Gò Vấp, TP. Hồ Chí Minh', 10.8231, 106.6881, 1, 0, '2026-10-20 05:15:33', '2026-10-20 09:22:13'),
(3, 'ward', 'Quận 1', 'Kho con Quận 1', 'Số 15 Lê Duẩn, Bến Nghé, Quận 1, TP. Hồ Chí Minh', 10.7798, 106.699, 1, 0, '2026-10-20 05:15:33', '2026-10-20 09:22:13');

-- --------------------------------------------------------

--
-- Table structure for table `warehouse_bin_locations`
--

CREATE TABLE `warehouse_bin_locations` (
  `id` bigint(20) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `bin_code` varchar(80) NOT NULL,
  `bin_name` varchar(120) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `warehouse_bin_locations`
--

INSERT INTO `warehouse_bin_locations` (`id`, `warehouse_id`, `bin_code`, `bin_name`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 1, 'A1-01', 'kho1', 1, '2026-10-21 10:42:59', '2026-10-21 10:42:59'),
(5, 1, 'A1-03', 'Khu điện tử', 1, '2026-10-24 12:26:53', '2026-10-24 12:26:53');

-- --------------------------------------------------------

--
-- Table structure for table `warehouse_inventory_audits`
--

CREATE TABLE `warehouse_inventory_audits` (
  `id` bigint(20) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `created_by` int(11) NOT NULL,
  `status` enum('open','completed') NOT NULL DEFAULT 'open',
  `expected_count` int(11) NOT NULL DEFAULT 0,
  `scanned_count` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `completed_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `warehouse_inventory_audit_items`
--

CREATE TABLE `warehouse_inventory_audit_items` (
  `audit_id` bigint(20) NOT NULL,
  `order_id` int(11) NOT NULL,
  `tracking_code` varchar(100) NOT NULL,
  `reason_code` varchar(50) DEFAULT NULL,
  `reason_actor_id` int(11) DEFAULT NULL,
  `reason_recorded_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `warehouse_inventory_audit_scans`
--

CREATE TABLE `warehouse_inventory_audit_scans` (
  `audit_id` bigint(20) NOT NULL,
  `scan_code` varchar(100) NOT NULL,
  `order_id` int(11) DEFAULT NULL,
  `scanned_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `reason_code` varchar(50) DEFAULT NULL,
  `reason_actor_id` int(11) DEFAULT NULL,
  `reason_recorded_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `warehouse_scope_002_setting_backup`
--

CREATE TABLE `warehouse_scope_002_setting_backup` (
  `setting_key` varchar(100) NOT NULL,
  `setting_value` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `warehouse_scope_002_user_backup`
--

CREATE TABLE `warehouse_scope_002_user_backup` (
  `user_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `warehouse_scope_002_user_backup`
--

INSERT INTO `warehouse_scope_002_user_backup` (`user_id`, `warehouse_id`) VALUES
(5, 1),
(13, 3),
(14, 2);

-- --------------------------------------------------------

--
-- Table structure for table `warehouse_scope_002_warehouse_backup`
--

CREATE TABLE `warehouse_scope_002_warehouse_backup` (
  `warehouse_id` int(11) NOT NULL,
  `warehouse_type` varchar(20) NOT NULL,
  `ward_name` varchar(120) NOT NULL,
  `name` varchar(255) NOT NULL,
  `address` text DEFAULT NULL,
  `lat` double DEFAULT NULL,
  `lng` double DEFAULT NULL,
  `is_configured` tinyint(1) NOT NULL,
  `is_active` tinyint(1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `warehouse_scope_002_warehouse_backup`
--

INSERT INTO `warehouse_scope_002_warehouse_backup` (`warehouse_id`, `warehouse_type`, `ward_name`, `name`, `address`, `lat`, `lng`, `is_configured`, `is_active`) VALUES
(1, 'central', '__CENTRAL__', 'Kho tổng Smart Logistics', '10.762622, 106.660172, TP. Hồ Chí Minh', 10.762622, 106.660172, 1, 1),
(2, 'ward', 'Gò Vấp', 'Kho con Gò Vấp', 'Số 2 Nguyễn Văn Bảo, Phường 4, Gò Vấp, TP. Hồ Chí Minh', 10.8231, 106.6881, 1, 1),
(3, 'ward', 'Quận 1', 'Kho con Quận 1', 'Số 15 Lê Duẩn, Bến Nghé, Quận 1, TP. Hồ Chí Minh', 10.7798, 106.699, 1, 1);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `attendance_records`
--
ALTER TABLE `attendance_records`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_attendance_user_date` (`user_id`,`work_date`),
  ADD KEY `idx_attendance_work_date` (`work_date`);

--
-- Indexes for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_audit_logs_actor_created` (`actor_id`,`created_at`,`id`),
  ADD KEY `idx_audit_logs_entity` (`entity_type`,`entity_id`,`created_at`);

--
-- Indexes for table `chat_messages`
--
ALTER TABLE `chat_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_chat_messages_session` (`session_id`,`id`);

--
-- Indexes for table `chat_sessions`
--
ALTER TABLE `chat_sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_chat_sessions_queue` (`mode`,`status`,`updated_at`),
  ADD KEY `idx_chat_sessions_agent` (`assigned_agent_id`,`status`),
  ADD KEY `idx_chat_sessions_order_driver` (`order_id`,`driver_id`,`status`),
  ADD KEY `idx_chat_sessions_expiry` (`expires_at`);

--
-- Indexes for table `cod_financial_004_setting_backup`
--
ALTER TABLE `cod_financial_004_setting_backup`
  ADD PRIMARY KEY (`setting_key`);

--
-- Indexes for table `cod_settlements`
--
ALTER TABLE `cod_settlements`
  ADD PRIMARY KEY (`id`),
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
ALTER TABLE `department_reports`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `driver_cash_remittances`
--
ALTER TABLE `driver_cash_remittances`
  ADD PRIMARY KEY (`id`),
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
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_driver_expense_status` (`status`,`created_at`),
  ADD KEY `idx_driver_expense_owner` (`driver_id`,`created_at`);

--
-- Indexes for table `driver_incidents`
--
ALTER TABLE `driver_incidents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_driver_incidents_status` (`status`,`created_at`),
  ADD KEY `idx_driver_incidents_fault_party` (`fault_party`,`status`,`created_at`);

--
-- Indexes for table `driver_positions`
--
ALTER TABLE `driver_positions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_shipper_id` (`shipper_id`),
  ADD KEY `idx_order_id` (`order_id`);

--
-- Indexes for table `driver_routes`
--
ALTER TABLE `driver_routes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `order_id` (`order_id`),
  ADD KEY `idx_shipper_id` (`shipper_id`);

--
-- Indexes for table `driver_route_optimization_history`
--
ALTER TABLE `driver_route_optimization_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_route_history_driver` (`driver_id`,`mode`,`created_at`);

--
-- Indexes for table `driver_route_stops`
--
ALTER TABLE `driver_route_stops`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_driver_route_stop` (`driver_id`,`task_type`,`order_id`),
  ADD KEY `idx_driver_route_stop_order` (`driver_id`,`task_type`,`stop_order`,`status`);

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
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_driver_wallet_incident` (`incident_id`),
  ADD KEY `idx_driver_wallet_transactions` (`driver_id`,`created_at`),
  ADD KEY `idx_driver_wallet_order` (`order_id`);

--
-- Indexes for table `employee_payroll_adjustments`
--
ALTER TABLE `employee_payroll_adjustments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_payroll_adjustment_incident` (`incident_id`),
  ADD KEY `idx_payroll_adjustment_user_month` (`user_id`,`payroll_month`);

--
-- Indexes for table `employee_salaries`
--
ALTER TABLE `employee_salaries`
  ADD PRIMARY KEY (`user_id`);

--
-- Indexes for table `employee_salary_history`
--
ALTER TABLE `employee_salary_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_salary_history_effective` (`user_id`,`effective_from`,`effective_to`);

--
-- Indexes for table `failure_settings_003_backup`
--
ALTER TABLE `failure_settings_003_backup`
  ADD PRIMARY KEY (`setting_key`);

--
-- Indexes for table `job_applications`
--
ALTER TABLE `job_applications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_job_applications_status` (`status`,`created_at`);

--
-- Indexes for table `leave_requests`
--
ALTER TABLE `leave_requests`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `linehaul_trips`
--
ALTER TABLE `linehaul_trips`
  ADD PRIMARY KEY (`id`),
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
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `slug` (`slug`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_notifications_recipient` (`recipient_user_id`,`is_read`,`created_at`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
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
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_orders_cod_remittance` (`cod_remittance_id`),
  ADD KEY `idx_orders_cod_settlement` (`cod_settlement_id`),
  ADD KEY `idx_orders_shipping_rate` (`shipping_rate_id`);

--
-- Indexes for table `order_blacklist`
--
ALTER TABLE `order_blacklist`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_order_blacklist_type_value` (`entry_type`,`normalized_value`),
  ADD KEY `idx_order_blacklist_last_order` (`last_order_id`);

--
-- Indexes for table `order_bomb_incidents`
--
ALTER TABLE `order_bomb_incidents`
  ADD PRIMARY KEY (`order_id`,`entry_type`,`normalized_value`),
  ADD KEY `idx_bomb_incident_match` (`entry_type`,`normalized_value`);

--
-- Indexes for table `order_events`
--
ALTER TABLE `order_events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_order_events_order_created` (`order_id`,`created_at`,`id`),
  ADD KEY `idx_order_events_actor_created` (`actor_id`,`created_at`),
  ADD KEY `idx_order_events_reason_code` (`reason_code`),
  ADD KEY `idx_order_events_created_at` (`created_at`);

--
-- Indexes for table `order_items`
--
ALTER TABLE `order_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_order_items_order_direction` (`order_id`,`direction`);

--
-- Indexes for table `order_status_history`
--
ALTER TABLE `order_status_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_order_status_history_order` (`order_id`,`created_at`);

--
-- Indexes for table `payroll_bonus_rules`
--
ALTER TABLE `payroll_bonus_rules`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_payroll_bonus_effective` (`metric_type`,`is_active`,`effective_from`,`effective_to`);

--
-- Indexes for table `payroll_deductions`
--
ALTER TABLE `payroll_deductions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_payroll_deductions_user` (`user_id`,`status`,`id`);

--
-- Indexes for table `payroll_migration_settings_backup`
--
ALTER TABLE `payroll_migration_settings_backup`
  ADD PRIMARY KEY (`setting_key`);

--
-- Indexes for table `payroll_periods`
--
ALTER TABLE `payroll_periods`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_payroll_period_month` (`payroll_month`);

--
-- Indexes for table `payslips`
--
ALTER TABLE `payslips`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_payslip_period_user` (`payroll_period_id`,`user_id`),
  ADD KEY `idx_payslip_user` (`user_id`,`payroll_period_id`);

--
-- Indexes for table `payslip_lines`
--
ALTER TABLE `payslip_lines`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_payslip_lines_slip` (`payslip_id`,`id`),
  ADD KEY `idx_payslip_lines_order` (`order_id`);

--
-- Indexes for table `pay_rules`
--
ALTER TABLE `pay_rules`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_pay_rules_lookup` (`event_type`,`area_code`,`effective_from`,`effective_to`),
  ADD KEY `idx_pay_rules_weight` (`min_weight_kg`,`max_weight_kg`);

--
-- Indexes for table `reason_codes`
--
ALTER TABLE `reason_codes`
  ADD PRIMARY KEY (`code`),
  ADD KEY `idx_reason_codes_group` (`group_type`),
  ADD KEY `idx_reason_codes_fault_party` (`fault_party`);

--
-- Indexes for table `schema_migrations`
--
ALTER TABLE `schema_migrations`
  ADD PRIMARY KEY (`filename`);

--
-- Indexes for table `service_requests`
--
ALTER TABLE `service_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_service_requests_status` (`status`,`created_at`);

--
-- Indexes for table `shipment_bags`
--
ALTER TABLE `shipment_bags`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `bag_code` (`bag_code`),
  ADD KEY `idx_shipment_bags_route` (`source_warehouse_id`,`destination_warehouse_id`,`status`);

--
-- Indexes for table `shipment_bag_orders`
--
ALTER TABLE `shipment_bag_orders`
  ADD PRIMARY KEY (`bag_id`,`order_id`),
  ADD KEY `idx_shipment_bag_orders_order` (`order_id`);

--
-- Indexes for table `shipping_rates`
--
ALTER TABLE `shipping_rates`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_shipping_rates_lookup` (`area_code`,`service_type`,`effective_from`,`effective_to`),
  ADD KEY `idx_shipping_rates_weight` (`min_weight_kg`,`max_weight_kg`);

--
-- Indexes for table `shop_api_keys`
--
ALTER TABLE `shop_api_keys`
  ADD PRIMARY KEY (`id`),
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
-- Indexes for table `system_settings`
--
ALTER TABLE `system_settings`
  ADD PRIMARY KEY (`setting_key`);

--
-- Indexes for table `trucks`
--
ALTER TABLE `trucks`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `vehicle_plate` (`vehicle_plate`),
  ADD KEY `idx_trucks_status` (`status`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `warehouses`
--
ALTER TABLE `warehouses`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_warehouse_ward` (`ward_name`),
  ADD KEY `idx_warehouse_type_active` (`warehouse_type`,`is_active`);

--
-- Indexes for table `warehouse_bin_locations`
--
ALTER TABLE `warehouse_bin_locations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_warehouse_bin_code` (`warehouse_id`,`bin_code`),
  ADD KEY `idx_warehouse_bin_active` (`warehouse_id`,`is_active`);

--
-- Indexes for table `warehouse_inventory_audits`
--
ALTER TABLE `warehouse_inventory_audits`
  ADD PRIMARY KEY (`id`),
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
-- Indexes for table `warehouse_scope_002_setting_backup`
--
ALTER TABLE `warehouse_scope_002_setting_backup`
  ADD PRIMARY KEY (`setting_key`);

--
-- Indexes for table `warehouse_scope_002_user_backup`
--
ALTER TABLE `warehouse_scope_002_user_backup`
  ADD PRIMARY KEY (`user_id`);

--
-- Indexes for table `warehouse_scope_002_warehouse_backup`
--
ALTER TABLE `warehouse_scope_002_warehouse_backup`
  ADD PRIMARY KEY (`warehouse_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `attendance_records`
--
ALTER TABLE `attendance_records`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=54;

--
-- AUTO_INCREMENT for table `audit_logs`
--
ALTER TABLE `audit_logs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- AUTO_INCREMENT for table `chat_messages`
--
ALTER TABLE `chat_messages`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `chat_sessions`
--
ALTER TABLE `chat_sessions`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `cod_settlements`
--
ALTER TABLE `cod_settlements`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `department_reports`
--
ALTER TABLE `department_reports`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `driver_cash_remittances`
--
ALTER TABLE `driver_cash_remittances`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `driver_expense_claims`
--
ALTER TABLE `driver_expense_claims`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `driver_incidents`
--
ALTER TABLE `driver_incidents`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `driver_positions`
--
ALTER TABLE `driver_positions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `driver_routes`
--
ALTER TABLE `driver_routes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `driver_route_optimization_history`
--
ALTER TABLE `driver_route_optimization_history`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT for table `driver_route_stops`
--
ALTER TABLE `driver_route_stops`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `driver_wallet_transactions`
--
ALTER TABLE `driver_wallet_transactions`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `employee_payroll_adjustments`
--
ALTER TABLE `employee_payroll_adjustments`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `employee_salary_history`
--
ALTER TABLE `employee_salary_history`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- AUTO_INCREMENT for table `job_applications`
--
ALTER TABLE `job_applications`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `leave_requests`
--
ALTER TABLE `leave_requests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `linehaul_trips`
--
ALTER TABLE `linehaul_trips`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `news_articles`
--
ALTER TABLE `news_articles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=47;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT for table `order_blacklist`
--
ALTER TABLE `order_blacklist`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `order_events`
--
ALTER TABLE `order_events`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=37;

--
-- AUTO_INCREMENT for table `order_items`
--
ALTER TABLE `order_items`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- AUTO_INCREMENT for table `order_status_history`
--
ALTER TABLE `order_status_history`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=37;

--
-- AUTO_INCREMENT for table `payroll_bonus_rules`
--
ALTER TABLE `payroll_bonus_rules`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `payroll_deductions`
--
ALTER TABLE `payroll_deductions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payroll_periods`
--
ALTER TABLE `payroll_periods`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payslips`
--
ALTER TABLE `payslips`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payslip_lines`
--
ALTER TABLE `payslip_lines`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `pay_rules`
--
ALTER TABLE `pay_rules`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `service_requests`
--
ALTER TABLE `service_requests`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `shipment_bags`
--
ALTER TABLE `shipment_bags`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `shipping_rates`
--
ALTER TABLE `shipping_rates`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `shop_api_keys`
--
ALTER TABLE `shop_api_keys`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `trucks`
--
ALTER TABLE `trucks`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `warehouses`
--
ALTER TABLE `warehouses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `warehouse_bin_locations`
--
ALTER TABLE `warehouse_bin_locations`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `warehouse_inventory_audits`
--
ALTER TABLE `warehouse_inventory_audits`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `order_items`
--
ALTER TABLE `order_items`
  ADD CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
