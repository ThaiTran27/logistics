const mysql = require('mysql');
const { query, withTransaction } = require('../utils/db');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smart_logistics_v2'
});
const appliesChanges = process.argv.includes('--apply');

async function loadCandidates(conn) {
  return query(
    conn,
    `SELECT o.id, o.tracking_code, o.status, MAX(h.created_at) AS legacy_scan_at
     FROM orders o
     JOIN order_status_history h ON h.order_id = o.id
       AND h.from_status = 'returning' AND h.to_status = 'cancelled'
     WHERE o.status = 'cancelled'
     GROUP BY o.id, o.tracking_code, o.status
     ORDER BY h.created_at, o.id`
  );
}

async function main() {
  if (process.argv.some((arg) => arg.startsWith('--') && arg !== '--apply')) {
    throw new Error('Usage: node scripts/normalize-legacy-returned-orders.js [--apply]');
  }
  const candidates = await new Promise((resolve, reject) => {
    pool.getConnection((error, conn) => {
      if (error) return reject(error);
      loadCandidates(conn).then(resolve, reject).finally(() => conn.release());
    });
  });
  console.log(appliesChanges ? 'Đơn sẽ được chuẩn hóa trong transaction:' : 'Xem trước; chưa có dữ liệu nào bị thay đổi:');
  console.table(candidates.map(({ id, tracking_code, status, legacy_scan_at }) => ({
    id, tracking_code, from: status, to: 'returned', legacy_scan_at
  })));
  if (!candidates.length || !appliesChanges) {
    if (!appliesChanges) console.log('Chỉ chạy với --apply sau khi đã kiểm tra danh sách trên.');
    return;
  }
  const updated = await withTransaction(pool, async (conn) => {
    const locked = await query(
      conn,
      `SELECT id, tracking_code, status FROM orders
       WHERE id IN (${candidates.map(() => '?').join(',')})
       ORDER BY id FOR UPDATE`,
      candidates.map((order) => order.id)
    );
    let count = 0;
    for (const order of locked) {
      if (order.status !== 'cancelled') continue;
      await query(conn, "UPDATE orders SET status = 'returned' WHERE id = ? AND status = 'cancelled'", [order.id]);
      const note = 'Chuẩn hóa đơn hàng hoàn đã được kho nhận theo luồng cũ.';
      await query(
        conn,
        `INSERT INTO order_events (order_id, from_status, to_status, actor_role, note)
         VALUES (?, 'cancelled', 'returned', 'system', ?)`,
        [order.id, note]
      );
      await query(
        conn,
        `INSERT INTO order_status_history (order_id, from_status, to_status, note)
         VALUES (?, 'cancelled', 'returned', ?)`,
        [order.id, note]
      );
      count += 1;
    }
    return count;
  });
  console.log(`Đã chuẩn hóa ${updated} đơn hoàn.`);
}

main()
  .catch((error) => {
    console.error('Không thể chuẩn hóa đơn hoàn cũ:', error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
