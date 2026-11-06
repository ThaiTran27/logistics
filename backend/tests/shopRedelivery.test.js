import { describe, expect, it } from 'vitest';
import db from '../utils/db.js';
import redelivery from '../services/shopRedelivery.js';

const { withTransaction } = db;
const { reviewShopRedeliveryRequest } = redelivery;

function createMockPool(orderStatus = 'returning', requestStatus = 'pending') {
  const shared = {
    order: { id: 21, status: orderStatus, delivery_attempts: 2, delivery_shipper_id: 15, return_shipper_id: 18 },
    request: {
      order_id: 21,
      shop_id: 7,
      request_status: requestStatus,
      request_note: 'Khách đã xác nhận nhận hàng vào buổi tối.',
      tracking_code: 'GV-RED-21'
    },
    events: [],
    histories: [],
    audits: [],
    notifications: [],
    committed: false,
    rolledBack: false
  };

  return {
    shared,
    getConnection(callback) {
      const connection = {
        beginTransaction(done) { done(null); },
        commit(done) { shared.committed = true; done(null); },
        rollback(done) { shared.rolledBack = true; done(null); },
        release() {},
        query(sql, parameters, done) {
          const normalizedSql = sql.trim().toLowerCase();
          const finish = (error, result) => setImmediate(() => done(error, result));
          if (normalizedSql.startsWith('select r.order_id')) {
            finish(null, [{ ...shared.request, order_status: shared.order.status, delivery_attempts: shared.order.delivery_attempts }]);
          } else if (normalizedSql.startsWith('select * from orders')) {
            finish(null, [{ ...shared.order }]);
          } else if (normalizedSql.startsWith('update orders set')) {
            const columns = sql.match(/UPDATE orders SET (.+) WHERE id = \? AND status = \?/i)[1]
              .split(',')
              .map((part) => part.trim().split('=')[0].trim());
            const expectedStatus = parameters[parameters.length - 1];
            if (shared.order.status !== expectedStatus) return finish(null, { affectedRows: 0 });
            columns.forEach((column, index) => { shared.order[column] = parameters[index]; });
            finish(null, { affectedRows: 1 });
          } else if (normalizedSql.startsWith('insert into order_events')) {
            shared.events.push(parameters);
            finish(null, { affectedRows: 1 });
          } else if (normalizedSql.startsWith('insert into order_status_history')) {
            shared.histories.push(parameters);
            finish(null, { affectedRows: 1 });
          } else if (normalizedSql.startsWith('update shop_redelivery_requests')) {
            if (shared.request.request_status !== 'pending') return finish(null, { affectedRows: 0 });
            shared.request.request_status = parameters[0];
            finish(null, { affectedRows: 1 });
          } else if (normalizedSql.startsWith('insert into audit_logs')) {
            shared.audits.push(parameters);
            finish(null, { affectedRows: 1 });
          } else if (normalizedSql.startsWith('select id from users')) {
            finish(null, [{ id: 31 }, { id: 32 }]);
          } else if (normalizedSql.startsWith('insert into notifications')) {
            shared.notifications.push(parameters);
            finish(null, { affectedRows: 1 });
          } else {
            finish(new Error(`Unexpected SQL in test: ${sql}`));
          }
        }
      };
      callback(null, connection);
    }
  };
}

const dispatcher = { id: 12, role: 'fleet_manager' };

describe('reviewShopRedeliveryRequest', () => {
  it('approves in one transaction, returns the order to the central warehouse and records audit/events/notifications', async () => {
    const pool = createMockPool();
    const result = await withTransaction(pool, (conn) => reviewShopRedeliveryRequest(conn, {
      orderId: 21,
      status: 'approved',
      reviewNote: 'Khách đã xác nhận lịch giao.',
      actor: dispatcher,
      ip: '127.0.0.1'
    }));

    expect(pool.shared.committed).toBe(true);
    expect(pool.shared.rolledBack).toBe(false);
    expect(pool.shared.order).toMatchObject({
      status: 'at_central_warehouse',
      delivery_attempts: 3,
      delivery_shipper_id: null,
      return_shipper_id: null
    });
    expect(pool.shared.request.request_status).toBe('approved');
    expect(pool.shared.events).toHaveLength(1);
    expect(pool.shared.histories).toHaveLength(1);
    expect(pool.shared.audits).toHaveLength(1);
    expect(pool.shared.audits[0][2]).toBe('shop_redelivery.approved');
    expect(JSON.parse(pool.shared.audits[0][4])).toMatchObject({ order_status: 'returning', delivery_attempts: 2 });
    expect(JSON.parse(pool.shared.audits[0][5])).toMatchObject({ order_status: 'at_central_warehouse', delivery_attempts: 3 });
    expect(pool.shared.notifications).toHaveLength(3);
    expect(result.notifications.map((notification) => notification.userId)).toEqual([7, 31, 32]);
    expect(result).toMatchObject({ orderStatus: 'at_central_warehouse', deliveryAttempts: 3 });
  });

  it('rejects with a reason and leaves the order unchanged while auditing and notifying', async () => {
    const pool = createMockPool();
    await withTransaction(pool, (conn) => reviewShopRedeliveryRequest(conn, {
      orderId: 21,
      status: 'rejected',
      reviewNote: 'Khách chưa xác nhận.',
      actor: dispatcher
    }));

    expect(pool.shared.committed).toBe(true);
    expect(pool.shared.order.status).toBe('returning');
    expect(pool.shared.order.delivery_attempts).toBe(2);
    expect(pool.shared.request.request_status).toBe('rejected');
    expect(pool.shared.events).toHaveLength(0);
    expect(pool.shared.histories).toHaveLength(0);
    expect(pool.shared.audits).toHaveLength(1);
    expect(pool.shared.audits[0][2]).toBe('shop_redelivery.rejected');
    expect(pool.shared.notifications).toHaveLength(3);
  });

  it.each(['returned', 'completed'])('blocks approval when the order is %s', async (status) => {
    const pool = createMockPool(status);
    await expect(withTransaction(pool, (conn) => reviewShopRedeliveryRequest(conn, {
      orderId: 21,
      status: 'approved',
      actor: dispatcher
    }))).rejects.toMatchObject({ code: 'ORDER_NOT_ELIGIBLE_FOR_REDELIVERY' });

    expect(pool.shared.rolledBack).toBe(true);
    expect(pool.shared.request.request_status).toBe('pending');
    expect(pool.shared.audits).toHaveLength(0);
    expect(pool.shared.notifications).toHaveLength(0);
  });

  it('requires a reason when the dispatcher rejects the request', async () => {
    const pool = createMockPool();
    await expect(withTransaction(pool, (conn) => reviewShopRedeliveryRequest(conn, {
      orderId: 21,
      status: 'rejected',
      reviewNote: 'No.',
      actor: dispatcher
    }))).rejects.toMatchObject({ code: 'INVALID_REVIEW_NOTE', statusCode: 400 });

    expect(pool.shared.rolledBack).toBe(true);
    expect(pool.shared.request.request_status).toBe('pending');
  });

  it('rejects a request that has already been reviewed', async () => {
    const pool = createMockPool('returning', 'approved');
    await expect(withTransaction(pool, (conn) => reviewShopRedeliveryRequest(conn, {
      orderId: 21,
      status: 'approved',
      actor: dispatcher
    }))).rejects.toMatchObject({ code: 'REDELIVERY_REQUEST_NOT_PENDING' });
  });
});
