const mysql = require('mysql');

const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'smart_logistics_v2'
});

function query(sql, parameters = []) {
  return new Promise((resolve, reject) => {
    connection.query(sql, parameters, (error, rows) => {
      if (error) reject(error);
      else resolve(rows);
    });
  });
}

async function main() {
  const candidates = await query(
    `SELECT id, name, ward_name, warehouse_type, is_active
     FROM warehouses
     WHERE ward_name = 'Quận 1' OR name LIKE '%Quận 1%'
     ORDER BY id`
  );
  if (!candidates.length) {
    console.log('Không tìm thấy kho Quận 1 trong database.');
    return;
  }

  const schemas = await query(
    `SELECT c.TABLE_NAME AS table_name, c.COLUMN_NAME AS column_name,
       GROUP_CONCAT(k.COLUMN_NAME ORDER BY k.ORDINAL_POSITION) AS primary_key_columns
     FROM information_schema.COLUMNS c
     LEFT JOIN information_schema.KEY_COLUMN_USAGE k
       ON k.TABLE_SCHEMA = c.TABLE_SCHEMA AND k.TABLE_NAME = c.TABLE_NAME
       AND k.CONSTRAINT_NAME = 'PRIMARY'
     WHERE c.TABLE_SCHEMA = DATABASE()
       AND c.TABLE_NAME <> 'warehouses'
       AND c.DATA_TYPE IN ('int', 'bigint', 'mediumint', 'smallint', 'tinyint')
       AND (
         LOWER(c.COLUMN_NAME) LIKE '%warehouse%'
         OR EXISTS (
           SELECT 1 FROM information_schema.KEY_COLUMN_USAGE fk
           WHERE fk.TABLE_SCHEMA = c.TABLE_SCHEMA
             AND fk.TABLE_NAME = c.TABLE_NAME
             AND fk.COLUMN_NAME = c.COLUMN_NAME
             AND fk.REFERENCED_TABLE_NAME = 'warehouses'
         )
       )
     GROUP BY c.TABLE_NAME, c.COLUMN_NAME
     ORDER BY c.TABLE_NAME, c.COLUMN_NAME`
  );

  let foundReferences = false;
  for (const warehouse of candidates) {
    console.log(`\nKho #${warehouse.id}: ${warehouse.name} (${warehouse.ward_name}), active=${warehouse.is_active}`);
    for (const schema of schemas) {
      const tableName = schema.table_name.replace(/`/g, '``');
      const columnName = schema.column_name.replace(/`/g, '``');
      const rows = await query(
        `SELECT COUNT(*) AS row_count FROM \`${tableName}\` WHERE \`${columnName}\` = ?`,
        [warehouse.id]
      );
      const count = Number(rows[0].row_count);
      if (!count) continue;
      foundReferences = true;
      console.log(`  ${tableName}.${columnName}: ${count} dòng`);
      const primaryKeyColumns = String(schema.primary_key_columns || '')
        .split(',')
        .filter(Boolean)
        .map((column) => `\`${column.replace(/`/g, '``')}\``);
      const selectColumns = primaryKeyColumns.length ? primaryKeyColumns.join(', ') : '1 AS row_exists';
      const identifiers = await query(
        `SELECT ${selectColumns} FROM \`${tableName}\` WHERE \`${columnName}\` = ? LIMIT 101`,
        [warehouse.id]
      );
      console.log(`    Mẫu khóa dòng (tối đa 100): ${JSON.stringify(identifiers.slice(0, 100))}`);
      if (identifiers.length > 100) console.log('    Còn thêm dòng tham chiếu chưa liệt kê.');
    }
  }

  console.log(foundReferences
    ? '\nKết luận: kho Quận 1 đang có dữ liệu tham chiếu. Migration chỉ vô hiệu hóa kho, không xóa các dòng dữ liệu này.'
    : '\nKết luận: không tìm thấy dòng dữ liệu đang tham chiếu kho Quận 1.');
}

main()
  .catch((error) => {
    console.error('Không thể kiểm tra tham chiếu kho Quận 1:', error);
    process.exitCode = 1;
  })
  .finally(() => connection.end());
