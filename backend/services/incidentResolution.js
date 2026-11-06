'use strict';

const { query } = require('../utils/db');
const { addMoney, parseMoney, subtractMoney } = require('../utils/money');
const { OrderTransitionError, processDeliveryFailure } = require('./orderStateMachine');

const FAILURE_REASON_BY_INCIDENT = {
  customer_absent: 'DL_NOT_HOME',
  wrong_item: 'DL_GOODS_WRONG'
};

function incidentError(code, message, statusCode = 400) {
  return new OrderTransitionError(code, message, statusCode);
}

async function writeIncidentAudit(conn, actor, incidentId, status, oldValue, newValue, ip) {
  await query(conn, `INSERT INTO audit_logs
    (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, ip)
    VALUES (?, ?, ?, 'driver_incident', ?, ?, ?, ?)`, [
    Number(actor.id), actor.role, status === 'resolved' ? 'driver_incident.resolved' : 'driver_incident.acknowledged', String(incidentId),
    JSON.stringify(oldValue), JSON.stringify(newValue), ip || null
  ]);
}

async function resolveIncident(conn, {
  incidentId, status, faultParty, customerCompensationAmount = '0',
  shopCompensationAmount = '0', driverDeductionAmount = '0',
  salaryPenaltyAmount = '0', reviewNote = '', actor, ip = null
}) {
  if (!actor || !Number.isSafeInteger(Number(actor.id)) || !actor.role) {
    throw incidentError('INVALID_ACTOR', 'Tài khoản xử lý sự cố không hợp lệ.', 401);
  }
  const incidents = await query(conn, 'SELECT * FROM driver_incidents WHERE id = ? FOR UPDATE', [Number(incidentId)]);
  if (!incidents.length || incidents[0].status === 'resolved') {
    throw incidentError('INCIDENT_ALREADY_RESOLVED', 'Sự cố đã được xử lý hoặc không tồn tại.', 409);
  }
  const incident = incidents[0];
  const note = String(reviewNote || '').trim();
  const parties = ['customer', 'shop', 'driver', 'company', 'force_majeure'];
  if (!['acknowledged', 'resolved'].includes(status) || !parties.includes(faultParty)
    || note.length > 500 || (status === 'resolved' && note.length < 5)) {
    throw incidentError('INVALID_INCIDENT_REVIEW', 'Trạng thái, bên chịu trách nhiệm hoặc ghi chú xử lý không hợp lệ.');
  }

  const customerAmount = parseMoney(customerCompensationAmount);
  const shopAmount = parseMoney(shopCompensationAmount);
  const driverAmount = parseMoney(driverDeductionAmount);
  const salaryAmount = parseMoney(salaryPenaltyAmount);
  const totalCompensation = addMoney(customerAmount, shopAmount);
  const totalDriverCharge = addMoney(driverAmount, salaryAmount);
  const totalResolutionAmount = addMoney(totalCompensation, totalDriverCharge);
  const declaredValue = parseMoney(incident.declared_value || 0);
  if (status !== 'resolved' && (totalCompensation > 0n || totalDriverCharge > 0n)) {
    throw incidentError('INCIDENT_NOT_RESOLVED', 'Chỉ được ghi nhận bồi thường và khấu trừ khi giải quyết sự cố.');
  }
  if (totalResolutionAmount > declaredValue) {
    throw incidentError('INCIDENT_AMOUNT_EXCEEDS_VALUE', 'Tổng bồi thường và khấu trừ không được vượt giá trị hàng khai báo.');
  }
  if (totalDriverCharge > 0n && (faultParty !== 'driver' || !incident.driver_id)) {
    throw incidentError('DRIVER_NOT_LIABLE', 'Chỉ được khấu trừ khi lỗi chủ quan thuộc tài xế.');
  }
  if (incident.incident_type === 'damaged_goods' || incident.incident_type === 'lost_goods') {
    if (faultParty === 'driver' && !incident.driver_id) {
      throw incidentError('DRIVER_NOT_FOUND', 'Không thể quy trách nhiệm tài xế cho sự cố kho không gắn tài xế.');
    }
  }

  let orderTransition = null;
  const failureReason = FAILURE_REASON_BY_INCIDENT[incident.incident_type];
  if (status === 'resolved' && failureReason && incident.order_id) {
    const orders = await query(conn, 'SELECT id, status FROM orders WHERE id = ? FOR UPDATE', [incident.order_id]);
    if (!orders.length) throw incidentError('ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng của sự cố.', 404);
    if (orders[0].status === 'delivering') {
      if (!incident.driver_id) throw incidentError('DRIVER_NOT_FOUND', 'Không có tài xế gắn với sự cố giao hàng.', 409);
      const input = {
        orderId: incident.order_id,
        actor,
        reasonCode: incident.reason_code || failureReason,
        note,
        photoUrl: incident.evidence_url || null,
        lat: incident.lat,
        lng: incident.lng
      };
      orderTransition = await processDeliveryFailure(conn, input);
    }
  }

  if (driverAmount > 0n) {
    const wallets = await query(conn,
      'SELECT balance, reserved_balance FROM driver_wallets WHERE driver_id = ? FOR UPDATE',
      [Number(incident.driver_id)]);
    if (!wallets.length) throw incidentError('DRIVER_WALLET_NOT_FOUND', 'Không tìm thấy ví ký quỹ của tài xế.', 409);
    const balance = parseMoney(wallets[0].balance);
    const reserved = parseMoney(wallets[0].reserved_balance);
    if (subtractMoney(balance, reserved) < driverAmount) {
      throw incidentError('INSUFFICIENT_WALLET', 'Số dư ký quỹ khả dụng không đủ để khấu trừ.', 409);
    }
    await query(conn, 'UPDATE driver_wallets SET balance = balance - ? WHERE driver_id = ?',
      [driverAmount.toString(), Number(incident.driver_id)]);
    await query(conn, `INSERT INTO driver_wallet_transactions
      (driver_id, transaction_type, amount, note, created_by, incident_id)
      VALUES (?, 'deduction', ?, ?, ?, ?)`, [
      Number(incident.driver_id), driverAmount.toString(),
      `Bồi thường sự cố #${incidentId}: ${note}`.slice(0, 255), Number(actor.id), Number(incidentId)
    ]);
  }

  if (salaryAmount > 0n) {
    const payrollParts = new Intl.DateTimeFormat('en', {
      timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit'
    }).formatToParts(new Date());
    const payrollMonth = `${payrollParts.find((part) => part.type === 'year').value}-${payrollParts.find((part) => part.type === 'month').value}`;
    const periods = await query(conn, 'SELECT status FROM payroll_periods WHERE payroll_month = ? FOR UPDATE', [payrollMonth]);
    if (periods[0]?.status === 'locked') {
      throw incidentError('PAYROLL_PERIOD_LOCKED', `Kỳ lương ${payrollMonth} đã chốt; không thể thêm khoản phạt.`, 409);
    }
    await query(conn, `INSERT INTO employee_payroll_adjustments
      (user_id, payroll_month, adjustment_type, amount, reason, incident_id)
      VALUES (?, ?, 'deduction', ?, ?, ?)`, [
      Number(incident.driver_id), payrollMonth, salaryAmount.toString(),
      `Phạt sự cố #${incidentId}: ${note}`.slice(0, 255), Number(incidentId)
    ]);
  }

  const previous = {
    status: incident.status,
    fault_party: incident.fault_party,
    reason_code: incident.reason_code,
    customer_compensation_amount: String(incident.customer_compensation_amount || '0'),
    shop_compensation_amount: String(incident.shop_compensation_amount || '0'),
    driver_deduction_amount: String(incident.driver_deduction_amount || incident.claim_amount || '0'),
    salary_penalty_amount: String(incident.salary_penalty_amount || '0'),
    review_note: incident.review_note
  };
  const next = {
    status,
    fault_party: faultParty,
    customer_compensation_amount: customerAmount.toString(),
    shop_compensation_amount: shopAmount.toString(),
    driver_deduction_amount: driverAmount.toString(),
    salary_penalty_amount: salaryAmount.toString(),
    review_note: note || null
  };
  const updated = await query(conn, `UPDATE driver_incidents
    SET status = ?, fault_party = ?, customer_compensation_amount = ?,
      shop_compensation_amount = ?, driver_deduction_amount = ?, salary_penalty_amount = ?,
      claim_amount = ?, reviewed_by = ?, review_note = ?, resolved_at = ?
    WHERE id = ? AND status <> 'resolved'`, [
    status, faultParty, customerAmount.toString(), shopAmount.toString(),
    driverAmount.toString(), salaryAmount.toString(), driverAmount.toString(),
    Number(actor.id), note || null, status === 'resolved' ? new Date() : null, Number(incidentId)
  ]);

  if (!updated.affectedRows) throw incidentError('INCIDENT_ALREADY_RESOLVED', 'Sự cố vừa được xử lý bởi người khác.', 409);
  await writeIncidentAudit(conn, actor, incidentId, status, previous, {
    ...next,
    order_status: orderTransition?.finalStatus || null,
    order_delivery_attempts: orderTransition?.order?.delivery_attempts ?? null
  }, ip);
  return {
    incidentId: Number(incidentId),
    status,
    faultParty,
    customerCompensationAmount: customerAmount.toString(),
    shopCompensationAmount: shopAmount.toString(),
    driverDeductionAmount: driverAmount.toString(),
    salaryPenaltyAmount: salaryAmount.toString(),
    orderTransition
  };
}

module.exports = { FAILURE_REASON_BY_INCIDENT, incidentError, resolveIncident };
