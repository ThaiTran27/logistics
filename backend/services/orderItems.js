'use strict';

const { query } = require('../utils/db');
const { addMoney, parseMoney } = require('../utils/money');
const { OrderTransitionError } = require('./orderStateMachine');

function invalidItems(message, code = 'INVALID_ORDER_ITEMS', statusCode = 400) {
  throw new OrderTransitionError(code, message, statusCode);
}

function parseScans(value, label) {
  if (value === undefined || value === null || value === '') return null;
  let parsed = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      invalidItems(`${label} không đúng định dạng JSON.`);
    }
  }
  if (!Array.isArray(parsed)) invalidItems(`${label} phải là danh sách.`);
  const quantities = new Map();
  for (const entry of parsed) {
    const id = Number(entry.order_item_id);
    const quantity = Number(entry.quantity);
    if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(quantity) || quantity < 0) {
      invalidItems(`Mã hoặc số lượng trong ${label} không hợp lệ.`);
    }
    quantities.set(id, (quantities.get(id) || 0) + quantity);
  }
  return quantities;
}

async function applyDeliveryItemScans(conn, { orderId, deliveredItems, collectedItems }) {
  const orders = await query(conn, `SELECT id, cod_amount, shipping_fee, fee_payer,
      partial_delivery_allowed, partial_delivery_completed, is_exchange
    FROM orders WHERE id = ? FOR UPDATE`, [Number(orderId)]);
  if (!orders.length) invalidItems('Không tìm thấy đơn hàng.', 'ORDER_NOT_FOUND', 404);
  const order = orders[0];
  const items = await query(conn,
    'SELECT * FROM order_items WHERE order_id = ? ORDER BY id FOR UPDATE', [Number(orderId)]);
  if (!items.length) invalidItems('Đơn hàng chưa có dòng hàng hóa.', 'ORDER_ITEMS_MISSING', 409);

  const delivered = parseScans(deliveredItems, 'Danh sách hàng giao');
  const collected = parseScans(collectedItems, 'Danh sách hàng thu hồi');
  const isExchange = Number(order.is_exchange) === 1
    || items.some((item) => item.direction === 'exchange_in');
  const outboundItems = items.filter((item) => item.direction === 'outbound');
  const inboundItems = items.filter((item) => item.direction === 'exchange_in');

  if (isExchange && (!delivered || !collected)) {
    invalidItems('Đơn đổi trả cần quét xác nhận cả hàng giao mới và hàng thu hồi.');
  }
  const deliveredById = delivered || new Map(outboundItems.map((item) => [Number(item.id), Number(item.quantity)]));
  const collectedById = collected || new Map();
  let deliveredValue = 0n;
  let collectedCod = 0n;
  let returnCount = 0;
  let deliveredCount = 0;

  for (const item of outboundItems) {
    const count = deliveredById.get(Number(item.id)) || 0;
    if (count > Number(item.quantity)) invalidItems(`Số lượng giao vượt số lượng của "${item.item_name}".`);
    if (count < Number(item.quantity) && Number(order.partial_delivery_allowed) !== 1) {
      invalidItems('Shop chưa cho phép giao một phần; cần giao đủ số lượng.');
    }
    const remaining = Number(item.quantity) - count;
    deliveredCount += count;
    returnCount += remaining;
    deliveredValue = addMoney(deliveredValue, BigInt(count) * parseMoney(item.unit_value));
    collectedCod = addMoney(collectedCod, BigInt(count) * parseMoney(item.unit_cod_amount));
    await query(conn, `UPDATE order_items
      SET delivered_quantity = ?, return_quantity = ?
      WHERE id = ? AND order_id = ?`, [count, remaining, Number(item.id), Number(orderId)]);
  }
  for (const [itemId] of deliveredById) {
    if (!outboundItems.some((item) => Number(item.id) === itemId)) invalidItems('Quét mã hàng giao không thuộc đơn này.');
  }

  let collectedCount = 0;
  for (const item of inboundItems) {
    const count = collectedById.get(Number(item.id)) || 0;
    if (count !== Number(item.quantity)) {
      invalidItems(`Đơn đổi trả cần thu hồi đủ "${item.item_name}" (${item.quantity}).`);
    }
    collectedCount += count;
    await query(conn, `UPDATE order_items SET collected_quantity = ?
      WHERE id = ? AND order_id = ? AND direction = 'exchange_in'`,
    [count, Number(item.id), Number(orderId)]);
  }
  for (const [itemId] of collectedById) {
    if (!inboundItems.some((item) => Number(item.id) === itemId)) invalidItems('Quét mã hàng thu hồi không thuộc đơn đổi trả này.');
  }
  if (isExchange && deliveredCount === 0) invalidItems('Đơn đổi trả phải xác nhận ít nhất một mặt hàng giao mới.');
  if (!isExchange && deliveredCount === 0) invalidItems('Cần xác nhận giao ít nhất một mặt hàng.');

  const codAmount = collectedCod + (order.fee_payer === 'receiver' ? parseMoney(order.shipping_fee || 0) : 0n);
  const partial = returnCount > 0;
  return {
    isExchange,
    partial,
    returnCount,
    deliveredCount,
    collectedCount,
    deliveredValue: deliveredValue.toString(),
    codAmount: codAmount.toString(),
    partialDeliveryAllowed: Number(order.partial_delivery_allowed) === 1
  };
}

function normalizeOrderItems(items, { itemValue, codAmount }) {
  if (items === undefined || items === null) {
    return [{
      item_name: 'Hàng hóa', direction: 'outbound', quantity: 1,
      unit_value: parseMoney(itemValue || 0).toString(),
      unit_cod_amount: parseMoney(codAmount || 0).toString()
    }];
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
    invalidItems('Đơn hàng phải có từ 1 đến 100 dòng hàng hóa.');
  }
  let valueTotal = 0n;
  let codTotal = 0n;
  const normalized = items.map((item) => {
    const quantity = Number(item.quantity);
    const direction = item.direction || 'outbound';
    const value = parseMoney(item.unit_value ?? 0);
    const cod = parseMoney(item.unit_cod_amount ?? 0);
    const name = String(item.item_name || '').trim();
    if (!name || name.length > 255 || !Number.isSafeInteger(quantity) || quantity <= 0
      || !['outbound', 'exchange_in'].includes(direction)
      || (direction === 'exchange_in' && cod !== 0n)) {
      invalidItems('Tên hàng, chiều hàng, số lượng hoặc giá trị dòng hàng không hợp lệ.');
    }
    if (direction === 'outbound') {
      valueTotal = addMoney(valueTotal, BigInt(quantity) * value);
      codTotal = addMoney(codTotal, BigInt(quantity) * cod);
    }
    return {
      item_name: name, direction, quantity,
      unit_value: value.toString(), unit_cod_amount: cod.toString()
    };
  });
  if (!normalized.some((item) => item.direction === 'outbound')) {
    invalidItems('Đơn phải có ít nhất một dòng hàng giao mới.');
  }
  if (valueTotal !== parseMoney(itemValue || 0) || codTotal !== parseMoney(codAmount || 0)) {
    invalidItems('Tổng giá trị và COD theo dòng hàng phải khớp với đơn hàng.');
  }
  return normalized;
}

async function insertOrderItems(conn, orderId, items) {
  for (const item of items) {
    await query(conn, `INSERT INTO order_items
      (order_id, item_name, direction, quantity, unit_value, unit_cod_amount)
      VALUES (?, ?, ?, ?, ?, ?)`, [
      Number(orderId), item.item_name, item.direction, item.quantity,
      item.unit_value, item.unit_cod_amount
    ]);
  }
}

module.exports = { applyDeliveryItemScans, insertOrderItems, normalizeOrderItems };
