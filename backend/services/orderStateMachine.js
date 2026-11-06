const { query } = require('../utils/db');

class OrderTransitionError extends Error {
  constructor(code, message, statusCode = 409) {
    super(message);
    this.name = 'OrderTransitionError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const transitionDefinitions = [
  { from: 'pending', to: 'picking', roles: ['fleet_manager', 'director', 'warehouse_manager'], action: 'assign_pickup' },
  { from: 'picking', to: 'picked_up', roles: ['pickup_driver'], action: 'confirm_pickup' },
  { from: 'picking', to: 'pickup_failed', roles: ['pickup_driver'], reasonGroup: 'PICKUP', action: 'report_pickup_failure' },
  { from: 'pickup_failed', to: 'pending', roles: ['pickup_driver', 'fleet_manager', 'director'], action: 'retry_pickup' },
  { from: 'pickup_failed', to: 'cancelled', roles: ['pickup_driver', 'fleet_manager', 'director'], action: 'cancel_failed_pickup' },
  { from: 'picked_up', to: 'at_central_warehouse', roles: ['warehouse_manager'], action: 'receive_central_warehouse' },
  { from: 'at_central_warehouse', to: 'at_central_warehouse', roles: ['fleet_manager', 'director', 'warehouse_manager'], action: 'assign_delivery' },
  { from: 'at_central_warehouse', to: 'delivering', roles: ['delivery_driver'], action: 'start_delivery' },
  { from: 'at_destination_warehouse', to: 'delivering', roles: ['delivery_driver'], action: 'start_delivery' },
  { from: 'delivering', to: 'completed', roles: ['delivery_driver'], required: ['photoUrl', 'signatureUrl', 'lat', 'lng'], action: 'complete_delivery' },
  { from: 'delivering', to: 'partial_delivery_completed', roles: ['delivery_driver'], required: ['photoUrl', 'signatureUrl', 'lat', 'lng'], action: 'complete_partial_delivery' },
  { from: 'partial_delivery_completed', to: 'return_pending', roles: ['delivery_driver'], action: 'return_undelivered_items' },
  { from: 'delivering', to: 'exchange_return_collected', roles: ['delivery_driver'], required: ['photoUrl', 'signatureUrl', 'lat', 'lng'], action: 'confirm_exchange_return' },
  { from: 'exchange_return_collected', to: 'completed', roles: ['delivery_driver'], action: 'complete_exchange' },
  { from: 'exchange_return_collected', to: 'partial_delivery_completed', roles: ['delivery_driver'], action: 'complete_partial_exchange' },
  { from: 'exchange_return_collected', to: 'return_pending', roles: ['delivery_driver'], action: 'return_exchange_remainder' },
  { from: 'delivering', to: 'delivery_failed', roles: ['delivery_driver', 'fleet_manager', 'director', 'accountant'], reasonGroup: 'DELIVERY', action: 'report_delivery_failure' },
  { from: 'delivery_failed', to: 'at_central_warehouse', roles: ['delivery_driver', 'fleet_manager', 'director', 'accountant'], action: 'retry_delivery' },
  { from: 'delivery_failed', to: 'return_pending', roles: ['delivery_driver', 'fleet_manager', 'director', 'accountant'], action: 'start_return' },
  { from: 'return_pending', to: 'returning', roles: ['fleet_manager', 'director', 'warehouse_manager'], action: 'assign_return' },
  { from: 'returning', to: 'returned', roles: ['warehouse_manager'], action: 'receive_return' },
  { from: 'returning', to: 'at_central_warehouse', roles: ['fleet_manager', 'director'], action: 'approve_redelivery' },
  { from: 'returned', to: 'returned', roles: ['shop'], required: ['photoUrl', 'signatureUrl'], action: 'shop_acknowledge_return' }
];

const transitionsByKey = new Map(
  transitionDefinitions.map((transition) => [`${transition.from}->${transition.to}`, transition])
);
const allowedOrderUpdates = new Set([
  'pickup_shipper_id', 'delivery_shipper_id', 'return_shipper_id',
  'origin_warehouse_id', 'destination_warehouse_id', 'current_warehouse_id',
  'storage_bin_id', 'cross_docked', 'proof_image', 'signature_image',
  'fail_reason', 'cod_collected', 'cod_collected_amount', 'cod_payment_method',
  'partial_delivery_completed'
]);

function getTransitionDefinition(fromStatus, toStatus) {
  return transitionsByKey.get(`${fromStatus}->${toStatus}`) || null;
}

function isDeliveryStartAlreadyApplied({
  requestedStatus, orderStatus, driverRole, assignedDriverId, driverId
}) {
  return requestedStatus === 'delivering'
    && orderStatus === 'delivering'
    && driverRole === 'delivery_driver'
    && Number(assignedDriverId) === Number(driverId);
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function validateRequiredData(transition, input) {
  for (const field of transition.required || []) {
    const value = input[field];
    if (field === 'lat' || field === 'lng') {
      if (!hasValue(value) || !Number.isFinite(Number(value))
        || Math.abs(Number(value)) > (field === 'lat' ? 90 : 180)) {
        throw new OrderTransitionError('MISSING_REQUIRED_FIELD', `Valid ${field.toUpperCase()} coordinates are required.`, 400);
      }
    } else if (!hasValue(value)) {
      throw new OrderTransitionError('MISSING_REQUIRED_FIELD', `${field} is required for this transition.`, 400);
    }
  }
}

async function getReasonCode(conn, transition, reasonCode) {
  if (!transition.reasonGroup) return null;
  if (!hasValue(reasonCode)) {
    throw new OrderTransitionError('MISSING_REQUIRED_FIELD', 'reasonCode is required for this transition.', 400);
  }
  const rows = await query(
    conn,
    'SELECT code, group_type, allow_retry, counts_attempt, require_evidence, description FROM reason_codes WHERE code = ? LIMIT 1',
    [reasonCode]
  );
  if (!rows.length || rows[0].group_type !== transition.reasonGroup) {
    throw new OrderTransitionError('INVALID_REASON_CODE', 'Reason code is unknown or not valid for this transition.', 400);
  }
  return rows[0];
}

async function getAttemptLimit(conn, key) {
  const rows = await query(conn, 'SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1', [key]);
  const value = Number(rows[0]?.setting_value);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new OrderTransitionError('ATTEMPT_LIMIT_NOT_CONFIGURED', `Missing or invalid ${key} system setting.`, 503);
  }
  return value;
}

async function transitionOrder(conn, {
  orderId, toStatus, actor, reasonCode = null, note = null, lat = null, lng = null,
  photoUrl = null, signatureUrl = null, updates = {}
}) {
  if (!conn || typeof conn.query !== 'function') {
    throw new TypeError('transitionOrder requires an active MySQL transaction connection.');
  }
  if (!Number.isSafeInteger(Number(orderId)) || Number(orderId) <= 0) {
    throw new OrderTransitionError('INVALID_ORDER_ID', 'A valid orderId is required.', 400);
  }
  if (!actor || !Number.isSafeInteger(Number(actor.id)) || Number(actor.id) <= 0 || !actor.role) {
    throw new OrderTransitionError('INVALID_ACTOR', 'A valid actor id and role are required.', 401);
  }
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)
    || Object.keys(updates).some((key) => !allowedOrderUpdates.has(key))) {
    throw new OrderTransitionError('INVALID_ORDER_UPDATES', 'One or more order update fields are not allowed.', 400);
  }

  const orders = await query(conn, 'SELECT * FROM orders WHERE id = ? FOR UPDATE', [Number(orderId)]);
  if (!orders.length) throw new OrderTransitionError('ORDER_NOT_FOUND', 'Order not found.', 404);
  const order = orders[0];
  const transition = getTransitionDefinition(order.status, toStatus);
  if (!transition) {
    throw new OrderTransitionError('INVALID_TRANSITION', `Cannot transition order from "${order.status}" to "${toStatus}".`);
  }
  if (!transition.roles.includes(String(actor.role))) {
    throw new OrderTransitionError('FORBIDDEN_TRANSITION', `Role "${actor.role}" cannot transition order from "${order.status}" to "${toStatus}".`, 403);
  }
  if (transition.action === 'assign_pickup' && !hasValue(updates.pickup_shipper_id)) {
    throw new OrderTransitionError('MISSING_REQUIRED_FIELD', 'pickup_shipper_id is required when assigning pickup.', 400);
  }
  if (transition.action === 'assign_delivery' && !hasValue(updates.delivery_shipper_id)) {
    throw new OrderTransitionError('MISSING_REQUIRED_FIELD', 'delivery_shipper_id is required when assigning delivery.', 400);
  }
  if (transition.action === 'assign_return' && !hasValue(updates.return_shipper_id)) {
    throw new OrderTransitionError('MISSING_REQUIRED_FIELD', 'return_shipper_id is required when assigning a return.', 400);
  }
  if (transition.action === 'assign_delivery' && hasValue(order.delivery_shipper_id)) {
    throw new OrderTransitionError('ORDER_ALREADY_ASSIGNED', 'A delivery driver is already assigned to this order.');
  }

  validateRequiredData(transition, { photoUrl, signatureUrl, reasonCode, lat, lng });
  const reason = await getReasonCode(conn, transition, reasonCode);
  if (reason?.require_evidence && !hasValue(photoUrl)) {
    throw new OrderTransitionError('MISSING_REQUIRED_FIELD', 'This reason code requires a photo as evidence.', 400);
  }

  const nextUpdates = { ...updates };
  if (reason && ['report_pickup_failure', 'report_delivery_failure'].includes(transition.action)) {
    nextUpdates.fail_reason = reason.description;
  }
  if (transition.action === 'report_pickup_failure' && reason.counts_attempt) {
    nextUpdates.pickup_attempts = Number(order.pickup_attempts || 0) + 1;
  }
  if (transition.action === 'report_delivery_failure' && reason.counts_attempt) {
    nextUpdates.delivery_attempts = Number(order.delivery_attempts || 0) + 1;
  }
  if (transition.action === 'approve_redelivery') {
    nextUpdates.delivery_attempts = Number(order.delivery_attempts || 0) + 1;
    nextUpdates.delivery_shipper_id = null;
    nextUpdates.return_shipper_id = null;
  }
  if (transition.action === 'retry_pickup' || transition.action === 'cancel_failed_pickup') {
    nextUpdates.pickup_shipper_id = null;
  }
  if (transition.action === 'retry_delivery' || transition.action === 'start_return') {
    nextUpdates.delivery_shipper_id = null;
  }

  const setClauses = ['status = ?'];
  const parameters = [toStatus];
  for (const [column, value] of Object.entries(nextUpdates)) {
    if (column === 'pickup_attempts' || column === 'delivery_attempts') {
      setClauses.push(`${column} = ?`);
    } else {
      if (!allowedOrderUpdates.has(column)) {
        throw new OrderTransitionError('INVALID_ORDER_UPDATES', `Order update field "${column}" is not allowed.`, 400);
      }
      setClauses.push(`${column} = ?`);
    }
    parameters.push(value);
  }
  parameters.push(Number(orderId), order.status);
  const result = await query(
    conn,
    `UPDATE orders SET ${setClauses.join(', ')} WHERE id = ? AND status = ?`,
    parameters
  );
  if (!result.affectedRows && order.status !== toStatus) {
    throw new OrderTransitionError('CONCURRENT_TRANSITION', 'Order status changed before this transition could be applied.');
  }

  const eventNote = note || reason?.description || null;
  await query(
    conn,
    `INSERT INTO order_events
      (order_id, from_status, to_status, actor_id, actor_role, reason_code, note, lat, lng, photo_url, signature_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [Number(orderId), order.status, toStatus, Number(actor.id), String(actor.role),
      reasonCode || null, eventNote, hasValue(lat) ? Number(lat) : null,
      hasValue(lng) ? Number(lng) : null, photoUrl || null, signatureUrl || null]
  );
  await query(
    conn,
    `INSERT INTO order_status_history
      (order_id, from_status, to_status, note, proof_image, signature_image)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [Number(orderId), order.status, toStatus, eventNote, photoUrl || null, signatureUrl || null]
  );
  return { order: { ...order, ...nextUpdates, status: toStatus }, transition, reason };
}

async function processPickupFailure(conn, input) {
  const failure = await transitionOrder(conn, { ...input, toStatus: 'pickup_failed' });
  const maxAttempts = await getAttemptLimit(conn, 'MAX_PICKUP_ATTEMPTS');
  const canRetry = Boolean(Number(failure.reason?.allow_retry))
    && Number(failure.order.pickup_attempts || 0) < maxAttempts;
  const finalStatus = canRetry ? 'pending' : 'cancelled';
  await transitionOrder(conn, {
    orderId: input.orderId,
    toStatus: finalStatus,
    actor: input.actor,
    note: canRetry ? 'Đơn được đưa về chờ phân công lấy lại.'
      : 'Lý do không cho phép lấy lại hoặc đã đạt số lần lấy hàng tối đa.'
  });
  return { ...failure, finalStatus };
}

async function processDeliveryFailure(conn, input, onBomb = null) {
  const failure = await transitionOrder(conn, { ...input, toStatus: 'delivery_failed' });
  if (input.reasonCode === 'DL_BOMB' && onBomb) await onBomb(conn, failure.order);
  const maxAttempts = await getAttemptLimit(conn, 'MAX_DELIVERY_ATTEMPTS');
  const attemptCount = Number(failure.order.delivery_attempts || 0);
  const canRetry = Boolean(Number(failure.reason?.allow_retry))
    && (!Number(failure.reason?.counts_attempt) || attemptCount < maxAttempts);
  const finalStatus = canRetry ? 'at_central_warehouse' : 'return_pending';
  await transitionOrder(conn, {
    orderId: input.orderId,
    toStatus: finalStatus,
    actor: input.actor,
    note: canRetry ? 'Đơn được đưa về kho tổng để giao lại.' : 'Không thể giao lại; chờ phân công tài xế hoàn về Shop.'
  });
  return { ...failure, finalStatus };
}

module.exports = {
  OrderTransitionError,
  getTransitionDefinition,
  isDeliveryStartAlreadyApplied,
  transitionDefinitions,
  transitionOrder,
  processPickupFailure,
  processDeliveryFailure
};
