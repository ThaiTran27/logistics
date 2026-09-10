const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const http = require('http'); 
const { Server } = require('socket.io'); 
const multer = require('multer');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Mở quyền truy cập file tĩnh để Frontend load được ảnh minh chứng
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Tự động tạo thư mục chứa ảnh nếu chưa có
const uploadDir = './public/uploads';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// =========================================
// CẤU HÌNH UPLOAD ẢNH (MULTER) & EMAIL (NODEMAILER)
// =========================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, 'POD-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

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
    io.emit('driver_location_changed', data);
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
});

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
// [ĐÃ FIX]: Thêm is_fragile vào API tạo đơn hàng
app.post('/api/orders', (req, res) => {
  const { tracking_code, shop_id, receiver_name, receiver_phone, receiver_address, cod_amount, shipping_fee, weight_kg, is_fragile } = req.body;
  const sql = `
    INSERT INTO orders (tracking_code, shop_id, receiver_name, receiver_phone, receiver_address, cod_amount, shipping_fee, weight_kg, is_fragile, status) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `;
  db.query(sql, [
    tracking_code, shop_id || null, receiver_name, receiver_phone, receiver_address, 
    cod_amount, shipping_fee || 0, weight_kg || 1, is_fragile || false
  ], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: 'Lỗi lưu đơn hàng: ' + err.sqlMessage });
    res.json({ success: true, message: 'Tạo đơn hàng thành công!' });
  });
});

app.get('/api/orders', (req, res) => {
  const sql = 'SELECT * FROM orders ORDER BY created_at DESC';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Lỗi tải dữ liệu: ' + err.sqlMessage });
    res.json({ success: true, data: results });
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
    res.json({ success: true, data: results[0] });
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

  const sql = 'UPDATE orders SET shipper_id = ?, status = "picking" WHERE id = ?';
  db.query(sql, [shipper_id, orderId], (err, result) => {
    if (err) {
      console.error("LỖI MYSQL KHI GÁN ĐƠN:", err);
      return res.status(500).json({ success: false, message: 'Lỗi DB: ' + err.sqlMessage });
    }
    
    io.emit(`new_order_assigned_${shipper_id}`, { 
      message: '🔔 Bạn vừa được phân công một đơn hàng mới!' 
    });

    res.json({ success: true, message: 'Đã phân công tài xế thành công!' });
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
  const { status, fail_reason, customer_email } = req.body;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  let sql = 'UPDATE orders SET status = ?';
  let params = [status];

  if (imageUrl) {
    sql += ', proof_image = ?';
    params.push(imageUrl);
  }
  if (fail_reason) {
    sql += ', fail_reason = ?';
    params.push(fail_reason);
  }

  sql += ' WHERE id = ?';
  params.push(id);

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error("Lỗi cập nhật DB:", err);
      return res.status(500).json({ success: false, message: 'Lỗi cập nhật: ' + err.sqlMessage });
    }

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
        return res.status(400).json({ success: false, message: `⚠️ Đơn hàng đang ở trạng thái "${order.status}".` });
    }

    db.query('UPDATE orders SET status = ? WHERE id = ?', [newStatus, order.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
        res.json({ success: true, message, order: { ...order, status: newStatus } });
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
  const sql = "UPDATE orders SET is_cod_paid = 1 WHERE shop_id = ? AND status = 'completed'";
  db.query(sql, [req.params.shop_id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true });
  });
});

app.get('/api/accountant/history', (req, res) => {
  const sql = `
    SELECT u.id as shop_id, u.full_name as shop_name, u.email,
           COUNT(o.id) as total_orders,
           SUM(o.cod_amount) as total_paid
    FROM orders o
    JOIN users u ON o.shop_id = u.id
    WHERE o.status = 'completed' AND o.is_cod_paid = 1
    GROUP BY u.id
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

app.post('/api/reports', (req, res) => {
  const { created_by, department, title, content } = req.body;
  const sql = 'INSERT INTO department_reports (created_by, department, title, content, status) VALUES (?, ?, ?, ?, "pending")';
  db.query(sql, [created_by, department, title, content], (err, result) => {
    if (err) {
      console.error("Lỗi Database khi gửi báo cáo:", err);
      return res.status(500).json({ success: false, message: 'Lỗi MySQL: ' + err.sqlMessage });
    }
    res.json({ success: true, message: 'Đã gửi báo cáo cho Giám đốc!' });
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