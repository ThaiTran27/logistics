const { query } = require('../utils/db');
const { OrderTransitionError } = require('./orderStateMachine');
const { addMoney, parseMoney, subtractMoney } = require('../utils/money');
const amountString = (value) => parseMoney(value, { allowNegative: true }).toString();

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function dateOnly(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

async function writeAudit(conn, { actor, action, entityType, entityId, oldValue, newValue, ip = null }) {
  await query(
    conn,
    `INSERT INTO audit_logs
      (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [Number(actor.id), actor.role, action, entityType, String(entityId),
      JSON.stringify(oldValue), JSON.stringify(newValue), ip]
  );
}

async function createDriverRemittance(conn, {
  driverId, workDate, actualAmount, varianceReason = '', actor, ip = null
}) {
  if (!Number.isSafeInteger(Number(driverId)) || Number(driverId) <= 0 || !validDate(workDate)) {
    throw new OrderTransitionError('INVALID_REMITTANCE_INPUT', 'Tài xế hoặc ngày làm việc không hợp lệ.', 400);
  }
  if (actualAmount === undefined || actualAmount === null || String(actualAmount).trim() === '') {
    throw new OrderTransitionError('INVALID_REMITTANCE_AMOUNT', 'Cần nhập số tiền thực nộp.', 400);
  }
  const actualAmountVnd = parseMoney(actualAmount);
  if (actualAmountVnd > 100000000n) {
    throw new OrderTransitionError('INVALID_REMITTANCE_AMOUNT', 'Số tiền thực nộp phải từ 0 đến 100.000.000 đồng.', 400);
  }
  const reason = String(varianceReason || '').trim();
  if (reason.length > 500) {
    throw new OrderTransitionError('INVALID_REMITTANCE_REASON', 'Lý do chênh lệch tối đa 500 ký tự.', 400);
  }

  const drivers = await query(
    conn,
    `SELECT id FROM users
     WHERE id = ? AND role = 'delivery_driver' AND status = 'active'
     FOR UPDATE`,
    [Number(driverId)]
  );
  if (!drivers.length) throw new OrderTransitionError('DRIVER_NOT_FOUND', 'Không tìm thấy tài xế giao hàng đang hoạt động.', 404);

  const orders = await query(
    conn,
    `SELECT o.id, o.cod_collected_amount
     FROM orders o
    WHERE o.delivery_shipper_id = ?
      AND (o.status = 'completed' OR o.partial_delivery_completed = 1)
       AND o.cod_collected = 1 AND o.cod_payment_method = 'cash'
       AND o.cod_collected_amount > 0
       AND o.cod_remittance_id IS NULL
       AND DATE(COALESCE(
         (SELECT MAX(e.created_at) FROM order_events e
          WHERE e.order_id = o.id AND e.to_status IN ('completed','partial_delivery_completed')),
         o.updated_at
       )) = ?
     ORDER BY o.id
     FOR UPDATE`,
    [Number(driverId), workDate]
  );
  if (!orders.length) {
    throw new OrderTransitionError('NO_CASH_ORDERS', 'Không có đơn COD tiền mặt chưa nộp trong ngày làm việc đã chọn.');
  }
  const expectedAmountVnd = orders.reduce(
    (sum, order) => addMoney(sum, parseMoney(order.cod_collected_amount)),
    0n
  );
  const varianceAmountVnd = subtractMoney(actualAmountVnd, expectedAmountVnd, { allowNegative: true });
  if (varianceAmountVnd !== 0n && reason.length < 5) {
    throw new OrderTransitionError('REMITTANCE_VARIANCE_REASON_REQUIRED', 'Chênh lệch tiền nộp cần ghi lý do ít nhất 5 ký tự.', 400);
  }
  const orderIds = orders.map((order) => Number(order.id));
  const result = await query(
    conn,
    `INSERT INTO driver_cash_remittances
      (driver_id, amount, work_date, expected_amount, variance_amount, variance_reason, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [Number(driverId), amountString(actualAmountVnd), workDate, amountString(expectedAmountVnd),
      amountString(varianceAmountVnd), reason || null, Number(actor.id)]
  );
  const placeholders = orderIds.map(() => '?').join(', ');
  let assigned;
  try {
    assigned = await query(
      conn,
      `UPDATE orders SET cod_remittance_id = ?
       WHERE id IN (${placeholders}) AND cod_remittance_id IS NULL`,
      [Number(result.insertId), ...orderIds]
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new OrderTransitionError('REMITTANCE_ORDERS_CHANGED', 'Một hoặc nhiều đơn vừa được đưa vào phiếu khác; giao dịch đã hủy.');
    }
    throw error;
  }
  if (assigned.affectedRows !== orderIds.length) {
    throw new OrderTransitionError('REMITTANCE_ORDERS_CHANGED', 'Một hoặc nhiều đơn vừa được đưa vào phiếu khác; giao dịch đã hủy.');
  }

  const oldValue = { order_ids: orderIds, cod_remittance_id: null };
  const newValue = {
    driver_id: Number(driverId),
    work_date: workDate,
    order_ids: orderIds,
    expected_amount: amountString(expectedAmountVnd),
    actual_amount: amountString(actualAmountVnd),
    variance_amount: amountString(varianceAmountVnd),
    variance_reason: reason || null,
    status: 'pending'
  };
  await writeAudit(conn, {
    actor, action: 'driver_cash_remittance.create', entityType: 'driver_cash_remittance',
    entityId: result.insertId, oldValue, newValue, ip
  });
  return {
    remittanceId: Number(result.insertId),
    orderCount: orderIds.length,
    expectedAmount: amountString(expectedAmountVnd),
    actualAmount: amountString(actualAmountVnd),
    varianceAmount: amountString(varianceAmountVnd),
    status: 'pending'
  };
}

async function releaseReservation(conn, reservation, actor, ip = null) {
  const walletRows = await query(
    conn,
    'SELECT balance, reserved_balance FROM driver_wallets WHERE driver_id = ? FOR UPDATE',
    [Number(reservation.driver_id)]
  );
  if (!walletRows.length) {
    throw new OrderTransitionError('DRIVER_WALLET_NOT_FOUND', 'Không tìm thấy ví tài xế để giải phóng ký quỹ.', 409);
  }
  const wallet = walletRows[0];
  const reservedBefore = parseMoney(wallet.reserved_balance);
  const amount = parseMoney(reservation.amount);
  if (reservedBefore < amount) {
    throw new OrderTransitionError('WALLET_RESERVATION_INCONSISTENT', 'Số dư ký quỹ đang giữ nhỏ hơn reservation của đơn.', 409);
  }
  const updated = await query(
    conn,
    `UPDATE driver_wallet_reservations
     SET status = 'released', released_at = CURRENT_TIMESTAMP
     WHERE order_id = ? AND status = 'reserved'`,
    [Number(reservation.order_id)]
  );
  if (!updated.affectedRows) return false;
  await query(
    conn,
    'UPDATE driver_wallets SET reserved_balance = reserved_balance - ? WHERE driver_id = ?',
    [amountString(amount), Number(reservation.driver_id)]
  );
  await query(
    conn,
    `INSERT INTO driver_wallet_transactions
      (driver_id, order_id, transaction_type, amount, note, created_by)
     VALUES (?, ?, 'release', ?, ?, ?)`,
    [Number(reservation.driver_id), Number(reservation.order_id), amountString(amount),
      'Kế toán xác nhận đã nhận COD tiền mặt', Number(actor.id)]
  );
  await writeAudit(conn, {
    actor, action: 'driver_wallet_reservation.release', entityType: 'driver_wallet_reservation',
    entityId: reservation.order_id,
    oldValue: { status: 'reserved', reserved_balance: amountString(reservedBefore) },
    newValue: { status: 'released', reserved_balance: amountString(subtractMoney(reservedBefore, amount)) },
    ip
  });
  return true;
}

async function receiveDriverRemittance(conn, { remittanceId, accountantId, actorRole = 'accountant', ip = null }) {
  const remittances = await query(
    conn,
    'SELECT * FROM driver_cash_remittances WHERE id = ? FOR UPDATE',
    [Number(remittanceId)]
  );
  if (!remittances.length) throw new OrderTransitionError('REMITTANCE_NOT_FOUND', 'Không tìm thấy phiếu nộp tiền.', 404);
  const remittance = remittances[0];
  if (remittance.status !== 'pending') {
    throw new OrderTransitionError('REMITTANCE_ALREADY_RECEIVED', 'Phiếu nộp đã được xác nhận.');
  }
  const orders = await query(
    conn,
    `SELECT id FROM orders
     WHERE cod_remittance_id = ?
     ORDER BY id
     FOR UPDATE`,
    [Number(remittanceId)]
  );
  if (!orders.length) throw new OrderTransitionError('REMITTANCE_WITHOUT_ORDERS', 'Phiếu nộp không còn đơn COD liên kết.', 409);
  const orderIds = orders.map((order) => Number(order.id));
  const placeholders = orderIds.map(() => '?').join(', ');
  const reservations = await query(
    conn,
    `SELECT order_id, driver_id, amount
     FROM driver_wallet_reservations
     WHERE order_id IN (${placeholders}) AND status = 'reserved'
     ORDER BY driver_id, order_id
     FOR UPDATE`,
    orderIds
  );
  for (const reservation of reservations) {
    await releaseReservation(conn, reservation, { id: Number(accountantId), role: actorRole }, ip);
  }
  const updated = await query(
    conn,
    `UPDATE driver_cash_remittances
     SET status = 'received', received_by = ?, received_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'pending'`,
    [Number(accountantId), Number(remittanceId)]
  );
  if (!updated.affectedRows) throw new OrderTransitionError('REMITTANCE_ALREADY_RECEIVED', 'Phiếu vừa được xác nhận bởi người khác.');
  await writeAudit(conn, {
    actor: { id: Number(accountantId), role: actorRole },
    action: 'driver_cash_remittance.receive',
    entityType: 'driver_cash_remittance',
    entityId: remittanceId,
    oldValue: { status: remittance.status, received_by: remittance.received_by },
    newValue: { status: 'received', received_by: Number(accountantId), order_ids: orderIds },
    ip
  });
  return { orderCount: orderIds.length, releasedReservations: reservations.length };
}

function completionDateExpression(alias = 'o') {
  return `DATE(COALESCE(
    (SELECT MAX(e.created_at) FROM order_events e
     WHERE e.order_id = ${alias}.id
       AND e.to_status IN ('completed','partial_delivery_completed')),
    ${alias}.updated_at
  ))`;
}

async function createShopSettlement(conn, {
  shopId, month = null, paymentMethod = 'bank_transfer', paymentReference = null,
  accountantId, actorRole = 'accountant', ip = null
}) {
  if (!Number.isSafeInteger(Number(shopId)) || Number(shopId) <= 0
    || !['bank_transfer', 'cash'].includes(paymentMethod)
    || month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new OrderTransitionError('INVALID_SETTLEMENT_INPUT', 'Shop, phương thức thanh toán hoặc tháng đối soát không hợp lệ.', 400);
  }
  const shops = await query(conn, 'SELECT id FROM users WHERE id = ? AND role = ? FOR UPDATE', [Number(shopId), 'shop']);
  if (!shops.length) throw new OrderTransitionError('SHOP_NOT_FOUND', 'Không tìm thấy Shop.', 404);
  const settings = await query(
    conn,
    "SELECT setting_value FROM system_settings WHERE setting_key = 'COD_SETTLEMENT_CYCLE' FOR UPDATE"
  );
  const cycle = String(settings[0]?.setting_value || 'T+1').toUpperCase();
  if (!['T+1', 'T+2', 'T+3', 'WEEKLY'].includes(cycle)) {
    throw new OrderTransitionError('INVALID_SETTLEMENT_CYCLE', 'Chu kỳ đối soát trong system_settings không hợp lệ.', 503);
  }
  const completionDate = completionDateExpression();
  const dateCondition = cycle === 'WEEKLY'
    ? `${completionDate} >= DATE_SUB(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 7 DAY)
       AND ${completionDate} < DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)`
    : `DATE_ADD(${completionDate}, INTERVAL ${Number(cycle.slice(2))} DAY) <= CURDATE()`;
  const monthCondition = cycle === 'WEEKLY'
    ? ''
    : `AND (? IS NULL OR DATE_FORMAT(${completionDate}, '%Y-%m') = ?)`;
  const orders = await query(
    conn,
    `SELECT o.id,
      CASE WHEN o.partial_delivery_completed = 1
        THEN COALESCE((SELECT SUM(i.delivered_quantity * i.unit_cod_amount)
          FROM order_items i WHERE i.order_id = o.id AND i.direction = 'outbound'), 0)
        ELSE o.cod_amount END AS settle_cod_amount,
      o.shipping_fee, o.fee_payer, o.service_fee,
      o.insurance_fee, o.failure_fee, ${completionDate} AS completion_date
     FROM orders o
     WHERE o.shop_id = ? AND (o.status = 'completed' OR o.partial_delivery_completed = 1)
       AND o.cod_collected = 1 AND o.is_cod_paid = 0
       AND o.cod_settlement_id IS NULL
       AND (o.cod_payment_method = 'bank_transfer'
         OR (o.cod_payment_method = 'cash' AND EXISTS (
           SELECT 1 FROM driver_cash_remittances r
           WHERE r.id = o.cod_remittance_id AND r.status = 'received'
         )))
       AND ${dateCondition}
       ${monthCondition}
     ORDER BY o.id
     FOR UPDATE`,
    cycle === 'WEEKLY' ? [Number(shopId)] : [Number(shopId), month, month]
  );
  if (!orders.length) {
    throw new OrderTransitionError('NO_SETTLEABLE_ORDERS', 'Shop không có đơn COD đã đến kỳ và chưa đối soát.');
  }
  const totals = orders.reduce((result, order) => {
    const cod = parseMoney(order.settle_cod_amount);
    const shipping = order.fee_payer === 'sender' ? parseMoney(order.shipping_fee) : 0n;
    const service = parseMoney(order.service_fee);
    const insurance = parseMoney(order.insurance_fee);
    const failure = parseMoney(order.failure_fee);
    result.cod = addMoney(result.cod, cod);
    result.shipping = addMoney(result.shipping, shipping);
    result.service = addMoney(result.service, service);
    result.insurance = addMoney(result.insurance, insurance);
    result.failure = addMoney(result.failure, failure);
    const orderPaid = subtractMoney(
      subtractMoney(
        subtractMoney(
          subtractMoney(cod, shipping, { allowNegative: true }),
          service,
          { allowNegative: true }
        ),
        insurance,
        { allowNegative: true }
      ),
      failure,
      { allowNegative: true }
    );
    result.paid = addMoney(result.paid, orderPaid, { allowNegative: true });
    return result;
  }, { cod: 0n, shipping: 0n, service: 0n, insurance: 0n, failure: 0n, paid: 0n });
  const orderIds = orders.map((order) => Number(order.id));
  const completionDates = orders.map((order) => dateOnly(order.completion_date)).sort();
  const settlementResult = await query(
    conn,
    `INSERT INTO cod_settlements
      (shop_id, total_cod, total_shipping_fee, total_service_fee, total_insurance_fee,
       total_failure_fee, total_paid, order_count, payment_method, payment_reference, paid_by, cycle_code,
       period_start, period_end, transfer_file_reference)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [Number(shopId), amountString(totals.cod), amountString(totals.shipping),
      amountString(totals.service), amountString(totals.insurance), amountString(totals.failure),
      amountString(totals.paid),
      orderIds.length, paymentMethod, paymentReference || null, Number(accountantId), cycle,
      dateOnly(completionDates[0]), dateOnly(completionDates[completionDates.length - 1]), null]
  );
  const placeholders = orderIds.map(() => '?').join(', ');
  const update = await query(
    conn,
    `UPDATE orders SET is_cod_paid = 1, cod_settlement_id = ?
     WHERE id IN (${placeholders}) AND cod_settlement_id IS NULL AND is_cod_paid = 0`,
    [Number(settlementResult.insertId), ...orderIds]
  );
  if (update.affectedRows !== orderIds.length) {
    throw new OrderTransitionError('SETTLEMENT_ORDERS_CHANGED', 'Một hoặc nhiều đơn vừa được đối soát; giao dịch đã hủy.');
  }
  await writeAudit(conn, {
    actor: { id: Number(accountantId), role: actorRole },
    action: 'cod_settlement.create',
    entityType: 'cod_settlement',
    entityId: settlementResult.insertId,
    oldValue: { order_ids: orderIds, cod_settlement_id: null, is_cod_paid: 0 },
    newValue: {
      shop_id: Number(shopId), order_ids: orderIds, cycle_code: cycle,
      total_cod: amountString(totals.cod), total_shipping_fee: amountString(totals.shipping),
      total_service_fee: amountString(totals.service), total_insurance_fee: amountString(totals.insurance),
      total_failure_fee: amountString(totals.failure), total_paid: amountString(totals.paid),
      payment_method: paymentMethod, payment_reference: paymentReference || null
    },
    ip
  });
  return {
    settlementId: Number(settlementResult.insertId),
    orderCount: orderIds.length,
    totalPaid: amountString(totals.paid),
    totalFailureFee: amountString(totals.failure),
    cycle
  };
}

async function setOrderFailureFee(conn, { orderId, amount, note, actor, ip = null }) {
  const feeVnd = parseMoney(amount);
  const explanation = String(note || '').trim();
  if (feeVnd > 100000000n || explanation.length < 5 || explanation.length > 500) {
    throw new OrderTransitionError('INVALID_FAILURE_FEE', 'Phí giao thất bại không hợp lệ; cần ghi chú từ 5 đến 500 ký tự.', 400);
  }
  const orders = await query(
    conn,
    'SELECT id, status, delivery_attempts, failure_fee, cod_settlement_id FROM orders WHERE id = ? FOR UPDATE',
    [Number(orderId)]
  );
  if (!orders.length) throw new OrderTransitionError('ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.', 404);
  const order = orders[0];
  const hasDeliveryFailure = Number(order.delivery_attempts || 0) > 0;
  if (!['delivery_failed', 'return_pending', 'returning', 'returned', 'at_central_warehouse', 'completed'].includes(order.status)
    || !hasDeliveryFailure
    || order.cod_settlement_id !== null) {
    throw new OrderTransitionError('FAILURE_FEE_NOT_EDITABLE', 'Chỉ điều chỉnh phí đơn giao thất bại trước khi đối soát.', 409);
  }
  const oldFee = parseMoney(order.failure_fee);
  await query(conn, 'UPDATE orders SET failure_fee = ? WHERE id = ?', [amountString(feeVnd), Number(orderId)]);
  await writeAudit(conn, {
    actor,
    action: 'cod_failure_fee.adjust',
    entityType: 'order',
    entityId: orderId,
    oldValue: { failure_fee: amountString(oldFee), status: order.status },
    newValue: { failure_fee: amountString(feeVnd), status: order.status, note: explanation },
    ip
  });
  return { oldFee: amountString(oldFee), failureFee: amountString(feeVnd) };
}

async function depositDriverWallet(conn, { driverId, amount, note, actor, ip = null }) {
  const amountVnd = parseMoney(amount);
  const description = String(note || '').trim();
  if (!Number.isSafeInteger(Number(driverId)) || Number(driverId) <= 0
    || amountVnd <= 0n || amountVnd > 100000000n || description.length > 200) {
    throw new OrderTransitionError('INVALID_WALLET_DEPOSIT', 'Số tiền nạp hoặc ghi chú không hợp lệ.', 400);
  }
  const drivers = await query(
    conn,
    `SELECT id FROM users WHERE id = ? AND role = 'delivery_driver' AND status = 'active' FOR UPDATE`,
    [Number(driverId)]
  );
  if (!drivers.length) throw new OrderTransitionError('DRIVER_NOT_FOUND', 'Không tìm thấy tài xế giao hàng đang hoạt động.', 404);
  await query(
    conn,
    'INSERT INTO driver_wallets (driver_id) VALUES (?) ON DUPLICATE KEY UPDATE driver_id = VALUES(driver_id)',
    [Number(driverId)]
  );
  const wallets = await query(conn, 'SELECT balance, reserved_balance FROM driver_wallets WHERE driver_id = ? FOR UPDATE', [Number(driverId)]);
  const wallet = wallets[0];
  const oldBalance = parseMoney(wallet.balance);
  const oldReserved = parseMoney(wallet.reserved_balance);
  await query(
    conn,
    'UPDATE driver_wallets SET balance = balance + ? WHERE driver_id = ?',
    [amountString(amountVnd), Number(driverId)]
  );
  await query(
    conn,
    `INSERT INTO driver_wallet_transactions
      (driver_id, transaction_type, amount, note, created_by)
     VALUES (?, 'deposit', ?, ?, ?)`,
    [Number(driverId), amountString(amountVnd), description || 'Kế toán xác nhận đã nhận tiền ký quỹ', Number(actor.id)]
  );
  await writeAudit(conn, {
    actor, action: 'driver_wallet.deposit', entityType: 'driver_wallet', entityId: driverId,
    oldValue: { balance: amountString(oldBalance), reserved_balance: amountString(oldReserved) },
    newValue: { balance: amountString(addMoney(oldBalance, amountVnd)), reserved_balance: amountString(oldReserved), amount: amountString(amountVnd), note: description || null },
    ip
  });
  return {
    deposit_balance: amountString(addMoney(oldBalance, amountVnd)),
    reserved_balance: amountString(oldReserved),
    available_balance: amountString(subtractMoney(addMoney(oldBalance, amountVnd), oldReserved))
  };
}

module.exports = {
  createDriverRemittance,
  receiveDriverRemittance,
  createShopSettlement,
  setOrderFailureFee,
  depositDriverWallet
};
