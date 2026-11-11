import { describe, expect, it } from 'vitest';
import db from '../utils/db.js';
import itemService from '../services/orderItems.js';

const { withTransaction } = db;
const { applyDeliveryItemScans, normalizeOrderItems } = itemService;

function createPool(order, items) {
  const state = { order: { ...order }, items: items.map((item) => ({ ...item })) };
  const connection = {
    beginTransaction(callback) { callback(null); },
    commit(callback) { callback(null); },
    rollback(callback) { callback(null); },
    release() {},
    query(sql, parameters, callback) {
      const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
      if (normalized.startsWith('select id, cod_amount')) {
        return callback(null, [{ ...state.order }]);
      }
      if (normalized.startsWith('select * from order_items')) {
        return callback(null, state.items.map((item) => ({ ...item })));
      }
      if (normalized.startsWith('update order_items set delivered_quantity')) {
        const item = state.items.find((entry) => Number(entry.id) === Number(parameters[2]));
        item.delivered_quantity = Number(parameters[0]);
        item.return_quantity = Number(parameters[1]);
        return callback(null, { affectedRows: 1 });
      }
      if (normalized.startsWith('update order_items set collected_quantity')) {
        const item = state.items.find((entry) => Number(entry.id) === Number(parameters[1]));
        item.collected_quantity = Number(parameters[0]);
        return callback(null, { affectedRows: 1 });
      }
      callback(new Error(`Unexpected SQL in test: ${normalized}`));
    }
  };
  return {
    state,
    pool: { getConnection(callback) { callback(null, connection); } }
  };
}

describe('order item delivery', () => {
  it('normalizes item lines and requires line totals to match order COD and declared value', () => {
    const items = normalizeOrderItems([
      { item_name: 'Áo', quantity: 2, unit_value: '10000', unit_cod_amount: '8000' },
      { item_name: 'Hàng đổi cũ', direction: 'exchange_in', quantity: 1, unit_value: '5000', unit_cod_amount: '0' }
    ], { itemValue: '20000', codAmount: '16000' });
    expect(items).toHaveLength(2);
    expect(items[1]).toMatchObject({ direction: 'exchange_in', unit_value: '5000' });
    expect(() => normalizeOrderItems([
      { item_name: 'Áo', quantity: 2, unit_value: '10000', unit_cod_amount: '7000' }
    ], { itemValue: '20000', codAmount: '16000' })).toThrow(/phải khớp/);
  });

  it('collects COD only for delivered quantities and marks the remainder for return', async () => {
    const { pool, state } = createPool({
      id: 1, cod_amount: '30000', shipping_fee: '5000', fee_payer: 'receiver',
      partial_delivery_allowed: 1, is_exchange: 0
    }, [
      { id: 11, order_id: 1, direction: 'outbound', quantity: 3, unit_value: '10000', unit_cod_amount: '10000' }
    ]);
    const result = await withTransaction(pool, (conn) => applyDeliveryItemScans(conn, {
      orderId: 1, deliveredItems: [{ order_item_id: 11, quantity: 2 }]
    }));
    expect(result).toMatchObject({
      partial: true, returnCount: 1, deliveredCount: 2, codAmount: '25000'
    });
    expect(state.items[0]).toMatchObject({ delivered_quantity: 2, return_quantity: 1 });
  });

  it('allows a scanned quantity of zero for an undelivered line in a permitted partial delivery', async () => {
    const { pool, state } = createPool({
      id: 1, cod_amount: '30000', shipping_fee: '0', fee_payer: 'sender',
      partial_delivery_allowed: 1, is_exchange: 0
    }, [
      { id: 11, order_id: 1, direction: 'outbound', quantity: 2, unit_value: '10000', unit_cod_amount: '10000' },
      { id: 12, order_id: 1, direction: 'outbound', quantity: 1, unit_value: '10000', unit_cod_amount: '10000' }
    ]);
    const result = await withTransaction(pool, (conn) => applyDeliveryItemScans(conn, {
      orderId: 1,
      deliveredItems: [
        { order_item_id: 11, quantity: 1 },
        { order_item_id: 12, quantity: 0 }
      ]
    }));

    expect(result).toMatchObject({ partial: true, deliveredCount: 1, returnCount: 2, codAmount: '10000' });
    expect(state.items.map((item) => item.return_quantity)).toEqual([1, 1]);
  });

  it('rejects partial delivery when Shop has not permitted it', async () => {
    const { pool } = createPool({
      id: 1, cod_amount: '20000', shipping_fee: '0', fee_payer: 'sender',
      partial_delivery_allowed: 0, is_exchange: 0
    }, [{ id: 11, order_id: 1, direction: 'outbound', quantity: 2, unit_value: '10000', unit_cod_amount: '10000' }]);
    await expect(withTransaction(pool, (conn) => applyDeliveryItemScans(conn, {
      orderId: 1, deliveredItems: [{ order_item_id: 11, quantity: 1 }]
    }))).rejects.toMatchObject({ code: 'INVALID_ORDER_ITEMS' });
  });

  it('requires and validates scans for both sides of an exchange', async () => {
    const { pool, state } = createPool({
      id: 1, cod_amount: '10000', shipping_fee: '0', fee_payer: 'sender',
      partial_delivery_allowed: 0, is_exchange: 1
    }, [
      { id: 11, order_id: 1, direction: 'outbound', quantity: 1, unit_value: '15000', unit_cod_amount: '10000' },
      { id: 12, order_id: 1, direction: 'exchange_in', quantity: 1, unit_value: '8000', unit_cod_amount: '0' }
    ]);
    await expect(withTransaction(pool, (conn) => applyDeliveryItemScans(conn, {
      orderId: 1, deliveredItems: [{ order_item_id: 11, quantity: 1 }]
    }))).rejects.toThrow(/cả hàng giao mới và hàng thu hồi/);
    const result = await withTransaction(pool, (conn) => applyDeliveryItemScans(conn, {
      orderId: 1,
      deliveredItems: [{ order_item_id: 11, quantity: 1 }],
      collectedItems: [{ order_item_id: 12, quantity: 1 }]
    }));
    expect(result).toMatchObject({ isExchange: true, partial: false, deliveredCount: 1, collectedCount: 1 });
    expect(state.items[1].collected_quantity).toBe(1);
  });

  it('keeps an exchange with an undelivered remainder in the return flow', async () => {
    const { pool } = createPool({
      id: 1, cod_amount: '20000', shipping_fee: '5000', fee_payer: 'receiver',
      partial_delivery_allowed: 1, is_exchange: 1
    }, [
      { id: 11, order_id: 1, direction: 'outbound', quantity: 2, unit_value: '10000', unit_cod_amount: '10000' },
      { id: 12, order_id: 1, direction: 'exchange_in', quantity: 1, unit_value: '8000', unit_cod_amount: '0' }
    ]);
    const result = await withTransaction(pool, (conn) => applyDeliveryItemScans(conn, {
      orderId: 1,
      deliveredItems: [{ order_item_id: 11, quantity: 1 }],
      collectedItems: [{ order_item_id: 12, quantity: 1 }]
    }));
    expect(result).toMatchObject({
      isExchange: true, partial: true, returnCount: 1,
      deliveredCount: 1, collectedCount: 1, codAmount: '15000'
    });
  });
});
