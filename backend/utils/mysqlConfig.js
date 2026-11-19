function parseDatabasePort(value) {
  if (value === undefined || String(value).trim() === '') return 3306;

  const port = Number(String(value).trim());
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT phải là số nguyên từ 1 đến 65535.');
  }
  return port;
}

function parseDatabaseSsl(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized || normalized === 'false') return false;
  if (normalized === 'true') return true;
  throw new Error('DB_SSL chỉ nhận giá trị true hoặc false.');
}

function createMysqlConfig(env = process.env) {
  const sslEnabled = parseDatabaseSsl(env.DB_SSL);
  return {
    host: env.DB_HOST || 'localhost',
    port: parseDatabasePort(env.DB_PORT),
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'smart_logistics_v2',
    ...(sslEnabled ? { ssl: { rejectUnauthorized: true } } : {})
  };
}

module.exports = { createMysqlConfig };
