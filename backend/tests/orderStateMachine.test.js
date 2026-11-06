import { describe, expect, it } from 'vitest';
import stateMachine from '../services/orderStateMachine.js';
import db from '../utils/db.js';

const {
  OrderTransitionError,
  getTransitionDefinition,
  isDeliveryStartAlreadyApplied,
  transitionDefinitions,
  transitionOrder,
  processPickupFailure,
  processDeliveryFailure
} = stateMachine;
const { withTransaction } = db;

const statuses = [
  'pending', 'picking', 'pickup_failed', 'picked_up', 'at_central_warehouse',
  'delivering', 'delivery_failed', 'partial_delivery_completed',
  'exchange_return_collected', 'return_pending', 'returning', 'returned',
  'completed', 'cancelled', 'at_origin_warehouse', 'transferring_to_central',
  'at_destination_warehouse', 'transferring_to_destination'
];

function createMockPool(initialStatus, options = {}) {
  const shared = {
    order: {
      id: 1,
      status: initialStatus,
      pickup_attempts: options.pickupAttempts || 0,
      delivery_attempts: options.deliveryAttempts || 0,
      delivery_shipper_id: null
    },
    lock: Promise.resolve(),
    eventCount: 0,
    historyCount: 0
  };

  return {
    shared,
    getConnection(callback) {
      let releaseLock = null;
      let hasLock = false;
      const connection = {
        beginTransaction(done) { done(null); },
        commit(done) { releaseLock?.(); done(null); },
        rollback(done) { releaseLock?.(); done(null); },
        release() {},
        query(sql, parameters, done) {
          const normalizedSql = sql.trim().toLowerCase();
          const finish = (error, result) => setImmediate(() => done(error, result));
          if (normalizedSql.startsWith('select * from orders')) {
            if (hasLock) return finish(null, shared.order ? [{ ...shared.order }] : []);
            hasLock = true;
            const previousLock = shared.lock;
            shared.lock = new Promise((resolve) => { releaseLock = resolve; });
            previousLock.then(() => finish(null, shared.order ? [{ ...shared.order }] : []));
          } else if (normalizedSql.startsWith('select code, group_type, allow_retry')) {
            const reasons = {
              PU_NO_CONTACT: { code: 'PU_NO_CONTACT', group_type: 'PICKUP', allow_retry: 1, counts_attempt: 1, require_evidence: 0 },
              PU_SHOP_CANCEL: { code: 'PU_SHOP_CANCEL', group_type: 'PICKUP', allow_retry: 0, counts_attempt: 1, require_evidence: 1 },
              DL_NO_CONTACT: { code: 'DL_NO_CONTACT', group_type: 'DELIVERY', allow_retry: 1, counts_attempt: 1, require_evidence: 1 },
              DL_REFUSED: { code: 'DL_REFUSED', group_type: 'DELIVERY', allow_retry: 0, counts_attempt: 1, require_evidence: 1 },
              DL_RESCHEDULE: { code: 'DL_RESCHEDULE', group_type: 'DELIVERY', allow_retry: 1, counts_attempt: 0, require_evidence: 0 }
            };
            finish(null, reasons[parameters[0]] ? [{ ...reasons[parameters[0]] }] : []);
          } else if (normalizedSql.startsWith('select setting_value from system_settings')) {
            finish(null, [{ setting_value: '3' }]);
          } else if (normalizedSql.startsWith('update orders set')) {
            const setClause = sql.match(/UPDATE orders SET (.+) WHERE id = \? AND status = \?/i)?.[1] || '';
            const columns = setClause.split(',').map((part) => part.trim().split('=')[0].trim());
            const expectedStatus = parameters[parameters.length - 1];
            if (shared.order.status !== expectedStatus) return finish(null, { affectedRows: 0 });
            columns.forEach((column, index) => { shared.order[column] = parameters[index]; });
            finish(null, { affectedRows: 1 });
          } else if (normalizedSql.startsWith('insert into order_events')) {
            shared.eventCount += 1;
            finish(null, { affectedRows: 1 });
          } else if (normalizedSql.startsWith('insert into order_status_history')) {
            shared.historyCount += 1;
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

function validInput(transition) {
  const input = {
    orderId: 1,
    toStatus: transition.to,
    actor: { id: 7, role: transition.roles[0] },
    updates: {}
  };
  if (transition.action === 'assign_pickup') input.updates.pickup_shipper_id = 9;
  if (transition.action === 'assign_delivery') input.updates.delivery_shipper_id = 9;
  if (transition.action === 'assign_return') input.updates.return_shipper_id = 9;
  if (transition.required?.includes('photoUrl') || transition.reasonGroup === 'DELIVERY') input.photoUrl = '/uploads/proof.jpg';
  if (transition.required?.includes('signatureUrl')) input.signatureUrl = '/uploads/signature.png';
  if (transition.reasonGroup === 'PICKUP') input.reasonCode = 'PU_NO_CONTACT';
  if (transition.reasonGroup === 'DELIVERY') input.reasonCode = 'DL_NO_CONTACT';
  if (transition.required?.includes('lat')) input.lat = 10.8;
  if (transition.required?.includes('lng')) input.lng = 106.6;
  return input;
}

describe('transitionOrder', () => {
  it('accepts a repeated delivery-start request only from the assigned delivery driver', () => {
    expect(isDeliveryStartAlreadyApplied({
      requestedStatus: 'delivering',
      orderStatus: 'delivering',
      driverRole: 'delivery_driver',
      assignedDriverId: 11,
      driverId: 11
    })).toBe(true);
  });

  it.each([
    { requestedStatus: 'delivering', orderStatus: 'delivering', driverRole: 'delivery_driver', assignedDriverId: 11, driverId: 12 },
    { requestedStatus: 'delivering', orderStatus: 'delivering', driverRole: 'pickup_driver', assignedDriverId: 11, driverId: 11 },
    { requestedStatus: 'delivering', orderStatus: 'at_central_warehouse', driverRole: 'delivery_driver', assignedDriverId: 11, driverId: 11 },
    { requestedStatus: 'completed', orderStatus: 'delivering', driverRole: 'delivery_driver', assignedDriverId: 11, driverId: 11 }
  ])('rejects a non-idempotent delivery-start request', (input) => {
    expect(isDeliveryStartAlreadyApplied(input)).toBe(false);
  });

  it.each(transitionDefinitions)('applies valid transition $from -> $to', async (transition) => {
    const pool = createMockPool(transition.from);
    await withTransaction(pool, (conn) => transitionOrder(conn, validInput(transition)));
    expect(pool.shared.order.status).toBe(transition.to);
    expect(pool.shared.eventCount).toBe(1);
    expect(pool.shared.historyCount).toBe(1);
  });

  const invalidTransitions = statuses.flatMap((from) => statuses
    .filter((to) => !getTransitionDefinition(from, to))
    .map((to) => [from, to]));

  it.each(invalidTransitions)('rejects invalid transition %s -> %s', async (from, to) => {
    const pool = createMockPool(from);
    await expect(withTransaction(pool, (conn) => transitionOrder(conn, {
      orderId: 1,
      toStatus: to,
      actor: { id: 7, role: 'director' }
    }))).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    expect(pool.shared.eventCount).toBe(0);
    expect(pool.shared.historyCount).toBe(0);
  });

  it('rejects actors without the required role', async () => {
    const pool = createMockPool('picking');
    await expect(withTransaction(pool, (conn) => transitionOrder(conn, {
      orderId: 1,
      toStatus: 'picked_up',
      actor: { id: 7, role: 'delivery_driver' }
    }))).rejects.toMatchObject({ code: 'FORBIDDEN_TRANSITION' });
  });

  it.each([
    ['completed', 'photoUrl'],
    ['completed', 'signatureUrl'],
    ['completed', 'lat'],
    ['completed', 'lng'],
    ['pickup_failed', 'reasonCode'],
    ['delivery_failed', 'reasonCode']
  ])('rejects missing %s for %s', async (toStatus, missingField) => {
    const fromStatus = toStatus === 'pickup_failed' ? 'picking' : toStatus === 'delivery_failed' ? 'delivering' : 'delivering';
    const transition = getTransitionDefinition(fromStatus, toStatus);
    const input = validInput(transition);
    delete input[missingField];
    const pool = createMockPool(fromStatus);
    await expect(withTransaction(pool, (conn) => transitionOrder(conn, input)))
      .rejects.toBeInstanceOf(OrderTransitionError);
  });

  it('requires evidence when the selected reason code requires it', async () => {
    const pool = createMockPool('delivering');
    await expect(withTransaction(pool, (conn) => transitionOrder(conn, {
      orderId: 1,
      toStatus: 'delivery_failed',
      actor: { id: 7, role: 'delivery_driver' },
      reasonCode: 'DL_NO_CONTACT'
    }))).rejects.toMatchObject({ code: 'MISSING_REQUIRED_FIELD' });
  });

  it('retries the first two counted delivery failures and returns on the third', async () => {
    const pool = createMockPool('delivering');
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const result = await withTransaction(pool, (conn) => processDeliveryFailure(conn, {
        orderId: 1,
        actor: { id: 11, role: 'delivery_driver' },
        reasonCode: 'DL_NO_CONTACT',
        photoUrl: '/proof.jpg'
      }));
      expect(result.finalStatus).toBe(attempt < 3 ? 'at_central_warehouse' : 'return_pending');
      expect(pool.shared.order.delivery_attempts).toBe(attempt);
      if (attempt < 3) {
        await withTransaction(pool, (conn) => transitionOrder(conn, {
          orderId: 1,
          toStatus: 'delivering',
          actor: { id: 11, role: 'delivery_driver' }
        }));
      }
    }
  });

  it('moves a non-retryable delivery reason directly to return pending', async () => {
    const pool = createMockPool('delivering');
    const result = await withTransaction(pool, (conn) => processDeliveryFailure(conn, {
      orderId: 1,
      actor: { id: 11, role: 'delivery_driver' },
      reasonCode: 'DL_REFUSED',
      photoUrl: '/proof.jpg'
    }));
    expect(result.finalStatus).toBe('return_pending');
    expect(pool.shared.order.status).toBe('return_pending');
    expect(pool.shared.order.delivery_attempts).toBe(1);
    expect(pool.shared.eventCount).toBe(2);
    expect(pool.shared.historyCount).toBe(2);
    expect(pool.shared.order.status).not.toBe('completed');
  });

  it('cancels pickup after the configured third failure', async () => {
    const pool = createMockPool('picking');
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const result = await withTransaction(pool, (conn) => processPickupFailure(conn, {
        orderId: 1,
        actor: { id: 9, role: 'pickup_driver' },
        reasonCode: 'PU_NO_CONTACT'
      }));
      expect(result.finalStatus).toBe(attempt < 3 ? 'pending' : 'cancelled');
      expect(pool.shared.order.pickup_attempts).toBe(attempt);
      if (attempt < 3) {
        await withTransaction(pool, (conn) => transitionOrder(conn, {
          orderId: 1,
          toStatus: 'picking',
          actor: { id: 7, role: 'fleet_manager' },
          updates: { pickup_shipper_id: 9 }
        }));
      }
    }
  });

  it('cancels pickup immediately when its reason does not allow retry', async () => {
    const pool = createMockPool('picking');
    const result = await withTransaction(pool, (conn) => processPickupFailure(conn, {
      orderId: 1,
      actor: { id: 9, role: 'pickup_driver' },
      reasonCode: 'PU_SHOP_CANCEL',
      photoUrl: '/proof.jpg'
    }));
    expect(result.finalStatus).toBe('cancelled');
    expect(pool.shared.order.pickup_attempts).toBe(1);
  });

  it('does not increment attempts for reasons marked not to count', async () => {
    const pool = createMockPool('delivering');
    const result = await withTransaction(pool, (conn) => processDeliveryFailure(conn, {
      orderId: 1,
      actor: { id: 11, role: 'delivery_driver' },
      reasonCode: 'DL_RESCHEDULE'
    }));
    expect(result.finalStatus).toBe('at_central_warehouse');
    expect(pool.shared.order.delivery_attempts).toBe(0);
  });

  it('serializes concurrent transitions so only one can consume the prior state', async () => {
    const pool = createMockPool('pending');
    const firstInput = validInput(getTransitionDefinition('pending', 'picking'));
    const secondInput = validInput(getTransitionDefinition('pending', 'picking'));
    const results = await Promise.allSettled([
      withTransaction(pool, (conn) => transitionOrder(conn, firstInput)),
      withTransaction(pool, (conn) => transitionOrder(conn, secondInput))
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(pool.shared.eventCount).toBe(1);
    expect(pool.shared.historyCount).toBe(1);
    expect(pool.shared.order.status).toBe('picking');
  });

  it('completes the simplified path from pending through delivery', async () => {
    const pool = createMockPool('pending');
    const lifecycle = [
      ['picking', { id: 1, role: 'fleet_manager' }, { pickup_shipper_id: 9 }],
      ['picked_up', { id: 9, role: 'pickup_driver' }],
      ['at_central_warehouse', { id: 10, role: 'warehouse_manager' }],
      ['at_central_warehouse', { id: 10, role: 'warehouse_manager' }, { delivery_shipper_id: 11 }],
      ['delivering', { id: 11, role: 'delivery_driver' }],
      ['completed', { id: 11, role: 'delivery_driver' }, {
        evidence: { photoUrl: '/proof.jpg', signatureUrl: '/signature.png', lat: 10.82, lng: 106.68 }
      }]
    ];
    for (const [toStatus, actor, extra = {}] of lifecycle) {
      const input = {
        orderId: 1,
        toStatus,
        actor,
        updates: extra.pickup_shipper_id || extra.delivery_shipper_id ? extra : {}
      };
      if (extra.evidence) Object.assign(input, extra.evidence);
      await withTransaction(pool, (conn) => transitionOrder(conn, input));
    }
    expect(pool.shared.order.status).toBe('completed');
    expect(pool.shared.eventCount).toBe(6);
    expect(pool.shared.historyCount).toBe(6);
  });
});
