const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql');

const migrationsDirectory = __dirname;
const migrationPattern = /^\d{3,}_[a-z0-9_]+\.sql$/i;

function query(connection, sql, parameters = []) {
  return new Promise((resolve, reject) => {
    connection.query(sql, parameters, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

function endPool(pool) {
  return new Promise((resolve, reject) => {
    pool.end((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function readMigrationSections(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const upMarker = /^\s*--\s*UP\s*$/im;
  const downMarker = /^\s*--\s*DOWN\s*$/im;
  const upMatch = upMarker.exec(source);
  const downMatch = downMarker.exec(source);
  if (!upMatch || !downMatch || downMatch.index <= upMatch.index) {
    throw new Error(`${path.basename(filePath)} must contain ordered -- UP and -- DOWN sections.`);
  }

  const up = source.slice(upMatch.index + upMatch[0].length, downMatch.index);
  const down = source.slice(downMatch.index + downMatch[0].length);
  const statements = (section) => section
    .replace(/^[ \t]*--[^\r\n]*/gm, '')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
  return { up: statements(up), down: statements(down) };
}

async function ensureMigrationTable(connection) {
  await query(connection, `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function runUp(connection, files) {
  const applied = await query(connection, 'SELECT filename FROM schema_migrations');
  const appliedFiles = new Set(applied.map((row) => row.filename));
  for (const filename of files) {
    if (appliedFiles.has(filename)) continue;
    if (filename === '002_single_govap_central_warehouse.sql') {
      const centralWarehouses = await query(
        connection,
        `SELECT id FROM warehouses
         WHERE warehouse_type = 'central' AND ward_name = '__CENTRAL__'`
      );
      if (centralWarehouses.length !== 1) {
        throw new Error(
          'Migration 002 requires exactly one placeholder central warehouse (warehouse_type=central, ward_name=__CENTRAL__).'
        );
      }
    }
    const migration = readMigrationSections(path.join(migrationsDirectory, filename));
    console.log(`Applying ${filename}`);
    for (const statement of migration.up) await query(connection, statement);
    await query(connection, 'INSERT INTO schema_migrations (filename) VALUES (?)', [filename]);
  }
}

async function runDown(connection, steps, files) {
  const applied = await query(
    connection,
    'SELECT filename FROM schema_migrations ORDER BY filename DESC LIMIT ?',
    [steps]
  );
  const knownFiles = new Set(files);
  for (const { filename } of applied) {
    if (!knownFiles.has(filename)) {
      throw new Error(`Applied migration ${filename} is missing from ${migrationsDirectory}.`);
    }
    const migration = readMigrationSections(path.join(migrationsDirectory, filename));
    console.log(`Rolling back ${filename}`);
    for (const statement of migration.down) await query(connection, statement);
    await query(connection, 'DELETE FROM schema_migrations WHERE filename = ?', [filename]);
  }
}

async function main() {
  const command = process.argv[2] || 'up';
  const requestedSteps = process.argv[3] === undefined ? '1' : process.argv[3];
  const steps = Number(requestedSteps);
  if (!['up', 'down'].includes(command)
    || command === 'down' && (!Number.isSafeInteger(steps) || steps <= 0)) {
    throw new Error('Usage: node migrations/run.js [up | down [positive-step-count]]');
  }

  const files = fs.readdirSync(migrationsDirectory)
    .filter((filename) => migrationPattern.test(filename))
    .sort((first, second) => first.localeCompare(second));
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_logistics_v2',
    connectionLimit: 1
  });

  try {
    const connection = await new Promise((resolve, reject) => {
      pool.getConnection((error, acquiredConnection) => {
        if (error) reject(error);
        else resolve(acquiredConnection);
      });
    });
    try {
      await ensureMigrationTable(connection);
      if (command === 'up') await runUp(connection, files);
      else await runDown(connection, steps, files);
    } finally {
      connection.release();
    }
  } finally {
    await endPool(pool);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  });
}

module.exports = { readMigrationSections };
