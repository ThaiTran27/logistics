const mysql = require('mysql');
const { query, withTransaction } = require('../utils/db');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smart_logistics_v2'
});

const appliesChanges = process.argv.includes('--apply');
const legacyStatuses = [
  'at_origin_warehouse',
  'at_central_warehouse',
  'at_destination_warehouse',
  'transferring_to_central',
  'transferring_to_destination'
];

async function loadAffectedOrders(connection, allowPreMigrationPreview = false) {
  let centralWarehouseId;
  try {
    const settings = await query(
      connection,
      "SELECT setting_value FROM system_settings WHERE setting_key = 'central_warehouse_id' LIMIT 1"
    );
    if (settings.length) centralWarehouseId = Number(settings[0].setting_value);
  } catch (error) {
    if (!allowPreMigrationPreview || error.code !== 'ER_NO_SUCH_TABLE') throw error;
  }
  if (!centralWarehouseId && allowPreMigrationPreview) {
    const placeholders = await query(
      connection,
      `SELECT id FROM warehouses
       WHERE warehouse_type = 'central' AND ward_name = '__CENTRAL__'
       ORDER BY id LIMIT 1`
    );
    centralWarehouseId = Number(placeholders[0]?.id);
  }
  if (!Number.isInteger(centralWarehouseId) || centralWarehouseId <= 0) {
    throw new Error('central_warehouse_id is missing; apply migration 002 before applying changes.');
  }
  const warehouses = await query(
    connection,
    `SELECT id FROM warehouses
     WHERE id = ? AND warehouse_type = 'central' AND is_active = 1 LIMIT 1`,
    [centralWarehouseId]
  );
  if (!warehouses.length) throw new Error('Configured central warehouse is missing or inactive.');

  const orders = await query(
    connection,
    `SELECT id, tracking_code, status, current_warehouse_id,
       CASE
         WHEN status IN ('at_origin_warehouse', 'at_central_warehouse', 'at_destination_warehouse')
           THEN 'at_central_warehouse'
         WHEN current_warehouse_id = ?
           THEN 'at_central_warehouse'
         ELSE 'picked_up'
       END AS normalized_status
     FROM orders
     WHERE status IN (?, ?, ?, ?, ?)
     ORDER BY id`,
    [centralWarehouseId, ...legacyStatuses]
  );
  return { centralWarehouseId, orders };
}

async function main() {
  if (process.argv.some((argument) => argument.startsWith('--') && argument !== '--apply')) {
    throw new Error('Usage: node scripts/normalize-legacy-order-statuses.js [--apply]');
  }

  const preview = await new Promise((resolve, reject) => {
    pool.getConnection((error, connection) => {
      if (error) return reject(error);
      loadAffectedOrders(connection, !appliesChanges)
        .then(resolve, reject)
        .finally(() => connection.release());
    });
  });

  console.log(appliesChanges ? 'Đơn dự kiến chuẩn hóa (được khóa lại trước khi ghi):' : 'Xem trước; chưa có dữ liệu nào bị thay đổi:');
  console.table(preview.orders.map((order) => ({
    id: order.id,
    tracking_code: order.tracking_code,
    from: order.status,
    to: order.normalized_status,
    current_warehouse_id: order.current_warehouse_id
  })));
  if (!preview.orders.length) {
    console.log('Không có đơn liên kho cần chuẩn hóa.');
    return;
  }
  if (!appliesChanges) {
    console.log('Chạy lại với --apply chỉ sau khi đã kiểm tra danh sách trên.');
    return;
  }

  const changedCount = await withTransaction(pool, async (connection) => {
    const centralWarehouseId = preview.centralWarehouseId;
    const lockedOrders = await query(
      connection,
      `SELECT id, tracking_code, status, current_warehouse_id,
         CASE
           WHEN status IN ('at_origin_warehouse', 'at_central_warehouse', 'at_destination_warehouse')
             THEN 'at_central_warehouse'
           WHEN current_warehouse_id = ?
             THEN 'at_central_warehouse'
           ELSE 'picked_up'
         END AS normalized_status
       FROM orders
       WHERE status IN (?, ?, ?, ?, ?)
       ORDER BY id
       FOR UPDATE`,
      [centralWarehouseId, ...legacyStatuses]
    );
    console.log('Danh sách đã khóa và sẽ ghi trong transaction:');
    console.table(lockedOrders.map(({ id, tracking_code, status, normalized_status }) => ({
      id, tracking_code, from: status, to: normalized_status
    })));

    for (const order of lockedOrders) {
      const result = await query(
        connection,
        `UPDATE orders
         SET status = ?, origin_warehouse_id = ?, destination_warehouse_id = ?, current_warehouse_id = ?
         WHERE id = ? AND status = ?`,
        [
          order.normalized_status,
          centralWarehouseId,
          centralWarehouseId,
          centralWarehouseId,
          order.id,
          order.status
        ]
      );
      if (!result.affectedRows) throw new Error(`Order ${order.id} changed during normalization.`);

      const note = `Chuẩn hóa dữ liệu kho Gò Vấp: ${order.status} -> ${order.normalized_status}`;
      await query(
        connection,
        `INSERT INTO order_events
          (order_id, from_status, to_status, actor_id, actor_role, note)
         VALUES (?, ?, ?, NULL, 'system', ?)`,
        [order.id, order.status, order.normalized_status, note]
      );
      await query(
        connection,
        `INSERT INTO order_status_history (order_id, from_status, to_status, note)
         VALUES (?, ?, ?, ?)`,
        [order.id, order.status, order.normalized_status, note]
      );
    }
    return lockedOrders.length;
  });

  console.log(`Đã chuẩn hóa ${changedCount} đơn trong một transaction.`);
}

main()
  .catch((error) => {
    console.error('Không thể chuẩn hóa trạng thái đơn cũ:', error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
