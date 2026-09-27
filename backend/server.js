const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const http = require('http'); 
const { Server } = require('socket.io'); 
const multer = require('multer');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Mở quyền truy cập file tĩnh để Frontend load được ảnh minh chứng
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Tự động tạo thư mục chứa ảnh nếu chưa có
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// =========================================
// CẤU HÌNH UPLOAD ẢNH (MULTER) & EMAIL (NODEMAILER)
// =========================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, 'POD-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });
const reportStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, 'report-' + Date.now() + '-' + crypto.randomBytes(6).toString('hex') + path.extname(file.originalname).toLowerCase());
  }
});
const reportUpload = multer({
  storage: reportStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedExtensions = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|csv|txt|jpg|jpeg|png|webp)$/i;
    if (!allowedExtensions.test(path.extname(file.originalname))) {
      return cb(new Error('Định dạng tệp không được hỗ trợ.'));
    }
    cb(null, true);
  }
});

const departments = ['Phòng Tài Chính', 'Phòng Điều Phối', 'Phòng Kho', 'Phòng Nhân Sự', 'Phòng Nội Dung'];

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'thaitran2706@gmail.com', // ĐIỀN EMAIL CỦA BẠN VÀO ĐÂY
    pass: '100604TH@i' // ĐIỀN APP PASSWORD VÀO ĐÂY
  }
});

// TẠO HTTP SERVER VÀ GẮN SOCKET.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173', 
    methods: ['GET', 'POST']
  }
});

// LẮNG NGHE KẾT NỐI REALTIME (WEBSOCKET)
io.on('connection', (socket) => {
  console.log('⚡ Một thiết bị vừa kết nối WebSocket:', socket.id);

  socket.on('driver_update_location', (data) => {
    const payload = data || {};
    if (payload.shipper_id && payload.lat && payload.lng) {
      db.query(
        'INSERT INTO driver_positions (order_id, shipper_id, lat, lng, route_status) VALUES (?, ?, ?, ?, ?)',
        [payload.order_id || null, payload.shipper_id, payload.lat, payload.lng, payload.route_status || 'moving'],
        (err) => {
          if (err) console.error('Lỗi lưu vị trí tài xế realtime:', err);
        }
      );
    }
    io.emit('driver_location_changed', payload);
  });

  socket.on('disconnect', () => {
    console.log('Thiết bị ngắt kết nối:', socket.id);
  });
});

// KẾT NỐI DATABASE MYSQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', 
  database: 'smart_logistics_v2'
});

db.connect((err) => {
  if (err) {
    console.error('Lỗi kết nối CSDL:', err);
    return;
  }
  console.log('Đã kết nối Database: smart_logistics_v2 🚀');

  const setupTables = [
    `
      CREATE TABLE IF NOT EXISTS news_articles (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS driver_routes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        shipper_id INT NULL,
        warehouse_lat DOUBLE DEFAULT 10.762622,
        warehouse_lng DOUBLE DEFAULT 106.660172,
        pickup_lat DOUBLE DEFAULT 10.7605,
        pickup_lng DOUBLE DEFAULT 106.6545,
        delivery_lat DOUBLE DEFAULT 10.7745,
        delivery_lng DOUBLE DEFAULT 106.6665,
        route_status VARCHAR(50) DEFAULT 'assigned',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS driver_positions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NULL,
        shipper_id INT NOT NULL,
        lat DOUBLE NOT NULL,
        lng DOUBLE NOT NULL,
        route_status VARCHAR(50) DEFAULT 'moving',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS order_status_history (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        from_status VARCHAR(50) DEFAULT NULL,
        to_status VARCHAR(50) NOT NULL,
        note TEXT DEFAULT NULL,
        proof_image VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_order_status_history_order (order_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS cod_settlements (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        shop_id INT NOT NULL,
        total_cod DECIMAL(12,2) NOT NULL DEFAULT 0,
        order_count INT NOT NULL DEFAULT 0,
        settled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_cod_settlements_shop (shop_id, settled_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS service_requests (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        plan_name VARCHAR(100) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        message TEXT DEFAULT NULL,
        status ENUM('new','contacted','closed') NOT NULL DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_service_requests_status (status, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS job_applications (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS attendance_records (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        work_date DATE NOT NULL,
        check_in DATETIME DEFAULT NULL,
        check_out DATETIME DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_attendance_user_date (user_id, work_date),
        KEY idx_attendance_work_date (work_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS employee_salaries (
        user_id INT PRIMARY KEY,
        monthly_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
        allowance DECIMAL(12,2) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS department_leaders (
        department VARCHAR(255) PRIMARY KEY,
        user_id INT NOT NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_department_leader_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `
  ];

  setupTables.forEach((sql) => {
    db.query(sql, (createErr) => {
      if (createErr) console.error('Lỗi khởi tạo bảng:', createErr);
    });
  });

  db.query('ALTER TABLE attendance_records DROP INDEX uq_attendance_user_date, ADD INDEX idx_attendance_user_date (user_id, work_date)', (alterErr) => {
    if (alterErr && alterErr.code !== 'ER_CANT_DROP_FIELD_OR_KEY' && alterErr.code !== 'ER_NO_SUCH_TABLE') {
      console.error('Lỗi cập nhật chỉ mục chấm công:', alterErr);
    }
  });

  db.query('ALTER TABLE department_reports ADD COLUMN attachment_url VARCHAR(255) DEFAULT NULL', (alterErr) => {
    if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
      console.error('Lỗi bổ sung tệp đính kèm báo cáo:', alterErr);
    }
  });

  db.query('ALTER TABLE orders ADD COLUMN length DECIMAL(8,2) DEFAULT 0', (alterErr) => {
    if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
      console.error('Lỗi bổ sung cột length cho orders:', alterErr);
    }
  });

  db.query('ALTER TABLE orders ADD COLUMN vehicle_type VARCHAR(50) DEFAULT "motorbike"', (alterErr) => {
    if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
      console.error('Lỗi bổ sung cột vehicle_type cho orders:', alterErr);
    }
  });

  db.query('ALTER TABLE orders ADD COLUMN destination_province VARCHAR(255) DEFAULT "Hồ Chí Minh"', (alterErr) => {
    if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
      console.error('Lỗi bổ sung cột destination_province cho orders:', alterErr);
    }
  });

  db.query('ALTER TABLE orders ADD COLUMN cod_collected TINYINT(1) NOT NULL DEFAULT 0', (alterErr) => {
    if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
      console.error('Lỗi bổ sung cột cod_collected cho orders:', alterErr);
    }
  });

  db.query('ALTER TABLE orders ADD COLUMN cod_settlement_id INT NULL', (alterErr) => {
    if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
      console.error('Lỗi bổ sung cột cod_settlement_id cho orders:', alterErr);
    }
  });

  db.query('ALTER TABLE orders ADD COLUMN receiver_lat DOUBLE DEFAULT NULL', (alterErr) => {
    if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
      console.error('Lỗi bổ sung cột receiver_lat cho orders:', alterErr);
    }
  });

  db.query('ALTER TABLE orders ADD COLUMN receiver_lng DOUBLE DEFAULT NULL', (alterErr) => {
    if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
      console.error('Lỗi bổ sung cột receiver_lng cho orders:', alterErr);
    }
  });

  db.query("ALTER TABLE orders ADD COLUMN cod_payment_method ENUM('cash','bank_transfer') DEFAULT NULL", (alterErr) => {
    if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
      console.error('Lỗi bổ sung cột cod_payment_method cho orders:', alterErr);
    }
  });

  db.query('ALTER TABLE orders ADD COLUMN cod_collected_amount DECIMAL(12,2) NOT NULL DEFAULT 0', (alterErr) => {
    if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
      console.error('Lỗi bổ sung cột cod_collected_amount cho orders:', alterErr);
    }
  });

  console.log('Đã đảm bảo bảng news_articles, driver_routes, driver_positions sẵn sàng');
});

function recordOrderStatus(orderId, fromStatus, toStatus, note, proofImage, callback) {
  const sql = `
    INSERT INTO order_status_history (order_id, from_status, to_status, note, proof_image)
    VALUES (?, ?, ?, ?, ?)
  `;
  db.query(sql, [orderId, fromStatus, toStatus, note || null, proofImage || null], (err) => {
    if (err) console.error('Lỗi ghi lịch sử trạng thái đơn:', err);
    if (callback) callback();
  });
}

// =========================================
// 1. API HỆ THỐNG CHUNG
// =========================================
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const sql = 'SELECT id, email, full_name, role FROM users WHERE email = ? AND password = ? AND status = "active"';
  
  db.query(sql, [email, password], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Lỗi server: ' + err.sqlMessage });
    if (results.length > 0) {
      res.json({ success: true, user: results[0] });
    } else {
      res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác' });
    }
  });
});

// =========================================
// 2. API CỬA HÀNG (SHOP) & KHÁCH HÀNG
// =========================================
app.post('/api/orders', (req, res) => {
  const {
    tracking_code,
    shop_id,
    shop_address,
    shop_province,
    shop_lat,
    shop_lng,
    receiver_name,
    receiver_phone,
    receiver_address,
    receiver_lat,
    receiver_lng,
    customer_email,
    cod_amount,
    shipping_fee,
    weight_kg,
    length,
    width,
    height,
    item_value,
    distance_km,
    is_remote_area,
    service_type,
    is_fragile,
    vehicle_type,
    destination_province
  } = req.body;

  const numericFields = { cod_amount, shipping_fee, weight_kg, length, width, height, item_value, distance_km, shop_lat, shop_lng, receiver_lat, receiver_lng };
  const hasInvalidNumber = Object.entries(numericFields).some(([, value]) => value !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 0));
  const normalizedReceiverLat = receiver_lat === undefined || receiver_lat === null || receiver_lat === '' ? null : Number(receiver_lat);
  const normalizedReceiverLng = receiver_lng === undefined || receiver_lng === null || receiver_lng === '' ? null : Number(receiver_lng);
  const normalizedVehicle = ['motorbike', 'van', 'truck', 'airplane'].includes(vehicle_type) ? vehicle_type : 'motorbike';
  const provinceName = String(destination_province || 'Hồ Chí Minh').trim() || 'Hồ Chí Minh';
  const localProvinces = ['Hồ Chí Minh', 'Bình Dương', 'Đồng Nai', 'Long An', 'Tiền Giang', 'Vĩnh Long', 'Bến Tre', 'Cần Thơ', 'An Giang', 'Kiên Giang', 'Bà Rịa - Vũng Tàu', 'Đồng Tháp', 'Sóc Trăng', 'Trà Vinh', 'Hậu Giang', 'Bạc Liêu', 'Cà Mau', 'Bình Phước', 'Tây Ninh'];
  const effectiveRemoteArea = Boolean(is_remote_area) || !localProvinces.includes(provinceName);

  if (!tracking_code || !shop_address || !receiver_name || !receiver_phone || !receiver_address) {
    return res.status(400).json({ success: false, message: 'Thiếu mã vận đơn, địa chỉ cửa hàng hoặc thông tin người nhận.' });
  }

  if (hasInvalidNumber || Number(weight_kg) <= 0 || Number(length) <= 0 || Number(width) <= 0 || Number(height) <= 0 || Number(distance_km) <= 0) {
    return res.status(400).json({ success: false, message: 'Thông tin cân nặng, kích thước hoặc khoảng cách không hợp lệ.' });
  }
  if ((normalizedReceiverLat !== null && Math.abs(normalizedReceiverLat) > 90) || (normalizedReceiverLng !== null && Math.abs(normalizedReceiverLng) > 180)) {
    return res.status(400).json({ success: false, message: 'Tọa độ điểm giao hàng không hợp lệ.' });
  }

  if (!['economy', 'standard', 'express'].includes(service_type)) {
    return res.status(400).json({ success: false, message: 'Loại dịch vụ không hợp lệ.' });
  }

  const sql = `
    INSERT INTO orders (
      tracking_code, shop_id, shop_address, shop_province, shop_lat, shop_lng, receiver_name, receiver_phone, receiver_address, receiver_lat, receiver_lng, customer_email,
      cod_amount, shipping_fee, weight_kg, length, width, height, item_value, distance_km,
      is_remote_area, service_type, is_fragile, vehicle_type, destination_province, status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `;
  db.query(sql, [
    tracking_code,
    shop_id || null,
    String(shop_address || '').trim(),
    String(shop_province || 'Hồ Chí Minh').trim(),
    Number(shop_lat) || 10.762622,
    Number(shop_lng) || 106.660172,
    receiver_name,
    receiver_phone,
    receiver_address,
    normalizedReceiverLat,
    normalizedReceiverLng,
    customer_email || null,
    Number(cod_amount) || 0,
    Number(shipping_fee) || 0,
    Number(weight_kg),
    Number(length),
    Number(width),
    Number(height),
    Number(item_value) || 0,
    Number(distance_km),
    effectiveRemoteArea,
    service_type,
    Boolean(is_fragile),
    normalizedVehicle,
    provinceName,
  ], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'Mã vận đơn đã tồn tại, vui lòng tạo lại đơn.' });
      }
      return res.status(500).json({ success: false, message: 'Lỗi lưu đơn hàng: ' + err.sqlMessage });
    }
    recordOrderStatus(result.insertId, null, 'pending', 'Shop tạo đơn hàng', null, () => {
      res.json({ success: true, message: 'Tạo đơn hàng thành công!', orderId: result.insertId, tracking_code });
    });
  });
});

app.get('/api/orders', (req, res) => {
  const sql = 'SELECT * FROM orders ORDER BY created_at DESC';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Lỗi tải dữ liệu: ' + err.sqlMessage });
    res.json({ success: true, data: results });
  });
});

app.get('/api/news', (req, res) => {
  const sql = 'SELECT * FROM news_articles WHERE status = "published" ORDER BY created_at DESC';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Lỗi tải tin tức: ' + err.sqlMessage });
    res.json({ success: true, data: results });
  });
});

app.post('/api/public/service-requests', (req, res) => {
  const { plan_name, full_name, email, phone, message } = req.body;
  if (![plan_name, full_name, email, phone].every((value) => String(value || '').trim())) {
    return res.status(400).json({ success: false, message: 'Vui lòng điền gói dịch vụ, họ tên, email và số điện thoại.' });
  }

  const sql = `
    INSERT INTO service_requests (plan_name, full_name, email, phone, message)
    VALUES (?, ?, ?, ?, ?)
  `;
  db.query(sql, [plan_name.trim(), full_name.trim(), email.trim(), phone.trim(), String(message || '').trim() || null], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: 'Không thể gửi yêu cầu: ' + err.sqlMessage });
    res.status(201).json({ success: true, requestId: result.insertId, message: 'Đã nhận yêu cầu tư vấn. Smart Logistics sẽ liên hệ với bạn.' });
  });
});

app.post('/api/public/job-applications', (req, res) => {
  const { job_title, full_name, email, phone, experience, message } = req.body;
  if (![job_title, full_name, email, phone].every((value) => String(value || '').trim())) {
    return res.status(400).json({ success: false, message: 'Vui lòng điền vị trí ứng tuyển, họ tên, email và số điện thoại.' });
  }

  const sql = `
    INSERT INTO job_applications (job_title, full_name, email, phone, experience, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  db.query(sql, [job_title.trim(), full_name.trim(), email.trim(), phone.trim(), String(experience || '').trim() || null, String(message || '').trim() || null], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: 'Không thể gửi hồ sơ: ' + err.sqlMessage });
    res.status(201).json({ success: true, applicationId: result.insertId, message: 'Đã nhận hồ sơ ứng tuyển của bạn.' });
  });
});

app.get('/api/hr/job-applications', (req, res) => {
  db.query('SELECT * FROM job_applications ORDER BY created_at DESC', (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true, data: results });
  });
});

app.put('/api/hr/job-applications/:id/status', (req, res) => {
  const validStatuses = ['new', 'reviewing', 'accepted', 'rejected'];
  if (!validStatuses.includes(req.body.status)) {
    return res.status(400).json({ success: false, message: 'Trạng thái hồ sơ không hợp lệ.' });
  }
  db.query('UPDATE job_applications SET status = ? WHERE id = ?', [req.body.status, req.params.id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ ứng tuyển.' });
    res.json({ success: true });
  });
});

app.get('/api/hr/service-requests', (req, res) => {
  db.query('SELECT * FROM service_requests ORDER BY created_at DESC', (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true, data: results });
  });
});

app.put('/api/hr/service-requests/:id/status', (req, res) => {
  const validStatuses = ['new', 'contacted', 'closed'];
  if (!validStatuses.includes(req.body.status)) {
    return res.status(400).json({ success: false, message: 'Trạng thái yêu cầu không hợp lệ.' });
  }
  db.query('UPDATE service_requests SET status = ? WHERE id = ?', [req.body.status, req.params.id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu tư vấn.' });
    res.json({ success: true });
  });
});

app.get('/api/news/admin', (req, res) => {
  const sql = 'SELECT * FROM news_articles ORDER BY created_at DESC';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Lỗi tải danh sách quản trị: ' + err.sqlMessage });
    res.json({ success: true, data: results });
  });
});

app.get('/api/news/:id', (req, res) => {
  const sql = 'SELECT * FROM news_articles WHERE id = ?';
  db.query(sql, [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Lỗi tải chi tiết tin tức: ' + err.sqlMessage });
    if (results.length === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy bài tin tức.' });
    res.json({ success: true, data: results[0] });
  });
});

app.post('/api/news', (req, res) => {
  const { title, summary, content, image_url, category, created_by, status } = req.body;

  if (!title || !summary || !content) {
    return res.status(400).json({ success: false, message: 'Thiếu tiêu đề, mô tả hoặc nội dung.' });
  }

  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  const sql = `
    INSERT INTO news_articles (title, slug, summary, content, image_url, category, created_by, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [title, slug, summary, content, image_url || null, category || 'Tin tức', created_by || 'content_team', status || 'published'], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: 'Lỗi lưu tin tức: ' + err.sqlMessage });
    res.json({ success: true, message: 'Đã lưu tin tức thành công.', articleId: result.insertId });
  });
});

app.put('/api/news/:id', (req, res) => {
  const { title, summary, content, image_url, category, status } = req.body;

  if (!title || !summary || !content) {
    return res.status(400).json({ success: false, message: 'Thiếu tiêu đề, mô tả hoặc nội dung.' });
  }

  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  const sql = `
    UPDATE news_articles
    SET title = ?, slug = ?, summary = ?, content = ?, image_url = ?, category = ?, status = ?
    WHERE id = ?
  `;

  db.query(sql, [title, slug, summary, content, image_url || null, category || 'Tin tức', status || 'published', req.params.id], (err) => {
    if (err) return res.status(500).json({ success: false, message: 'Lỗi cập nhật tin tức: ' + err.sqlMessage });
    res.json({ success: true, message: 'Đã cập nhật bài tin tức thành công.' });
  });
});

app.delete('/api/news/:id', (req, res) => {
  db.query('DELETE FROM news_articles WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ success: false, message: 'Lỗi xóa tin tức: ' + err.sqlMessage });
    res.json({ success: true, message: 'Đã xóa bài tin tức thành công.' });
  });
});

app.get('/api/orders/track/:code', (req, res) => {
  const sql = `
    SELECT o.*, u.full_name as shipper_name
    FROM orders o
    LEFT JOIN users u ON o.shipper_id = u.id
    WHERE o.tracking_code = ?
  `;
  db.query(sql, [req.params.code], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Lỗi truy xuất: ' + err.sqlMessage });
    if (results.length === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng!' });

    const order = results[0];
    const warehouse = {
      lat: 10.762622,
      lng: 106.660172,
      label: 'Kho trung tâm Smart Logistics',
      address: 'Kho trung tâm, TP. Hồ Chí Minh'
    };
    const pickup = { lat: Number(order.shop_lat), lng: Number(order.shop_lng), label: 'Điểm lấy hàng', address: order.shop_address };
    const delivery = { lat: Number(order.receiver_lat || 10.7745), lng: Number(order.receiver_lng || 106.6665), label: 'Điểm giao hàng', address: order.receiver_address };

    const driverPosSql = 'SELECT * FROM driver_positions WHERE order_id = ? ORDER BY created_at DESC LIMIT 1';
    db.query(driverPosSql, [order.id], (driverErr, driverResults) => {
      const driverLocation = driverResults && driverResults.length > 0
        ? { lat: driverResults[0].lat, lng: driverResults[0].lng, updated_at: driverResults[0].created_at }
        : { lat: 10.767, lng: 106.661, updated_at: new Date().toISOString() };

      db.query(
        'SELECT id, from_status, to_status, note, proof_image, created_at FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC, id ASC',
        [order.id],
        (historyErr, statusHistory) => {
          res.json({
            success: true,
            data: {
              ...order,
              warehouse,
              pickup,
              delivery,
              driver_location: driverLocation,
              status_history: historyErr ? [] : statusHistory,
              route_points: [warehouse, pickup, delivery],
              progress: order.status === 'pending' ? 15 : order.status === 'picking' ? 40 : order.status === 'in_warehouse' ? 65 : order.status === 'delivering' ? 80 : order.status === 'completed' ? 100 : 0
            }
          });
        }
      );
    });
  });
});

app.get('/api/orders/:id/route', (req, res) => {
  const orderId = req.params.id;
  const sql = `
        SELECT o.id, o.tracking_code, o.status, o.shipper_id,
          o.shop_address, o.shop_province, o.receiver_address, o.receiver_lat, o.receiver_lng,
           10.762622 AS warehouse_lat,
           106.660172 AS warehouse_lng,
          COALESCE(o.shop_lat, dr.pickup_lat, 10.7605) AS pickup_lat,
          COALESCE(o.shop_lng, dr.pickup_lng, 106.6545) AS pickup_lng,
          COALESCE(o.receiver_lat, dr.delivery_lat, 10.7745) AS delivery_lat,
          COALESCE(o.receiver_lng, dr.delivery_lng, 106.6665) AS delivery_lng,
           dr.route_status
    FROM orders o
    LEFT JOIN driver_routes dr ON dr.order_id = o.id
    WHERE o.id = ?
    LIMIT 1
  `;

  db.query(sql, [orderId], (err, results) => {
    if (err) {
      console.error('Lỗi lấy route:', err);
      return res.status(500).json({ success: false, message: 'Lỗi lấy thông tin lộ trình: ' + err.sqlMessage });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng để tạo lộ trình.' });
    }

    const order = results[0];
    const route = {
      order_id: order.id,
      tracking_code: order.tracking_code,
      status: order.status,
      shipper_id: order.shipper_id,
      warehouse: {
        lat: Number(order.warehouse_lat),
        lng: Number(order.warehouse_lng),
        label: 'Kho trung tâm Smart Logistics',
        address: 'Kho trung tâm, TP. Hồ Chí Minh'
      },
      pickup: {
        lat: Number(order.pickup_lat),
        lng: Number(order.pickup_lng),
        label: 'Điểm lấy hàng',
        address: [order.shop_address, order.shop_province].filter(Boolean).join(', ')
      },
      delivery: {
        lat: Number(order.delivery_lat),
        lng: Number(order.delivery_lng),
        label: 'Điểm giao hàng',
        address: order.receiver_address
      },
      route_status: order.route_status || 'assigned',
      route_points: [
        { lat: Number(order.warehouse_lat), lng: Number(order.warehouse_lng), label: 'Kho trung tâm Smart Logistics' },
        { lat: Number(order.pickup_lat), lng: Number(order.pickup_lng), label: 'Điểm lấy hàng' },
        { lat: Number(order.delivery_lat), lng: Number(order.delivery_lng), label: 'Điểm giao hàng' }
      ]
    };

    if (!order.shipper_id) {
      return res.json({ success: true, data: route });
    }

    const driverPosSql = 'SELECT * FROM driver_positions WHERE order_id = ? ORDER BY created_at DESC LIMIT 1';
    db.query(driverPosSql, [order.id], (driverErr, driverResults) => {
      if (!driverErr && driverResults.length > 0) {
        route.driver_location = {
          lat: Number(driverResults[0].lat),
          lng: Number(driverResults[0].lng),
          updated_at: driverResults[0].created_at,
          route_status: driverResults[0].route_status
        };
      }

      res.json({ success: true, data: route });
    });
  });
});

// =========================================
// 3. API ĐIỀU PHỐI & TÀI XẾ
// =========================================
app.get('/api/shippers', (req, res) => {
  const sql = "SELECT id, full_name, email FROM users WHERE role IN ('shipper', 'driver') AND status = 'active'";
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true, data: results });
  });
});

app.put('/api/orders/:id/assign', (req, res) => {
  const { shipper_id } = req.body;
  const orderId = req.params.id;

  if (!shipper_id) {
    return res.status(400).json({ success: false, message: 'Thiếu ID của tài xế!' });
  }

  db.query('SELECT status FROM orders WHERE id = ?', [orderId], (selectErr, orders) => {
    if (selectErr) return res.status(500).json({ success: false, message: 'Lỗi DB: ' + selectErr.sqlMessage });
    if (!orders.length) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const previousStatus = orders[0].status;
    if (!['pending', 'in_warehouse'].includes(previousStatus)) {
      return res.status(409).json({ success: false, message: `Không thể phân công đơn ở trạng thái "${previousStatus}".` });
    }

    const sql = 'UPDATE orders SET shipper_id = ?, status = "picking" WHERE id = ? AND status = ?';
    db.query(sql, [shipper_id, orderId, previousStatus], (err, result) => {
    if (err) {
      console.error("LỖI MYSQL KHI GÁN ĐƠN:", err);
      return res.status(500).json({ success: false, message: 'Lỗi DB: ' + err.sqlMessage });
    }
    if (!result.affectedRows) return res.status(409).json({ success: false, message: 'Trạng thái đơn đã thay đổi, vui lòng tải lại.' });

    recordOrderStatus(orderId, previousStatus, 'picking', 'Phân công tài xế');

    const routeSql = `
      INSERT INTO driver_routes (order_id, shipper_id, warehouse_lat, warehouse_lng, pickup_lat, pickup_lng, delivery_lat, delivery_lng, route_status)
      SELECT ?, ?, 10.762622, 106.660172,
             COALESCE(shop_lat, 10.7605), COALESCE(shop_lng, 106.6545),
              COALESCE(receiver_lat, 10.7745), COALESCE(receiver_lng, 106.6665), 'assigned'
      FROM orders
      WHERE id = ?
      ON DUPLICATE KEY UPDATE
        shipper_id = VALUES(shipper_id),
        pickup_lat = VALUES(pickup_lat),
        pickup_lng = VALUES(pickup_lng),
        delivery_lat = VALUES(delivery_lat),
        delivery_lng = VALUES(delivery_lng),
        route_status = VALUES(route_status)
    `;

    db.query(routeSql, [orderId, shipper_id, orderId], (routeErr) => {
      if (routeErr) console.error('Lỗi lưu route:', routeErr);
    });

    io.emit(`new_order_assigned_${shipper_id}`, {
      message: '🔔 Bạn vừa được phân công một đơn hàng mới!'
    });
    io.emit('order_status_changed', { order_id: Number(orderId), status: 'picking' });

    res.json({ success: true, message: 'Đã phân công tài xế thành công!' });
    });
  });
});

app.get('/api/driver/live', (req, res) => {
  const sql = `
    SELECT d.id, u.full_name, d.shipper_id, d.lat, d.lng, d.route_status, d.created_at
    FROM driver_positions d
    LEFT JOIN users u ON u.id = d.shipper_id
    ORDER BY d.created_at DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Lỗi tải vị trí tài xế: ' + err.sqlMessage });
    res.json({ success: true, data: results });
  });
});

app.post('/api/driver/location', (req, res) => {
  const { shipper_id, order_id, lat, lng, route_status, tracking_code } = req.body;

  if (!shipper_id || !lat || !lng) {
    return res.status(400).json({ success: false, message: 'Thiếu dữ liệu vị trí tài xế.' });
  }

  const sql = `
    INSERT INTO driver_positions (order_id, shipper_id, lat, lng, route_status)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(sql, [order_id || null, shipper_id, lat, lng, route_status || 'moving'], (err) => {
    if (err) return res.status(500).json({ success: false, message: 'Lỗi lưu vị trí tài xế: ' + err.sqlMessage });
    io.emit('driver_location_changed', { order_id, tracking_code: tracking_code || 'N/A', lat, lng, timestamp: new Date() });
    res.json({ success: true, message: 'Đã cập nhật vị trí tài xế.' });
  });
});

app.get('/api/orders/shipper/:id', (req, res) => {
  const sql = 'SELECT * FROM orders WHERE shipper_id = ? ORDER BY created_at DESC';
  db.query(sql, [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true, data: results });
  });
});

app.put('/api/orders/:id/status', upload.single('proof_image'), (req, res) => {
  const { id } = req.params;
  const { status, fail_reason, customer_email, cod_collected, cod_payment_method } = req.body;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  db.query('SELECT status, cod_amount, shipping_fee FROM orders WHERE id = ?', [id], (selectErr, orders) => {
    if (selectErr) return res.status(500).json({ success: false, message: 'Lỗi cập nhật: ' + selectErr.sqlMessage });
    if (!orders.length) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });

    const order = orders[0];
    const amountToCollect = Number(order.cod_amount || 0) + Number(order.shipping_fee || 0);
    const validTransition = status === 'delivering'
      ? ['picking', 'in_warehouse'].includes(order.status)
      : order.status === 'delivering' && ['completed', 'returning'].includes(status);
    if (!validTransition) {
      return res.status(409).json({ success: false, message: `Không thể chuyển đơn từ "${order.status}" sang "${status}".` });
    }
    if (['completed', 'returning'].includes(status) && !imageUrl) {
      return res.status(400).json({ success: false, message: 'Cần ảnh minh chứng trước khi kết thúc lượt giao.' });
    }
    if (status === 'returning' && !String(fail_reason || '').trim()) {
      return res.status(400).json({ success: false, message: 'Cần ghi rõ lý do giao thất bại.' });
    }
    if (status === 'completed' && amountToCollect > 0 && cod_collected !== 'true') {
      return res.status(400).json({ success: false, message: 'Cần xác nhận đã thu COD và phí vận chuyển trước khi hoàn tất đơn.' });
    }
    if (status === 'completed' && amountToCollect > 0 && !['cash', 'bank_transfer'].includes(cod_payment_method)) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn tiền mặt hoặc chuyển khoản cho tổng tiền cần thu.' });
    }

    let sql = 'UPDATE orders SET status = ?';
    const params = [status];
    if (imageUrl) {
      sql += ', proof_image = ?';
      params.push(imageUrl);
    }
    if (status === 'returning') {
      sql += ', fail_reason = ?';
      params.push(String(fail_reason).trim());
    }
    if (status === 'completed') {
      sql += ', cod_collected = ?';
      params.push(amountToCollect > 0 ? 1 : 0);
      sql += ', cod_collected_amount = ?';
      params.push(amountToCollect);
      sql += ', cod_payment_method = ?';
      params.push(amountToCollect > 0 ? cod_payment_method : null);
    }
    sql += ' WHERE id = ? AND status = ?';
    params.push(id, order.status);

    db.query(sql, params, (err, result) => {
      if (err) {
        console.error("Lỗi cập nhật DB:", err);
        return res.status(500).json({ success: false, message: 'Lỗi cập nhật: ' + err.sqlMessage });
      }
      if (!result.affectedRows) return res.status(409).json({ success: false, message: 'Trạng thái đơn đã thay đổi, vui lòng tải lại.' });

      recordOrderStatus(id, order.status, status, fail_reason, imageUrl, () => {
        if (status === 'completed' && customer_email) {
      const mailOptions = {
        from: 'Smart Logistics ERP <noreply@smartlogistics.vn>',
        to: customer_email,
        subject: `[Hóa Đơn] Xác nhận giao hàng thành công - Đơn ${id}`,
        html: `
          <div style="font-family: sans-serif; max-w: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
            <h2 style="color: #10B981; text-align: center;">GIAO HÀNG THÀNH CÔNG!</h2>
            <p style="color: #374151; font-size: 16px;">Cảm ơn bạn đã sử dụng dịch vụ của <b>Smart Logistics</b>.</p>
            <p style="color: #4B5563;">Đơn hàng của bạn đã được giao đến nơi an toàn. Bạn có thể tra cứu hình ảnh minh chứng ngay trên Cổng tra cứu của hệ thống.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="font-size: 12px; color: #9CA3AF; text-align: center;">Đây là email tự động, vui lòng không trả lời email này.</p>
          </div>
        `
      };
      
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) console.log("Lỗi gửi mail:", error);
        else console.log("Email đã gửi thành công:", info.response);
      });
        }

        res.json({ success: true, message: 'Cập nhật trạng thái thành công!' });
        io.emit('order_status_changed', { order_id: Number(id), status });
      });
    });
  });
});

// =========================================
// 4. API KHO BÃI
// =========================================
app.post('/api/warehouse/scan', (req, res) => {
  const { tracking_code } = req.body;
  db.query('SELECT * FROM orders WHERE tracking_code = ?', [tracking_code], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    if (results.length === 0) return res.status(404).json({ success: false, message: '❌ Không tìm thấy Mã vận đơn này!' });

    const order = results[0];
    let newStatus = '';
    let message = '';

    if (order.status === 'picking') {
        newStatus = 'in_warehouse';
        message = '📥 Đã NHẬP KHO thành công!';
    } else if (order.status === 'in_warehouse') {
        newStatus = 'delivering';
        message = '📤 Đã XUẤT KHO cho tài xế đi giao!';
    } else if (order.status === 'returning') {
        newStatus = 'cancelled';
        message = '↩️ Đã NHẬP KHO HÀNG HOÀN thành công. Đơn hàng kết thúc (Đã Hủy)!';
    } else {
      const message = order.status === 'delivering'
        ? 'Đơn hàng đã rời kho và đang được giao, không cần quét tại kho lần nữa.'
        : order.status === 'completed'
        ? 'Đơn hàng đã giao thành công, không thể quét lại tại kho.'
        : `Đơn hàng đang ở trạng thái "${order.status}" nên chưa thể xử lý tại kho.`;
      return res.status(409).json({ success: false, message });
    }

    db.query('UPDATE orders SET status = ? WHERE id = ? AND status = ?', [newStatus, order.id, order.status], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
        if (!result.affectedRows) return res.status(409).json({ success: false, message: 'Trạng thái đơn đã thay đổi, vui lòng quét lại.' });
        recordOrderStatus(order.id, order.status, newStatus, 'Quét mã tại kho', null, () => {
          io.emit('order_status_changed', { order_id: Number(order.id), status: newStatus });
          res.json({ success: true, message, order: { ...order, status: newStatus } });
        });
    });
  });
});

app.get('/api/warehouse/inventory', (req, res) => {
  const sql = 'SELECT * FROM orders WHERE status = "in_warehouse" ORDER BY id DESC';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true, data: results });
  });
});

// =========================================
// 5. API KẾ TOÁN (ĐỐI SOÁT COD)
// =========================================
app.get('/api/accountant/debt', (req, res) => {
  const sql = `
    SELECT u.id as shop_id, u.full_name as shop_name, u.email,
           COUNT(o.id) as total_orders,
           SUM(o.cod_amount) as total_cod
    FROM orders o
    JOIN users u ON o.shop_id = u.id
    WHERE o.status = 'completed' AND o.is_cod_paid = 0
    GROUP BY u.id
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true, data: results });
  });
});

app.put('/api/accountant/pay/:shop_id', (req, res) => {
  db.query('INSERT INTO cod_settlements (shop_id) VALUES (?)', [req.params.shop_id], (insertErr, settlement) => {
    if (insertErr) return res.status(500).json({ success: false, message: insertErr.sqlMessage });

    const settlementId = settlement.insertId;
    const updateSql = `
      UPDATE orders
      SET is_cod_paid = 1, cod_settlement_id = ?
      WHERE shop_id = ? AND status = 'completed' AND is_cod_paid = 0
    `;
    db.query(updateSql, [settlementId, req.params.shop_id], (updateErr, result) => {
      if (updateErr) return res.status(500).json({ success: false, message: updateErr.sqlMessage });
      if (!result.affectedRows) {
        db.query('DELETE FROM cod_settlements WHERE id = ?', [settlementId]);
        return res.status(409).json({ success: false, message: 'Shop không có đơn COD chưa thanh toán.' });
      }

      const totalsSql = `
        UPDATE cod_settlements
        SET total_cod = (SELECT COALESCE(SUM(cod_amount), 0) FROM orders WHERE cod_settlement_id = ?),
            order_count = (SELECT COUNT(*) FROM orders WHERE cod_settlement_id = ?)
        WHERE id = ?
      `;
      db.query(totalsSql, [settlementId, settlementId, settlementId], (totalsErr) => {
        if (totalsErr) return res.status(500).json({ success: false, message: totalsErr.sqlMessage });
        res.json({ success: true, settlement_id: settlementId, order_count: result.affectedRows });
      });
    });
  });
});

app.get('/api/accountant/history', (req, res) => {
  const sql = `
        SELECT s.id as settlement_id, u.id as shop_id, u.full_name as shop_name, u.email,
          s.order_count as total_orders, s.total_cod as total_paid, s.settled_at
        FROM cod_settlements s
        JOIN users u ON s.shop_id = u.id
        ORDER BY s.settled_at DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true, data: results });
  });
});

// =========================================
// 6. API NHÂN SỰ (HR)
// =========================================
app.get('/api/hr/staff', (req, res) => {
  const sql = 'SELECT id, full_name, email, role, status, created_at FROM users WHERE role != "customer" ORDER BY id DESC';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true, data: results });
  });
});

app.post('/api/hr/staff', (req, res) => {
  const { full_name, email, password, role, status } = req.body;

  if (!full_name || !email || !password || !role) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc: họ tên, email, mật khẩu, chức vụ.' });
  }

  const normalizedRole = String(role).trim();
  const normalizedEmail = String(email).trim();

  const sql = 'INSERT INTO users (full_name, email, password, role, status) VALUES (?, ?, ?, ?, ?)';
  db.query(sql, [full_name.trim(), normalizedEmail, password, normalizedRole, status || 'active'], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'Email đã tồn tại trong hệ thống.' });
      }
      return res.status(500).json({ success: false, message: 'Lỗi tạo nhân sự: ' + err.sqlMessage });
    }

    res.json({ success: true, message: 'Đã tạo nhân sự mới thành công.', staffId: result.insertId });
  });
});

app.put('/api/hr/staff/:id', (req, res) => {
  const { full_name, email, password, role, status } = req.body;

  if (!full_name || !email || !role) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc khi cập nhật nhân sự.' });
  }

  const updates = [full_name.trim(), String(email).trim(), role, status || 'active'];
  const sql = 'UPDATE users SET full_name = ?, email = ?, role = ?, status = ?';

  if (password && String(password).trim()) {
    updates.push(password);
    sql += ', password = ?';
  }

  updates.push(req.params.id);
  sql += ' WHERE id = ?';

  db.query(sql, updates, (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'Email đã tồn tại trong hệ thống.' });
      }
      return res.status(500).json({ success: false, message: 'Lỗi cập nhật nhân sự: ' + err.sqlMessage });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhân sự để cập nhật.' });
    }

    res.json({ success: true, message: 'Cập nhật thông tin nhân sự thành công.' });
  });
});

app.delete('/api/hr/staff/:id', (req, res) => {
  const sql = 'DELETE FROM users WHERE id = ? AND role != "customer"';
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: 'Lỗi xóa nhân sự: ' + err.sqlMessage });
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhân sự để xóa.' });
    }
    res.json({ success: true, message: 'Đã xóa nhân sự thành công.' });
  });
});

app.put('/api/hr/staff/:id/status', (req, res) => {
  const sql = 'UPDATE users SET status = ? WHERE id = ?';
  db.query(sql, [req.body.status, req.params.id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true });
  });
});

app.post('/api/hr/leave', (req, res) => {
  const { user_id, reason } = req.body;
  const sql = 'INSERT INTO leave_requests (user_id, reason, status) VALUES (?, ?, "pending")';
  db.query(sql, [user_id, reason], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: 'Lỗi gửi đơn: ' + err.sqlMessage });
    res.json({ success: true, message: 'Đã gửi đơn xin nghỉ phép lên phòng Nhân Sự!' });
  });
});

app.get('/api/hr/leave-requests', (req, res) => {
  const sql = `
    SELECT l.id, u.full_name, u.role, l.reason, l.status, l.created_at 
    FROM leave_requests l
    JOIN users u ON l.user_id = u.id
    ORDER BY l.created_at DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true, data: results });
  });
});

app.put('/api/hr/leave/:id', (req, res) => {
  const sql = 'UPDATE leave_requests SET status = ? WHERE id = ?';
  db.query(sql, [req.body.status, req.params.id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true });
  });
});

app.get('/api/attendance', (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(req.query.month || '')
    ? req.query.month
    : new Date().toISOString().slice(0, 7);
  const userId = req.query.user_id ? Number(req.query.user_id) : null;
  if (req.query.user_id && (!Number.isInteger(userId) || userId <= 0)) {
    return res.status(400).json({ success: false, message: 'Mã nhân viên không hợp lệ.' });
  }

  const sql = `
    SELECT a.id, a.user_id, u.full_name, u.role,
      DATE_FORMAT(a.work_date, '%Y-%m-%d') AS work_date, a.check_in, a.check_out
    FROM attendance_records a
    JOIN users u ON u.id = a.user_id
    WHERE DATE_FORMAT(a.work_date, '%Y-%m') = ? ${userId ? 'AND a.user_id = ?' : ''}
    ORDER BY a.work_date DESC, a.id DESC, u.full_name ASC
  `;
  db.query(sql, userId ? [month, userId] : [month], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true, data: results });
  });
});

app.post('/api/attendance/check-in', (req, res) => {
  const userId = Number(req.body.user_id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ success: false, message: 'Mã nhân viên không hợp lệ.' });
  }

  db.query(`
    SELECT id FROM attendance_records
    WHERE user_id = ? AND work_date = CURDATE() AND check_in IS NOT NULL AND check_out IS NULL
    ORDER BY id DESC LIMIT 1
  `, [userId], (findErr, rows) => {
    if (findErr) return res.status(500).json({ success: false, message: findErr.sqlMessage });
    if (rows.length) {
      return res.status(409).json({ success: false, message: 'Bạn vẫn còn một ca chưa chấm công tan ca.' });
    }
    const sql = `
      INSERT INTO attendance_records (user_id, work_date, check_in)
      VALUES (?, CURDATE(), CURRENT_TIMESTAMP)
    `;
    db.query(sql, [userId], (insertErr) => {
      if (insertErr) return res.status(500).json({ success: false, message: insertErr.sqlMessage });
      res.json({ success: true, message: 'Đã ghi nhận giờ vào.' });
    });
  });
});

app.post('/api/attendance/check-out', (req, res) => {
  const userId = Number(req.body.user_id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ success: false, message: 'Mã nhân viên không hợp lệ.' });
  }

  db.query(`
    SELECT id FROM attendance_records
    WHERE user_id = ? AND work_date = CURDATE() AND check_in IS NOT NULL AND check_out IS NULL
    ORDER BY id DESC LIMIT 1
  `, [userId], (findErr, rows) => {
    if (findErr) return res.status(500).json({ success: false, message: findErr.sqlMessage });
    if (!rows.length) {
      return res.status(409).json({ success: false, message: 'Không có ca nào đang mở để chấm công tan ca.' });
    }
    db.query('UPDATE attendance_records SET check_out = CURRENT_TIMESTAMP WHERE id = ? AND check_out IS NULL', [rows[0].id], (err, result) => {
      if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
      if (!result.affectedRows) {
        return res.status(409).json({ success: false, message: 'Ca làm này đã được chấm công tan.' });
      }
      res.json({ success: true, message: 'Đã ghi nhận giờ ra.' });
    });
  });
});

app.get('/api/hr/payroll', (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(req.query.month || '')
    ? req.query.month
    : new Date().toISOString().slice(0, 7);
  const sql = `
    SELECT u.id, u.full_name, u.email, u.role,
      COALESCE(s.monthly_salary, 0) AS monthly_salary,
      COALESCE(s.allowance, 0) AS allowance,
      COUNT(DISTINCT a.work_date) AS attendance_days
    FROM users u
    LEFT JOIN employee_salaries s ON s.user_id = u.id
    LEFT JOIN attendance_records a ON a.user_id = u.id AND DATE_FORMAT(a.work_date, '%Y-%m') = ?
    WHERE u.role != 'customer'
    GROUP BY u.id, u.full_name, u.email, u.role, s.monthly_salary, s.allowance
    ORDER BY u.full_name ASC
  `;
  db.query(sql, [month], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true, data: results });
  });
});

app.put('/api/hr/payroll/:userId', (req, res) => {
  const userId = Number(req.params.userId);
  const monthlySalary = Number(req.body.monthly_salary);
  const allowance = Number(req.body.allowance || 0);
  if (!Number.isInteger(userId) || userId <= 0 || !Number.isFinite(monthlySalary) || monthlySalary < 0 || !Number.isFinite(allowance) || allowance < 0) {
    return res.status(400).json({ success: false, message: 'Mức lương và phụ cấp phải là số không âm.' });
  }
  const sql = `
    INSERT INTO employee_salaries (user_id, monthly_salary, allowance)
    SELECT id, ?, ? FROM users WHERE id = ? AND role != 'customer'
    ON DUPLICATE KEY UPDATE monthly_salary = VALUES(monthly_salary), allowance = VALUES(allowance)
  `;
  db.query("SELECT id FROM users WHERE id = ? AND role != 'customer'", [userId], (findErr, users) => {
    if (findErr) return res.status(500).json({ success: false, message: findErr.sqlMessage });
    if (!users.length) return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên.' });
    db.query(sql, [monthlySalary, allowance, userId], (err) => {
      if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
      res.json({ success: true, message: 'Đã cập nhật mức lương.' });
    });
  });
});

// =========================================
// 7. API GIÁM ĐỐC (DASHBOARD)
// =========================================
app.get('/api/admin/dashboard', (req, res) => {
  const sql = `
    SELECT 
      COUNT(*) as total_orders,
      SUM(CASE WHEN status = 'completed' THEN shipping_fee ELSE 0 END) as total_revenue,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
      SUM(CASE WHEN status = 'delivering' THEN 1 ELSE 0 END) as delivering_orders
    FROM orders
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true, data: results[0] });
  });
});

app.get('/api/admin/reports', (req, res) => {
  const sql = `
    SELECT r.*, u.full_name as sender_name 
    FROM department_reports r
    JOIN users u ON r.created_by = u.id
    ORDER BY r.created_at DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true, data: results });
  });
});

app.get('/api/admin/leaders', (req, res) => {
  const sql = `
    SELECT u.id, u.full_name, u.email, u.role
    FROM users u
    WHERE u.role != 'customer' AND u.status = 'active'
    ORDER BY u.full_name ASC
  `;
  db.query(sql, (staffErr, staff) => {
    if (staffErr) return res.status(500).json({ success: false, message: staffErr.sqlMessage });
    db.query('SELECT department, user_id FROM department_leaders', (leadersErr, leaders) => {
      if (leadersErr) return res.status(500).json({ success: false, message: leadersErr.sqlMessage });
      res.json({ success: true, data: { departments, staff, leaders } });
    });
  });
});

app.put('/api/admin/leaders', (req, res) => {
  const { department } = req.body;
  const userId = Number(req.body.user_id);
  if (!departments.includes(department) || !Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ success: false, message: 'Phòng ban hoặc nhân viên không hợp lệ.' });
  }
  const sql = `
    INSERT INTO department_leaders (department, user_id)
    SELECT ?, id FROM users WHERE id = ? AND role != 'customer' AND status = 'active'
    ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)
  `;
  db.query("SELECT id FROM users WHERE id = ? AND role != 'customer' AND status = 'active'", [userId], (findErr, users) => {
    if (findErr) return res.status(500).json({ success: false, message: findErr.sqlMessage });
    if (!users.length) return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên đang hoạt động.' });
    db.query(sql, [department, userId], (err) => {
      if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
      res.json({ success: true, message: 'Đã cập nhật trưởng phòng.' });
    });
  });
});

app.delete('/api/admin/leaders', (req, res) => {
  const { department } = req.body;
  if (!departments.includes(department)) {
    return res.status(400).json({ success: false, message: 'Phòng ban không hợp lệ.' });
  }
  db.query('DELETE FROM department_leaders WHERE department = ?', [department], (err) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true, message: 'Đã gỡ trưởng phòng.' });
  });
});

app.post('/api/reports', (req, res, next) => {
  reportUpload.single('attachment')(req, res, (uploadErr) => {
    if (uploadErr) {
      const message = uploadErr.code === 'LIMIT_FILE_SIZE'
        ? 'Tệp đính kèm không được vượt quá 15 MB.'
        : uploadErr.message === 'Định dạng tệp không được hỗ trợ.'
          ? uploadErr.message
          : 'Không thể tải tệp lên.';
      return res.status(400).json({ success: false, message });
    }
    next();
  });
}, (req, res) => {
  const { created_by, department, title, content } = req.body;
  if (!created_by || !department || !title || !content) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin báo cáo.' });
  }
  const attachmentUrl = req.file ? `/uploads/${req.file.filename}` : null;
  const sql = 'INSERT INTO department_reports (created_by, department, title, content, attachment_url, status) VALUES (?, ?, ?, ?, ?, "pending")';
  db.query(sql, [created_by, department, title, content, attachmentUrl], (err, result) => {
    if (err) {
      console.error("Lỗi Database khi gửi báo cáo:", err);
      return res.status(500).json({ success: false, message: 'Lỗi MySQL: ' + err.sqlMessage });
    }
    res.json({ success: true, message: 'Đã gửi báo cáo cho Giám đốc!', reportId: result.insertId });
  });
});

app.put('/api/admin/reports/:id/status', (req, res) => {
  const sql = 'UPDATE department_reports SET status = ? WHERE id = ?';
  db.query(sql, [req.body.status, req.params.id], (err, result) => {
    if (err) {
      console.error("Lỗi cập nhật báo cáo:", err);
      return res.status(500).json({ success: false, message: 'Lỗi Database: ' + err.sqlMessage });
    }
    res.json({ success: true, message: 'Đã cập nhật trạng thái báo cáo!' });
  });
});

// =========================================
// KHỞI ĐỘNG SERVER
// =========================================
const PORT = 5000;
server.listen(PORT, () => {
  console.log(`🚀 Backend Server & WebSocket đang chạy tại http://localhost:${PORT}`);
});