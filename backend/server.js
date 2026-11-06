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
const { query: queryAsync, withTransaction } = require('./utils/db');
const {
  OrderTransitionError,
  isDeliveryStartAlreadyApplied,
  transitionOrder,
  processPickupFailure,
  processDeliveryFailure
} = require('./services/orderStateMachine');
const { reviewShopRedeliveryRequest } = require('./services/shopRedelivery');
const { shopOrderScope } = require('./services/shopOrderScope');
const {
  createDriverRemittance,
  receiveDriverRemittance,
  createShopSettlement,
  setOrderFailureFee,
  depositDriverWallet
} = require('./services/codFinance');
const { FAILURE_REASON_BY_INCIDENT, resolveIncident } = require('./services/incidentResolution');
const {
  addMoney,
  calculatePercentage,
  formatMoney,
  multiplyMoney,
  parseMoney,
  subtractMoney
} = require('./utils/money');
const { calculateShippingPrice, selectEffectiveRate, snapshotRate } = require('./services/shippingPricing');
const { closePayrollPeriod, payrollError, validMonth } = require('./services/payroll');
const { insertOrderItems, normalizeOrderItems, applyDeliveryItemScans } = require('./services/orderItems');
const { reverseGeocodeGovap } = require('./services/reverseGeocode');
const {
  chatTokenTtlHours,
  createGuestChatToken,
  createRateLimiter,
  createRateLimitMiddleware,
  hashChatToken,
  isMatchingChatToken,
  positiveInteger,
  redactPublicTrackingOrder
} = require('./services/chatSecurity');
const { openOrderChatSession } = require('./services/chatSessions');
const { normalizeShopRegistration } = require('./services/shopRegistration');
const {
  getRouteDeviationMeters,
  optimizeRoute,
  groupStops,
  measureOrderedRoute
} = require('./services/routeOptimizer');
const { getDriverRouteScope, getRouteApiRoles } = require('./services/routeAuthorization');
const {
  createLoginLockout,
  parseLoginLockoutSettings
} = require('./services/loginLockout');
const { isDemoModeEnabled } = require('./services/demoMode');

const JWT_SECRET = process.env.JWT_SECRET?.trim();
const scrypt = promisify(crypto.scrypt);
const PASSWORD_HASH_PREFIX = 'scrypt';
if (!JWT_SECRET) {
  console.error('Thiếu JWT_SECRET. Hãy cấu hình trong backend/.env trước khi khởi động máy chủ.');
  process.exit(1);
}
const { findGovapWard, isWithinGovapServiceArea, wards: govapWards } = require('./utils/govapArea');
const {
  calculatePayRuleAmount,
  selectPayRule,
  sumPayRuleEarnings
} = require('./services/payRuleCalculator');

const app = express();
app.use(cors());
app.use(express.json());
const demoModeEnabled = isDemoModeEnabled(process.env);
const publicRateLimitWindowMs = positiveInteger(process.env.PUBLIC_API_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
const publicTrackingRateLimitIp = positiveInteger(process.env.PUBLIC_TRACK_RATE_LIMIT_IP, 60);
const publicTrackingRateLimitOrder = positiveInteger(process.env.PUBLIC_TRACK_RATE_LIMIT_ORDER, 20);
const publicTrackingRateLimiter = createRateLimiter({ windowMs: publicRateLimitWindowMs });
const publicChatRateLimiter = createRateLimiter({ windowMs: publicRateLimitWindowMs });
const publicRegistrationRateLimiter = createRateLimiter({ windowMs: publicRateLimitWindowMs });
const loginLockout = createLoginLockout();
const limitPublicRegistrations = demoModeEnabled
  ? (_req, _res, next) => next()
  : createRateLimitMiddleware({
    limiter: publicRegistrationRateLimiter,
    scope: 'shop-registration',
    ipLimit: positiveInteger(process.env.PUBLIC_REGISTER_RATE_LIMIT_IP, 5),
    resourceLimit: positiveInteger(process.env.PUBLIC_REGISTER_RATE_LIMIT_EMAIL, 3),
    getResource: (req) => String(req.body.email || '').trim().toLowerCase()
  });
const trackPublicRequest = createRateLimitMiddleware({
  limiter: publicTrackingRateLimiter,
  scope: 'tracking',
  ipLimit: publicTrackingRateLimitIp,
  resourceLimit: publicTrackingRateLimitOrder,
  getResource: (req) => String(req.params.code || '').trim().toUpperCase()
});
const limitPublicChatSessions = createRateLimitMiddleware({
  limiter: publicChatRateLimiter,
  scope: 'chat-session',
  ipLimit: positiveInteger(process.env.PUBLIC_CHAT_RATE_LIMIT_IP, 20),
  resourceLimit: positiveInteger(process.env.PUBLIC_CHAT_RATE_LIMIT_ORDER, 5),
  getResource: (req) => String(req.body.tracking_code || '').trim().toUpperCase()
});
const limitPublicChatImages = createRateLimitMiddleware({
  limiter: publicChatRateLimiter,
  scope: 'chat-image',
  ipLimit: positiveInteger(process.env.PUBLIC_CHAT_IMAGE_RATE_LIMIT_IP, 60),
  resourceLimit: positiveInteger(process.env.PUBLIC_CHAT_IMAGE_RATE_LIMIT_SESSION, 30),
  getResource: (req) => String(req.params.id || '')
});

const chatAgentRoles = new Set([
  'admin', 'director', 'customer_service', 'customer_support', 'cskh', 'support',
  'fleet_manager', 'fleet', 'coordinator', 'dispatcher', 'dieu_hanh'
]);
const driverRoles = new Set(['pickup_driver', 'delivery_driver']);
const staffRoles = new Set([
  'pickup_driver', 'delivery_driver', 'warehouse_manager', 'fleet_manager',
  'linehaul_driver', 'accountant', 'hr_manager', 'director', 'shop', 'content_manager', 'customer_service'
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
    db.query(
      `SELECT u.id, u.email, u.full_name, u.role, u.warehouse_id, w.warehouse_type
       FROM users u
       LEFT JOIN warehouses w ON w.id = u.warehouse_id
       WHERE u.id = ? AND u.status = "active" LIMIT 1`,
      [payload.sub],
      (err, users) => {
      if (err) return res.status(500).json({ success: false, message: 'Không thể xác thực tài khoản.' });
      if (!users.length) return res.status(401).json({ success: false, message: 'Tài khoản không còn hoạt động.' });
      req.authUser = users[0];
      next();
      }
    );
  });
};
const publicApiRequest = (req) => {
  const method = req.method.toUpperCase();
  const route = req.path;
  return (method === 'POST' && [
    '/api/login',
    '/api/register',
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
      || route === '/api/pricing/estimate'
      || /^\/api\/orders\/track\/[^/]+$/.test(route)
      || /^\/api\/chat\/sessions\/\d+\/messages$/.test(route)
    ))
    || (method === 'POST' && /^\/api\/chat\/sessions\/\d+\/images$/.test(route));
};
const apiRolesForRequest = (req) => {
  const method = req.method.toUpperCase();
  const route = req.path;
  const routeRoles = getRouteApiRoles(route, method);
  if (routeRoles) return routeRoles;
  if (route === '/api/map/reverse') return new Set(['shop']);
  if (route === '/api/map/route') {
    return new Set(['shop', 'warehouse_manager', 'fleet_manager', 'director', ...driverRoles]);
  }
  if (route === '/api/shop/profile' && ['GET', 'PUT'].includes(method)) return new Set(['shop']);
  if (route.startsWith('/api/shop/integrations')) return new Set(['shop']);
  if (route === '/api/dispatcher/rma' || /^\/api\/dispatcher\/rma\/\d+$/.test(route)) {
    return new Set(['fleet_manager', 'director']);
  }
  if (route === '/api/dispatcher/driver-profiles' || /^\/api\/dispatcher\/driver-profiles\/\d+$/.test(route)
    || route === '/api/dispatcher/auto-dispatch/preview') return new Set(['fleet_manager', 'director']);
  if (route === '/api/dispatcher/incidents') {
    return new Set(['fleet_manager', 'director', 'accountant', 'warehouse_manager']);
  }
  if (/^\/api\/dispatcher\/incidents\/\d+$/.test(route)) {
    return new Set(['fleet_manager', 'director', 'accountant']);
  }
  if (route === '/api/dispatcher/route-stops/optimize') return new Set(['fleet_manager', 'director']);
  if (route === '/api/accountant/reports') return new Set(['accountant', 'director']);
  if (route === '/api/chat/sessions' && method === 'GET'
    || /^\/api\/chat\/sessions\/\d+\/(context|close)$/.test(route)) return chatAgentRoles;
  if (route.startsWith('/api/admin/')) return new Set(['director']);
  if (route.startsWith('/api/accountant/')) return new Set(['accountant', 'director']);
  if (route === '/api/hr/leave' && method === 'POST') return new Set([...staffRoles].filter((role) => role !== 'customer'));
  if (route.startsWith('/api/hr/')) return new Set(['hr_manager', 'director']);
  if (route === '/api/news/admin' || route.startsWith('/api/news/') && method !== 'GET'
    || route === '/api/news' && method !== 'GET') return new Set(['content_manager', 'director']);
  if (route === '/api/notifications' || route.startsWith('/api/notifications/')) return staffRoles;
  if (route === '/api/warehouses' && method === 'GET') return new Set([...staffRoles, 'hr_manager']);
  if (route === '/api/warehouses' && method === 'POST') return new Set(['director', 'warehouse_manager']);
  if (route === '/api/warehouses' || route.startsWith('/api/warehouses/')) return new Set(['director']);
  if (route === '/api/trucks' && method === 'GET') return new Set(['fleet_manager', 'director', 'warehouse_manager']);
  if (route === '/api/linehaul/trips' && method === 'POST'
    || /^\/api\/linehaul\/trips\/\d+\/bags$/.test(route) && method === 'POST') {
    return new Set(['fleet_manager', 'director', 'warehouse_manager']);
  }
  if (route.startsWith('/api/warehouse/') || route === '/api/warehouse') return new Set(['warehouse_manager', 'fleet_manager', 'director']);
  if (route === '/api/warehouse/routes') return new Set(['warehouse_manager', 'fleet_manager', 'director']);
  if (route === '/api/linehaul/trips' && method === 'GET') return new Set(['warehouse_manager', 'fleet_manager', 'director']);
  if (route.startsWith('/api/linehaul/')) return new Set(['fleet_manager', 'director']);
  if (route === '/api/shippers') return new Set(['warehouse_manager', 'fleet_manager', 'director']);
  if (route === '/api/driver/live') return new Set(['warehouse_manager', 'fleet_manager', 'director']);
  if (route === '/api/trucks' || /^\/api\/trucks\/\d+$/.test(route)) return new Set(['fleet_manager', 'director']);
  if (route === '/api/driver/trips' || route === '/api/driver/trips/scan'
    || /^\/api\/driver\/trips\/\d+\/(start|arrive|location)$/.test(route)) return new Set(['linehaul_driver']);
  if (route === '/api/driver/payroll/estimate'
    || route === '/api/driver/location' || route.startsWith('/api/driver/wallet/')
    || route === '/api/driver/cash-remittances' || route === '/api/driver/incidents'
    || route === '/api/driver/expense-claims' || route === '/api/driver/route-stops'
    || /^\/api\/driver\/orders\/\d+\/chat$/.test(route)) return driverRoles;
  if (route === '/api/orders' && method === 'GET') {
    return new Set(['shop', 'warehouse_manager', 'fleet_manager', 'accountant', 'director']);
  }
  if (route === '/api/orders' && method === 'POST') return new Set(['shop']);
  if (/^\/api\/orders\/\d+\/assign$/.test(route)) return new Set(['fleet_manager', 'director', 'warehouse_manager']);
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
  if (req.path.startsWith('/api/linehaul/')
    || req.path.startsWith('/api/driver/trips')
    || req.path.startsWith('/api/warehouse/bags')
    || req.path.startsWith('/api/warehouse/linehaul')
    || req.path === '/api/warehouse/routes'
    || req.path === '/api/warehouses' && req.method !== 'GET'
    || req.path.startsWith('/api/warehouses/')) {
    return res.status(410).json({
      success: false,
      code: 'SINGLE_GOVAP_WAREHOUSE',
      message: 'Hệ thống hiện chỉ vận hành một kho tổng tại Gò Vấp; luồng kho con và trung chuyển liên kho đã tắt.'
    });
  }
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
    if (role === 'warehouse_manager') {
      const assignedWarehouseId = Number(req.authUser.warehouse_id);
      if (!Number.isInteger(assignedWarehouseId) || assignedWarehouseId <= 0) {
        return res.status(403).json({ success: false, message: 'Tài khoản chưa được gán kho. Vui lòng liên hệ phòng Nhân sự.' });
      }
      req.warehouseScopeId = assignedWarehouseId;
      if (req.body.warehouse_id !== undefined) req.body.warehouse_id = assignedWarehouseId;
      if (req.body.source_warehouse_id !== undefined) req.body.source_warehouse_id = assignedWarehouseId;
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
// Mở quyền truy cập file tĩnh để Frontend load được ảnh minh chứng
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Tự động tạo thư mục chứa ảnh nếu chưa có
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

const newsImageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const extension = file.mimetype === 'image/jpeg' ? 'jpg' : file.mimetype === 'image/webp' ? 'webp' : 'png';
    cb(null, `news-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${extension}`);
  }
});
const newsImageUpload = multer({
  storage: newsImageStorage,
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const allowedImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
      && /\.(jpe?g|png|webp)$/i.test(path.extname(file.originalname));
    if (!allowedImage) return cb(new Error('Ảnh chỉ chấp nhận định dạng JPG, PNG hoặc WEBP.'));
    cb(null, true);
  }
});
const chatImageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const extension = file.mimetype === 'image/jpeg' ? 'jpg' : file.mimetype === 'image/webp' ? 'webp' : 'png';
    cb(null, `chat-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${extension}`);
  }
});
const chatImageUpload = multer({
  storage: chatImageStorage,
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const allowedImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
      && /\.(jpe?g|png|webp)$/i.test(path.extname(file.originalname));
    if (!allowedImage) return cb(new Error('Ảnh chat chỉ chấp nhận định dạng JPG, PNG hoặc WEBP.'));
    cb(null, true);
  }
});
const parseChatImage = (req, res, next) => {
  chatImageUpload.single('image')(req, res, (error) => {
    if (!error) return next();
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'Ảnh chat không được vượt quá 8 MB.'
      : error.message || 'Không thể tải ảnh chat lên.';
    return res.status(400).json({ success: false, message });
  });
};
const parseNewsImage = (req, res, next) => {
  newsImageUpload.single('image')(req, res, (error) => {
    if (error) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? 'Ảnh không được vượt quá 8 MB.'
        : error.message || 'Không thể tải ảnh lên.';
      return res.status(400).json({ success: false, message });
    }
    next();
  });
};

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
const parsePodUpload = (fields) => (req, res, next) => {
  podUpload.fields(fields)(req, res, (error) => {
    if (!error) return next();
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'Ảnh minh chứng không được vượt quá 8 MB.'
      : error.message || 'Không thể nhận ảnh minh chứng.';
    return res.status(400).json({ success: false, message });
  });
};
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
    const formatPdfMoney = (value) => `${formatMoney(value || 0)} đ`;
    const columns = [
      { label: 'Mã vận đơn', width: 118 },
      { label: 'COD', width: 76 },
      { label: 'Cước Shop', width: 90 },
      { label: 'Dịch vụ', width: 83 },
      { label: 'Bảo hiểm', width: 78 },
      { label: 'Phí lỗi', width: 55 }
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
        formatPdfMoney(order.cod_amount),
        formatPdfMoney(order.fee_payer === 'sender' ? order.shipping_fee : 0),
        formatPdfMoney(order.service_fee),
        formatPdfMoney(order.insurance_fee),
        formatPdfMoney(order.failure_fee)
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
      if (summary.cycle_code) doc.text(`Chu kỳ: ${summary.cycle_code} · ${summary.period_start || ''} - ${summary.period_end || ''}`);
      doc.moveDown();
      doc.fontSize(11).text('CHI TIẾT VẬN ĐƠN', { underline: true });
      doc.moveDown(0.5);
      drawTableHeader();
      orders.forEach(drawOrderRow);
      doc.moveDown();
      if (doc.y + 120 > pageBottom()) doc.addPage();
      doc.fontSize(10).text(`Tổng COD: ${formatPdfMoney(summary.total_cod)}`, { align: 'right' });
      doc.text(`Cước Shop trả: -${formatPdfMoney(summary.total_shipping_fee)}`, { align: 'right' });
      doc.text(`Phí dịch vụ: -${formatPdfMoney(summary.total_service_fee)}`, { align: 'right' });
      doc.text(`Phí bảo hiểm: -${formatPdfMoney(summary.total_insurance_fee)}`, { align: 'right' });
      doc.text(`Phí giao thất bại: -${formatPdfMoney(summary.total_failure_fee)}`, { align: 'right' });
      doc.moveDown(0.5);
      doc.fontSize(13).fillColor('#047857').text(`TIỀN SHOP NHẬN: ${formatPdfMoney(summary.total_paid)}`, { align: 'right' });
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
    if (!socket.data.authUser && trackingCode) {
      const rateLimit = publicTrackingRateLimiter.consume({
        scope: 'tracking',
        ip: socket.handshake.address,
        resource: trackingCode,
        ipLimit: publicTrackingRateLimitIp,
        resourceLimit: publicTrackingRateLimitOrder
      });
      if (!rateLimit.allowed) {
        return acknowledge({
          success: false,
          code: 'RATE_LIMITED',
          retry_after_seconds: rateLimit.retryAfterSeconds,
          message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.'
        });
      }
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
    db.query('SELECT id, guest_token_hash, expires_at, driver_id, status FROM chat_sessions WHERE id = ? LIMIT 1', [sessionId], (err, sessions) => {
      if (err) return acknowledge({ success: false, message: 'Không thể mở phiên chat.' });
      const session = sessions[0];
      const agent = socket.data.authUser && chatAgentRoles.has(String(socket.data.authUser.role || '').toLowerCase());
      const driver = socket.data.authUser && Number(session?.driver_id) === Number(socket.data.authUser.id)
        && driverRoles.has(normalizeRole(socket.data.authUser.role));
      if (!session || (!agent && !driver && !isMatchingChatToken(
        data.guest_token, session.guest_token_hash, session.expires_at
      ))) {
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
    db.query('SELECT id, guest_token_hash, expires_at, driver_id, status FROM chat_sessions WHERE id = ? LIMIT 1', [sessionId], (err, sessions) => {
      if (err) return acknowledge({ success: false, message: 'Không thể gửi tin nhắn.' });
      const session = sessions[0];
      const agent = socket.data.authUser && chatAgentRoles.has(String(socket.data.authUser.role || '').toLowerCase());
      const driver = socket.data.authUser && Number(session?.driver_id) === Number(socket.data.authUser.id)
        && driverRoles.has(normalizeRole(socket.data.authUser.role));
      if (!session || (!agent && !driver && !isMatchingChatToken(
        data.guest_token, session.guest_token_hash, session.expires_at
      ))) {
        return acknowledge({ success: false, message: 'Không có quyền gửi tin trong phiên chat này.' });
      }
      if (session.status === 'closed') return acknowledge({ success: false, message: 'Phiên chat đã kết thúc.' });
      const senderType = agent ? 'agent' : driver ? 'driver' : 'customer';
      const senderId = agent || driver ? socket.data.authUser.id : null;
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
            sender_name: agent || driver ? socket.data.authUser.full_name : null,
            message,
            created_at: new Date().toISOString()
          };
          db.query('UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [sessionId], (updateErr) => {
            if (updateErr) console.error('Không thể cập nhật thời gian phiên chat:', updateErr);
            io.to(`chat:${sessionId}`).emit('receive_message', savedMessage);
            if (!session.driver_id) io.to('support_agents').emit('chat_session_updated', { session_id: sessionId, status: 'active' });
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
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smart_logistics_v2'
};
const db = mysql.createPool(dbConfig);
const transactionPool = db;

async function getCentralWarehouseId(connection, lockRow = false) {
  const settings = await queryAsync(
    connection,
    `SELECT setting_value FROM system_settings
     WHERE setting_key = 'central_warehouse_id' LIMIT 1${lockRow ? ' FOR UPDATE' : ''}`
  );
  const centralWarehouseId = Number(settings[0]?.setting_value);
  if (!Number.isInteger(centralWarehouseId) || centralWarehouseId <= 0) {
    throw new OrderTransitionError(
      'CENTRAL_WAREHOUSE_NOT_CONFIGURED',
      'Chưa cấu hình kho tổng Gò Vấp. Hãy chạy migration 002 trước.',
      503
    );
  }
  const warehouses = await queryAsync(
    connection,
    `SELECT id FROM warehouses
     WHERE id = ? AND warehouse_type = 'central' AND is_active = 1 AND is_configured = 1
     LIMIT 1${lockRow ? ' FOR UPDATE' : ''}`,
    [centralWarehouseId]
  );
  if (!warehouses.length) {
    throw new OrderTransitionError(
      'CENTRAL_WAREHOUSE_NOT_CONFIGURED',
      'Kho tổng đã cấu hình không tồn tại hoặc chưa hoạt động.',
      503
    );
  }
  return centralWarehouseId;
}

function normalizeBlacklistAddress(value) {
  const normalized = String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return normalized ? crypto.createHash('sha256').update(normalized).digest('hex') : '';
}

function normalizeBlacklistPhone(value) {
  return String(value || '').replace(/[\s().-]/g, '');
}

async function updateBombBlacklist(connection, { orderId, phone, address }) {
  const entries = [
    { entryType: 'phone', normalizedValue: normalizeBlacklistPhone(phone) },
    { entryType: 'address', normalizedValue: normalizeBlacklistAddress(address) }
  ];
  for (const entry of entries) {
    if (!entry.normalizedValue) continue;
    await queryAsync(
      connection,
      `INSERT IGNORE INTO order_bomb_incidents (order_id, entry_type, normalized_value)
       VALUES (?, ?, ?)`,
      [orderId, entry.entryType, entry.normalizedValue]
    );
    const incidentCounts = await queryAsync(
      connection,
      `SELECT COUNT(DISTINCT order_id) AS occurrence_count
       FROM order_bomb_incidents
       WHERE entry_type = ? AND normalized_value = ?`,
      [entry.entryType, entry.normalizedValue]
    );
    entry.occurrences = Number(incidentCounts[0]?.occurrence_count || 0);
    if (entry.occurrences < 2) continue;
    await queryAsync(
      connection,
      `INSERT INTO order_blacklist
        (entry_type, normalized_value, occurrence_count, source_reason_code, last_order_id)
       VALUES (?, ?, ?, 'DL_BOMB', ?)
       ON DUPLICATE KEY UPDATE occurrence_count = GREATEST(occurrence_count, VALUES(occurrence_count)),
         source_reason_code = VALUES(source_reason_code), last_order_id = VALUES(last_order_id)`,
      [entry.entryType, entry.normalizedValue, entry.occurrences, orderId]
    );
  }
}

function respondWithTransitionError(res, error, messagePrefix = 'Không thể cập nhật trạng thái đơn.') {
  if (error instanceof OrderTransitionError) {
    return res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
  }
  if (Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode < 600) {
    return res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
  }
  console.error(messagePrefix, error);
  return res.status(500).json({
    success: false,
    message: `${messagePrefix} ${error.sqlMessage || error.message || ''}`.trim()
  });
}

async function reserveDriverWalletInTransaction(conn, driverId, orderId, amount, actor = null, ip = null) {
  const reserveAmountVnd = parseMoney(amount);
  if (reserveAmountVnd <= 0n) return;
  const reserveAmount = reserveAmountVnd.toString();
  const wallets = await queryAsync(
    conn,
    'SELECT balance, reserved_balance FROM driver_wallets WHERE driver_id = ? FOR UPDATE',
    [driverId]
  );
  const availableVnd = wallets.length
    ? subtractMoney(wallets[0].balance, wallets[0].reserved_balance, { allowNegative: true })
    : 0n;
  if (availableVnd < reserveAmountVnd) {
    throw new OrderTransitionError(
      'INSUFFICIENT_WALLET',
      `Tài xế không đủ ký quỹ khả dụng. Cần ${formatMoney(reserveAmountVnd)} đ, hiện có ${formatMoney(availableVnd > 0n ? availableVnd : 0n)} đ.`,
      409
    );
  }
  try {
    await queryAsync(
      conn,
      'INSERT INTO driver_wallet_reservations (order_id, driver_id, amount) VALUES (?, ?, ?)',
      [orderId, driverId, reserveAmount]
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new OrderTransitionError(
        'WALLET_BUSY',
        'Đơn hàng hoặc ký quỹ của tài xế đã được xử lý. Tải lại và kiểm tra trước khi phân công lại.',
        409
      );
    }
    throw error;
  }
  await queryAsync(
    conn,
    'UPDATE driver_wallets SET reserved_balance = reserved_balance + ? WHERE driver_id = ?',
    [reserveAmount, driverId]
  );
  await queryAsync(
    conn,
    `INSERT INTO driver_wallet_transactions (driver_id, order_id, transaction_type, amount, note)
     VALUES (?, ?, 'reserve', ?, 'Giữ ký quỹ khi phân công đơn COD')`,
    [driverId, orderId, reserveAmount]
  );
  if (actor) {
    await queryAsync(conn, `INSERT INTO audit_logs
      (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, ip)
      VALUES (?, ?, 'driver_wallet.reserve', 'driver_wallet_reservation', ?, ?, ?, ?)`,
    [Number(actor.id), actor.role, String(orderId), JSON.stringify({ status: null }),
      JSON.stringify({ driver_id: driverId, amount: reserveAmount, status: 'reserved' }), ip]);
  }
}

async function releaseDriverWalletReservationInTransaction(conn, orderId, note, actor = null, ip = null) {
  const reservations = await queryAsync(
    conn,
    'SELECT driver_id, amount FROM driver_wallet_reservations WHERE order_id = ? AND status = "reserved" LIMIT 1 FOR UPDATE',
    [orderId]
  );
  if (!reservations.length) return;
  const reservation = reservations[0];
  const wallets = await queryAsync(
    conn,
    'SELECT reserved_balance FROM driver_wallets WHERE driver_id = ? FOR UPDATE',
    [reservation.driver_id]
  );
  if (!wallets.length || parseMoney(wallets[0].reserved_balance) < parseMoney(reservation.amount)) {
    throw new OrderTransitionError('WALLET_RESERVATION_INCONSISTENT', 'Số dư ký quỹ đang giữ nhỏ hơn reservation của đơn.', 409);
  }
  const released = await queryAsync(
    conn,
    'UPDATE driver_wallet_reservations SET status = "released", released_at = CURRENT_TIMESTAMP WHERE order_id = ? AND status = "reserved"',
    [orderId]
  );
  if (!released.affectedRows) return;
  await queryAsync(
    conn,
    'UPDATE driver_wallets SET reserved_balance = reserved_balance - ? WHERE driver_id = ?',
    [reservation.amount, reservation.driver_id]
  );
  await queryAsync(
    `INSERT INTO driver_wallet_transactions (driver_id, order_id, transaction_type, amount, note)
     VALUES (?, ?, 'release', ?, ?)`,
    [reservation.driver_id, orderId, reservation.amount, String(note || 'Giải phóng ký quỹ').slice(0, 255)]
  );
  if (actor) {
    await queryAsync(conn, `INSERT INTO audit_logs
      (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, ip)
      VALUES (?, ?, 'driver_wallet_reservation.release', 'driver_wallet_reservation', ?, ?, ?, ?)`,
    [Number(actor.id), actor.role, String(orderId),
      JSON.stringify({ status: 'reserved', amount: reservation.amount }),
      JSON.stringify({ status: 'released', amount: reservation.amount }), ip]);
  }
}

db.getConnection((err, connection) => {
  if (err) {
    console.error('Lỗi kết nối CSDL:', err);
    return;
  }
  connection.release();
  console.log('Đã kết nối Database: smart_logistics_v2 🚀');

  db.query('ALTER TABLE users ADD COLUMN warehouse_id INT NULL', (alterErr) => {
    if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
      console.error('Lỗi bổ sung kho được phân công cho tài khoản:', alterErr);
    }
  });
  db.query("SHOW COLUMNS FROM orders LIKE 'delivery_otp'", (columnErr, columns) => {
    if (columnErr) {
      if (columnErr.code !== 'ER_NO_SUCH_TABLE') console.error('Lỗi kiểm tra cột OTP giao hàng cũ:', columnErr);
      return;
    }
    if (!columns.length) return;
    db.query('ALTER TABLE orders DROP COLUMN delivery_otp', (dropErr) => {
      if (dropErr) console.error('Lỗi gỡ cột OTP giao hàng cũ:', dropErr);
    });
  });
  [
    ['phone', 'VARCHAR(50) DEFAULT NULL'],
    ['shop_address', 'TEXT DEFAULT NULL'],
    ['shop_province', "VARCHAR(255) DEFAULT 'TP. Hồ Chí Minh'"],
    ['shop_lat', 'DOUBLE DEFAULT NULL'],
    ['shop_lng', 'DOUBLE DEFAULT NULL']
  ].forEach(([column, definition]) => {
    db.query(`ALTER TABLE users ADD COLUMN ${column} ${definition}`, (alterErr) => {
      if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
        console.error(`Lỗi bổ sung thông tin hồ sơ Shop (${column}):`, alterErr);
      }
    });
  });
  db.query('ALTER TABLE linehaul_trips ADD COLUMN truck_id INT NULL', (alterErr) => {
    if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME' && alterErr.code !== 'ER_NO_SUCH_TABLE') {
      console.error('Lỗi bổ sung xe tải cho chuyến line-haul:', alterErr);
    }
  });
  db.query('ALTER TABLE linehaul_trips MODIFY status ENUM("planned","loading","in_transit","arrived","completed","cancelled") NOT NULL DEFAULT "planned"', (alterErr) => {
    if (alterErr && alterErr.code !== 'ER_NO_SUCH_TABLE') {
      console.error('Lỗi cập nhật trạng thái chuyến line-haul:', alterErr);
    }
  });

  const setupTables = [
    `
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        mode ENUM('ai','live') NOT NULL,
        customer_user_id INT DEFAULT NULL,
        order_id INT DEFAULT NULL,
        driver_id INT DEFAULT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(50) DEFAULT NULL,
        guest_token_hash CHAR(64) NOT NULL,
        expires_at DATETIME NOT NULL,
        status ENUM('waiting','active','closed') NOT NULL DEFAULT 'waiting',
        assigned_agent_id INT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_chat_sessions_queue (mode, status, updated_at),
        KEY idx_chat_sessions_agent (assigned_agent_id, status),
        KEY idx_chat_sessions_order_driver (order_id, driver_id, status),
        KEY idx_chat_sessions_expiry (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS linehaul_trip_positions (
        trip_id BIGINT PRIMARY KEY,
        driver_id INT NOT NULL,
        lat DOUBLE NOT NULL,
        lng DOUBLE NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_linehaul_position_driver (driver_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS chat_messages (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        session_id BIGINT NOT NULL,
        sender_type ENUM('customer','agent','driver','bot') NOT NULL,
        sender_id INT DEFAULT NULL,
        message TEXT NOT NULL,
        image_url VARCHAR(500) DEFAULT NULL,
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
        warehouse_lat DOUBLE DEFAULT 10.8231,
        warehouse_lng DOUBLE DEFAULT 106.6881,
        pickup_lat DOUBLE DEFAULT 10.8231,
        pickup_lng DOUBLE DEFAULT 106.6881,
        delivery_lat DOUBLE DEFAULT 10.8231,
        delivery_lng DOUBLE DEFAULT 106.6881,
        route_status VARCHAR(50) DEFAULT 'assigned',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS driver_route_stops (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        driver_id INT NOT NULL,
        order_id INT NOT NULL,
        task_type ENUM('pickup','delivery','return') NOT NULL,
        stop_order INT NOT NULL,
        lat DOUBLE NOT NULL,
        lng DOUBLE NOT NULL,
        address TEXT NOT NULL,
        status ENUM('planned','completed') NOT NULL DEFAULT 'planned',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_driver_route_stop (driver_id, task_type, order_id),
        KEY idx_driver_route_stop_order (driver_id, task_type, stop_order, status)
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
        max_order_value DECIMAL(15,0) NOT NULL DEFAULT 0,
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
        total_cod DECIMAL(15,0) NOT NULL DEFAULT 0,
        total_shipping_fee DECIMAL(15,0) NOT NULL DEFAULT 0,
        total_service_fee DECIMAL(15,0) NOT NULL DEFAULT 0,
        total_insurance_fee DECIMAL(15,0) NOT NULL DEFAULT 0,
        total_paid DECIMAL(15,0) NOT NULL DEFAULT 0,
        order_count INT NOT NULL DEFAULT 0,
        payment_method ENUM('bank_transfer','cash') NOT NULL DEFAULT 'bank_transfer',
        payment_reference VARCHAR(100) DEFAULT NULL,
        paid_by INT DEFAULT NULL,
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
      CREATE TABLE IF NOT EXISTS trucks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vehicle_plate VARCHAR(30) NOT NULL UNIQUE,
        max_payload_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
        status ENUM('ready','in_transit','maintenance') NOT NULL DEFAULT 'ready',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_trucks_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS linehaul_trips (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        trip_code VARCHAR(40) NOT NULL UNIQUE,
        vehicle_plate VARCHAR(30) NOT NULL,
        truck_id INT DEFAULT NULL,
        driver_id INT DEFAULT NULL,
        source_warehouse_id INT NOT NULL,
        destination_warehouse_id INT NOT NULL,
        status ENUM('planned','loading','in_transit','arrived','completed','cancelled') NOT NULL DEFAULT 'planned',
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
        amount DECIMAL(15,0) NOT NULL,
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
        amount DECIMAL(15,0) NOT NULL,
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
        balance DECIMAL(15,0) NOT NULL DEFAULT 0,
        reserved_balance DECIMAL(15,0) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS driver_wallet_reservations (
        order_id INT PRIMARY KEY,
        driver_id INT NOT NULL,
        amount DECIMAL(15,0) NOT NULL,
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
        transaction_type ENUM('deposit','reserve','release','deduction') NOT NULL,
        amount DECIMAL(15,0) NOT NULL,
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
        order_id INT DEFAULT NULL,
        incident_type ENUM('accident','vehicle_breakdown','traffic','wrong_item','customer_absent','damaged_goods','lost_goods','other') NOT NULL,
        description TEXT NOT NULL,
        evidence_url VARCHAR(255) DEFAULT NULL,
        claim_amount DECIMAL(15,0) NOT NULL DEFAULT 0,
        lat DOUBLE DEFAULT NULL,
        lng DOUBLE DEFAULT NULL,
        status ENUM('open','acknowledged','resolved') NOT NULL DEFAULT 'open',
        reviewed_by INT DEFAULT NULL,
        review_note VARCHAR(500) DEFAULT NULL,
        resolved_at DATETIME DEFAULT NULL,
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
        amount DECIMAL(15,0) NOT NULL,
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
        monthly_salary DECIMAL(15,0) NOT NULL DEFAULT 0,
        allowance DECIMAL(15,0) NOT NULL DEFAULT 0,
        bonus_per_delivery DECIMAL(15,0) NOT NULL DEFAULT 0,
        commission_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
        tenure_raise_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `,
    `
      CREATE TABLE IF NOT EXISTS employee_payroll_adjustments (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        payroll_month CHAR(7) NOT NULL,
        adjustment_type ENUM('bonus','deduction') NOT NULL,
        amount DECIMAL(15,0) NOT NULL,
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
           VALUES ('central', '__CENTRAL__', 'Kho tổng Gò Vấp', 'Số 2 Nguyễn Văn Bảo, Gò Vấp, TP. Hồ Chí Minh', 10.8231, 106.6881, 1, 1)
           ON DUPLICATE KEY UPDATE warehouse_type = VALUES(warehouse_type)`,
          (warehouseErr) => {
            if (warehouseErr) console.error('Lỗi tạo kho tổng:', warehouseErr);
            if (!warehouseErr) {
              db.query(
                `UPDATE users u
                 JOIN warehouses w ON w.warehouse_type = 'central' AND w.ward_name = '__CENTRAL__'
                 SET u.warehouse_id = w.id
                 WHERE u.email = 'kho@smartlogistics.vn'
                   AND u.role = 'warehouse_manager'
                   AND u.warehouse_id IS NULL`,
                (assignErr) => {
                  if (assignErr) console.error('Lỗi gán tài khoản thủ kho mẫu vào Kho Tổng:', assignErr);
                }
              );
            }
          }
        );
      }
    });
  });

  [
    ['chat_sessions', 'order_id', 'INT NULL'],
    ['chat_sessions', 'driver_id', 'INT NULL'],
    ['driver_dispatch_profiles', 'max_order_value', 'DECIMAL(15,0) NOT NULL DEFAULT 0'],
    ['cod_settlements', 'payment_method', "ENUM('bank_transfer','cash') NOT NULL DEFAULT 'bank_transfer'"],
    ['cod_settlements', 'payment_reference', 'VARCHAR(100) NULL'],
    ['cod_settlements', 'paid_by', 'INT NULL'],
    ['driver_incidents', 'order_id', 'INT NULL'],
    ['driver_incidents', 'evidence_url', 'VARCHAR(255) NULL'],
    ['driver_incidents', 'claim_amount', 'DECIMAL(15,0) NOT NULL DEFAULT 0'],
    ['driver_incidents', 'reviewed_by', 'INT NULL'],
    ['driver_incidents', 'review_note', 'VARCHAR(500) NULL'],
    ['driver_incidents', 'resolved_at', 'DATETIME NULL'],
    ['employee_salaries', 'commission_rate', 'DECIMAL(5,2) NOT NULL DEFAULT 0'],
    ['employee_salaries', 'tenure_raise_percent', 'DECIMAL(5,2) NOT NULL DEFAULT 0']
  ].forEach(([table, column, definition]) => {
    db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, (alterErr) => {
      if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME' && alterErr.code !== 'ER_NO_SUCH_TABLE') {
        console.error(`Lỗi bổ sung cột ${column} cho ${table}:`, alterErr);
      }
    });
  });
  db.query(
    `ALTER TABLE chat_sessions ADD INDEX idx_chat_sessions_order_driver (order_id, driver_id, status)`,
    (alterErr) => {
      if (alterErr && alterErr.code !== 'ER_DUP_KEYNAME' && alterErr.code !== 'ER_NO_SUCH_TABLE') {
        console.error('Lỗi bổ sung chỉ mục chat theo đơn:', alterErr);
      }
    }
  );
  db.query(
    `ALTER TABLE chat_messages MODIFY sender_type ENUM('customer','agent','driver','bot') NOT NULL`,
    (alterErr) => {
      if (alterErr && alterErr.code !== 'ER_NO_SUCH_TABLE') {
        console.error('Lỗi cập nhật loại người gửi tin nhắn:', alterErr);
      }
    }
  );
  db.query(
    `ALTER TABLE driver_wallet_transactions MODIFY transaction_type ENUM('deposit','reserve','release','deduction') NOT NULL`,
    (alterErr) => {
      if (alterErr && alterErr.code !== 'ER_NO_SUCH_TABLE') {
        console.error('Lỗi cập nhật loại giao dịch ký quỹ:', alterErr);
      }
    }
  );
  db.query(
    `ALTER TABLE driver_incidents MODIFY incident_type ENUM('accident','vehicle_breakdown','traffic','wrong_item','customer_absent','damaged_goods','lost_goods','other') NOT NULL`,
    (alterErr) => {
      if (alterErr && alterErr.code !== 'ER_NO_SUCH_TABLE') {
        console.error('Lỗi cập nhật loại sự cố tài xế:', alterErr);
      }
    }
  );

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

  db.query('ALTER TABLE employee_salaries ADD COLUMN bonus_per_delivery DECIMAL(15,0) NOT NULL DEFAULT 0', (alterErr) => {
    if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
      console.error('Lỗi bổ sung mức thưởng theo đơn:', alterErr);
    }
  });

  [
    ['cod_remittance_id', 'BIGINT NULL'],
    ['service_fee', 'DECIMAL(15,0) NOT NULL DEFAULT 0'],
    ['insurance_fee', 'DECIMAL(15,0) NOT NULL DEFAULT 0']
  ].forEach(([column, definition]) => {
    db.query(`ALTER TABLE orders ADD COLUMN ${column} ${definition}`, (alterErr) => {
      if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
        console.error(`Lỗi bổ sung cột ${column} cho orders:`, alterErr);
      }
    });
  });

  [
    ['total_service_fee', 'DECIMAL(15,0) NOT NULL DEFAULT 0'],
    ['total_insurance_fee', 'DECIMAL(15,0) NOT NULL DEFAULT 0']
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

  db.query('ALTER TABLE orders ADD COLUMN cod_collected_amount DECIMAL(15,0) NOT NULL DEFAULT 0', (alterErr) => {
    if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME') {
      console.error('Lỗi bổ sung cột cod_collected_amount cho orders:', alterErr);
    }
  });

  [
    ['total_shipping_fee', 'DECIMAL(15,0) NOT NULL DEFAULT 0'],
    ['total_paid', 'DECIMAL(15,0) NOT NULL DEFAULT 0']
  ].forEach(([column, definition]) => {
    db.query(`ALTER TABLE cod_settlements ADD COLUMN ${column} ${definition}`, (alterErr) => {
      if (alterErr && alterErr.code !== 'ER_DUP_FIELDNAME' && alterErr.code !== 'ER_NO_SUCH_TABLE') {
        console.error(`Lỗi bổ sung cột ${column} cho đối soát COD:`, alterErr);
      }
    });
  });

  [
    ['fee_payer', "ENUM('sender','receiver') NOT NULL DEFAULT 'sender'"],
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
function recordFailedLogin({ res, email, ip, config }) {
  if (demoModeEnabled) {
    return res.status(401).json({ success: false, message: 'Sai tên đăng nhập hoặc mật khẩu' });
  }
  const failure = loginLockout.recordFailure({
    ip,
    identifier: email,
    windowMs: config.windowMs,
    maxFailedAttempts: config.maxFailedAttempts
  });
  if (!failure.locked) {
    return res.status(401).json({ success: false, message: 'Sai tên đăng nhập hoặc mật khẩu' });
  }

  const identifierHash = crypto.createHash('sha256').update(email).digest('hex');
  db.query(
    `INSERT INTO audit_logs
      (actor_id, actor_role, action, entity_type, entity_id, new_value, ip)
     VALUES (NULL, 'anonymous', 'auth.login.locked', 'login_lockout', ?, ?, ?)`,
    [
      identifierHash,
      JSON.stringify({
        scopes: failure.newlyLockedScopes,
        max_failed_attempts: config.maxFailedAttempts,
        window_minutes: config.windowMinutes
      }),
      ip
    ],
    (error) => {
      if (error) {
        console.error('Không ghi được audit khi khóa đăng nhập:', error);
        return res.status(500).json({ success: false, message: 'Không thể ghi nhận sự kiện bảo mật. Vui lòng thử lại.' });
      }
      res.set('Retry-After', String(failure.retryAfterSeconds));
      return res.status(429).json({
        success: false,
        message: 'Đăng nhập bị tạm khóa do quá nhiều lần thử sai. Vui lòng thử lại sau.',
        retry_after_seconds: failure.retryAfterSeconds
      });
    }
  );
}

app.post('/api/login', (req, res) => {
  const email = String(req.body?.email || '').trim();
  const normalizedEmail = email.toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || email.length > 255 || !password || password.length > 1024) {
    return res.status(400).json({ success: false, message: 'Email hoặc mật khẩu không hợp lệ.' });
  }

  queryAsync(
    db,
    `SELECT setting_key, setting_value FROM system_settings
     WHERE setting_key IN ('LOGIN_MAX_FAILED_ATTEMPTS', 'LOGIN_LOCKOUT_WINDOW_MINUTES')`
  ).then((settings) => {
    const config = parseLoginLockoutSettings(settings);
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const lockStatus = demoModeEnabled
      ? { locked: false, retryAfterSeconds: 0 }
      : loginLockout.check({
        ip,
        identifier: normalizedEmail,
        windowMs: config.windowMs
      });
    if (lockStatus.locked) {
      res.set('Retry-After', String(lockStatus.retryAfterSeconds));
      return res.status(429).json({
        success: false,
        message: 'Đăng nhập bị tạm khóa do quá nhiều lần thử sai. Vui lòng thử lại sau.',
        retry_after_seconds: lockStatus.retryAfterSeconds
      });
    }

    const sql = `SELECT u.id, u.email, u.full_name, u.role, u.password, u.warehouse_id, w.warehouse_type
      FROM users u LEFT JOIN warehouses w ON w.id = u.warehouse_id
      WHERE u.email = ? AND u.status = "active" LIMIT 1`;

    db.query(sql, [email], async (err, results) => {
      if (err) {
        console.error('Lỗi truy vấn đăng nhập:', err);
        return res.status(500).json({ success: false, message: 'Không thể xử lý đăng nhập. Vui lòng thử lại.' });
      }
      if (!results.length) {
        return recordFailedLogin({ res, email: normalizedEmail, ip, config });
      }
      const record = results[0];
      let validPassword;
      try {
        validPassword = await verifyPassword(password, String(record.password || ''));
      } catch (verifyError) {
        console.error('Lỗi xác minh mật khẩu:', verifyError);
        return res.status(500).json({ success: false, message: 'Không thể xác minh thông tin đăng nhập.' });
      }
      if (!validPassword) return recordFailedLogin({ res, email: normalizedEmail, ip, config });

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

      const user = {
        id: record.id,
        email: record.email,
        full_name: record.full_name,
        role: record.role,
        warehouse_id: record.warehouse_id,
        warehouse_type: record.warehouse_type
      };
      loginLockout.clearAccount(normalizedEmail);
      const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '12h' });
      return res.json({ success: true, user, token });
    });
  }).catch((error) => {
    console.error('Không thể đọc cấu hình khóa đăng nhập:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Không thể xử lý đăng nhập. Vui lòng thử lại.' });
    }
  });
});

app.post('/api/register', limitPublicRegistrations, async (req, res) => {
  const registration = normalizeShopRegistration(req.body);
  if (registration.error) {
    return res.status(400).json({ success: false, message: registration.error });
  }

  try {
    const passwordHash = await hashPassword(registration.value.password);
    const user = await withTransaction(transactionPool, async (connection) => {
      const result = await queryAsync(
        connection,
        `INSERT INTO users
          (full_name, email, password, phone, shop_address, shop_province, role, status)
         VALUES (?, ?, ?, ?, ?, 'TP. Hồ Chí Minh', 'shop', 'active')`,
        [
          registration.value.fullName,
          registration.value.email,
          passwordHash,
          registration.value.phone,
          registration.value.shopAddress
        ]
      );
      await queryAsync(
        connection,
        `INSERT INTO audit_logs
          (actor_id, actor_role, action, entity_type, entity_id, new_value, ip)
         VALUES (NULL, 'shop', 'shop.self_register', 'user', ?, ?, ?)`,
        [String(result.insertId), JSON.stringify({ role: 'shop' }), req.ip || null]
      );
      return {
        id: result.insertId,
        email: registration.value.email,
        full_name: registration.value.fullName,
        role: 'shop'
      };
    });
    const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '12h' });
    return res.status(201).json({ success: true, user, token });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Email này đã được đăng ký.' });
    }
    console.error('Lỗi tạo tài khoản Shop:', error);
    return res.status(500).json({ success: false, message: 'Không thể tạo tài khoản Shop lúc này.' });
  }
});

app.post('/api/chat/sessions', limitPublicChatSessions, (req, res) => {
  const mode = req.body.mode === 'live' ? 'live' : req.body.mode === 'ai' ? 'ai' : null;
  const customerName = String(req.body.customer_name || '').trim().slice(0, 255);
  const customerPhone = String(req.body.customer_phone || '').trim().slice(0, 50);
  const trackingCode = String(req.body.tracking_code || '').trim().toUpperCase();
  if (!mode) return res.status(400).json({ success: false, message: 'Chế độ chat không hợp lệ.' });
  if (mode === 'live' && !/^[+\d][\d\s().-]{7,18}$/.test(customerPhone)) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập số điện thoại hợp lệ.' });
  }
  if (mode === 'live' && !trackingCode && !customerName) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập tên để gặp nhân viên CSKH.' });
  }
  const createSession = (order = null) => {
    const guestToken = createGuestChatToken();
    const expiresAt = new Date(Date.now() + chatTokenTtlHours() * 60 * 60 * 1000);
    const directDriver = Boolean(order);
    const sessionStatus = directDriver || mode === 'ai' ? 'active' : 'waiting';
    const insertSession = (callback) => db.query(
      `INSERT INTO chat_sessions
        (mode, order_id, driver_id, customer_name, customer_phone, guest_token_hash, expires_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [mode, order?.id || null, order?.delivery_shipper_id || null, customerName || order?.receiver_name || 'Khách hàng',
        customerPhone || null, hashChatToken(guestToken), expiresAt, sessionStatus],
      callback
    );
    if (directDriver) {
      const suppliedToken = String(req.headers['x-chat-token'] || '');
      withTransaction(transactionPool, (conn) => openOrderChatSession(conn, {
        order,
        customerName,
        customerPhone,
        suppliedToken,
        guestToken,
        expiresAt,
        ip: req.ip || req.socket.remoteAddress || null
      })).then((opened) => {
        const session = { ...opened.session, tracking_code: order.tracking_code };
        if (opened.created) {
          io.to(`user:${order.delivery_shipper_id}`).emit('chat_session_updated', {
            session_id: session.id, status: 'active'
          });
        }
        res.status(opened.created ? 201 : 200).json({
          success: true,
          data: {
            session,
            guest_token: opened.guestToken,
            direct_driver: true,
            continued: !opened.created
          }
        });
      }).catch((error) => {
        console.error('Không thể mở phiên chat theo đơn:', error);
        res.status(500).json({ success: false, message: 'Không thể tạo hoặc tiếp tục phiên chat.' });
      });
      return;
    }
    insertSession((err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Không thể tạo phiên chat.' });
      const session = {
        id: result.insertId, mode, customer_name: customerName || 'Khách hàng',
        customer_phone: customerPhone || null, status: sessionStatus, expires_at: expiresAt
      };
      if (mode === 'live') io.to('support_agents').emit('chat_session_updated', { session_id: result.insertId, status: 'waiting' });
      res.status(201).json({ success: true, data: { session, guest_token: guestToken } });
    });
  };
  if (!trackingCode) return createSession();
  if (mode !== 'live') return res.status(400).json({ success: false, message: 'Chỉ phiên chat trực tiếp mới hỗ trợ mã vận đơn.' });
  const normalizedPhone = customerPhone.replace(/\D/g, '');
  if (!normalizedPhone) return res.status(400).json({ success: false, message: 'Số điện thoại không hợp lệ.' });
  db.query(
    `SELECT id, tracking_code, delivery_shipper_id, receiver_phone, status
     FROM orders WHERE tracking_code = ? LIMIT 1`,
    [trackingCode],
    (orderErr, orders) => {
      if (orderErr) return res.status(500).json({ success: false, message: 'Không thể xác minh đơn hàng.' });
      const order = orders[0];
      if (!order || String(order.receiver_phone || '').replace(/\D/g, '') !== normalizedPhone
        || !order.delivery_shipper_id || !['at_central_warehouse', 'at_destination_warehouse', 'delivering', 'completed'].includes(order.status)) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy đơn đang giao phù hợp với số điện thoại người nhận.' });
      }
      createSession(order);
    }
  );
});

app.get('/api/chat/sessions', requireChatAgent, (req, res) => {
  const sql = `
    SELECT s.id, s.mode, s.customer_user_id, s.customer_name, s.customer_phone,
      s.status, s.assigned_agent_id, s.created_at, s.updated_at,
      (SELECT m.message FROM chat_messages m WHERE m.session_id = s.id ORDER BY m.id DESC LIMIT 1) AS latest_message
    FROM chat_sessions s
    WHERE s.mode = 'live' AND s.driver_id IS NULL AND s.status <> 'closed'
    ORDER BY (s.status = 'waiting') DESC, s.updated_at DESC
  `;
  db.query(sql, (err, sessions) => {
    if (err) return res.status(500).json({ success: false, message: 'Không thể tải hàng đợi hỗ trợ.' });
    res.json({ success: true, data: sessions });
  });
});

app.get('/api/chat/sessions/:id/messages', (req, res) => {
  db.query('SELECT id, mode, order_id, driver_id, customer_name, customer_phone, guest_token_hash, expires_at, status FROM chat_sessions WHERE id = ? LIMIT 1', [req.params.id], (err, sessions) => {
    if (err) return res.status(500).json({ success: false, message: 'Không thể tải lịch sử chat.' });
    const session = sessions[0];
    const token = String(req.headers['x-chat-token'] || '');
    const loadMessages = () => db.query(
      'SELECT id, session_id, sender_type, sender_id, message, image_url, created_at FROM chat_messages WHERE session_id = ? ORDER BY id ASC LIMIT 500',
      [req.params.id],
      (messageErr, messages) => {
        if (messageErr) return res.status(500).json({ success: false, message: 'Không thể tải lịch sử chat.' });
        const { guest_token_hash: ignoredTokenHash, ...safeSession } = session;
        res.json({ success: true, data: { session: safeSession, messages } });
      }
    );
    if (!session) return res.status(404).json({ success: false, message: 'Không tìm thấy phiên chat.' });
    if (isMatchingChatToken(token, session.guest_token_hash, session.expires_at)) return loadMessages();
    if (!/^Bearer\s+/i.test(String(req.headers.authorization || ''))) {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập phiên chat này.' });
    }
    authenticateUser(req, res, () => {
      const role = normalizeRole(req.authUser.role);
      if (chatAgentRoles.has(String(req.authUser.role || '').toLowerCase())) return loadMessages();
      if (session.driver_id && Number(req.authUser.id) === Number(session.driver_id) && driverRoles.has(role)) {
        loadMessages();
        return;
      }
      res.status(403).json({ success: false, message: 'Không có quyền truy cập phiên chat này.' });
    });
  });
});

app.post('/api/chat/sessions/:id/images', limitPublicChatImages, (req, res, next) => {
  const sessionId = Number(req.params.id);
  if (!Number.isSafeInteger(sessionId) || sessionId <= 0) {
    return res.status(400).json({ success: false, message: 'Phiên chat không hợp lệ.' });
  }
  db.query(
    'SELECT id, mode, customer_name, guest_token_hash, expires_at, driver_id, status FROM chat_sessions WHERE id = ? LIMIT 1',
    [sessionId],
    (err, sessions) => {
      if (err) return res.status(500).json({ success: false, message: 'Không thể xác minh phiên chat.' });
      const session = sessions[0];
      if (!session) return res.status(404).json({ success: false, message: 'Không tìm thấy phiên chat.' });
      if (session.mode !== 'live') {
        return res.status(400).json({ success: false, message: 'Chỉ phiên chat trực tiếp mới hỗ trợ gửi ảnh.' });
      }
      if (!session.driver_id) {
        return res.status(400).json({ success: false, message: 'Chỉ chat trực tiếp với tài xế mới hỗ trợ gửi ảnh.' });
      }
      if (session.status === 'closed') {
        return res.status(409).json({ success: false, message: 'Phiên chat đã kết thúc.' });
      }

      const authorizeUpload = () => {
        const user = req.authUser;
        const agent = user && chatAgentRoles.has(String(user.role || '').toLowerCase());
        const driver = user && Number(session.driver_id) === Number(user.id)
          && driverRoles.has(normalizeRole(user.role));
        const guestToken = String(req.headers['x-chat-token'] || '');
        const guest = isMatchingChatToken(guestToken, session.guest_token_hash, session.expires_at);
        if (!agent && !driver && !guest) {
          return res.status(403).json({ success: false, message: 'Không có quyền gửi ảnh trong phiên chat này.' });
        }
        req.chatImageContext = {
          session,
          senderType: agent ? 'agent' : driver ? 'driver' : 'customer',
          senderId: agent || driver ? user.id : null,
          senderName: agent || driver ? user.full_name : session.customer_name
        };
        next();
      };

      if (isMatchingChatToken(
        String(req.headers['x-chat-token'] || ''), session.guest_token_hash, session.expires_at
      )) return authorizeUpload();
      if (!/^Bearer\s+/i.test(String(req.headers.authorization || ''))) {
        return res.status(403).json({ success: false, message: 'Không có quyền gửi ảnh trong phiên chat này.' });
      }
      authenticateUser(req, res, authorizeUpload);
    }
  );
}, parseChatImage, (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Vui lòng chọn ảnh để gửi.' });
  const { session, senderType, senderId, senderName } = req.chatImageContext;
  const imageUrl = `/uploads/${req.file.filename}`;
  const removeUploadedImage = () => {
    fs.unlink(req.file.path, (error) => {
      if (error) console.error('Không thể dọn ảnh chat chưa lưu:', error);
    });
  };
  db.query(
    'INSERT INTO chat_messages (session_id, sender_type, sender_id, message, image_url) VALUES (?, ?, ?, ?, ?)',
    [session.id, senderType, senderId, '', imageUrl],
    (insertErr, result) => {
      if (insertErr) {
        removeUploadedImage();
        return res.status(500).json({ success: false, message: 'Không thể lưu ảnh chat.' });
      }
      const savedMessage = {
        id: result.insertId,
        session_id: session.id,
        sender_type: senderType,
        sender_id: senderId,
        sender_name: senderName || null,
        message: '',
        image_url: imageUrl,
        created_at: new Date().toISOString()
      };
      db.query('UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [session.id], (updateErr) => {
        if (updateErr) console.error('Không thể cập nhật thời gian phiên chat sau khi gửi ảnh:', updateErr);
        io.to(`chat:${session.id}`).emit('receive_message', savedMessage);
        if (!session.driver_id) {
          io.to('support_agents').emit('chat_session_updated', { session_id: session.id, status: session.status });
        }
        res.status(201).json({ success: true, data: savedMessage });
      });
    }
  );
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
    return { reply: 'COD là khoản tài xế thu từ người nhận theo thông tin đơn. Shop có thể theo dõi đối soát trên hệ thống; nếu bạn cần tra một đơn cụ thể, hãy gửi mã vận đơn (không gửi mật khẩu hoặc thông tin đăng nhập).' };
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
          content: 'Bạn là trợ lý CSKH Smart Logistics, trả lời bằng tiếng Việt rõ ràng, ngắn gọn và lịch sự. Chỉ hướng dẫn các nghiệp vụ giao nhận, tạo đơn, cước phí, trạng thái vận đơn, COD và hàng hoàn. Không yêu cầu hoặc tiết lộ mật khẩu, thông tin đăng nhập, dữ liệu thanh toán hay thông tin cá nhân nhạy cảm. Không tự khẳng định thông tin vận đơn nếu chưa được tra cứu bằng công cụ.'
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
  db.query('SELECT id, mode, guest_token_hash, expires_at, status FROM chat_sessions WHERE id = ? LIMIT 1', [sessionId], (err, sessions) => {
    if (err) return res.status(500).json({ success: false, message: 'Không thể xử lý câu hỏi.' });
    const session = sessions[0];
    if (!session || session.mode !== 'ai' || !isMatchingChatToken(
      req.body.guest_token, session.guest_token_hash, session.expires_at
    )) {
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
              at_central_warehouse: 'đang ở kho tổng Gò Vấp, chờ phân công giao', transferring_to_destination: 'đang chuyển đến kho đích',
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
app.get('/api/pricing/estimate', (req, res) => {
  const serviceType = String(req.query.service_type || '');
  const weightKg = Number(req.query.weight_kg);
  const distanceKm = Number(req.query.distance_km);
  const fragile = req.query.fragile === 'true';
  if (!['economy', 'standard', 'express'].includes(serviceType)
    || !Number.isFinite(weightKg) || weightKg <= 0
    || !Number.isFinite(distanceKm) || distanceKm < 0) {
    return res.status(400).json({ success: false, message: 'Thông tin ước tính cước không hợp lệ.' });
  }
  db.query(
    `SELECT * FROM shipping_rates
     WHERE service_type = ? AND area_code = 'GOVAP_ALL'
       AND min_weight_kg <= ? AND (max_weight_kg IS NULL OR max_weight_kg > ?)
       AND effective_from <= CURDATE() AND (effective_to IS NULL OR effective_to >= CURDATE())
     ORDER BY effective_from DESC, id DESC`,
    [serviceType, weightKg, weightKg],
    (rateErr, rates) => {
      if (rateErr) return res.status(500).json({ success: false, message: 'Không thể tính cước theo bảng giá hiện hành.' });
      db.query('SELECT CURDATE() AS pricing_date', (dateErr, dateRows) => {
        if (dateErr) return res.status(500).json({ success: false, message: 'Không thể xác định ngày áp dụng bảng giá.' });
        const pricingDate = dateRows[0].pricing_date instanceof Date
          ? dateRows[0].pricing_date.toISOString().slice(0, 10)
          : String(dateRows[0].pricing_date).slice(0, 10);
        const rate = selectEffectiveRate(rates, {
          areaCode: 'GOVAP_ALL',
          serviceType,
          weightKg,
          effectiveDate: pricingDate
        });
        try {
          const fee = calculateShippingPrice(rate, {
            weightKg,
            distanceKm,
            fragile,
            vehicleType: 'motorbike'
          });
          res.json({
            success: true,
            data: { shipping_fee: fee.toString(), shipping_rate_id: rate.id, pricing_date: pricingDate }
          });
        } catch (error) {
          if (error.message.startsWith('Không tìm thấy bảng giá')) {
            return res.status(404).json({ success: false, message: error.message });
          }
          console.error('Không thể ước tính cước:', error);
          res.status(500).json({ success: false, message: 'Không thể ước tính cước theo bảng giá hiện hành.' });
        }
      });
    }
  );
});

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
    service_fee,
    order_items,
    partial_delivery_allowed,
    pickup_appointment_at
  } = req.body;
  const finalTrackingCode = String(tracking_code || `VTP${crypto.randomBytes(5).toString('hex').toUpperCase()}VN`);
  const normalizedReceiverPhone = String(receiver_phone || '').trim().replace(/[\s().-]/g, '');
  const normalizedReceiverName = String(receiver_name || '').trim();
  const normalizedReceiverAddress = String(receiver_address || '').trim();
  const normalizedShopAddress = String(shop_address || '').trim();
  const pickupAppointmentAt = pickup_appointment_at ? new Date(pickup_appointment_at) : null;
  const normalizedReceiverAddressKey = normalizeBlacklistAddress(normalizedReceiverAddress);
  let codAmountVnd;
  let itemValueVnd;
  let serviceFeeVnd;
  let normalizedOrderItems;
  try {
    codAmountVnd = parseMoney(cod_amount ?? 0);
    itemValueVnd = parseMoney(item_value ?? 0);
    serviceFeeVnd = parseMoney(service_fee ?? 0);
    normalizedOrderItems = normalizeOrderItems(order_items, {
      itemValue: itemValueVnd,
      codAmount: codAmountVnd
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
  const partialDeliveryAllowed = partial_delivery_allowed === true
    || partial_delivery_allowed === 1
    || partial_delivery_allowed === '1'
    || partial_delivery_allowed === 'true';
  const isExchange = normalizedOrderItems.some((item) => item.direction === 'exchange_in');

  const numericFields = { weight_kg, length, width, height, distance_km, shop_lat, shop_lng, receiver_lat, receiver_lng };
  const hasInvalidNumber = Object.entries(numericFields).some(([, value]) => value !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 0));
  const normalizedReceiverLat = receiver_lat === undefined || receiver_lat === null || receiver_lat === '' ? null : Number(receiver_lat);
  const normalizedReceiverLng = receiver_lng === undefined || receiver_lng === null || receiver_lng === '' ? null : Number(receiver_lng);
  const normalizedShopLat = Number(shop_lat) || 10.8231;
  const normalizedShopLng = Number(shop_lng) || 106.6881;
  const requiresTruck = Number(weight_kg) > 100
    || Number(length) * Number(width) * Number(height) > 1000000;
  const normalizedVehicle = requiresTruck
    ? 'truck'
    : ['motorbike', 'van', 'truck'].includes(vehicle_type) ? vehicle_type : 'motorbike';
  const normalizedFeePayer = fee_payer === undefined ? 'sender' : fee_payer;
  const normalizedServiceFee = serviceFeeVnd.toString();
  const insuranceFee = itemValueVnd > 1000000n
    ? calculatePercentage(itemValueVnd, '0.5').toString()
    : '0';
  const provinceName = String(destination_province || 'Hồ Chí Minh').trim() || 'Hồ Chí Minh';
  const effectiveRemoteArea = Boolean(is_remote_area);
  const hasReceiverCoordinates = normalizedReceiverLat !== null && normalizedReceiverLng !== null;
  const effectiveDistanceKm = hasReceiverCoordinates
    ? calculateDistanceKm(normalizedShopLat, normalizedShopLng, normalizedReceiverLat, normalizedReceiverLng)
    : Number(distance_km);

  if (!normalizedShopAddress || !normalizedReceiverName || !normalizedReceiverPhone || !normalizedReceiverAddress) {
    return res.status(400).json({ success: false, message: 'Thiếu địa chỉ cửa hàng hoặc thông tin người nhận.' });
  }
  if (pickup_appointment_at && (!Number.isFinite(pickupAppointmentAt.getTime()) || pickupAppointmentAt.getTime() <= Date.now())) {
    return res.status(400).json({ success: false, message: 'Giờ hẹn lấy hàng phải là thời gian hợp lệ trong tương lai.' });
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
    return res.status(400).json({ success: false, message: 'Cần chọn vị trí Shop và điểm giao trên bản đồ trong phạm vi Gò Vấp.' });
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
  if (!isWithinGovapServiceArea(normalizedShopLat, normalizedShopLng)
    || !isWithinGovapServiceArea(normalizedReceiverLat, normalizedReceiverLng)) {
    return res.status(400).json({ success: false, message: 'Điểm lấy và điểm giao phải nằm trong 6 phường thuộc Gò Vấp.' });
  }

  if (!['economy', 'standard', 'express'].includes(service_type)) {
    return res.status(400).json({ success: false, message: 'Loại dịch vụ không hợp lệ.' });
  }
  if (!['sender', 'receiver'].includes(normalizedFeePayer)) {
    return res.status(400).json({ success: false, message: 'Người trả cước không hợp lệ.' });
  }
  const destinationWard = findGovapWard(normalizedReceiverLat, normalizedReceiverLng);
  if (!destinationWard) {
    return res.status(400).json({ success: false, message: 'Không xác định được phường giao hàng để áp dụng bảng giá.' });
  }
  const sql = `
    INSERT INTO orders (
      tracking_code, shop_id, shop_address, shop_province, shop_lat, shop_lng, receiver_name, receiver_phone, receiver_address, receiver_lat, receiver_lng, customer_email,
      cod_amount, shipping_fee, fee_payer, service_fee, insurance_fee, weight_kg, length, width, height, item_value, distance_km,
      is_remote_area, service_type, is_fragile, vehicle_type, destination_province,
      partial_delivery_allowed, is_exchange,
      origin_warehouse_id, destination_warehouse_id, current_warehouse_id, status,
      shipping_rate_id, shipping_rate_snapshot, shipping_rate_effective_at, pickup_appointment_at
    )
    VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?,
      'pending',
      ?, ?, NOW(), ?
    )
  `;
  withTransaction(transactionPool, async (conn) => {
    const centralWarehouseId = await getCentralWarehouseId(conn, true);
    const pricingDates = await queryAsync(conn, 'SELECT CURDATE() AS pricing_date');
    const pricingDate = pricingDates[0].pricing_date instanceof Date
      ? pricingDates[0].pricing_date.toISOString().slice(0, 10)
      : String(pricingDates[0].pricing_date).slice(0, 10);
    const chargeableWeight = Math.max(
      Number(weight_kg),
      Number(length) * Number(width) * Number(height) / 5000
    );
    const rateCandidates = await queryAsync(
      conn,
      `SELECT * FROM shipping_rates
       WHERE service_type = ?
         AND (area_code = ? OR area_code = 'GOVAP_ALL')
         AND min_weight_kg <= ?
         AND (max_weight_kg IS NULL OR max_weight_kg > ?)
         AND effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?)
       ORDER BY effective_from DESC, id DESC`,
      [service_type, destinationWard.properties.codeName, chargeableWeight, chargeableWeight, pricingDate, pricingDate]
    );
    const effectiveRate = selectEffectiveRate(rateCandidates, {
      areaCode: destinationWard.properties.codeName,
      serviceType: service_type,
      weightKg: chargeableWeight,
      effectiveDate: pricingDate
    });
    const effectiveShippingFee = calculateShippingPrice(effectiveRate, {
      weightKg: weight_kg,
      lengthCm: length,
      widthCm: width,
      heightCm: height,
      distanceKm: effectiveDistanceKm,
      remoteArea: effectiveRemoteArea,
      fragile: is_fragile,
      vehicleType: normalizedVehicle
    });
    const effectiveRateSnapshot = snapshotRate(effectiveRate);
    const blacklistEntries = await queryAsync(
      conn,
      `SELECT entry_type FROM order_blacklist
       WHERE (entry_type = 'phone' AND normalized_value = ?)
          OR (entry_type = 'address' AND normalized_value = ?)`,
      [normalizeBlacklistPhone(normalizedReceiverPhone), normalizedReceiverAddressKey]
    );
    const result = await queryAsync(conn, sql, [
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
    codAmountVnd.toString(),
    effectiveShippingFee.toString(),
    normalizedFeePayer,
    normalizedServiceFee,
    insuranceFee,
    Number(weight_kg),
    Number(length),
    Number(width),
    Number(height),
    itemValueVnd.toString(),
    effectiveDistanceKm,
    effectiveRemoteArea,
    service_type,
    Boolean(is_fragile),
    normalizedVehicle,
    provinceName,
    partialDeliveryAllowed ? 1 : 0,
    isExchange ? 1 : 0,
    centralWarehouseId,
    centralWarehouseId,
    centralWarehouseId,
    effectiveRate.id,
    JSON.stringify(effectiveRateSnapshot),
    pickupAppointmentAt,
    ]);
    await insertOrderItems(conn, result.insertId, normalizedOrderItems);
    await queryAsync(
      conn,
      `INSERT INTO order_events (order_id, from_status, to_status, actor_id, actor_role, note)
       VALUES (?, NULL, 'pending', ?, ?, 'Shop tạo đơn hàng')`,
      [result.insertId, shop_id || null, shop_id ? 'shop' : 'system']
    );
    await queryAsync(
      conn,
      `INSERT INTO order_status_history (order_id, from_status, to_status, note)
       VALUES (?, NULL, 'pending', 'Shop tạo đơn hàng')`,
      [result.insertId]
    );
    return {
      ...result,
      shippingFee: effectiveShippingFee.toString(),
      shippingRateId: effectiveRate.id,
      shippingRateSnapshot: effectiveRateSnapshot,
      blacklistWarnings: blacklistEntries.map((entry) => entry.entry_type)
    };
  }).then((result) => {
    notifyUser(shop_id, result.insertId, 'Đã tiếp nhận vận đơn', `Đơn ${finalTrackingCode} đã được gửi đến Điều phối.`);
    notifyCustomerByEmail(customer_email, result.insertId, 'Đơn hàng đang được xử lý', `Shop đã tạo đơn ${finalTrackingCode} để giao đến bạn.`);
    io.emit('order_status_changed', { order_id: Number(result.insertId), status: 'pending' });
    res.json({
      success: true,
      message: 'Tạo đơn hàng thành công!',
      orderId: result.insertId,
      tracking_code: finalTrackingCode,
      shipping_fee: result.shippingFee,
      shipping_rate_id: result.shippingRateId,
      shipping_rate_snapshot: result.shippingRateSnapshot,
      service_fee: normalizedServiceFee,
      insurance_fee: insuranceFee,
      warnings: result.blacklistWarnings.map((type) => type === 'phone'
        ? 'Số điện thoại người nhận nằm trong danh sách cảnh báo bom hàng.'
        : 'Địa chỉ người nhận nằm trong danh sách cảnh báo bom hàng.')
    });
  }).catch((err) => {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Mã vận đơn đã tồn tại, vui lòng tạo lại đơn.' });
    }
    return respondWithTransitionError(res, err, 'Lỗi lưu đơn hàng:');
  });
};

app.get('/api/shop/profile', (req, res) => {
  db.query(
    'SELECT id, email, full_name, phone, shop_address, shop_province, shop_lat, shop_lng FROM users WHERE id = ? AND role = "shop" LIMIT 1',
    [req.authUser.id],
    (err, rows) => {
      if (err) {
        console.error('Không thể tải hồ sơ Shop:', err);
        return res.status(500).json({ success: false, message: 'Không thể tải thông tin Shop.' });
      }
      if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ Shop.' });
      res.json({ success: true, data: rows[0] });
    }
  );
});

app.put('/api/shop/profile', (req, res) => {
  const fullName = String(req.body.full_name || '').trim();
  const phone = String(req.body.phone || '').trim().replace(/[\s().-]/g, '');
  const address = String(req.body.shop_address || '').trim();
  const lat = Number(req.body.shop_lat);
  const lng = Number(req.body.shop_lng);
  if (!fullName || fullName.length > 255 || !address || address.length > 1000) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập tên Shop và địa chỉ lấy hàng (tối đa 1.000 ký tự).' });
  }
  if (phone && !/^0\d{9,10}$/.test(phone)) {
    return res.status(400).json({ success: false, message: 'Số điện thoại Shop phải có 10-11 chữ số và bắt đầu bằng 0.' });
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)
    || lat < -90 || lat > 90 || lng < -180 || lng > 180
    || !isWithinGovapServiceArea(lat, lng)) {
    return res.status(400).json({ success: false, message: 'Vui lòng chọn vị trí Shop hợp lệ trong 6 phường thuộc Gò Vấp.' });
  }
  db.query(
    'UPDATE users SET full_name = ?, phone = ?, shop_address = ?, shop_province = ?, shop_lat = ?, shop_lng = ? WHERE id = ? AND role = "shop"',
    [fullName, phone || null, address, 'Gò Vấp, TP. Hồ Chí Minh', lat, lng, req.authUser.id],
    (err, result) => {
      if (err) {
        console.error('Không thể cập nhật hồ sơ Shop:', err);
        return res.status(500).json({ success: false, message: 'Không thể lưu thông tin Shop.' });
      }
      const sendUpdatedProfile = () => res.json({
        success: true,
        message: 'Đã cập nhật thông tin Shop.',
        data: {
          id: req.authUser.id,
          email: req.authUser.email,
          full_name: fullName,
          phone: phone || null,
          shop_address: address,
          shop_province: 'TP. Hồ Chí Minh',
          shop_lat: lat,
          shop_lng: lng
        }
      });
      if (result.affectedRows > 0) return sendUpdatedProfile();
      db.query('SELECT id FROM users WHERE id = ? AND role = "shop" LIMIT 1', [req.authUser.id], (lookupErr, rows) => {
        if (lookupErr) {
          console.error('Không thể xác nhận hồ sơ Shop sau khi cập nhật:', lookupErr);
          return res.status(500).json({ success: false, message: 'Không thể xác nhận thông tin Shop đã lưu.' });
        }
        if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ Shop.' });
        sendUpdatedProfile();
      });
    }
  );
});

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
    `SELECT r.order_id, r.shop_id, r.status AS status, r.status AS request_status, r.request_note,
      r.requested_at, r.reviewed_at, r.review_note, o.tracking_code, o.status AS order_status,
      o.delivery_attempts, o.receiver_name, o.receiver_phone, o.receiver_address, o.cod_amount, o.fail_reason,
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
  const actor = { id: Number(req.authUser.id), role: normalizeRole(req.authUser.role) };
  withTransaction(transactionPool, (conn) => reviewShopRedeliveryRequest(conn, {
    orderId, status, reviewNote, actor, ip: req.ip
  })).then((result) => {
    result.notifications.forEach(({ userId, orderId: notificationOrderId, title, message }) => {
      io.to(`user:${userId}`).emit(`notification_new_${userId}`, {
        order_id: notificationOrderId,
        title,
        message
      });
    });
    res.json({
      success: true,
      data: { order_status: result.orderStatus, delivery_attempts: result.deliveryAttempts },
      message: status === 'approved'
        ? 'Đã duyệt yêu cầu giao lại; đơn đã về kho tổng và chờ phân công giao.'
        : 'Đã từ chối yêu cầu giao lại.'
    });
  }).catch((error) => {
    if (error instanceof OrderTransitionError) {
      return res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    }
    console.error('Không thể xử lý yêu cầu giao lại:', error);
    return res.status(500).json({ success: false, message: 'Không thể xử lý yêu cầu giao lại.' });
  });
});

app.get('/api/shop/returns', (req, res) => {
  if (req.authRole !== 'shop') {
    return res.status(403).json({ success: false, message: 'Chỉ Shop mới được xem hàng hoàn của mình.' });
  }
  const scope = shopOrderScope(req.authUser.id);
  db.query(
    `SELECT o.id, o.tracking_code, o.status, o.receiver_name, o.receiver_phone, o.receiver_address,
      o.updated_at
     FROM orders o
     WHERE ${scope.predicate} AND o.status = 'returned'
       AND NOT EXISTS (
         SELECT 1 FROM order_events e
         WHERE e.order_id = o.id AND e.actor_role = 'shop' AND e.to_status = 'returned'
       )
     ORDER BY o.updated_at DESC`,
    scope.params,
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: 'Không tải được danh sách hàng hoàn.' });
      res.json({ success: true, data: rows });
    }
  );
});

app.post('/api/shop/returns/:orderId/received', podUpload.fields([
  { name: 'proof_image', maxCount: 1 },
  { name: 'signature_image', maxCount: 1 }
]), (req, res) => {
  if (req.authRole !== 'shop') {
    return res.status(403).json({ success: false, message: 'Chỉ Shop mới được xác nhận nhận hàng hoàn.' });
  }
  const orderId = Number(req.params.orderId);
  const proof = req.files?.proof_image?.[0];
  const signature = req.files?.signature_image?.[0];
  if (!Number.isSafeInteger(orderId) || orderId <= 0 || !proof || !signature) {
    return res.status(400).json({ success: false, message: 'Cần ảnh hàng hoàn và chữ ký xác nhận Shop nhận hàng.' });
  }
  const photoUrl = `/uploads/${proof.filename}`;
  const signatureUrl = `/uploads/${signature.filename}`;
  const scope = shopOrderScope(req.authUser.id);
  withTransaction(transactionPool, async (conn) => {
    const orders = await queryAsync(
      conn,
      `SELECT o.id, o.status FROM orders o WHERE o.id = ? AND ${scope.predicate} FOR UPDATE`,
      [orderId, ...scope.params]
    );
    if (!orders.length) throw new OrderTransitionError('ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng hoàn thuộc Shop.', 404);
    if (orders[0].status !== 'returned') {
      throw new OrderTransitionError('RETURN_NOT_READY', 'Đơn hàng chưa được kho tổng xác nhận đã nhận hàng hoàn.');
    }
    await transitionOrder(conn, {
      orderId,
      toStatus: 'returned',
      actor: { id: Number(req.authUser.id), role: 'shop' },
      note: 'Shop xác nhận đã nhận lại hàng hoàn.',
      photoUrl,
      signatureUrl
    });
  }).then(() => {
    notifyUser(req.authUser.id, orderId, 'Shop đã nhận hàng hoàn', 'Ảnh và chữ ký xác nhận đã được lưu.');
    res.json({ success: true, message: 'Đã ghi nhận Shop nhận hàng hoàn.' });
  }).catch((error) => respondWithTransitionError(res, error, 'Không thể xác nhận nhận hàng hoàn:'));
});

app.get('/api/shop/rma', (req, res) => {
  const scope = shopOrderScope(req.authUser.id);
  db.query(
    `SELECT o.id, o.tracking_code, o.receiver_name, o.receiver_phone, o.receiver_address,
      o.cod_amount, o.shipping_fee, o.fee_payer, o.fail_reason, o.proof_image,
      o.status AS order_status, o.delivery_attempts,
      o.updated_at, r.status AS redelivery_status, r.request_note AS redelivery_note,
      r.requested_at AS redelivery_requested_at, r.review_note AS redelivery_review_note
     FROM orders o
     LEFT JOIN shop_redelivery_requests r ON r.order_id = o.id AND r.shop_id = o.shop_id
     WHERE ${scope.predicate} AND (
       o.status = 'returning'
       OR (r.status = 'approved' AND o.status = 'at_central_warehouse')
     )
     ORDER BY o.updated_at DESC`,
    scope.params,
    (ordersErr, orders) => {
      if (ordersErr) return res.status(500).json({ success: false, message: 'Không tải được danh sách hàng hoàn.' });
      if (!orders.length) return res.json({ success: true, data: [] });
      db.query(
        `SELECT h.order_id, h.to_status, h.note, h.proof_image, h.signature_image, h.created_at
         FROM order_status_history h
         JOIN orders o ON o.id = h.order_id
         WHERE ${scope.predicate} AND (
           o.status = 'returning'
           OR EXISTS (
             SELECT 1 FROM shop_redelivery_requests r
             WHERE r.order_id = o.id AND r.shop_id = o.shop_id
               AND r.status = 'approved' AND o.status = 'at_central_warehouse'
           )
         )
         ORDER BY h.created_at DESC, h.id DESC`,
        scope.params,
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
  const scope = shopOrderScope(req.authUser.id);
  const orderId = Number(req.params.orderId);
  const note = String(req.body.note || '').trim();
  if (!Number.isSafeInteger(orderId) || orderId <= 0 || note.length < 8 || note.length > 1000
    || req.body.customer_confirmed !== true) {
    return res.status(400).json({ success: false, message: 'Cần xác nhận khách đồng ý nhận lại và ghi chú từ 8 đến 1000 ký tự.' });
  }
  db.query(
    `SELECT o.id, o.tracking_code FROM orders o WHERE o.id = ? AND ${scope.predicate} AND o.status = 'returning' LIMIT 1`,
    [orderId, ...scope.params],
    (orderErr, orders) => {
      if (orderErr) return res.status(500).json({ success: false, message: 'Không thể kiểm tra đơn hàng.' });
      if (!orders.length) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng hoàn thuộc Shop.' });
      db.query('SELECT status FROM shop_redelivery_requests WHERE order_id = ? AND shop_id = ? LIMIT 1', [orderId, scope.params[0]], (requestErr, requests) => {
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
              [note, orderId, scope.params[0]],
              callback
            );
          }
          db.query(
            'INSERT INTO shop_redelivery_requests (order_id, shop_id, request_note) VALUES (?, ?, ?)',
            [orderId, scope.params[0], note],
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

app.get('/api/map/route', authenticateUser, async (req, res) => {
  const parseCoordinate = (value) => {
    const match = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(String(value || ''));
    if (!match) return null;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    return Number.isFinite(lat) && Number.isFinite(lng)
      && isWithinGovapServiceArea(lat, lng) ? { lat, lng } : null;
  };
  const from = parseCoordinate(req.query.from);
  const to = parseCoordinate(req.query.to);
  const viaRaw = String(req.query.via || '');
  const via = viaRaw ? viaRaw.split('|').map(parseCoordinate) : [];
  if (!from || !to || via.length > 60 || via.some((point) => !point)) {
    return res.status(400).json({ success: false, message: 'Điểm đi, điểm dừng và điểm đến phải có tọa độ hợp lệ trong 6 phường Gò Vấp.' });
  }

  const directions = {
    left: 'rẽ trái',
    right: 'rẽ phải',
    straight: 'đi thẳng',
    'slight left': 'chếch trái',
    'slight right': 'chếch phải',
    'sharp left': 'rẽ gắt trái',
    'sharp right': 'rẽ gắt phải',
    uturn: 'quay đầu'
  };
  try {
    const routingUrl = process.env.OSRM_URL || 'http://localhost:5001';
    const routePoints = [from, ...via, to];
    const coordinates = routePoints.map((point) => `${point.lng},${point.lat}`).join(';');
    const response = await fetch(
      `${routingUrl}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!response.ok) throw new Error(`OSRM HTTP ${response.status}`);
    const result = await response.json();
    if (result.code !== 'Ok' || !result.routes?.[0]) {
      return res.status(422).json({ success: false, message: 'Không tìm được lộ trình trong dữ liệu bản đồ nội bộ.' });
    }
    const route = result.routes[0];
    const steps = route.legs.flatMap((leg) => leg.steps || []).map((step) => {
      const maneuver = step.maneuver || {};
      const roadName = step.name ? ` vào ${step.name}` : '';
      const modifier = directions[maneuver.modifier] || 'tiếp tục';
      const instruction = maneuver.type === 'depart'
        ? `Bắt đầu${roadName}`
        : maneuver.type === 'arrive'
          ? 'Đã đến điểm đến'
          : maneuver.type === 'roundabout' || maneuver.type === 'rotary'
            ? `Vào vòng xuyến${roadName}`
            : `${modifier}${roadName}`;
      return {
        instruction,
        distance_m: step.distance,
        duration_s: step.duration,
        road_name: step.name || ''
      };
    });
    return res.json({
      success: true,
      data: {
        geometry: route.geometry,
        distance_m: route.distance,
        duration_s: route.duration,
        steps
      }
    });
  } catch (error) {
    console.error('Không thể lấy lộ trình từ dịch vụ nội bộ:', error);
    return res.status(502).json({ success: false, message: 'Dịch vụ chỉ đường nội bộ chưa sẵn sàng. Hãy kiểm tra container định tuyến.' });
  }
});

app.get('/api/map/reverse', authenticateUser, async (req, res) => {
  try {
    const result = await reverseGeocodeGovap(req.query.lat, req.query.lng);
    return res.json({ success: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 502;
    if (statusCode !== 400) console.error('Không thể tra cứu địa chỉ từ bản đồ nội bộ:', error);
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 400
        ? error.message
        : 'Không tra được tên đường từ bản đồ nội bộ. Hãy nhập địa chỉ bằng chữ rồi thử lại.'
    });
  }
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
                  shop_lat: { type: 'number', example: 10.8231 },
                  shop_lng: { type: 'number', example: 106.6881 },
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

app.get('/api/reason-codes', (req, res) => {
  const groupType = String(req.query.group_type || '').toUpperCase();
  if (!['PICKUP', 'DELIVERY', 'WAREHOUSE'].includes(groupType)) {
    return res.status(400).json({ success: false, message: 'Nhóm mã lý do không hợp lệ.' });
  }
  db.query(
    `SELECT code, group_type, fault_party, allow_retry, counts_attempt, require_evidence,
      create_incident, description
     FROM reason_codes WHERE group_type = ? ORDER BY code`,
    [groupType],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: 'Không tải được danh sách mã lý do.' });
      res.json({ success: true, data: rows });
    }
  );
});

app.get('/api/warehouses', (req, res) => {
  db.query(
    `SELECT w.* FROM system_settings setting
     JOIN warehouses w ON w.id = CAST(setting.setting_value AS UNSIGNED)
     WHERE setting.setting_key = 'central_warehouse_id'
       AND w.warehouse_type = 'central' AND w.is_active = 1 AND w.is_configured = 1`,
    (err, warehouses) => {
      if (err) return res.status(500).json({ success: false, message: 'Không thể tải kho tổng: ' + err.sqlMessage });
      if (!warehouses.length) return res.status(503).json({ success: false, message: 'Chưa cấu hình kho tổng Gò Vấp. Hãy chạy migration 002.' });
      res.json({ success: true, data: warehouses });
    }
  );
});

app.get('/api/warehouse/routes', (req, res) => {
  const warehouseId = req.warehouseScopeId || Number(req.query.warehouse_id);
  if (req.authRole === 'warehouse_manager') {
    db.query(
      `SELECT destination.id, destination.name, destination.warehouse_type, destination.ward_name,
         destination.address, destination.lat, destination.lng, destination.is_configured, destination.is_active
       FROM warehouses source
       JOIN warehouses destination ON destination.warehouse_type <> source.warehouse_type
       WHERE source.id = ? AND source.is_active = 1 AND destination.is_active = 1
       ORDER BY destination.warehouse_type, destination.ward_name`,
      [req.warehouseScopeId],
      (err, destinations) => {
        if (err) return res.status(500).json({ success: false, message: 'Không tải được tuyến kho: ' + err.sqlMessage });
        res.json({ success: true, data: destinations });
      }
    );
    return;
  }
  if (!Number.isInteger(warehouseId) || warehouseId <= 0) {
    return res.status(400).json({ success: false, message: 'Chọn kho nguồn hợp lệ để tải các tuyến kho.' });
  }
  db.query(
    `SELECT id, name, warehouse_type, ward_name FROM warehouses
     WHERE is_active = 1 ORDER BY warehouse_type, ward_name`,
    (err, warehouses) => {
      if (err) return res.status(500).json({ success: false, message: 'Không tải được tuyến kho: ' + err.sqlMessage });
      res.json({ success: true, data: warehouses });
    }
  );
});

app.post('/api/warehouses', (req, res) => {
  const wardName = String(req.body.ward_name || '').trim();
  if (!wardName || wardName === '__CENTRAL__') {
    return res.status(400).json({ success: false, message: 'Nhập tên phường hợp lệ cho kho con.' });
  }
  const hasLocationDetails = req.body.address !== undefined || req.body.lat !== undefined || req.body.lng !== undefined;
  const address = String(req.body.address || '').trim();
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);
  if (hasLocationDetails && (!address || address.length > 1000
    || !Number.isFinite(lat) || Math.abs(lat) > 90
    || !Number.isFinite(lng) || Math.abs(lng) > 180)) {
    return res.status(400).json({ success: false, message: 'Cần nhập địa chỉ và tọa độ hợp lệ để kích hoạt kho con.' });
  }
  const isConfigured = hasLocationDetails ? 1 : 0;
  const createWarehouse = () => db.query(
      `INSERT INTO warehouses (warehouse_type, ward_name, name, address, lat, lng, is_configured, is_active)
       VALUES ('ward', ?, ?, ?, ?, ?, ?, ?)`,
      [
        wardName,
        `Kho con ${wardName}`,
        hasLocationDetails ? address : null,
        hasLocationDetails ? lat : null,
        hasLocationDetails ? lng : null,
        isConfigured,
        isConfigured
      ],
      (err, result) => {
        if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Phường này đã có một kho con.' });
        if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
        res.status(201).json({
          success: true,
          warehouseId: result.insertId,
          message: isConfigured ? 'Đã tạo và kích hoạt kho con.' : 'Đã tạo kho chờ cấu hình vị trí.'
        });
      }
    );
  if (req.authRole !== 'warehouse_manager') return createWarehouse();
  db.query(
    "SELECT warehouse_type FROM warehouses WHERE id = ? AND is_active = 1 LIMIT 1",
    [req.warehouseScopeId],
    (warehouseErr, rows) => {
      if (warehouseErr) return res.status(500).json({ success: false, message: 'Không thể xác minh quyền Kho Tổng: ' + warehouseErr.sqlMessage });
      if (!rows.length || rows[0].warehouse_type !== 'central') {
        return res.status(403).json({ success: false, message: 'Chỉ tài khoản Kho Tổng mới được tạo kho con.' });
      }
      createWarehouse();
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
  const sql = `SELECT * FROM orders
    WHERE (? IS NULL OR shop_id = ?)
      AND (? IS NULL OR current_warehouse_id = ?)
    ORDER BY created_at DESC`;
  const shopId = req.shopScopeId || null;
  const warehouseId = req.warehouseScopeId || null;
  db.query(sql, [shopId, shopId, warehouseId, warehouseId], (err, results) => {
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

function removeNewsUpload(file) {
  if (!file) return;
  fs.unlink(file.path, (err) => {
    if (err && err.code !== 'ENOENT') console.error('Không thể xóa ảnh tin tức không được lưu:', err);
  });
}

function removeNewsImage(imageUrl) {
  const value = String(imageUrl || '');
  if (!/^\/uploads\/news-[\w-]+\.(?:jpg|png|webp)$/i.test(value)) return;
  fs.unlink(path.join(uploadDir, path.basename(value)), (err) => {
    if (err && err.code !== 'ENOENT') console.error('Không thể xóa ảnh tin tức:', err);
  });
}

app.post('/api/news', parseNewsImage, (req, res) => {
  const { title, summary, content, image_url, category, created_by, status } = req.body;

  if (!title || !summary || !content) {
    removeNewsUpload(req.file);
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

  const savedImageUrl = req.file ? `/uploads/${req.file.filename}` : image_url || null;
  db.query(sql, [title, slug, summary, content, savedImageUrl, category || 'Tin tức', created_by || 'content_team', status || 'published'], (err, result) => {
    if (err) {
      removeNewsUpload(req.file);
      return res.status(500).json({ success: false, message: 'Lỗi lưu tin tức: ' + err.sqlMessage });
    }
    res.json({ success: true, message: 'Đã lưu tin tức thành công.', articleId: result.insertId });
  });
});

app.put('/api/news/:id', parseNewsImage, (req, res) => {
  const { title, summary, content, image_url, category, status } = req.body;

  if (!title || !summary || !content) {
    removeNewsUpload(req.file);
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

  db.query('SELECT image_url FROM news_articles WHERE id = ? LIMIT 1', [req.params.id], (selectErr, articles) => {
    if (selectErr) {
      removeNewsUpload(req.file);
      return res.status(500).json({ success: false, message: 'Lỗi tải tin tức cần cập nhật: ' + selectErr.sqlMessage });
    }
    if (!articles.length) {
      removeNewsUpload(req.file);
      return res.status(404).json({ success: false, message: 'Không tìm thấy bài tin tức.' });
    }

    const previousImageUrl = articles[0].image_url;
    const savedImageUrl = req.file ? `/uploads/${req.file.filename}` : image_url || null;
    const sql = `
      UPDATE news_articles
      SET title = ?, slug = ?, summary = ?, content = ?, image_url = ?, category = ?, status = ?
      WHERE id = ?
    `;

    db.query(sql, [title, slug, summary, content, savedImageUrl, category || 'Tin tức', status || 'published', req.params.id], (err) => {
      if (err) {
        removeNewsUpload(req.file);
        return res.status(500).json({ success: false, message: 'Lỗi cập nhật tin tức: ' + err.sqlMessage });
      }
      if (req.file && previousImageUrl !== savedImageUrl) removeNewsImage(previousImageUrl);
      res.json({ success: true, message: 'Đã cập nhật bài tin tức thành công.' });
    });
  });
});

app.delete('/api/news/:id', (req, res) => {
  db.query('SELECT image_url FROM news_articles WHERE id = ? LIMIT 1', [req.params.id], (selectErr, articles) => {
    if (selectErr) return res.status(500).json({ success: false, message: 'Lỗi tải tin tức cần xóa: ' + selectErr.sqlMessage });
    if (!articles.length) return res.status(404).json({ success: false, message: 'Không tìm thấy bài tin tức.' });

    db.query('DELETE FROM news_articles WHERE id = ?', [req.params.id], (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Lỗi xóa tin tức: ' + err.sqlMessage });
      removeNewsImage(articles[0].image_url);
      res.json({ success: true, message: 'Đã xóa bài tin tức thành công.' });
    });
  });
});

app.get('/api/orders/track/:code', trackPublicRequest, (req, res) => {
  const sql = `
    SELECT o.id, o.tracking_code, o.status, o.receiver_name, o.receiver_phone,
      o.receiver_address, o.receiver_lat, o.receiver_lng, o.cod_amount, o.shipping_fee,
      o.shop_lat, o.shop_lng, o.shop_address, o.proof_image, o.fail_reason,
      o.pickup_attempts, o.delivery_attempts,
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
      lat: 10.8231,
      lng: 106.6881,
      label: 'Kho tổng Gò Vấp',
      address: 'Số 2 Nguyễn Văn Bảo, Gò Vấp, TP. Hồ Chí Minh'
    };
    const pickup = { label: 'Điểm lấy hàng', address: 'Gò Vấp' };
    const delivery = { label: 'Điểm giao hàng', address: 'Gò Vấp' };

    const driverPosSql = 'SELECT * FROM driver_positions WHERE order_id = ? ORDER BY created_at DESC LIMIT 1';
    db.query(driverPosSql, [order.id], (driverErr, driverResults) => {
      const driverLocation = driverResults && driverResults.length > 0
        ? { lat: driverResults[0].lat, lng: driverResults[0].lng, updated_at: driverResults[0].created_at }
        : null;

      db.query(
        'SELECT id, from_status, to_status, created_at FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC, id ASC',
        [order.id],
        (historyErr, statusHistory) => {
          res.json({
            success: true,
            data: {
              ...redactPublicTrackingOrder(redactDeliveryOtp([order])[0]),
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
                completed: 100,
                pickup_failed: 10,
                delivery_failed: 85,
                return_pending: 92,
                returning: 96,
                returned: 100,
                cancelled: 100
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
          COALESCE(o.return_shipper_id, o.delivery_shipper_id, o.destination_transfer_shipper_id, o.central_transfer_shipper_id, o.pickup_shipper_id) AS shipper_id,
          o.shop_address, o.shop_province, o.receiver_address, o.receiver_lat, o.receiver_lng,
          ow.id AS origin_warehouse_id, ow.name AS origin_warehouse_name, ow.address AS origin_warehouse_address, ow.lat AS origin_warehouse_lat, ow.lng AS origin_warehouse_lng,
          dw.id AS destination_warehouse_id, dw.name AS destination_warehouse_name, dw.address AS destination_warehouse_address, dw.lat AS destination_warehouse_lat, dw.lng AS destination_warehouse_lng,
           10.8231 AS warehouse_lat,
           106.6881 AS warehouse_lng,
          COALESCE(o.shop_lat, dr.pickup_lat, 10.8231) AS pickup_lat,
          COALESCE(o.shop_lng, dr.pickup_lng, 106.6881) AS pickup_lng,
          COALESCE(o.receiver_lat, dr.delivery_lat, 10.8231) AS delivery_lat,
          COALESCE(o.receiver_lng, dr.delivery_lng, 106.6881) AS delivery_lng,
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
          OR o.destination_transfer_shipper_id = ? OR o.delivery_shipper_id = ? OR o.return_shipper_id = ?
        ))
      )
    LIMIT 1
  `;

  db.query(sql, [orderId, role, role, userId, role, userId, userId, userId, userId, userId], (err, results) => {
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
        label: 'Kho tổng Gò Vấp',
        address: 'Số 2 Nguyễn Văn Bảo, Gò Vấp, TP. Hồ Chí Minh'
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
        { lat: Number(order.warehouse_lat), lng: Number(order.warehouse_lng), label: 'Kho tổng Gò Vấp' },
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
      : order.status === 'returning'
      ? { origin: centralWarehouse, destination: route.pickup, label: 'Mang hàng hoàn về Shop' }
      : ['at_central_warehouse', 'at_destination_warehouse', 'delivering'].includes(order.status)
      ? { origin: centralWarehouse, destination: route.delivery, label: 'Kho tổng Gò Vấp đến người nhận' }
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
      COALESCE(p.max_order_value, 0) AS max_order_value,
      COALESCE(p.service_areas, '') AS service_areas,
      COALESCE(loads.active_count, 0) AS active_count,
      COALESCE(loads.active_weight_kg, 0) AS active_weight_kg,
      GREATEST(0, COALESCE(wallet.balance, 0) - COALESCE(wallet.reserved_balance, 0)) AS available_deposit
    FROM users u
    LEFT JOIN driver_dispatch_profiles p ON p.driver_id = u.id
    LEFT JOIN driver_wallets wallet ON wallet.driver_id = u.id
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
          WHERE delivery_shipper_id IS NOT NULL AND status IN ('at_central_warehouse','at_destination_warehouse','delivering')
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

app.put('/api/dispatcher/driver-profiles/:driverId', async (req, res) => {
  const driverId = Number(req.params.driverId);
  const maxActiveOrders = Number(req.body.max_active_orders);
  const maxPayloadKg = Number(req.body.max_payload_kg);
  let maxOrderValue;
  try {
    maxOrderValue = parseMoney(req.body.max_order_value ?? 0);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
  const serviceAreas = String(req.body.service_areas || '').trim();
  if (!Number.isInteger(driverId) || driverId <= 0
    || !Number.isInteger(maxActiveOrders) || maxActiveOrders < 1 || maxActiveOrders > 100
    || !Number.isFinite(maxPayloadKg) || maxPayloadKg <= 0 || maxPayloadKg > 100000
    || maxOrderValue > 10000000000n
    || serviceAreas.length > 500) {
    return res.status(400).json({ success: false, message: 'Giới hạn đơn, tải trọng, giá trị hàng hoặc khu vực tài xế không hợp lệ.' });
  }
  try {
    await withTransaction(transactionPool, async (connection) => {
      const drivers = await queryAsync(
        connection,
        `SELECT id FROM users
         WHERE id = ? AND role IN ('pickup_driver','delivery_driver') AND status = 'active'
         FOR UPDATE`,
        [driverId]
      );
      if (!drivers.length) {
        const error = new Error('Không tìm thấy tài xế đang hoạt động.');
        error.statusCode = 404;
        throw error;
      }

      const currentProfiles = await queryAsync(
        connection,
        `SELECT max_active_orders, max_payload_kg, max_order_value, service_areas
         FROM driver_dispatch_profiles WHERE driver_id = ? FOR UPDATE`,
        [driverId]
      );
      const oldValue = currentProfiles[0] || {
        max_active_orders: 10,
        max_payload_kg: 100,
        max_order_value: '0',
        service_areas: ''
      };
      const newValue = {
        max_active_orders: maxActiveOrders,
        max_payload_kg: maxPayloadKg,
        max_order_value: maxOrderValue.toString(),
        service_areas: serviceAreas
      };
      await queryAsync(
        connection,
        `INSERT INTO driver_dispatch_profiles (driver_id, max_active_orders, max_payload_kg, max_order_value, service_areas)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE max_active_orders = VALUES(max_active_orders),
           max_payload_kg = VALUES(max_payload_kg), max_order_value = VALUES(max_order_value),
           service_areas = VALUES(service_areas)`,
        [driverId, maxActiveOrders, maxPayloadKg, maxOrderValue.toString(), serviceAreas]
      );
      await queryAsync(
        connection,
        `INSERT INTO audit_logs
          (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, ip)
         VALUES (?, ?, 'driver.dispatch_profile.updated', 'driver_dispatch_profile', ?, ?, ?, ?)`,
        [
          req.authUser.id,
          req.authRole,
          String(driverId),
          JSON.stringify(oldValue),
          JSON.stringify(newValue),
          req.ip || null
        ]
      );
    });
    return res.json({ success: true, message: 'Đã lưu giới hạn tải và khu vực phụ trách.' });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: err.message });
    }
    console.error('Lỗi lưu hồ sơ điều phối tài xế:', err);
    return res.status(500).json({ success: false, message: 'Không thể lưu hồ sơ điều phối tài xế.' });
  }
});

app.get('/api/shippers', (req, res) => {
  const taskType = req.query.type;
  if (!['pickup', 'delivery', 'linehaul'].includes(taskType)) {
    return res.status(400).json({ success: false, message: 'Loại nhiệm vụ điều phối không hợp lệ.' });
  }
  const role = taskType === 'linehaul' ? 'linehaul_driver' : taskType === 'delivery' ? 'delivery_driver' : 'pickup_driver';
  const sql = 'SELECT id, full_name, email, role FROM users WHERE role = ? AND status = "active"';
  db.query(sql, [role], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true, data: redactDeliveryOtp(results) });
  });
});

async function getCentralWarehousePoint(connection) {
  const rows = await queryAsync(
    connection,
    `SELECT w.id, w.lat, w.lng, w.address
     FROM system_settings setting
     JOIN warehouses w ON w.id = CAST(setting.setting_value AS UNSIGNED)
     WHERE setting.setting_key = 'central_warehouse_id'
       AND w.warehouse_type = 'central' AND w.is_active = 1 AND w.is_configured = 1
     LIMIT 1`
  );
  if (!rows.length || !Number.isFinite(Number(rows[0].lat)) || !Number.isFinite(Number(rows[0].lng))) {
    throw new Error('Chưa cấu hình tọa độ kho tổng Gò Vấp.');
  }
  return { ...rows[0], lat: Number(rows[0].lat), lng: Number(rows[0].lng) };
}

async function optimizeDriverRouteInTransaction(connection, driverId, mode, actor, reason) {
  const driverRows = await queryAsync(
    connection,
    'SELECT id, role FROM users WHERE id = ? AND status = "active" FOR UPDATE',
    [driverId]
  );
  if (!driverRows.length) throw new Error('Không tìm thấy tài xế đang hoạt động.');
  const driverRole = mode === 'pickup' ? 'pickup_driver' : 'delivery_driver';
  if (driverRows[0].role !== driverRole) throw new Error('Loại lộ trình không khớp vai trò tài xế.');

  const warehouse = await getCentralWarehousePoint(connection);
  const positions = await queryAsync(
    connection,
    'SELECT lat, lng FROM driver_positions WHERE shipper_id = ? ORDER BY created_at DESC, id DESC LIMIT 1',
    [driverId]
  );
  const completedRows = await queryAsync(
    connection,
    `SELECT id FROM driver_route_stops
     WHERE driver_id = ? AND task_type ${mode === 'pickup' ? "= 'pickup'" : "IN ('delivery','return')"}
       AND status = 'completed' LIMIT 1`,
    [driverId]
  );
  const activeRouteRows = await queryAsync(
    connection,
    `SELECT route.optimized_at
     FROM driver_routes route
     JOIN orders o ON o.id = route.order_id
     WHERE route.shipper_id = ? AND route.mode = ?
       AND ((? = 'pickup' AND o.pickup_shipper_id = ? AND o.status IN ('picking','picked_up'))
         OR (? = 'delivery' AND (
           (o.delivery_shipper_id = ? AND o.status IN ('at_central_warehouse','at_destination_warehouse','delivering'))
           OR (o.return_shipper_id = ? AND o.status = 'returning')
         )))
     ORDER BY route.optimized_at DESC, route.id DESC LIMIT 1`,
    [driverId, mode, mode, driverId, mode, driverId, driverId]
  );
  const hasExistingOptimizedRoute = Boolean(activeRouteRows[0]?.optimized_at);
  const startPoint = positions.length && (
    mode === 'pickup' || reason === 'off_route' || completedRows.length || hasExistingOptimizedRoute
  )
    ? { lat: Number(positions[0].lat), lng: Number(positions[0].lng) }
    : { lat: warehouse.lat, lng: warehouse.lng };
  const endPoint = mode === 'pickup' ? { lat: warehouse.lat, lng: warehouse.lng } : null;

  const taskClause = mode === 'pickup'
    ? "stop.task_type = 'pickup' AND o.pickup_shipper_id = ? AND o.status = 'picking'"
    : `stop.task_type IN ('delivery','return') AND (
        (stop.task_type = 'delivery' AND o.delivery_shipper_id = ? AND o.status IN ('at_central_warehouse','at_destination_warehouse','delivering'))
        OR (stop.task_type = 'return' AND o.return_shipper_id = ? AND o.status = 'returning')
      )`;
  const parameters = mode === 'pickup' ? [driverId, driverId] : [driverId, driverId, driverId];
  const routeRows = await queryAsync(
    connection,
    `SELECT stop.id AS stop_id, stop.order_id, stop.task_type, stop.stop_sequence, stop.stop_order,
       stop.lat, stop.lng, stop.address, stop.is_manual_override,
       o.shop_id, o.tracking_code, o.service_type, o.promised_delivery_at,
       o.pickup_deadline_at, o.pickup_appointment_at, o.created_at,
       o.pickup_attempts, o.delivery_attempts, o.status AS order_status,
       o.receiver_name, o.receiver_address, o.receiver_phone, o.shop_address,
       o.cod_amount, o.shipping_fee, o.fee_payer, o.weight_kg,
       CASE WHEN stop.task_type = 'pickup' THEN o.shop_lat ELSE o.receiver_lat END AS order_lat,
       CASE WHEN stop.task_type = 'pickup' THEN o.shop_lng ELSE o.receiver_lng END AS order_lng
     FROM driver_route_stops stop
     JOIN orders o ON o.id = stop.order_id
     WHERE stop.driver_id = ? AND stop.status = 'planned' AND ${taskClause}
     ORDER BY COALESCE(stop.stop_sequence, stop.stop_order), stop.id
     FOR UPDATE`,
    parameters
  );
  const settings = await queryAsync(
    connection,
    `SELECT setting_key, setting_value FROM system_settings
     WHERE setting_key IN (
       'ROUTE_PRIORITY_EXPRESS_SECONDS','ROUTE_PRIORITY_SLA_SECONDS',
       'ROUTE_PRIORITY_FAILED_SECONDS','ROUTE_PRIORITY_APPOINTMENT_SECONDS',
       'ROUTE_NEAR_SLA_HOURS','ROUTE_MAX_ACTIVE_STOPS',
       'PICKUP_FIFO_BUCKET_MINUTES','PICKUP_MAX_WAIT_MINUTES',
       'PICKUP_SLA_MINUTES','PICKUP_PRIORITY_ORDER'
     )`
  );
  const settingMap = new Map(settings.map((setting) => [setting.setting_key, Number(setting.setting_value)]));
  const numberSetting = (key, fallback) => (
    Number.isFinite(settingMap.get(key)) ? settingMap.get(key) : fallback
  );
  const pickupPriorityOrder = String(
    settings.find((setting) => setting.setting_key === 'PICKUP_PRIORITY_ORDER')?.setting_value
      || 'fifo,deadline,distance'
  );
  const maxStops = Math.min(60, Math.max(1, settingMap.get('ROUTE_MAX_ACTIVE_STOPS') || 60));
  if (routeRows.length > maxStops) throw new Error(`Lộ trình vượt quá giới hạn ${maxStops} điểm dừng.`);
  const now = Date.now();
  const nearSlaMs = (settingMap.get('ROUTE_NEAR_SLA_HOURS') || 2) * 60 * 60 * 1000;
  const stops = routeRows.map((row) => {
    const serviceType = String(row.service_type || '').toLowerCase();
    const promisedAt = row.promised_delivery_at ? new Date(row.promised_delivery_at).getTime() : null;
    let prioritySeconds = 0;
    if (mode === 'delivery') {
      prioritySeconds = serviceType === 'express'
        ? (settingMap.get('ROUTE_PRIORITY_EXPRESS_SECONDS') || 1800) : 0;
      if (Number.isFinite(promisedAt) && promisedAt - now <= nearSlaMs) {
        prioritySeconds += settingMap.get('ROUTE_PRIORITY_SLA_SECONDS') || 1200;
      }
      if (Number(row.delivery_attempts) > 0) {
        prioritySeconds += settingMap.get('ROUTE_PRIORITY_FAILED_SECONDS') || 900;
      }
    }
    const isPickup = row.task_type === 'pickup' || row.task_type === 'return';
    return {
      ...row,
      id: Number(row.stop_id),
      order_id: Number(row.order_id),
      lat: Number(row.order_lat ?? row.lat),
      lng: Number(row.order_lng ?? row.lng),
      address: isPickup ? row.shop_address : row.task_type === 'return' ? row.shop_address : row.receiver_address,
      appointmentAt: row.pickup_appointment_at || null,
      prioritySeconds,
      pickup_deadline_at: row.pickup_deadline_at || null
    };
  });
  const route = await optimizeRoute({
    driverId,
    mode,
    stops,
    startPoint,
    endPoint,
    priorityWeights: {
      express: settingMap.get('ROUTE_PRIORITY_EXPRESS_SECONDS') || 1800,
      nearSla: settingMap.get('ROUTE_PRIORITY_SLA_SECONDS') || 1200,
      failedOnce: settingMap.get('ROUTE_PRIORITY_FAILED_SECONDS') || 900,
      appointment: settingMap.get('ROUTE_PRIORITY_APPOINTMENT_SECONDS') || 600
    },
    pickupFifoBucketMinutes: numberSetting('PICKUP_FIFO_BUCKET_MINUTES', 30),
    pickupMaxWaitMinutes: numberSetting('PICKUP_MAX_WAIT_MINUTES', 120),
    pickupSlaMinutes: numberSetting('PICKUP_SLA_MINUTES', 120),
    pickupPriorityOrder
  });
  const orderIds = route.stops.flatMap((stop) => stop.orderIds);
  for (const stop of route.stops) {
    await queryAsync(
      connection,
      `UPDATE driver_route_stops
       SET stop_sequence = ?, stop_order = ?, planned_eta = ?,
         distance_from_previous_m = ?, duration_from_previous_s = ?,
         ranking_reason = ?,
         is_manual_override = 0, override_reason = NULL
       WHERE driver_id = ? AND task_type IN (?) AND order_id IN (?) AND status = 'planned'`,
      [
        stop.stopSequence, stop.stopSequence, new Date(stop.plannedEta).toISOString().slice(0, 19).replace('T', ' '),
        stop.distanceFromPreviousM, stop.durationFromPreviousS, stop.rankingReason || null, driverId,
        mode === 'pickup' ? ['pickup'] : ['delivery', 'return'], stop.orderIds
      ]
    );
  }
  if (orderIds.length) {
    await queryAsync(
      connection,
      `UPDATE driver_routes SET mode = ?, total_distance_m = ?, total_duration_s = ?,
         is_estimated = ?, optimized_at = CURRENT_TIMESTAMP
       WHERE shipper_id = ? AND order_id IN (?)`,
      [mode, route.totalDistanceM, route.totalDurationS, route.isEstimated ? 1 : 0, driverId, orderIds]
    );
  }
  const snapshot = route.stops.map((stop) => ({
    sequence: stop.stopSequence,
    order_ids: stop.orderIds,
    address: stop.address,
    ranking_reason: stop.rankingReason || null,
    eta: stop.plannedEta,
    distance_from_previous_m: stop.distanceFromPreviousM
  }));
  await queryAsync(
    connection,
    `INSERT INTO driver_route_optimization_history
     (driver_id, mode, actor_id, actor_role, reason, is_estimated, total_distance_m, total_duration_s, route_snapshot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [driverId, mode, actor?.id || null, actor?.role || 'system', reason,
      route.isEstimated ? 1 : 0, route.totalDistanceM, route.totalDurationS, JSON.stringify(snapshot)]
  );
  return route;
}

async function recalculateDriverRoute(driverId, mode, actor, reason) {
  return withTransaction(transactionPool, (connection) => (
    optimizeDriverRouteInTransaction(connection, Number(driverId), mode, actor, reason)
  ));
}

async function handleRouteDeviation(driverId, mode, lat, lng) {
  const taskTypeClause = mode === 'pickup' ? "= 'pickup'" : "IN ('delivery','return')";
  const rows = await queryAsync(
    db,
    `SELECT stop.lat, stop.lng, stop.stop_sequence, stop.status
     FROM driver_route_stops stop
     WHERE stop.driver_id = ? AND stop.task_type ${taskTypeClause}
     ORDER BY COALESCE(stop.stop_sequence, stop.stop_order), stop.id`,
    [driverId]
  );
  const nextIndex = rows.findIndex((row) => row.status === 'planned');
  if (nextIndex < 0) return;
  const previous = rows.slice(0, nextIndex).reverse().find((row) => row.status === 'completed');
  const warehouse = await getCentralWarehousePoint(db);
  const deviationM = await getRouteDeviationMeters({
    point: { lat, lng },
    segmentStart: previous
      ? { lat: Number(previous.lat), lng: Number(previous.lng) }
      : { lat: warehouse.lat, lng: warehouse.lng },
    segmentEnd: { lat: Number(rows[nextIndex].lat), lng: Number(rows[nextIndex].lng) }
  });
  const settings = await queryAsync(
    db,
    `SELECT setting_key, setting_value FROM system_settings
     WHERE setting_key IN ('ROUTE_DEVIATION_THRESHOLD_M')`
  );
  const thresholdM = Math.max(50, Number(settings[0]?.setting_value || 300));
  if (deviationM <= thresholdM) return;
  const latest = await queryAsync(
    db,
    'SELECT optimized_at FROM driver_routes WHERE shipper_id = ? AND mode = ? ORDER BY optimized_at DESC LIMIT 1',
    [driverId, mode]
  );
  if (latest[0]?.optimized_at && Date.now() - new Date(latest[0].optimized_at).getTime() < 120_000) return;
  await recalculateDriverRoute(driverId, mode, null, 'off_route');
  io.to(`user:${driverId}`).emit('driver_route_updated', { driver_id: driverId, mode, deviation_m: Math.round(deviationM) });
  io.to('fleet_tracking').emit('driver_route_deviation', {
    driver_id: driverId,
    mode,
    deviation_m: Math.round(deviationM),
    threshold_m: thresholdM
  });
}

function optimizeDriverRouteStops(driverId, taskType, callback) {
  const mode = taskType === 'pickup' ? 'pickup' : 'delivery';
  recalculateDriverRoute(driverId, mode, null, 'new_order')
    .then((route) => callback(null, route.stops))
    .catch(callback);
}

function appendDriverRouteStop(driverId, order, taskType, callback) {
  const isPickup = taskType !== 'delivery';
  const latitude = Number(isPickup ? order.shop_lat : order.receiver_lat);
  const longitude = Number(isPickup ? order.shop_lng : order.receiver_lng);
  const address = String(isPickup ? order.shop_address : order.receiver_address);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !address) {
    return callback(new Error('Đơn hàng thiếu tọa độ hoặc địa chỉ để lập lộ trình.'));
  }
  withTransaction(transactionPool, async (connection) => {
    await queryAsync(connection, 'SELECT id FROM users WHERE id = ? FOR UPDATE', [driverId]);
    const sequenceRows = await queryAsync(
      connection,
      'SELECT COALESCE(MAX(stop_order), 0) + 1 AS next_order FROM driver_route_stops WHERE driver_id = ? AND task_type = ? AND status = "planned"',
      [driverId, taskType]
    );
    await queryAsync(
      connection,
      `INSERT INTO driver_route_stops (driver_id, order_id, task_type, stop_order, stop_sequence, lat, lng, address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE lat = VALUES(lat), lng = VALUES(lng), address = VALUES(address), status = 'planned'`,
      [driverId, order.id, taskType, Number(sequenceRows[0].next_order), Number(sequenceRows[0].next_order), latitude, longitude, address]
    );
    return optimizeDriverRouteInTransaction(connection, driverId, taskType === 'pickup' ? 'pickup' : 'delivery', null, 'new_order');
  }).then((route) => callback(null, route.stops)).catch(callback);
}

function getDriverRoutePayload(driverId, mode, callback) {
  const taskClause = mode === 'pickup'
    ? "stop.task_type = 'pickup' AND o.pickup_shipper_id = ? AND o.status IN ('picking','picked_up')"
    : `((stop.task_type = 'delivery' AND o.delivery_shipper_id = ? AND o.status IN ('at_central_warehouse','at_destination_warehouse','delivering'))
      OR (stop.task_type = 'return' AND o.return_shipper_id = ? AND o.status = 'returning'))`;
  const driverParams = mode === 'pickup' ? [driverId, driverId] : [driverId, driverId, driverId];
  db.query(
    `SELECT stop.id AS stop_id, stop.order_id, stop.task_type, COALESCE(stop.stop_sequence, stop.stop_order) AS stop_sequence,
       stop.planned_eta, stop.actual_arrival, stop.ranking_reason, stop.lat, stop.lng, stop.address,
       o.tracking_code, o.status AS order_status, o.receiver_name, o.receiver_address,
       o.shop_address, o.cod_amount, o.shipping_fee, o.fee_payer, o.shop_id,
       CASE WHEN stop.task_type IN ('pickup','return') THEN o.shop_lat ELSE o.receiver_lat END AS order_lat,
       CASE WHEN stop.task_type IN ('pickup','return') THEN o.shop_lng ELSE o.receiver_lng END AS order_lng
     FROM driver_route_stops stop JOIN orders o ON o.id = stop.order_id
     WHERE stop.driver_id = ? AND stop.status = 'planned' AND ${taskClause}
     ORDER BY COALESCE(stop.stop_sequence, stop.stop_order), stop.id`,
    driverParams,
    (err, rows) => {
      if (err) return callback(err);
      const groups = groupStops(rows.map((row) => ({
        ...row,
        id: Number(row.stop_id),
        order_id: Number(row.order_id),
        lat: Number(row.order_lat ?? row.lat),
        lng: Number(row.order_lng ?? row.lng),
        address: row.task_type === 'pickup' || row.task_type === 'return' ? row.shop_address : row.receiver_address
      })), mode).map((group) => ({
        ...group,
        stop_ids: group.orders.map((order) => Number(order.stop_id)),
        order_ids: group.orderIds,
        stop_sequence: Math.min(...group.orders.map((order) => Number(order.stop_sequence || 0))),
        tracking_codes: group.orders.map((order) => order.tracking_code),
        cod_to_collect: group.orders.reduce((total, order) => total
          + Number(order.cod_amount || 0)
          + (order.fee_payer === 'receiver' ? Number(order.shipping_fee || 0) : 0), 0),
        eta: group.orders.find((order) => order.planned_eta)?.planned_eta || null,
        ranking_reason: group.orders.find((order) => order.ranking_reason)?.ranking_reason || null,
        address: group.orders[0].address
      })).sort((first, second) => first.stop_sequence - second.stop_sequence);
      db.query(
        `SELECT total_distance_m, total_duration_s, is_estimated, optimized_at
         FROM driver_routes WHERE shipper_id = ? AND mode = ?
         ORDER BY optimized_at DESC, id DESC LIMIT 1`,
        [driverId, mode],
        (routeErr, routeRows) => {
          if (routeErr) return callback(routeErr);
          callback(null, {
            mode,
            stops: groups,
            next_stop: groups[0] || null,
            summary: routeRows[0] || { total_distance_m: 0, total_duration_s: 0, is_estimated: true, optimized_at: null }
          });
        }
      );
    }
  );
}

app.get('/api/driver/route/today', (req, res) => {
  const { driverId, modes } = getDriverRouteScope(req.authUser);
  const routes = {};
  const loadNext = (index) => {
    if (index >= modes.length) return res.json({ success: true, data: routes });
    const mode = modes[index];
    getDriverRoutePayload(driverId, mode, (err, payload) => {
      if (err) return res.status(500).json({ success: false, message: `Không tải được lộ trình ${mode}: ${err.sqlMessage || err.message}` });
      routes[mode] = payload;
      loadNext(index + 1);
    });
  };
  loadNext(0);
});

app.get('/api/dispatch/route/:driverId/today', (req, res) => {
  const driverId = Number(req.params.driverId);
  if (!Number.isSafeInteger(driverId) || driverId <= 0) {
    return res.status(400).json({ success: false, message: 'Mã tài xế không hợp lệ.' });
  }
  db.query('SELECT role FROM users WHERE id = ? AND status = "active" LIMIT 1', [driverId], (driverErr, drivers) => {
    if (driverErr) return res.status(500).json({ success: false, message: 'Không thể tải tài xế.' });
    if (!drivers.length) return res.status(404).json({ success: false, message: 'Không tìm thấy tài xế.' });
    const mode = drivers[0].role === 'pickup_driver' ? 'pickup' : 'delivery';
    getDriverRoutePayload(driverId, mode, (err, payload) => {
      if (err) return res.status(500).json({ success: false, message: `Không tải được lộ trình: ${err.sqlMessage || err.message}` });
      res.json({ success: true, data: payload });
    });
  });
});

app.post('/api/dispatch/route/optimize/:driverId', async (req, res) => {
  const driverId = Number(req.params.driverId);
  if (!Number.isSafeInteger(driverId) || driverId <= 0) {
    return res.status(400).json({ success: false, message: 'Mã tài xế không hợp lệ.' });
  }
  try {
    const drivers = await queryAsync(db, 'SELECT role FROM users WHERE id = ? AND status = "active" LIMIT 1', [driverId]);
    if (!drivers.length || !driverRoles.has(drivers[0].role)) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài xế phù hợp.' });
    }
    const mode = drivers[0].role === 'pickup_driver' ? 'pickup' : 'delivery';
    const route = await recalculateDriverRoute(
      driverId, mode, { id: Number(req.authUser.id), role: req.authRole }, 'manual'
    );
    io.to(`user:${driverId}`).emit('driver_route_updated', { driver_id: driverId, mode });
    res.json({ success: true, data: route, message: 'Đã tối ưu lại lộ trình.' });
  } catch (error) {
    console.error('Không thể tối ưu lại lộ trình tài xế:', error);
    res.status(500).json({ success: false, message: error.message || 'Không thể tối ưu lại lộ trình.' });
  }
});

app.post('/api/driver/route/reorder', async (req, res) => {
  const driverId = Number(req.authUser.id);
  const mode = String(req.body.mode || '');
  const reason = String(req.body.override_reason || '').trim();
  const orderedStopIds = req.body.ordered_stop_ids;
  if (!['pickup', 'delivery'].includes(mode) || !reason || reason.length > 500
    || !Array.isArray(orderedStopIds) || orderedStopIds.some((id) => !Number.isSafeInteger(Number(id)))) {
    return res.status(400).json({ success: false, message: 'Cần loại lộ trình, thứ tự điểm dừng và lý do đổi tuyến hợp lệ.' });
  }
  try {
    const result = await withTransaction(transactionPool, async (connection) => {
      const drivers = await queryAsync(connection, 'SELECT id, role FROM users WHERE id = ? FOR UPDATE', [driverId]);
      const expectedRole = mode === 'pickup' ? 'pickup_driver' : 'delivery_driver';
      if (!drivers.length || drivers[0].role !== expectedRole) {
        const error = new Error('Bạn không có quyền thay đổi lộ trình này.');
        error.statusCode = 403;
        throw error;
      }
      const route = await getCentralWarehousePoint(connection);
      const rows = await queryAsync(
        connection,
        `SELECT stop.id AS stop_id, stop.order_id, stop.task_type, stop.stop_sequence, stop.stop_order,
           stop.lat, stop.lng, stop.address, stop.is_manual_override,
           o.shop_id, o.tracking_code, o.shop_address, o.receiver_address,
           CASE WHEN stop.task_type IN ('pickup','return') THEN o.shop_lat ELSE o.receiver_lat END AS order_lat,
           CASE WHEN stop.task_type IN ('pickup','return') THEN o.shop_lng ELSE o.receiver_lng END AS order_lng,
           CASE WHEN stop.task_type = 'pickup' THEN o.pickup_shipper_id ELSE COALESCE(o.delivery_shipper_id, o.return_shipper_id) END AS assigned_driver
         FROM driver_route_stops stop JOIN orders o ON o.id = stop.order_id
         WHERE stop.driver_id = ? AND stop.status = 'planned'
           AND ((? = 'pickup' AND stop.task_type = 'pickup' AND o.pickup_shipper_id = ?)
             OR (? = 'delivery' AND stop.task_type IN ('delivery','return')
               AND (o.delivery_shipper_id = ? OR o.return_shipper_id = ?)))
         ORDER BY COALESCE(stop.stop_sequence, stop.stop_order), stop.id FOR UPDATE`,
        [driverId, mode, driverId, mode, driverId, driverId]
      );
      const groups = groupStops(rows.map((row) => ({
        ...row,
        id: Number(row.stop_id),
        order_id: Number(row.order_id),
        lat: Number(row.order_lat ?? row.lat),
        lng: Number(row.order_lng ?? row.lng),
        address: row.task_type === 'pickup' || row.task_type === 'return' ? row.shop_address : row.receiver_address
      })), mode).map((group) => ({
        ...group,
        stopIds: group.orders.map((order) => Number(order.stop_id))
      }));
      const expectedIds = new Set(groups.map((group) => group.stopIds[0]));
      const requestedIds = orderedStopIds.map(Number);
      if (requestedIds.length !== groups.length || new Set(requestedIds).size !== groups.length
        || requestedIds.some((id) => !expectedIds.has(id))) {
        const error = new Error('Danh sách điểm dừng đã thay đổi; hãy tải lại tuyến rồi thử lại.');
        error.statusCode = 409;
        throw error;
      }
      const byRepresentative = new Map(groups.map((group) => [group.stopIds[0], group]));
      const orderedGroups = requestedIds.map((id) => byRepresentative.get(id));
      const point = { lat: Number(route.lat), lng: Number(route.lng) };
      const measured = await measureOrderedRoute({
        driverId, mode, stops: orderedGroups, startPoint: point, endPoint: mode === 'pickup' ? point : null
      });
      for (const stop of measured.stops) {
        const group = orderedGroups[stop.stopSequence - 1];
        await queryAsync(
          connection,
          `UPDATE driver_route_stops
           SET stop_sequence = ?, stop_order = ?, planned_eta = ?,
             distance_from_previous_m = ?, duration_from_previous_s = ?,
             is_manual_override = 1, override_reason = ?
           WHERE driver_id = ? AND id IN (?) AND status = 'planned'`,
          [stop.stopSequence, stop.stopSequence, stop.plannedEta.slice(0, 19).replace('T', ' '),
            stop.distanceFromPreviousM, stop.durationFromPreviousS, reason, driverId, group.stopIds]
        );
      }
      const orderIds = rows.map((row) => Number(row.order_id));
      if (orderIds.length) {
        await queryAsync(
          connection,
          `UPDATE driver_routes SET mode = ?, total_distance_m = ?, total_duration_s = ?,
             is_estimated = ?, optimized_at = CURRENT_TIMESTAMP
           WHERE shipper_id = ? AND order_id IN (?)`,
          [mode, measured.totalDistanceM, measured.totalDurationS, measured.isEstimated ? 1 : 0, driverId, orderIds]
        );
      }
      await queryAsync(
        connection,
        `INSERT INTO driver_route_optimization_history
         (driver_id, mode, actor_id, actor_role, reason, is_estimated, total_distance_m, total_duration_s, route_snapshot)
         VALUES (?, ?, ?, ?, 'manual', ?, ?, ?, ?)`,
        [driverId, mode, Number(req.authUser.id), req.authRole, measured.isEstimated ? 1 : 0,
          measured.totalDistanceM, measured.totalDurationS, JSON.stringify(requestedIds)]
      );
      await queryAsync(
        connection,
        `INSERT INTO audit_logs
         (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, ip)
         VALUES (?, ?, 'driver.route.reordered', 'driver_route', ?, ?, ?, ?)`,
        [Number(req.authUser.id), req.authRole, String(driverId), JSON.stringify(groups.map((group) => group.stopIds)),
          JSON.stringify({ ordered_stop_ids: requestedIds, reason }), req.ip || null]
      );
      return measured;
    });
    io.to(`user:${driverId}`).emit('driver_route_updated', { driver_id: driverId, mode });
    res.json({ success: true, data: result, message: 'Đã lưu thứ tự lộ trình và lý do điều chỉnh.' });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    console.error('Không thể đổi thứ tự lộ trình:', error);
    res.status(500).json({ success: false, message: 'Không thể lưu thứ tự lộ trình.' });
  }
});

app.get('/api/driver/route-stops', (req, res) => {
  const driverId = Number(req.authUser.id);
  const taskType = normalizeRole(req.authUser.role) === 'pickup_driver' ? 'pickup' : 'delivery';
  db.query(
    `SELECT stop.stop_order, stop.task_type, stop.status AS stop_status,
       o.id AS order_id, o.tracking_code, o.status AS order_status, stop.address, stop.lat, stop.lng
     FROM driver_route_stops stop
     JOIN orders o ON o.id = stop.order_id
     WHERE stop.driver_id = ? AND stop.task_type = ? AND stop.status = 'planned'
       AND o.status NOT IN ('completed','cancelled')
     ORDER BY stop.stop_order, stop.id`,
    [driverId, taskType],
    (err, stops) => {
      if (err) return res.status(500).json({ success: false, message: 'Không tải được thứ tự điểm giao: ' + err.sqlMessage });
      res.json({ success: true, data: stops });
    }
  );
});

app.post('/api/dispatcher/route-stops/optimize', (req, res) => {
  const driverId = Number(req.body.driver_id);
  const taskType = String(req.body.task_type || '');
  if (!Number.isSafeInteger(driverId) || driverId <= 0 || !['pickup', 'delivery'].includes(taskType)) {
    return res.status(400).json({ success: false, message: 'Tài xế hoặc loại lộ trình không hợp lệ.' });
  }
  db.query(
    'SELECT id FROM users WHERE id = ? AND role = ? AND status = "active" LIMIT 1',
    [driverId, taskType === 'pickup' ? 'pickup_driver' : 'delivery_driver'],
    (driverErr, drivers) => {
      if (driverErr) return res.status(500).json({ success: false, message: 'Không kiểm tra được tài xế: ' + driverErr.sqlMessage });
      if (!drivers.length) return res.status(404).json({ success: false, message: 'Không tìm thấy tài xế phù hợp.' });
      optimizeDriverRouteStops(driverId, taskType, (routeErr, stops) => {
        if (routeErr) return res.status(500).json({ success: false, message: 'Không thể tối ưu thứ tự điểm giao: ' + routeErr.sqlMessage });
        res.json({ success: true, data: stops, message: 'Đã sắp xếp điểm giao theo khoảng cách gần nhất.' });
      });
    }
  );
});



app.put('/api/orders/:id/assign', (req, res) => {
  const { shipper_id, task_type } = req.body;
  const orderId = Number(req.params.id);
  const shipperId = Number(shipper_id);
  const tasks = {
    pickup: { role: 'pickup_driver', expected: 'pending', next: 'picking', column: 'pickup_shipper_id', label: 'lấy hàng tại Shop' },
    delivery: { role: 'delivery_driver', expected: 'at_central_warehouse', next: 'at_central_warehouse', column: 'delivery_shipper_id', label: 'giao hàng đến người nhận' },
    return: { role: 'delivery_driver', expected: 'return_pending', next: 'returning', column: 'return_shipper_id', label: 'hoàn hàng về Shop' }
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
    if (req.authRole === 'warehouse_manager'
      && (!['delivery', 'return'].includes(task_type)
        || Number(order.current_warehouse_id) !== Number(req.warehouseScopeId)
        || task_type === 'delivery' && Number(order.destination_warehouse_id) !== Number(req.warehouseScopeId))) {
      return res.status(403).json({ success: false, message: 'Kho chỉ được phân tài xế cho đơn đang thuộc kho tổng được giao.' });
    }

    db.query('SELECT id FROM users WHERE id = ? AND role = ? AND status = "active"', [shipperId, task.role], (driverErr, drivers) => {
      if (driverErr) return res.status(500).json({ success: false, message: 'Lỗi kiểm tra tài xế: ' + driverErr.sqlMessage });
      if (!drivers.length) return res.status(400).json({ success: false, message: 'Tài xế không thuộc đúng nhóm nhiệm vụ.' });

      const continueAssignment = (warehouseId = null, destinationWarehouseId = null) => {
        const updateAssignedOrder = () => {
        const previousDriverId = Number(order[task.column] || 0);
        const updates = {
          [task.column]: shipperId,
          storage_bin_id: null,
          cross_docked: 0
        };
        if (task_type === 'pickup') {
          updates.origin_warehouse_id = warehouseId;
          updates.destination_warehouse_id = destinationWarehouseId;
          updates.current_warehouse_id = null;
        }
        withTransaction(transactionPool, async (conn) => {
          const lockedOrders = await queryAsync(
            conn,
            `SELECT id, ${task.column} AS previous_driver_id FROM orders WHERE id = ? FOR UPDATE`,
            [orderId]
          );
          if (!lockedOrders.length) {
            throw new OrderTransitionError('ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.', 404);
          }
          const oldDriverId = Number(lockedOrders[0].previous_driver_id || 0);
          if (oldDriverId && oldDriverId !== shipperId) {
            await queryAsync(
              conn,
              'DELETE FROM driver_route_stops WHERE driver_id = ? AND order_id = ? AND status = "planned"',
              [oldDriverId, orderId]
            );
          }
          if (task_type === 'delivery') {
            const itemValue = parseMoney(order.item_value || 0);
            const codExposure = addMoney(
              order.cod_amount || 0,
              order.fee_payer === 'receiver' ? (order.shipping_fee || 0) : 0
            );
            const reserveAmount = (itemValue > codExposure ? itemValue : codExposure).toString();
            await reserveDriverWalletInTransaction(
              conn, shipperId, orderId, reserveAmount,
              { id: Number(req.authUser.id), role: req.authRole }, req.ip
            );
          }
          return transitionOrder(conn, {
            orderId,
            toStatus: task.next,
            actor: { id: Number(req.authUser.id), role: req.authRole },
            note: `Điều phối phân công tài xế ${task.label}`,
            updates
          });
        }).then(() => {
          const notifyAssignment = (routeWarning = '') => {
            io.to(`user:${shipperId}`).emit(`new_order_assigned_${shipperId}`, { message: `Bạn vừa được phân công ${task.label}.` });
            notifyUser(shipperId, orderId, 'Có nhiệm vụ vận chuyển mới', `Đơn ${order.tracking_code}: ${task.label}.`);
            notifyUser(order.shop_id, orderId, 'Cập nhật luân chuyển vận đơn', `Đơn ${order.tracking_code} đang được ${task.label}.`);
            notifyCustomerByEmail(order.customer_email, orderId, 'Cập nhật vận đơn', `Đơn ${order.tracking_code} đang được luân chuyển đến chặng tiếp theo.`);
            io.emit('order_status_changed', { order_id: Number(orderId), status: task.next });
            res.json({
              success: true,
              message: routeWarning
                ? `Đã phân công tài xế ${task.label}, nhưng chưa lưu được thứ tự lộ trình.`
                : `Đã phân công tài xế ${task.label}.`,
              warning: routeWarning || undefined
            });
          };
          const routeSql = `
            INSERT INTO driver_routes (order_id, shipper_id, warehouse_lat, warehouse_lng, pickup_lat, pickup_lng, delivery_lat, delivery_lng, route_status, mode)
            SELECT ?, ?, 10.8231, 106.6881, COALESCE(shop_lat, 10.8231), COALESCE(shop_lng, 106.6881), COALESCE(receiver_lat, 10.8231), COALESCE(receiver_lng, 106.6881), ?, ?
            FROM orders WHERE id = ?
            ON DUPLICATE KEY UPDATE shipper_id = VALUES(shipper_id), route_status = VALUES(route_status), mode = VALUES(mode)
          `;
          db.query(routeSql, [orderId, shipperId, task_type, task_type === 'pickup' ? 'pickup' : 'delivery', orderId], (routeErr) => {
            if (routeErr) {
              console.error('Lỗi lưu route:', routeErr);
              notifyAssignment(routeErr.message);
              return;
            }
            appendDriverRouteStop(shipperId, order, task_type, (stopErr) => {
              if (stopErr) console.error('Lỗi lưu thứ tự điểm giao:', stopErr);
              if (previousDriverId && previousDriverId !== shipperId) {
                recalculateDriverRoute(previousDriverId, task_type === 'pickup' ? 'pickup' : 'delivery',
                  { id: Number(req.authUser.id), role: req.authRole }, 'reassigned')
                  .catch((reassignError) => console.error('Không thể tính lại tuyến của tài xế cũ:', reassignError));
              }
              notifyAssignment(stopErr ? 'Không lưu được thứ tự tối ưu của lộ trình.' : '');
            });
          });
        }).catch((updateErr) => respondWithTransitionError(res, updateErr, 'Lỗi phân công đơn:'));
        };
        updateAssignedOrder();
      };

      const validateCapacityAndAssign = (warehouseId = null, destinationWarehouseId = null) => {
        const targetArea = task_type === 'pickup'
          ? `${order.shop_address || ''} ${order.shop_province || ''}`
          : `${order.receiver_address || ''} ${order.destination_province || ''}`;
        const normalizeArea = (value) => String(value || '')
          .toLocaleLowerCase('vi')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd');
        db.query(
          `SELECT COALESCE(profile.max_active_orders, 10) AS max_active_orders,
             COALESCE(profile.max_payload_kg, 100) AS max_payload_kg,
             COALESCE(profile.max_order_value, 0) AS max_order_value,
             COALESCE(profile.service_areas, '') AS service_areas,
             GREATEST(0, COALESCE(wallet.balance, 0) - COALESCE(wallet.reserved_balance, 0)) AS available_deposit,
             (SELECT COUNT(*) FROM orders active_order
              WHERE (? = 'pickup' AND active_order.pickup_shipper_id = ? AND active_order.status IN ('picking','picked_up'))
                 OR (? = 'delivery' AND active_order.delivery_shipper_id = ? AND active_order.status IN ('at_central_warehouse','delivering'))) AS active_count,
             (SELECT COALESCE(SUM(active_order.weight_kg), 0) FROM orders active_order
              WHERE (? = 'pickup' AND active_order.pickup_shipper_id = ? AND active_order.status IN ('picking','picked_up'))
                 OR (? = 'delivery' AND active_order.delivery_shipper_id = ? AND active_order.status IN ('at_central_warehouse','delivering'))) AS active_weight
           FROM users u
           LEFT JOIN driver_dispatch_profiles profile ON profile.driver_id = u.id
           LEFT JOIN driver_wallets wallet ON wallet.driver_id = u.id
           WHERE u.id = ? AND u.role = ? AND u.status = 'active'
           LIMIT 1`,
          [task_type, shipperId, task_type, shipperId, task_type, shipperId, task_type, shipperId, shipperId, task.role],
          (capacityErr, profiles) => {
            if (capacityErr) return res.status(500).json({ success: false, message: 'Không kiểm tra được hạn mức tài xế: ' + capacityErr.sqlMessage });
            const profile = profiles[0];
            if (!profile) return res.status(404).json({ success: false, message: 'Tài xế không còn hoạt động.' });
            const activeWeight = Number(profile.active_weight || 0);
            const orderWeight = Number(order.weight_kg || 0);
            if (Number(profile.active_count) >= Number(profile.max_active_orders)
              || activeWeight + orderWeight > Number(profile.max_payload_kg)) {
              return res.status(409).json({ success: false, message: 'Tài xế đã đạt giới hạn số đơn hoặc tải trọng.' });
            }
            const itemValue = parseMoney(order.item_value || 0);
            const maxOrderValue = parseMoney(profile.max_order_value || 0);
            if (maxOrderValue > 0n && itemValue > maxOrderValue) {
              return res.status(409).json({ success: false, message: 'Giá trị hàng vượt hạn mức được cấu hình cho tài xế.' });
            }
            const collectionAmount = addMoney(
              order.cod_amount || 0,
              order.fee_payer === 'receiver' ? (order.shipping_fee || 0) : 0
            );
            const riskAmount = itemValue > collectionAmount ? itemValue : collectionAmount;
            if (task_type === 'delivery' && riskAmount > parseMoney(profile.available_deposit || 0)) {
              return res.status(409).json({
                success: false,
                message: `Ký quỹ khả dụng của tài xế không đủ bảo đảm đơn hàng. Cần tối thiểu ${formatMoney(riskAmount)} đ.`
              });
            }
            const configuredAreas = String(profile.service_areas || '')
              .split(',')
              .map((area) => normalizeArea(area.trim()))
              .filter(Boolean);
            const normalizedTargetArea = normalizeArea(targetArea);
            if (configuredAreas.length && !configuredAreas.some((area) => normalizedTargetArea.includes(area))) {
              return res.status(409).json({ success: false, message: 'Đơn hàng nằm ngoài khu vực phục vụ cố định của tài xế.' });
            }
            continueAssignment(warehouseId, destinationWarehouseId);
          }
        );
      };

      if (task_type === 'pickup') {
        return db.query(
          `SELECT w.id FROM system_settings setting
           JOIN warehouses w ON w.id = CAST(setting.setting_value AS UNSIGNED)
           WHERE setting.setting_key = 'central_warehouse_id'
             AND w.warehouse_type = 'central' AND w.is_active = 1 AND w.is_configured = 1
           LIMIT 1`,
          (warehouseErr, warehouses) => {
            if (warehouseErr) return res.status(500).json({ success: false, message: 'Không thể tải kho tổng Gò Vấp: ' + warehouseErr.sqlMessage });
            if (!warehouses.length) return res.status(503).json({ success: false, message: 'Chưa cấu hình kho tổng Gò Vấp. Hãy chạy migration 002.' });
            const centralWarehouseId = Number(warehouses[0].id);
            validateCapacityAndAssign(centralWarehouseId, centralWarehouseId);
          }
        );
      }
      validateCapacityAndAssign();
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
    if (driverRoles.has(driverRole)) {
      handleRouteDeviation(shipperId, driverRole === 'pickup_driver' ? 'pickup' : 'delivery', latitude, longitude)
        .catch((error) => console.error('Không thể kiểm tra độ lệch lộ trình:', error));
    }
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
      OR (? = 'delivery_driver' AND o.return_shipper_id = ? AND o.status = 'returning')
    )
    LIMIT 1
  `;
  const params = [
    shipperId, latitude, longitude, route_status || 'moving', orderId,
    driverRole, shipperId, shipperId, shipperId, driverRole, shipperId, driverRole, shipperId
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
    SELECT o.*, u.role AS driver_role, shop.phone AS shop_phone,
      COALESCE((SELECT stop.stop_order FROM driver_route_stops stop
        WHERE stop.driver_id = ? AND stop.order_id = o.id
          AND stop.task_type = CASE WHEN u.role = 'pickup_driver' THEN 'pickup'
            WHEN o.status = 'returning' THEN 'return' ELSE 'delivery' END
          AND stop.status = 'planned' LIMIT 1), 0) AS route_order
    FROM orders o
    JOIN users u ON u.id = ? AND u.status = 'active'
    LEFT JOIN users shop ON shop.id = o.shop_id
    WHERE (u.role = 'pickup_driver' AND (
        (o.pickup_shipper_id = ? AND o.status IN ('picking','picked_up'))
        OR (o.central_transfer_shipper_id = ? AND o.status = 'transferring_to_central')
        OR (o.destination_transfer_shipper_id = ? AND o.status = 'transferring_to_destination')
      ))
       OR (u.role = 'delivery_driver' AND o.delivery_shipper_id = ? AND o.status IN ('at_central_warehouse','at_destination_warehouse','delivering'))
       OR (u.role = 'delivery_driver' AND o.return_shipper_id = ? AND o.status = 'returning')
       OR (u.role = 'delivery_driver' AND o.delivery_shipper_id = ? AND o.status = 'completed' AND DATE(o.updated_at) = CURDATE())
    ORDER BY o.created_at DESC
  `;
  db.query(sql, [driverId, driverId, driverId, driverId, driverId, driverId, driverId, driverId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    if (!results.length) return res.json({ success: true, data: [] });
    const orderIds = results.map((order) => Number(order.id));
    db.query(
      `SELECT id, order_id, item_name, direction, quantity, delivered_quantity,
        collected_quantity, return_quantity, unit_value, unit_cod_amount
       FROM order_items WHERE order_id IN (?) ORDER BY order_id, id`,
      [orderIds],
      (itemsErr, items) => {
        if (itemsErr) return res.status(500).json({ success: false, message: itemsErr.sqlMessage });
        const itemsByOrder = new Map();
        for (const item of items) {
          const orderItems = itemsByOrder.get(Number(item.order_id)) || [];
          orderItems.push(item);
          itemsByOrder.set(Number(item.order_id), orderItems);
        }
        const data = results.map((order) => ({
          ...order,
          order_items: itemsByOrder.get(Number(order.id)) || []
        }));
        res.json({ success: true, data: redactDeliveryOtp(data) });
      }
    );
  });
});

app.post('/api/driver/orders/:id/chat', (req, res) => {
  const orderId = Number(req.params.id);
  const driverId = Number(req.authUser.id);
  if (!Number.isSafeInteger(orderId) || orderId <= 0 || !driverRoles.has(normalizeRole(req.authUser.role))) {
    return res.status(400).json({ success: false, message: 'Đơn hàng hoặc tài khoản tài xế không hợp lệ.' });
  }
  db.query(
    `SELECT id, tracking_code, receiver_name, receiver_phone, status, delivery_shipper_id
     FROM orders WHERE id = ? LIMIT 1`,
    [orderId],
    (orderErr, orders) => {
      if (orderErr) return res.status(500).json({ success: false, message: 'Không thể kiểm tra đơn hàng: ' + orderErr.sqlMessage });
      const order = orders[0];
      if (!order || Number(order.delivery_shipper_id) !== driverId
        || !['at_central_warehouse', 'at_destination_warehouse', 'delivering', 'completed'].includes(order.status)) {
        return res.status(403).json({ success: false, message: 'Chỉ tài xế giao hàng được phân công mới có thể nhắn với người nhận.' });
      }
      db.query(
        `SELECT id, mode, order_id, driver_id, customer_name, status
         FROM chat_sessions WHERE order_id = ? AND driver_id = ? AND status <> 'closed'
         ORDER BY id DESC LIMIT 1`,
        [order.id, driverId],
        (sessionErr, sessions) => {
          if (sessionErr) return res.status(500).json({ success: false, message: 'Không thể tải phiên chat: ' + sessionErr.sqlMessage });
          if (sessions.length) return res.json({ success: true, data: sessions[0] });
          const guestToken = createGuestChatToken();
          const expiresAt = new Date(Date.now() + chatTokenTtlHours() * 60 * 60 * 1000);
          db.query(
            `INSERT INTO chat_sessions
              (mode, order_id, driver_id, customer_name, customer_phone, guest_token_hash, expires_at, status)
             VALUES ('live', ?, ?, ?, ?, ?, ?, 'active')`,
            [order.id, driverId, order.receiver_name, order.receiver_phone, hashChatToken(guestToken), expiresAt],
            (insertErr, result) => {
              if (insertErr) return res.status(500).json({ success: false, message: 'Không thể tạo phiên chat với khách hàng.' });
              const session = {
                id: result.insertId, mode: 'live', order_id: order.id, driver_id: driverId,
                customer_name: order.receiver_name, status: 'active', expires_at: expiresAt
              };
              io.to(`user:${driverId}`).emit('chat_session_updated', { session_id: session.id, status: 'active' });
              res.status(201).json({ success: true, data: session });
            }
          );
        }
      );
    }
  );
});

app.put('/api/orders/:id/status', parsePodUpload([
  { name: 'proof_image', maxCount: 1 },
  { name: 'signature_image', maxCount: 1 }
]), (req, res) => {
  const { id } = req.params;
  const { status, fail_reason, reason_code, cod_collected, cod_payment_method, user_id } = req.body;
  const orderId = Number(id);
  const driverId = Number(user_id);
  const requestedStatus = status === 'returning' ? 'delivery_failed' : status;
  const allowedTransitions = new Set(['picked_up', 'delivering', 'completed', 'pickup_failed', 'delivery_failed']);
  const proofFile = req.files?.proof_image?.[0];
  const signatureFile = req.files?.signature_image?.[0];
  const imageUrl = proofFile ? `/uploads/${proofFile.filename}` : null;
  const signatureUrl = signatureFile ? `/uploads/${signatureFile.filename}` : null;

  if (!Number.isInteger(orderId) || orderId <= 0 || !Number.isInteger(driverId) || driverId <= 0
    || driverId !== Number(req.authUser.id) || !allowedTransitions.has(requestedStatus)) {
    return res.status(400).json({ success: false, message: 'Mã đơn, tài xế hoặc trạng thái cập nhật không hợp lệ.' });
  }

  db.query(
    `SELECT o.status, o.cod_amount, o.shipping_fee, o.fee_payer, o.shop_id, o.customer_email,
      o.tracking_code, o.pickup_shipper_id, o.delivery_shipper_id, o.pickup_attempts, o.delivery_attempts,
      o.receiver_phone, o.receiver_address, o.partial_delivery_allowed, o.is_exchange,
      o.destination_transfer_shipper_id, u.role AS driver_role
     FROM orders o
     LEFT JOIN users u ON u.id = ? AND u.status = 'active'
     WHERE o.id = ?`,
    [driverId, orderId],
    (selectErr, orders) => {
    if (selectErr) return res.status(500).json({ success: false, message: 'Lỗi cập nhật: ' + selectErr.sqlMessage });
    if (!orders.length) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });

    const order = orders[0];
    const amountToCollect = addMoney(
      order.cod_amount || 0,
      order.fee_payer === 'receiver' ? (order.shipping_fee || 0) : 0
    );
    if (requestedStatus === 'picked_up' && order.status === 'picked_up'
      && order.driver_role === 'pickup_driver'
      && Number(order.pickup_shipper_id) === driverId) {
      return res.json({ success: true, already_applied: true, message: 'Vận đơn đã được xác nhận đã lấy trước đó.' });
    }
    const validTransition = requestedStatus === 'picked_up'
      ? order.driver_role === 'pickup_driver' && order.status === 'picking' && Number(order.pickup_shipper_id) === driverId
      : requestedStatus === 'delivering'
      ? order.driver_role === 'delivery_driver'
        && (['at_central_warehouse', 'at_destination_warehouse'].includes(order.status)
          && Number(order.delivery_shipper_id) === driverId
          || isDeliveryStartAlreadyApplied({
            requestedStatus,
            orderStatus: order.status,
            driverRole: order.driver_role,
            assignedDriverId: order.delivery_shipper_id,
            driverId
          }))
      : requestedStatus === 'pickup_failed'
      ? order.driver_role === 'pickup_driver' && order.status === 'picking' && Number(order.pickup_shipper_id) === driverId
      : order.driver_role === 'delivery_driver' && order.status === 'delivering' && ['completed', 'delivery_failed'].includes(requestedStatus) && Number(order.delivery_shipper_id) === driverId;
    if (!validTransition) {
      return res.status(409).json({ success: false, message: `Không thể chuyển đơn từ "${order.status}" sang "${requestedStatus}".` });
    }
    if (requestedStatus === 'completed' && !imageUrl) {
      return res.status(400).json({ success: false, message: 'Cần ảnh minh chứng trước khi kết thúc lượt giao.' });
    }
    if (requestedStatus === 'completed' && !signatureUrl) {
      return res.status(400).json({ success: false, message: 'Cần chữ ký điện tử của người nhận trước khi hoàn tất đơn.' });
    }
    const legacyReasonCodes = {
      'Khách không nghe máy (Đã gọi 3 lần)': 'DL_NO_CONTACT',
      'Sai địa chỉ / Không tìm thấy nhà': 'DL_WRONG_ADDRESS',
      'Khách đổi ý không nhận hàng': 'DL_REFUSED',
      'Hàng hóa bị móp méo, khách từ chối': 'DL_GOODS_WRONG'
    };
    const reasonCode = String(reason_code || legacyReasonCodes[String(fail_reason || '').trim()] || '').trim() || null;
    if (['pickup_failed', 'delivery_failed'].includes(requestedStatus) && !reasonCode) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn mã lý do phù hợp.' });
    }
    if (requestedStatus === 'completed' && amountToCollect > 0n && cod_collected !== 'true') {
      return res.status(400).json({ success: false, message: 'Cần xác nhận đã thu COD và phí vận chuyển trước khi hoàn tất đơn.' });
    }
    if (requestedStatus === 'completed' && amountToCollect > 0n && !['cash', 'bank_transfer'].includes(cod_payment_method)) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn tiền mặt hoặc chuyển khoản cho tổng tiền cần thu.' });
    }

    const updates = {};
    if (imageUrl) updates.proof_image = imageUrl;
    if (signatureUrl) updates.signature_image = signatureUrl;
    if (['pickup_failed', 'delivery_failed'].includes(requestedStatus)) {
      updates.fail_reason = reasonCode;
    }
    if (requestedStatus === 'completed') {
      updates.cod_collected = amountToCollect > 0n ? 1 : 0;
      updates.cod_collected_amount = amountToCollect.toString();
      updates.cod_payment_method = amountToCollect > 0n ? cod_payment_method : null;
    }
    const hasLat = req.body.lat !== undefined && req.body.lat !== null && String(req.body.lat).trim() !== '';
    const hasLng = req.body.lng !== undefined && req.body.lng !== null && String(req.body.lng).trim() !== '';
    const lat = hasLat ? Number(req.body.lat) : null;
    const lng = hasLng ? Number(req.body.lng) : null;
    if ((hasLat || hasLng) && (!hasLat || !hasLng || !Number.isFinite(lat) || !Number.isFinite(lng)
      || Math.abs(lat) > 90 || Math.abs(lng) > 180)) {
      return res.status(400).json({ success: false, message: 'Tọa độ GPS không hợp lệ.' });
    }

    withTransaction(transactionPool, async (conn) => {
      if (requestedStatus === 'delivering') {
        const lockedOrders = await queryAsync(
          conn,
          'SELECT status, delivery_shipper_id FROM orders WHERE id = ? FOR UPDATE',
          [orderId]
        );
        if (lockedOrders.length && isDeliveryStartAlreadyApplied({
          requestedStatus,
          orderStatus: lockedOrders[0].status,
          driverRole: normalizeRole(order.driver_role),
          assignedDriverId: lockedOrders[0].delivery_shipper_id,
          driverId
        })) {
          return { status: 'delivering', alreadyApplied: true };
        }
      }

      let finalStatus = requestedStatus;
      if (requestedStatus === 'pickup_failed') {
        const result = await processPickupFailure(conn, {
          orderId,
          actor: { id: driverId, role: normalizeRole(order.driver_role) },
          reasonCode, note: String(fail_reason || reasonCode), lat, lng, photoUrl: imageUrl, updates
        });
        finalStatus = result.finalStatus;
      } else if (requestedStatus === 'delivery_failed') {
        const result = await processDeliveryFailure(conn, {
          orderId,
          actor: { id: driverId, role: normalizeRole(order.driver_role) },
          reasonCode, note: String(fail_reason || reasonCode), lat, lng, photoUrl: imageUrl, updates
        }, (connection) => updateBombBlacklist(connection, {
          orderId, phone: order.receiver_phone, address: order.receiver_address
        }));
        finalStatus = result.finalStatus;
      } else {
        const actor = { id: driverId, role: normalizeRole(order.driver_role) };
        if (requestedStatus === 'completed') {
          const itemResult = await applyDeliveryItemScans(conn, {
            orderId,
            deliveredItems: req.body.delivered_items,
            collectedItems: req.body.collected_items
          });
          const actualAmountToCollect = parseMoney(itemResult.codAmount);
          if (actualAmountToCollect > 0n && cod_collected !== 'true') {
            throw new OrderTransitionError('COD_NOT_CONFIRMED', 'Cần xác nhận đã thu COD theo số hàng thực giao.', 400);
          }
          if (actualAmountToCollect > 0n && !['cash', 'bank_transfer'].includes(cod_payment_method)) {
            throw new OrderTransitionError('INVALID_COD_METHOD', 'Vui lòng chọn tiền mặt hoặc chuyển khoản cho COD thực tế.', 400);
          }
          updates.cod_collected = actualAmountToCollect > 0n ? 1 : 0;
          updates.cod_collected_amount = actualAmountToCollect.toString();
          updates.cod_payment_method = actualAmountToCollect > 0n ? cod_payment_method : null;

          if (itemResult.isExchange) {
            await transitionOrder(conn, {
              orderId, toStatus: 'exchange_return_collected', actor,
              note: `Đã quét giao ${itemResult.deliveredCount} đơn vị hàng mới và thu hồi ${itemResult.collectedCount} đơn vị hàng cũ.`,
              lat, lng, photoUrl: imageUrl, signatureUrl, updates
            });
            if (itemResult.partial) {
              await transitionOrder(conn, {
                orderId, toStatus: 'partial_delivery_completed', actor,
                note: `Đã giao ${itemResult.deliveredCount} đơn vị hàng mới; ${itemResult.returnCount} đơn vị hàng mới chờ hoàn.`,
                lat, lng, photoUrl: imageUrl, signatureUrl,
                updates: { partial_delivery_completed: 1 }
              });
              await transitionOrder(conn, {
                orderId, toStatus: 'return_pending', actor,
                note: `Đã giao ${itemResult.deliveredCount} đơn vị hàng mới, thu hồi ${itemResult.collectedCount} đơn vị hàng cũ; ${itemResult.returnCount} đơn vị hàng mới chờ hoàn.`,
                lat, lng, photoUrl: imageUrl, signatureUrl,
                updates: { fail_reason: 'PARTIAL_DELIVERY_REMAINDER' }
              });
              finalStatus = 'return_pending';
            } else {
              await transitionOrder(conn, {
                orderId, toStatus: 'completed', actor,
                note: 'Hoàn tất giao hàng mới và thu hồi hàng đổi trả cùng chuyến.',
                lat, lng, photoUrl: imageUrl, signatureUrl
              });
            }
          } else if (itemResult.partial) {
            if (!itemResult.partialDeliveryAllowed) {
              throw new OrderTransitionError('PARTIAL_DELIVERY_NOT_ALLOWED', 'Shop chưa cho phép giao một phần.', 409);
            }
            await transitionOrder(conn, {
              orderId, toStatus: 'partial_delivery_completed', actor,
              note: `Giao một phần ${itemResult.deliveredCount} đơn vị; ${itemResult.returnCount} đơn vị chờ hoàn.`,
              lat, lng, photoUrl: imageUrl, signatureUrl,
              updates: { ...updates, partial_delivery_completed: 1 }
            });
            await transitionOrder(conn, {
              orderId, toStatus: 'return_pending', actor,
              note: 'Phần hàng chưa giao được đưa vào luồng hoàn.',
              lat, lng, photoUrl: imageUrl, signatureUrl,
              updates: { fail_reason: 'PARTIAL_DELIVERY_REMAINDER' }
            });
            finalStatus = 'return_pending';
          } else {
            await transitionOrder(conn, {
              orderId, toStatus: requestedStatus, actor, reasonCode,
              lat, lng, photoUrl: imageUrl, signatureUrl, updates
            });
          }
        } else {
          await transitionOrder(conn, {
            orderId,
            toStatus: requestedStatus,
            actor,
            reasonCode,
            note: requestedStatus === 'delivery_failed' ? String(fail_reason).trim() : null,
            lat,
            lng,
            photoUrl: imageUrl,
            signatureUrl,
            updates
          });
        }
      }
      const shouldReleaseReservation = finalStatus === 'return_pending'
        || requestedStatus === 'completed' && cod_payment_method === 'bank_transfer';
      if (shouldReleaseReservation) {
        await releaseDriverWalletReservationInTransaction(
          conn,
          orderId,
          finalStatus === 'return_pending' ? 'Đơn giao thất bại, giải phóng ký quỹ' : 'COD chuyển khoản, giải phóng ký quỹ',
          { id: driverId, role: normalizeRole(order.driver_role) }, req.ip
        );
      }
      const stopTaskType = requestedStatus === 'picked_up' || requestedStatus === 'pickup_failed'
        ? 'pickup'
        : ['completed', 'delivery_failed'].includes(requestedStatus) ? 'delivery' : null;
      if (stopTaskType) {
        await queryAsync(
          conn,
            `UPDATE driver_route_stops SET status = 'completed', actual_arrival = CURRENT_TIMESTAMP
           WHERE driver_id = ? AND order_id = ? AND task_type = ? AND status = 'planned'`,
          [driverId, orderId, stopTaskType]
        );
      }
      return { status: finalStatus, alreadyApplied: false };
    }).then(({ status: finalStatus, alreadyApplied }) => {
      if (alreadyApplied) {
        return res.json({
          success: true,
          already_applied: true,
          status: finalStatus,
          message: 'Đơn đã bắt đầu giao trước đó.'
        });
      }
      recalculateDriverRoute(
        driverId,
        order.driver_role === 'pickup_driver' ? 'pickup' : 'delivery',
        { id: driverId, role: normalizeRole(order.driver_role) },
        ['pickup_failed', 'delivery_failed'].includes(requestedStatus) ? 'failed' : 'stop_completed'
      ).then(() => {
        io.to(`user:${driverId}`).emit('driver_route_updated', {
          driver_id: driverId,
          mode: order.driver_role === 'pickup_driver' ? 'pickup' : 'delivery'
        });
      }).catch((routeError) => console.error('Không thể tính lại tuyến sau khi cập nhật điểm dừng:', routeError));
      notifyUser(order.shop_id, orderId, 'Cập nhật trạng thái vận đơn', `Đơn ${order.tracking_code} đã chuyển sang trạng thái ${finalStatus}.`);
      const customerMessage = finalStatus === 'picked_up' ? 'Tài xế đã lấy hàng và đang đưa về kho.'
        : finalStatus === 'delivering' ? 'Đơn hàng đang trên đường giao đến bạn.'
        : finalStatus === 'completed' ? 'Đơn hàng đã được giao thành công.'
        : finalStatus === 'at_central_warehouse' ? 'Giao chưa thành công; đơn đang chờ giao lại tại kho tổng.'
        : finalStatus === 'pending' ? 'Lấy hàng chưa thành công; đơn đang chờ phân công lấy lại.'
        : finalStatus === 'cancelled' ? 'Đơn đã hủy vì đạt số lần lấy hàng tối đa.'
        : 'Giao hàng chưa thành công; đơn đang chờ hoàn về Shop.';
      notifyCustomerByEmail(order.customer_email, orderId, 'Cập nhật vận đơn', `Đơn ${order.tracking_code}: ${customerMessage}`);
      if (order.customer_email) {
      const mailOptions = {
        from: mailFrom,
        to: order.customer_email,
        subject: `[Cập nhật vận đơn] ${order.tracking_code}`,
        html: `
          <div style="font-family: sans-serif; max-w: 600px; margin: auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
            <h2 style="color: #059669; text-align: center;">CẬP NHẬT VẬN ĐƠN</h2>
            <p style="color: #374151; font-size: 16px;">Mã vận đơn: <b>${order.tracking_code}</b></p>
            <p style="color: #4B5563;">${customerMessage}</p>
            ${finalStatus === 'completed' ? '<p style="color: #4B5563;">Bạn có thể tra cứu hình ảnh minh chứng trên Cổng tra cứu của hệ thống.</p>' : ''}
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
      const failureReported = ['pickup_failed', 'delivery_failed'].includes(requestedStatus);
      const message = requestedStatus === 'delivery_failed'
        ? finalStatus === 'at_central_warehouse'
          ? 'Đã ghi nhận giao hàng thất bại. Đơn được chuyển về kho tổng để phân công giao lại.'
          : 'Đã ghi nhận giao hàng thất bại. Đơn đang chờ điều phối phân công hoàn về Shop.'
        : requestedStatus === 'pickup_failed'
          ? finalStatus === 'pending'
            ? 'Đã ghi nhận lấy hàng thất bại. Đơn đang chờ phân công lấy lại.'
            : 'Đã ghi nhận lấy hàng thất bại. Đơn đã được hủy theo quy định.'
          : requestedStatus === 'completed'
            ? 'Đã cập nhật giao hàng thành công.'
            : 'Cập nhật trạng thái thành công!';
      res.json({ success: true, message, status: finalStatus, failure_reported: failureReported });
      io.emit('order_status_changed', { order_id: orderId, status: finalStatus });
      if (finalStatus === 'completed') dispatchShopWebhook(orderId);
    }).catch((err) => respondWithTransitionError(res, err, 'Lỗi cập nhật trạng thái:'));
  });
});

// =========================================
// 4. API KHO BÃI
// =========================================
app.get('/api/warehouse/bin-locations', (req, res) => {
  const warehouseId = Number(req.warehouseScopeId || req.query.warehouse_id);
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
  const warehouseId = Number(req.warehouseScopeId || req.query.warehouse_id);
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
           AND status = 'at_central_warehouse'`,
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
        `SELECT i.order_id, i.tracking_code, i.reason_code
         FROM warehouse_inventory_audit_items i
         LEFT JOIN warehouse_inventory_audit_scans s ON s.audit_id = i.audit_id AND s.order_id = i.order_id
         WHERE i.audit_id = ? AND s.order_id IS NULL ORDER BY i.tracking_code`,
        [auditId],
        (missingErr, missing) => {
          if (missingErr) return res.status(500).json({ success: false, message: 'Không tải được danh sách kiện thiếu: ' + missingErr.sqlMessage });
          db.query(
            'SELECT scan_code, reason_code FROM warehouse_inventory_audit_scans WHERE audit_id = ? AND order_id IS NULL ORDER BY scan_code',
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

app.put('/api/warehouse/inventory-audits/:id/discrepancies', (req, res) => {
  const auditId = Number(req.params.id);
  const actorRole = normalizeRole(req.authUser.role);
  if (!['warehouse_manager', 'director'].includes(actorRole)) {
    return res.status(403).json({ success: false, message: 'Bạn không có quyền phân loại chênh lệch kiểm kê.' });
  }
  if (!Number.isSafeInteger(auditId) || auditId <= 0
    || !Array.isArray(req.body.missing) || !Array.isArray(req.body.extra)) {
    return res.status(400).json({ success: false, message: 'Mã phiếu hoặc danh sách phân loại không hợp lệ.' });
  }

  const missingInput = req.body.missing.map((item) => ({
    orderId: Number(item?.order_id),
    reasonCode: String(item?.reason_code || '').trim()
  }));
  const extraInput = req.body.extra.map((item) => ({
    scanCode: String(item?.scan_code || '').trim().toUpperCase(),
    reasonCode: String(item?.reason_code || '').trim()
  }));
  if (missingInput.some((item) => !Number.isSafeInteger(item.orderId) || item.orderId <= 0
      || !['WH_SHORT', 'WH_LOST'].includes(item.reasonCode))
    || extraInput.some((item) => !/^[A-Z0-9][A-Z0-9._-]{0,99}$/.test(item.scanCode)
      || item.reasonCode !== 'WH_OVER')
    || new Set(missingInput.map((item) => item.orderId)).size !== missingInput.length
    || new Set(extraInput.map((item) => item.scanCode)).size !== extraInput.length) {
    return res.status(400).json({ success: false, message: 'Mỗi kiện thiếu cần WH_SHORT/WH_LOST; mỗi mã dư cần WH_OVER.' });
  }

  const auditError = (code, message, statusCode) => Object.assign(new Error(message), { code, statusCode });
  withTransaction(transactionPool, async (conn) => {
    const audits = await queryAsync(
      conn,
      'SELECT id, status FROM warehouse_inventory_audits WHERE id = ? FOR UPDATE',
      [auditId]
    );
    if (!audits.length) throw auditError('AUDIT_NOT_FOUND', 'Không tìm thấy phiếu kiểm kê.', 404);
    if (audits[0].status !== 'completed') {
      throw auditError('AUDIT_NOT_COMPLETED', 'Chỉ phân loại được phiếu kiểm kê đã chốt.', 409);
    }

    const missingRows = await queryAsync(
      conn,
      `SELECT i.order_id FROM warehouse_inventory_audit_items i
       LEFT JOIN warehouse_inventory_audit_scans s
         ON s.audit_id = i.audit_id AND s.order_id = i.order_id
       WHERE i.audit_id = ? AND s.order_id IS NULL
       ORDER BY i.order_id FOR UPDATE`,
      [auditId]
    );
    const extraRows = await queryAsync(
      `SELECT scan_code FROM warehouse_inventory_audit_scans
       WHERE audit_id = ? AND order_id IS NULL ORDER BY scan_code FOR UPDATE`,
      [auditId]
    );
    const expectedMissing = missingRows.map((item) => Number(item.order_id)).sort((a, b) => a - b);
    const suppliedMissing = missingInput.map((item) => item.orderId).sort((a, b) => a - b);
    const expectedExtra = extraRows.map((item) => String(item.scan_code)).sort();
    const suppliedExtra = extraInput.map((item) => item.scanCode).sort();
    if (JSON.stringify(expectedMissing) !== JSON.stringify(suppliedMissing)
      || JSON.stringify(expectedExtra) !== JSON.stringify(suppliedExtra)) {
      throw auditError('AUDIT_DISCREPANCIES_CHANGED', 'Danh sách chênh lệch không khớp phiếu kiểm kê; hãy tải lại báo cáo.', 409);
    }

    const reasonCodes = [...new Set([...missingInput, ...extraInput].map((item) => item.reasonCode))];
    if (reasonCodes.length) {
      const placeholders = reasonCodes.map(() => '?').join(', ');
      const knownReasons = await queryAsync(
        conn,
        `SELECT code FROM reason_codes WHERE group_type = 'WAREHOUSE' AND code IN (${placeholders})`,
        reasonCodes
      );
      if (knownReasons.length !== reasonCodes.length) {
        throw auditError('INVALID_REASON_CODE', 'Một hoặc nhiều mã lý do kho không tồn tại.', 400);
      }
    }

    for (const item of missingInput) {
      await queryAsync(
        conn,
        `UPDATE warehouse_inventory_audit_items
         SET reason_code = ?, reason_actor_id = ?, reason_recorded_at = CURRENT_TIMESTAMP
         WHERE audit_id = ? AND order_id = ?`,
        [item.reasonCode, Number(req.authUser.id), auditId, item.orderId]
      );
    }
    for (const item of extraInput) {
      await queryAsync(
        `UPDATE warehouse_inventory_audit_scans
         SET reason_code = ?, reason_actor_id = ?, reason_recorded_at = CURRENT_TIMESTAMP
         WHERE audit_id = ? AND scan_code = ? AND order_id IS NULL`,
        [item.reasonCode, Number(req.authUser.id), auditId, item.scanCode]
      );
    }
    return { classified_missing: missingInput.length, classified_extra: extraInput.length };
  }).then((result) => {
    res.json({ success: true, data: result, message: 'Đã lưu mã lý do cho các chênh lệch kiểm kê.' });
  }).catch((error) => {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message, code: error.code });
    }
    console.error('Không thể lưu phân loại chênh lệch kiểm kê:', error);
    return res.status(500).json({ success: false, message: 'Không thể lưu phân loại chênh lệch kiểm kê.' });
  });
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
    const rejectWrongWarehouse = (expectedWarehouseId, selectedWarehouseId) => {
      db.query(
        'SELECT id, name FROM warehouses WHERE id IN (?, ?)',
        [expectedWarehouseId, selectedWarehouseId],
        (warehouseErr, warehouses) => {
          if (warehouseErr) return res.status(500).json({ success: false, message: 'Không thể kiểm tra kho được phân tuyến: ' + warehouseErr.sqlMessage });
          const expectedWarehouse = warehouses.find((warehouse) => Number(warehouse.id) === Number(expectedWarehouseId));
          const selectedWarehouse = warehouses.find((warehouse) => Number(warehouse.id) === Number(selectedWarehouseId));
          res.status(409).json({
            success: false,
            message: `Đơn này được phân tuyến đến "${expectedWarehouse?.name || `kho #${expectedWarehouseId}`}", nhưng bạn đang chọn "${selectedWarehouse?.name || `kho #${selectedWarehouseId}`}". Hãy quét tại đúng kho được phân tuyến.`
          });
        }
      );
    };

    if (order.status === 'picked_up') {
      db.query(
        `SELECT w.id FROM system_settings setting
         JOIN warehouses w ON w.id = CAST(setting.setting_value AS UNSIGNED)
         WHERE setting.setting_key = 'central_warehouse_id'
           AND w.warehouse_type = 'central' AND w.is_active = 1 AND w.is_configured = 1
         LIMIT 1`,
        (centralErr, centralWarehouses) => {
          if (centralErr) return res.status(500).json({ success: false, message: 'Không thể tải kho tổng Gò Vấp: ' + centralErr.sqlMessage });
          if (!centralWarehouses.length) return res.status(503).json({ success: false, message: 'Chưa cấu hình kho tổng Gò Vấp. Hãy chạy migration 002.' });
          expectedWarehouseId = Number(centralWarehouses[0].id);
          if (currentWarehouseId !== expectedWarehouseId) {
            return rejectWrongWarehouse(expectedWarehouseId, currentWarehouseId);
          }
          finalizeScan(
            expectedWarehouseId,
            'at_central_warehouse',
            'Đã nhập kho tổng Gò Vấp, chờ phân công tài xế giao.'
          );
        }
      );
      return;
    } else if (order.status === 'transferring_to_central') {
      db.query("SELECT id FROM warehouses WHERE warehouse_type = 'central' LIMIT 1", (centralErr, centralRows) => {
        if (centralErr) return res.status(500).json({ success: false, message: centralErr.sqlMessage });
        if (!centralRows.length) return res.status(503).json({ success: false, message: 'Chưa cấu hình kho tổng.' });
        const centralWarehouseId = Number(centralRows[0].id);
        if (Number(order.current_warehouse_id) !== Number(order.origin_warehouse_id)) {
          return res.status(409).json({ success: false, message: 'Đơn chưa được ghi nhận tại kho phường nguồn trước khi trung chuyển.' });
        }
        if (currentWarehouseId !== centralWarehouseId) return rejectWrongWarehouse(centralWarehouseId, currentWarehouseId);
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
      newStatus = 'returned';
      message = 'Kho tổng đã nhận hàng hoàn. Chờ Shop xác nhận nhận lại hàng.';
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
      return rejectWrongWarehouse(expectedWarehouseId, currentWarehouseId);
    }
    finalizeScan(currentWarehouseId, newStatus, message);

    function continueDestinationScan() {
      expectedWarehouseId = Number(order.destination_warehouse_id);
      newStatus = 'at_destination_warehouse';
      message = 'Đã nhận hàng tại kho con đích. Chờ Điều phối phân công tài xế giao.';
      if (currentWarehouseId !== expectedWarehouseId) {
        return rejectWrongWarehouse(expectedWarehouseId, currentWarehouseId);
      }
      finalizeScan(currentWarehouseId, newStatus, message);
    }

    function finalizeScan(targetWarehouseId, targetStatus, targetMessage) {
      const crossDock = crossDockRequested;
      const saveInboundOrder = (binId) => {
          withTransaction(transactionPool, async (conn) => {
            const transition = await transitionOrder(conn, {
            orderId: Number(order.id),
            toStatus: targetStatus,
            actor: { id: Number(req.authUser.id), role: req.authRole },
            note: order.status === 'returning'
              ? `Kho xác nhận nhận hàng hoàn: ${order.fail_reason || ''}`.trim()
              : crossDock ? 'Chuyển tải nhanh, không lưu kệ' : `Nhập kho tại vị trí ${binCode}`,
            updates: {
              current_warehouse_id: targetWarehouseId,
              storage_bin_id: binId,
              cross_docked: crossDock ? 1 : 0
            }
            });
            if (targetStatus === 'returned' && order.return_shipper_id) {
              await queryAsync(
                conn,
                `UPDATE driver_route_stops SET status = 'completed'
                 WHERE driver_id = ? AND order_id = ? AND task_type = 'return' AND status = 'planned'`,
                [order.return_shipper_id, Number(order.id)]
              );
            }
            return transition;
          }).then(() => {
            const storageMessage = crossDock ? ' Đơn được chuyển thẳng đến khu xuất, không lưu kệ.' : ` Vị trí lưu kho: ${binCode}.`;
            notifyUser(order.shop_id, order.id, 'Cập nhật luân chuyển vận đơn', `${targetMessage}${storageMessage}`);
            io.emit('order_status_changed', { order_id: Number(order.id), status: targetStatus });
            const safeOrder = redactDeliveryOtp([order])[0];
            res.json({ success: true, message: `${targetMessage}${storageMessage}`, order: { ...safeOrder, status: targetStatus, current_warehouse_id: targetWarehouseId, storage_bin_id: binId, cross_docked: crossDock ? 1 : 0 } });
          }).catch((updateErr) => {
            respondWithTransitionError(res, updateErr, 'Không thể quét nhập kho:');
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
  const warehouseId = req.warehouseScopeId || (req.query.warehouse_id ? Number(req.query.warehouse_id) : null);
  if (req.query.warehouse_id && (!Number.isInteger(warehouseId) || warehouseId <= 0)) {
    return res.status(400).json({ success: false, message: 'Mã kho không hợp lệ.' });
  }
  const sql = `
    SELECT b.*, source.name AS source_warehouse_name, destination.name AS destination_warehouse_name,
      COUNT(bo.order_id) AS order_count,
      EXISTS (SELECT 1 FROM linehaul_trip_bags assigned WHERE assigned.bag_id = b.id) AS is_assigned_to_trip
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
    if (req.authRole === 'warehouse_manager' && sourceId !== Number(req.warehouseScopeId)) {
      return res.status(403).json({ success: false, message: 'Chỉ được đóng bao từ kho đang được phân công.' });
    }
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
  const bagSql = `SELECT * FROM shipment_bags
    WHERE id = ? AND status = "open" AND (? IS NULL OR source_warehouse_id = ?)`;
  db.query(bagSql, [bagId, req.warehouseScopeId || null, req.warehouseScopeId || null], (bagErr, bags) => {
    if (bagErr) return res.status(500).json({ success: false, message: bagErr.sqlMessage });
    if (!bags.length) return res.status(409).json({ success: false, message: 'Bao không tồn tại hoặc đã niêm phong.' });
    const bag = bags[0];
    db.query('SELECT * FROM orders WHERE tracking_code = ?', [trackingCode], (orderErr, orders) => {
      if (orderErr) return res.status(500).json({ success: false, message: orderErr.sqlMessage });
      if (!orders.length) return res.status(404).json({ success: false, message: 'Không tìm thấy vận đơn.' });
      const order = orders[0];
      const expectedWarehouseId = Number(bag.destination_warehouse_id);
      const correctRoute = order.status === 'at_origin_warehouse'
        ? expectedWarehouseId !== Number(order.origin_warehouse_id)
        : order.status === 'at_central_warehouse'
          ? expectedWarehouseId === Number(order.destination_warehouse_id)
          : false;
      if (Number(order.current_warehouse_id) !== Number(bag.source_warehouse_id)) {
        return res.status(409).json({ success: false, message: 'Đơn không nằm tại kho nguồn hoặc không đi đúng tuyến của bao.' });
      }
      if (!correctRoute) {
        return res.status(409).json({
          success: false,
          message: order.status === 'at_central_warehouse'
            ? 'Kho đích của bao phải trùng với kho đích đã phân tuyến cho đơn.'
            : 'Đơn không nằm tại kho nguồn hoặc không đi đúng tuyến của bao.'
        });
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
  db.query(
    `SELECT COUNT(bo.order_id) AS order_count
     FROM shipment_bag_orders bo
     JOIN shipment_bags b ON b.id = bo.bag_id
     WHERE b.id = ? AND (? IS NULL OR b.source_warehouse_id = ?)`,
    [bagId, req.warehouseScopeId || null, req.warehouseScopeId || null],
    (countErr, rows) => {
    if (countErr) return res.status(500).json({ success: false, message: countErr.sqlMessage });
    if (!rows[0]?.order_count) return res.status(409).json({ success: false, message: 'Không thể niêm phong bao rỗng.' });
    db.query(
      `UPDATE shipment_bags SET status = "sealed", sealed_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = "open" AND (? IS NULL OR source_warehouse_id = ?)`,
      [bagId, req.warehouseScopeId || null, req.warehouseScopeId || null],
      (err, result) => {
      if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
      if (!result.affectedRows) return res.status(409).json({ success: false, message: 'Bao đã được niêm phong hoặc không tồn tại.' });
      res.json({ success: true, order_count: rows[0].order_count, message: 'Đã niêm phong bao hàng.' });
      }
    );
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
    WHERE (? IS NULL OR t.source_warehouse_id = ? OR t.destination_warehouse_id = ?)
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `;
  db.query(sql, [req.warehouseScopeId || null, req.warehouseScopeId || null, req.warehouseScopeId || null], (err, rows) => {
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

app.get('/api/linehaul/positions', (req, res) => {
  const sql = `
    SELECT t.id AS trip_id, t.trip_code, t.vehicle_plate, t.status, t.driver_id,
      u.full_name AS driver_name, source.name AS source_warehouse_name,
      destination.name AS destination_warehouse_name, p.lat, p.lng, p.updated_at
    FROM linehaul_trips t
    JOIN users u ON u.id = t.driver_id
    JOIN warehouses source ON source.id = t.source_warehouse_id
    JOIN warehouses destination ON destination.id = t.destination_warehouse_id
    JOIN linehaul_trip_positions p ON p.trip_id = t.id
    WHERE t.status IN ("in_transit","arrived")
    ORDER BY p.updated_at DESC
  `;
  db.query(sql, (err, positions) => {
    if (err) return res.status(500).json({ success: false, message: 'Không tải được vị trí xe tải: ' + err.sqlMessage });
    res.json({ success: true, data: positions });
  });
});

app.get('/api/driver/trips', (req, res) => {
  db.query(
    `SELECT t.*, source.name AS source_warehouse_name, source.address AS source_warehouse_address,
      destination.name AS destination_warehouse_name, destination.address AS destination_warehouse_address,
      destination.lat AS destination_lat, destination.lng AS destination_lng,
      truck.max_payload_kg,
      (SELECT COALESCE(SUM(o.weight_kg), 0)
       FROM linehaul_trip_bags weight_tb
       JOIN shipment_bag_orders weight_bo ON weight_bo.bag_id = weight_tb.bag_id
       JOIN orders o ON o.id = weight_bo.order_id
       WHERE weight_tb.trip_id = t.id) AS total_weight_kg,
      COUNT(tb.bag_id) AS bag_count,
      SUM(CASE WHEN tb.driver_scanned_at IS NOT NULL THEN 1 ELSE 0 END) AS scanned_bag_count
     FROM linehaul_trips t
     JOIN warehouses source ON source.id = t.source_warehouse_id
     JOIN warehouses destination ON destination.id = t.destination_warehouse_id
     JOIN trucks truck ON truck.id = t.truck_id
     LEFT JOIN linehaul_trip_bags tb ON tb.trip_id = t.id
     WHERE t.driver_id = ? AND t.status NOT IN ("completed","cancelled")
     GROUP BY t.id ORDER BY t.created_at DESC`,
    [req.authUser.id],
    (err, trips) => {
      if (err) return res.status(500).json({ success: false, message: 'Không tải được chuyến được giao: ' + err.sqlMessage });
      if (!trips.length) return res.json({ success: true, data: [] });
      const tripIds = trips.map((trip) => Number(trip.id));
      db.query(
        `SELECT tb.trip_id, b.id AS bag_id, b.bag_code, b.status, tb.driver_scanned_at,
          COUNT(bo.order_id) AS order_count,
          COALESCE(SUM(o.weight_kg), 0) AS weight_kg
         FROM linehaul_trip_bags tb JOIN shipment_bags b ON b.id = tb.bag_id
         LEFT JOIN shipment_bag_orders bo ON bo.bag_id = b.id
         LEFT JOIN orders o ON o.id = bo.order_id
         WHERE tb.trip_id IN (?)
         GROUP BY tb.trip_id, b.id
         ORDER BY b.bag_code`,
        [tripIds],
        (bagsErr, bags) => {
          if (bagsErr) return res.status(500).json({ success: false, message: 'Không tải được bao của chuyến: ' + bagsErr.sqlMessage });
          const bagsByTrip = new Map();
          for (const bag of bags) {
            const list = bagsByTrip.get(Number(bag.trip_id)) || [];
            list.push(bag);
            bagsByTrip.set(Number(bag.trip_id), list);
          }
          res.json({ success: true, data: trips.map((trip) => ({ ...trip, bags: bagsByTrip.get(Number(trip.id)) || [] })) });
        }
      );
    }
  );
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

app.get('/api/trucks', (req, res) => {
  const sql = req.authRole === 'warehouse_manager'
    ? `SELECT * FROM trucks truck WHERE truck.status = "ready"
       AND NOT EXISTS (
         SELECT 1 FROM linehaul_trips active_trip
         WHERE active_trip.truck_id = truck.id AND active_trip.status NOT IN ("completed","cancelled")
       )
       ORDER BY vehicle_plate`
    : 'SELECT * FROM trucks ORDER BY vehicle_plate';
  if (req.authRole !== 'warehouse_manager') {
    return db.query(sql, (err, trucks) => {
      if (err) return res.status(500).json({ success: false, message: 'Không tải được danh sách xe tải: ' + err.sqlMessage });
      res.json({ success: true, data: trucks });
    });
  }
  db.query(
    'SELECT warehouse_type FROM warehouses WHERE id = ? AND is_active = 1 LIMIT 1',
    [req.warehouseScopeId],
    (warehouseErr, warehouses) => {
      if (warehouseErr) return res.status(500).json({ success: false, message: 'Không thể xác minh quyền xem xe tải: ' + warehouseErr.sqlMessage });
      if (!warehouses.length || warehouses[0].warehouse_type !== 'central') {
        return res.status(403).json({ success: false, message: 'Chỉ Kho Tổng được xem xe sẵn sàng điều phối.' });
      }
      db.query(sql, (err, trucks) => {
    if (err) return res.status(500).json({ success: false, message: 'Không tải được danh sách xe tải: ' + err.sqlMessage });
    res.json({ success: true, data: trucks });
      });
    }
  );
});

app.post('/api/trucks', (req, res) => {
  const vehiclePlate = String(req.body.vehicle_plate || '').trim().toUpperCase();
  const maxPayloadKg = Number(req.body.max_payload_kg);
  if (!vehiclePlate || vehiclePlate.length > 30 || !Number.isFinite(maxPayloadKg) || maxPayloadKg <= 0) {
    return res.status(400).json({ success: false, message: 'Biển số xe và trọng tải tối đa phải hợp lệ.' });
  }
  db.query('INSERT INTO trucks (vehicle_plate, max_payload_kg) VALUES (?, ?)', [vehiclePlate, maxPayloadKg], (err, result) => {
    if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Biển số xe đã tồn tại.' });
    if (err) return res.status(500).json({ success: false, message: 'Không thể thêm xe tải: ' + err.sqlMessage });
    res.status(201).json({ success: true, data: { id: result.insertId, vehicle_plate: vehiclePlate, max_payload_kg: maxPayloadKg, status: 'ready' } });
  });
});

app.put('/api/trucks/:id', (req, res) => {
  const truckId = Number(req.params.id);
  const vehiclePlate = String(req.body.vehicle_plate || '').trim().toUpperCase();
  const maxPayloadKg = Number(req.body.max_payload_kg);
  const status = String(req.body.status || '');
  if (!Number.isInteger(truckId) || truckId <= 0 || !vehiclePlate || vehiclePlate.length > 30
    || !Number.isFinite(maxPayloadKg) || maxPayloadKg <= 0
    || !['ready', 'in_transit', 'maintenance'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Thông tin xe tải không hợp lệ.' });
  }
  db.query('SELECT id FROM linehaul_trips WHERE truck_id = ? AND status NOT IN ("completed","cancelled") LIMIT 1', [truckId], (activeTripErr, activeTrips) => {
    if (activeTripErr) return res.status(500).json({ success: false, message: 'Không thể kiểm tra chuyến xe: ' + activeTripErr.sqlMessage });
    if (activeTrips.length) return res.status(409).json({ success: false, message: 'Không thể sửa xe đang được gán vào chuyến chưa hoàn tất.' });
    db.query(
    'UPDATE trucks SET vehicle_plate = ?, max_payload_kg = ?, status = ? WHERE id = ?',
    [vehiclePlate, maxPayloadKg, status, truckId],
    (err, result) => {
      if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Biển số xe đã tồn tại.' });
      if (err) return res.status(500).json({ success: false, message: 'Không thể cập nhật xe tải: ' + err.sqlMessage });
      if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Không tìm thấy xe tải.' });
      res.json({ success: true, message: 'Đã cập nhật xe tải.' });
    }
    );
  });
});

app.delete('/api/trucks/:id', (req, res) => {
  const truckId = Number(req.params.id);
  if (!Number.isInteger(truckId) || truckId <= 0) return res.status(400).json({ success: false, message: 'Mã xe tải không hợp lệ.' });
  db.query('SELECT id FROM linehaul_trips WHERE truck_id = ? AND status NOT IN ("completed","cancelled") LIMIT 1', [truckId], (tripErr, trips) => {
    if (tripErr) return res.status(500).json({ success: false, message: 'Không thể kiểm tra chuyến xe: ' + tripErr.sqlMessage });
    if (trips.length) return res.status(409).json({ success: false, message: 'Không thể xóa xe đang được gán vào chuyến chưa hoàn tất.' });
    db.query('DELETE FROM trucks WHERE id = ?', [truckId], (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Không thể xóa xe tải: ' + err.sqlMessage });
      if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Không tìm thấy xe tải.' });
      res.json({ success: true, message: 'Đã xóa xe tải.' });
    });
  });
});

app.post('/api/linehaul/trips', (req, res) => {
  const truckId = Number(req.body.truck_id);
  const sourceId = Number(req.body.source_warehouse_id);
  const destinationId = Number(req.body.destination_warehouse_id);
  const driverId = req.body.driver_id ? Number(req.body.driver_id) : null;
  if (!Number.isInteger(truckId) || truckId <= 0 || !Number.isInteger(sourceId) || !Number.isInteger(destinationId)
    || sourceId <= 0 || destinationId <= 0 || sourceId === destinationId
    || !Number.isInteger(driverId) || driverId <= 0) {
    return res.status(400).json({ success: false, message: 'Chuyến xe cần xe tải và tài xế thuộc đội trung chuyển liên kho.' });
  }
  const tripCode = `TRIP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const insertTrip = (truck) => db.query(
    'INSERT INTO linehaul_trips (trip_code, vehicle_plate, truck_id, driver_id, source_warehouse_id, destination_warehouse_id) VALUES (?, ?, ?, ?, ?, ?)',
    [tripCode, truck.vehicle_plate, truck.id, driverId, sourceId, destinationId],
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
    if (req.authRole === 'warehouse_manager'
      && (sourceId !== Number(req.warehouseScopeId) || sourceWarehouse.warehouse_type !== 'central'
        || destinationWarehouse.warehouse_type !== 'ward')) {
      return res.status(403).json({ success: false, message: 'Kho Tổng chỉ được tạo chuyến từ kho được phân công đến một kho con.' });
    }
    db.query(
      `SELECT truck.id, truck.vehicle_plate FROM trucks truck
       WHERE truck.id = ? AND truck.status = "ready"
         AND NOT EXISTS (
           SELECT 1 FROM linehaul_trips active_trip
           WHERE active_trip.truck_id = truck.id AND active_trip.status NOT IN ("completed","cancelled")
         )
       LIMIT 1`,
      [truckId],
      (truckErr, trucks) => {
      if (truckErr) return res.status(500).json({ success: false, message: truckErr.sqlMessage });
      if (!trucks.length) return res.status(409).json({ success: false, message: 'Xe tải không tồn tại hoặc hiện không sẵn sàng.' });
      db.query(
        `SELECT driver.id FROM users driver
         WHERE driver.id = ? AND driver.status = "active" AND driver.role = "linehaul_driver"
           AND NOT EXISTS (
             SELECT 1 FROM linehaul_trips active_trip
             WHERE active_trip.driver_id = driver.id AND active_trip.status NOT IN ("completed","cancelled")
           )`,
        [driverId],
        (driverErr, drivers) => {
      if (driverErr) return res.status(500).json({ success: false, message: driverErr.sqlMessage });
      if (!drivers.length) return res.status(400).json({ success: false, message: 'Tài xế không hợp lệ hoặc đang được giao một chuyến chưa hoàn tất.' });
      insertTrip(trucks[0]);
      });
    });
  });
});

app.post('/api/linehaul/trips/:id/bags', (req, res) => {
  const tripId = Number(req.params.id);
  const bagCode = String(req.body.bag_code || '').trim().toUpperCase();
  if (!Number.isSafeInteger(tripId) || tripId <= 0 || !bagCode) {
    return res.status(400).json({ success: false, message: 'Mã chuyến hoặc mã bao không hợp lệ.' });
  }
  db.query(
    `SELECT t.*, truck.max_payload_kg, source.warehouse_type AS source_warehouse_type
     FROM linehaul_trips t
     JOIN trucks truck ON truck.id = t.truck_id
     JOIN warehouses source ON source.id = t.source_warehouse_id
     WHERE t.id = ? AND t.status IN ("planned","loading")`,
    [tripId],
    (tripErr, trips) => {
    if (tripErr) return res.status(500).json({ success: false, message: tripErr.sqlMessage });
    if (!trips.length) return res.status(409).json({ success: false, message: 'Chuyến xe không còn nhận bao.' });
    const trip = trips[0];
    if (req.authRole === 'warehouse_manager'
      && (Number(trip.source_warehouse_id) !== Number(req.warehouseScopeId)
        || trip.source_warehouse_type !== 'central')) {
      return res.status(403).json({ success: false, message: 'Chỉ Kho Tổng được gán bao lên chuyến xuất đi kho con.' });
    }
    db.query('SELECT * FROM shipment_bags WHERE bag_code = ? AND status = "sealed"', [bagCode], (bagErr, bags) => {
      if (bagErr) return res.status(500).json({ success: false, message: bagErr.sqlMessage });
      if (!bags.length) return res.status(404).json({ success: false, message: 'Không tìm thấy bao đã niêm phong.' });
      const bag = bags[0];
      if (Number(bag.source_warehouse_id) !== Number(trip.source_warehouse_id)
        || Number(bag.destination_warehouse_id) !== Number(trip.destination_warehouse_id)) {
        return res.status(409).json({ success: false, message: 'Tuyến bao không khớp với tuyến chuyến xe.' });
      }
      db.query(
        `SELECT
           (SELECT COALESCE(SUM(o.weight_kg), 0) FROM shipment_bag_orders bo JOIN orders o ON o.id = bo.order_id WHERE bo.bag_id = ?) AS bag_weight,
           (SELECT COALESCE(SUM(o.weight_kg), 0) FROM linehaul_trip_bags tb JOIN shipment_bag_orders bo ON bo.bag_id = tb.bag_id JOIN orders o ON o.id = bo.order_id WHERE tb.trip_id = ?) AS trip_weight`,
        [bag.id, trip.id],
        (weightErr, weights) => {
          if (weightErr) return res.status(500).json({ success: false, message: 'Không thể kiểm tra tải trọng chuyến: ' + weightErr.sqlMessage });
          const bagWeight = Number(weights[0].bag_weight || 0);
          const tripWeight = Number(weights[0].trip_weight || 0);
          if (tripWeight + bagWeight > Number(trip.max_payload_kg)) {
            return res.status(409).json({ success: false, message: `Tổng tải trọng vượt giới hạn xe (${tripWeight + bagWeight} kg / ${trip.max_payload_kg} kg).` });
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
});

app.post('/api/driver/trips/scan', (req, res) => {
  const driverId = Number(req.authUser.id);
  const bagCode = String(req.body.bag_code || '').trim().toUpperCase();
  if (!bagCode) {
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
    const { trip_id: tripId, bag_id: bagId } = rows[0];
    db.query('UPDATE linehaul_trip_bags SET driver_scanned_at = CURRENT_TIMESTAMP WHERE trip_id = ? AND bag_id = ? AND driver_scanned_at IS NULL', [tripId, bagId], (scanErr) => {
      if (scanErr) return res.status(500).json({ success: false, message: scanErr.sqlMessage });
      db.query('SELECT COUNT(*) AS total, SUM(driver_scanned_at IS NOT NULL) AS scanned FROM linehaul_trip_bags WHERE trip_id = ?', [tripId], (countErr, counts) => {
        if (countErr) return res.status(500).json({ success: false, message: countErr.sqlMessage });
        const scanned = Number(counts[0].scanned || 0);
        const total = Number(counts[0].total || 0);
        res.json({
          success: true,
          trip_id: Number(tripId),
          trip_ready: total > 0 && scanned === total,
          scanned,
          total,
          message: total > 0 && scanned === total
            ? 'Đã quét đủ bao. Bấm Bắt đầu khởi hành khi đã kiểm tra hàng trên xe.'
            : `Đã xác nhận bao (${scanned}/${total}). Quét các bao còn lại.`
        });
      });
    });
  });
});

app.post('/api/driver/trips/:id/start', (req, res) => {
  const tripId = Number(req.params.id);
  if (!Number.isSafeInteger(tripId) || tripId <= 0) return res.status(400).json({ success: false, message: 'Mã chuyến không hợp lệ.' });
  db.query(
    `SELECT t.destination_warehouse_id, t.truck_id, COUNT(tb.bag_id) AS total,
      SUM(tb.driver_scanned_at IS NOT NULL) AS scanned
     FROM linehaul_trips t LEFT JOIN linehaul_trip_bags tb ON tb.trip_id = t.id
     WHERE t.id = ? AND t.driver_id = ? AND t.status IN ("planned","loading")
     GROUP BY t.id`,
    [tripId, req.authUser.id],
    (checkErr, rows) => {
      if (checkErr) return res.status(500).json({ success: false, message: 'Không thể xác minh bao đã quét: ' + checkErr.sqlMessage });
      if (!rows.length) return res.status(404).json({ success: false, message: 'Không có chuyến đang xếp hàng được giao cho tài khoản này.' });
      if (!Number(rows[0].total) || Number(rows[0].total) !== Number(rows[0].scanned || 0)) {
        return res.status(409).json({ success: false, message: 'Cần quét đủ toàn bộ bao được gán trước khi khởi hành.' });
      }
      withTransaction(transactionPool, async (conn) => {
        const tripResult = await queryAsync(
          conn,
          'UPDATE linehaul_trips SET status = "in_transit", departed_at = CURRENT_TIMESTAMP WHERE id = ? AND driver_id = ? AND status IN ("planned","loading")',
          [tripId, req.authUser.id]
        );
        if (!tripResult.affectedRows) {
          throw new OrderTransitionError('TRIP_ALREADY_STARTED', 'Chuyến xe đã được khởi hành hoặc đã thay đổi trạng thái.');
        }
        await queryAsync(
          conn,
          'UPDATE shipment_bags b JOIN linehaul_trip_bags tb ON tb.bag_id = b.id SET b.status = "in_transit" WHERE tb.trip_id = ? AND b.status = "sealed"',
          [tripId]
        );
        await queryAsync(conn, 'UPDATE trucks SET status = "in_transit" WHERE id = ?', [rows[0].truck_id]);
        const destinationRows = await queryAsync(
          conn,
          'SELECT warehouse_type FROM warehouses WHERE id = ? LIMIT 1',
          [rows[0].destination_warehouse_id]
        );
        if (!destinationRows.length) throw new Error('Không tìm thấy kho đích của chuyến.');
        const orders = await queryAsync(
          conn,
          `SELECT DISTINCT o.id, o.status
           FROM orders o
           JOIN shipment_bag_orders bo ON bo.order_id = o.id
           JOIN linehaul_trip_bags tb ON tb.bag_id = bo.bag_id
           WHERE tb.trip_id = ? AND o.status IN ("at_origin_warehouse","at_central_warehouse")
           ORDER BY o.id`,
          [tripId]
        );
        if (!orders.length) throw new OrderTransitionError('NO_TRANSIT_ORDERS', 'Chuyến không có đơn hợp lệ để trung chuyển.');
        for (const order of orders) {
          const targetStatus = order.status === 'at_origin_warehouse'
            ? 'transferring_to_central'
            : 'transferring_to_destination';
          const routeMatchesDestination = order.status === 'at_origin_warehouse'
            ? destinationRows[0].warehouse_type === 'central'
            : destinationRows[0].warehouse_type !== 'central';
          if (!routeMatchesDestination) {
            throw new OrderTransitionError(
              'INVALID_TRIP_ROUTE',
              `Đơn ${order.id} không được định tuyến từ "${order.status}" đến loại kho đích này.`
            );
          }
          await transitionOrder(conn, {
            orderId: Number(order.id),
            toStatus: targetStatus,
            actor: { id: Number(req.authUser.id), role: req.authRole },
            note: `Tài xế khởi hành chuyến ${tripId}`
          });
        }
      }).then(() => {
        res.json({ success: true, trip_started: true, message: 'Chuyến xe đã bắt đầu trung chuyển.' });
      }).catch((error) => respondWithTransitionError(res, error, 'Không thể khởi hành chuyến:'));
    }
  );
});

app.post('/api/driver/trips/:id/arrive', (req, res) => {
  const tripId = Number(req.params.id);
  if (!Number.isSafeInteger(tripId) || tripId <= 0) return res.status(400).json({ success: false, message: 'Mã chuyến không hợp lệ.' });
  db.query(
    'UPDATE linehaul_trips SET status = "arrived", arrived_at = CURRENT_TIMESTAMP WHERE id = ? AND driver_id = ? AND status = "in_transit"',
    [tripId, req.authUser.id],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Không thể xác nhận đến kho: ' + err.sqlMessage });
      if (!result.affectedRows) return res.status(409).json({ success: false, message: 'Chuyến không được giao cho tài khoản này hoặc chưa khởi hành.' });
      res.json({ success: true, message: 'Đã báo đến kho đích. Vui lòng chờ thủ kho quét nhận bao.' });
    }
  );
});

app.post('/api/driver/trips/:id/location', (req, res) => {
  const tripId = Number(req.params.id);
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);
  if (!Number.isSafeInteger(tripId) || tripId <= 0
    || !Number.isFinite(lat) || Math.abs(lat) > 90
    || !Number.isFinite(lng) || Math.abs(lng) > 180) {
    return res.status(400).json({ success: false, message: 'Mã chuyến hoặc tọa độ GPS không hợp lệ.' });
  }
  db.query(
    `SELECT id FROM linehaul_trips
     WHERE id = ? AND driver_id = ? AND status IN ("in_transit","arrived") LIMIT 1`,
    [tripId, req.authUser.id],
    (tripErr, trips) => {
      if (tripErr) return res.status(500).json({ success: false, message: 'Không thể xác minh chuyến xe: ' + tripErr.sqlMessage });
      if (!trips.length) return res.status(404).json({ success: false, message: 'Không có chuyến đang chạy được giao cho tài khoản này.' });
      db.query(
        `INSERT INTO linehaul_trip_positions (trip_id, driver_id, lat, lng)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE driver_id = VALUES(driver_id), lat = VALUES(lat), lng = VALUES(lng), updated_at = CURRENT_TIMESTAMP`,
        [tripId, req.authUser.id, lat, lng],
        (saveErr) => {
          if (saveErr) return res.status(500).json({ success: false, message: 'Không lưu được vị trí GPS: ' + saveErr.sqlMessage });
          io.emit('linehaul_location_changed', { trip_id: tripId, driver_id: Number(req.authUser.id), lat, lng, timestamp: new Date().toISOString() });
          res.json({ success: true });
        }
      );
    }
  );
});

app.post('/api/warehouse/linehaul/scan', (req, res) => {
  const bagCode = String(req.body.bag_code || '').trim().toUpperCase();
  const warehouseId = Number(req.warehouseScopeId || req.body.warehouse_id);
  if (!bagCode || !Number.isInteger(warehouseId) || warehouseId <= 0) {
    return res.status(400).json({ success: false, message: 'Mã bao hoặc kho nhận không hợp lệ.' });
  }
  const bagSql = `
    SELECT b.*, t.id AS trip_id, t.trip_code
    FROM shipment_bags b
    JOIN linehaul_trip_bags tb ON tb.bag_id = b.id
    JOIN linehaul_trips t ON t.id = tb.trip_id
    WHERE b.bag_code = ? AND b.status = "in_transit" AND t.status IN ("in_transit","arrived")
      AND (? IS NULL OR b.destination_warehouse_id = ?)
  `;
  db.query(bagSql, [bagCode, req.warehouseScopeId || null, req.warehouseScopeId || null], (bagErr, bags) => {
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
      withTransaction(transactionPool, async (conn) => {
        const bagOrders = await queryAsync(
          conn,
          `SELECT o.id
           FROM orders o
           JOIN shipment_bag_orders bo ON bo.order_id = o.id
           WHERE bo.bag_id = ? AND o.status IN ("transferring_to_central","transferring_to_destination")
           ORDER BY o.id`,
          [bag.id]
        );
        if (!bagOrders.length) {
          throw new OrderTransitionError('NO_TRANSIT_ORDERS', 'Không có vận đơn trung chuyển hợp lệ trong bao.');
        }
        for (const order of bagOrders) {
          await transitionOrder(conn, {
            orderId: Number(order.id),
            toStatus: nextStatus,
            actor: { id: Number(req.authUser.id), role: req.authRole },
            note: `Nhập kho nhận bao ${bagCode}`,
            updates: { current_warehouse_id: warehouseId }
          });
        }
        const bagResult = await queryAsync(
          conn,
          'UPDATE shipment_bags SET status = "received", received_at = CURRENT_TIMESTAMP WHERE id = ? AND status = "in_transit"',
          [bag.id]
        );
        if (!bagResult.affectedRows) {
          throw new OrderTransitionError('BAG_ALREADY_RECEIVED', 'Bao đã được nhập kho.');
        }
        const pendingRows = await queryAsync(
          conn,
          'SELECT COUNT(*) AS pending FROM linehaul_trip_bags tb JOIN shipment_bags b ON b.id = tb.bag_id WHERE tb.trip_id = ? AND b.status != "received"',
          [bag.trip_id]
        );
        const finishTrip = Number(pendingRows[0].pending) === 0;
        if (finishTrip) {
          await queryAsync(
            conn,
            'UPDATE linehaul_trips SET status = "completed", arrived_at = CURRENT_TIMESTAMP WHERE id = ?',
            [bag.trip_id]
          );
          await queryAsync(
            conn,
            'UPDATE trucks SET status = "ready" WHERE id = (SELECT truck_id FROM linehaul_trips WHERE id = ?)',
            [bag.trip_id]
          );
        }
        return { affectedRows: bagOrders.length, finishTrip };
      }).then((orderResult) => {
              const finishTrip = orderResult.finishTrip;
              db.query(
                `SELECT o.id, o.tracking_code, o.status, o.delivery_shipper_id
                 FROM shipment_bag_orders bo
                 JOIN orders o ON o.id = bo.order_id
                 WHERE bo.bag_id = ?
                 ORDER BY o.tracking_code`,
                [bag.id],
                (contentsErr, orders) => {
                  if (contentsErr) return res.status(500).json({ success: false, message: 'Đã nhập bao nhưng không thể tải danh sách đơn: ' + contentsErr.sqlMessage });
                  const respond = () => res.json({
                    success: true,
                    order_count: orderResult.affectedRows,
                    data: { bag_code: bagCode, orders },
                    message: finishTrip
                      ? `Đã nhập kho ${orderResult.affectedRows} đơn trong bao ${bagCode}; chuyến xe hoàn tất.`
                      : `Đã nhập ${orderResult.affectedRows} đơn trong bao ${bagCode}.`
                  });
                  respond();
                }
              );
      }).catch((error) => respondWithTransitionError(res, error, 'Không thể nhập kho bao:'));
    });
  });
});

app.get('/api/warehouse/inventory', (req, res) => {
  const sql = 'SELECT o.*, w.name AS warehouse_name, w.ward_name, b.bin_code AS storage_bin_code, b.bin_name AS storage_bin_name FROM orders o LEFT JOIN warehouses w ON w.id = o.current_warehouse_id LEFT JOIN warehouse_bin_locations b ON b.id = o.storage_bin_id WHERE o.status = "at_central_warehouse" AND (? IS NULL OR o.current_warehouse_id = ?) ORDER BY o.updated_at DESC';
  const warehouseId = req.warehouseScopeId || (req.query.warehouse_id ? Number(req.query.warehouse_id) : null);
  db.query(sql, [warehouseId, warehouseId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true, data: redactDeliveryOtp(results) });
  });
});

// =========================================
// 5. API KẾ TOÁN (ĐỐI SOÁT COD)
// =========================================
const isValidPricingDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
  && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const mysqlDateOnly = (value) => value instanceof Date
  ? value.toISOString().slice(0, 10)
  : String(value).slice(0, 10);
const normalizePricingArea = (value) => String(value || '').trim();
const validPricingAreas = new Set(['GOVAP_ALL', ...govapWards.map((ward) => ward.properties.codeName)]);

app.get('/api/accountant/shipping-rates', (req, res) => {
  db.query('SELECT * FROM shipping_rates ORDER BY effective_from DESC, id DESC LIMIT 500', (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Không thể tải bảng giá vận chuyển.' });
    res.json({ success: true, data: rows });
  });
});

app.post('/api/accountant/shipping-rates', async (req, res) => {
  const body = req.body || {};
  const areaCode = normalizePricingArea(body.area_code);
  const serviceType = String(body.service_type || '');
  const effectiveFrom = String(body.effective_from || '');
  const effectiveTo = body.effective_to ? String(body.effective_to) : null;
  const decimalFields = ['min_weight_kg', 'max_weight_kg', 'included_distance_km', 'included_weight_kg', 'weight_step_kg'];
  const numeric = Object.fromEntries(decimalFields.map((field) => [field, body[field] === '' || body[field] === undefined || body[field] === null ? null : Number(body[field])]));
  let money;
  try {
    money = Object.fromEntries([
      'base_fee', 'distance_fee_per_km', 'weight_step_fee', 'remote_area_fee',
      'fragile_fee', 'rounding_increment'
    ].map((field) => [field, parseMoney(body[field] ?? (field === 'rounding_increment' ? 1 : 0))]));
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
  const multipliers = ['motorbike', 'van', 'truck'].map((type) => Number(body[`${type}_multiplier_milli`] ?? 1000));
  const maxWeight = numeric.max_weight_kg;
  if (!validPricingAreas.has(areaCode)
    || !['economy', 'standard', 'express'].includes(serviceType)
    || !isValidPricingDate(effectiveFrom)
    || effectiveTo && (!isValidPricingDate(effectiveTo) || effectiveTo < effectiveFrom)
    || Object.values(numeric).some((value) => value !== null && !Number.isFinite(value))
    || numeric.min_weight_kg === null || numeric.min_weight_kg < 0
    || maxWeight !== null && maxWeight <= numeric.min_weight_kg
    || numeric.included_distance_km === null || numeric.included_distance_km < 0
    || numeric.included_weight_kg === null || numeric.included_weight_kg < 0
    || numeric.weight_step_kg === null || numeric.weight_step_kg <= 0
    || Object.values(money).some((value) => value < 0n)
    || money.rounding_increment <= 0n
    || multipliers.some((value) => !Number.isInteger(value) || value < 1 || value > 10000)) {
    return res.status(400).json({ success: false, message: 'Thông tin bảng giá không hợp lệ.' });
  }
  const newValue = {
    area_code: areaCode,
    min_weight_kg: numeric.min_weight_kg,
    max_weight_kg: maxWeight,
    service_type: serviceType,
    ...Object.fromEntries(Object.entries(money).map(([key, value]) => [key, value.toString()])),
    included_distance_km: numeric.included_distance_km,
    included_weight_kg: numeric.included_weight_kg,
    weight_step_kg: numeric.weight_step_kg,
    motorbike_multiplier_milli: multipliers[0],
    van_multiplier_milli: multipliers[1],
    truck_multiplier_milli: multipliers[2],
    effective_from: effectiveFrom,
    effective_to: effectiveTo
  };
  try {
    const result = await withTransaction(transactionPool, async (conn) => {
      const inserted = await queryAsync(
        conn,
        `INSERT INTO shipping_rates
         (area_code, min_weight_kg, max_weight_kg, service_type, base_fee,
          included_distance_km, distance_fee_per_km, included_weight_kg, weight_step_kg,
          weight_step_fee, remote_area_fee, fragile_fee, motorbike_multiplier_milli,
          van_multiplier_milli, truck_multiplier_milli, rounding_increment,
          effective_from, effective_to, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          areaCode, numeric.min_weight_kg, maxWeight, serviceType, money.base_fee.toString(),
          numeric.included_distance_km, money.distance_fee_per_km.toString(), numeric.included_weight_kg,
          numeric.weight_step_kg, money.weight_step_fee.toString(), money.remote_area_fee.toString(),
          money.fragile_fee.toString(), ...multipliers, money.rounding_increment.toString(),
          effectiveFrom, effectiveTo, req.authUser.id
        ]
      );
      await queryAsync(
        conn,
        `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, ip)
         VALUES (?, ?, 'create', 'shipping_rate', ?, NULL, ?, ?)`,
        [req.authUser.id, normalizeRole(req.authUser.role), String(inserted.insertId), JSON.stringify(newValue), req.ip]
      );
      return inserted.insertId;
    });
    res.status(201).json({ success: true, message: 'Đã thêm phiên bản bảng giá.', data: { id: result } });
  } catch (error) {
    console.error('Không thể tạo bảng giá:', error);
    res.status(500).json({ success: false, message: 'Không thể lưu bảng giá.' });
  }
});

app.get('/api/accountant/pay-rules', (req, res) => {
  db.query('SELECT * FROM pay_rules ORDER BY effective_from DESC, id DESC LIMIT 500', (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Không thể tải quy tắc lương.' });
    res.json({ success: true, data: rows });
  });
});

app.get('/api/accountant/holidays', (req, res) => {
  db.query(
    "SELECT setting_value FROM system_settings WHERE setting_key = 'HOLIDAY_DATES' LIMIT 1",
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: 'Không thể tải danh sách ngày lễ.' });
      try {
        const dates = rows.length ? JSON.parse(rows[0].setting_value) : [];
        if (!Array.isArray(dates) || dates.some((date) => !isValidPricingDate(date))) {
          throw new TypeError('HOLIDAY_DATES must be an array of YYYY-MM-DD dates.');
        }
        res.json({ success: true, data: { dates } });
      } catch (parseError) {
        console.error('Cấu hình HOLIDAY_DATES không hợp lệ:', parseError);
        res.status(500).json({ success: false, message: 'Danh sách ngày lễ không hợp lệ trong system_settings.' });
      }
    }
  );
});

app.put('/api/accountant/holidays', async (req, res) => {
  const dates = req.body?.dates;
  if (!Array.isArray(dates) || dates.some((date) => !isValidPricingDate(date))) {
    return res.status(400).json({ success: false, message: 'Ngày lễ phải là danh sách ngày YYYY-MM-DD hợp lệ.' });
  }
  const normalizedDates = [...new Set(dates)].sort();
  try {
    await withTransaction(transactionPool, async (conn) => {
      const existing = await queryAsync(
        conn,
        "SELECT setting_value FROM system_settings WHERE setting_key = 'HOLIDAY_DATES' FOR UPDATE"
      );
      let oldValue = [];
      if (existing.length) {
        oldValue = JSON.parse(existing[0].setting_value);
        if (!Array.isArray(oldValue) || oldValue.some((date) => !isValidPricingDate(date))) {
          throw new TypeError('HOLIDAY_DATES must be an array of YYYY-MM-DD dates.');
        }
      }
      await queryAsync(
        conn,
        `INSERT INTO system_settings (setting_key, setting_value)
         VALUES ('HOLIDAY_DATES', ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [JSON.stringify(normalizedDates)]
      );
      await queryAsync(
        conn,
        `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, ip)
         VALUES (?, ?, 'update', 'holiday_dates', 'HOLIDAY_DATES', ?, ?, ?)`,
        [
          req.authUser.id, normalizeRole(req.authUser.role),
          JSON.stringify(oldValue), JSON.stringify(normalizedDates), req.ip
        ]
      );
    });
    res.json({ success: true, message: 'Đã cập nhật ngày lễ và ghi audit.', data: { dates: normalizedDates } });
  } catch (error) {
    console.error('Không thể cập nhật ngày lễ:', error);
    res.status(500).json({ success: false, message: 'Không thể cập nhật danh sách ngày lễ.' });
  }
});

app.post('/api/accountant/pay-rules', async (req, res) => {
  const body = req.body || {};
  const eventType = String(body.event_type || '');
  const areaCode = normalizePricingArea(body.area_code);
  const effectiveFrom = String(body.effective_from || '');
  const effectiveTo = body.effective_to ? String(body.effective_to) : null;
  const minWeight = Number(body.min_weight_kg ?? 0);
  const maxWeight = body.max_weight_kg === '' || body.max_weight_kg == null ? null : Number(body.max_weight_kg);
  const holidayMultiplier = Number(body.holiday_multiplier_milli ?? 1000);
  const amountInput = body.amount_vnd == null || body.amount_vnd === '' ? null : body.amount_vnd;
  const percentInput = body.percent_rate == null || body.percent_rate === '' ? null : body.percent_rate;
  let amount = null;
  if (amountInput !== null) {
    try {
      amount = parseMoney(amountInput);
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
  const percent = percentInput === null ? null : Number(percentInput);
  const startTime = body.start_time || null;
  const endTime = body.end_time || null;
  if (!['delivery_success', 'pickup', 'failed_valid', 'return'].includes(eventType)
    || !validPricingAreas.has(areaCode)
    || !isValidPricingDate(effectiveFrom)
    || effectiveTo && (!isValidPricingDate(effectiveTo) || effectiveTo < effectiveFrom)
    || !Number.isFinite(minWeight) || minWeight < 0
    || maxWeight !== null && (!Number.isFinite(maxWeight) || maxWeight <= minWeight)
    || !Number.isInteger(holidayMultiplier) || holidayMultiplier < 1 || holidayMultiplier > 10000
    || (amount === null && percent === null)
    || (amount !== null && percent !== null)
    || amount !== null && amount < 0n
    || percent !== null && (!Number.isFinite(percent) || percent < 0 || percent > 100)
    || (startTime === null) !== (endTime === null)
    || startTime !== null && (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(startTime)
      || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(endTime))) {
    return res.status(400).json({ success: false, message: 'Thông tin quy tắc lương không hợp lệ.' });
  }
  const newValue = {
    event_type: eventType, area_code: areaCode, min_weight_kg: minWeight, max_weight_kg: maxWeight,
    start_time: startTime, end_time: endTime, holiday_multiplier_milli: holidayMultiplier,
    amount_vnd: amount?.toString() ?? null, percent_rate: percent,
    effective_from: effectiveFrom, effective_to: effectiveTo
  };
  try {
    const result = await withTransaction(transactionPool, async (conn) => {
      const inserted = await queryAsync(
        conn,
        `INSERT INTO pay_rules
         (event_type, area_code, min_weight_kg, max_weight_kg, start_time, end_time,
          holiday_multiplier_milli, amount_vnd, percent_rate, effective_from, effective_to, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventType, areaCode, minWeight, maxWeight, startTime, endTime,
          holidayMultiplier, amount?.toString() ?? null, percent, effectiveFrom, effectiveTo, req.authUser.id
        ]
      );
      await queryAsync(
        conn,
        `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, ip)
         VALUES (?, ?, 'create', 'pay_rule', ?, NULL, ?, ?)`,
        [req.authUser.id, normalizeRole(req.authUser.role), String(inserted.insertId), JSON.stringify(newValue), req.ip]
      );
      return inserted.insertId;
    });
    res.status(201).json({ success: true, message: 'Đã thêm phiên bản quy tắc lương.', data: { id: result } });
  } catch (error) {
    console.error('Không thể tạo quy tắc lương:', error);
    res.status(500).json({ success: false, message: 'Không thể lưu quy tắc lương.' });
  }
});

app.get('/api/accountant/debt', (req, res) => {
  const requestedMonth = String(req.query.month || '');
  if (requestedMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)) {
    return res.status(400).json({ success: false, message: 'Shop, phương thức thanh toán, mã tham chiếu hoặc tháng đối soát không hợp lệ.' });
  }
  const month = requestedMonth || null;
  const sql = `
    SELECT u.id as shop_id, u.full_name as shop_name, u.email,
           COUNT(o.id) as total_orders,
           SUM(o.cod_payment_method = 'cash') AS cash_orders,
           SUM(o.cod_payment_method = 'bank_transfer') AS transfer_orders,
           COALESCE(SUM(o.cod_amount), 0) as total_cod,
           COALESCE(SUM(CASE WHEN o.fee_payer = 'sender' THEN o.shipping_fee ELSE 0 END), 0) as total_shipping_fee,
           COALESCE(SUM(o.service_fee), 0) as total_service_fee,
           COALESCE(SUM(o.insurance_fee), 0) as total_insurance_fee,
           COALESCE(SUM(o.failure_fee), 0) as total_failure_fee,
           COALESCE(SUM(o.cod_amount - CASE WHEN o.fee_payer = 'sender' THEN o.shipping_fee ELSE 0 END - o.service_fee - o.insurance_fee - o.failure_fee), 0) as total_payable
    FROM orders o
    JOIN users u ON o.shop_id = u.id
    WHERE o.status = 'completed' AND o.is_cod_paid = 0
      AND o.cod_collected = 1
      AND (o.cod_payment_method = 'bank_transfer'
        OR (o.cod_payment_method = 'cash' AND o.cod_remittance_id IS NOT NULL
          AND EXISTS (SELECT 1 FROM driver_cash_remittances r
            WHERE r.id = o.cod_remittance_id AND r.status = 'received')))
      AND (? IS NULL OR DATE_FORMAT(COALESCE(
        (SELECT MAX(e.created_at) FROM order_events e
         WHERE e.order_id = o.id AND e.to_status = 'completed'),
        o.updated_at
      ), '%Y-%m') = ?)
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
  withTransaction(transactionPool, async (conn) => depositDriverWallet(conn, {
    driverId, amount: req.body.amount, note: req.body.note,
    actor: { id: Number(req.authUser.id), role: req.authUser.role }, ip: req.ip
  }))
    .then((data) => res.status(201).json({
      success: true, data, message: 'Đã xác nhận nhận tiền ký quỹ và cộng vào ví tài xế.'
    }))
    .catch((error) => {
      console.error('Không thể nạp ví tài xế:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'Không thể hoàn tất giao dịch nạp ký quỹ.'
      });
    });
});

app.post('/api/driver/cash-remittances', (req, res) => {
  const driverId = Number(req.body.driver_id);
  if (!Number.isInteger(driverId) || driverId !== Number(req.authUser.id)) {
    return res.status(403).json({ success: false, message: 'Bạn chỉ được tạo phiếu nộp tiền cho tài khoản đang đăng nhập.' });
  }
  withTransaction(transactionPool, async (conn) => createDriverRemittance(conn, {
    driverId,
    workDate: req.body.work_date,
    actualAmount: req.body.actual_amount,
    varianceReason: req.body.variance_reason,
    actor: { id: driverId, role: req.authUser.role },
    ip: req.ip
  }))
    .then((data) => res.status(201).json({
      success: true,
      data: { remittance_id: data.remittanceId, amount: data.actualAmount, ...data },
      message: 'Đã ghi nhận yêu cầu nộp tiền. Kế toán cần xác nhận tiền mặt.'
    }))
    .catch((error) => {
    console.error('Không thể tạo phiếu nộp COD:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'Không thể hoàn tất phiếu nộp tiền.'
      });
    });
});

app.get('/api/driver/cash-remittances/expected', (req, res) => {
  const workDate = String(req.query.work_date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    return res.status(400).json({ success: false, message: 'Ngày làm việc không hợp lệ.' });
  }
  db.query(
    `SELECT COUNT(*) AS order_count, COALESCE(SUM(o.cod_collected_amount), 0) AS expected_amount
     FROM orders o
     WHERE o.delivery_shipper_id = ? AND o.status = 'completed'
       AND o.cod_collected = 1 AND o.cod_payment_method = 'cash'
       AND o.cod_collected_amount > 0
       AND o.cod_remittance_id IS NULL
       AND DATE(COALESCE(
         (SELECT MAX(e.created_at) FROM order_events e
          WHERE e.order_id = o.id AND e.to_status = 'completed'),
         o.updated_at
       )) = ?`,
    [Number(req.authUser.id), workDate],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: 'Không tính được số COD phải nộp.' });
      res.json({ success: true, data: rows[0] || { order_count: 0, expected_amount: '0.00' } });
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
  let amount;
  try {
    amount = parseMoney(req.body.amount);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
  const note = String(req.body.note || '').trim();
  const receipt = req.files?.receipt_image?.[0];
  if (!Number.isSafeInteger(driverId) || driverId <= 0
    || !['toll', 'parking', 'fuel', 'other'].includes(expenseType)
    || amount <= 0n || amount > 10000000n
    || note.length < 5 || note.length > 500 || !receipt) {
    return res.status(400).json({ success: false, message: 'Loại chi phí, số tiền, ghi chú hoặc ảnh biên lai không hợp lệ.' });
  }
  db.query(
    `INSERT INTO driver_expense_claims (driver_id, expense_type, amount, note, receipt_image)
     VALUES (?, ?, ?, ?, ?)`,
    [driverId, expenseType, amount.toString(), note, `/uploads/${receipt.filename}`],
    (err, result) => {
      if (err) return res.status(500).json({ success: false, message: 'Không thể gửi yêu cầu phụ phí: ' + err.sqlMessage });
      res.status(201).json({ success: true, data: { id: result.insertId }, message: 'Đã gửi biên lai chờ Kế toán duyệt.' });
    }
  );
});

app.get('/api/accountant/driver-remittances', (req, res) => {
  const status = ['pending', 'received'].includes(req.query.status) ? req.query.status : 'pending';
  const sql = `
    SELECT r.id, r.driver_id, u.full_name AS driver_name, r.amount, r.expected_amount,
      r.variance_amount, r.variance_reason, r.work_date, r.status,
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
  withTransaction(transactionPool, async (conn) => receiveDriverRemittance(conn, {
    remittanceId, accountantId, actorRole: req.authUser.role, ip: req.ip
  }))
    .then((data) => res.json({
      success: true, data,
      message: 'Đã xác nhận nhận tiền mặt và giải phóng ký quỹ các đơn trong phiếu.'
    }))
    .catch((error) => {
      console.error('Không thể xác nhận phiếu nộp COD:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'Không thể hoàn tất xác nhận phiếu nộp.'
      });
    });
});

app.get('/api/dispatcher/incidents', (req, res) => {
  const status = ['open', 'acknowledged', 'resolved'].includes(req.query.status) ? req.query.status : null;
  db.query(
    `SELECT i.id, i.driver_id, COALESCE(d.full_name, 'Không gắn tài xế') AS driver_name,
       i.reported_by, reporter.full_name AS reporter_name, i.order_id, o.tracking_code,
       i.incident_type, i.reason_code, i.fault_party, i.description, i.evidence_url,
       i.declared_value, i.customer_compensation_amount, i.shop_compensation_amount,
       i.driver_deduction_amount, i.salary_penalty_amount, i.claim_amount, i.lat, i.lng,
       i.status, i.review_note, i.created_at, i.resolved_at, reviewer.full_name AS reviewer_name
     FROM driver_incidents i
     LEFT JOIN users d ON d.id = i.driver_id
     LEFT JOIN users reporter ON reporter.id = i.reported_by
     LEFT JOIN orders o ON o.id = i.order_id
     LEFT JOIN users reviewer ON reviewer.id = i.reviewed_by
     WHERE (? IS NULL OR i.status = ?)
     ORDER BY (i.status = 'open') DESC, i.created_at DESC
     LIMIT 200`,
    [status, status],
    (err, incidents) => {
      if (err) return res.status(500).json({ success: false, message: 'Không tải được báo cáo sự cố: ' + err.sqlMessage });
      res.json({ success: true, data: incidents });
    }
  );
});

app.post('/api/dispatcher/incidents', async (req, res) => {
  const incidentType = String(req.body.incident_type || '');
  const description = String(req.body.description || '').trim();
  const orderId = req.body.order_id ? Number(req.body.order_id) : null;
  if (!['damaged_goods', 'lost_goods'].includes(incidentType) || !description || description.length > 2000
    || (orderId !== null && (!Number.isSafeInteger(orderId) || orderId <= 0))) {
    return res.status(400).json({ success: false, message: 'Chỉ được tạo sự cố hư hỏng/thất lạc kho tổng; nội dung hoặc đơn hàng không hợp lệ.' });
  }
  const reasonCode = incidentType === 'damaged_goods' ? 'WH_DAMAGED' : 'WH_LOST';
  try {
    const incidentId = await withTransaction(transactionPool, async (conn) => {
      const reasons = await queryAsync(conn,
        'SELECT code FROM reason_codes WHERE code = ? AND group_type = ? LIMIT 1',
        [reasonCode, 'WAREHOUSE']);
      if (!reasons.length) throw new OrderTransitionError('INVALID_REASON_CODE', 'Mã lý do sự cố kho chưa được cấu hình.', 503);
      let declaredValue = '0';
      if (orderId) {
        const orders = await queryAsync(conn, 'SELECT item_value, status FROM orders WHERE id = ? FOR UPDATE', [orderId]);
        if (!orders.length) throw new OrderTransitionError('ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.', 404);
        if (orders[0].status !== 'at_central_warehouse') {
          throw new OrderTransitionError('ORDER_NOT_AT_WAREHOUSE', 'Chỉ ghi nhận sự cố hàng đang ở kho tổng.', 409);
        }
        declaredValue = String(orders[0].item_value || '0');
      }
      const inserted = await queryAsync(conn, `INSERT INTO driver_incidents
        (driver_id, reported_by, order_id, incident_type, reason_code, fault_party,
         description, declared_value, status)
        VALUES (NULL, ?, ?, ?, ?, 'company', ?, ?, 'open')`,
      [Number(req.authUser.id), orderId, incidentType, reasonCode, description, declaredValue]);
      await queryAsync(conn, `INSERT INTO audit_logs
        (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, ip)
        VALUES (?, ?, 'driver_incident.created', 'driver_incident', ?, NULL, ?, ?)`,
      [Number(req.authUser.id), req.authRole, String(inserted.insertId),
        JSON.stringify({ incident_type: incidentType, reason_code: reasonCode, fault_party: 'company', order_id: orderId, declared_value: declaredValue }), req.ip]);
      return inserted.insertId;
    });
    io.to('fleet_tracking').emit('driver_incident', {
      id: incidentId, driver_id: null, order_id: orderId, incident_type: incidentType,
      reason_code: reasonCode, fault_party: 'company', description, status: 'open'
    });
    return res.status(201).json({ success: true, incident_id: incidentId, message: 'Đã ghi nhận sự cố kho tổng.' });
  } catch (error) {
    console.error('Không thể tạo sự cố kho tổng:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Không thể ghi nhận sự cố kho tổng.'
    });
  }
});

app.put('/api/dispatcher/incidents/:id', (req, res) => {
  const incidentId = Number(req.params.id);
  const status = String(req.body.status || '');
  const faultParty = String(req.body.fault_party || '');
  const reviewNote = String(req.body.review_note || '').trim();
  if (!Number.isSafeInteger(incidentId) || incidentId <= 0
    || !['acknowledged', 'resolved'].includes(status)
    || reviewNote.length > 500) {
    return res.status(400).json({ success: false, message: 'Trạng thái xử lý, số tiền bồi thường hoặc ghi chú không hợp lệ.' });
  }
  withTransaction(transactionPool, async (conn) => resolveIncident(conn, {
    incidentId, status,
    faultParty: faultParty || (req.body.claim_amount !== undefined ? 'driver' : ''),
    customerCompensationAmount: req.body.customer_compensation_amount ?? '0',
    shopCompensationAmount: req.body.shop_compensation_amount ?? '0',
    driverDeductionAmount: req.body.driver_deduction_amount ?? req.body.claim_amount ?? '0',
    salaryPenaltyAmount: req.body.salary_penalty_amount ?? '0',
    reviewNote, actor: { id: Number(req.authUser.id), role: req.authRole }, ip: req.ip
  }))
    .then((result) => {
      io.to('fleet_tracking').emit('driver_incident_updated', { incident_id: incidentId, status });
      const deductedAmount = parseMoney(result.driverDeductionAmount).toString();
      res.json({
        success: true,
        message: status === 'resolved'
          ? `Đã xử lý sự cố. Khấu trừ ký quỹ ${formatMoney(deductedAmount)} đ; bồi thường Shop/khách ${formatMoney(result.shopCompensationAmount)} / ${formatMoney(result.customerCompensationAmount)} đ.`
          : 'Đã ghi nhận và tiếp nhận sự cố.'
      });
    })
    .catch((error) => {
      console.error('Không thể cập nhật sự cố/ký quỹ:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'Không thể hoàn tất xử lý sự cố.'
      });
    });
});

const removeDriverIncidentEvidence = (file) => {
  if (!file) return;
  fs.unlink(file.path, (err) => {
    if (err && err.code !== 'ENOENT') console.error('Không thể xóa ảnh minh chứng sự cố không được lưu:', err);
  });
};

app.post('/api/driver/incidents', parsePodUpload([{ name: 'evidence_image', maxCount: 1 }]), async (req, res) => {
  const driverId = Number(req.authUser.id);
  const type = String(req.body.incident_type || '');
  const description = String(req.body.description || '').trim();
  const orderId = req.body.order_id ? Number(req.body.order_id) : null;
  const latitude = req.body.lat === undefined || req.body.lat === null ? null : Number(req.body.lat);
  const longitude = req.body.lng === undefined || req.body.lng === null ? null : Number(req.body.lng);
  const evidence = req.files?.evidence_image?.[0];
  const rejectWithEvidenceCleanup = (status, message) => {
    removeDriverIncidentEvidence(evidence);
    return res.status(status).json({ success: false, message });
  };
  if (!Number.isSafeInteger(driverId) || driverId <= 0
    || !['accident', 'vehicle_breakdown', 'traffic', 'wrong_item', 'customer_absent', 'damaged_goods', 'lost_goods', 'other'].includes(type)
    || !description || description.length > 2000
    || (orderId !== null && (!Number.isSafeInteger(orderId) || orderId <= 0))
    || ((latitude === null) !== (longitude === null))
    || (latitude !== null && (!Number.isFinite(latitude) || Math.abs(latitude) > 90))
    || (longitude !== null && (!Number.isFinite(longitude) || Math.abs(longitude) > 180))) {
    return rejectWithEvidenceCleanup(400, 'Thông tin sự cố hoặc tọa độ không hợp lệ.');
  }
  try {
    const incidentId = await withTransaction(transactionPool, async (conn) => {
      let declaredValue = '0';
      let orderStatus = null;
      if (orderId) {
        const orders = await queryAsync(conn, `SELECT id, item_value, status FROM orders
          WHERE id = ? AND (
            (pickup_shipper_id = ? AND status IN ('picking','picked_up'))
            OR (delivery_shipper_id = ? AND status IN ('at_central_warehouse','at_destination_warehouse','delivering'))
            OR (central_transfer_shipper_id = ? AND status = 'transferring_to_central')
            OR (destination_transfer_shipper_id = ? AND status = 'transferring_to_destination')
          ) FOR UPDATE`, [orderId, driverId, driverId, driverId, driverId]);
        if (!orders.length) throw new OrderTransitionError('INCIDENT_ORDER_FORBIDDEN', 'Đơn hàng không nằm trong nhiệm vụ đang giao của bạn.', 403);
        declaredValue = String(orders[0].item_value || '0');
        orderStatus = orders[0].status;
      }
      const reasonCode = FAILURE_REASON_BY_INCIDENT[type] || null;
      if (reasonCode) {
        const codes = await queryAsync(conn, 'SELECT code FROM reason_codes WHERE code = ? AND group_type = ? LIMIT 1', [reasonCode, 'DELIVERY']);
        if (!codes.length) throw new OrderTransitionError('INVALID_REASON_CODE', `Mã ${reasonCode} chưa được cấu hình.`, 503);
      }
      const inserted = await queryAsync(conn, `INSERT INTO driver_incidents
        (driver_id, reported_by, order_id, incident_type, reason_code, fault_party,
         description, evidence_url, declared_value, lat, lng)
        VALUES (?, ?, ?, ?, ?, 'company', ?, ?, ?, ?, ?)`, [
        driverId, driverId, orderId, type, reasonCode, description,
        evidence ? `/uploads/${evidence.filename}` : null, declaredValue, latitude, longitude
      ]);
      return { incidentId: inserted.insertId, declaredValue, orderStatus, reasonCode };
    });
    const incident = {
      id: incidentId.incidentId, driver_id: driverId,
      driver_name: req.authUser.full_name || 'Tài xế', order_id: orderId,
      incident_type: type, reason_code: incidentId.reasonCode, fault_party: 'company',
      description, evidence_url: evidence ? `/uploads/${evidence.filename}` : null,
      declared_value: incidentId.declaredValue, lat: latitude, lng: longitude,
      status: 'open', created_at: new Date().toISOString()
    };
    io.to('fleet_tracking').emit('driver_incident', incident);
    return res.status(201).json({ success: true, message: 'Đã gửi báo cáo sự cố đến trung tâm.', incident_id: incidentId.incidentId });
  } catch (error) {
    removeDriverIncidentEvidence(evidence);
    console.error('Không thể lưu báo cáo sự cố:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Không thể lưu báo cáo sự cố.'
    });
  }
});

app.put('/api/accountant/pay/:shop_id', (req, res) => {
  const shopId = Number(req.params.shop_id);
  const paymentMethod = String(req.body.payment_method || 'bank_transfer');
  const paymentReference = String(req.body.payment_reference || '').trim();
  const requestedMonth = String(req.query.month || '');
  if (!Number.isSafeInteger(shopId) || shopId <= 0
    || !['bank_transfer', 'cash'].includes(paymentMethod)
    || paymentReference.length > 100
    || requestedMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)) {
    return res.status(400).json({ success: false, message: 'Tháng đối soát không hợp lệ.' });
  }
  const month = requestedMonth || null;
  withTransaction(transactionPool, async (conn) => createShopSettlement(conn, {
    shopId, month, paymentMethod, paymentReference,
    accountantId: Number(req.authUser.id), actorRole: req.authUser.role, ip: req.ip
  }))
    .then((data) => res.json({
      success: true,
      settlement_id: data.settlementId,
      order_count: data.orderCount,
      total_paid: data.totalPaid,
      message: `Đã đối soát ${data.orderCount} đơn theo chu kỳ ${data.cycle}.`
    }))
    .catch((error) => {
      console.error('Không thể tạo đối soát COD cho Shop:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'Không thể hoàn tất đối soát COD.'
      });
    });
});

app.get('/api/accountant/settlement-cycle', (req, res) => {
  db.query(
    "SELECT setting_value FROM system_settings WHERE setting_key = 'COD_SETTLEMENT_CYCLE'",
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: 'Không tải được chu kỳ đối soát.' });
      res.json({ success: true, data: { cycle: rows[0]?.setting_value || 'T+1' } });
    }
  );
});

app.put('/api/accountant/settlement-cycle', (req, res) => {
  const cycle = String(req.body.cycle || '').toUpperCase();
  if (!['T+1', 'T+2', 'T+3', 'WEEKLY'].includes(cycle)) {
    return res.status(400).json({ success: false, message: 'Chu kỳ chỉ nhận T+1, T+2, T+3 hoặc WEEKLY.' });
  }
  withTransaction(transactionPool, async (conn) => {
    const rows = await queryAsync(
      conn,
      "SELECT setting_value FROM system_settings WHERE setting_key = 'COD_SETTLEMENT_CYCLE' FOR UPDATE"
    );
    await queryAsync(
      conn,
      `INSERT INTO system_settings (setting_key, setting_value)
       VALUES ('COD_SETTLEMENT_CYCLE', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [cycle]
    );
    await queryAsync(conn, `INSERT INTO audit_logs
      (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, ip)
      VALUES (?, ?, 'cod_settlement_cycle.update', 'system_setting', 'COD_SETTLEMENT_CYCLE', ?, ?, ?)`,
    [Number(req.authUser.id), req.authUser.role,
      JSON.stringify({ cycle: rows[0]?.setting_value || null }), JSON.stringify({ cycle }), req.ip]);
    return cycle;
  })
    .then((savedCycle) => res.json({ success: true, data: { cycle: savedCycle } }))
    .catch((error) => {
      console.error('Không thể cập nhật chu kỳ đối soát:', error);
      res.status(500).json({ success: false, message: 'Không thể lưu chu kỳ đối soát.' });
    });
});

app.put('/api/accountant/orders/:orderId/failure-fee', (req, res) => {
  const orderId = Number(req.params.orderId);
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ success: false, message: 'Mã đơn không hợp lệ.' });
  }
  withTransaction(transactionPool, async (conn) => setOrderFailureFee(conn, {
    orderId, amount: req.body.amount, note: req.body.note,
    actor: { id: Number(req.authUser.id), role: req.authUser.role }, ip: req.ip
  }))
    .then((data) => res.json({ success: true, data, message: 'Đã cập nhật phí giao thất bại và ghi audit.' }))
    .catch((error) => {
      console.error('Không thể cập nhật phí giao thất bại:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'Không thể lưu phí giao thất bại.'
      });
    });
});

app.get('/api/accountant/history', (req, res) => {
  const month = String(req.query.month || '');
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return res.status(400).json({ success: false, message: 'Tháng lọc lịch sử không hợp lệ.' });
  }
  const sql = `
        SELECT s.id as settlement_id, u.id as shop_id, u.full_name as shop_name, u.email,
          s.order_count as total_orders, s.total_cod, s.total_shipping_fee,
          s.total_service_fee, s.total_insurance_fee, s.total_failure_fee,
          s.total_paid, s.cycle_code, s.period_start, s.period_end,
          s.payment_method, s.payment_reference, s.settled_at
        FROM cod_settlements s
        JOIN users u ON s.shop_id = u.id
        WHERE (? = '' OR DATE_FORMAT(s.settled_at, '%Y-%m') = ?)
        ORDER BY s.settled_at DESC
  `;
  db.query(sql, [month, month], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: err.sqlMessage });
    res.json({ success: true, data: results });
  });
});

app.get('/api/accountant/reports', (req, res) => {
  const period = String(req.query.period || 'month');
  const reportDate = String(req.query.date || new Date().toISOString().slice(0, 10));
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(reportDate);
  if (!['day', 'week', 'month'].includes(period) || !dateParts) {
    return res.status(400).json({ success: false, message: 'Khoảng thời gian hoặc ngày báo cáo không hợp lệ.' });
  }
  const dateObject = new Date(Date.UTC(Number(dateParts[1]), Number(dateParts[2]) - 1, Number(dateParts[3])));
  if (Number.isNaN(dateObject.getTime()) || dateObject.toISOString().slice(0, 10) !== reportDate) {
    return res.status(400).json({ success: false, message: 'Ngày báo cáo không tồn tại.' });
  }
  const formatDate = (date) => date.toISOString().slice(0, 10);
  let start = new Date(dateObject);
  let end = new Date(dateObject);
  if (period === 'week') {
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
  } else if (period === 'month') {
    start = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  } else {
    end.setUTCDate(end.getUTCDate() + 1);
  }
  const startDate = formatDate(start);
  const endDate = formatDate(end);
  const filters = ['DATE(o.updated_at) >= ?', 'DATE(o.updated_at) < ?'];
  const orderParams = [startDate, endDate];
  const optionalFilters = [
    ['warehouse_id', 'o.destination_warehouse_id'],
    ['driver_id', 'o.delivery_shipper_id'],
    ['shop_id', 'o.shop_id']
  ];
  const filterValues = {};
  for (const [key, column] of optionalFilters) {
    const rawValue = req.query[key];
    if (rawValue === undefined || rawValue === '') {
      filterValues[key] = null;
      continue;
    }
    const id = Number(rawValue);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: `Bộ lọc ${key} không hợp lệ.` });
    }
    filters.push(`${column} = ?`);
    orderParams.push(id);
    filterValues[key] = id;
  }
  const whereOrders = filters.join(' AND ');
  const measures = `
    COUNT(*) AS total_orders,
    SUM(o.status = 'completed') AS successful_orders,
    SUM(o.status IN ('pickup_failed','delivery_failed','return_pending','returning','returned','cancelled','failed')) AS failed_orders,
    COALESCE(SUM(CASE WHEN o.status = 'completed' AND o.cod_collected = 1
      THEN o.cod_collected_amount ELSE 0 END), 0) AS total_cod_collected,
    COALESCE(SUM(CASE WHEN o.status = 'completed' AND o.cod_collected = 1
      AND o.cod_payment_method = 'cash' THEN o.cod_collected_amount ELSE 0 END), 0) AS cash_collected,
    COALESCE(SUM(CASE WHEN o.status = 'completed' AND o.cod_collected = 1
      AND o.cod_payment_method = 'bank_transfer' THEN o.cod_collected_amount ELSE 0 END), 0) AS bank_transfer_collected,
    COALESCE(SUM(CASE WHEN o.status = 'completed' AND o.cod_collected = 1 AND o.is_cod_paid = 0
      AND (o.cod_payment_method = 'bank_transfer'
        OR (o.cod_payment_method = 'cash' AND o.cod_remittance_id IS NOT NULL
          AND EXISTS (SELECT 1 FROM driver_cash_remittances report_remittance
            WHERE report_remittance.id = o.cod_remittance_id AND report_remittance.status = 'received')))
      THEN o.cod_amount - CASE WHEN o.fee_payer = 'sender' THEN o.shipping_fee ELSE 0 END
        - o.service_fee - o.insurance_fee - o.failure_fee ELSE 0 END), 0) AS shop_payable
  `;
  const runQueries = {
    summary: `SELECT ${measures} FROM orders o WHERE ${whereOrders}`,
    by_area: `SELECT o.destination_warehouse_id AS id, w.name AS name, ${measures}
      FROM orders o LEFT JOIN warehouses w ON w.id = o.destination_warehouse_id
      WHERE ${whereOrders} GROUP BY o.destination_warehouse_id, w.name ORDER BY total_orders DESC`,
    by_driver: `SELECT o.delivery_shipper_id AS id, d.full_name AS name, ${measures}
      FROM orders o LEFT JOIN users d ON d.id = o.delivery_shipper_id
      WHERE ${whereOrders} GROUP BY o.delivery_shipper_id, d.full_name ORDER BY total_orders DESC`,
    by_shop: `SELECT o.shop_id AS id, s.full_name AS name, ${measures}
      FROM orders o LEFT JOIN users s ON s.id = o.shop_id
      WHERE ${whereOrders} GROUP BY o.shop_id, s.full_name ORDER BY total_orders DESC`,
    remittances: `SELECT r.id, r.driver_id, u.full_name AS driver_name, r.amount,
        r.expected_amount, r.variance_amount, r.variance_reason, r.work_date, r.status,
        r.created_at, r.received_at, accountant.full_name AS received_by_name
      FROM driver_cash_remittances r
      JOIN users u ON u.id = r.driver_id
      LEFT JOIN users accountant ON accountant.id = r.received_by
      WHERE DATE(r.created_at) >= ? AND DATE(r.created_at) < ?
        ${filterValues.driver_id ? 'AND r.driver_id = ?' : ''}
      ORDER BY r.created_at DESC`,
    settlements: `SELECT s.id AS settlement_id, s.shop_id, u.full_name AS shop_name,
        s.total_cod, s.total_paid, s.total_failure_fee, s.order_count, s.cycle_code,
        s.period_start, s.period_end, s.payment_method, s.payment_reference, s.settled_at,
        accountant.full_name AS paid_by_name
      FROM cod_settlements s
      JOIN users u ON u.id = s.shop_id
      LEFT JOIN users accountant ON accountant.id = s.paid_by
      WHERE DATE(s.settled_at) >= ? AND DATE(s.settled_at) < ?
        ${filterValues.shop_id ? 'AND s.shop_id = ?' : ''}
        ${filterValues.warehouse_id || filterValues.driver_id ? `AND EXISTS (
          SELECT 1 FROM orders settled_order WHERE settled_order.cod_settlement_id = s.id
          ${filterValues.warehouse_id ? 'AND settled_order.destination_warehouse_id = ?' : ''}
          ${filterValues.driver_id ? 'AND settled_order.delivery_shipper_id = ?' : ''}
        )` : ''}
      ORDER BY s.settled_at DESC`
  };
  const settlementParams = [startDate, endDate];
  if (filterValues.shop_id) settlementParams.push(filterValues.shop_id);
  if (filterValues.warehouse_id || filterValues.driver_id) {
    if (filterValues.warehouse_id) settlementParams.push(filterValues.warehouse_id);
    if (filterValues.driver_id) settlementParams.push(filterValues.driver_id);
  }
  const remittanceParams = [startDate, endDate];
  if (filterValues.driver_id) remittanceParams.push(filterValues.driver_id);
  const results = {};
  let remaining = Object.keys(runQueries).length;
  let responded = false;
  const finish = (key, label, err, rows) => {
    if (responded) return;
    if (err) {
      responded = true;
      return res.status(500).json({ success: false, message: `Không tải được báo cáo (${label}): ${err.sqlMessage}` });
    }
    if (!Array.isArray(rows)) {
      responded = true;
      console.error(`Truy vấn báo cáo (${label}) không trả về danh sách kết quả.`);
      return res.status(500).json({ success: false, message: `Không tải được báo cáo (${label}).` });
    }
    results[key] = rows;
    remaining -= 1;
    if (remaining) return;
    res.json({
      success: true,
      data: {
        period, start_date: startDate, end_date: endDate,
        filters: filterValues,
        summary: results.summary[0] || {},
        by_area: results.by_area,
        by_driver: results.by_driver,
        by_shop: results.by_shop,
        remittances: results.remittances,
        settlements: results.settlements
      }
    });
  };
  db.query(runQueries.summary, orderParams, (err, rows) => finish('summary', 'tổng hợp', err, rows));
  db.query(runQueries.by_area, orderParams, (err, rows) => finish('by_area', 'khu vực', err, rows));
  db.query(runQueries.by_driver, orderParams, (err, rows) => finish('by_driver', 'tài xế', err, rows));
  db.query(runQueries.by_shop, orderParams, (err, rows) => finish('by_shop', 'Shop', err, rows));
  db.query(runQueries.remittances, remittanceParams, (err, rows) => finish('remittances', 'phiếu thu', err, rows));
  db.query(runQueries.settlements, settlementParams, (err, rows) => finish('settlements', 'phiếu chi', err, rows));
});

app.get('/api/accountant/settlements/:id', (req, res) => {
  const settlementId = Number(req.params.id);
  if (!Number.isInteger(settlementId) || settlementId <= 0) {
    return res.status(400).json({ success: false, message: 'Mã đợt đối soát không hợp lệ.' });
  }
  const sql = `
    SELECT s.id AS settlement_id, s.shop_id, u.full_name AS shop_name, u.email,
      s.total_cod, s.total_shipping_fee,
      s.total_service_fee, s.total_insurance_fee, s.total_failure_fee, s.total_paid,
      s.cycle_code, s.period_start, s.period_end, s.payment_reference,
      s.order_count, s.settled_at,
      o.id AS order_id, o.tracking_code, o.receiver_name, o.receiver_phone,
      o.cod_amount, o.shipping_fee, o.fee_payer, o.service_fee, o.insurance_fee, o.failure_fee
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
      total_failure_fee: rows[0].total_failure_fee,
      total_paid: rows[0].total_paid,
      cycle_code: rows[0].cycle_code,
      period_start: rows[0].period_start,
      period_end: rows[0].period_end,
      payment_reference: rows[0].payment_reference,
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
        insurance_fee: row.insurance_fee,
        failure_fee: row.failure_fee
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
      s.total_failure_fee, s.cycle_code, s.period_start, s.period_end, s.total_paid, s.settled_at, u.full_name AS shop_name, u.email,
      o.tracking_code, o.cod_amount, o.shipping_fee, o.fee_payer, o.service_fee, o.insurance_fee, o.failure_fee
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
        <td>${formatMoney(row.cod_amount || 0)}</td>
        <td>${formatMoney(row.fee_payer === 'sender' ? row.shipping_fee : 0)}</td>
        <td>${formatMoney(row.service_fee || 0)}</td>
        <td>${formatMoney(row.insurance_fee || 0)}</td>
        <td>${formatMoney(row.failure_fee || 0)}</td>
      </tr>`).join('');
    const summary = rows[0];
    const html = `<div style="font-family:Arial,sans-serif;color:#0f172a">
      <h1>Smart Logistics · Phiếu đối soát COD #${summary.id}</h1>
      <p>Kính gửi ${escapeHtml(summary.shop_name)} (${escapeHtml(summary.email)}),</p>
      <p>Ngày đối soát: ${new Date(summary.settled_at).toLocaleString('vi-VN')}</p>
      <p>Chu kỳ: ${escapeHtml(summary.cycle_code || '')} · ${escapeHtml(summary.period_start || '')} - ${escapeHtml(summary.period_end || '')}</p>
      <table style="border-collapse:collapse;width:100%" border="1" cellpadding="8">
        <thead><tr><th>Mã đơn</th><th>COD</th><th>Cước shop trả</th><th>Phí dịch vụ</th><th>Bảo hiểm</th><th>Phí giao thất bại</th></tr></thead>
        <tbody>${orderRows}</tbody>
      </table>
      <p>Tổng COD: <strong>${formatMoney(summary.total_cod)} đ</strong></p>
      <p>Cước trừ của Shop: -${formatMoney(summary.total_shipping_fee)} đ</p>
      <p>Phí dịch vụ: -${formatMoney(summary.total_service_fee)} đ</p>
      <p>Phí bảo hiểm: -${formatMoney(summary.total_insurance_fee || 0)} đ</p>
      <p>Phí giao thất bại: -${formatMoney(summary.total_failure_fee || 0)} đ</p>
      <h2>Tiền Shop nhận: ${formatMoney(summary.total_paid)} đ</h2>
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
  const sql = `SELECT u.id, u.full_name, u.email, u.role, u.status, u.warehouse_id, w.name AS warehouse_name, u.created_at
    FROM users u LEFT JOIN warehouses w ON w.id = u.warehouse_id
    WHERE u.role != "customer" ORDER BY u.id DESC`;
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
  const warehouseId = normalizedRole === 'warehouse_manager' ? Number(req.body.warehouse_id) : null;
  const normalizedEmail = String(email).trim();
  const normalizedName = String(full_name).trim();
  const normalizedStatus = status || 'active';
  if (!normalizedName || normalizedName.length > 255
    || normalizedEmail.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    || !staffRoles.has(normalizedRole) || !staffStatuses.has(normalizedStatus)) {
    return res.status(400).json({ success: false, message: 'Họ tên, email, chức vụ hoặc trạng thái nhân sự không hợp lệ.' });
  }
  if (normalizedRole === 'warehouse_manager' && (!Number.isInteger(warehouseId) || warehouseId <= 0)) {
    return res.status(400).json({ success: false, message: 'Vui lòng chọn kho được phân công cho thủ kho.' });
  }

  const createStaff = () => hashPassword(password).then((passwordHash) => {
    const sql = 'INSERT INTO users (full_name, email, password, role, status, warehouse_id) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(sql, [normalizedName, normalizedEmail, passwordHash, normalizedRole, normalizedStatus, warehouseId], (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Email đã tồn tại trong hệ thống.' });
        return res.status(500).json({ success: false, message: 'Lỗi tạo nhân sự: ' + err.sqlMessage });
      }
      res.json({ success: true, message: 'Đã tạo nhân sự mới thành công.', staffId: result.insertId });
    });
  }).catch((error) => {
    console.error('Lỗi băm mật khẩu nhân sự mới:', error);
    res.status(500).json({ success: false, message: 'Không thể tạo mật khẩu an toàn cho nhân sự.' });
  });
  if (!warehouseId) return createStaff();
  db.query('SELECT id FROM warehouses WHERE id = ? AND is_active = 1 LIMIT 1', [warehouseId], (warehouseErr, warehouses) => {
    if (warehouseErr) return res.status(500).json({ success: false, message: 'Không thể xác minh kho được phân công: ' + warehouseErr.sqlMessage });
    if (!warehouses.length) return res.status(400).json({ success: false, message: 'Kho được chọn không tồn tại hoặc đã ngừng hoạt động.' });
    createStaff();
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
  const warehouseId = normalizedRole === 'warehouse_manager' ? Number(req.body.warehouse_id) : null;
  const normalizedStatus = status || 'active';
  if (!normalizedName || normalizedName.length > 255
    || normalizedEmail.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    || !staffRoles.has(normalizedRole) || !staffStatuses.has(normalizedStatus)) {
    return res.status(400).json({ success: false, message: 'Họ tên, email, chức vụ hoặc trạng thái nhân sự không hợp lệ.' });
  }
  if (normalizedRole === 'warehouse_manager' && (!Number.isInteger(warehouseId) || warehouseId <= 0)) {
    return res.status(400).json({ success: false, message: 'Vui lòng chọn kho được phân công cho thủ kho.' });
  }

  const updates = [normalizedName, normalizedEmail, normalizedRole, normalizedStatus, warehouseId];
  const sql = 'UPDATE users SET full_name = ?, email = ?, role = ?, status = ?, warehouse_id = ?';

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

  const updateStaff = () => {
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
  };
  if (!warehouseId) return updateStaff();
  db.query('SELECT id FROM warehouses WHERE id = ? AND is_active = 1 LIMIT 1', [warehouseId], (warehouseErr, warehouses) => {
    if (warehouseErr) return res.status(500).json({ success: false, message: 'Không thể xác minh kho được phân công: ' + warehouseErr.sqlMessage });
    if (!warehouses.length) return res.status(400).json({ success: false, message: 'Kho được chọn không tồn tại hoặc đã ngừng hoạt động.' });
    updateStaff();
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

app.get('/api/hr/payroll/period/:month', async (req, res) => {
  const month = String(req.params.month || '');
  if (!validMonth(month)) return res.status(400).json({ success: false, message: 'Tháng lương không hợp lệ.' });
  try {
    const periods = await queryAsync(db, 'SELECT * FROM payroll_periods WHERE payroll_month = ? LIMIT 1', [month]);
    const period = periods[0] || { payroll_month: month, status: 'open', locked_at: null };
    const slips = period.id
      ? await queryAsync(db, `SELECT p.id, p.user_id, u.full_name, u.role,
          p.gross_amount, p.deduction_amount, p.net_amount
        FROM payslips p JOIN users u ON u.id = p.user_id
        WHERE p.payroll_period_id = ? ORDER BY u.full_name`, [period.id])
      : [];
    res.json({ success: true, data: { ...period, payslips: slips } });
  } catch (error) {
    console.error('Không thể tải kỳ lương:', error);
    res.status(500).json({ success: false, message: 'Không thể tải trạng thái kỳ lương.' });
  }
});

app.post('/api/hr/payroll/period/:month/lock', async (req, res) => {
  const month = String(req.params.month || '');
  if (!validMonth(month)) return res.status(400).json({ success: false, message: 'Tháng lương không hợp lệ.' });
  try {
    const result = await closePayrollPeriod(transactionPool, month, {
      id: Number(req.authUser.id),
      role: req.authRole,
      ip: req.ip
    });
    res.json({ success: true, message: `Đã chốt kỳ lương ${month}.`, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) console.error('Không thể chốt kỳ lương:', error);
    res.status(statusCode).json({
      success: false,
      code: error.code || 'PAYROLL_LOCK_FAILED',
      message: statusCode >= 500 ? 'Không thể chốt kỳ lương; toàn bộ giao dịch đã được hoàn tác.' : error.message
    });
  }
});

app.post('/api/hr/payroll/:userId/deductions', async (req, res) => {
  const userId = Number(req.params.userId);
  const month = String(req.body.month || '');
  const type = String(req.body.deduction_type || '');
  const reason = String(req.body.reason || '').trim();
  let amount;
  try {
    amount = parseMoney(req.body.amount);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
  if (!Number.isInteger(userId) || userId <= 0 || !validMonth(month)
    || !['security_deposit', 'advance'].includes(type)
    || amount <= 0n || !reason || reason.length > 255) {
    return res.status(400).json({ success: false, message: 'Thông tin ký quỹ hoặc tạm ứng không hợp lệ.' });
  }
  try {
    await withTransaction(transactionPool, async (conn) => {
      await queryAsync(conn, `INSERT INTO payroll_periods (payroll_month, opened_by)
        VALUES (?, ?) ON DUPLICATE KEY UPDATE payroll_month = VALUES(payroll_month)`,
      [month, req.authUser.id]);
      const periods = await queryAsync(conn, 'SELECT * FROM payroll_periods WHERE payroll_month = ? FOR UPDATE', [month]);
      if (periods[0].status !== 'open') {
        throw payrollError('Kỳ lương đã khóa; không thể thêm khoản khấu trừ.', 409, 'PAYROLL_PERIOD_LOCKED');
      }
      const users = await queryAsync(conn, 'SELECT id, role FROM users WHERE id = ? AND role <> ? FOR UPDATE', [userId, 'customer']);
      if (!users.length) throw payrollError('Không tìm thấy nhân viên.', 404, 'PAYROLL_EMPLOYEE_NOT_FOUND');
      if (type === 'security_deposit' && !['pickup_driver', 'delivery_driver'].includes(users[0].role)) {
        throw payrollError('Chỉ được lập khoản ký quỹ cho tài xế.', 400, 'PAYROLL_DEDUCTION_ROLE_INVALID');
      }
      const inserted = await queryAsync(conn, `INSERT INTO payroll_deductions
        (user_id, deduction_type, amount, remaining_amount, reason, created_by)
        VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, type, amount.toString(), amount.toString(), reason, req.authUser.id]);
      await queryAsync(conn, `INSERT INTO audit_logs
        (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, ip)
        VALUES (?, ?, 'payroll.deduction.created', 'payroll_deduction', ?, NULL, ?, ?)`,
      [req.authUser.id, req.authRole, String(inserted.insertId),
        JSON.stringify({ user_id: userId, deduction_type: type, amount: amount.toString(), reason }), req.ip]);
    });
    res.status(201).json({ success: true, message: 'Đã ghi nhận khoản khấu trừ cho kỳ lương.' });
  } catch (error) {
    if (error.statusCode && error.statusCode < 500) {
      return res.status(error.statusCode).json({ success: false, code: error.code, message: error.message });
    }
    console.error('Không thể tạo khoản khấu trừ lương:', error);
    res.status(500).json({ success: false, message: 'Không thể ghi nhận khoản khấu trừ.' });
  }
});

app.get('/api/hr/payroll/payslips/:userId', async (req, res) => {
  const userId = Number(req.params.userId);
  const month = String(req.query.month || '');
  if (!Number.isInteger(userId) || userId <= 0 || !validMonth(month)) {
    return res.status(400).json({ success: false, message: 'Nhân viên hoặc tháng lương không hợp lệ.' });
  }
  try {
    const rows = await queryAsync(db, `SELECT p.*, u.full_name, u.email, u.role, pp.payroll_month
      FROM payslips p
      JOIN payroll_periods pp ON pp.id = p.payroll_period_id AND pp.status = 'locked'
      JOIN users u ON u.id = p.user_id
      WHERE p.user_id = ? AND pp.payroll_month = ? LIMIT 1`, [userId, month]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Chưa có phiếu lương đã chốt cho nhân viên này.' });
    const lines = await queryAsync(db, `SELECT line_type, description, amount, order_id,
        source_type, source_id, rule_id, detail_json
      FROM payslip_lines WHERE payslip_id = ? ORDER BY id`, [rows[0].id]);
    res.json({
      success: true,
      data: {
        ...rows[0],
        snapshot: typeof rows[0].snapshot_json === 'string' ? JSON.parse(rows[0].snapshot_json) : rows[0].snapshot_json,
        lines: lines.map((line) => ({
          ...line,
          detail: typeof line.detail_json === 'string' && line.detail_json
            ? JSON.parse(line.detail_json) : line.detail_json
        }))
      }
    });
  } catch (error) {
    console.error('Không thể tải chi tiết phiếu lương:', error);
    res.status(500).json({ success: false, message: 'Không thể tải chi tiết phiếu lương.' });
  }
});

app.get('/api/hr/payroll/payslips/:userId/pdf', async (req, res) => {
  const userId = Number(req.params.userId);
  const month = String(req.query.month || '');
  if (!Number.isInteger(userId) || userId <= 0 || !validMonth(month)) {
    return res.status(400).json({ success: false, message: 'Nhân viên hoặc tháng lương không hợp lệ.' });
  }
  try {
    const slips = await queryAsync(db, `SELECT p.*, u.full_name, u.email, u.role
      FROM payslips p JOIN payroll_periods pp ON pp.id = p.payroll_period_id
      JOIN users u ON u.id = p.user_id
      WHERE p.user_id = ? AND pp.payroll_month = ? AND pp.status = 'locked' LIMIT 1`, [userId, month]);
    if (!slips.length) return res.status(404).json({ success: false, message: 'Chưa có phiếu lương đã chốt.' });
    const lines = await queryAsync(db, 'SELECT line_type, description, amount FROM payslip_lines WHERE payslip_id = ? ORDER BY id', [slips[0].id]);
    const document = new PDFDocument({ size: 'A4', margin: 45 });
    const fontPath = path.join(__dirname, 'node_modules', '@fontsource', 'noto-sans', 'files', 'noto-sans-vietnamese-400-normal.woff');
    const chunks = [];
    const pdf = new Promise((resolve, reject) => {
      document.on('data', (chunk) => chunks.push(chunk));
      document.once('error', reject);
      document.once('end', () => resolve(Buffer.concat(chunks)));
    });
    document.font(fontPath).fontSize(18).text('PHIẾU LƯƠNG CHI TIẾT', { align: 'center' });
    document.moveDown().fontSize(11).text(`Kỳ lương: ${month}`);
    document.text(`Nhân viên: ${slips[0].full_name} · ${slips[0].role}`);
    document.text(`Email: ${slips[0].email}`);
    document.moveDown();
    for (const line of lines) {
      document.fontSize(9).text(`${line.line_type} · ${line.description}`, { continued: true, width: 390 });
      document.text(`${formatMoney(line.amount)} đ`, { align: 'right' });
    }
    document.moveDown().fontSize(11).text(`Tổng thu nhập: ${formatMoney(slips[0].gross_amount)} đ`);
    document.text(`Tổng khấu trừ: ${formatMoney(slips[0].deduction_amount)} đ`);
    document.fontSize(13).text(`Thực nhận: ${formatMoney(slips[0].net_amount)} đ`);
    document.end();
    const buffer = await pdf;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="payslip-${month}-${userId}.pdf"`);
    res.send(buffer);
  } catch (error) {
    console.error('Không thể xuất PDF phiếu lương:', error);
    res.status(500).json({ success: false, message: 'Không thể xuất PDF phiếu lương.' });
  }
});

app.get('/api/driver/payroll/estimate', async (req, res) => {
  const date = String(req.query.date || new Date().toISOString().slice(0, 10));
  if (!isValidPricingDate(date)) return res.status(400).json({ success: false, message: 'Ngày ước tính không hợp lệ.' });
  const driverId = Number(req.authUser.id);
  try {
    const [salaryRows, eventRows, ruleRows, holidayRows, attendanceRows, settingsRows] = await Promise.all([
      queryAsync(db, `SELECT monthly_salary, allowance, bonus_per_delivery, commission_rate FROM employee_salary_history
        WHERE user_id = ? AND effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?)
        ORDER BY effective_from DESC LIMIT 1`, [driverId, date, date]),
      queryAsync(db, `SELECT e.id, e.order_id, e.to_status, e.reason_code, e.photo_url,
          e.created_at, e.lat, e.lng, o.weight_kg, o.item_value,
          rc.pay_driver_fail_fee
        FROM order_events e JOIN orders o ON o.id = e.order_id
        LEFT JOIN reason_codes rc ON rc.code = e.reason_code
        WHERE e.actor_id = ? AND e.actor_role IN ('pickup_driver','delivery_driver','driver')
          AND e.created_at >= ? AND e.created_at < DATE_ADD(?, INTERVAL 1 DAY)
          AND e.to_status IN ('completed','picked_up','delivery_failed','returning')
        ORDER BY e.created_at, e.id`, [driverId, date, date]),
      queryAsync(db, `SELECT * FROM pay_rules WHERE effective_from <= ?
        AND (effective_to IS NULL OR effective_to >= ?)`, [date, date]),
      queryAsync(db, "SELECT setting_value FROM system_settings WHERE setting_key = 'HOLIDAY_DATES'"),
      queryAsync(db, 'SELECT id FROM attendance_records WHERE user_id = ? AND work_date = ?', [driverId, date]),
      queryAsync(db, "SELECT setting_value FROM system_settings WHERE setting_key = 'PAYROLL_EXPECTED_WORKDAYS'")
    ]);
    const salary = salaryRows[0];
    const expectedWorkdays = Number(settingsRows[0]?.setting_value || 26);
    const earnings = [];
    let eventTotal = 0n;
    for (const event of eventRows) {
      if (event.to_status === 'delivery_failed'
        && (Number(event.pay_driver_fail_fee) !== 1 || !event.photo_url)) continue;
      const eventDate = event.created_at instanceof Date
        ? event.created_at.toISOString().slice(0, 10) : String(event.created_at).slice(0, 10);
      const eventTime = event.created_at instanceof Date
        ? event.created_at.toTimeString().slice(0, 8) : String(event.created_at).slice(11, 19);
      const ward = findGovapWard(event.lat, event.lng);
      const eventType = event.to_status === 'completed' ? 'delivery_success'
        : event.to_status === 'picked_up' ? 'pickup'
          : event.to_status === 'delivery_failed' ? 'failed_valid' : 'return';
      if (event.to_status === 'completed' && salary) {
        const deliveryBonus = parseMoney(salary.bonus_per_delivery || 0);
        const commission = calculatePercentage(event.item_value || 0, salary.commission_rate || 0);
        const directEarning = addMoney(deliveryBonus, commission);
        if (directEarning > 0n) {
          eventTotal = addMoney(eventTotal, directEarning);
          earnings.push({ event_type: 'delivery_bonus_and_commission', order_id: event.order_id, amount: directEarning.toString() });
        }
      }
      const rule = selectPayRule(ruleRows, {
        eventType, areaCode: ward?.properties?.codeName || 'GOVAP_ALL',
        eventDate, eventTime, weightKg: event.weight_kg, basisAmount: event.item_value
      });
      if (!rule) continue;
      const holidays = holidayRows.length ? JSON.parse(holidayRows[0].setting_value) : [];
      const amount = calculatePayRuleAmount(rule, event.item_value || 0, holidays.includes(eventDate));
      eventTotal = addMoney(eventTotal, amount);
      earnings.push({ event_type: eventType, order_id: event.order_id, amount: amount.toString() });
    }
    const attended = attendanceRows.length > 0;
    const dailyBase = salary && attended
      ? (addMoney(
        parseMoney(salary.monthly_salary || 0),
        parseMoney(salary.allowance || 0)
      ) + BigInt(expectedWorkdays) / 2n) / BigInt(expectedWorkdays)
      : 0n;
    const dailyEstimate = addMoney(dailyBase, eventTotal);
    res.json({
      success: true,
      data: {
        date,
        estimate_only: true,
        attendance_recorded: attended,
        event_earnings: eventTotal.toString(),
        estimated_income: dailyEstimate.toString(),
        events: earnings
      }
    });
  } catch (error) {
    console.error('Không thể tính thu nhập tham khảo trong ngày:', error);
    res.status(500).json({ success: false, message: 'Không thể tính thu nhập tham khảo.' });
  }
});

app.get('/api/hr/payroll', async (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(req.query.month || '')
    ? req.query.month
    : new Date().toISOString().slice(0, 7);
  let periodInfo = { payroll_month: month, status: 'open', locked_at: null };
  try {
    const periodRows = await queryAsync(db, 'SELECT * FROM payroll_periods WHERE payroll_month = ? LIMIT 1', [month]);
    if (periodRows.length) {
      periodInfo = periodRows[0];
      if (periodInfo.status === 'locked') {
        const lockedRows = await queryAsync(db, `SELECT p.id AS payslip_id, p.user_id AS id,
            p.gross_amount, p.deduction_amount, p.net_amount, p.snapshot_json,
            u.full_name, u.email, u.role
          FROM payslips p JOIN users u ON u.id = p.user_id
          WHERE p.payroll_period_id = ? ORDER BY u.full_name`, [periodInfo.id]);
        const lockedPayroll = lockedRows.map((row) => {
          const snapshot = typeof row.snapshot_json === 'string'
            ? JSON.parse(row.snapshot_json) : row.snapshot_json;
          return {
            ...row,
            attendance_days: snapshot.attendance_days || 0,
            completed_deliveries: snapshot.delivery_count || 0,
            monthly_salary: '0',
            allowance: '0',
            bonus_per_delivery: '0',
            commission_rate: '0',
            tenure_raise_percent: '0',
            tenure_years: '0',
            commission_amount: '0',
            event_rule_earnings: '0',
            manual_bonus: '0',
            deductions: String(row.deduction_amount),
            estimated_salary: String(row.net_amount)
          };
        });
        return res.json({ success: true, period: periodInfo, data: lockedPayroll });
      }
    }
  } catch (error) {
    console.error('Không thể kiểm tra trạng thái kỳ lương:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải trạng thái bảng lương.' });
  }
  const sql = `
    SELECT u.id, u.full_name, u.email, u.role,
      COALESCE(sh.monthly_salary, 0) AS monthly_salary,
      COALESCE(sh.allowance, 0) AS allowance,
      COALESCE(sh.bonus_per_delivery, 0) AS bonus_per_delivery,
      COALESCE(sh.commission_rate, 0) AS commission_rate,
      COALESCE(sh.tenure_raise_percent, 0) AS tenure_raise_percent,
      GREATEST(0, TIMESTAMPDIFF(YEAR, DATE(u.created_at), CURDATE())) AS tenure_years,
      (SELECT COUNT(DISTINCT a.work_date) FROM attendance_records a
        WHERE a.user_id = u.id AND DATE_FORMAT(a.work_date, '%Y-%m') = ?) AS attendance_days,
      (SELECT COUNT(*) FROM orders o WHERE o.delivery_shipper_id = u.id AND o.status = 'completed'
        AND DATE_FORMAT(o.updated_at, '%Y-%m') = ?) AS completed_deliveries,
      (SELECT COALESCE(SUM(o.item_value), 0) FROM orders o
        WHERE o.delivery_shipper_id = u.id AND o.status = 'completed'
          AND DATE_FORMAT(o.updated_at, '%Y-%m') = ?) AS monthly_item_value,
      (SELECT COALESCE(SUM(pa.amount), 0) FROM employee_payroll_adjustments pa
        WHERE pa.user_id = u.id AND pa.payroll_month = ? AND pa.adjustment_type = 'bonus') AS manual_bonus,
      (SELECT COALESCE(SUM(pa.amount), 0) FROM employee_payroll_adjustments pa
        WHERE pa.user_id = u.id AND pa.payroll_month = ? AND pa.adjustment_type = 'deduction') AS deductions
    FROM users u
    LEFT JOIN employee_salary_history sh ON sh.user_id = u.id
      AND sh.effective_from <= LAST_DAY(CONCAT(?, '-01'))
      AND (sh.effective_to IS NULL OR sh.effective_to >= LAST_DAY(CONCAT(?, '-01')))
    WHERE u.role != 'customer'
    ORDER BY u.full_name ASC
  `;
  try {
    const results = await queryAsync(db, sql, [month, month, month, month, month, month, month]);
    const events = await queryAsync(
      db,
      `SELECT e.actor_id AS user_id,
          CASE e.to_status
            WHEN 'completed' THEN 'delivery_success'
            WHEN 'picked_up' THEN 'pickup'
            WHEN 'delivery_failed' THEN 'failed_valid'
            WHEN 'returning' THEN 'return'
          END AS event_type,
          DATE_FORMAT(e.created_at, '%Y-%m-%d') AS event_date,
          DATE_FORMAT(e.created_at, '%H:%i:%s') AS event_time,
          COALESCE(e.lat, o.receiver_lat, o.shop_lat) AS lat,
          COALESCE(e.lng, o.receiver_lng, o.shop_lng) AS lng,
          o.weight_kg, o.item_value AS basis_amount
          , e.photo_url
       FROM order_events e
       JOIN orders o ON o.id = e.order_id
       LEFT JOIN reason_codes rc ON rc.code = e.reason_code
       WHERE e.actor_id IS NOT NULL
         AND e.actor_role IN ('pickup_driver', 'delivery_driver', 'driver')
         AND e.created_at >= CONCAT(?, '-01')
         AND e.created_at < DATE_ADD(CONCAT(?, '-01'), INTERVAL 1 MONTH)
         AND e.to_status IN ('completed', 'picked_up', 'delivery_failed', 'returning')
         AND (e.to_status != 'delivery_failed' OR (
           COALESCE(rc.pay_driver_fail_fee, 0) = 1
           AND e.photo_url IS NOT NULL
         ))
       ORDER BY e.created_at`,
      [month, month]
    );
    const rules = await queryAsync(
      db,
      `SELECT * FROM pay_rules
       WHERE effective_from <= LAST_DAY(CONCAT(?, '-01'))
         AND (effective_to IS NULL OR effective_to >= CONCAT(?, '-01'))
       ORDER BY effective_from DESC, id DESC`,
      [month, month]
    );
    const holidayRows = await queryAsync(
      db,
      "SELECT setting_value FROM system_settings WHERE setting_key = 'HOLIDAY_DATES' LIMIT 1"
    );
    let holidayDates = new Set();
    if (holidayRows.length) {
      try {
        const configuredDates = JSON.parse(holidayRows[0].setting_value);
        if (!Array.isArray(configuredDates)
          || configuredDates.some((date) => !isValidPricingDate(date))) {
          throw new TypeError('HOLIDAY_DATES must be a JSON array of YYYY-MM-DD dates.');
        }
        holidayDates = new Set(configuredDates);
      } catch (error) {
        console.error('Cấu hình ngày lễ HOLIDAY_DATES không hợp lệ:', error);
        return res.status(500).json({ success: false, message: 'Cấu hình ngày lễ không hợp lệ; vui lòng kiểm tra system_settings.' });
      }
    }
    const payEvents = events.map((event) => {
      const ward = findGovapWard(event.lat, event.lng);
      return {
        userId: event.user_id,
        eventType: event.event_type,
        areaCode: ward?.properties?.codeName || 'GOVAP_ALL',
        eventDate: event.event_date,
        eventTime: event.event_time,
        weightKg: event.weight_kg,
        basisAmount: event.basis_amount
      };
    });
    const ruleEarnings = sumPayRuleEarnings(payEvents, rules, holidayDates);
    const payroll = results.map((row) => {
      const salary = parseMoney(row.monthly_salary || 0);
      const allowanceAmount = parseMoney(row.allowance || 0);
      const deliveryBonus = multiplyMoney(
        row.bonus_per_delivery || 0,
        Number(row.completed_deliveries || 0)
      );
      const tenureYears = Number(row.tenure_years || 0);
      const tenureRaise = calculatePercentage(
        salary,
        row.tenure_raise_percent || 0,
        tenureYears
      );
      const commission = calculatePercentage(
        row.monthly_item_value || 0,
        row.commission_rate || 0
      );
      const manualBonus = parseMoney(row.manual_bonus || 0);
      const ruleEarning = ruleEarnings.get(Number(row.id)) || 0n;
      const deductions = parseMoney(row.deductions || 0);
      const earnings = addMoney(
        addMoney(
          addMoney(addMoney(addMoney(addMoney(salary, tenureRaise), allowanceAmount), deliveryBonus), commission),
          manualBonus
        ),
        ruleEarning
      );
      const estimatedSalary = subtractMoney(earnings, deductions, { allowNegative: true });
      return {
        ...row,
        monthly_salary: salary.toString(),
        allowance: allowanceAmount.toString(),
        tenure_bonus_amount: tenureRaise.toString(),
        commission_amount: commission.toString(),
        manual_bonus: manualBonus.toString(),
        event_rule_earnings: ruleEarning.toString(),
        deductions: deductions.toString(),
        estimated_salary: estimatedSalary.toString()
      };
    });
    res.json({ success: true, period: periodInfo, data: payroll });
  } catch (error) {
    console.error('Không thể tính bảng lương theo chính sách hiệu lực:', error);
    res.status(500).json({ success: false, message: 'Không thể tải hoặc tính chính xác bảng lương.' });
  }
});

app.put('/api/hr/payroll/:userId', async (req, res) => {
  const userId = Number(req.params.userId);
  const effectiveFrom = String(req.body.effective_from || new Date().toISOString().slice(0, 10));
  let monthlySalary;
  let allowance;
  let bonusPerDelivery;
  try {
    monthlySalary = parseMoney(req.body.monthly_salary);
    allowance = parseMoney(req.body.allowance ?? 0);
    bonusPerDelivery = parseMoney(req.body.bonus_per_delivery ?? 0);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
  const commissionRate = Number(req.body.commission_rate || 0);
  const tenureRaisePercent = Number(req.body.tenure_raise_percent || 0);
  if (!Number.isInteger(userId) || userId <= 0
    || !isValidPricingDate(effectiveFrom)
    || !Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100
    || !Number.isFinite(tenureRaisePercent) || tenureRaisePercent < 0 || tenureRaisePercent > 100) {
    return res.status(400).json({ success: false, message: 'Lương, phụ cấp, thưởng phải không âm; tỷ lệ hoa hồng và tăng lương thâm niên phải từ 0 đến 100%.' });
  }
  const newValue = {
    monthly_salary: monthlySalary.toString(),
    allowance: allowance.toString(),
    bonus_per_delivery: bonusPerDelivery.toString(),
    commission_rate: commissionRate,
    tenure_raise_percent: tenureRaisePercent,
    effective_from: effectiveFrom
  };
  try {
    await withTransaction(transactionPool, async (conn) => {
      await queryAsync(conn, `INSERT INTO payroll_periods (payroll_month, opened_by)
        VALUES (?, ?) ON DUPLICATE KEY UPDATE payroll_month = VALUES(payroll_month)`,
      [effectiveFrom.slice(0, 7), req.authUser.id]);
      const effectivePeriod = await queryAsync(
        conn,
        'SELECT status FROM payroll_periods WHERE payroll_month = ? FOR UPDATE',
        [effectiveFrom.slice(0, 7)]
      );
      if (effectivePeriod[0]?.status === 'locked') {
        const error = new Error(`Không thể sửa mức lương vì kỳ ${effectiveFrom.slice(0, 7)} đã chốt.`);
        error.statusCode = 409;
        throw error;
      }
      const lockedPeriods = await queryAsync(
        conn,
        `SELECT payroll_month FROM payroll_periods
         WHERE status = 'locked' AND payroll_month >= ? ORDER BY payroll_month LIMIT 1 FOR UPDATE`,
        [effectiveFrom.slice(0, 7)]
      );
      if (lockedPeriods.length) {
        const error = new Error(`Không thể sửa lịch sử lương vì kỳ ${lockedPeriods[0].payroll_month} đã chốt.`);
        error.statusCode = 409;
        throw error;
      }
      const users = await queryAsync(
        conn,
        "SELECT id FROM users WHERE id = ? AND role != 'customer' FOR UPDATE",
        [userId]
      );
      if (!users.length) {
        const error = new Error('Không tìm thấy nhân viên.');
        error.statusCode = 404;
        throw error;
      }
      const salaryRows = await queryAsync(
        conn,
        'SELECT * FROM employee_salaries WHERE user_id = ? FOR UPDATE',
        [userId]
      );
      const oldValue = salaryRows[0] ? {
        monthly_salary: String(salaryRows[0].monthly_salary),
        allowance: String(salaryRows[0].allowance),
        bonus_per_delivery: String(salaryRows[0].bonus_per_delivery),
        commission_rate: Number(salaryRows[0].commission_rate),
        tenure_raise_percent: Number(salaryRows[0].tenure_raise_percent)
      } : null;
      const historyRows = await queryAsync(
        conn,
        `SELECT * FROM employee_salary_history
         WHERE user_id = ? AND effective_from >= ? ORDER BY effective_from FOR UPDATE`,
        [userId, effectiveFrom]
      );
      if (historyRows.some((row) => mysqlDateOnly(row.effective_from) > effectiveFrom)) {
        const error = new Error('Không thể sửa mức lương vì đã có phiên bản hiệu lực sau ngày này.');
        error.statusCode = 409;
        throw error;
      }
      const existingEffectiveRow = historyRows.find((row) => mysqlDateOnly(row.effective_from) === effectiveFrom);
      if (existingEffectiveRow) {
        await queryAsync(
          conn,
          `UPDATE employee_salary_history
           SET monthly_salary = ?, allowance = ?, bonus_per_delivery = ?,
               commission_rate = ?, tenure_raise_percent = ?, created_by = ?
           WHERE id = ?`,
          [
            monthlySalary.toString(), allowance.toString(), bonusPerDelivery.toString(),
            commissionRate, tenureRaisePercent, req.authUser.id, existingEffectiveRow.id
          ]
        );
      } else {
        await queryAsync(
          conn,
          `UPDATE employee_salary_history SET effective_to = DATE_SUB(?, INTERVAL 1 DAY)
           WHERE user_id = ? AND effective_from < ? AND (effective_to IS NULL OR effective_to >= ?)`,
          [effectiveFrom, userId, effectiveFrom, effectiveFrom]
        );
        await queryAsync(
          conn,
          `INSERT INTO employee_salary_history
           (user_id, monthly_salary, allowance, bonus_per_delivery, commission_rate,
            tenure_raise_percent, effective_from, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId, monthlySalary.toString(), allowance.toString(), bonusPerDelivery.toString(),
            commissionRate, tenureRaisePercent, effectiveFrom, req.authUser.id
          ]
        );
      }
      await queryAsync(
        conn,
        `INSERT INTO employee_salaries
         (user_id, monthly_salary, allowance, bonus_per_delivery, commission_rate, tenure_raise_percent)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE monthly_salary = VALUES(monthly_salary), allowance = VALUES(allowance),
           bonus_per_delivery = VALUES(bonus_per_delivery), commission_rate = VALUES(commission_rate),
           tenure_raise_percent = VALUES(tenure_raise_percent)`,
        [
          userId, monthlySalary.toString(), allowance.toString(), bonusPerDelivery.toString(),
          commissionRate, tenureRaisePercent
        ]
      );
      await queryAsync(
        conn,
        `INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, ip)
         VALUES (?, ?, 'update', 'employee_salary', ?, ?, ?, ?)`,
        [
          req.authUser.id, normalizeRole(req.authUser.role), String(userId),
          oldValue ? JSON.stringify(oldValue) : null, JSON.stringify(newValue), req.ip
        ]
      );
    });
    res.json({ success: true, message: 'Đã cập nhật mức lương theo ngày hiệu lực.' });
  } catch (error) {
    if ([404, 409].includes(error.statusCode)) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error('Không thể lưu lịch sử lương:', error);
    res.status(500).json({ success: false, message: 'Không thể lưu lịch sử mức lương.' });
  }
});

app.post('/api/hr/payroll/:userId/adjustments', async (req, res) => {
  const userId = Number(req.params.userId);
  const month = String(req.body.month || '');
  const adjustmentType = String(req.body.adjustment_type || '');
  let amount;
  try {
    amount = parseMoney(req.body.amount);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
  const reason = String(req.body.reason || '').trim();
  if (!Number.isInteger(userId) || userId <= 0 || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
    || !['bonus', 'deduction'].includes(adjustmentType) || amount <= 0n
    || !reason || reason.length > 255) {
    return res.status(400).json({ success: false, message: 'Thông tin thưởng hoặc khấu trừ không hợp lệ.' });
  }
  try {
    await withTransaction(transactionPool, async (conn) => {
      await queryAsync(conn, `INSERT INTO payroll_periods (payroll_month, opened_by)
        VALUES (?, ?) ON DUPLICATE KEY UPDATE payroll_month = VALUES(payroll_month)`,
      [month, req.authUser.id]);
      const periods = await queryAsync(conn, 'SELECT * FROM payroll_periods WHERE payroll_month = ? FOR UPDATE', [month]);
      const period = periods[0];
      const employees = await queryAsync(conn, 'SELECT id FROM users WHERE id = ? AND role <> ? FOR UPDATE', [userId, 'customer']);
      if (!employees.length) throw payrollError('Không tìm thấy nhân viên.', 404, 'PAYROLL_EMPLOYEE_NOT_FOUND');
      if (period.status === 'locked') {
        const slips = await queryAsync(conn, `SELECT * FROM payslips
          WHERE payroll_period_id = ? AND user_id = ? FOR UPDATE`, [period.id, userId]);
        if (!slips.length) throw payrollError('Không tìm thấy phiếu lương đã chốt.', 404, 'PAYSLIP_NOT_FOUND');
        const slip = slips[0];
        const oldValue = {
          gross_amount: String(slip.gross_amount),
          deduction_amount: String(slip.deduction_amount),
          net_amount: String(slip.net_amount)
        };
        const isDeduction = adjustmentType === 'deduction';
        const grossAmount = isDeduction
          ? parseMoney(slip.gross_amount)
          : addMoney(slip.gross_amount, amount);
        const deductionAmount = isDeduction
          ? addMoney(slip.deduction_amount, amount)
          : parseMoney(slip.deduction_amount);
        const netAmount = subtractMoney(grossAmount, deductionAmount, { allowNegative: true });
        const snapshot = typeof slip.snapshot_json === 'string'
          ? JSON.parse(slip.snapshot_json) : slip.snapshot_json;
        const corrections = Array.isArray(snapshot.adjustments) ? snapshot.adjustments : [];
        corrections.push({
          type: adjustmentType,
          amount: amount.toString(),
          reason,
          actor_id: Number(req.authUser.id),
          created_at: new Date().toISOString()
        });
        snapshot.adjustments = corrections;
        await queryAsync(conn, `INSERT INTO payslip_lines
          (payslip_id, line_type, description, amount, source_type, source_id, detail_json)
          VALUES (?, ?, ?, ?, 'post_lock_adjustment', ?, ?)`,
        [slip.id, isDeduction ? 'manual_deduction' : 'manual_bonus', reason, amount.toString(),
          req.authUser.id, JSON.stringify({ actor_role: req.authRole })]);
        await queryAsync(conn, `UPDATE payslips
          SET gross_amount = ?, deduction_amount = ?, net_amount = ?, snapshot_json = ?
          WHERE id = ?`, [
          grossAmount.toString(), deductionAmount.toString(), netAmount.toString(),
          JSON.stringify(snapshot), slip.id
        ]);
        const newValue = {
          gross_amount: grossAmount.toString(),
          deduction_amount: deductionAmount.toString(),
          net_amount: netAmount.toString(),
          adjustment_type: adjustmentType,
          amount: amount.toString(),
          reason
        };
        await queryAsync(conn, `INSERT INTO audit_logs
          (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, ip)
          VALUES (?, ?, 'payroll.payslip.adjusted', 'payslip', ?, ?, ?, ?)`,
        [req.authUser.id, req.authRole, String(slip.id), JSON.stringify(oldValue), JSON.stringify(newValue), req.ip]);
      } else {
        const inserted = await queryAsync(conn, `INSERT INTO employee_payroll_adjustments
          (user_id, payroll_month, adjustment_type, amount, reason)
          VALUES (?, ?, ?, ?, ?)`, [userId, month, adjustmentType, amount.toString(), reason]);
        await queryAsync(conn, `INSERT INTO audit_logs
          (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, ip)
          VALUES (?, ?, 'payroll.adjustment.created', 'payroll_adjustment', ?, NULL, ?, ?)`,
        [req.authUser.id, req.authRole, String(inserted.insertId),
          JSON.stringify({ user_id: userId, payroll_month: month, adjustment_type: adjustmentType, amount: amount.toString(), reason }),
          req.ip]);
      }
    });
    res.status(201).json({
      success: true,
      message: adjustmentType === 'bonus' ? 'Đã ghi nhận thưởng.' : 'Đã ghi nhận khoản khấu trừ.'
    });
  } catch (error) {
    if (error.statusCode && error.statusCode < 500) {
      return res.status(error.statusCode).json({ success: false, code: error.code, message: error.message });
    }
    console.error('Không thể lưu điều chỉnh lương:', error);
    res.status(500).json({ success: false, message: 'Không thể lưu điều chỉnh lương.' });
  }
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
      SUM(CASE WHEN status IN ('pickup_failed', 'delivery_failed', 'return_pending', 'returning', 'returned', 'cancelled') THEN 1 ELSE 0 END) as failed_orders
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
const PORT = positiveInteger(process.env.PORT, 5000);
server.listen(PORT, () => {
  console.log(`🚀 Backend Server & WebSocket đang chạy tại http://localhost:${PORT}`);
});