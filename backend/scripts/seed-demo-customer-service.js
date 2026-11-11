const mysql = require('mysql');
const { promisify } = require('util');

const environment = String(process.env.NODE_ENV || '').toLowerCase();
const databaseName = process.env.DB_NAME || 'smart_logistics_v2';
if (!['development', 'demo'].includes(environment) || process.env.DEMO_MODE !== 'true') {
  throw new Error('CSKH demo seed chỉ chạy với NODE_ENV=development|demo và DEMO_MODE=true.');
}
if (/(^|[_-])prod(uction)?([_-]|$)/i.test(databaseName)) {
  throw new Error('Từ chối chạy CSKH demo seed trên database production.');
}

const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: databaseName
});
const query = promisify(connection.query).bind(connection);

async function seedDemoCustomerService() {
  try {
    await query(
      `INSERT INTO users (email, password, full_name, role, status)
       VALUES (?, ?, ?, 'customer_service', 'active')
       ON DUPLICATE KEY UPDATE
         full_name = VALUES(full_name), role = VALUES(role), status = VALUES(status)`,
      ['cskh01@smartlogistics.vn', '123', 'Chăm Sóc Khách Hàng Demo']
    );
    console.log('Đã tạo hoặc cập nhật tài khoản CSKH demo: cskh01@smartlogistics.vn');
  } finally {
    connection.end();
  }
}

seedDemoCustomerService().catch((error) => {
  console.error('Không thể tạo tài khoản CSKH demo:', error);
  process.exitCode = 1;
});
