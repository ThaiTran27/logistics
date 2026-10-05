const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const http = require('http'); 
const https = require('https');
const dns = require('dns').promises;
const net = require('net');
const { Server } = require('socket.io'); 
const multer = require('multer');
const crypto = require('crypto');
const { promisify } = require('util');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const scrypt = promisify(crypto.scrypt);
const PASSWORD_HASH_PREFIX = 'scrypt';
if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET chưa cấu hình; token đăng nhập sẽ hết hiệu lực khi máy chủ khởi động lại.');
}
const hcmcBoundaryData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'shared', 'hcmc-legacy-boundary.geojson'), 'utf8'));
const hcmcBoundary = hcmcBoundaryData.features[0].geometry;

const app = express();
app.use(cors());
app.use(express.json());

const chatAgentRoles = new Set([
  'admin', 'director', 'customer_service', 'customer_support', 'cskh', 'support',
  'fleet_manager', 'fleet', 'coordinator', 'dispatcher', 'dieu_hanh'
]);
const driverRoles = new Set(['pickup_driver', 'delivery_driver']);
const staffRoles = new Set([
  'pickup_driver', 'delivery_driver', 'warehouse_manager', 'fleet_manager',
  'accountant', 'hr_manager', 'director', 'shop', 'content_manager', 'customer_service'
]);
const staffStatuses = new Set(['active', 'inactive']);
const normalizeRole = (value) => {
  const role = String(value || '').trim().toLowerCase();
  const aliases = {
    hr: 'hr_manager',
    human_resources: 'hr_manager',
    nhan_su: 'hr_manager',
    fleet: 'fleet_manager',
    dispatcher: 'fleet_manager',
    coordinator: 'fleet_manager',
    dieu_hanh: 'fleet_manager',
    warehouse: 'warehouse_manager',
    kho: 'warehouse_manager',
    content: 'content_manager',
    content_team: 'content_manager',
    phong_ban_noi_dung: 'content_manager',
    marketing: 'content_manager',
    cskh: 'customer_service',
    customer_support: 'customer_service',
    support: 'customer_service',
    admin: 'director'
  };
  return aliases[role] || role;
};
const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16);
  const derivedKey = await scrypt(password, salt, 64);
  return `${PASSWORD_HASH_PREFIX}$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
};
const verifyPassword = async (password, storedPassword) => {
  if (!storedPassword.startsWith(`${PASSWORD_HASH_PREFIX}$`)) {
    const supplied = Buffer.from(password);
    const stored = Buffer.from(storedPassword);
    return supplied.length === stored.length && crypto.timingSafeEqual(supplied, stored);
  }
  const [, saltHex, keyHex, ...extra] = storedPassword.split('$');
  if (extra.length || !/^[\da-f]{32}$/i.test(saltHex || '')
    || !/^[\da-f]{128}$/i.test(keyHex || '')) return false;
  const expectedKey = Buffer.from(keyHex, 'hex');
  const suppliedKey = await scrypt(password, Buffer.from(saltHex, 'hex'), expectedKey.length);
  return crypto.timingSafeEqual(suppliedKey, expectedKey);
};
const authenticateUser = (req, res, next) => {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập lại.' });
  jwt.verify(token, JWT_SECRET, (tokenError, payload) => {
    if (tokenError || !payload?.sub) return res.status(401).json({ success: false, message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
    db.query('SELECT id, email, full_name, role FROM users WHERE id = ? AND status = "active" LIMIT 1', [payload.sub], (err, users) => {
      if (err) return res.status(500).json({ success: false, message: 'Không thể xác thực tài khoản.' });
      if (!users.length) return res.status(401).json({ success: false, message: 'Tài khoản không còn hoạt động.' });
      req.authUser = users[0];
      next();
    });
  });
};
const publicApiRequest = (req) => {
  const method = req.method.toUpperCase();
  const route = req.path;
  return (method === 'POST' && [
    '/api/login',
    '/api/chat/sessions',
    '/api/chat/ai',
    '/api/v1/orders',
    '/api/public/service-requests',
    '/api/public/job-applications'
  ].includes(route))
    || (method === 'GET' && (
      route === '/api/docs'
      || route === '/api/openapi.json'
      || /^\/api\/public\/linehaul-manifests\/[^/]+$/.test(route)
      || route === '/api/news'
      || /^\/api\/news\/\d+$/.test(route)
      || /^\/api\/orders\/track\/[^/]+$/.test(route)
      || /^\/api\/chat\/sessions\/\d+\/messages$/.test(route)
    ));
};
const apiRolesForRequest = (req) => {
  const method = req.method.toUpperCase();
  const route = req.path;
  if (route.startsWith('/api/shop/integrations') || route.startsWith('/api/shop/rma')) return new Set(['shop']);
  if (route === '/api/dispatcher/rma' || /^\/api\/dispatcher\/rma\/\d+$/.test(route)) {
    return new Set(['fleet_manager', 'director']);
  }
  if (route === '/api/dispatcher/driver-profiles' || /^\/api\/dispatcher\/driver-profiles\/\d+$/.test(route)
    || route === '/api/dispatcher/auto-dispatch/preview') return new Set(['fleet_manager', 'director']);
  if (route === '/api/chat/sessions' && method === 'GET'
    || /^\/api\/chat\/sessions\/\d+\/(context|close)$/.test(route)) return chatAgentRoles;
  if (route.startsWith('/api/admin/')) return new Set(['director']);
  if (route.startsWith('/api/accountant/')) return new Set(['accountant', 'director']);
  if (route === '/api/hr/leave' && method === 'POST') return new Set([...staffRoles].filter((role) => role !== 'customer'));
  if (route.startsWith('/api/hr/')) return new Set(['hr_manager', 'director']);
  if (route === '/api/news/admin' || route.startsWith('/api/news/') && method !== 'GET'
    || route === '/api/news' && method !== 'GET') return new Set(['content_manager', 'director']);
  if (route === '/api/notifications' || route.startsWith('/api/notifications/')) return staffRoles;
  if (route === '/api/warehouses' && method === 'GET') return staffRoles;
  if (route === '/api/warehouses' || route.startsWith('/api/warehouses/')) return new Set(['warehouse_manager', 'director']);
  if (route.startsWith('/api/warehouse/') || route === '/api/warehouse') return new Set(['warehouse_manager', 'fleet_manager', 'director']);
  if (route.startsWith('/api/linehaul/')) return new Set(['warehouse_manager', 'fleet_manager', 'director']);
  if (route === '/api/shippers') return new Set(['warehouse_manager', 'fleet_manager', 'director']);
  if (route === '/api/driver/live') return new Set(['warehouse_manager', 'fleet_manager', 'director']);
  if (route === '/api/driver/location' || route.startsWith('/api/driver/wallet/')
    || route === '/api/driver/cash-remittances' || route === '/api/driver/incidents'
    || route === '/api/driver/expense-claims'
    || route === '/api/driver/trips/scan') return driverRoles;
  if (route === '/api/orders' && method === 'GET') {
    return new Set(['shop', 'warehouse_manager', 'fleet_manager', 'accountant', 'director']);
  }
  if (route === '/api/orders' && method === 'POST') return new Set(['shop']);
  if (/^\/api\/orders\/\d+\/assign$/.test(route)) return new Set(['fleet_manager', 'director']);
  if (/^\/api\/orders\/shipper\/\d+$/.test(route)) return driverRoles;
  if (/^\/api\/orders\/\d+\/status$/.test(route)) return driverRoles;
  if (/^\/api\/orders\/\d+\/route$/.test(route)) {
    return new Set(['shop', 'warehouse_manager', 'fleet_manager', 'director', ...driverRoles]);
  }
  if (route === '/api/attendance' && method === 'GET') return staffRoles;
  if (route.startsWith('/api/attendance/')) return staffRoles;
  if (route === '/api/reports' && method === 'POST') return new Set(['fleet_manager', 'director']);
  return null;
};
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) return next();
  if (publicApiRequest(req)) return next();
  req.body = req.body || {};
  authenticateUser(req, res, () => {
    const allowedRoles = apiRolesForRequest(req);
    const role = normalizeRole(req.authUser.role);
    req.authRole = role;
    if (!allowedRoles || !allowedRoles.has(role)) {
      return res.status(403).json({ success: false, message: 'Tài khoản không có quyền truy cập API này.' });
    }
    if (req.path === '/api/orders' && req.method === 'GET' && role === 'shop') {
      req.shopScopeId = req.authUser.id;
    }
    if (req.path === '/api/orders' && req.method === 'POST') {
      req.body.shop_id = req.authUser.id;
    }
    if (req.path === '/api/hr/leave' && req.method === 'POST') {
      req.body.user_id = req.authUser.id;
    }
    if (req.path === '/api/reports' && req.method === 'POST') {
      req.body.created_by = req.authUser.id;
    }
    next();
  });
});
const requireChatAgent = (req, res, next) => {
  const authorizeAgent = () => {
  if (!chatAgentRoles.has(String(req.authUser.role || '').toLowerCase())) {
    return res.status(403).json({ success: false, message: 'Tài khoản không có quyền truy cập Trung tâm Hỗ trợ.' });
  }
  next();
  };
  if (req.authUser) return authorizeAgent();
  authenticateUser(req, res, authorizeAgent);
};
const hashChatToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const hashApiKey = (key) => crypto.createHash('sha256').update(key).digest('hex');
const stableWebhookEncryptionSecret = process.env.WEBHOOK_ENCRYPTION_KEY || process.env.JWT_SECRET;
const webhookEncryptionKey = stableWebhookEncryptionSecret
  ? crypto.createHash('sha256').update(stableWebhookEncryptionSecret).digest()
  : null;
const encryptWebhookSecret = (secret) => {
  if (!webhookEncryptionKey) throw new Error('Cần cấu hình WEBHOOK_ENCRYPTION_KEY hoặc JWT_SECRET ổn định.');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', webhookEncryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
};
const decryptWebhookSecret = (payload) => {
  if (!webhookEncryptionKey) throw new Error('Cần cấu hình WEBHOOK_ENCRYPTION_KEY hoặc JWT_SECRET ổn định.');
  const encrypted = Buffer.from(payload, 'base64');
  if (encrypted.length < 29) throw new Error('Webhook secret storage is invalid.');
  const iv = encrypted.subarray(0, 12);
  const authTag = encrypted.subarray(12, 28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', webhookEncryptionKey, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted.subarray(28)), decipher.final()]).toString('utf8');
};
const isPublicWebhookAddress = (address) => {
  const ipVersion = net.isIP(address);
  if (ipVersion === 4) {
    const octets = address.split('.').map(Number);
    const [first, second] = octets;
    return !(first === 0 || first === 10 || first === 127
      || first >= 224
      || first === 169 && second === 254
      || first === 172 && second >= 16 && second <= 31
      || first === 192 && second === 168
      || first === 100 && second >= 64 && second <= 127
      || first === 192 && second === 0
      || first === 192 && second === 88 && octets[2] === 99
      || first === 198 && (second === 18 || second === 19
        || second === 51 && octets[2] === 100)
      || first === 203 && second === 0 && octets[2] === 113);
  }
  if (ipVersion === 6) {
    const normalized = address.toLowerCase();
    return !(normalized === '::' || normalized === '::1'
      || normalized.startsWith('fc') || normalized.startsWith('fd')
      || normalized.startsWith('fe8') || normalized.startsWith('fe9')
      || normalized.startsWith('fea') || normalized.startsWith('feb')
      || normalized.startsWith('fec')
      || normalized.startsWith('ff')
      || normalized.startsWith('::ffff:'));
  }
  return false;
};
const validateWebhookTarget = async (target) => {
  let endpoint;
  try {
    endpoint = new URL(target);
  } catch {
    throw new Error('Webhook URL không hợp lệ.');
  }
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password
    || endpoint.port && endpoint.port !== '443') {
    throw new Error('Webhook chỉ chấp nhận HTTPS công khai trên cổng 443.');
  }
  const hostname = endpoint.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(hostname)) {
    if (!isPublicWebhookAddress(hostname)) throw new Error('Webhook URL không được trỏ đến địa chỉ mạng nội bộ.');
    return { endpoint, address: hostname };
  }
  if (!hostname.includes('.') || hostname === 'localhost' || hostname.endsWith('.local')) {
    throw new Error('Webhook URL phải dùng tên miền công khai.');
  }
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicWebhookAddress(address))) {
    throw new Error('Tên miền webhook không được trỏ đến địa chỉ mạng nội bộ.');
  }
  return { endpoint, address: addresses[0].address };
};
const postSignedWebhook = async (target, secret, payload) => {
  const { endpoint, address } = await validateWebhookTarget(target);
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  await new Promise((resolve, reject) => {
    const request = https.request(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-SmartLogistics-Signature': `sha256=${signature}`,
        'X-SmartLogistics-Event': payload.event
      },
      timeout: 5000,
      lookup: (_hostname, options, callback) => {
        const family = net.isIP(address);
        if (options && options.all) return callback(null, [{ address, family }]);
        callback(null, address, family);
      }
    }, (response) => {
      response.resume();
      response.on('end', () => {
        if (response.statusCode >= 200 && response.statusCode < 300) return resolve();
        reject(new Error(`Webhook trả về HTTP ${response.statusCode}.`));
      });
    });
    request.on('timeout', () => request.destroy(new Error('Webhook hết thời gian chờ.')));
    request.on('error', reject);
    request.end(body);
  });
};
const redactDeliveryOtp = (rows) => rows.map((row) => {
  const safeRow = { ...row };
  delete safeRow.delivery_otp;
  return safeRow;
});
const isMatchingChatToken = (token, tokenHash) => {
  if (!token || !tokenHash) return false;
  const suppliedHash = Buffer.from(hashChatToken(token), 'hex');
  const storedHash = Buffer.from(tokenHash, 'hex');
  return suppliedHash.length === storedHash.length && crypto.timingSafeEqual(suppliedHash, storedHash);
};
const isPointInRing = (longitude, latitude, ring) => {
  let isInside = false;
  for (let currentIndex = 0, previousIndex = ring.length - 1; currentIndex < ring.length; previousIndex = currentIndex++) {
    const [currentLongitude, currentLatitude] = ring[currentIndex];
    const [previousLongitude, previousLatitude] = ring[previousIndex];
    const crossProduct = (longitude - currentLongitude) * (previousLatitude - currentLatitude)
      - (latitude - currentLatitude) * (previousLongitude - currentLongitude);
    if (Math.abs(crossProduct) < 1e-10
      && longitude >= Math.min(currentLongitude, previousLongitude)
      && longitude <= Math.max(currentLongitude, previousLongitude)
      && latitude >= Math.min(currentLatitude, previousLatitude)
      && latitude <= Math.max(currentLatitude, previousLatitude)) {
      return true;
    }
    if ((currentLatitude > latitude) !== (previousLatitude > latitude)
      && longitude < ((previousLongitude - currentLongitude) * (latitude - currentLatitude))
        / (previousLatitude - currentLatitude) + currentLongitude) {
      isInside = !isInside;
    }
  }
  return isInside;
};
const isWithinHcmcBoundary = (lat, lng) => {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  return hcmcBoundary.coordinates.some(([outerRing, ...innerRings]) => (
    isPointInRing(longitude, latitude, outerRing)
      && !innerRings.some((innerRing) => isPointInRing(longitude, latitude, innerRing))
  ));
};

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
const podStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const extension = file.mimetype === 'image/jpeg' ? 'jpg' : file.mimetype === 'image/webp' ? 'webp' : 'png';
    cb(null, `pod-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${extension}`);
  }
});
const podUpload = multer({
  storage: podStorage,
  limits: { fileSize: 8 * 1024 * 1024, files: 2 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return cb(new Error('Bằng chứng giao hàng chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.'));
    }
    cb(null, true);
  }
});
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
const attendanceStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    cb(null, `attendance-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`);
  }
});
const attendanceUpload = multer({
  storage: attendanceStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedImage = /^image\/(jpeg|png|webp)$/.test(file.mimetype)
      && /\.(jpe?g|png|webp)$/i.test(path.extname(file.originalname));
    if (!allowedImage) return cb(new Error('Ảnh chấm công phải có định dạng JPG, PNG hoặc WEBP.'));
    cb(null, true);
  }
});

const departments = ['Phòng Tài Chính', 'Phòng Điều Phối', 'Phòng Kho', 'Phòng Nhân Sự', 'Phòng Nội Dung'];

const smtpConfig = {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS
};
const mailerReady = Boolean(smtpConfig.host && smtpConfig.user && smtpConfig.pass);
const mailFrom = process.env.MAIL_FROM || `Smart Logistics <${smtpConfig.user || 'noreply@localhost'}>`;
const transporter = nodemailer.createTransport({
  host: smtpConfig.host || 'localhost',
  port: smtpConfig.port,
  secure: smtpConfig.secure,
  ...(smtpConfig.user && smtpConfig.pass
    ? { auth: { user: smtpConfig.user, pass: smtpConfig.pass } }
    : {})
});

function createSettlementPdf(summary, orders) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true });
    const chunks = [];
    const fontPath = path.join(__dirname, 'node_modules', '@fontsource', 'noto-sans', 'files', 'noto-sans-vietnamese-400-normal.woff');
    const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')} đ`;
    const columns = [
      { label: 'Mã vận đơn', width: 118 },
      { label: 'COD', width: 76 },
      { label: 'Cước Shop', width: 90 },
      { label: 'Dịch vụ', width: 83 },
      { label: 'Bảo hiểm', width: 88 }
    ];
    const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
    const pageBottom = () => doc.page.height - doc.page.margins.bottom;

    const drawTableHeader = () => {
      let x = doc.page.margins.left;
      const y = doc.y;
      doc.fontSize(8).fillColor('#ffffff');
      doc.rect(x, y, tableWidth, 24).fill('#1e3a8a');
      columns.forEach((column) => {
        doc.fillColor('#ffffff').text(column.label, x + 4, y + 7, { width: column.width - 8, lineBreak: false });
        x += column.width;
      });
      doc.y = y + 30;
    };

    const drawOrderRow = (order, index) => {
      if (doc.y + 30 > pageBottom()) {
        doc.addPage();
        drawTableHeader();
      }
      const values = [
        String(order.tracking_code || ''),
        formatMoney(order.cod_amount),
        formatMoney(order.fee_payer === 'sender' ? order.shipping_fee : 0),
        formatMoney(order.service_fee),
        formatMoney(order.insurance_fee)
      ];
      const y = doc.y;
      if (index % 2 === 0) doc.rect(doc.page.margins.left, y - 3, tableWidth, 27).fill('#f1f5f9');
      let x = doc.page.margins.left;
      doc.fontSize(8).fillColor('#0f172a');
      columns.forEach((column, columnIndex) => {
        doc.fillColor('#0f172a').text(values[columnIndex], x + 4, y + 4, {
          width: column.width - 8,
          lineBreak: false,
          ellipsis: true
        });
        x += column.width;
      });
      doc.y = y + 29;
    };

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.once('error', reject);
    doc.once('end', () => resolve(Buffer.concat(chunks)));

    try {
      doc.font(fontPath).fillColor('#0f172a');
      doc.fontSize(20).text('SMART LOGISTICS', { align: 'center' });
      doc.moveDown(0.35);
      doc.fontSize(14).text(`PHIẾU ĐỐI SOÁT COD #${summary.id}`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Cửa hàng: ${summary.shop_name}`);
      doc.text(`Email: ${summary.email}`);
      doc.text(`Ngày đối soát: ${new Date(summary.settled_at).toLocaleString('vi-VN')}`);
      doc.moveDown();
      doc.fontSize(11).text('CHI TIẾT VẬN ĐƠN', { underline: true });
      doc.moveDown(0.5);
      drawTableHeader();
      orders.forEach(drawOrderRow);
      doc.moveDown();
      if (doc.y + 120 > pageBottom()) doc.addPage();
      doc.fontSize(10).text(`Tổng COD: ${formatMoney(summary.total_cod)}`, { align: 'right' });
      doc.text(`Cước Shop trả: -${formatMoney(summary.total_shipping_fee)}`, { align: 'right' });
      doc.text(`Phí dịch vụ: -${formatMoney(summary.total_service_fee)}`, { align: 'right' });
      doc.text(`Phí bảo hiểm: -${formatMoney(summary.total_insurance_fee)}`, { align: 'right' });
      doc.moveDown(0.5);
      doc.fontSize(13).fillColor('#047857').text(`TIỀN SHOP NHẬN: ${formatMoney(summary.total_paid)}`, { align: 'right' });
      doc.fillColor('#64748b').fontSize(8).text(`Tổng số đơn: ${Number(summary.order_count || 0)}`, { align: 'right' });
      doc.end();
    } catch (error) {
      doc.destroy(error);
    }
  });
}

// TẠO HTTP SERVER VÀ GẮN SOCKET.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173', 
    methods: ['GET', 'POST']
  }
});

// LẮNG NGHE KẾT NỐI REALTIME (WEBSOCKET)
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next();
  jwt.verify(token, JWT_SECRET, (tokenError, payload) => {
    if (tokenError || !payload?.sub) return next(new Error('Phiên đăng nhập không hợp lệ.'));
    db.query('SELECT id, email, full_name, role FROM users WHERE id = ? AND status = "active" LIMIT 1', [payload.sub], (err, users) => {
      if (err) return next(new Error('Không thể xác thực kết nối.'));
      if (!users.length) return next(new Error('Tài khoản không còn hoạt động.'));
      socket.data.authUser = users[0];
      socket.join(`user:${users[0].id}`);
      const role = normalizeRole(users[0].role);
      if (role === 'shop') socket.join(`shop:${users[0].id}`);
      if (['fleet_manager', 'warehouse_manager', 'director'].includes(role)) {
        socket.join('fleet_tracking');
      }
      if (chatAgentRoles.has(String(users[0].role || '').toLowerCase())) socket.join('support_agents');
      next();
    });
  });
});

io.on('connection', (socket) => {
  console.log('⚡ Một thiết bị vừa kết nối WebSocket:', socket.id);

  socket.on('driver_update_location', (data) => {
    const payload = data || {};
    const authUser = socket.data.authUser;
    const latitude = Number(payload.lat);
    const longitude = Number(payload.lng);
    const orderId = Number(payload.order_id);
    if (!authUser || !driverRoles.has(normalizeRole(authUser.role))
      || Number(payload.shipper_id) !== Number(authUser.id)
      || !Number.isFinite(latitude) || Math.abs(latitude) > 90
      || !Number.isFinite(longitude) || Math.abs(longitude) > 180
      || !Number.isInteger(orderId) || orderId <= 0) return;
    db.query(
      `INSERT INTO driver_positions (order_id, shipper_id, lat, lng, route_status)
       SELECT o.id, ?, ?, ?, ?
       FROM orders o
       WHERE o.id = ? AND (
         (o.pickup_shipper_id = ? AND o.status IN ('picking','picked_up'))
         OR (o.central_transfer_shipper_id = ? AND o.status = 'transferring_to_central')
         OR (o.destination_transfer_shipper_id = ? AND o.status = 'transferring_to_destination')
         OR (o.delivery_shipper_id = ? AND o.status = 'delivering')
       )
       LIMIT 1`,
      [authUser.id, latitude, longitude, payload.route_status || 'moving', orderId, authUser.id, authUser.id, authUser.id, authUser.id],
      (err, result) => {
        if (err) {
          console.error('Lỗi lưu vị trí tài xế realtime:', err);
          return;
        }
        if (!result.affectedRows) return;
        const position = {
          ...payload,
          shipper_id: authUser.id,
          order_id: orderId,
          lat: latitude,
          lng: longitude,
          timestamp: new Date()
        };
        io.to('fleet_tracking').emit('driver_location_changed', position);
        io.to(`order_tracking:${orderId}`).emit('driver_location_changed', position);
      }
    );
  });

  socket.on('join_order_tracking', (data = {}, acknowledge = () => {}) => {
    const orderId = Number(data.order_id);
    const trackingCode = String(data.tracking_code || '').trim().toUpperCase();
    if ((!Number.isSafeInteger(orderId) || orderId <= 0) && !trackingCode) {
      return acknowledge({ success: false, message: 'Cần mã đơn hoặc mã vận đơn hợp lệ.' });
    }
    const queryById = Boolean(socket.data.authUser && orderId);
    const query = queryById
      ? 'SELECT id, shop_id FROM orders WHERE id = ? LIMIT 1'
      : 'SELECT id, shop_id FROM orders WHERE tracking_code = ? LIMIT 1';
    db.query(query, [queryById ? orderId : trackingCode], (err, orders) => {
      if (err) return acknowledge({ success: false, message: 'Không thể mở theo dõi vận đơn.' });
      const order = orders[0];
      if (!order) return acknowledge({ success: false, message: 'Không tìm thấy vận đơn.' });
      const authUser = socket.data.authUser;
      const role = authUser ? normalizeRole(authUser.role) : '';
      const canTrack = !authUser
        ? Boolean(trackingCode)
        : ['director', 'fleet_manager', 'warehouse_manager'].includes(role)
          || role === 'shop' && Number(order.shop_id) === Number(authUser.id);
      if (!canTrack) return acknowledge({ success: false, message: 'Không có quyền theo dõi vận đơn này.' });
      socket.join(`order_tracking:${order.id}`);
      acknowledge({ success: true, order_id: order.id });
    });
  });

  socket.on('join_chat', (data = {}, acknowledge = () => {}) => {
    const sessionId = Number(data.session_id);
    if (!Number.isSafeInteger(sessionId) || sessionId <= 0) return acknowledge({ success: false, message: 'Phiên chat không hợp lệ.' });
    db.query('SELECT id, guest_token_hash, status FROM chat_sessions WHERE id = ? LIMIT 1', [sessionId], (err, sessions) => {
      if (err) return acknowledge({ success: false, message: 'Không thể mở phiên chat.' });
      const session = sessions[0];
      const agent = socket.data.authUser && chatAgentRoles.has(String(socket.data.authUser.role || '').toLowerCase());
      if (!session || (!agent && !isMatchingChatToken(data.guest_token, session.guest_token_hash))) {
        return acknowledge({ success: false, message: 'Không có quyền truy cập phiên chat này.' });
      }
      socket.join(`chat:${sessionId}`);
      if (agent && session.status === 'waiting') {
        db.query(
          'UPDATE chat_sessions SET status = "active", assigned_agent_id = ? WHERE id = ? AND status = "waiting"',
          [socket.data.authUser.id, sessionId],
          (updateErr) => {
            if (updateErr) console.error('Không thể gán phiên chat cho nhân viên:', updateErr);
            io.to('support_agents').emit('chat_session_updated', { session_id: sessionId, status: 'active' });
            io.to(`chat:${sessionId}`).emit('chat_session_updated', { session_id: sessionId, status: 'active' });
          }
        );
      }
      acknowledge({ success: true, session_id: sessionId });
    });
  });

  socket.on('send_message', (data = {}, acknowledge = () => {}) => {
    const sessionId = Number(data.session_id);
    const message = String(data.message || '').trim();
    if (!Number.isSafeInteger(sessionId) || sessionId <= 0 || !message || message.length > 2000) {
      return acknowledge({ success: false, message: 'Tin nhắn phải có nội dung và không quá 2.000 ký tự.' });
    }
    db.query('SELECT id, guest_token_hash, status FROM chat_sessions WHERE id = ? LIMIT 1', [sessionId], (err, sessions) => {
      if (err) return acknowledge({ success: false, message: 'Không thể gửi tin nhắn.' });
      const session = sessions[0];
      const agent = socket.data.authUser && chatAgentRoles.has(String(socket.data.authUser.role || '').toLowerCase());
      if (!session || (!agent && !isMatchingChatToken(data.guest_token, session.guest_token_hash))) {
        return acknowledge({ success: false, message: 'Không có quyền gửi tin trong phiên chat này.' });
      }
      if (session.status === 'closed') return acknowledge({ success: false, message: 'Phiên chat đã kết thúc.' });
      const senderType = agent ? 'agent' : 'customer';
      const senderId = agent ? socket.data.authUser.id : null;
      const persistMessage = () => db.query(
        'INSERT INTO chat_messages (session_id, sender_type, sender_id, message) VALUES (?, ?, ?, ?)',
        [sessionId, senderType, senderId, message],
        (insertErr, result) => {
          if (insertErr) return acknowledge({ success: false, message: 'Không thể lưu tin nhắn.' });
          const savedMessage = {
            id: result.insertId,
            session_id: sessionId,
            sender_type: senderType,
            sender_id: senderId,
            sender_name: agent ? socket.data.authUser.full_name : null,
            message,
            created_at: new Date().toISOString()
          };
          db.query('UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [sessionId], (updateErr) => {
            if (updateErr) console.error('Không thể cập nhật thời gian phiên chat:', updateErr);
            io.to(`chat:${sessionId}`).emit('receive_message', savedMessage);
            io.to('support_agents').emit('chat_session_updated', { session_id: sessionId, status: 'active' });
            acknowledge({ success: true, data: savedMessage });
          });
        }
      );
      if (agent && session.status === 'waiting') {
        db.query('UPDATE chat_sessions SET status = "active", assigned_agent_id = ? WHERE id = ?', [senderId, sessionId], persistMessage);
      } else {
        persistMessage();
      }
    });
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
      CREATE TABLE IF NOT EXISTS chat_sessions (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS chat_messages (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        session_id BIGINT NOT NULL,
        sender_type ENUM('customer','agent','bot') NOT NULL,
        sender_id INT DEFAULT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_chat_messages_session (session_id, id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
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
      CREATE TABLE IF NOT EXISTS warehouses (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS warehouse_bin_locations (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        warehouse_id INT NOT NULL,
        bin_code VARCHAR(80) NOT NULL,
        bin_name VARCHAR(120) NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_warehouse_bin_code (warehouse_id, bin_code),
        KEY idx_warehouse_bin_active (warehouse_id, is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS warehouse_inventory_audits (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        warehouse_id INT NOT NULL,
        created_by INT NOT NULL,
        status ENUM('open','completed') NOT NULL DEFAULT 'open',
        expected_count INT NOT NULL DEFAULT 0,
        scanned_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME DEFAULT NULL,
        KEY idx_inventory_audit_warehouse (warehouse_id, status, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS warehouse_inventory_audit_items (
        audit_id BIGINT NOT NULL,
        order_id INT NOT NULL,
        tracking_code VARCHAR(100) NOT NULL,
        PRIMARY KEY (audit_id, order_id),
        UNIQUE KEY uq_inventory_audit_code (audit_id, tracking_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS warehouse_inventory_audit_scans (
        audit_id BIGINT NOT NULL,
        scan_code VARCHAR(100) NOT NULL,
        order_id INT DEFAULT NULL,
        scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (audit_id, scan_code),
        KEY idx_inventory_audit_scan_order (audit_id, order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS driver_dispatch_profiles (
        driver_id INT PRIMARY KEY,
        max_active_orders INT NOT NULL DEFAULT 10,
        max_payload_kg DECIMAL(10,2) NOT NULL DEFAULT 100,
        service_areas TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
        signature_image VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_order_status_history_order (order_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS cod_settlements (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS shop_api_keys (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        shop_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        key_prefix VARCHAR(24) NOT NULL,
        key_hash CHAR(64) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used_at DATETIME DEFAULT NULL,
        revoked_at DATETIME DEFAULT NULL,
        KEY idx_shop_api_keys_owner (shop_id, revoked_at, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS shop_webhook_configs (
        shop_id INT PRIMARY KEY,
        target_url VARCHAR(2048) DEFAULT NULL,
        secret_ciphertext TEXT DEFAULT NULL,
        enabled TINYINT(1) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS shop_redelivery_requests (
        order_id INT PRIMARY KEY,
        shop_id INT NOT NULL,
        status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
        request_note TEXT NOT NULL,
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at DATETIME DEFAULT NULL,
        reviewed_by INT DEFAULT NULL,
        review_note TEXT DEFAULT NULL,
        KEY idx_redelivery_shop_status (shop_id, status, requested_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS shipment_bags (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS shipment_bag_orders (
        bag_id BIGINT NOT NULL,
        order_id INT NOT NULL,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (bag_id, order_id),
        KEY idx_shipment_bag_orders_order (order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS linehaul_trips (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS linehaul_trip_bags (
        trip_id BIGINT NOT NULL,
        bag_id BIGINT NOT NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        driver_scanned_at DATETIME DEFAULT NULL,
        PRIMARY KEY (trip_id, bag_id),
        UNIQUE KEY uq_linehaul_bag_trip (bag_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS driver_cash_remittances (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        driver_id INT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        status ENUM('pending','received') NOT NULL DEFAULT 'pending',
        received_by INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        received_at DATETIME DEFAULT NULL,
        KEY idx_driver_cash_remittance (driver_id, status, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS driver_expense_claims (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS driver_wallets (
        driver_id INT PRIMARY KEY,
        balance DECIMAL(12,2) NOT NULL DEFAULT 0,
        reserved_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS driver_wallet_reservations (
        order_id INT PRIMARY KEY,
        driver_id INT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        status ENUM('reserved','released') NOT NULL DEFAULT 'reserved',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        released_at DATETIME DEFAULT NULL,
        KEY idx_driver_wallet_reservation (driver_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS driver_wallet_transactions (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS driver_incidents (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        driver_id INT NOT NULL,
        incident_type ENUM('accident','vehicle_breakdown','traffic','other') NOT NULL,
        description TEXT NOT NULL,
        lat DOUBLE DEFAULT NULL,
        lng DOUBLE DEFAULT NULL,
        status ENUM('open','acknowledged','resolved') NOT NULL DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_driver_incidents_status (status, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS employee_payroll_adjustments (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        payroll_month CHAR(7) NOT NULL,
        adjustment_type ENUM('bonus','deduction') NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_payroll_adjustment_user_month (user_id, payroll_month)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS notifications (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        recipient_user_id INT NOT NULL,
        order_id INT DEFAULT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_notifications_recipient (recipient_user_id, is_read, created_at)
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS employee_salaries (
        user_id INT PRIMARY KEY,
        monthly_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
        allowance DECIMAL(12,2) NOT NULL DEFAULT 0,
        bonus_per_delivery DECIMAL(12,2) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS employee_payroll_adjustments (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        payroll_month CHAR(7) NOT NULL,
        adjustment_type ENUM('bonus','deduction') NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_payroll_adjustment_user_month (user_id, payroll_month)
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
      if (!createErr && sql.includes('CREATE TABLE IF NOT EXISTS warehouses')) {
        db.query(
          `INSERT INTO warehouses (warehouse_type, ward_name, name, address, lat, lng, is_configured, is_active)
           VALUES ('central', '__CENTRAL__', 'Kho tổng Smart Logistics', '10.762622, 106.660172, TP. Hồ Chí Minh', 10.762622, 106.660172, 1, 1)
           ON DUPLICATE KEY UPDATE warehouse_type = VALUES(warehouse_type)`,
          (warehouseErr) => {
            if (warehouseErr) console.error('Lỗi tạo kho tổng:', warehouseErr);
          }
        );
      }
    });
  });

  db.query('ALTER TABLE attendance_records DROP INDEX uq_attendance_user_date, ADD INDEX idx_attendance_user_date (user_id, work_date)', (alterErr) => {
    if (alterErr && alterErr.code !== 'ER_CANT_DROP_FIELD_OR_KEY' && alterErr.code !== 'ER_NO_SUCH_TABLE') {
      console.error('Lỗi cập nhật chỉ mục chấm công:', alterErr);
    }
  });

  db.query('ALTER TABLE shipment_bag_orders DROP INDEX uq_shipment_bag_order', (alterErr) => {
    if (alterErr && alterErr.code !== 'ER_CANT_DROP_FIELD_OR_KEY' && alterErr.code !== 'ER_NO_SUCH_TABLE') {
      console.error('Lỗi cập nhật chỉ mục vận đơn trong bao:', alterErr);
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

  db.query('ALTER TABLE employee_salaries ADD COLUMN bonus_per_delivery DECIMAL(12,2) NOT NULL DEFAULT 0', (alterErr) => {
    if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
      console.error('Lỗi bổ sung mức thưởng theo đơn:', alterErr);
    }
  });

  [
    ['cod_remittance_id', 'BIGINT NULL'],
    ['service_fee', 'DECIMAL(12,2) NOT NULL DEFAULT 0'],
    ['insurance_fee', 'DECIMAL(12,2) NOT NULL DEFAULT 0']
  ].forEach(([column, definition]) => {
    db.query(`ALTER TABLE orders ADD COLUMN ${column} ${definition}`, (alterErr) => {
      if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
        console.error(`Lỗi bổ sung cột ${column} cho orders:`, alterErr);
      }
    });
  });

  [
    ['total_service_fee', 'DECIMAL(12,2) NOT NULL DEFAULT 0'],
    ['total_insurance_fee', 'DECIMAL(12,2) NOT NULL DEFAULT 0']
  ].forEach(([column, definition]) => {
    db.query(`ALTER TABLE cod_settlements ADD COLUMN ${column} ${definition}`, (alterErr) => {
      if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
        console.error(`Lỗi bổ sung cột ${column} cho cod_settlements:`, alterErr);
      }
    });
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

  [
    ['total_shipping_fee', 'DECIMAL(12,2) NOT NULL DEFAULT 0'],
    ['total_paid', 'DECIMAL(12,2) NOT NULL DEFAULT 0']
  ].forEach(([column, definition]) => {
    db.query(`ALTER TABLE cod_settlements ADD COLUMN ${column} ${definition}`, (alterErr) => {
      if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME' && alterErr.code !== 'ER_NO_SUCH_TABLE') {
        console.error(`Lỗi bổ sung cột ${column} cho đối soát COD:`, alterErr);
      }
    });
  });

  [
    ['fee_payer', "ENUM('sender','receiver') NOT NULL DEFAULT 'sender'"],
    ['delivery_otp', 'CHAR(6) DEFAULT NULL'],
    ['signature_image', 'VARCHAR(255) DEFAULT NULL']
  ].forEach(([column, definition]) => {
    db.query(`ALTER TABLE orders ADD COLUMN ${column} ${definition}`, (alterErr) => {
      if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME' && alterErr.code !== 'ER_NO_SUCH_TABLE') {
        console.error(`Lỗi bổ sung cột ${column}:`, alterErr);
      }
    });
  });
  db.query('ALTER TABLE order_status_history ADD COLUMN signature_image VARCHAR(255) DEFAULT NULL', (alterErr) => {
    if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME' && alterErr.code !== 'ER_NO_SUCH_TABLE') {
      console.error('Lỗi bổ sung cột signature_image cho order_status_history:', alterErr);
    }
  });

  [
    ['check_in_photo', 'VARCHAR(255) DEFAULT NULL'],
    ['check_in_lat', 'DOUBLE DEFAULT NULL'],
    ['check_in_lng', 'DOUBLE DEFAULT NULL'],
    ['check_out_photo', 'VARCHAR(255) DEFAULT NULL'],
    ['check_out_lat', 'DOUBLE DEFAULT NULL'],
    ['check_out_lng', 'DOUBLE DEFAULT NULL']
  ].forEach(([column, definition]) => {
    db.query(`ALTER TABLE attendance_records ADD COLUMN ${column} ${definition}`, (alterErr) => {
      if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME' && alterErr.code !== 'ER_NO_SUCH_TABLE') {
        console.error(`Lỗi bổ sung cột ${column} cho chấm công:`, alterErr);
      }
    });
  });

  db.query('ALTER TABLE orders ADD COLUMN pickup_shipper_id INT NULL', (alterErr) => {
    if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
      console.error('Lỗi bổ sung tài xế lấy hàng:', alterErr);
    }
  });

  db.query('ALTER TABLE orders ADD COLUMN delivery_shipper_id INT NULL', (alterErr) => {
    if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
      console.error('Lỗi bổ sung tài xế giao hàng:', alterErr);
    }
  });

  [
    ['central_transfer_shipper_id', 'INT NULL'],
    ['destination_transfer_shipper_id', 'INT NULL'],
    ['origin_warehouse_id', 'INT NULL'],
    ['destination_warehouse_id', 'INT NULL'],
    ['current_warehouse_id', 'INT NULL'],
    ['storage_bin_id', 'BIGINT NULL'],
    ['cross_docked', 'TINYINT(1) NOT NULL DEFAULT 0']
  ].forEach(([column, definition]) => {
    db.query(`ALTER TABLE orders ADD COLUMN ${column} ${definition}`, (alterErr) => {
      if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
        console.error(`Lỗi bổ sung cột ${column}:`, alterErr);
      }
    });
  });

  console.log('Đã đảm bảo bảng news_articles, warehouses, driver_routes, driver_positions sẵn sàng');
});

function recordOrderStatus(orderId, fromStatus, toStatus, note, proofImage, callback, signatureImage = null) {
  const sql = `
    INSERT INTO order_status_history (order_id, from_status, to_status, note, proof_image, signature_image)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  db.query(sql, [orderId, fromStatus, toStatus, note || null, proofImage || null, signatureImage || null], (err) => {
    if (err) console.error('Lỗi ghi lịch sử trạng thái đơn:', err);
    if (toStatus === 'completed') dispatchShopWebhook(orderId);
    if (callback) callback();
  });
}

function dispatchShopWebhook(orderId) {
  db.query(
    `SELECT w.target_url, w.secret_ciphertext, o.shop_id, o.tracking_code, o.status
     FROM orders o
     JOIN shop_webhook_configs w ON w.shop_id = o.shop_id AND w.enabled = 1
     WHERE o.id = ? AND o.status = 'completed' AND w.target_url IS NOT NULL
       AND w.secret_ciphertext IS NOT NULL
     LIMIT 1`,
    [orderId],
    async (err, rows) => {
      if (err) {
        console.error('Không thể tải cấu hình webhook Shop:', err);
        return;
      }
      if (!rows.length) return;
      const order = rows[0];
      const payload = {
        id: crypto.randomUUID(),
        event: 'order.delivered',
        created_at: new Date().toISOString(),
        data: {
          order_id: Number(orderId),
          tracking_code: order.tracking_code,
          status: order.status
        }
      };
      try {
        const secret = decryptWebhookSecret(order.secret_ciphertext);
        await postSignedWebhook(order.target_url, secret, payload);
      } catch (error) {
        console.error(`Gửi webhook giao thành công thất bại cho Shop ${order.shop_id}, đơn ${orderId}:`, error.message);
      }
    }
  );
}

function calculateShippingFee({ weight, length, width, height, distance, serviceType, remoteArea, fragile, vehicleType }) {
  const volumetricWeight = (Number(length) * Number(width) * Number(height)) / 5000;
  const chargeableWeight = Math.max(Number(weight) || 0, volumetricWeight);
  const distanceKm = Math.max(1, Number(distance) || 1);
  const serviceBase = { economy: 18000, standard: 28000, express: 45000 }[serviceType] || 28000;
  const serviceFactor = { economy: 0.88, standard: 1, express: 1.5 }[serviceType] || 1;
  const vehicleFactor = { motorbike: 1, van: 1.5, truck: 2.5 }[vehicleType] || 1;
  const distanceFee = Math.max(0, distanceKm - 5) * 1700;
  const weightFee = chargeableWeight > 2 ? Math.ceil((chargeableWeight - 2) / 0.5) * 4500 : 0;
  const remoteFee = remoteArea ? 22000 : 0;
  const fragileFee = fragile ? 12000 : 0;
  return Math.round((serviceBase + distanceFee + weightFee + remoteFee + fragileFee) * serviceFactor * vehicleFactor / 1000) * 1000;
}

function calculateDistanceKm(lat1, lng1, lat2, lng2) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);
  const value = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function findNearestWardWarehouse(lat, lng, callback) {
  db.query(
    "SELECT * FROM warehouses WHERE warehouse_type = 'ward' AND is_configured = 1 AND is_active = 1",
    (err, warehouses) => {
      if (err) return callback(err);
      if (!warehouses.length) return callback(null, null);
      const closest = warehouses.reduce((nearest, warehouse) => {
        const distance = calculateDistanceKm(lat, lng, Number(warehouse.lat), Number(warehouse.lng));
        return !nearest || distance < nearest.distance ? { warehouse, distance } : nearest;
      }, null);
      callback(null, closest.warehouse);
    }
  );
}

function notifyUser(userId, orderId, title, message) {
  if (!userId) return;
  db.query(
    'INSERT INTO notifications (recipient_user_id, order_id, title, message) VALUES (?, ?, ?, ?)',
    [userId, orderId || null, title, message],
    (err) => {
      if (err) return console.error('Lỗi lưu thông báo:', err);
      io.to(`user:${userId}`).emit(`notification_new_${userId}`, { order_id: orderId, title, message });
    }
  );
}

function notifyCustomerByEmail(email, orderId, title, message) {
  if (!email) return;
  db.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email], (err, users) => {
    if (err) return console.error('Lỗi tra cứu tài khoản người nhận:', err);
    if (users.length) notifyUser(users[0].id, orderId, title, message);
  });
}

// =========================================
// 1. API HỆ THỐNG CHUNG
// =========================================
app.post('/api/login', (req, res) => {
  const email = String(req.body.email || '').trim();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!email || email.length > 255 || !password || password.length > 1024) {
    return res.status(400).json({ success: false, message: 'Email hoặc mật khẩu không hợp lệ.' });
  }
  const sql = 'SELECT id, email, full_name, role, password FROM users WHERE email = ? AND status = "active" LIMIT 1';

  db.query(sql, [email], async (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Lỗi server: ' + err.sqlMessage });
    if (!results.length) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác' });
    }
    const record = results[0];
    let validPassword;
    try {
      validPassword = await verifyPassword(password, String(record.password || ''));
    } catch (verifyError) {
      console.error('Lỗi xác minh mật khẩu:', verifyError);
      return res.status(500).json({ success: false, message: 'Không thể xác minh thông tin đăng nhập.' });
    }
    if (!validPassword) return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác' });

    if (!String(record.password).startsWith(`${PASSWORD_HASH_PREFIX}$`)) {
      try {
        const upgradedPassword = await hashPassword(password);
        await new Promise((resolve, reject) => {
          db.query('UPDATE users SET password = ? WHERE id = ? AND password = ?', [upgradedPassword, record.id, record.password], (updateErr, result) => {
            if (updateErr) return reject(updateErr);
            if (!result.affectedRows) return reject(new Error('Mật khẩu cũ đã thay đổi trong lúc đăng nhập.'));
            resolve();
          });
        });
      } catch (upgradeError) {
        console.error('Lỗi nâng cấp mật khẩu cũ:', upgradeError);
        return res.status(500).json({ success: false, message: 'Không thể hoàn tất đăng nhập an toàn. Vui lòng thử lại.' });
      }
    }

    const user = { id: record.id, email: record.email, full_name: record.full_name, role: record.role };
    const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ success: true, user, token });
  });
});

app.post('/api/chat/sessions', (req, res) => {
  const mode = req.body.mode === 'live' ? 'live' : req.body.mode === 'ai' ? 'ai' : null;
  const customerName = String(req.body.customer_name || '').trim().slice(0, 255);
  const customerPhone = String(req.body.customer_phone || '').trim().slice(0, 50);
  if (!mode) return res.status(400).json({ success: false, message: 'Chế độ chat không hợp lệ.' });
  if (mode === 'live' && (!customerName || !/^[+\d][\d\s().-]{7,18}$/.test(customerPhone))) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập tên và số điện thoại hợp lệ để gặp nhân viên.' });
  }
  const guestToken = crypto.randomBytes(32).toString('hex');
  db.query(
    'INSERT INTO chat_sessions (mode, customer_name, customer_phone, guest_token_hash, status) VALUES (?, ?, ?, ?, ?)',
    [mode, customerName || 'Khách hàng', customerPhone || null, hashChatToken(guestToken), mode === 'live' ? 'waiting' : 'active'],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Không thể tạo phiên chat.' });
      const session = {
        id: result.insertId,
        mode,
        customer_name: customerName || 'Khách hàng',
        customer_phone: customerPhone || null,
        status: mode === 'live' ? 'waiting' : 'active'
      };
      if (mode === 'live') io.to('support_agents').emit('chat_session_updated', { session_id: result.insertId, status: 'waiting' });
      res.status(201).json({ success: true, data: { session, guest_token: guestToken } });
    }
  );
});

app.get('/api/chat/sessions', requireChatAgent, (req, res) => {
  const sql = `
    SELECT s.id, s.mode, s.customer_user_id, s.customer_name, s.customer_phone,
      s.status, s.assigned_agent_id, s.created_at, s.updated_at,
      (SELECT m.message FROM chat_messages m WHERE m.session_id = s.id ORDER BY m.id DESC LIMIT 1) AS latest_message
    FROM chat_sessions s
    WHERE s.mode = 'live' AND s.status <> 'closed'
    ORDER BY (s.status = 'waiting') DESC, s.updated_at DESC
  `;
  db.query(sql, (err, sessions) => {
    if (err) return res.status(500).json({ success: false, message: 'Không thể tải hàng đợi hỗ trợ.' });
    res.json({ success: true, data: sessions });
  });
});

app.get('/api/chat/sessions/:id/messages', (req, res) => {
  db.query('SELECT id, mode, customer_name, customer_phone, guest_token_hash, status FROM chat_sessions WHERE id = ? LIMIT 1', [req.params.id], (err, sessions) => {
    if (err) return res.status(500).json({ success: false, message: 'Không thể tải lịch sử chat.' });
    const session = sessions[0];
    const token = String(req.headers['x-chat-token'] || '');
    const agent = req.headers.authorization && /^Bearer\s+/i.test(String(req.headers.authorization));
    const loadMessages = () => db.query(
      'SELECT id, session_id, sender_type, sender_id, message, created_at FROM chat_messages WHERE session_id = ? ORDER BY id ASC LIMIT 500',
      [req.params.id],
      (messageErr, messages) => {
        if (messageErr) return res.status(500).json({ success: false, message: 'Không thể tải lịch sử chat.' });
        res.json({ success: true, data: { session, messages } });
      }
    );
    if (!session) return res.status(404).json({ success: false, message: 'Không tìm thấy phiên chat.' });
    if (isMatchingChatToken(token, session.guest_token_hash)) return loadMessages();
    if (agent) return requireChatAgent(req, res, () => loadMessages());
    return res.status(403).json({ success: false, message: 'Không có quyền truy cập phiên chat này.' });
  });
});

app.get('/api/chat/sessions/:id/context', requireChatAgent, (req, res) => {
  db.query('SELECT customer_name, customer_phone FROM chat_sessions WHERE id = ? LIMIT 1', [req.params.id], (err, sessions) => {
    if (err) return res.status(500).json({ success: false, message: 'Không thể tải thông tin khách hàng.' });
    if (!sessions.length) return res.status(404).json({ success: false, message: 'Không tìm thấy phiên chat.' });
    const customer = sessions[0];
    if (!customer.customer_phone) return res.json({ success: true, data: { customer, orders: [] } });
    db.query(
      'SELECT tracking_code, status, cod_amount, shipping_fee, created_at FROM orders WHERE receiver_phone = ? ORDER BY created_at DESC LIMIT 10',
      [customer.customer_phone],
      (ordersErr, orders) => {
        if (ordersErr) return res.status(500).json({ success: false, message: 'Không thể tải lịch sử đơn hàng.' });
        res.json({ success: true, data: { customer, orders } });
      }
    );
  });
});

app.put('/api/chat/sessions/:id/close', requireChatAgent, (req, res) => {
  db.query('UPDATE chat_sessions SET status = "closed" WHERE id = ? AND status <> "closed"', [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: 'Không thể kết thúc phiên chat.' });
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Phiên chat không tồn tại hoặc đã kết thúc.' });
    io.to(`chat:${req.params.id}`).emit('chat_closed', { session_id: Number(req.params.id) });
    io.to('support_agents').emit('chat_session_updated', { session_id: Number(req.params.id), status: 'closed' });
    res.json({ success: true });
  });
});

const normalizeChatText = (value) => String(value || '')
  .toLocaleLowerCase('vi')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd');

function getLocalChatReply(message) {
  const normalized = normalizeChatText(message);
  const trackingCode = message.match(/\bVTP[A-F0-9]{10}VN\b/i)?.[0];
  if (trackingCode) return { trackingCode };
  if (/\b(chao|xin chao|hello|hi)\b/.test(normalized)) {
    return { reply: 'Xin chào! Mình có thể giúp bạn tra cứu vận đơn, hướng dẫn gửi hàng, giải thích trạng thái đơn, COD và cước phí. Bạn đang cần hỗ trợ nội dung nào?' };
  }
  if (/\b(gia cuoc|cuoc|phi ship|phi van chuyen|bao gia)\b/.test(normalized)) {
    return { reply: 'Cước phí phụ thuộc vào điểm lấy/giao, loại xe, trọng lượng/kích thước và dịch vụ đi kèm. Bạn hãy vào mục Bảng giá hoặc gửi điểm gửi, điểm nhận và cân nặng để được hướng dẫn ước tính.' };
  }
  if (/\b(bao lau|thoi gian giao|may ngay|khi nao giao|giao hang mat bao lau)\b/.test(normalized)) {
    return { reply: 'Thời gian giao phụ thuộc tuyến đường và trạng thái vận đơn. Gửi mình mã vận đơn bắt đầu bằng VTP...VN, mình sẽ tra cứu trạng thái hiện tại.' };
  }
  if (/\b(gui hang|cach gui|tao don|dong goi|lay hang)\b/.test(normalized)) {
    return { reply: 'Để gửi hàng, bạn tạo đơn trên cổng Shop, nhập thông tin người nhận và kiện hàng, chọn bên trả cước rồi đóng gói chắc chắn. Điều phối sẽ phân công tài xế đến lấy; bạn có thể theo dõi bằng mã vận đơn.' };
  }
  if (/\b(cod|thu ho|tien thu ho|doi soat)\b/.test(normalized)) {
    return { reply: 'COD là khoản tài xế thu từ người nhận theo thông tin đơn. Shop có thể theo dõi đối soát trên hệ thống; nếu bạn cần tra một đơn cụ thể, hãy gửi mã vận đơn (không gửi mật khẩu hoặc mã OTP).' };
  }
  if (/\b(hoan hang|giao that bai|khong nhan|tu choi nhan)\b/.test(normalized)) {
    return { reply: 'Khi giao thất bại, hệ thống ghi nhận lý do và bằng chứng giao hàng, sau đó đơn được chuyển sang quy trình hoàn. Shop có thể kiểm tra chi tiết trong danh sách đơn và liên hệ CSKH nếu muốn yêu cầu giao lại.' };
  }
  if (/\b(lien he|nhan vien|ho tro|gap nguoi)\b/.test(normalized)) {
    return { reply: 'Bạn có thể chọn “Gặp nhân viên CSKH” ở màn hình chọn kênh chat để vào hàng chờ hỗ trợ trực tiếp.' };
  }
  return {
    reply: 'Mình chưa hiểu rõ câu hỏi. Bạn có thể hỏi về tra cứu vận đơn, cước phí, thời gian giao, cách gửi hàng, COD hoặc hàng hoàn. Nếu cần người hỗ trợ, hãy chọn “Gặp nhân viên CSKH”.'
  };
}

async function getConfiguredChatAiReply(message, history) {
  const apiKey = process.env.CHAT_AI_API_KEY;
  if (!apiKey) return null;

  const baseUrl = (process.env.CHAT_AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = process.env.CHAT_AI_MODEL || 'gpt-4o-mini';
  let endpoint;
  try {
    endpoint = new URL(`${baseUrl}/chat/completions`);
  } catch {
    throw new Error('CHAT_AI_BASE_URL không phải URL hợp lệ.');
  }
  if (!['https:', 'http:'].includes(endpoint.protocol)) {
    throw new Error('CHAT_AI_BASE_URL phải sử dụng HTTP hoặc HTTPS.');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: 'Bạn là trợ lý CSKH Smart Logistics, trả lời bằng tiếng Việt rõ ràng, ngắn gọn và lịch sự. Chỉ hướng dẫn các nghiệp vụ giao nhận, tạo đơn, cước phí, trạng thái vận đơn, COD và hàng hoàn. Không yêu cầu hoặc tiết lộ mật khẩu, mã OTP, dữ liệu thanh toán hay thông tin cá nhân nhạy cảm. Không tự khẳng định thông tin vận đơn nếu chưa được tra cứu bằng công cụ.'
        },
        ...history.map((item) => ({
          role: item.sender_type === 'bot' ? 'assistant' : 'user',
          content: item.message
        })),
        { role: 'user', content: message }
      ]
    }),
    signal: AbortSignal.timeout(20000)
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    console.error('Nhà cung cấp chatbot trả lỗi:', response.status, result?.error?.message || 'No response body');
    throw new Error('Dịch vụ AI đang bận hoặc chưa cấu hình đúng. Vui lòng thử lại hoặc chọn CSKH.');
  }
  const reply = result?.choices?.[0]?.message?.content;
  if (typeof reply !== 'string' || !reply.trim()) {
    throw new Error('Dịch vụ AI chưa trả về câu trả lời. Vui lòng thử lại.');
  }
  return reply.trim().slice(0, 4000);
}

app.post('/api/chat/ai', (req, res) => {
  const sessionId = Number(req.body.session_id);
  const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
  if (!Number.isSafeInteger(sessionId) || sessionId <= 0 || !message || message.length > 2000) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập nội dung cần hỗ trợ.' });
  }
  db.query('SELECT id, mode, guest_token_hash, status FROM chat_sessions WHERE id = ? LIMIT 1', [sessionId], (err, sessions) => {
    if (err) return res.status(500).json({ success: false, message: 'Không thể xử lý câu hỏi.' });
    const session = sessions[0];
    if (!session || session.mode !== 'ai' || !isMatchingChatToken(req.body.guest_token, session.guest_token_hash)) {
      return res.status(403).json({ success: false, message: 'Không có quyền sử dụng phiên chatbot này.' });
    }
    if (session.status === 'closed') return res.status(409).json({ success: false, message: 'Phiên chat đã kết thúc.' });
    db.query(
      'SELECT sender_type, message FROM chat_messages WHERE session_id = ? ORDER BY id DESC LIMIT 12',
      [sessionId],
      async (historyErr, historyRows) => {
        if (historyErr) return res.status(500).json({ success: false, message: 'Không thể tải ngữ cảnh cuộc trò chuyện.' });
        const history = historyRows.reverse();
        const localAnswer = getLocalChatReply(message);
        if (localAnswer.trackingCode) {
          db.query('SELECT tracking_code, status FROM orders WHERE tracking_code = ? LIMIT 1', [localAnswer.trackingCode], (orderErr, orders) => {
            if (orderErr) return res.status(500).json({ success: false, message: 'Không thể tra cứu vận đơn lúc này.' });
            const statusLabels = {
              pending: 'chờ lấy hàng', picking: 'tài xế đang đến lấy hàng', picked_up: 'đã lấy hàng',
              at_origin_warehouse: 'đã về kho lấy hàng', transferring_to_central: 'đang chuyển về kho tổng',
              at_central_warehouse: 'đang xử lý tại kho tổng', transferring_to_destination: 'đang chuyển đến kho đích',
              at_destination_warehouse: 'đã đến kho đích', delivering: 'đang giao hàng', completed: 'đã giao thành công',
              returning: 'đang hoàn hàng', cancelled: 'đã hủy'
            };
            const orderReply = orders.length
              ? `Vận đơn ${orders[0].tracking_code} hiện ${statusLabels[orders[0].status] || orders[0].status}. Bạn có thể xem chi tiết tại mục Tra cứu vận đơn.`
              : `Mình chưa tìm thấy vận đơn ${localAnswer.trackingCode}. Bạn vui lòng kiểm tra lại mã vận đơn.`;
            saveChatExchange(orderReply);
          });
          return;
        }
        let reply;
        try {
          const aiReply = await getConfiguredChatAiReply(message, history);
          if (aiReply) {
            reply = aiReply;
          } else {
            reply = localAnswer.reply;
          }
        } catch (aiError) {
          console.error('Không thể tạo câu trả lời chatbot:', aiError);
          return res.status(502).json({ success: false, message: aiError.message || 'Chatbot tạm thời không khả dụng.' });
        }

        saveChatExchange(reply);
      }
    );

    function saveChatExchange(reply) {
      db.query(
        'INSERT INTO chat_messages (session_id, sender_type, message) VALUES (?, "customer", ?)',
        [sessionId, message],
        (saveQuestionErr) => {
          if (saveQuestionErr) return res.status(500).json({ success: false, message: 'Không thể lưu câu hỏi.' });
          db.query(
            'INSERT INTO chat_messages (session_id, sender_type, message) VALUES (?, "bot", ?)',
            [sessionId, reply],
            (saveReplyErr, result) => {
              if (saveReplyErr) return res.status(500).json({ success: false, message: 'Không thể lưu câu trả lời chatbot.' });
              db.query('UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [sessionId], (updateErr) => {
                if (updateErr) console.error('Không thể cập nhật thời gian phiên chatbot:', updateErr);
              });
              const event = {
                id: result.insertId,
                session_id: sessionId,
                sender_type: 'bot',
                message: reply,
                created_at: new Date().toISOString()
              };
              io.to(`chat:${sessionId}`).emit('receive_message', event);
              res.json({ success: true, data: event });
            }
          );
        }
      );
    }
  });
});

// =========================================
// 2. API CỬA HÀNG (SHOP) & KHÁCH HÀNG
// =========================================
const createOrder = (req, res) => {
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
    destination_province,
    fee_payer,
    service_fee
  } = req.body;
  const finalTrackingCode = String(tracking_code || `VTP${crypto.randomBytes(5).toString('hex').toUpperCase()}VN`);
  const normalizedReceiverPhone = String(receiver_phone || '').trim().replace(/[\s().-]/g, '');
  const normalizedReceiverName = String(receiver_name || '').trim();
  const normalizedReceiverAddress = String(receiver_address || '').trim();
  const normalizedShopAddress = String(shop_address || '').trim();

  const numericFields = { cod_amount, weight_kg, length, width, height, item_value, distance_km, shop_lat, shop_lng, receiver_lat, receiver_lng, service_fee };
  const hasInvalidNumber = Object.entries(numericFields).some(([, value]) => value !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 0));
  const normalizedReceiverLat = receiver_lat === undefined || receiver_lat === null || receiver_lat === '' ? null : Number(receiver_lat);
  const normalizedReceiverLng = receiver_lng === undefined || receiver_lng === null || receiver_lng === '' ? null : Number(receiver_lng);
  const normalizedShopLat = Number(shop_lat) || 10.762622;
  const normalizedShopLng = Number(shop_lng) || 106.660172;
  const requiresTruck = Number(weight_kg) > 100
    || Number(length) * Number(width) * Number(height) > 1000000;
  const normalizedVehicle = requiresTruck
    ? 'truck'
    : ['motorbike', 'van', 'truck'].includes(vehicle_type) ? vehicle_type : 'motorbike';
  const normalizedFeePayer = fee_payer === undefined ? 'sender' : fee_payer;
  const normalizedServiceFee = Number(service_fee) || 0;
  const insuranceFee = Number(item_value) > 1000000 ? Number(item_value) * 0.005 : 0;
  const provinceName = String(destination_province || 'Hồ Chí Minh').trim() || 'Hồ Chí Minh';
  const effectiveRemoteArea = Boolean(is_remote_area);
  const hasReceiverCoordinates = normalizedReceiverLat !== null && normalizedReceiverLng !== null;
  const effectiveDistanceKm = hasReceiverCoordinates
    ? calculateDistanceKm(normalizedShopLat, normalizedShopLng, normalizedReceiverLat, normalizedReceiverLng)
    : Number(distance_km);
  const effectiveShippingFee = calculateShippingFee({
    weight: weight_kg,
    length,
    width,
    height,
    distance: effectiveDistanceKm,
    serviceType: service_type,
    remoteArea: effectiveRemoteArea,
    fragile: is_fragile,
    vehicleType: normalizedVehicle,
    itemValue: item_value,
    originProvince: shop_province,
    destinationProvince: provinceName
  });

  if (!normalizedShopAddress || !normalizedReceiverName || !normalizedReceiverPhone || !normalizedReceiverAddress) {
    return res.status(400).json({ success: false, message: 'Thiếu địa chỉ cửa hàng hoặc thông tin người nhận.' });
  }
  if (!/^0\d{9,10}$/.test(normalizedReceiverPhone)) {
    return res.status(400).json({ success: false, message: 'Số điện thoại người nhận phải có 10-11 chữ số và bắt đầu bằng 0.' });
  }
  if (normalizedReceiverName.length > 255 || normalizedReceiverPhone.length > 50
    || normalizedShopAddress.length > 1000 || normalizedReceiverAddress.length > 1000) {
    return res.status(400).json({ success: false, message: 'Tên, số điện thoại hoặc địa chỉ vượt quá độ dài cho phép.' });
  }

  if (shop_lat === undefined || shop_lat === null || shop_lat === ''
    || shop_lng === undefined || shop_lng === null || shop_lng === ''
    || normalizedReceiverLat === null || normalizedReceiverLng === null) {
    return res.status(400).json({ success: false, message: 'Cần chọn vị trí Shop và điểm giao trên bản đồ để xác định kho con.' });
  }

  if (hasInvalidNumber || Number(weight_kg) <= 0 || Number(length) <= 0 || Number(width) <= 0 || Number(height) <= 0 || Number(distance_km) <= 0) {
    return res.status(400).json({ success: false, message: 'Thông tin cân nặng, kích thước hoặc khoảng cách không hợp lệ.' });
  }
  if ((normalizedReceiverLat !== null && Math.abs(normalizedReceiverLat) > 90) || (normalizedReceiverLng !== null && Math.abs(normalizedReceiverLng) > 180)) {
    return res.status(400).json({ success: false, message: 'Tọa độ điểm giao hàng không hợp lệ.' });
  }
  if (Math.abs(normalizedShopLat) > 90 || Math.abs(normalizedShopLng) > 180) {
    return res.status(400).json({ success: false, message: 'Tọa độ cửa hàng không hợp lệ.' });
  }
  if (!isWithinHcmcBoundary(normalizedShopLat, normalizedShopLng)
    || !isWithinHcmcBoundary(normalizedReceiverLat, normalizedReceiverLng)) {
    return res.status(400).json({ success: false, message: 'Điểm lấy và điểm giao phải nằm trong phạm vi phục vụ TP. Hồ Chí Minh.' });
  }

  if (!['economy', 'standard', 'express'].includes(service_type)) {
    return res.status(400).json({ success: false, message: 'Loại dịch vụ không hợp lệ.' });
  }
  if (!['sender', 'receiver'].includes(normalizedFeePayer)) {
    return res.status(400).json({ success: false, message: 'Người trả cước không hợp lệ.' });
  }
  if (normalizedServiceFee < 0) {
    return res.status(400).json({ success: false, message: 'Phí dịch vụ không được âm.' });
  }

  const sql = `
    INSERT INTO orders (
      tracking_code, shop_id, shop_address, shop_province, shop_lat, shop_lng, receiver_name, receiver_phone, receiver_address, receiver_lat, receiver_lng, customer_email,
      cod_amount, shipping_fee, fee_payer, service_fee, insurance_fee, weight_kg, length, width, height, item_value, distance_km,
      is_remote_area, service_type, is_fragile, vehicle_type, destination_province, status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `;
  db.query(sql, [
    finalTrackingCode,
    shop_id || null,
    normalizedShopAddress,
    String(shop_province || 'Hồ Chí Minh').trim(),
    normalizedShopLat,
    normalizedShopLng,
    normalizedReceiverName,
    normalizedReceiverPhone,
    normalizedReceiverAddress,
    normalizedReceiverLat,
    normalizedReceiverLng,
    customer_email || null,
    Number(cod_amount) || 0,
    effectiveShippingFee,
    normalizedFeePayer,
    normalizedServiceFee,
    insuranceFee,
    Number(weight_kg),
    Number(length),
    Number(width),
    Number(height),
    Number(item_value) || 0,
    effectiveDistanceKm,
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
      notifyUser(shop_id, result.insertId, 'Đã tiếp nhận vận đơn', `Đơn ${finalTrackingCode} đã được gửi đến Điều phối.`);
      notifyCustomerByEmail(customer_email, result.insertId, 'Đơn hàng đang được xử lý', `Shop đã tạo đơn ${finalTrackingCode} để giao đến bạn.`);
      io.emit('order_status_changed', { order_id: Number(result.insertId), status: 'pending' });
      res.json({ success: true, message: 'Tạo đơn hàng thành công!', orderId: result.insertId, tracking_code: finalTrackingCode, shipping_fee: effectiveShippingFee, service_fee: normalizedServiceFee, insurance_fee: insuranceFee });
    });
  });
};

app.get('/api/shop/integrations', (req, res) => {
  const shopId = Number(req.authUser.id);
  db.query(
    `SELECT id, name, key_prefix, created_at, last_used_at
     FROM shop_api_keys WHERE shop_id = ? AND revoked_at IS NULL
     ORDER BY created_at DESC`,
    [shopId],
    (keysErr, keys) => {
      if (keysErr) return res.status(500).json({ success: false, message: 'Không tải được danh sách API key.' });
      db.query(
        'SELECT target_url, enabled, secret_ciphertext IS NOT NULL AS secret_configured, updated_at FROM shop_webhook_configs WHERE shop_id = ? LIMIT 1',
        [shopId],
        (webhookErr, rows) => {
          if (webhookErr) return res.status(500).json({ success: false, message: 'Không tải được cấu hình webhook.' });
          const webhook = rows[0] || {};
          res.json({
            success: true,
            data: {
              api_keys: keys,
              webhook: {
                target_url: webhook.target_url || '',
                enabled: Boolean(webhook.enabled),
                secret_configured: Boolean(webhook.secret_configured),
                updated_at: webhook.updated_at || null
              }
            }
          });
        }
      );
    }
  );
});

app.post('/api/shop/integrations/keys', (req, res) => {
  const shopId = Number(req.authUser.id);
  const name = String(req.body.name || '').trim();
  if (!name || name.length > 100) {
    return res.status(400).json({ success: false, message: 'Tên API key phải từ 1 đến 100 ký tự.' });
  }
  db.query(
    'SELECT COUNT(*) AS active_count FROM shop_api_keys WHERE shop_id = ? AND revoked_at IS NULL',
    [shopId],
    (countErr, rows) => {
      if (countErr) return res.status(500).json({ success: false, message: 'Không thể kiểm tra giới hạn API key.' });
      if (Number(rows[0].active_count) >= 10) {
        return res.status(409).json({ success: false, message: 'Mỗi Shop được tạo tối đa 10 API key đang hoạt động.' });
      }
      const apiKey = `sl_live_${crypto.randomBytes(32).toString('base64url')}`;
      const keyPrefix = apiKey.slice(0, 16);
      db.query(
        'INSERT INTO shop_api_keys (shop_id, name, key_prefix, key_hash) VALUES (?, ?, ?, ?)',
        [shopId, name, keyPrefix, hashApiKey(apiKey)],
        (insertErr, result) => {
          if (insertErr) return res.status(500).json({ success: false, message: 'Không thể tạo API key.' });
          res.status(201).json({
            success: true,
            data: { id: result.insertId, name, key_prefix: keyPrefix, api_key: apiKey },
            message: 'API key chỉ hiển thị đầy đủ một lần. Hãy lưu ở nơi an toàn.'
          });
        }
      );
    }
  );
});

app.delete('/api/shop/integrations/keys/:id', (req, res) => {
  const keyId = Number(req.params.id);
  if (!Number.isSafeInteger(keyId) || keyId <= 0) {
    return res.status(400).json({ success: false, message: 'Mã API key không hợp lệ.' });
  }
  db.query(
    'UPDATE shop_api_keys SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND shop_id = ? AND revoked_at IS NULL',
    [keyId, req.authUser.id],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Không thể thu hồi API key.' });
      if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Không tìm thấy API key đang hoạt động của Shop.' });
      res.json({ success: true, message: 'Đã thu hồi API key.' });
    }
  );
});

app.put('/api/shop/integrations/webhook', async (req, res) => {
  const shopId = Number(req.authUser.id);
  const targetUrl = String(req.body.target_url || '').trim();
  if (targetUrl.length > 2048) return res.status(400).json({ success: false, message: 'Webhook URL quá dài.' });
  if (targetUrl) {
    try {
      await validateWebhookTarget(targetUrl);
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message || 'Webhook URL không hợp lệ.' });
    }
  }
  db.query(
    `INSERT INTO shop_webhook_configs (shop_id, target_url, enabled)
     VALUES (?, ?, 0)
     ON DUPLICATE KEY UPDATE
       target_url = VALUES(target_url),
       enabled = IF(VALUES(target_url) IS NULL, 0, enabled),
       secret_ciphertext = IF(VALUES(target_url) IS NULL, NULL, secret_ciphertext)`,
    [shopId, targetUrl || null],
    (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Không thể lưu cấu hình webhook.' });
      res.json({ success: true, message: targetUrl ? 'Đã lưu endpoint webhook.' : 'Đã xóa endpoint webhook và tắt webhook.' });
    }
  );
});

app.post('/api/shop/integrations/webhook/secret', (req, res) => {
  const shopId = Number(req.authUser.id);
  if (!webhookEncryptionKey) {
    return res.status(503).json({ success: false, message: 'Máy chủ cần cấu hình WEBHOOK_ENCRYPTION_KEY hoặc JWT_SECRET ổn định trước khi tạo secret.' });
  }
  db.query('SELECT target_url FROM shop_webhook_configs WHERE shop_id = ? LIMIT 1', [shopId], (findErr, rows) => {
    if (findErr) return res.status(500).json({ success: false, message: 'Không thể kiểm tra cấu hình webhook.' });
    if (!rows.length || !rows[0].target_url) {
      return res.status(409).json({ success: false, message: 'Hãy lưu endpoint webhook trước khi tạo signing secret.' });
    }
    const secret = `whsec_${crypto.randomBytes(32).toString('base64url')}`;
    db.query(
      'UPDATE shop_webhook_configs SET secret_ciphertext = ?, enabled = 1 WHERE shop_id = ?',
      [encryptWebhookSecret(secret), shopId],
      (updateErr) => {
        if (updateErr) return res.status(500).json({ success: false, message: 'Không thể tạo signing secret.' });
        res.status(201).json({
          success: true,
          data: { secret },
          message: 'Signing secret chỉ hiển thị lần này. Lưu secret ngay và cập nhật vào máy chủ nhận webhook.'
        });
      }
    );
  });
});

app.get('/api/dispatcher/rma', (req, res) => {
  db.query(
    `SELECT r.order_id, r.shop_id, r.status AS request_status, r.request_note,
      r.requested_at, r.reviewed_at, r.review_note, o.tracking_code, o.status AS order_status,
      o.receiver_name, o.receiver_phone, o.receiver_address, o.cod_amount, o.fail_reason,
      o.proof_image, u.full_name AS shop_name
     FROM shop_redelivery_requests r
     JOIN orders o ON o.id = r.order_id AND o.shop_id = r.shop_id
     LEFT JOIN users u ON u.id = r.shop_id
     ORDER BY (r.status = 'pending') DESC, r.requested_at DESC
     LIMIT 200`,
    (err, requests) => {
      if (err) return res.status(500).json({ success: false, message: 'Không tải được danh sách yêu cầu giao lại.' });
      res.json({ success: true, data: requests });
    }
  );
});

app.put('/api/dispatcher/rma/:orderId', (req, res) => {
  const orderId = Number(req.params.orderId);
  const status = String(req.body.status || '');
  const reviewNote = String(req.body.review_note || '').trim();
  if (!Number.isSafeInteger(orderId) || orderId <= 0
    || !['approved', 'rejected'].includes(status)
    || reviewNote.length > 1000
    || status === 'rejected' && reviewNote.length < 5) {
    return res.status(400).json({ success: false, message: 'Yêu cầu duyệt không hợp lệ; khi từ chối cần ghi rõ lý do (5–1000 ký tự).' });
  }
  db.query(
    `SELECT r.shop_id, o.tracking_code
     FROM shop_redelivery_requests r
     JOIN orders o ON o.id = r.order_id AND o.shop_id = r.shop_id
     WHERE r.order_id = ? AND r.status = 'pending' AND o.status = 'returning'
     LIMIT 1`,
    [orderId],
    (findErr, rows) => {
      if (findErr) return res.status(500).json({ success: false, message: 'Không thể kiểm tra yêu cầu giao lại.' });
      if (!rows.length) {
        return res.status(409).json({ success: false, message: 'Yêu cầu không còn chờ xử lý hoặc đơn không còn ở trạng thái hoàn.' });
      }
      db.query(
        `UPDATE shop_redelivery_requests AS r
         SET status = ?, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?, review_note = ?
         WHERE r.order_id = ? AND r.status = 'pending'
           AND EXISTS (SELECT 1 FROM orders o WHERE o.id = r.order_id AND o.shop_id = r.shop_id AND o.status = 'returning')`,
        [status, req.authUser.id, reviewNote || null, orderId],
        (updateErr, result) => {
          if (updateErr) return res.status(500).json({ success: false, message: 'Không thể cập nhật yêu cầu giao lại.' });
          if (!result.affectedRows) {
            return res.status(409).json({ success: false, message: 'Yêu cầu vừa được xử lý hoặc đơn không còn ở trạng thái hoàn.' });
          }
          const decisionText = status === 'approved' ? 'đã được duyệt' : 'bị từ chối';
          notifyUser(rows[0].shop_id, orderId, 'Cập nhật yêu cầu giao lại', `Yêu cầu giao lại đơn ${rows[0].tracking_code} ${decisionText}.${reviewNote ? ` Ghi chú: ${reviewNote}` : ''}`);
          res.json({ success: true, message: status === 'approved' ? 'Đã duyệt yêu cầu giao lại.' : 'Đã từ chối yêu cầu giao lại.' });
        }
      );
    }
  );
});

app.get('/api/shop/rma', (req, res) => {
  const shopId = Number(req.authUser.id);
  db.query(
    `SELECT o.id, o.tracking_code, o.receiver_name, o.receiver_phone, o.receiver_address,
      o.cod_amount, o.shipping_fee, o.fee_payer, o.fail_reason, o.proof_image,
      o.updated_at, r.status AS redelivery_status, r.request_note AS redelivery_note,
      r.requested_at AS redelivery_requested_at, r.review_note AS redelivery_review_note
     FROM orders o
     LEFT JOIN shop_redelivery_requests r ON r.order_id = o.id AND r.shop_id = o.shop_id
     WHERE o.shop_id = ? AND o.status = 'returning'
     ORDER BY o.updated_at DESC`,
    [shopId],
    (ordersErr, orders) => {
      if (ordersErr) return res.status(500).json({ success: false, message: 'Không tải được danh sách hàng hoàn.' });
      if (!orders.length) return res.json({ success: true, data: [] });
      db.query(
        `SELECT h.order_id, h.to_status, h.note, h.proof_image, h.signature_image, h.created_at
         FROM order_status_history h
         JOIN orders o ON o.id = h.order_id
         WHERE o.shop_id = ? AND o.status = 'returning'
         ORDER BY h.created_at DESC, h.id DESC`,
        [shopId],
        (historyErr, history) => {
          if (historyErr) return res.status(500).json({ success: false, message: 'Không tải được lịch sử bằng chứng hàng hoàn.' });
          const historyByOrder = new Map();
          for (const entry of history) {
            const entries = historyByOrder.get(Number(entry.order_id)) || [];
            entries.push(entry);
            historyByOrder.set(Number(entry.order_id), entries);
          }
          res.json({
            success: true,
            data: orders.map((order) => ({
              ...order,
              status_history: historyByOrder.get(Number(order.id)) || []
            }))
          });
        }
      );
    }
  );
});

app.post('/api/shop/rma/:orderId/redelivery', (req, res) => {
  const shopId = Number(req.authUser.id);
  const orderId = Number(req.params.orderId);
  const note = String(req.body.note || '').trim();
  if (!Number.isSafeInteger(orderId) || orderId <= 0 || note.length < 8 || note.length > 1000
    || req.body.customer_confirmed !== true) {
    return res.status(400).json({ success: false, message: 'Cần xác nhận khách đồng ý nhận lại và ghi chú từ 8 đến 1000 ký tự.' });
  }
  db.query(
    "SELECT id, tracking_code FROM orders WHERE id = ? AND shop_id = ? AND status = 'returning' LIMIT 1",
    [orderId, shopId],
    (orderErr, orders) => {
      if (orderErr) return res.status(500).json({ success: false, message: 'Không thể kiểm tra đơn hàng.' });
      if (!orders.length) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng hoàn thuộc Shop.' });
      db.query('SELECT status FROM shop_redelivery_requests WHERE order_id = ? AND shop_id = ? LIMIT 1', [orderId, shopId], (requestErr, requests) => {
        if (requestErr) return res.status(500).json({ success: false, message: 'Không thể kiểm tra yêu cầu giao lại.' });
        if (requests.length && requests[0].status !== 'rejected') {
          return res.status(409).json({ success: false, message: 'Đơn này đã có yêu cầu giao lại đang chờ xử lý hoặc đã được duyệt.' });
        }
        const saveRequest = (callback) => {
          if (requests.length) {
            return db.query(
              `UPDATE shop_redelivery_requests
               SET status = 'pending', request_note = ?, requested_at = CURRENT_TIMESTAMP,
                 reviewed_at = NULL, reviewed_by = NULL, review_note = NULL
               WHERE order_id = ? AND shop_id = ? AND status = 'rejected'`,
              [note, orderId, shopId],
              callback
            );
          }
          db.query(
            'INSERT INTO shop_redelivery_requests (order_id, shop_id, request_note) VALUES (?, ?, ?)',
            [orderId, shopId, note],
            callback
          );
        };
        saveRequest((saveErr) => {
          if (saveErr) {
            if (saveErr.code === 'ER_DUP_ENTRY') {
              return res.status(409).json({ success: false, message: 'Yêu cầu giao lại vừa được gửi cho đơn này.' });
            }
            return res.status(500).json({ success: false, message: 'Không thể lưu yêu cầu giao lại.' });
          }
          db.query(
            "SELECT id FROM users WHERE status = 'active' AND role IN ('fleet_manager','director')",
            (staffErr, staff) => {
              if (staffErr) console.error('Không tải được danh sách điều phối nhận yêu cầu giao lại:', staffErr);
              (staff || []).forEach(({ id }) => notifyUser(id, orderId, 'Shop yêu cầu giao lại', `Đơn ${orders[0].tracking_code} có yêu cầu giao lại. Vui lòng kiểm tra thông tin trong hồ sơ RMA.`));
              res.status(201).json({ success: true, message: 'Đã gửi yêu cầu giao lại cho bộ phận điều phối.' });
            }
          );
        });
      });
    }
  );
});

app.post('/api/orders', createOrder);
app.post('/api/v1/orders', (req, res, next) => {
  const suppliedKey = String(req.get('x-api-key') || '');
  if (!suppliedKey || suppliedKey.length > 200) {
    return res.status(401).json({ success: false, message: 'API key không hợp lệ.' });
  }
  db.query(
    `SELECT k.id, k.shop_id
     FROM shop_api_keys k
     JOIN users u ON u.id = k.shop_id AND u.role = 'shop' AND u.status = 'active'
     WHERE k.key_hash = ? AND k.revoked_at IS NULL
     LIMIT 1`,
    [hashApiKey(suppliedKey)],
    (keyErr, keys) => {
      if (keyErr) return res.status(500).json({ success: false, message: 'Không thể xác thực API key.' });
      if (keys.length) {
        const apiKey = keys[0];
        req.apiShopId = Number(apiKey.shop_id);
        req.body.shop_id = req.apiShopId;
        db.query('UPDATE shop_api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?', [apiKey.id], (usageErr) => {
          if (usageErr) console.error('Không cập nhật được thời gian sử dụng API key:', usageErr);
        });
        return next();
      }

      const legacyKey = process.env.OPEN_API_KEY;
      const supplied = Buffer.from(suppliedKey);
      const expected = Buffer.from(legacyKey || '');
      const isLegacyKey = Boolean(legacyKey)
        && supplied.length === expected.length
        && crypto.timingSafeEqual(supplied, expected);
      if (!isLegacyKey) return res.status(401).json({ success: false, message: 'API key không hợp lệ.' });

      const legacyShopId = Number(req.body.shop_id);
      if (!Number.isSafeInteger(legacyShopId) || legacyShopId <= 0) {
        return res.status(400).json({ success: false, message: 'API key hệ thống cần shop_id hợp lệ.' });
      }
      db.query('SELECT id FROM users WHERE id = ? AND role = "shop" AND status = "active" LIMIT 1', [legacyShopId], (shopErr, shops) => {
        if (shopErr) return res.status(500).json({ success: false, message: 'Không thể xác thực Shop.' });
        if (!shops.length) return res.status(403).json({ success: false, message: 'shop_id không thuộc Shop đang hoạt động.' });
        req.apiShopId = legacyShopId;
        next();
      });
    }
  );
}, createOrder);

const openApiSpecification = {
  openapi: '3.0.3',
  info: {
    title: 'Smart Logistics Open API',
    version: '1.0.0',
    description: 'Tích hợp tạo đơn giao nhận. Shop dùng API key riêng do cổng Shop cấp; gửi qua header x-api-key. shop_id được xác định từ khóa.'
  },
  servers: [{ url: 'http://localhost:5000' }],
  paths: {
    '/api/v1/orders': {
      post: {
        summary: 'Tạo vận đơn từ website bán hàng',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['shop_address', 'shop_lat', 'shop_lng', 'receiver_name', 'receiver_phone', 'receiver_address', 'receiver_lat', 'receiver_lng', 'weight_kg'],
                properties: {
                  shop_id: { type: 'integer', example: 6, description: 'Chỉ bắt buộc khi dùng OPEN_API_KEY hệ thống cũ; API key riêng của Shop tự xác định chủ sở hữu.' },
                  shop_address: { type: 'string' },
                  shop_lat: { type: 'number', example: 10.762622 },
                  shop_lng: { type: 'number', example: 106.660172 },
                  receiver_name: { type: 'string' },
                  receiver_phone: { type: 'string' },
                  receiver_address: { type: 'string' },
                  receiver_lat: { type: 'number' },
                  receiver_lng: { type: 'number' },
                  customer_email: { type: 'string', format: 'email' },
                  cod_amount: { type: 'number', minimum: 0 },
                  weight_kg: { type: 'number', exclusiveMinimum: 0 },
                  fee_payer: { type: 'string', enum: ['sender', 'receiver'], default: 'sender' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Vận đơn được tiếp nhận.' },
          400: { description: 'Dữ liệu hoặc tọa độ không hợp lệ.' },
          401: { description: 'API key không hợp lệ.' },
          403: { description: 'Shop gắn với API key không còn hoạt động.' }
        }
      }
    }
  },
  components: { securitySchemes: { ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key' } } }
};
app.get('/api/openapi.json', (req, res) => res.json(openApiSpecification));
app.get('/api/docs', (req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Smart Logistics API</title><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head>
<body><div id="swagger-ui"></div><script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({url:'/api/openapi.json',dom_id:'#swagger-ui',deepLinking:true,presets:[SwaggerUIBundle.presets.apis,SwaggerUIBundle.SwaggerUIStandalonePreset]});</script></body></html>`);
});

app.get('/api/notifications/:userId', (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId !== Number(req.authUser.id)) {
    return res.status(403).json({ success: false, message: 'Bạn chỉ được xem thông báo của tài khoản đang đăng nhập.' });
  }
  db.query(
    'SELECT id, order_id, title, message, is_read, created_at FROM notifications WHERE recipient_user_id = ? ORDER BY created_at DESC LIMIT 50',
    [userId],
    (err, results) => {
      if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
      res.json({ success: true, data: results });
    }
  );
});

app.put('/api/notifications/:id/read', (req, res) => {
  const notificationId = Number(req.params.id);
  if (!Number.isInteger(notificationId) || notificationId <= 0) {
    return res.status(400).json({ success: false, message: 'Mã thông báo không hợp lệ.' });
  }
  db.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND recipient_user_id = ?', [notificationId, req.authUser.id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo.' });
    res.json({ success: true });
  });
});

app.get('/api/warehouses', (req, res) => {
  db.query('SELECT * FROM warehouses ORDER BY warehouse_type, ward_name', (err, warehouses) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true, data: warehouses });
  });
});

app.post('/api/warehouses', (req, res) => {
  const wardName = String(req.body.ward_name || '').trim();
  if (!wardName || wardName === '__CENTRAL__') {
    return res.status(400).json({ success: false, message: 'Nhập tên phường hợp lệ cho kho con.' });
  }
  db.query(
    "INSERT INTO warehouses (warehouse_type, ward_name, name) VALUES ('ward', ?, ?)",
    [wardName, `Kho phường ${wardName}`],
    (err, result) => {
      if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Phường này đã có một kho con.' });
      if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
      res.status(201).json({ success: true, warehouseId: result.insertId, message: 'Đã tạo kho chờ cấu hình vị trí.' });
    }
  );
});

app.put('/api/warehouses/:id', (req, res) => {
  const { name, address, lat, lng, is_active } = req.body;
  const normalizedLat = Number(lat);
  const normalizedLng = Number(lng);
  if (!String(name || '').trim() || !String(address || '').trim()
    || !Number.isFinite(normalizedLat) || Math.abs(normalizedLat) > 90
    || !Number.isFinite(normalizedLng) || Math.abs(normalizedLng) > 180) {
    return res.status(400).json({ success: false, message: 'Cần nhập tên, địa chỉ và tọa độ kho hợp lệ.' });
  }
  db.query(
    `UPDATE warehouses SET name = ?, address = ?, lat = ?, lng = ?, is_configured = 1, is_active = ?
     WHERE id = ? AND warehouse_type = 'ward'`,
    [String(name).trim(), String(address).trim(), normalizedLat, normalizedLng, is_active === false ? 0 : 1, req.params.id],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
      if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Không tìm thấy kho con.' });
      res.json({ success: true, message: 'Đã lưu vị trí kho con.' });
    }
  );
});

app.get('/api/orders', (req, res) => {
  const sql = 'SELECT * FROM orders WHERE (? IS NULL OR shop_id = ?) ORDER BY created_at DESC';
  const shopId = req.shopScopeId || null;
  db.query(sql, [shopId, shopId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Lỗi tải dữ liệu: ' + err.sqlMessage });
    res.json({ success: true, data: redactDeliveryOtp(results) });
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
    SELECT o.id, o.tracking_code, o.status, o.receiver_name, o.receiver_phone,
      o.receiver_address, o.receiver_lat, o.receiver_lng, o.cod_amount, o.shipping_fee,
      o.shop_lat, o.shop_lng, o.shop_address, o.proof_image, o.fail_reason,
      o.created_at, o.updated_at,
      COALESCE(ud.full_name, ux.full_name, uc.full_name, up.full_name) as shipper_name,
      up.full_name as pickup_driver_name, uc.full_name as central_transfer_driver_name,
      ux.full_name as destination_transfer_driver_name, ud.full_name as delivery_driver_name
    FROM orders o
    LEFT JOIN users up ON o.pickup_shipper_id = up.id
    LEFT JOIN users uc ON o.central_transfer_shipper_id = uc.id
    LEFT JOIN users ux ON o.destination_transfer_shipper_id = ux.id
    LEFT JOIN users ud ON o.delivery_shipper_id = ud.id
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
        : null;

      db.query(
        'SELECT id, from_status, to_status, note, proof_image, signature_image, created_at FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC, id ASC',
        [order.id],
        (historyErr, statusHistory) => {
          res.json({
            success: true,
            data: {
              ...redactDeliveryOtp([order])[0],
              warehouse,
              pickup,
              delivery,
              driver_location: driverLocation,
              status_history: historyErr ? [] : statusHistory,
              route_points: [warehouse, pickup, delivery],
              progress: ({
                pending: 5,
                picking: 15,
                picked_up: 25,
                at_origin_warehouse: 35,
                transferring_to_central: 45,
                at_central_warehouse: 60,
                transferring_to_destination: 70,
                at_destination_warehouse: 80,
                delivering: 90,
                completed: 100
              })[order.status] || 0
            }
          });
        }
      );
    });
  });
});

app.get('/api/orders/:id/route', (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ success: false, message: 'Mã đơn hàng không hợp lệ.' });
  }
  const role = req.authRole || normalizeRole(req.authUser.role);
  const userId = Number(req.authUser.id);
  const sql = `
        SELECT o.id, o.tracking_code, o.status,
          COALESCE(o.delivery_shipper_id, o.destination_transfer_shipper_id, o.central_transfer_shipper_id, o.pickup_shipper_id) AS shipper_id,
          o.shop_address, o.shop_province, o.receiver_address, o.receiver_lat, o.receiver_lng,
          ow.id AS origin_warehouse_id, ow.name AS origin_warehouse_name, ow.address AS origin_warehouse_address, ow.lat AS origin_warehouse_lat, ow.lng AS origin_warehouse_lng,
          dw.id AS destination_warehouse_id, dw.name AS destination_warehouse_name, dw.address AS destination_warehouse_address, dw.lat AS destination_warehouse_lat, dw.lng AS destination_warehouse_lng,
           10.762622 AS warehouse_lat,
           106.660172 AS warehouse_lng,
          COALESCE(o.shop_lat, dr.pickup_lat, 10.7605) AS pickup_lat,
          COALESCE(o.shop_lng, dr.pickup_lng, 106.6545) AS pickup_lng,
          COALESCE(o.receiver_lat, dr.delivery_lat, 10.7745) AS delivery_lat,
          COALESCE(o.receiver_lng, dr.delivery_lng, 106.6665) AS delivery_lng,
           dr.route_status
    FROM orders o
    LEFT JOIN driver_routes dr ON dr.order_id = o.id
    LEFT JOIN warehouses ow ON ow.id = o.origin_warehouse_id
    LEFT JOIN warehouses dw ON dw.id = o.destination_warehouse_id
    WHERE o.id = ?
      AND (
        ? IN ('director','fleet_manager','warehouse_manager')
        OR (? = 'shop' AND o.shop_id = ?)
        OR (? IN ('pickup_driver','delivery_driver') AND (
          o.pickup_shipper_id = ? OR o.central_transfer_shipper_id = ?
          OR o.destination_transfer_shipper_id = ? OR o.delivery_shipper_id = ?
        ))
      )
    LIMIT 1
  `;

  db.query(sql, [orderId, role, role, userId, role, userId, userId, userId, userId], (err, results) => {
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
      origin_warehouse: order.origin_warehouse_id ? {
        id: order.origin_warehouse_id,
        name: order.origin_warehouse_name,
        address: order.origin_warehouse_address,
        lat: Number(order.origin_warehouse_lat),
        lng: Number(order.origin_warehouse_lng)
      } : null,
      destination_warehouse: order.destination_warehouse_id ? {
        id: order.destination_warehouse_id,
        name: order.destination_warehouse_name,
        address: order.destination_warehouse_address,
        lat: Number(order.destination_warehouse_lat),
        lng: Number(order.destination_warehouse_lng)
      } : null,
      route_status: order.route_status || 'assigned',
      route_points: [
        { lat: Number(order.warehouse_lat), lng: Number(order.warehouse_lng), label: 'Kho trung tâm Smart Logistics' },
        { lat: Number(order.pickup_lat), lng: Number(order.pickup_lng), label: 'Điểm lấy hàng' },
        { lat: Number(order.delivery_lat), lng: Number(order.delivery_lng), label: 'Điểm giao hàng' }
      ]
    };

    const centralWarehouse = route.warehouse;
    route.task_route = order.status === 'picking'
      ? { origin: centralWarehouse, destination: route.pickup, label: 'Đi đến Shop lấy hàng' }
      : order.status === 'picked_up'
      ? { origin: route.pickup, destination: route.origin_warehouse, label: 'Shop đến kho con nguồn' }
      : order.status === 'transferring_to_central'
      ? { origin: route.origin_warehouse, destination: centralWarehouse, label: 'Kho con nguồn đến kho tổng' }
      : order.status === 'transferring_to_destination'
      ? { origin: centralWarehouse, destination: route.destination_warehouse, label: 'Kho tổng đến kho con đích' }
      : ['at_destination_warehouse', 'delivering'].includes(order.status)
      ? { origin: route.destination_warehouse, destination: route.delivery, label: 'Kho con đích đến người nhận' }
      : null;

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
app.get('/api/dispatcher/driver-profiles', (req, res) => {
  const sql = `
    SELECT u.id, u.full_name, u.role,
      COALESCE(p.max_active_orders, 10) AS max_active_orders,
      COALESCE(p.max_payload_kg, 100) AS max_payload_kg,
      COALESCE(p.service_areas, '') AS service_areas,
      COALESCE(loads.active_count, 0) AS active_count,
      COALESCE(loads.active_weight_kg, 0) AS active_weight_kg
    FROM users u
    LEFT JOIN driver_dispatch_profiles p ON p.driver_id = u.id
    LEFT JOIN (
      SELECT assigned.driver_id, COUNT(*) AS active_count, SUM(assigned.weight_kg) AS active_weight_kg
      FROM (
        SELECT pickup_shipper_id AS driver_id, weight_kg FROM orders
          WHERE pickup_shipper_id IS NOT NULL AND status IN ('picking','picked_up')
        UNION ALL
        SELECT central_transfer_shipper_id AS driver_id, weight_kg FROM orders
          WHERE central_transfer_shipper_id IS NOT NULL AND status = 'transferring_to_central'
        UNION ALL
        SELECT destination_transfer_shipper_id AS driver_id, weight_kg FROM orders
          WHERE destination_transfer_shipper_id IS NOT NULL AND status = 'transferring_to_destination'
        UNION ALL
        SELECT delivery_shipper_id AS driver_id, weight_kg FROM orders
          WHERE delivery_shipper_id IS NOT NULL AND status IN ('at_destination_warehouse','delivering')
      ) assigned
      GROUP BY assigned.driver_id
    ) loads ON loads.driver_id = u.id
    WHERE u.role IN ('pickup_driver','delivery_driver') AND u.status = 'active'
    ORDER BY u.role, u.full_name
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Không tải được hồ sơ điều phối tài xế: ' + err.sqlMessage });
    res.json({ success: true, data: rows });
  });
});

app.put('/api/dispatcher/driver-profiles/:driverId', (req, res) => {
  const driverId = Number(req.params.driverId);
  const maxActiveOrders = Number(req.body.max_active_orders);
  const maxPayloadKg = Number(req.body.max_payload_kg);
  const serviceAreas = String(req.body.service_areas || '').trim();
  if (!Number.isInteger(driverId) || driverId <= 0
    || !Number.isInteger(maxActiveOrders) || maxActiveOrders < 1 || maxActiveOrders > 100
    || !Number.isFinite(maxPayloadKg) || maxPayloadKg <= 0 || maxPayloadKg > 100000
    || serviceAreas.length > 500) {
    return res.status(400).json({ success: false, message: 'Giới hạn đơn, tải trọng hoặc khu vực tài xế không hợp lệ.' });
  }
  db.query(
    `INSERT INTO driver_dispatch_profiles (driver_id, max_active_orders, max_payload_kg, service_areas)
     SELECT id, ?, ?, ? FROM users WHERE id = ? AND role IN ('pickup_driver','delivery_driver') AND status = 'active'
     ON DUPLICATE KEY UPDATE max_active_orders = VALUES(max_active_orders),
       max_payload_kg = VALUES(max_payload_kg), service_areas = VALUES(service_areas)`,
    [maxActiveOrders, maxPayloadKg, serviceAreas, driverId],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Không thể lưu hồ sơ điều phối: ' + err.sqlMessage });
      if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Không tìm thấy tài xế đang hoạt động.' });
      res.json({ success: true, message: 'Đã lưu giới hạn tải và khu vực phụ trách.' });
    }
  );
});

app.get('/api/shippers', (req, res) => {
  const taskType = req.query.type;
  if (!['pickup', 'central_transfer', 'destination_transfer', 'delivery'].includes(taskType)) {
    return res.status(400).json({ success: false, message: 'Loại nhiệm vụ điều phối không hợp lệ.' });
  }
  const role = taskType === 'delivery' ? 'delivery_driver' : 'pickup_driver';
  const sql = 'SELECT id, full_name, email, role FROM users WHERE role = ? AND status = "active"';
  db.query(sql, [role], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true, data: redactDeliveryOtp(results) });
  });
});

function reserveDriverWallet(driverId, orderId, amount, callback) {
  const reserveAmount = Number(Number(amount).toFixed(2));
  if (!Number.isFinite(reserveAmount) || reserveAmount <= 0) return callback(null);
  db.query(
    `INSERT INTO driver_wallet_reservations (order_id, driver_id, amount)
     VALUES (?, ?, ?)`,
    [orderId, driverId, reserveAmount],
    (reservationErr) => {
      if (reservationErr) {
        if (reservationErr.code === 'ER_DUP_ENTRY') {
          return callback({ code: 'WALLET_BUSY', message: 'Đơn hàng hoặc ký quỹ của tài xế đã được xử lý. Tải lại và kiểm tra trước khi phân công lại.' });
        }
        return callback(reservationErr);
      }
      db.query(
        `UPDATE driver_wallets
         SET reserved_balance = reserved_balance + ?
         WHERE driver_id = ? AND balance - reserved_balance >= ?`,
        [reserveAmount, driverId, reserveAmount],
        (walletErr, result) => {
          if (walletErr || !result.affectedRows) {
            db.query('DELETE FROM driver_wallet_reservations WHERE order_id = ? AND status = "reserved"', [orderId], (deleteErr) => {
              if (deleteErr) console.error('Không thể xóa yêu cầu ký quỹ bị từ chối:', deleteErr);
              if (walletErr) return callback(walletErr);
              db.query(
                'SELECT balance, reserved_balance FROM driver_wallets WHERE driver_id = ?',
                [driverId],
                (balanceErr, rows) => {
                  if (balanceErr) return callback(balanceErr);
                  const available = rows.length ? Number(rows[0].balance) - Number(rows[0].reserved_balance) : 0;
                  callback({
                    code: 'INSUFFICIENT_WALLET',
                    message: `Tài xế không đủ ký quỹ khả dụng. Cần ${reserveAmount.toLocaleString('vi-VN')} đ, hiện có ${Math.max(0, available).toLocaleString('vi-VN')} đ.`
                  });
                }
              );
            });
            return;
          }
          db.query(
            `INSERT INTO driver_wallet_transactions (driver_id, order_id, transaction_type, amount, note)
             VALUES (?, ?, 'reserve', ?, 'Giữ ký quỹ khi phân công đơn COD')`,
            [driverId, orderId, reserveAmount],
            (ledgerErr) => {
              if (!ledgerErr) return callback(null);
              db.query('UPDATE driver_wallets SET reserved_balance = GREATEST(0, reserved_balance - ?) WHERE driver_id = ?', [reserveAmount, driverId], (rollbackErr) => {
                if (rollbackErr) console.error('Không thể hoàn tác số dư ký quỹ sau lỗi ghi sổ:', rollbackErr);
                db.query('DELETE FROM driver_wallet_reservations WHERE order_id = ? AND status = "reserved"', [orderId], (deleteErr) => {
                  if (deleteErr) console.error('Không thể xóa reservation sau lỗi ghi sổ:', deleteErr);
                  callback(ledgerErr);
                });
              });
            }
          );
        }
      );
    }
  );
}

function releaseDriverWalletReservation(orderId, note, callback = () => {}) {
  db.query(
    'SELECT driver_id, amount FROM driver_wallet_reservations WHERE order_id = ? AND status = "reserved" LIMIT 1',
    [orderId],
    (findErr, rows) => {
      if (findErr) return callback(findErr);
      if (!rows.length) return callback(null);
      const reservation = rows[0];
      db.query(
        'UPDATE driver_wallet_reservations SET status = "released", released_at = CURRENT_TIMESTAMP WHERE order_id = ? AND status = "reserved"',
        [orderId],
        (updateErr, result) => {
          if (updateErr) return callback(updateErr);
          if (!result.affectedRows) return callback(null);
          db.query(
            'UPDATE driver_wallets SET reserved_balance = GREATEST(0, reserved_balance - ?) WHERE driver_id = ?',
            [reservation.amount, reservation.driver_id],
            (walletErr) => {
              if (walletErr) {
                return db.query(
                  'UPDATE driver_wallet_reservations SET status = "reserved", released_at = NULL WHERE order_id = ? AND status = "released"',
                  [orderId],
                  (rollbackErr) => {
                    if (rollbackErr) console.error(`Không thể khôi phục giữ chỗ đơn ${orderId} sau lỗi cập nhật ví:`, rollbackErr);
                    callback(walletErr);
                  }
                );
              }
              db.query(
                `INSERT INTO driver_wallet_transactions (driver_id, order_id, transaction_type, amount, note)
                 VALUES (?, ?, 'release', ?, ?)`,
                [reservation.driver_id, orderId, reservation.amount, String(note || 'Giải phóng ký quỹ').slice(0, 255)],
                (ledgerErr) => {
                  if (!ledgerErr) return callback(null);
                  db.query(
                    'UPDATE driver_wallets SET reserved_balance = reserved_balance + ? WHERE driver_id = ?',
                    [reservation.amount, reservation.driver_id],
                    (rollbackErr) => {
                      if (rollbackErr) console.error(`Không thể hoàn tác số dư ví đơn ${orderId} sau lỗi ghi sổ:`, rollbackErr);
                      db.query(
                        'UPDATE driver_wallet_reservations SET status = "reserved", released_at = NULL WHERE order_id = ? AND status = "released"',
                        [orderId],
                        (restoreErr) => {
                          if (restoreErr) console.error(`Không thể khôi phục reservation đơn ${orderId}:`, restoreErr);
                          callback(ledgerErr);
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
}

app.put('/api/orders/:id/assign', (req, res) => {
  const { shipper_id, task_type } = req.body;
  const orderId = Number(req.params.id);
  const shipperId = Number(shipper_id);
  const tasks = {
    pickup: { role: 'pickup_driver', expected: 'pending', next: 'picking', column: 'pickup_shipper_id', label: 'lấy hàng tại Shop' },
    central_transfer: { role: 'pickup_driver', expected: 'at_origin_warehouse', next: 'transferring_to_central', column: 'central_transfer_shipper_id', label: 'điều chuyển về kho tổng' },
    destination_transfer: { role: 'pickup_driver', expected: 'at_central_warehouse', next: 'transferring_to_destination', column: 'destination_transfer_shipper_id', label: 'điều chuyển về kho con đích' },
    delivery: { role: 'delivery_driver', expected: 'at_destination_warehouse', next: 'at_destination_warehouse', column: 'delivery_shipper_id', label: 'giao hàng đến người nhận' }
  };
  const task = tasks[task_type];
  if (!Number.isInteger(orderId) || orderId <= 0
    || !Number.isInteger(shipperId) || shipperId <= 0 || !task) {
    return res.status(400).json({ success: false, message: 'Mã đơn, tài xế hoặc loại nhiệm vụ không hợp lệ.' });
  }

  db.query('SELECT * FROM orders WHERE id = ?', [orderId], (selectErr, orders) => {
    if (selectErr) return res.status(500).json({ success: false, message: 'Lỗi DB: ' + selectErr.sqlMessage });
    if (!orders.length) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    const order = orders[0];
    if (order.status !== task.expected) {
      return res.status(409).json({ success: false, message: `Nhiệm vụ này cần trạng thái "${task.expected}", đơn hiện ở "${order.status}".` });
    }

    db.query('SELECT id FROM users WHERE id = ? AND role = ? AND status = "active"', [shipperId, task.role], (driverErr, drivers) => {
      if (driverErr) return res.status(500).json({ success: false, message: 'Lỗi kiểm tra tài xế: ' + driverErr.sqlMessage });
      if (!drivers.length) return res.status(400).json({ success: false, message: 'Tài xế không thuộc đúng nhóm nhiệm vụ.' });

      const continueAssignment = (warehouseId = null) => {
        const updateAssignedOrder = () => {
            let sql = `UPDATE orders SET ${task.column} = ?, status = ?, storage_bin_id = NULL, cross_docked = 0`;
        const params = [shipperId, task.next];
        if (task_type === 'pickup') {
          sql += ', origin_warehouse_id = ?, current_warehouse_id = NULL';
          params.push(warehouseId);
        }
        if (task_type === 'destination_transfer') {
          sql += ', destination_warehouse_id = ?';
          params.push(warehouseId);
        }
        sql += ' WHERE id = ? AND status = ?';
        if (task_type === 'delivery') sql += ' AND delivery_shipper_id IS NULL';
        params.push(orderId, task.expected);

        db.query(sql, params, (updateErr, result) => {
          if (updateErr || !result.affectedRows) {
            const respond = () => {
              if (updateErr) return res.status(500).json({ success: false, message: updateErr.sqlMessage });
              return res.status(409).json({ success: false, message: 'Trạng thái đơn đã thay đổi hoặc đơn đã được phân công, vui lòng tải lại.' });
            };
            if (task_type === 'delivery' && Number(order.cod_amount || 0)
              + (order.fee_payer === 'receiver' ? Number(order.shipping_fee || 0) : 0) > 0) {
              return releaseDriverWalletReservation(orderId, 'Hoàn giữ ký quỹ do phân công thất bại', (releaseErr) => {
                if (releaseErr) console.error('Không thể hoàn tác ký quỹ sau khi phân công thất bại:', releaseErr);
                respond();
              });
            }
            return respond();
          }
          recordOrderStatus(orderId, task.expected, task.next, `Điều phối phân công tài xế ${task.label}`);
          const routeSql = `
            INSERT INTO driver_routes (order_id, shipper_id, warehouse_lat, warehouse_lng, pickup_lat, pickup_lng, delivery_lat, delivery_lng, route_status)
            SELECT ?, ?, 10.762622, 106.660172, COALESCE(shop_lat, 10.7605), COALESCE(shop_lng, 106.6545), COALESCE(receiver_lat, 10.7745), COALESCE(receiver_lng, 106.6665), ?
            FROM orders WHERE id = ?
            ON DUPLICATE KEY UPDATE shipper_id = VALUES(shipper_id), route_status = VALUES(route_status)
          `;
          db.query(routeSql, [orderId, shipperId, task_type, orderId], (routeErr) => {
            if (routeErr) console.error('Lỗi lưu route:', routeErr);
          });
          io.to(`user:${shipperId}`).emit(`new_order_assigned_${shipperId}`, { message: `Bạn vừa được phân công ${task.label}.` });
          notifyUser(shipperId, orderId, 'Có nhiệm vụ vận chuyển mới', `Đơn ${order.tracking_code}: ${task.label}.`);
          notifyUser(order.shop_id, orderId, 'Cập nhật luân chuyển vận đơn', `Đơn ${order.tracking_code} đang được ${task.label}.`);
          notifyCustomerByEmail(order.customer_email, orderId, 'Cập nhật vận đơn', `Đơn ${order.tracking_code} đang được luân chuyển đến chặng tiếp theo.`);
          io.emit('order_status_changed', { order_id: Number(orderId), status: task.next });
          res.json({ success: true, message: `Đã phân công tài xế ${task.label}.` });
        });
        };
        if (task_type !== 'delivery') return updateAssignedOrder();
        const reserveAmount = Number(order.cod_amount || 0)
          + (order.fee_payer === 'receiver' ? Number(order.shipping_fee || 0) : 0);
        if (reserveAmount <= 0) return updateAssignedOrder();
        reserveDriverWallet(shipperId, orderId, reserveAmount, (reserveErr) => {
          if (reserveErr) {
            const status = reserveErr.code === 'INSUFFICIENT_WALLET' ? 409 : reserveErr.code === 'WALLET_BUSY' ? 409 : 500;
            return res.status(status).json({ success: false, message: reserveErr.message || 'Không thể giữ ký quỹ tài xế.' });
          }
          updateAssignedOrder();
        });
      };

      if (task_type === 'pickup') {
        return findNearestWardWarehouse(Number(order.shop_lat), Number(order.shop_lng), (warehouseErr, warehouse) => {
          if (warehouseErr) return res.status(500).json({ success: false, message: warehouseErr.sqlMessage });
          if (!warehouse) return res.status(409).json({ success: false, message: 'Chưa có kho con nào được cấu hình và kích hoạt.' });
          continueAssignment(warehouse.id);
        });
      }
      if (task_type === 'destination_transfer') {
        if (order.receiver_lat === null || order.receiver_lng === null) {
          return res.status(409).json({ success: false, message: 'Đơn cần có tọa độ điểm nhận để xác định kho con đích.' });
        }
        return findNearestWardWarehouse(Number(order.receiver_lat), Number(order.receiver_lng), (warehouseErr, warehouse) => {
          if (warehouseErr) return res.status(500).json({ success: false, message: warehouseErr.sqlMessage });
          if (!warehouse) return res.status(409).json({ success: false, message: 'Chưa có kho con đích nào được cấu hình và kích hoạt.' });
          continueAssignment(warehouse.id);
        });
      }
      continueAssignment();
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
    res.json({ success: true, data: redactDeliveryOtp(results) });
  });
});

app.post('/api/driver/location', (req, res) => {
  const { shipper_id, order_id, lat, lng, route_status } = req.body;
  const shipperId = Number(shipper_id);
  const orderId = order_id === null || order_id === undefined || order_id === '' ? null : Number(order_id);
  const latitude = Number(lat);
  const longitude = Number(lng);
  const driverRole = req.authRole || normalizeRole(req.authUser.role);
  const allowedRouteStatuses = new Set(['moving', 'stopped', 'assigned', 'pickup', 'central_transfer', 'destination_transfer', 'delivery']);

  if (!Number.isInteger(shipperId) || shipperId !== Number(req.authUser.id)
    || (orderId !== null && (!Number.isInteger(orderId) || orderId <= 0))
    || !driverRoles.has(driverRole)
    || lat === null || lat === undefined || lat === ''
    || lng === null || lng === undefined || lng === ''
    || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
    || (route_status && !allowedRouteStatuses.has(route_status))) {
    return res.status(400).json({ success: false, message: 'Dữ liệu vị trí hoặc trạng thái lộ trình không hợp lệ.' });
  }

  const emitPosition = (verifiedTrackingCode = null) => {
    const position = {
      shipper_id: shipperId,
      order_id: orderId,
      tracking_code: verifiedTrackingCode,
      lat: latitude,
      lng: longitude,
      timestamp: new Date()
    };
    io.to('fleet_tracking').emit('driver_location_changed', position);
    if (orderId) io.to(`order_tracking:${orderId}`).emit('driver_location_changed', position);
    res.json({ success: true, message: 'Đã cập nhật vị trí tài xế.' });
  };

  if (orderId === null) {
    return db.query(
      'INSERT INTO driver_positions (order_id, shipper_id, lat, lng, route_status) VALUES (NULL, ?, ?, ?, ?)',
      [shipperId, latitude, longitude, route_status || 'moving'],
      (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Lỗi lưu vị trí tài xế: ' + err.sqlMessage });
        emitPosition();
      }
    );
  }

  const assignedOrderSql = `
    INSERT INTO driver_positions (order_id, shipper_id, lat, lng, route_status)
    SELECT o.id, ?, ?, ?, ?
    FROM orders o
    WHERE o.id = ? AND (
      (? = 'pickup_driver' AND (
        (o.pickup_shipper_id = ? AND o.status IN ('picking', 'picked_up'))
        OR (o.central_transfer_shipper_id = ? AND o.status = 'transferring_to_central')
        OR (o.destination_transfer_shipper_id = ? AND o.status = 'transferring_to_destination')
      ))
      OR (? = 'delivery_driver' AND o.delivery_shipper_id = ? AND o.status = 'delivering')
    )
    LIMIT 1
  `;
  const params = [
    shipperId, latitude, longitude, route_status || 'moving', orderId,
    driverRole, shipperId, shipperId, shipperId, driverRole, shipperId
  ];
  db.query(assignedOrderSql, params, (err, result) => {
    if (err) return res.status(500).json({ success: false, message: 'Lỗi lưu vị trí tài xế: ' + err.sqlMessage });
    if (!result.affectedRows) {
      return res.status(403).json({ success: false, message: 'Bạn không được cập nhật vị trí cho đơn hàng này.' });
    }
    emitPosition();
  });
});

app.get('/api/orders/shipper/:id', (req, res) => {
  const driverId = Number(req.params.id);
  if (!Number.isInteger(driverId) || driverId <= 0 || driverId !== Number(req.authUser.id)) {
    return res.status(403).json({ success: false, message: 'Tài xế chỉ được xem nhiệm vụ của tài khoản đang đăng nhập.' });
  }
  const sql = `
    SELECT o.*, u.role AS driver_role
    FROM orders o
    JOIN users u ON u.id = ? AND u.status = 'active'
    WHERE (u.role = 'pickup_driver' AND (
        (o.pickup_shipper_id = ? AND o.status IN ('picking','picked_up'))
        OR (o.central_transfer_shipper_id = ? AND o.status = 'transferring_to_central')
        OR (o.destination_transfer_shipper_id = ? AND o.status = 'transferring_to_destination')
      ))
       OR (u.role = 'delivery_driver' AND o.delivery_shipper_id = ? AND o.status IN ('at_destination_warehouse','delivering'))
       OR (u.role = 'delivery_driver' AND o.delivery_shipper_id = ? AND o.status = 'completed' AND DATE(o.updated_at) = CURDATE())
    ORDER BY o.created_at DESC
  `;
  db.query(sql, [driverId, driverId, driverId, driverId, driverId, driverId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true, data: redactDeliveryOtp(results) });
  });
});

app.put('/api/orders/:id/status', podUpload.fields([
  { name: 'proof_image', maxCount: 1 },
  { name: 'signature_image', maxCount: 1 }
]), (req, res) => {
  const { id } = req.params;
  const { status, fail_reason, cod_collected, cod_payment_method, delivery_otp, user_id } = req.body;
  const orderId = Number(id);
  const driverId = Number(user_id);
  const allowedTransitions = new Set(['picked_up', 'delivering', 'completed', 'returning']);
  const proofFile = req.files?.proof_image?.[0];
  const signatureFile = req.files?.signature_image?.[0];
  const imageUrl = proofFile ? `/uploads/${proofFile.filename}` : null;
  const signatureUrl = signatureFile ? `/uploads/${signatureFile.filename}` : null;

  if (!Number.isInteger(orderId) || orderId <= 0 || !Number.isInteger(driverId) || driverId <= 0
    || driverId !== Number(req.authUser.id) || !allowedTransitions.has(status)) {
    return res.status(400).json({ success: false, message: 'Mã đơn, tài xế hoặc trạng thái cập nhật không hợp lệ.' });
  }

  db.query(
    `SELECT o.status, o.cod_amount, o.shipping_fee, o.fee_payer, o.shop_id, o.customer_email,
      o.tracking_code, o.delivery_otp, o.pickup_shipper_id, o.delivery_shipper_id,
      o.destination_transfer_shipper_id, u.role AS driver_role
     FROM orders o
     LEFT JOIN users u ON u.id = ? AND u.status = 'active'
     WHERE o.id = ?`,
    [driverId, orderId],
    (selectErr, orders) => {
    if (selectErr) return res.status(500).json({ success: false, message: 'Lỗi cập nhật: ' + selectErr.sqlMessage });
    if (!orders.length) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });

    const order = orders[0];
    const amountToCollect = Number(order.cod_amount || 0)
      + (order.fee_payer === 'receiver' ? Number(order.shipping_fee || 0) : 0);
    if (status === 'picked_up' && order.status === 'picked_up'
      && order.driver_role === 'pickup_driver'
      && Number(order.pickup_shipper_id) === driverId) {
      return res.json({ success: true, already_applied: true, message: 'Vận đơn đã được xác nhận đã lấy trước đó.' });
    }
    const validTransition = status === 'picked_up'
      ? order.driver_role === 'pickup_driver' && order.status === 'picking' && Number(order.pickup_shipper_id) === driverId
      : status === 'delivering'
      ? order.driver_role === 'delivery_driver' && order.status === 'at_destination_warehouse' && Number(order.delivery_shipper_id) === driverId
      : order.driver_role === 'delivery_driver' && order.status === 'delivering' && ['completed', 'returning'].includes(status) && Number(order.delivery_shipper_id) === driverId;
    if (!validTransition) {
      return res.status(409).json({ success: false, message: `Không thể chuyển đơn từ "${order.status}" sang "${status}".` });
    }
    if (status === 'delivering' && !order.customer_email) {
      return res.status(400).json({ success: false, message: 'Đơn hàng cần có email khách nhận để gửi mã OTP giao hàng.' });
    }
    if (['completed', 'returning'].includes(status) && !imageUrl) {
      return res.status(400).json({ success: false, message: 'Cần ảnh minh chứng trước khi kết thúc lượt giao.' });
    }
    if (status === 'completed' && !signatureUrl) {
      return res.status(400).json({ success: false, message: 'Cần chữ ký điện tử của người nhận trước khi hoàn tất đơn.' });
    }
    if (status === 'returning' && !String(fail_reason || '').trim()) {
      return res.status(400).json({ success: false, message: 'Cần ghi rõ lý do giao thất bại.' });
    }
    const failureReasons = new Set([
      'Khách không nghe máy (Đã gọi 3 lần)',
      'Sai địa chỉ / Không tìm thấy nhà',
      'Khách đổi ý không nhận hàng',
      'Hàng hóa bị móp méo, khách từ chối'
    ]);
    if (status === 'returning' && !failureReasons.has(String(fail_reason || '').trim())) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn một lý do giao thất bại hợp lệ.' });
    }
    if (status === 'completed' && (!/^\d{4,6}$/.test(String(delivery_otp || '')) || String(delivery_otp) !== String(order.delivery_otp || ''))) {
      return res.status(400).json({ success: false, message: 'Mã OTP giao hàng không đúng hoặc đã hết hiệu lực.' });
    }
    if (status === 'completed' && amountToCollect > 0 && cod_collected !== 'true') {
      return res.status(400).json({ success: false, message: 'Cần xác nhận đã thu COD và phí vận chuyển trước khi hoàn tất đơn.' });
    }
    if (status === 'completed' && amountToCollect > 0 && !['cash', 'bank_transfer'].includes(cod_payment_method)) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn tiền mặt hoặc chuyển khoản cho tổng tiền cần thu.' });
    }

    let sql = 'UPDATE orders SET status = ?';
    const params = [status];
    const deliveryOtp = status === 'delivering' ? String(crypto.randomInt(1000, 10000)) : null;
    if (deliveryOtp) {
      sql += ', delivery_otp = ?';
      params.push(deliveryOtp);
    }
    if (imageUrl) {
      sql += ', proof_image = ?';
      params.push(imageUrl);
    }
    if (signatureUrl) {
      sql += ', signature_image = ?';
      params.push(signatureUrl);
    }
    if (status === 'returning') {
      sql += ', fail_reason = ?';
      params.push(String(fail_reason).trim());
    }
    if (status === 'completed') {
      sql += ', delivery_otp = NULL';
      sql += ', cod_collected = ?';
      params.push(amountToCollect > 0 ? 1 : 0);
      sql += ', cod_collected_amount = ?';
      params.push(amountToCollect);
      sql += ', cod_payment_method = ?';
      params.push(amountToCollect > 0 ? cod_payment_method : null);
    }
    sql += ' WHERE id = ? AND status = ?';
    params.push(orderId, order.status);

    db.query(sql, params, (err, result) => {
      if (err) {
        console.error("Lỗi cập nhật DB:", err);
        return res.status(500).json({ success: false, message: 'Lỗi cập nhật: ' + err.sqlMessage });
      }
      if (!result.affectedRows) return res.status(409).json({ success: false, message: 'Trạng thái đơn đã thay đổi, vui lòng tải lại.' });

      const completeStatusUpdate = () => recordOrderStatus(orderId, order.status, status, fail_reason, imageUrl, () => {
        notifyUser(order.shop_id, orderId, 'Cập nhật trạng thái vận đơn', `Đơn ${order.tracking_code} đã chuyển sang trạng thái ${status === 'picked_up' ? 'đã lấy hàng, chờ nhập kho' : status === 'delivering' ? 'đang giao' : status === 'completed' ? 'giao thành công' : 'giao thất bại, đang hoàn hàng'}.`);
        const customerMessage = status === 'picked_up' ? 'Tài xế đã lấy hàng và đang đưa về kho.' : status === 'delivering' ? 'Đơn hàng đang trên đường giao đến bạn.' : status === 'completed' ? 'Đơn hàng đã được giao thành công.' : 'Giao hàng chưa thành công; đơn đang được chuyển hoàn.';
        notifyCustomerByEmail(order.customer_email, orderId, 'Cập nhật vận đơn', `Đơn ${order.tracking_code}: ${customerMessage}`);
        const customerEmail = order.customer_email;
        if (customerEmail) {
      const mailOptions = {
        from: mailFrom,
        to: customerEmail,
        subject: `[Cập nhật vận đơn] ${order.tracking_code}`,
        html: `
          <div style="font-family: sans-serif; max-w: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
            <h2 style="color: #059669; text-align: center;">CẬP NHẬT VẬN ĐƠN</h2>
            <p style="color: #374151; font-size: 16px;">Mã vận đơn: <b>${order.tracking_code}</b></p>
            <p style="color: #4B5563;">${customerMessage}</p>
            ${status === 'completed' ? '<p style="color: #4B5563;">Bạn có thể tra cứu hình ảnh minh chứng trên Cổng tra cứu của hệ thống.</p>' : ''}
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
        io.emit('order_status_changed', { order_id: orderId, status });
      }, signatureUrl);
      if (!deliveryOtp) {
        const shouldReleaseReservation = status === 'returning'
          || status === 'completed' && cod_payment_method === 'bank_transfer';
        if (!shouldReleaseReservation) return completeStatusUpdate();
        return releaseDriverWalletReservation(
          orderId,
          status === 'returning' ? 'Đơn giao thất bại, giải phóng ký quỹ' : 'COD chuyển khoản, giải phóng ký quỹ',
          (releaseErr) => {
            if (releaseErr) console.error(`Không thể giải phóng ký quỹ đơn ${orderId}:`, releaseErr);
            completeStatusUpdate();
          }
        );
      }

      transporter.sendMail({
        from: mailFrom,
        to: order.customer_email,
        subject: `[Mã OTP nhận hàng] ${order.tracking_code}`,
        text: `Mã OTP nhận hàng cho đơn ${order.tracking_code} của bạn là ${deliveryOtp}. Chỉ cung cấp mã này khi tài xế giao hàng trực tiếp.`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
            <h2 style="color: #059669; text-align: center;">MÃ XÁC NHẬN NHẬN HÀNG</h2>
            <p>Mã vận đơn: <b>${order.tracking_code}</b></p>
            <p>Mã OTP của bạn:</p>
            <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center;">${deliveryOtp}</p>
            <p>Chỉ cung cấp mã này cho tài xế khi đã nhận được hàng.</p>
          </div>
        `
      }, (mailErr) => {
        if (!mailErr) return completeStatusUpdate();
        console.error('Lỗi gửi OTP giao hàng:', mailErr);
        db.query(
          'UPDATE orders SET status = ?, delivery_otp = NULL WHERE id = ? AND status = ? AND delivery_otp = ?',
          [order.status, orderId, 'delivering', deliveryOtp],
          (rollbackErr, rollbackResult) => {
            if (rollbackErr) console.error('Lỗi hoàn tác trạng thái sau khi gửi OTP thất bại:', rollbackErr);
            const rollbackSucceeded = !rollbackErr && rollbackResult.affectedRows > 0;
            return res.status(502).json({
              success: false,
              message: !rollbackSucceeded
                ? 'Không gửi được OTP và không thể hoàn tác trạng thái đơn. Cần kiểm tra đơn hàng.'
                : 'Không gửi được email OTP; trạng thái đơn đã được hoàn tác.'
            });
          }
        );
      });
    });
  });
});

// =========================================
// 4. API KHO BÃI
// =========================================
app.get('/api/warehouse/bin-locations', (req, res) => {
  const warehouseId = Number(req.query.warehouse_id);
  if (!Number.isInteger(warehouseId) || warehouseId <= 0) {
    return res.status(400).json({ success: false, message: 'Mã kho không hợp lệ.' });
  }
  db.query(
    'SELECT id, warehouse_id, bin_code, bin_name FROM warehouse_bin_locations WHERE warehouse_id = ? AND is_active = 1 ORDER BY bin_code',
    [warehouseId],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: 'Không tải được danh sách vị trí kệ: ' + err.sqlMessage });
      res.json({ success: true, data: rows });
    }
  );
});

app.get('/api/warehouse/bin-locations/lookup', (req, res) => {
  const warehouseId = Number(req.query.warehouse_id);
  const binCode = String(req.query.bin_code || '').trim().toUpperCase();
  if (!Number.isInteger(warehouseId) || warehouseId <= 0 || !/^[A-Z0-9][A-Z0-9._-]{0,79}$/.test(binCode)) {
    return res.status(400).json({ success: false, message: 'Mã kho hoặc mã vị trí kệ không hợp lệ.' });
  }
  db.query(
    'SELECT id, warehouse_id, bin_code, bin_name FROM warehouse_bin_locations WHERE warehouse_id = ? AND bin_code = ? AND is_active = 1 LIMIT 1',
    [warehouseId, binCode],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: 'Không thể xác thực mã vị trí kệ: ' + err.sqlMessage });
      res.json({ success: true, matched: rows.length > 0, data: rows[0] || null });
    }
  );
});

app.post('/api/warehouse/bin-locations', (req, res) => {
  const warehouseId = Number(req.body.warehouse_id);
  const binCode = String(req.body.bin_code || '').trim().toUpperCase();
  const binName = String(req.body.bin_name || '').trim();
  if (!Number.isInteger(warehouseId) || warehouseId <= 0
    || !/^[A-Z0-9][A-Z0-9._-]{0,79}$/.test(binCode)
    || !binName || binName.length > 120) {
    return res.status(400).json({ success: false, message: 'Mã kho, mã kệ hoặc tên vị trí không hợp lệ.' });
  }
  db.query(
    'INSERT INTO warehouse_bin_locations (warehouse_id, bin_code, bin_name) SELECT id, ?, ? FROM warehouses WHERE id = ? AND is_active = 1',
    [binCode, binName, warehouseId],
    (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Mã kệ này đã tồn tại trong kho.' });
        return res.status(500).json({ success: false, message: 'Không thể tạo vị trí kệ: ' + err.sqlMessage });
      }
      if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Không tìm thấy kho đang hoạt động.' });
      res.status(201).json({ success: true, data: { id: result.insertId, warehouse_id: warehouseId, bin_code: binCode, bin_name: binName } });
    }
  );
});

app.post('/api/warehouse/inventory-audits', (req, res) => {
  const warehouseId = Number(req.body.warehouse_id);
  if (!Number.isInteger(warehouseId) || warehouseId <= 0) {
    return res.status(400).json({ success: false, message: 'Mã kho không hợp lệ.' });
  }
  db.query(
    'INSERT INTO warehouse_inventory_audits (warehouse_id, created_by) SELECT id, ? FROM warehouses WHERE id = ? AND is_active = 1',
    [Number(req.authUser.id), warehouseId],
    (createErr, result) => {
      if (createErr) return res.status(500).json({ success: false, message: 'Không thể mở phiếu kiểm kê: ' + createErr.sqlMessage });
      if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Không tìm thấy kho đang hoạt động.' });
      const auditId = result.insertId;
      db.query(
        `INSERT INTO warehouse_inventory_audit_items (audit_id, order_id, tracking_code)
         SELECT ?, id, tracking_code FROM orders
         WHERE current_warehouse_id = ?
           AND status IN ('at_origin_warehouse', 'at_central_warehouse', 'at_destination_warehouse')`,
        [auditId, warehouseId],
        (snapshotErr, snapshot) => {
          if (snapshotErr) {
            return db.query('DELETE FROM warehouse_inventory_audits WHERE id = ?', [auditId], (cleanupErr) => {
              if (cleanupErr) console.error('Không thể xóa phiếu kiểm kê lỗi:', cleanupErr);
              res.status(500).json({ success: false, message: 'Không thể chụp danh sách tồn kho đầu kỳ: ' + snapshotErr.sqlMessage });
            });
          }
          db.query('UPDATE warehouse_inventory_audits SET expected_count = ? WHERE id = ?', [snapshot.affectedRows, auditId], (updateErr) => {
            if (updateErr) return res.status(500).json({ success: false, message: 'Không thể lưu số lượng tồn đầu kỳ: ' + updateErr.sqlMessage });
            res.status(201).json({ success: true, data: { id: auditId, status: 'open' }, message: 'Đã mở kiểm kê mù. Danh sách tồn kỳ vọng được ẩn trong lúc quét.' });
          });
        }
      );
    }
  );
});

app.post('/api/warehouse/inventory-audits/:id/scan', (req, res) => {
  const auditId = Number(req.params.id);
  const scanCode = String(req.body.tracking_code || '').trim().toUpperCase();
  if (!Number.isSafeInteger(auditId) || auditId <= 0 || !/^[A-Z0-9][A-Z0-9._-]{0,99}$/.test(scanCode)) {
    return res.status(400).json({ success: false, message: 'Mã phiếu hoặc mã kiện quét không hợp lệ.' });
  }
  db.query('SELECT id FROM warehouse_inventory_audits WHERE id = ? AND status = "open" LIMIT 1', [auditId], (auditErr, audits) => {
    if (auditErr) return res.status(500).json({ success: false, message: 'Không thể kiểm tra phiếu kiểm kê: ' + auditErr.sqlMessage });
    if (!audits.length) return res.status(409).json({ success: false, message: 'Phiếu kiểm kê không tồn tại hoặc đã được chốt.' });
    db.query('SELECT order_id FROM warehouse_inventory_audit_items WHERE audit_id = ? AND tracking_code = ? LIMIT 1', [auditId, scanCode], (itemErr, items) => {
      if (itemErr) return res.status(500).json({ success: false, message: 'Không thể đối chiếu mã quét: ' + itemErr.sqlMessage });
      const expectedOrderId = items.length ? Number(items[0].order_id) : null;
      db.query(
        `INSERT INTO warehouse_inventory_audit_scans (audit_id, scan_code, order_id)
         SELECT ?, ?, ? FROM warehouse_inventory_audits WHERE id = ? AND status = 'open'`,
        [auditId, scanCode, expectedOrderId, auditId],
        (scanErr, scanResult) => {
          if (scanErr?.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Mã này đã được quét trong phiếu kiểm kê.' });
          if (scanErr) return res.status(500).json({ success: false, message: 'Không thể lưu mã kiểm kê: ' + scanErr.sqlMessage });
          if (!scanResult.affectedRows) return res.status(409).json({ success: false, message: 'Phiếu kiểm kê đã được chốt.' });
          db.query('UPDATE warehouse_inventory_audits SET scanned_count = scanned_count + 1 WHERE id = ? AND status = "open"', [auditId], (countErr) => {
            if (countErr) return res.status(500).json({ success: false, message: 'Đã lưu mã nhưng không cập nhật được bộ đếm phiếu: ' + countErr.sqlMessage });
            res.json({ success: true, message: 'Đã ghi nhận mã quét. Tiếp tục quét kiện hàng trong kho.' });
          });
        }
      );
    });
  });
});

app.put('/api/warehouse/inventory-audits/:id/complete', (req, res) => {
  const auditId = Number(req.params.id);
  if (!Number.isSafeInteger(auditId) || auditId <= 0) {
    return res.status(400).json({ success: false, message: 'Mã phiếu kiểm kê không hợp lệ.' });
  }
  const sendReport = () => db.query(
    'SELECT a.id, a.warehouse_id, a.expected_count, (SELECT COUNT(*) FROM warehouse_inventory_audit_scans s WHERE s.audit_id = a.id) AS scanned_count, a.created_at, a.completed_at FROM warehouse_inventory_audits a WHERE a.id = ? AND a.status = "completed"',
    [auditId],
    (auditErr, audits) => {
      if (auditErr) return res.status(500).json({ success: false, message: 'Đã chốt phiếu nhưng không tải được báo cáo: ' + auditErr.sqlMessage });
      if (!audits.length) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu kiểm kê đã chốt.' });
      db.query(
        `SELECT i.order_id, i.tracking_code
         FROM warehouse_inventory_audit_items i
         LEFT JOIN warehouse_inventory_audit_scans s ON s.audit_id = i.audit_id AND s.order_id = i.order_id
         WHERE i.audit_id = ? AND s.order_id IS NULL ORDER BY i.tracking_code`,
        [auditId],
        (missingErr, missing) => {
          if (missingErr) return res.status(500).json({ success: false, message: 'Không tải được danh sách kiện thiếu: ' + missingErr.sqlMessage });
          db.query(
            'SELECT scan_code FROM warehouse_inventory_audit_scans WHERE audit_id = ? AND order_id IS NULL ORDER BY scan_code',
            [auditId],
            (extraErr, extra) => {
              if (extraErr) return res.status(500).json({ success: false, message: 'Không tải được danh sách mã dư: ' + extraErr.sqlMessage });
              res.json({ success: true, data: { ...audits[0], missing, extra, missing_count: missing.length, extra_count: extra.length } });
            }
          );
        }
      );
    }
  );
  db.query(
    'UPDATE warehouse_inventory_audits SET status = "completed", completed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = "open"',
    [auditId],
    (completeErr, result) => {
      if (completeErr) return res.status(500).json({ success: false, message: 'Không thể chốt phiếu kiểm kê: ' + completeErr.sqlMessage });
      if (!result.affectedRows) {
        return db.query('SELECT status FROM warehouse_inventory_audits WHERE id = ?', [auditId], (auditErr, audits) => {
          if (auditErr) return res.status(500).json({ success: false, message: 'Không kiểm tra được trạng thái phiếu: ' + auditErr.sqlMessage });
          if (!audits.length) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu kiểm kê.' });
          if (audits[0].status !== 'completed') return res.status(409).json({ success: false, message: 'Phiếu kiểm kê chưa thể chốt.' });
          sendReport();
        });
      }
      sendReport();
    }
  );
});

app.post('/api/warehouse/scan', (req, res) => {
  const { tracking_code, warehouse_id } = req.body;
  const binCode = String(req.body.bin_code || '').trim().toUpperCase();
  const crossDockRequested = req.body.cross_dock === true || req.body.cross_dock === 'true';
  if (!String(tracking_code || '').trim() || (!crossDockRequested && !/^[A-Z0-9][A-Z0-9._-]{0,79}$/.test(binCode))) {
    return res.status(400).json({ success: false, message: 'Quét mã vận đơn và mã vị trí kệ hợp lệ trước khi nhập kho.' });
  }
  db.query('SELECT * FROM orders WHERE tracking_code = ?', [tracking_code], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    if (results.length === 0) return res.status(404).json({ success: false, message: '❌ Không tìm thấy Mã vận đơn này!' });

    const order = results[0];
    let newStatus = '';
    let message = '';
    let expectedWarehouseId = null;
    let currentWarehouseId = Number(warehouse_id);
    if (!Number.isInteger(currentWarehouseId) || currentWarehouseId <= 0) {
      return res.status(400).json({ success: false, message: 'Mã kho quét không hợp lệ.' });
    }

    if (order.status === 'picked_up') {
      expectedWarehouseId = Number(order.origin_warehouse_id);
      newStatus = 'at_origin_warehouse';
      message = 'Đã nhận hàng tại kho con nguồn. Chờ Điều phối chuyển về kho tổng.';
    } else if (order.status === 'transferring_to_central') {
      db.query("SELECT id FROM warehouses WHERE warehouse_type = 'central' LIMIT 1", (centralErr, centralRows) => {
        if (centralErr) return res.status(500).json({ success: false, message: centralErr.sqlMessage });
        if (!centralRows.length) return res.status(503).json({ success: false, message: 'Chưa cấu hình kho tổng.' });
        const centralWarehouseId = Number(centralRows[0].id);
        if (Number(order.current_warehouse_id) !== Number(order.origin_warehouse_id)) {
          return res.status(409).json({ success: false, message: 'Đơn chưa được ghi nhận tại kho phường nguồn trước khi trung chuyển.' });
        }
        if (currentWarehouseId !== centralWarehouseId) return res.status(409).json({ success: false, message: 'Đơn trung chuyển này cần được quét tại kho tổng.' });
        finalizeScan(centralWarehouseId, 'at_central_warehouse', 'Đã nhập kho tổng, chờ phân luồng về kho con đích.');
      });
      return;
    } else if (order.status === 'transferring_to_destination') {
      db.query("SELECT id FROM warehouses WHERE warehouse_type = 'central' LIMIT 1", (centralErr, centralRows) => {
        if (centralErr) return res.status(500).json({ success: false, message: centralErr.sqlMessage });
        if (!centralRows.length) return res.status(503).json({ success: false, message: 'Chưa cấu hình kho tổng.' });
        if (Number(order.current_warehouse_id) !== Number(centralRows[0].id)) {
          return res.status(409).json({ success: false, message: 'Đơn chưa được ghi nhận tại kho tổng trước khi chuyển tới kho đích.' });
        }
        continueDestinationScan();
      });
      return;
    } else if (order.status === 'returning') {
      if (Number(order.current_warehouse_id) !== currentWarehouseId) {
        return res.status(409).json({ success: false, message: 'Đơn hoàn phải được quét tại kho đang giữ đơn.' });
      }
      newStatus = 'cancelled';
      message = 'Đã nhận hàng hoàn tại kho. Đơn hàng kết thúc.';
    } else {
      const statusMessage = order.status === 'picking'
        ? 'Tài xế chưa xác nhận đã lấy hàng, chưa thể nhập kho.'
        : order.status === 'delivering'
        ? 'Đơn hàng đang giao đến người nhận, không thể nhập kho như hàng trung chuyển.'
        : ['at_origin_warehouse', 'at_central_warehouse', 'at_destination_warehouse'].includes(order.status)
        ? 'Đơn đã được quét tại kho hiện tại.'
        : order.status === 'completed'
        ? 'Đơn hàng đã giao thành công, không thể quét lại tại kho.'
        : `Đơn hàng đang ở trạng thái "${order.status}" nên chưa thể xử lý tại kho.`;
      return res.status(409).json({ success: false, message: statusMessage });
    }

    if (order.status === 'picked_up' && order.current_warehouse_id !== null) {
      return res.status(409).json({ success: false, message: 'Đơn đã có kho hiện tại; cần được điều phối lại trước khi quét.' });
    }

    if (expectedWarehouseId && currentWarehouseId !== expectedWarehouseId) {
      return res.status(409).json({ success: false, message: 'Mã kho quét không khớp với kho được phân tuyến cho đơn này.' });
    }
    finalizeScan(currentWarehouseId, newStatus, message);

    function continueDestinationScan() {
      expectedWarehouseId = Number(order.destination_warehouse_id);
      newStatus = 'at_destination_warehouse';
      message = 'Đã nhận hàng tại kho con đích. Chờ Điều phối phân công tài xế giao.';
      if (currentWarehouseId !== expectedWarehouseId) {
        return res.status(409).json({ success: false, message: 'Mã kho quét không khớp với kho con đích được phân tuyến cho đơn này.' });
      }
      finalizeScan(currentWarehouseId, newStatus, message);
    }

    function finalizeScan(targetWarehouseId, targetStatus, targetMessage) {
      const crossDock = crossDockRequested;
      const saveInboundOrder = (binId) => {
          db.query('UPDATE orders SET status = ?, current_warehouse_id = ?, storage_bin_id = ?, cross_docked = ? WHERE id = ? AND status = ?', [targetStatus, targetWarehouseId, binId, crossDock ? 1 : 0, order.id, order.status], (updateErr, result) => {
            if (updateErr) return res.status(500).json({ success: false, message: updateErr.sqlMessage });
            if (!result.affectedRows) return res.status(409).json({ success: false, message: 'Trạng thái đơn đã thay đổi, vui lòng quét lại.' });
            const storageNote = crossDock ? 'Chuyển tải nhanh, không lưu kệ' : `Nhập kho tại vị trí ${binCode}`;
            recordOrderStatus(order.id, order.status, targetStatus, storageNote, null, () => {
              const storageMessage = crossDock ? ' Đơn được chuyển thẳng đến khu xuất, không lưu kệ.' : ` Vị trí lưu kho: ${binCode}.`;
              notifyUser(order.shop_id, order.id, 'Cập nhật luân chuyển vận đơn', `${targetMessage}${storageMessage}`);
              io.emit('order_status_changed', { order_id: Number(order.id), status: targetStatus });
              const safeOrder = redactDeliveryOtp([order])[0];
              res.json({ success: true, message: `${targetMessage}${storageMessage}`, order: { ...safeOrder, status: targetStatus, current_warehouse_id: targetWarehouseId, storage_bin_id: binId, cross_docked: crossDock ? 1 : 0 } });
            });
          });
      };
      if (crossDock) return saveInboundOrder(null);
      if (!binCode) return res.status(400).json({ success: false, message: 'Quét mã vị trí kệ trước khi nhập kiện hàng vào kho.' });
      db.query(
        'SELECT id FROM warehouse_bin_locations WHERE warehouse_id = ? AND bin_code = ? AND is_active = 1 LIMIT 1',
        [targetWarehouseId, binCode],
        (binErr, binRows) => {
          if (binErr) return res.status(500).json({ success: false, message: 'Không thể kiểm tra vị trí kệ: ' + binErr.sqlMessage });
          if (!binRows.length) return res.status(409).json({ success: false, message: `Mã kệ ${binCode} chưa được khai báo hoặc không thuộc kho đang nhập.` });
          saveInboundOrder(Number(binRows[0].id));
        }
      );
    }
  });
});

app.get('/api/warehouse/bags', (req, res) => {
  const warehouseId = req.query.warehouse_id ? Number(req.query.warehouse_id) : null;
  if (req.query.warehouse_id && (!Number.isInteger(warehouseId) || warehouseId <= 0)) {
    return res.status(400).json({ success: false, message: 'Mã kho không hợp lệ.' });
  }
  const sql = `
    SELECT b.*, source.name AS source_warehouse_name, destination.name AS destination_warehouse_name,
      COUNT(bo.order_id) AS order_count
    FROM shipment_bags b
    JOIN warehouses source ON source.id = b.source_warehouse_id
    JOIN warehouses destination ON destination.id = b.destination_warehouse_id
    LEFT JOIN shipment_bag_orders bo ON bo.bag_id = b.id
    WHERE (? IS NULL OR b.source_warehouse_id = ? OR b.destination_warehouse_id = ?)
    GROUP BY b.id
    ORDER BY b.created_at DESC
  `;
  db.query(sql, [warehouseId, warehouseId, warehouseId], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true, data: rows });
  });
});

app.post('/api/warehouse/bags', (req, res) => {
  const sourceId = Number(req.body.source_warehouse_id);
  const destinationId = Number(req.body.destination_warehouse_id);
  if (!Number.isInteger(sourceId) || !Number.isInteger(destinationId) || sourceId <= 0
    || destinationId <= 0 || sourceId === destinationId) {
    return res.status(400).json({ success: false, message: 'Kho đi và kho đến không hợp lệ.' });
  }
  db.query('SELECT id, warehouse_type FROM warehouses WHERE id IN (?, ?) AND is_active = 1', [sourceId, destinationId], (findErr, rows) => {
    if (findErr) return res.status(500).json({ success: false, message: findErr.sqlMessage });
    if (rows.length !== 2) return res.status(400).json({ success: false, message: 'Hai kho phải đang hoạt động.' });
    const sourceWarehouse = rows.find((warehouse) => Number(warehouse.id) === sourceId);
    const destinationWarehouse = rows.find((warehouse) => Number(warehouse.id) === destinationId);
    if (!sourceWarehouse || !destinationWarehouse
      || !((sourceWarehouse.warehouse_type === 'ward' && destinationWarehouse.warehouse_type === 'central')
        || (sourceWarehouse.warehouse_type === 'central' && destinationWarehouse.warehouse_type === 'ward'))) {
      return res.status(400).json({ success: false, message: 'Bao chỉ được luân chuyển giữa kho phường và kho tổng.' });
    }
    const bagCode = `BAG-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    db.query(
      'INSERT INTO shipment_bags (bag_code, source_warehouse_id, destination_warehouse_id, created_by) VALUES (?, ?, ?, ?)',
      [bagCode, sourceId, destinationId, Number(req.body.created_by) || null],
      (insertErr, result) => {
        if (insertErr) return res.status(500).json({ success: false, message: insertErr.sqlMessage });
        res.status(201).json({ success: true, data: { id: result.insertId, bag_code: bagCode }, message: 'Đã tạo bao hàng mới.' });
      }
    );
  });
});

app.post('/api/warehouse/bags/:id/scan', (req, res) => {
  const bagId = Number(req.params.id);
  const trackingCode = String(req.body.tracking_code || '').trim().toUpperCase();
  if (!Number.isSafeInteger(bagId) || bagId <= 0 || !trackingCode) {
    return res.status(400).json({ success: false, message: 'Mã bao hoặc mã vận đơn không hợp lệ.' });
  }
  db.query('SELECT * FROM shipment_bags WHERE id = ? AND status = "open"', [bagId], (bagErr, bags) => {
    if (bagErr) return res.status(500).json({ success: false, message: bagErr.sqlMessage });
    if (!bags.length) return res.status(409).json({ success: false, message: 'Bao không tồn tại hoặc đã niêm phong.' });
    const bag = bags[0];
    db.query('SELECT * FROM orders WHERE tracking_code = ?', [trackingCode], (orderErr, orders) => {
      if (orderErr) return res.status(500).json({ success: false, message: orderErr.sqlMessage });
      if (!orders.length) return res.status(404).json({ success: false, message: 'Không tìm thấy vận đơn.' });
      const order = orders[0];
      const expectedDestinationId = order.status === 'at_origin_warehouse'
        ? Number(order.origin_warehouse_id)
        : order.status === 'at_central_warehouse'
          ? Number(order.destination_warehouse_id)
          : null;
      const expectedWarehouseId = Number(bag.destination_warehouse_id);
      const correctRoute = order.status === 'at_origin_warehouse'
        ? Number(order.current_warehouse_id) === expectedDestinationId
          && expectedWarehouseId !== expectedDestinationId
        : order.status === 'at_central_warehouse'
          ? Number(order.current_warehouse_id) === expectedDestinationId
            && expectedWarehouseId === Number(order.destination_warehouse_id)
          : false;
      if (Number(order.current_warehouse_id) !== Number(bag.source_warehouse_id) || !correctRoute) {
        return res.status(409).json({ success: false, message: 'Đơn không nằm tại kho nguồn hoặc không đi đúng tuyến của bao.' });
      }
      db.query(
        `SELECT b.id FROM shipment_bag_orders bo
         JOIN shipment_bags b ON b.id = bo.bag_id
         WHERE bo.order_id = ? AND b.status != "received" LIMIT 1`,
        [order.id],
        (activeBagErr, activeBags) => {
          if (activeBagErr) return res.status(500).json({ success: false, message: activeBagErr.sqlMessage });
          if (activeBags.length) return res.status(409).json({ success: false, message: 'Đơn đang nằm trong một bao chưa nhập kho.' });
          db.query('INSERT INTO shipment_bag_orders (bag_id, order_id) VALUES (?, ?)', [bag.id, order.id], (insertErr) => {
            if (insertErr) return res.status(500).json({ success: false, message: insertErr.sqlMessage });
            db.query('SELECT COUNT(*) AS order_count FROM shipment_bag_orders WHERE bag_id = ?', [bag.id], (countErr, counts) => {
              if (countErr) return res.status(500).json({ success: false, message: countErr.sqlMessage });
              res.json({ success: true, data: { bag_code: bag.bag_code, tracking_code: order.tracking_code, order_count: counts[0].order_count }, message: 'Đã quét đơn vào bao.' });
            });
          });
        }
      );
    });
  });
});

app.put('/api/warehouse/bags/:id/seal', (req, res) => {
  const bagId = Number(req.params.id);
  db.query('SELECT COUNT(*) AS order_count FROM shipment_bag_orders WHERE bag_id = ?', [bagId], (countErr, rows) => {
    if (countErr) return res.status(500).json({ success: false, message: countErr.sqlMessage });
    if (!rows[0]?.order_count) return res.status(409).json({ success: false, message: 'Không thể niêm phong bao rỗng.' });
    db.query('UPDATE shipment_bags SET status = "sealed", sealed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = "open"', [bagId], (err, result) => {
      if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
      if (!result.affectedRows) return res.status(409).json({ success: false, message: 'Bao đã được niêm phong hoặc không tồn tại.' });
      res.json({ success: true, order_count: rows[0].order_count, message: 'Đã niêm phong bao hàng.' });
    });
  });
});

app.get('/api/linehaul/trips', (req, res) => {
  const sql = `
    SELECT t.*, source.name AS source_warehouse_name, destination.name AS destination_warehouse_name,
      driver.full_name AS driver_name, COUNT(tb.bag_id) AS bag_count,
      SUM(CASE WHEN tb.driver_scanned_at IS NOT NULL THEN 1 ELSE 0 END) AS scanned_bag_count
    FROM linehaul_trips t
    JOIN warehouses source ON source.id = t.source_warehouse_id
    JOIN warehouses destination ON destination.id = t.destination_warehouse_id
    LEFT JOIN users driver ON driver.id = t.driver_id
    LEFT JOIN linehaul_trip_bags tb ON tb.trip_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `;
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    const data = rows.map((trip) => ({
      ...trip,
      manifest_url: `/api/public/linehaul-manifests/${jwt.sign(
        { purpose: 'linehaul_manifest', trip_id: Number(trip.id) },
        JWT_SECRET,
        { expiresIn: '7d' }
      )}`
    }));
    res.json({ success: true, data });
  });
});

app.get('/api/public/linehaul-manifests/:token', (req, res) => {
  jwt.verify(req.params.token, JWT_SECRET, (tokenErr, payload) => {
    if (tokenErr || payload?.purpose !== 'linehaul_manifest' || !Number.isSafeInteger(Number(payload.trip_id))) {
      return res.status(401).json({ success: false, message: 'Mã QR chuyến xe không hợp lệ hoặc đã hết hạn.' });
    }
    const tripId = Number(payload.trip_id);
    db.query(
      `SELECT t.trip_code, t.vehicle_plate, t.status, t.departed_at, t.arrived_at,
        source.name AS source_warehouse_name, destination.name AS destination_warehouse_name
       FROM linehaul_trips t
       JOIN warehouses source ON source.id = t.source_warehouse_id
       JOIN warehouses destination ON destination.id = t.destination_warehouse_id
       WHERE t.id = ? LIMIT 1`,
      [tripId],
      (tripErr, trips) => {
        if (tripErr) return res.status(500).json({ success: false, message: 'Không tải được chuyến xe: ' + tripErr.sqlMessage });
        if (!trips.length) return res.status(404).json({ success: false, message: 'Không tìm thấy chuyến xe trong manifest.' });
        db.query(
          `SELECT b.bag_code, o.tracking_code
           FROM linehaul_trip_bags tb
           JOIN shipment_bags b ON b.id = tb.bag_id
           LEFT JOIN shipment_bag_orders bo ON bo.bag_id = b.id
           LEFT JOIN orders o ON o.id = bo.order_id
           WHERE tb.trip_id = ?
           ORDER BY b.bag_code, o.tracking_code`,
          [tripId],
          (manifestErr, rows) => {
            if (manifestErr) return res.status(500).json({ success: false, message: 'Không tải được danh sách kiện trên chuyến: ' + manifestErr.sqlMessage });
            const bags = new Map();
            for (const row of rows) {
              if (!bags.has(row.bag_code)) bags.set(row.bag_code, []);
              if (row.tracking_code) bags.get(row.bag_code).push(row.tracking_code);
            }
            const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
              '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            })[character]);
            const bagMarkup = [...bags.entries()].map(([bagCode, trackingCodes]) => `
              <section class="bag">
                <h2>${escapeHtml(bagCode)} <small>${trackingCodes.length} kiện</small></h2>
                <ul>${trackingCodes.map((code) => `<li>${escapeHtml(code)}</li>`).join('') || '<li>Chưa có kiện hàng</li>'}</ul>
              </section>`).join('');
            res.set('Cache-Control', 'no-store');
            res.type('html').send(`<!doctype html>
              <html lang="vi">
                <head>
                  <meta charset="utf-8" />
                  <meta name="viewport" content="width=device-width, initial-scale=1" />
                  <title>Manifest ${escapeHtml(trips[0].trip_code)}</title>
                  <style>
                    body{font:16px system-ui,sans-serif;background:#f1f5f9;color:#0f172a;margin:0;padding:20px}
                    main{max-width:720px;margin:auto;background:white;border-radius:20px;padding:24px;box-shadow:0 8px 30px #0f172a12}
                    h1{margin:0 0 8px;font-size:24px}p{margin:6px 0;color:#475569}.summary{padding:16px;background:#eef2ff;border-radius:14px}
                    .bag{border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin-top:14px}
                    .bag h2{font-size:17px;margin:0}.bag small{color:#64748b;font-weight:500}
                    ul{columns:2;list-style:none;padding:0;margin:12px 0 0}li{padding:4px 0;font-family:ui-monospace,monospace}
                    @media(max-width:480px){body{padding:10px}main{padding:16px}ul{columns:1}}
                  </style>
                </head>
                <body><main>
                  <h1>Manifest chuyến ${escapeHtml(trips[0].trip_code)}</h1>
                  <div class="summary">
                    <p><strong>Biển số:</strong> ${escapeHtml(trips[0].vehicle_plate)}</p>
                    <p><strong>Tuyến:</strong> ${escapeHtml(trips[0].source_warehouse_name)} → ${escapeHtml(trips[0].destination_warehouse_name)}</p>
                    <p><strong>Trạng thái:</strong> ${escapeHtml(trips[0].status)}</p>
                    <p><strong>Số bao:</strong> ${bags.size} · <strong>Tổng kiện:</strong> ${[...bags.values()].reduce((total, codes) => total + codes.length, 0)}</p>
                  </div>
                  ${bagMarkup || '<p class="bag">Chuyến xe chưa được gán bao.</p>'}
                  <p style="margin-top:20px;font-size:12px">Manifest chỉ hiển thị mã kiện và mã vận đơn; không hiển thị thông tin cá nhân người nhận.</p>
                </main></body>
              </html>`);
          }
        );
      }
    );
  });
});

app.post('/api/linehaul/trips', (req, res) => {
  const vehiclePlate = String(req.body.vehicle_plate || '').trim().toUpperCase();
  const sourceId = Number(req.body.source_warehouse_id);
  const destinationId = Number(req.body.destination_warehouse_id);
  const driverId = req.body.driver_id ? Number(req.body.driver_id) : null;
  if (!vehiclePlate || vehiclePlate.length > 30 || !Number.isInteger(sourceId) || !Number.isInteger(destinationId)
    || sourceId <= 0 || destinationId <= 0 || sourceId === destinationId
    || (driverId !== null && (!Number.isInteger(driverId) || driverId <= 0))) {
    return res.status(400).json({ success: false, message: 'Thông tin chuyến xe không hợp lệ.' });
  }
  const tripCode = `TRIP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const insertTrip = () => db.query(
    'INSERT INTO linehaul_trips (trip_code, vehicle_plate, driver_id, source_warehouse_id, destination_warehouse_id) VALUES (?, ?, ?, ?, ?)',
    [tripCode, vehiclePlate, driverId, sourceId, destinationId],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
      res.status(201).json({ success: true, data: { id: result.insertId, trip_code: tripCode }, message: 'Đã tạo chuyến xe.' });
    }
  );
  db.query('SELECT id, warehouse_type FROM warehouses WHERE id IN (?, ?) AND is_active = 1', [sourceId, destinationId], (warehouseErr, warehouses) => {
    if (warehouseErr) return res.status(500).json({ success: false, message: warehouseErr.sqlMessage });
    if (warehouses.length !== 2) return res.status(400).json({ success: false, message: 'Hai kho phải đang hoạt động.' });
    const sourceWarehouse = warehouses.find((warehouse) => Number(warehouse.id) === sourceId);
    const destinationWarehouse = warehouses.find((warehouse) => Number(warehouse.id) === destinationId);
    if (!sourceWarehouse || !destinationWarehouse
      || !((sourceWarehouse.warehouse_type === 'ward' && destinationWarehouse.warehouse_type === 'central')
        || (sourceWarehouse.warehouse_type === 'central' && destinationWarehouse.warehouse_type === 'ward'))) {
      return res.status(400).json({ success: false, message: 'Chuyến trung chuyển phải đi giữa kho phường và kho tổng.' });
    }
    if (!driverId) return insertTrip();
    db.query('SELECT id FROM users WHERE id = ? AND status = "active" AND role IN ("pickup_driver","linehaul_driver")', [driverId], (driverErr, drivers) => {
      if (driverErr) return res.status(500).json({ success: false, message: driverErr.sqlMessage });
      if (!drivers.length) return res.status(400).json({ success: false, message: 'Tài xế trung chuyển không hợp lệ.' });
      insertTrip();
    });
  });
});

app.post('/api/linehaul/trips/:id/bags', (req, res) => {
  const tripId = Number(req.params.id);
  const bagCode = String(req.body.bag_code || '').trim().toUpperCase();
  if (!Number.isSafeInteger(tripId) || tripId <= 0 || !bagCode) {
    return res.status(400).json({ success: false, message: 'Mã chuyến hoặc mã bao không hợp lệ.' });
  }
  db.query('SELECT * FROM linehaul_trips WHERE id = ? AND status IN ("planned","loading")', [tripId], (tripErr, trips) => {
    if (tripErr) return res.status(500).json({ success: false, message: tripErr.sqlMessage });
    if (!trips.length) return res.status(409).json({ success: false, message: 'Chuyến xe không còn nhận bao.' });
    const trip = trips[0];
    db.query('SELECT * FROM shipment_bags WHERE bag_code = ? AND status = "sealed"', [bagCode], (bagErr, bags) => {
      if (bagErr) return res.status(500).json({ success: false, message: bagErr.sqlMessage });
      if (!bags.length) return res.status(404).json({ success: false, message: 'Không tìm thấy bao đã niêm phong.' });
      const bag = bags[0];
      if (Number(bag.source_warehouse_id) !== Number(trip.source_warehouse_id)
        || Number(bag.destination_warehouse_id) !== Number(trip.destination_warehouse_id)) {
        return res.status(409).json({ success: false, message: 'Tuyến bao không khớp với tuyến chuyến xe.' });
      }
      db.query('INSERT INTO linehaul_trip_bags (trip_id, bag_id) VALUES (?, ?)', [trip.id, bag.id], (insertErr) => {
        if (insertErr?.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Bao đã được gán vào chuyến khác.' });
        if (insertErr) return res.status(500).json({ success: false, message: insertErr.sqlMessage });
        db.query('UPDATE linehaul_trips SET status = "loading" WHERE id = ? AND status = "planned"', [trip.id], (updateErr) => {
          if (updateErr) return res.status(500).json({ success: false, message: updateErr.sqlMessage });
          res.json({ success: true, message: `Đã gán bao ${bagCode} lên chuyến ${trip.trip_code}.` });
        });
      });
    });
  });
});

app.post('/api/driver/trips/scan', (req, res) => {
  const driverId = Number(req.body.driver_id);
  const bagCode = String(req.body.bag_code || '').trim().toUpperCase();
  if (!Number.isInteger(driverId) || driverId !== Number(req.authUser.id) || !bagCode) {
    return res.status(403).json({ success: false, message: 'Tài xế chỉ được quét chuyến được giao cho tài khoản đang đăng nhập.' });
  }
  const findSql = `
    SELECT t.id AS trip_id, t.trip_code, t.status, t.destination_warehouse_id, b.id AS bag_id, b.bag_code
    FROM linehaul_trips t
    JOIN linehaul_trip_bags tb ON tb.trip_id = t.id
    JOIN shipment_bags b ON b.id = tb.bag_id
    WHERE t.driver_id = ? AND b.bag_code = ? AND t.status IN ("planned","loading")
  `;
  db.query(findSql, [driverId, bagCode], (findErr, rows) => {
    if (findErr) return res.status(500).json({ success: false, message: findErr.sqlMessage });
    if (!rows.length) return res.status(404).json({ success: false, message: 'Bao không thuộc chuyến xe được giao cho tài xế này.' });
    const { trip_id: tripId, trip_code: tripCode, bag_id: bagId } = rows[0];
    db.query('UPDATE linehaul_trip_bags SET driver_scanned_at = CURRENT_TIMESTAMP WHERE trip_id = ? AND bag_id = ? AND driver_scanned_at IS NULL', [tripId, bagId], (scanErr) => {
      if (scanErr) return res.status(500).json({ success: false, message: scanErr.sqlMessage });
      db.query('SELECT COUNT(*) AS total, SUM(driver_scanned_at IS NOT NULL) AS scanned FROM linehaul_trip_bags WHERE trip_id = ?', [tripId], (countErr, counts) => {
        if (countErr) return res.status(500).json({ success: false, message: countErr.sqlMessage });
        if (Number(counts[0].total) !== Number(counts[0].scanned)) {
          return res.json({ success: true, trip_started: false, scanned: Number(counts[0].scanned), total: Number(counts[0].total), message: 'Đã xác nhận bao. Quét các bao còn lại để khởi hành.' });
        }
        db.query('UPDATE linehaul_trips SET status = "in_transit", departed_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ("planned","loading")', [tripId], (tripUpdateErr, tripResult) => {
          if (tripUpdateErr) return res.status(500).json({ success: false, message: tripUpdateErr.sqlMessage });
          if (!tripResult.affectedRows) return res.status(409).json({ success: false, message: 'Chuyến xe đã được khởi hành hoặc đã thay đổi trạng thái.' });
          db.query('UPDATE shipment_bags b JOIN linehaul_trip_bags tb ON tb.bag_id = b.id SET b.status = "in_transit" WHERE tb.trip_id = ? AND b.status = "sealed"', [tripId], (bagUpdateErr) => {
            if (bagUpdateErr) return res.status(500).json({ success: false, message: bagUpdateErr.sqlMessage });
            const orderStatusSql = `
              UPDATE orders o
              JOIN shipment_bag_orders bo ON bo.order_id = o.id
              JOIN linehaul_trip_bags tb ON tb.bag_id = bo.bag_id
              JOIN warehouses destination ON destination.id = ?
              SET o.status = IF(destination.warehouse_type = "central", "transferring_to_central", "transferring_to_destination")
              WHERE tb.trip_id = ? AND o.status IN ("at_origin_warehouse","at_central_warehouse")
            `;
            db.query(orderStatusSql, [rows[0].destination_warehouse_id, tripId], (ordersErr) => {
              if (ordersErr) return res.status(500).json({ success: false, message: ordersErr.sqlMessage });
              res.json({ success: true, trip_started: true, trip_code: tripCode, message: 'Đã quét đủ bao và bắt đầu chuyến trung chuyển.' });
            });
          });
        });
      });
    });
  });
});

app.post('/api/warehouse/linehaul/scan', (req, res) => {
  const bagCode = String(req.body.bag_code || '').trim().toUpperCase();
  const warehouseId = Number(req.body.warehouse_id);
  if (!bagCode || !Number.isInteger(warehouseId) || warehouseId <= 0) {
    return res.status(400).json({ success: false, message: 'Mã bao hoặc kho nhận không hợp lệ.' });
  }
  const bagSql = `
    SELECT b.*, t.id AS trip_id, t.trip_code
    FROM shipment_bags b
    JOIN linehaul_trip_bags tb ON tb.bag_id = b.id
    JOIN linehaul_trips t ON t.id = tb.trip_id
    WHERE b.bag_code = ? AND b.status = "in_transit" AND t.status = "in_transit"
  `;
  db.query(bagSql, [bagCode], (bagErr, bags) => {
    if (bagErr) return res.status(500).json({ success: false, message: bagErr.sqlMessage });
    if (!bags.length) return res.status(404).json({ success: false, message: 'Bao không tồn tại hoặc chưa được tài xế xác nhận xuất phát.' });
    const bag = bags[0];
    if (Number(bag.destination_warehouse_id) !== warehouseId) {
      return res.status(409).json({ success: false, message: 'Bao được định tuyến đến kho khác.' });
    }
    db.query('SELECT warehouse_type FROM warehouses WHERE id = ? AND is_active = 1', [warehouseId], (warehouseErr, warehouses) => {
      if (warehouseErr) return res.status(500).json({ success: false, message: warehouseErr.sqlMessage });
      if (!warehouses.length) return res.status(404).json({ success: false, message: 'Kho nhận không hoạt động.' });
      const nextStatus = warehouses[0].warehouse_type === 'central' ? 'at_central_warehouse' : 'at_destination_warehouse';
      db.query(
        `UPDATE orders o
         JOIN shipment_bag_orders bo ON bo.order_id = o.id
         SET o.status = ?, o.current_warehouse_id = ?
         WHERE bo.bag_id = ? AND o.status IN ("transferring_to_central","transferring_to_destination")`,
        [nextStatus, warehouseId, bag.id],
        (ordersErr, orderResult) => {
          if (ordersErr) return res.status(500).json({ success: false, message: ordersErr.sqlMessage });
          if (!orderResult.affectedRows) return res.status(409).json({ success: false, message: 'Không có vận đơn trung chuyển hợp lệ trong bao.' });
          db.query('UPDATE shipment_bags SET status = "received", received_at = CURRENT_TIMESTAMP WHERE id = ? AND status = "in_transit"', [bag.id], (updateErr, result) => {
            if (updateErr) return res.status(500).json({ success: false, message: updateErr.sqlMessage });
            if (!result.affectedRows) return res.status(409).json({ success: false, message: 'Bao đã được nhập kho.' });
            db.query('SELECT COUNT(*) AS pending FROM linehaul_trip_bags tb JOIN shipment_bags b ON b.id = tb.bag_id WHERE tb.trip_id = ? AND b.status != "received"', [bag.trip_id], (countErr, pendingRows) => {
              if (countErr) return res.status(500).json({ success: false, message: countErr.sqlMessage });
              const finishTrip = Number(pendingRows[0].pending) === 0;
              if (!finishTrip) return res.json({ success: true, order_count: orderResult.affectedRows, message: `Đã nhập ${orderResult.affectedRows} đơn trong bao ${bagCode}.` });
              db.query('UPDATE linehaul_trips SET status = "completed", arrived_at = CURRENT_TIMESTAMP WHERE id = ?', [bag.trip_id], (tripErr) => {
                if (tripErr) return res.status(500).json({ success: false, message: tripErr.sqlMessage });
                res.json({ success: true, order_count: orderResult.affectedRows, message: `Đã nhập kho ${orderResult.affectedRows} đơn trong bao ${bagCode}; chuyến xe hoàn tất.` });
              });
            });
          });
        }
      );
    });
  });
});

app.get('/api/warehouse/inventory', (req, res) => {
  const sql = 'SELECT o.*, w.name AS warehouse_name, w.ward_name, b.bin_code AS storage_bin_code, b.bin_name AS storage_bin_name FROM orders o LEFT JOIN warehouses w ON w.id = o.current_warehouse_id LEFT JOIN warehouse_bin_locations b ON b.id = o.storage_bin_id WHERE o.status IN ("at_origin_warehouse", "at_central_warehouse", "at_destination_warehouse") AND (? IS NULL OR o.current_warehouse_id = ?) ORDER BY o.updated_at DESC';
  const warehouseId = req.query.warehouse_id ? Number(req.query.warehouse_id) : null;
  db.query(sql, [warehouseId, warehouseId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true, data: redactDeliveryOtp(results) });
  });
});

// =========================================
// 5. API KẾ TOÁN (ĐỐI SOÁT COD)
// =========================================
app.get('/api/accountant/debt', (req, res) => {
  const requestedMonth = String(req.query.month || '');
  if (requestedMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)) {
    return res.status(400).json({ success: false, message: 'Tháng đối soát không hợp lệ.' });
  }
  const month = requestedMonth || null;
  const sql = `
    SELECT u.id as shop_id, u.full_name as shop_name, u.email,
           COUNT(o.id) as total_orders,
           COALESCE(SUM(o.cod_amount), 0) as total_cod,
           COALESCE(SUM(CASE WHEN o.fee_payer = 'sender' THEN o.shipping_fee ELSE 0 END), 0) as total_shipping_fee,
           COALESCE(SUM(o.service_fee), 0) as total_service_fee,
           COALESCE(SUM(o.insurance_fee), 0) as total_insurance_fee,
           COALESCE(SUM(o.cod_amount - CASE WHEN o.fee_payer = 'sender' THEN o.shipping_fee ELSE 0 END - o.service_fee - o.insurance_fee), 0) as total_payable
    FROM orders o
    JOIN users u ON o.shop_id = u.id
    WHERE o.status = 'completed' AND o.is_cod_paid = 0
      AND (? IS NULL OR DATE_FORMAT(o.updated_at, '%Y-%m') = ?)
    GROUP BY u.id
  `;
  db.query(sql, [month, month], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true, data: results });
  });
});

app.get('/api/driver/wallet/:driverId', (req, res) => {
  const driverId = Number(req.params.driverId);
  if (!Number.isInteger(driverId) || driverId !== Number(req.authUser.id)) {
    return res.status(403).json({ success: false, message: 'Bạn chỉ được xem ví COD của tài khoản đang đăng nhập.' });
  }
  const sql = `
    SELECT u.id, u.full_name,
      COALESCE(w.balance, 0) AS deposit_balance,
      COALESCE(w.reserved_balance, 0) AS reserved_balance,
      GREATEST(0, COALESCE(w.balance, 0) - COALESCE(w.reserved_balance, 0)) AS available_balance,
      (SELECT COALESCE(SUM(o.cod_collected_amount), 0) FROM orders o
       WHERE o.delivery_shipper_id = u.id AND o.status = 'completed' AND o.cod_collected = 1
         AND o.cod_payment_method = 'cash' AND o.cod_remittance_id IS NULL) AS cash_on_hand,
      (SELECT COALESCE(SUM(r.amount), 0) FROM driver_cash_remittances r
       WHERE r.driver_id = u.id AND r.status = 'pending') AS cash_pending_handover
    FROM users u
    LEFT JOIN driver_wallets w ON w.driver_id = u.id
    WHERE u.id = ? AND u.role IN ('pickup_driver','delivery_driver') AND u.status = 'active'
  `;
  db.query(sql, [driverId], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy tài xế.' });
    res.json({ success: true, data: rows[0] });
  });
});

app.get('/api/accountant/driver-wallets', (req, res) => {
  db.query(
    `SELECT u.id AS driver_id, u.full_name, COALESCE(w.balance, 0) AS deposit_balance,
      COALESCE(w.reserved_balance, 0) AS reserved_balance,
      GREATEST(0, COALESCE(w.balance, 0) - COALESCE(w.reserved_balance, 0)) AS available_balance
     FROM users u
     LEFT JOIN driver_wallets w ON w.driver_id = u.id
     WHERE u.role = 'delivery_driver' AND u.status = 'active'
     ORDER BY u.full_name`,
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: 'Không tải được danh sách ký quỹ tài xế.' });
      res.json({ success: true, data: rows });
    }
  );
});

app.post('/api/accountant/driver-wallets/:driverId/deposits', (req, res) => {
  const driverId = Number(req.params.driverId);
  const amount = Number(req.body.amount);
  const note = String(req.body.note || '').trim();
  if (!Number.isSafeInteger(driverId) || driverId <= 0
    || !Number.isFinite(amount) || amount <= 0 || amount > 100000000
    || note.length > 200) {
    return res.status(400).json({ success: false, message: 'Số tiền nạp phải từ 1 đến 100.000.000 đồng; ghi chú tối đa 200 ký tự.' });
  }
  db.query(
    `INSERT INTO driver_wallets (driver_id)
     SELECT id FROM users WHERE id = ? AND role = 'delivery_driver' AND status = 'active'
     ON DUPLICATE KEY UPDATE driver_id = VALUES(driver_id)`,
    [driverId],
    (walletErr) => {
      if (walletErr) return res.status(500).json({ success: false, message: 'Không thể tạo ví ký quỹ.' });
      db.query('SELECT id FROM users WHERE id = ? AND role = "delivery_driver" AND status = "active"', [driverId], (driverErr, drivers) => {
        if (driverErr) return res.status(500).json({ success: false, message: 'Không thể kiểm tra tài xế.' });
        if (!drivers.length) return res.status(404).json({ success: false, message: 'Không tìm thấy tài xế giao hàng đang hoạt động.' });
        db.query('UPDATE driver_wallets SET balance = balance + ? WHERE driver_id = ?', [amount, driverId], (updateErr) => {
          if (updateErr) return res.status(500).json({ success: false, message: 'Không thể cộng số dư ký quỹ.' });
          db.query(
            `INSERT INTO driver_wallet_transactions (driver_id, transaction_type, amount, note, created_by)
             VALUES (?, 'deposit', ?, ?, ?)`,
            [driverId, amount, note || 'Kế toán xác nhận đã nhận tiền ký quỹ', req.authUser.id],
            (ledgerErr) => {
              if (ledgerErr) {
                db.query('UPDATE driver_wallets SET balance = GREATEST(0, balance - ?) WHERE driver_id = ?', [amount, driverId], (rollbackErr) => {
                  if (rollbackErr) console.error('Không thể hoàn tác nạp ví sau lỗi ghi sổ:', rollbackErr);
                  return res.status(500).json({ success: false, message: 'Không thể lưu lịch sử nạp ký quỹ; số dư đã được hoàn tác nếu thao tác bù trừ thành công.' });
                });
                return;
              }
              db.query(
                `SELECT balance AS deposit_balance, reserved_balance,
                  GREATEST(0, balance - reserved_balance) AS available_balance
                 FROM driver_wallets WHERE driver_id = ?`,
                [driverId],
                (selectErr, rows) => {
                  if (selectErr) return res.status(500).json({ success: false, message: 'Đã nhận tiền nhưng không tải được số dư ví.' });
                  res.status(201).json({ success: true, data: rows[0], message: 'Đã xác nhận nhận tiền ký quỹ và cộng vào ví tài xế.' });
                }
              );
            }
          );
        });
      });
    }
  );
});

app.post('/api/driver/cash-remittances', (req, res) => {
  const driverId = Number(req.body.driver_id);
  if (!Number.isInteger(driverId) || driverId !== Number(req.authUser.id)) {
    return res.status(403).json({ success: false, message: 'Bạn chỉ được tạo phiếu nộp tiền cho tài khoản đang đăng nhập.' });
  }
  db.query(
    `SELECT id FROM orders
     WHERE delivery_shipper_id = ? AND status = 'completed' AND cod_collected = 1
       AND cod_payment_method = 'cash' AND cod_remittance_id IS NULL`,
    [driverId],
    (findErr, orders) => {
      if (findErr) return res.status(500).json({ success: false, message: findErr.sqlMessage });
      if (!orders.length) return res.status(409).json({ success: false, message: 'Ví không có tiền mặt COD cần nộp.' });
      const orderIds = orders.map((order) => order.id);
      db.query(
        `SELECT COALESCE(SUM(cod_collected_amount), 0) AS amount FROM orders WHERE id IN (?)`,
        [orderIds],
        (sumErr, sums) => {
          if (sumErr) return res.status(500).json({ success: false, message: sumErr.sqlMessage });
          const amount = Number(sums[0].amount);
          db.query('INSERT INTO driver_cash_remittances (driver_id, amount) VALUES (?, ?)', [driverId, amount], (insertErr, result) => {
            if (insertErr) return res.status(500).json({ success: false, message: insertErr.sqlMessage });
            db.query(
              'UPDATE orders SET cod_remittance_id = ? WHERE id IN (?) AND cod_remittance_id IS NULL',
              [result.insertId, orderIds],
              (updateErr, updateResult) => {
                if (updateErr) return res.status(500).json({ success: false, message: updateErr.sqlMessage });
                if (updateResult.affectedRows !== orderIds.length) {
                  return db.query('UPDATE orders SET cod_remittance_id = NULL WHERE cod_remittance_id = ?', [result.insertId], (rollbackErr) => {
                    if (rollbackErr) console.error('Không thể hoàn tác giữ chỗ tiền COD:', rollbackErr);
                    db.query('DELETE FROM driver_cash_remittances WHERE id = ?', [result.insertId], () => {});
                    return res.status(409).json({ success: false, message: 'Ví vừa thay đổi. Tải lại số dư rồi thử lại.' });
                  });
                }
                res.status(201).json({ success: true, data: { remittance_id: result.insertId, amount }, message: 'Đã ghi nhận yêu cầu nộp tiền. Kế toán cần xác nhận tiền mặt.' });
              }
            );
          });
        }
      );
    }
  );
});

app.get('/api/driver/expense-claims', (req, res) => {
  const driverId = Number(req.authUser.id);
  db.query(
    `SELECT id, expense_type, amount, note, receipt_image, status, review_note, created_at, reviewed_at
     FROM driver_expense_claims WHERE driver_id = ? ORDER BY created_at DESC LIMIT 100`,
    [driverId],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: 'Không tải được yêu cầu phụ phí: ' + err.sqlMessage });
      res.json({ success: true, data: rows });
    }
  );
});

app.post('/api/driver/expense-claims', podUpload.fields([{ name: 'receipt_image', maxCount: 1 }]), (req, res) => {
  const driverId = Number(req.authUser.id);
  const expenseType = String(req.body.expense_type || '');
  const amount = Number(req.body.amount);
  const note = String(req.body.note || '').trim();
  const receipt = req.files?.receipt_image?.[0];
  if (!Number.isSafeInteger(driverId) || driverId <= 0
    || !['toll', 'parking', 'fuel', 'other'].includes(expenseType)
    || !Number.isFinite(amount) || amount <= 0 || amount > 10000000
    || note.length < 5 || note.length > 500 || !receipt) {
    return res.status(400).json({ success: false, message: 'Loại chi phí, số tiền, ghi chú hoặc ảnh biên lai không hợp lệ.' });
  }
  db.query(
    `INSERT INTO driver_expense_claims (driver_id, expense_type, amount, note, receipt_image)
     VALUES (?, ?, ?, ?, ?)`,
    [driverId, expenseType, amount, note, `/uploads/${receipt.filename}`],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Không thể gửi yêu cầu phụ phí: ' + err.sqlMessage });
      res.status(201).json({ success: true, data: { id: result.insertId }, message: 'Đã gửi biên lai chờ Kế toán duyệt.' });
    }
  );
});

app.get('/api/accountant/driver-remittances', (req, res) => {
  const status = ['pending', 'received'].includes(req.query.status) ? req.query.status : 'pending';
  const sql = `
    SELECT r.id, r.driver_id, u.full_name AS driver_name, r.amount, r.status,
      r.created_at, r.received_at, accountant.full_name AS received_by_name
    FROM driver_cash_remittances r
    JOIN users u ON u.id = r.driver_id
    LEFT JOIN users accountant ON accountant.id = r.received_by
    WHERE r.status = ?
    ORDER BY r.created_at DESC
  `;
  db.query(sql, [status], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true, data: rows });
  });
});

app.get('/api/accountant/expense-claims', (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  db.query(
    `SELECT c.id, c.driver_id, u.full_name AS driver_name, c.expense_type, c.amount, c.note,
      c.receipt_image, c.status, c.review_note, c.created_at, c.reviewed_at, reviewer.full_name AS reviewer_name
     FROM driver_expense_claims c
     JOIN users u ON u.id = c.driver_id
     LEFT JOIN users reviewer ON reviewer.id = c.reviewed_by
     WHERE c.status = ? ORDER BY c.created_at ASC`,
    [status],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: 'Không tải được danh sách phụ phí: ' + err.sqlMessage });
      res.json({ success: true, data: rows });
    }
  );
});

app.put('/api/accountant/expense-claims/:id/review', (req, res) => {
  const claimId = Number(req.params.id);
  const status = String(req.body.status || '');
  const reviewNote = String(req.body.review_note || '').trim();
  if (!Number.isSafeInteger(claimId) || claimId <= 0 || !['approved', 'rejected'].includes(status)
    || reviewNote.length > 500 || status === 'rejected' && reviewNote.length < 5) {
    return res.status(400).json({ success: false, message: 'Trạng thái duyệt hoặc ghi chú xử lý không hợp lệ.' });
  }
  db.beginTransaction((transactionErr) => {
    if (transactionErr) return res.status(500).json({ success: false, message: 'Không mở được giao dịch duyệt phụ phí: ' + transactionErr.sqlMessage });
    db.query(
      `UPDATE driver_expense_claims SET status = ?, reviewed_by = ?, review_note = ?, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'pending'`,
      [status, Number(req.authUser.id), reviewNote || null, claimId],
      (updateErr, result) => {
        if (updateErr || !result.affectedRows) {
          return db.rollback(() => res.status(updateErr ? 500 : 409).json({
            success: false,
            message: updateErr ? 'Không cập nhật được yêu cầu: ' + updateErr.sqlMessage : 'Yêu cầu đã được xử lý hoặc không tồn tại.'
          }));
        }
        const finalize = () => db.commit((commitErr) => {
          if (commitErr) return db.rollback(() => res.status(500).json({ success: false, message: 'Không thể lưu giao dịch duyệt phụ phí: ' + commitErr.sqlMessage }));
          res.json({ success: true, message: status === 'approved' ? 'Đã duyệt và cộng phụ phí vào lương tháng tạo yêu cầu.' : 'Đã từ chối yêu cầu phụ phí.' });
        });
        if (status !== 'approved') return finalize();
        db.query(
          `INSERT INTO employee_payroll_adjustments (user_id, payroll_month, adjustment_type, amount, reason)
           SELECT driver_id, DATE_FORMAT(created_at, '%Y-%m'), 'bonus', amount, CONCAT('Hoàn phụ phí claim #', id)
           FROM driver_expense_claims WHERE id = ?`,
          [claimId],
          (payrollErr, payrollResult) => {
            if (payrollErr || !payrollResult.affectedRows) {
              return db.rollback(() => res.status(500).json({
                success: false,
                message: payrollErr ? 'Đã duyệt nhưng không cộng được vào bảng lương: ' + payrollErr.sqlMessage : 'Không tìm thấy phiếu phụ phí để cộng vào lương.'
              }));
            }
            finalize();
          });
      }
    );
  });
});

app.put('/api/accountant/driver-remittances/:id/receive', (req, res) => {
  const remittanceId = Number(req.params.id);
  const accountantId = Number(req.authUser.id);
  if (!Number.isSafeInteger(remittanceId) || remittanceId <= 0) {
    return res.status(400).json({ success: false, message: 'Mã phiếu nộp không hợp lệ.' });
  }
  db.query(
    'SELECT id FROM driver_cash_remittances WHERE id = ? AND status = "pending" LIMIT 1',
    [remittanceId],
    (findErr, remittances) => {
      if (findErr) return res.status(500).json({ success: false, message: findErr.sqlMessage });
      if (!remittances.length) return res.status(409).json({ success: false, message: 'Phiếu nộp đã được xác nhận hoặc không tồn tại.' });
      db.query('SELECT id FROM orders WHERE cod_remittance_id = ?', [remittanceId], (ordersErr, orders) => {
        if (ordersErr) {
          return res.status(500).json({ success: false, message: 'Không tải được đơn trong phiếu để giải phóng ký quỹ.' });
        }
        let remaining = orders.length;
        let releaseFailed = false;
        const markRemittanceReceived = () => {
          db.query(
            'UPDATE driver_cash_remittances SET status = "received", received_by = ?, received_at = CURRENT_TIMESTAMP WHERE id = ? AND status = "pending"',
            [accountantId, remittanceId],
            (updateErr, result) => {
              if (updateErr) return res.status(500).json({ success: false, message: updateErr.sqlMessage });
              if (!result.affectedRows) return res.status(409).json({ success: false, message: 'Phiếu nộp vừa được xác nhận bởi người khác.' });
              res.json({ success: true, message: 'Đã xác nhận nhận tiền mặt và giải phóng ký quỹ các đơn trong phiếu.' });
            }
          );
        };
        if (!remaining) return markRemittanceReceived();
        orders.forEach(({ id }) => releaseDriverWalletReservation(id, 'Kế toán xác nhận đã nhận COD tiền mặt', (releaseErr) => {
          if (releaseErr) {
            releaseFailed = true;
            console.error(`Không thể giải phóng ký quỹ đơn ${id} sau khi nhận COD:`, releaseErr);
          }
          remaining -= 1;
          if (remaining) return;
          if (releaseFailed) {
            return res.status(500).json({ success: false, message: 'Không thể giải phóng ký quỹ cho toàn bộ đơn; phiếu vẫn chờ để có thể thử lại.' });
          }
          markRemittanceReceived();
        }));
      });
    }
  );
});

app.post('/api/driver/incidents', (req, res) => {
  const driverId = Number(req.body.driver_id);
  const type = String(req.body.incident_type || '');
  const description = String(req.body.description || '').trim();
  const latitude = req.body.lat === undefined || req.body.lat === null ? null : Number(req.body.lat);
  const longitude = req.body.lng === undefined || req.body.lng === null ? null : Number(req.body.lng);
  if (!Number.isInteger(driverId) || driverId !== Number(req.authUser.id)
    || !['accident', 'vehicle_breakdown', 'traffic', 'other'].includes(type)
    || !description || description.length > 2000
    || ((latitude === null) !== (longitude === null))
    || (latitude !== null && (!Number.isFinite(latitude) || Math.abs(latitude) > 90))
    || (longitude !== null && (!Number.isFinite(longitude) || Math.abs(longitude) > 180))) {
    return res.status(400).json({ success: false, message: 'Thông tin sự cố hoặc tọa độ không hợp lệ.' });
  }
  db.query(
    'INSERT INTO driver_incidents (driver_id, incident_type, description, lat, lng) VALUES (?, ?, ?, ?, ?)',
    [driverId, type, description, latitude, longitude],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
      db.query('SELECT full_name FROM users WHERE id = ?', [driverId], (userErr, users) => {
        if (userErr) return res.status(500).json({ success: false, message: userErr.sqlMessage });
        if (!users.length) return res.status(404).json({ success: false, message: 'Không tìm thấy tài xế.' });
        io.to('support_agents').emit('driver_incident', {
          id: result.insertId, driver_id: driverId, driver_name: users[0].full_name,
          incident_type: type, description, lat: latitude, lng: longitude, created_at: new Date().toISOString()
        });
        res.status(201).json({ success: true, message: 'Đã gửi báo cáo sự cố đến trung tâm.', incident_id: result.insertId });
      });
    }
  );
});

app.put('/api/accountant/pay/:shop_id', (req, res) => {
  const requestedMonth = String(req.query.month || '');
  if (requestedMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)) {
    return res.status(400).json({ success: false, message: 'Tháng đối soát không hợp lệ.' });
  }
  const month = requestedMonth || null;
  db.query('INSERT INTO cod_settlements (shop_id) VALUES (?)', [req.params.shop_id], (insertErr, settlement) => {
    if (insertErr) return res.status(500).json({ success: false, message: insertErr.sqlMessage });

    const settlementId = settlement.insertId;
    const updateSql = `
      UPDATE orders
      SET is_cod_paid = 1, cod_settlement_id = ?
      WHERE shop_id = ? AND status = 'completed' AND is_cod_paid = 0
        AND (? IS NULL OR DATE_FORMAT(updated_at, '%Y-%m') = ?)
    `;
    db.query(updateSql, [settlementId, req.params.shop_id, month, month], (updateErr, result) => {
      if (updateErr) return res.status(500).json({ success: false, message: updateErr.sqlMessage });
      if (!result.affectedRows) {
        db.query('DELETE FROM cod_settlements WHERE id = ?', [settlementId]);
        return res.status(409).json({ success: false, message: 'Shop không có đơn COD chưa thanh toán.' });
      }

      const totalsSql = `
        UPDATE cod_settlements
        SET total_cod = (SELECT COALESCE(SUM(cod_amount), 0) FROM orders WHERE cod_settlement_id = ?),
            total_shipping_fee = (SELECT COALESCE(SUM(CASE WHEN fee_payer = 'sender' THEN shipping_fee ELSE 0 END), 0) FROM orders WHERE cod_settlement_id = ?),
            total_service_fee = (SELECT COALESCE(SUM(service_fee), 0) FROM orders WHERE cod_settlement_id = ?),
            total_insurance_fee = (SELECT COALESCE(SUM(insurance_fee), 0) FROM orders WHERE cod_settlement_id = ?),
            total_paid = (SELECT COALESCE(SUM(cod_amount - CASE WHEN fee_payer = 'sender' THEN shipping_fee ELSE 0 END - service_fee - insurance_fee), 0) FROM orders WHERE cod_settlement_id = ?),
            order_count = (SELECT COUNT(*) FROM orders WHERE cod_settlement_id = ?)
        WHERE id = ?
      `;
      db.query(totalsSql, [settlementId, settlementId, settlementId, settlementId, settlementId, settlementId, settlementId], (totalsErr) => {
        if (totalsErr) return res.status(500).json({ success: false, message: totalsErr.sqlMessage });
        db.query('SELECT total_paid FROM cod_settlements WHERE id = ?', [settlementId], (paidErr, paidRows) => {
          if (paidErr) return res.status(500).json({ success: false, message: paidErr.sqlMessage });
          res.json({ success: true, settlement_id: settlementId, order_count: result.affectedRows, total_paid: paidRows[0]?.total_paid || 0 });
        });
      });
    });
  });
});

app.get('/api/accountant/history', (req, res) => {
  const sql = `
        SELECT s.id as settlement_id, u.id as shop_id, u.full_name as shop_name, u.email,
          s.order_count as total_orders, s.total_cod, s.total_shipping_fee,
          s.total_service_fee, s.total_insurance_fee,
          s.total_paid,
          s.settled_at
        FROM cod_settlements s
        JOIN users u ON s.shop_id = u.id
        ORDER BY s.settled_at DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true, data: results });
  });
});

app.get('/api/accountant/settlements/:id', (req, res) => {
  const settlementId = Number(req.params.id);
  if (!Number.isInteger(settlementId) || settlementId <= 0) {
    return res.status(400).json({ success: false, message: 'Mã đợt đối soát không hợp lệ.' });
  }
  const sql = `
    SELECT s.id AS settlement_id, s.shop_id, u.full_name AS shop_name, u.email,
      s.total_cod, s.total_shipping_fee,
      s.total_service_fee, s.total_insurance_fee, s.total_paid,
      s.order_count, s.settled_at,
      o.id AS order_id, o.tracking_code, o.receiver_name, o.receiver_phone,
      o.cod_amount, o.shipping_fee, o.fee_payer, o.service_fee, o.insurance_fee
    FROM cod_settlements s
    JOIN users u ON u.id = s.shop_id
    LEFT JOIN orders o ON o.cod_settlement_id = s.id
    WHERE s.id = ?
    ORDER BY o.id
  `;
  db.query(sql, [settlementId], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy đợt đối soát.' });
    const settlement = {
      settlement_id: rows[0].settlement_id,
      shop_id: rows[0].shop_id,
      shop_name: rows[0].shop_name,
      email: rows[0].email,
      total_cod: rows[0].total_cod,
      total_shipping_fee: rows[0].total_shipping_fee,
      total_service_fee: rows[0].total_service_fee,
      total_insurance_fee: rows[0].total_insurance_fee,
      total_paid: rows[0].total_paid,
      order_count: rows[0].order_count,
      settled_at: rows[0].settled_at,
      orders: rows.filter((row) => row.order_id).map((row) => ({
        id: row.order_id,
        tracking_code: row.tracking_code,
        receiver_name: row.receiver_name,
        receiver_phone: row.receiver_phone,
        cod_amount: row.cod_amount,
        shipping_fee: row.shipping_fee,
        fee_payer: row.fee_payer,
        service_fee: row.service_fee,
        insurance_fee: row.insurance_fee
      }))
    };
    res.json({ success: true, data: settlement });
  });
});

app.post('/api/accountant/settlements/:id/email', (req, res) => {
  const settlementId = Number(req.params.id);
  if (!Number.isSafeInteger(settlementId) || settlementId <= 0) {
    return res.status(400).json({ success: false, message: 'Mã đợt đối soát không hợp lệ.' });
  }
  if (!mailerReady) {
    return res.status(503).json({ success: false, message: 'Chưa cấu hình SMTP. Cần khai báo SMTP_HOST, SMTP_USER và SMTP_PASS.' });
  }
  const sql = `
    SELECT s.id, s.total_cod, s.total_shipping_fee, s.total_service_fee, s.total_insurance_fee,
      s.total_paid, s.settled_at, u.full_name AS shop_name, u.email,
      o.tracking_code, o.cod_amount, o.shipping_fee, o.fee_payer, o.service_fee, o.insurance_fee
    FROM cod_settlements s
    JOIN users u ON u.id = s.shop_id
    LEFT JOIN orders o ON o.cod_settlement_id = s.id
    WHERE s.id = ?
    ORDER BY o.id
  `;
  db.query(sql, [settlementId], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy đợt đối soát.' });
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
    const orderRows = rows.filter((row) => row.tracking_code).map((row) => `
      <tr>
        <td>${escapeHtml(row.tracking_code)}</td>
        <td>${Number(row.cod_amount || 0).toLocaleString('vi-VN')}</td>
        <td>${Number(row.fee_payer === 'sender' ? row.shipping_fee : 0).toLocaleString('vi-VN')}</td>
        <td>${Number(row.service_fee || 0).toLocaleString('vi-VN')}</td>
        <td>${Number(row.insurance_fee || 0).toLocaleString('vi-VN')}</td>
      </tr>`).join('');
    const summary = rows[0];
    const html = `<div style="font-family:Arial,sans-serif;color:#0f172a">
      <h1>Smart Logistics · Phiếu đối soát COD #${summary.id}</h1>
      <p>Kính gửi ${escapeHtml(summary.shop_name)} (${escapeHtml(summary.email)}),</p>
      <p>Ngày đối soát: ${new Date(summary.settled_at).toLocaleString('vi-VN')}</p>
      <table style="border-collapse:collapse;width:100%" border="1" cellpadding="8">
        <thead><tr><th>Mã đơn</th><th>COD</th><th>Cước shop trả</th><th>Phí dịch vụ</th><th>Bảo hiểm</th></tr></thead>
        <tbody>${orderRows}</tbody>
      </table>
      <p>Tổng COD: <strong>${Number(summary.total_cod).toLocaleString('vi-VN')} đ</strong></p>
      <p>Cước trừ của Shop: -${Number(summary.total_shipping_fee).toLocaleString('vi-VN')} đ</p>
      <p>Phí dịch vụ: -${Number(summary.total_service_fee).toLocaleString('vi-VN')} đ</p>
      <p>Phí bảo hiểm: -${Number(summary.total_insurance_fee).toLocaleString('vi-VN')} đ</p>
      <h2>Tiền Shop nhận: ${Number(summary.total_paid).toLocaleString('vi-VN')} đ</h2>
    </div>`;
    createSettlementPdf(summary, rows.filter((row) => row.tracking_code))
      .then((pdf) => transporter.sendMail({
        from: mailFrom,
        to: summary.email,
        subject: `Phiếu đối soát COD #${summary.id} · Smart Logistics`,
        html,
        attachments: [{
          filename: `phieu-doi-soat-cod-${summary.id}.pdf`,
          content: pdf,
          contentType: 'application/pdf'
        }]
      }))
      .then(() => {
        res.json({ success: true, message: `Đã gửi phiếu đối soát PDF đến ${summary.email}.` });
      })
      .catch((mailErr) => {
        console.error('Tạo hoặc gửi PDF đối soát COD thất bại:', mailErr);
        if (res.headersSent) return;
        res.status(502).json({ success: false, message: 'Không tạo hoặc gửi được PDF đối soát. Kiểm tra cấu hình SMTP và font PDF.' });
      });
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

  if (!full_name || !email || typeof password !== 'string' || !password || password.length > 1024 || !role) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc: họ tên, email, mật khẩu, chức vụ.' });
  }

  const normalizedRole = String(role).trim().toLowerCase();
  const normalizedEmail = String(email).trim();
  const normalizedName = String(full_name).trim();
  const normalizedStatus = status || 'active';
  if (!normalizedName || normalizedName.length > 255
    || normalizedEmail.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    || !staffRoles.has(normalizedRole) || !staffStatuses.has(normalizedStatus)) {
    return res.status(400).json({ success: false, message: 'Họ tên, email, chức vụ hoặc trạng thái nhân sự không hợp lệ.' });
  }

  const sql = 'INSERT INTO users (full_name, email, password, role, status) VALUES (?, ?, ?, ?, ?)';
  hashPassword(password).then((passwordHash) => {
    db.query(sql, [normalizedName, normalizedEmail, passwordHash, normalizedRole, normalizedStatus], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ success: false, message: 'Email đã tồn tại trong hệ thống.' });
        }
        return res.status(500).json({ success: false, message: 'Lỗi tạo nhân sự: ' + err.sqlMessage });
      }

      res.json({ success: true, message: 'Đã tạo nhân sự mới thành công.', staffId: result.insertId });
    });
  }).catch((error) => {
    console.error('Lỗi băm mật khẩu nhân sự mới:', error);
    res.status(500).json({ success: false, message: 'Không thể tạo mật khẩu an toàn cho nhân sự.' });
  });
});

app.put('/api/hr/staff/:id', (req, res) => {
  const { full_name, email, password, role, status } = req.body;
  const staffId = Number(req.params.id);

  if (!full_name || !email || !role || !Number.isInteger(staffId) || staffId <= 0) {
    return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc khi cập nhật nhân sự.' });
  }

  const normalizedName = String(full_name).trim();
  const normalizedEmail = String(email).trim();
  const normalizedRole = String(role).trim().toLowerCase();
  const normalizedStatus = status || 'active';
  if (!normalizedName || normalizedName.length > 255
    || normalizedEmail.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    || !staffRoles.has(normalizedRole) || !staffStatuses.has(normalizedStatus)) {
    return res.status(400).json({ success: false, message: 'Họ tên, email, chức vụ hoặc trạng thái nhân sự không hợp lệ.' });
  }

  const updates = [normalizedName, normalizedEmail, normalizedRole, normalizedStatus];
  const sql = 'UPDATE users SET full_name = ?, email = ?, role = ?, status = ?';

  const saveStaff = (passwordHash = null) => {
    if (passwordHash) {
      updates.push(passwordHash);
      sql += ', password = ?';
    }
    updates.push(staffId);
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
  };

  if (password && String(password).trim()) {
    if (typeof password !== 'string' || password.length > 1024) {
      return res.status(400).json({ success: false, message: 'Mật khẩu không hợp lệ.' });
    }
    return hashPassword(password).then(saveStaff).catch((error) => {
      console.error('Lỗi băm mật khẩu cập nhật:', error);
      res.status(500).json({ success: false, message: 'Không thể cập nhật mật khẩu an toàn.' });
    });
  }
  saveStaff();
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
  const staffId = Number(req.params.id);
  if (!Number.isInteger(staffId) || staffId <= 0 || !staffStatuses.has(req.body.status)) {
    return res.status(400).json({ success: false, message: 'Mã nhân viên hoặc trạng thái không hợp lệ.' });
  }
  const sql = 'UPDATE users SET status = ? WHERE id = ?';
  db.query(sql, [req.body.status, staffId], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên.' });
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
  const requestedUserId = req.query.user_id ? Number(req.query.user_id) : null;
  if (req.query.user_id && (!Number.isInteger(requestedUserId) || requestedUserId <= 0)) {
    return res.status(400).json({ success: false, message: 'Mã nhân viên không hợp lệ.' });
  }
  const isHr = ['hr_manager', 'director'].includes(req.authRole || normalizeRole(req.authUser.role));
  const userId = isHr ? requestedUserId : Number(req.authUser.id);

  const sql = `
    SELECT a.id, a.user_id, u.full_name, u.role,
      DATE_FORMAT(a.work_date, '%Y-%m-%d') AS work_date, a.check_in, a.check_out,
      a.check_in_photo, a.check_in_lat, a.check_in_lng,
      a.check_out_photo, a.check_out_lat, a.check_out_lng
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

function removeAttendanceUpload(file) {
  if (!file) return;
  fs.unlink(file.path, (err) => {
    if (err && err.code !== 'ENOENT') console.error('Lỗi xóa ảnh chấm công không được lưu:', err);
  });
}

app.post('/api/attendance/check-in', (req, res, next) => {
  attendanceUpload.single('photo')(req, res, (uploadErr) => {
    if (uploadErr) {
      const message = uploadErr.code === 'LIMIT_FILE_SIZE'
        ? 'Ảnh chấm công không được vượt quá 10 MB.'
        : uploadErr.message || 'Không thể tải ảnh chấm công lên.';
      return res.status(400).json({ success: false, message });
    }
    next();
  });
}, (req, res) => {
  const userId = Number(req.body.user_id);
  const latitude = req.body.lat === undefined || req.body.lat === '' ? null : Number(req.body.lat);
  const longitude = req.body.lng === undefined || req.body.lng === '' ? null : Number(req.body.lng);
  if (!Number.isInteger(userId) || userId !== Number(req.authUser.id)) {
    removeAttendanceUpload(req.file);
    return res.status(403).json({ success: false, message: 'Bạn chỉ được chấm công cho tài khoản đang đăng nhập.' });
  }
  if ((latitude === null) !== (longitude === null)
    || (latitude !== null && (!Number.isFinite(latitude) || Math.abs(latitude) > 90))
    || (longitude !== null && (!Number.isFinite(longitude) || Math.abs(longitude) > 180))) {
    removeAttendanceUpload(req.file);
    return res.status(400).json({ success: false, message: 'Tọa độ chấm công không hợp lệ.' });
  }

  db.query(`
    SELECT id FROM attendance_records
    WHERE user_id = ? AND work_date = CURDATE() AND check_in IS NOT NULL AND check_out IS NULL
    ORDER BY id DESC LIMIT 1
  `, [userId], (findErr, rows) => {
    if (findErr) {
      removeAttendanceUpload(req.file);
      return res.status(500).json({ success: false, message: findErr.sqlMessage });
    }
    if (rows.length) {
      removeAttendanceUpload(req.file);
      return res.status(409).json({ success: false, message: 'Bạn vẫn còn một ca chưa chấm công tan ca.' });
    }
    const sql = `
      INSERT INTO attendance_records (user_id, work_date, check_in, check_in_photo, check_in_lat, check_in_lng)
      VALUES (?, CURDATE(), CURRENT_TIMESTAMP, ?, ?, ?)
    `;
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
    db.query(sql, [userId, photoUrl, latitude, longitude], (insertErr) => {
      if (insertErr) {
        removeAttendanceUpload(req.file);
        return res.status(500).json({ success: false, message: insertErr.sqlMessage });
      }
      res.json({ success: true, message: 'Đã ghi nhận giờ vào.' });
    });
  });
});

app.post('/api/attendance/check-out', (req, res, next) => {
  attendanceUpload.single('photo')(req, res, (uploadErr) => {
    if (uploadErr) {
      const message = uploadErr.code === 'LIMIT_FILE_SIZE'
        ? 'Ảnh chấm công không được vượt quá 10 MB.'
        : uploadErr.message || 'Không thể tải ảnh chấm công lên.';
      return res.status(400).json({ success: false, message });
    }
    next();
  });
}, (req, res) => {
  const userId = Number(req.body.user_id);
  const latitude = req.body.lat === undefined || req.body.lat === '' ? null : Number(req.body.lat);
  const longitude = req.body.lng === undefined || req.body.lng === '' ? null : Number(req.body.lng);
  if (!Number.isInteger(userId) || userId !== Number(req.authUser.id)) {
    removeAttendanceUpload(req.file);
    return res.status(403).json({ success: false, message: 'Bạn chỉ được chấm công cho tài khoản đang đăng nhập.' });
  }
  if ((latitude === null) !== (longitude === null)
    || (latitude !== null && (!Number.isFinite(latitude) || Math.abs(latitude) > 90))
    || (longitude !== null && (!Number.isFinite(longitude) || Math.abs(longitude) > 180))) {
    removeAttendanceUpload(req.file);
    return res.status(400).json({ success: false, message: 'Tọa độ chấm công không hợp lệ.' });
  }

  db.query(`
    SELECT id FROM attendance_records
    WHERE user_id = ? AND work_date = CURDATE() AND check_in IS NOT NULL AND check_out IS NULL
    ORDER BY id DESC LIMIT 1
  `, [userId], (findErr, rows) => {
    if (findErr) {
      removeAttendanceUpload(req.file);
      return res.status(500).json({ success: false, message: findErr.sqlMessage });
    }
    if (!rows.length) {
      removeAttendanceUpload(req.file);
      return res.status(409).json({ success: false, message: 'Không có ca nào đang mở để chấm công tan ca.' });
    }
    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
    db.query(
      `UPDATE attendance_records
       SET check_out = CURRENT_TIMESTAMP, check_out_photo = ?, check_out_lat = ?, check_out_lng = ?
       WHERE id = ? AND check_out IS NULL`,
      [photoUrl, latitude, longitude, rows[0].id],
      (err, result) => {
        if (err) {
          removeAttendanceUpload(req.file);
          return res.status(500).json({ success: false, message: err.sqlMessage });
        }
        if (!result.affectedRows) {
          removeAttendanceUpload(req.file);
          return res.status(409).json({ success: false, message: 'Ca làm này đã được chấm công tan.' });
        }
        res.json({ success: true, message: 'Đã ghi nhận giờ ra.' });
      }
    );
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
      COALESCE(s.bonus_per_delivery, 0) AS bonus_per_delivery,
      (SELECT COUNT(DISTINCT a.work_date) FROM attendance_records a
        WHERE a.user_id = u.id AND DATE_FORMAT(a.work_date, '%Y-%m') = ?) AS attendance_days,
      (SELECT COUNT(*) FROM orders o WHERE o.delivery_shipper_id = u.id AND o.status = 'completed'
        AND DATE_FORMAT(o.updated_at, '%Y-%m') = ?) AS completed_deliveries,
      (SELECT COALESCE(SUM(pa.amount), 0) FROM employee_payroll_adjustments pa
        WHERE pa.user_id = u.id AND pa.payroll_month = ? AND pa.adjustment_type = 'bonus') AS manual_bonus,
      (SELECT COALESCE(SUM(pa.amount), 0) FROM employee_payroll_adjustments pa
        WHERE pa.user_id = u.id AND pa.payroll_month = ? AND pa.adjustment_type = 'deduction') AS deductions,
      COALESCE(s.monthly_salary, 0) + COALESCE(s.allowance, 0)
        + COALESCE(s.bonus_per_delivery, 0) * (SELECT COUNT(*) FROM orders o
          WHERE o.delivery_shipper_id = u.id AND o.status = 'completed' AND DATE_FORMAT(o.updated_at, '%Y-%m') = ?)
        + (SELECT COALESCE(SUM(pa.amount), 0) FROM employee_payroll_adjustments pa
          WHERE pa.user_id = u.id AND pa.payroll_month = ? AND pa.adjustment_type = 'bonus')
        - (SELECT COALESCE(SUM(pa.amount), 0) FROM employee_payroll_adjustments pa
          WHERE pa.user_id = u.id AND pa.payroll_month = ? AND pa.adjustment_type = 'deduction') AS estimated_salary
    FROM users u
    LEFT JOIN employee_salaries s ON s.user_id = u.id
    WHERE u.role != 'customer'
    ORDER BY u.full_name ASC
  `;
  db.query(sql, [month, month, month, month, month, month, month], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true, data: results });
  });
});

app.put('/api/hr/payroll/:userId', (req, res) => {
  const userId = Number(req.params.userId);
  const monthlySalary = Number(req.body.monthly_salary);
  const allowance = Number(req.body.allowance || 0);
  const bonusPerDelivery = Number(req.body.bonus_per_delivery || 0);
  if (!Number.isInteger(userId) || userId <= 0 || !Number.isFinite(monthlySalary) || monthlySalary < 0
    || !Number.isFinite(allowance) || allowance < 0 || !Number.isFinite(bonusPerDelivery) || bonusPerDelivery < 0) {
    return res.status(400).json({ success: false, message: 'Lương, phụ cấp và thưởng trên đơn phải là số không âm.' });
  }
  const sql = `
    INSERT INTO employee_salaries (user_id, monthly_salary, allowance, bonus_per_delivery)
    SELECT id, ?, ?, ? FROM users WHERE id = ? AND role != 'customer'
    ON DUPLICATE KEY UPDATE monthly_salary = VALUES(monthly_salary), allowance = VALUES(allowance),
      bonus_per_delivery = VALUES(bonus_per_delivery)
  `;
  db.query("SELECT id FROM users WHERE id = ? AND role != 'customer'", [userId], (findErr, users) => {
    if (findErr) return res.status(500).json({ success: false, message: findErr.sqlMessage });
    if (!users.length) return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên.' });
    db.query(sql, [monthlySalary, allowance, bonusPerDelivery, userId], (err) => {
      if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
      res.json({ success: true, message: 'Đã cập nhật mức lương.' });
    });
  });
});

app.post('/api/hr/payroll/:userId/adjustments', (req, res) => {
  const userId = Number(req.params.userId);
  const month = String(req.body.month || '');
  const adjustmentType = String(req.body.adjustment_type || '');
  const amount = Number(req.body.amount);
  const reason = String(req.body.reason || '').trim();
  if (!Number.isInteger(userId) || userId <= 0 || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
    || !['bonus', 'deduction'].includes(adjustmentType) || !Number.isFinite(amount) || amount <= 0
    || !reason || reason.length > 255) {
    return res.status(400).json({ success: false, message: 'Thông tin thưởng hoặc khấu trừ không hợp lệ.' });
  }
  db.query(
    `INSERT INTO employee_payroll_adjustments (user_id, payroll_month, adjustment_type, amount, reason)
     SELECT id, ?, ?, ?, ? FROM users WHERE id = ? AND role != 'customer'`,
    [month, adjustmentType, amount, reason, userId],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
      if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên.' });
      res.status(201).json({ success: true, message: adjustmentType === 'bonus' ? 'Đã ghi nhận thưởng.' : 'Đã ghi nhận khoản khấu trừ.' });
    }
  );
});

// =========================================
// 7. API GIÁM ĐỐC (DASHBOARD)
// =========================================
app.get('/api/admin/dashboard', (req, res) => {
  const period = ['today', 'week', 'month', 'year', 'custom'].includes(req.query.period) ? req.query.period : 'month';
  const startDate = String(req.query.start_date || '');
  const endDate = String(req.query.end_date || '');
  const validDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date)
    && !Number.isNaN(Date.parse(`${date}T00:00:00Z`))
    && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  if ((period === 'custom' || startDate || endDate)
    && (!validDate(startDate) || !validDate(endDate) || startDate > endDate)) {
    return res.status(400).json({ success: false, message: 'Khoảng ngày tùy chỉnh không hợp lệ.' });
  }
  const districts = [
    'Quận 1', 'Quận 3', 'Quận 4', 'Quận 5', 'Quận 6', 'Quận 7', 'Quận 8', 'Quận 10',
    'Quận 11', 'Quận 12', 'Quận Bình Tân', 'Quận Bình Thạnh', 'Quận Gò Vấp',
    'Quận Phú Nhuận', 'Quận Tân Bình', 'Quận Tân Phú', 'Thành phố Thủ Đức',
    'Huyện Bình Chánh', 'Huyện Cần Giờ', 'Huyện Củ Chi', 'Huyện Hóc Môn', 'Huyện Nhà Bè',
    'Quận 2', 'Quận 9'
  ];
  const district = districts.find((item) => item.toLocaleLowerCase('vi') === String(req.query.district || '').trim().toLocaleLowerCase('vi'));
  const conditions = [];
  const params = [];
  const heatmapConditions = [];
  const heatmapParams = [];
  if (period === 'today') conditions.push('DATE(created_at) = CURDATE()');
  if (period === 'week') conditions.push('YEARWEEK(created_at, 1) = YEARWEEK(CURDATE(), 1)');
  if (period === 'month') conditions.push('YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())');
  if (period === 'year') conditions.push('YEAR(created_at) = YEAR(CURDATE())');
  if (period === 'custom') {
    conditions.push('DATE(created_at) BETWEEN ? AND ?');
    params.push(startDate, endDate);
  }
  heatmapConditions.push(...conditions);
  heatmapParams.push(...params);
  if (district) {
    conditions.push('LOWER(COALESCE(destination_province, "")) = LOWER(?)');
    params.push(district);
    heatmapConditions.push('LOWER(COALESCE(destination_province, "")) = LOWER(?)');
    heatmapParams.push(district);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const heatmapWhere = heatmapConditions.length ? `WHERE ${heatmapConditions.join(' AND ')}` : '';
  const format = period === 'today' ? '%H:00' : period === 'year' ? '%Y-%m' : '%Y-%m-%d';
  const sql = `
    SELECT 
      COUNT(*) as total_orders,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN shipping_fee ELSE 0 END), 0) as total_revenue,
      SUM(CASE WHEN status IN ('pending', 'picking', 'picked_up', 'at_origin_warehouse', 'transferring_to_central', 'at_central_warehouse', 'transferring_to_destination', 'at_destination_warehouse') THEN 1 ELSE 0 END) as pending_orders,
      SUM(CASE WHEN status = 'delivering' THEN 1 ELSE 0 END) as delivering_orders,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
      SUM(CASE WHEN status IN ('returning', 'cancelled') THEN 1 ELSE 0 END) as failed_orders
    FROM orders
    ${whereClause}
  `;
  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    const heatmapSql = `
      SELECT destination_province AS district, COUNT(*) AS order_count,
        AVG(receiver_lat) AS lat, AVG(receiver_lng) AS lng
      FROM orders ${heatmapWhere}
      GROUP BY destination_province
      ORDER BY order_count DESC
    `;
    const timelineSql = `
      SELECT DATE_FORMAT(created_at, ?) AS label,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN shipping_fee ELSE 0 END), 0) AS revenue
      FROM orders ${whereClause}
      GROUP BY label ORDER BY MIN(created_at)
    `;
    db.query(heatmapSql, heatmapParams, (heatErr, heatmap) => {
      if (heatErr) return res.status(500).json({ success: false, message: heatErr.sqlMessage });
      db.query(timelineSql, [format, ...params], (timelineErr, timeline) => {
        if (timelineErr) return res.status(500).json({ success: false, message: timelineErr.sqlMessage });
        res.json({ success: true, data: { ...results[0], heatmap, revenue_timeline: timeline } });
      });
    });
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
  const createdBy = Number(req.authUser.id);
  const department = String(req.body.department || '').trim();
  const title = String(req.body.title || '').trim();
  const content = String(req.body.content || '').trim();
  const allowedDepartments = new Set(['Phòng Tài Chính', 'Phòng Điều Phối', 'Phòng Kho', 'Phòng Nhân Sự', 'Phòng Nội Dung']);
  if (!Number.isInteger(createdBy) || !allowedDepartments.has(department)
    || !title || title.length > 255 || !content || content.length > 10000) {
    removeReportUpload(req.file);
    return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin báo cáo.' });
  }
  const attachmentUrl = req.file ? `/uploads/${req.file.filename}` : null;
  const sql = 'INSERT INTO department_reports (created_by, department, title, content, attachment_url, status) VALUES (?, ?, ?, ?, ?, "pending")';
  db.query(sql, [createdBy, department, title, content, attachmentUrl], (err, result) => {
    if (err) {
      console.error("Lỗi Database khi gửi báo cáo:", err);
      return res.status(500).json({ success: false, message: 'Lỗi MySQL: ' + err.sqlMessage });
    }
    res.json({ success: true, message: 'Đã gửi báo cáo cho Giám đốc!', reportId: result.insertId });
  });
});

function removeReportUpload(file) {
  if (!file) return;
  fs.unlink(file.path, (err) => {
    if (err && err.code !== 'ENOENT') console.error('Không thể xóa tệp báo cáo không hợp lệ:', err);
  });
}

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