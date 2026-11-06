-- UP
ALTER TABLE orders
  ADD COLUMN partial_delivery_allowed TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN partial_delivery_completed TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN is_exchange TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  direction ENUM('outbound','exchange_in') NOT NULL DEFAULT 'outbound',
  quantity INT UNSIGNED NOT NULL,
  delivered_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  collected_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  return_quantity INT UNSIGNED NOT NULL DEFAULT 0,
  unit_value DECIMAL(15,0) NOT NULL DEFAULT 0,
  unit_cod_amount DECIMAL(15,0) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_order_items_order_direction (order_id, direction),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO order_items
  (order_id, item_name, direction, quantity, unit_value, unit_cod_amount)
SELECT id, 'Hàng hóa', 'outbound', 1, COALESCE(item_value, 0), COALESCE(cod_amount, 0)
FROM orders;

-- DOWN
DROP TABLE order_items;
ALTER TABLE orders
  DROP COLUMN is_exchange,
  DROP COLUMN partial_delivery_completed,
  DROP COLUMN partial_delivery_allowed;
