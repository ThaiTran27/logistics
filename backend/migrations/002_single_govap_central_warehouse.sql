-- UP
CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
  setting_value VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS warehouse_scope_002_setting_backup (
  setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
  setting_value VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO warehouse_scope_002_setting_backup (setting_key, setting_value)
SELECT setting_key, setting_value
FROM system_settings
WHERE setting_key = 'central_warehouse_id'
ON DUPLICATE KEY UPDATE setting_key = VALUES(setting_key);

CREATE TABLE IF NOT EXISTS warehouse_scope_002_warehouse_backup (
  warehouse_id INT NOT NULL PRIMARY KEY,
  warehouse_type VARCHAR(20) NOT NULL,
  ward_name VARCHAR(120) NOT NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT DEFAULT NULL,
  lat DOUBLE DEFAULT NULL,
  lng DOUBLE DEFAULT NULL,
  is_configured TINYINT(1) NOT NULL,
  is_active TINYINT(1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO warehouse_scope_002_warehouse_backup
  (warehouse_id, warehouse_type, ward_name, name, address, lat, lng, is_configured, is_active)
SELECT id, warehouse_type, ward_name, name, address, lat, lng, is_configured, is_active
FROM warehouses
ON DUPLICATE KEY UPDATE warehouse_id = VALUES(warehouse_id);

CREATE TABLE IF NOT EXISTS warehouse_scope_002_user_backup (
  user_id INT NOT NULL PRIMARY KEY,
  warehouse_id INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO warehouse_scope_002_user_backup (user_id, warehouse_id)
SELECT id, warehouse_id FROM users WHERE warehouse_id IS NOT NULL
ON DUPLICATE KEY UPDATE warehouse_id = VALUES(warehouse_id);

UPDATE warehouses
SET is_active = 0
WHERE id <> (
  SELECT central.id FROM (
    SELECT id FROM warehouses
    WHERE warehouse_type = 'central' AND ward_name = '__CENTRAL__'
    ORDER BY id
    LIMIT 1
  ) AS central
);

UPDATE warehouses
SET name = 'Kho tổng Gò Vấp',
    address = 'Số 2 Nguyễn Văn Bảo, Gò Vấp, TP. Hồ Chí Minh',
    lat = 10.8231,
    lng = 106.6881,
    is_configured = 1,
    is_active = 1
WHERE warehouse_type = 'central' AND ward_name = '__CENTRAL__';

UPDATE users
SET warehouse_id = (
  SELECT id FROM warehouses
  WHERE warehouse_type = 'central' AND ward_name = '__CENTRAL__'
  ORDER BY id LIMIT 1
)
WHERE warehouse_id IS NOT NULL;

INSERT INTO system_settings (setting_key, setting_value)
SELECT 'central_warehouse_id', CAST(id AS CHAR)
FROM warehouses
WHERE warehouse_type = 'central' AND ward_name = '__CENTRAL__'
ORDER BY id
LIMIT 1
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);

-- DOWN
UPDATE warehouses w
JOIN warehouse_scope_002_warehouse_backup b ON b.warehouse_id = w.id
SET w.warehouse_type = b.warehouse_type,
    w.ward_name = b.ward_name,
    w.name = b.name,
    w.address = b.address,
    w.lat = b.lat,
    w.lng = b.lng,
    w.is_configured = b.is_configured,
    w.is_active = b.is_active;

UPDATE users u
JOIN warehouse_scope_002_user_backup b ON b.user_id = u.id
SET u.warehouse_id = b.warehouse_id;

DELETE FROM system_settings WHERE setting_key = 'central_warehouse_id';
INSERT INTO system_settings (setting_key, setting_value)
SELECT setting_key, setting_value
FROM warehouse_scope_002_setting_backup
WHERE setting_key = 'central_warehouse_id'
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
DROP TABLE warehouse_scope_002_user_backup;
DROP TABLE warehouse_scope_002_warehouse_backup;
DROP TABLE warehouse_scope_002_setting_backup;
