const express = require('express');
const mysql = require('mysql');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Kết nối cơ sở dữ liệu MySQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', // Để trống nếu dùng XAMPP mặc định
  database: 'smart_logistics_v2'
});

db.connect((err) => {
  if (err) {
    console.error('Lỗi kết nối CSDL:', err);
    return;
  }
  console.log('Đã kết nối Database: smart_logistics_v2 🚀');
});

// API Xử lý Đăng Nhập
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  
  const sql = 'SELECT id, email, full_name, role FROM users WHERE email = ? AND password = ? AND status = "active"';
  
  db.query(sql, [email, password], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
    
    if (results.length > 0) {
      // Thành công
      res.json({ success: true, user: results[0] });
    } else {
      // Thất bại
      res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác' });
    }
  });
});

// [ĐÃ FIX & GỘP] API Tạo đơn hàng mới (Lưu đầy đủ shop_id, shipping_fee, weight_kg)
app.post('/api/orders', (req, res) => {
  const { tracking_code, shop_id, receiver_name, receiver_phone, receiver_address, cod_amount, shipping_fee, weight_kg } = req.body;
  
  const sql = `
    INSERT INTO orders (tracking_code, shop_id, receiver_name, receiver_phone, receiver_address, cod_amount, shipping_fee, weight_kg, status) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `;
  
  db.query(sql, [
    tracking_code, 
    shop_id || null, 
    receiver_name, 
    receiver_phone, 
    receiver_address, 
    cod_amount, 
    shipping_fee || 0, 
    weight_kg || 1
  ], (err, result) => {
    if (err) {
      console.error("Lỗi tạo đơn:", err);
      return res.status(500).json({ success: false, message: 'Lỗi lưu đơn hàng' });
    }
    res.json({ success: true, message: 'Tạo đơn hàng thành công!' });
  });
});

// API Lấy danh sách đơn hàng
app.get('/api/orders', (req, res) => {
  const sql = 'SELECT * FROM orders ORDER BY created_at DESC';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Lỗi tải dữ liệu' });
    res.json({ success: true, data: results });
  });
});

// Lấy danh sách Tài xế để Điều phối viên chọn
app.get('/api/shippers', (req, res) => {
  const sql = 'SELECT id, full_name, email FROM users WHERE role = "shipper" AND status = "active"';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true, data: results });
  });
});

// API Gán đơn hàng cho Tài xế
app.put('/api/orders/:id/assign', (req, res) => {
  const orderId = req.params.id;
  const { shipper_id } = req.body;
  
  // Chuyển trạng thái từ pending -> picking (đang đi lấy hàng)
  const sql = 'UPDATE orders SET assigned_shipper_id = ?, status = "picking" WHERE id = ?';
  db.query(sql, [shipper_id, orderId], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: 'Lỗi gán đơn' });
    res.json({ success: true, message: 'Đã phân công tài xế thành công!' });
  });
});

// Lấy danh sách đơn hàng của MỘT tài xế cụ thể
app.get('/api/orders/shipper/:id', (req, res) => {
  const shipperId = req.params.id;
  const sql = 'SELECT * FROM orders WHERE assigned_shipper_id = ? ORDER BY created_at DESC';
  
  db.query(sql, [shipperId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Lỗi tải đơn hàng' });
    res.json({ success: true, data: results });
  });
});

// Tài xế cập nhật trạng thái đơn hàng (Đã lấy, Đang giao, Hoàn thành)
app.put('/api/orders/:id/status', (req, res) => {
  const orderId = req.params.id;
  const { status } = req.body; 
  
  const sql = 'UPDATE orders SET status = ? WHERE id = ?';
  db.query(sql, [status, orderId], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: 'Lỗi cập nhật' });
    res.json({ success: true, message: 'Cập nhật trạng thái thành công!' });
  });
});

// [MỚI] API Lấy danh sách công nợ (Chỉ tính đơn đã Giao thành công & Chưa thanh toán)
app.get('/api/accountant/debt', (req, res) => {
  const sql = `
    SELECT u.id as shop_id, u.full_name as shop_name, u.email,
           COUNT(o.id) as total_orders,
           SUM(o.cod_amount) as total_cod
    FROM orders o
    JOIN users u ON o.shop_id = u.id
    WHERE o.status = 'completed' AND o.is_cod_paid = false
    GROUP BY u.id
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true, data: results });
  });
});

// [MỚI] API Kế toán xác nhận đã chuyển khoản trả tiền COD cho Shop
app.put('/api/accountant/pay/:shop_id', (req, res) => {
  const shopId = req.params.shop_id;
  const sql = "UPDATE orders SET is_cod_paid = true WHERE shop_id = ? AND status = 'completed'";
  db.query(sql, [shopId], (err, result) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true });
  });
});

// 1. Lấy danh sách toàn bộ nhân sự nội bộ (Trừ khách hàng)
app.get('/api/hr/staff', (req, res) => {
  const sql = 'SELECT id, full_name, email, role, status, created_at FROM users WHERE role != "customer" ORDER BY id DESC';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true, data: results });
  });
});

// 2. Thay đổi trạng thái tài khoản (Khóa / Kích hoạt)
app.put('/api/hr/staff/:id/status', (req, res) => {
  const staffId = req.params.id;
  const { status } = req.body; // 'active' hoặc 'inactive'
  const sql = 'UPDATE users SET status = ? WHERE id = ?';
  db.query(sql, [status, staffId], (err, result) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true, message: 'Đã cập nhật trạng thái nhân viên!' });
  });
});

// 3. Lấy danh sách đơn xin nghỉ phép gửi về cho HR
app.get('/api/hr/leave-requests', (req, res) => {
  const sql = `
    SELECT l.id, u.full_name, u.role, l.reason, l.status, l.created_at 
    FROM leave_requests l
    JOIN users u ON l.user_id = u.id
    ORDER BY l.created_at DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true, data: results });
  });
});

// 4. Phê duyệt hoặc Từ chối đơn nghỉ phép
app.put('/api/hr/leave/:id', (req, res) => {
  const leaveId = req.params.id;
  const { status } = req.body; // 'approved' hoặc 'rejected'
  const sql = 'UPDATE leave_requests SET status = ? WHERE id = ?';
  db.query(sql, [status, leaveId], (err, result) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true });
  });
});

// 1. API Quét mã vạch (Xử lý tự động Nhập/Xuất kho)
app.post('/api/warehouse/scan', (req, res) => {
  const { tracking_code } = req.body;
  
  db.query('SELECT * FROM orders WHERE tracking_code = ?', [tracking_code], (err, results) => {
    if (err || results.length === 0) {
      return res.status(404).json({ success: false, message: '❌ Không tìm thấy Mã vận đơn này!' });
    }

    const order = results[0];
    let newStatus = '';
    let message = '';

    if (order.status === 'picking') {
        newStatus = 'in_warehouse';
        message = '📥 Đã NHẬP KHO thành công!';
    } else if (order.status === 'in_warehouse') {
        newStatus = 'delivering';
        message = '📤 Đã XUẤT KHO cho tài xế đi giao!';
    } else {
        return res.status(400).json({ success: false, message: `⚠️ Đơn hàng đang ở trạng thái "${order.status}". Không thể thao tác!` });
    }

    db.query('UPDATE orders SET status = ? WHERE id = ?', [newStatus, order.id], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
        res.json({ success: true, message, order: { ...order, status: newStatus } });
    });
  });
});

// 2. API Lấy danh sách hàng ĐANG CÓ TRONG KHO
app.get('/api/warehouse/inventory', (req, res) => {
  const sql = 'SELECT * FROM orders WHERE status = "in_warehouse" ORDER BY id DESC';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true, data: results });
  });
});

// API Lấy dữ liệu Thống kê cho Ban Giám Đốc
app.get('/api/admin/dashboard', (req, res) => {
  const sql = `
    SELECT 
      COUNT(*) as total_orders,
      SUM(CASE WHEN status = 'completed' THEN cod_amount ELSE 0 END) as total_revenue,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
      SUM(CASE WHEN status = 'delivering' THEN 1 ELSE 0 END) as delivering_orders
    FROM orders
  `;
  
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Lỗi truy xuất dữ liệu' });
    res.json({ success: true, data: results[0] });
  });
});

// [CẤP PHÒNG BAN] Gửi báo cáo lên Ban Giám Đốc
app.post('/api/reports/submit', (req, res) => {
  const { department, title, content, created_by } = req.body;
  const sql = 'INSERT INTO department_reports (department, title, content, created_by) VALUES (?, ?, ?, ?)';
  
  db.query(sql, [department, title, content, created_by], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: 'Lỗi gửi báo cáo' });
    res.json({ success: true, message: 'Đã gửi báo cáo lên Ban Giám Đốc!' });
  });
});

// [CẤP GIÁM ĐỐC] Lấy toàn bộ báo cáo từ các phòng ban
app.get('/api/admin/reports', (req, res) => {
  const sql = `
    SELECT r.*, u.full_name as sender_name 
    FROM department_reports r
    JOIN users u ON r.created_by = u.id
    ORDER BY r.created_at DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true, data: results });
  });
});

// Lấy thông tin chi tiết của 1 đơn hàng thông qua Mã Vận Đơn (Tracking Code)
app.get('/api/orders/track/:code', (req, res) => {
  const trackingCode = req.params.code;
  const sql = 'SELECT * FROM orders WHERE tracking_code = ?';
  
  db.query(sql, [trackingCode], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Lỗi truy xuất dữ liệu' });
    if (results.length === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng này!' });
    
    res.json({ success: true, data: results[0] });
  });
});

// 1. API TÍNH GIÁ SHIP TỰ ĐỘNG (Dựa theo công thức đặc tả)
app.post('/api/calculate-shipping', (req, res) => {
  const { distance_km, weight_kg, item_value, is_remote_area } = req.body;

  let distanceFee = 15000;
  if (distance_km > 3) {
    distanceFee += (distance_km - 3) * 2000;
  }

  let weightFee = 0;
  if (weight_kg > 2) {
    const extraWeight = weight_kg - 2;
    weightFee = Math.ceil(extraWeight / 0.5) * 5000;
  }

  let insuranceFee = 0;
  if (item_value > 1000000) {
    insuranceFee = item_value * 0.005;
  }

  let remoteFee = is_remote_area ? 20000 : 0;

  const totalFee = distanceFee + weightFee + insuranceFee + remoteFee;

  res.json({
    success: true,
    breakdown: { distanceFee, weightFee, insuranceFee, remoteFee },
    total_fee: totalFee
  });
});

// 2. API QUÉT MÃ QR/VẬN ĐƠN (Cập nhật trạng thái xuyên suốt qua các kho & tài xế)
app.put('/api/orders/scan-workflow', (req, res) => {
  const { tracking_code, next_status, driver_id } = req.body;

  let sql = 'UPDATE orders SET status = ?';
  let params = [next_status];

  if (driver_id) {
    sql += ', driver_id = ?';
    params.push(driver_id);
  }
  sql += ' WHERE tracking_code = ?';
  params.push(tracking_code);

  db.query(sql, params, (err, result) => {
    if (err) return res.status(500).json({ success: false, message: 'Lỗi cập nhật hệ thống kho' });
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy mã vận đơn!' });

    res.json({ success: true, message: `Đã cập nhật trạng thái đơn hàng thành: [${next_status}]` });
  });
});

//////////////////////////////////////////////////////////////
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Backend đang chạy tại http://localhost:${PORT}`);
});