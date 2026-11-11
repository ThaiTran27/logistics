'use strict';

const { query, withTransaction } = require('../utils/db');
const {
  addMoney,
  calculatePercentage,
  multiplyMoney,
  parseMoney,
  subtractMoney
} = require('../utils/money');
const {
  calculatePayRuleAmount,
  selectPayRule
} = require('./payRuleCalculator');
const { findGovapWard } = require('../utils/govapArea');

const DRIVER_ROLES = new Set(['pickup_driver', 'delivery_driver']);
const EVENT_TYPES = new Map([
  ['completed', 'delivery_success'],
  ['partial_delivery_completed', 'delivery_success'],
  ['exchange_return_collected', 'return'],
  ['picked_up', 'pickup'],
  ['delivery_failed', 'failed_valid'],
  ['returning', 'return']
]);

function payrollError(message, statusCode = 400, code = 'PAYROLL_INVALID') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function dateOnly(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function validMonth(month) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

function rangeForMonth(month) {
  if (!validMonth(month)) throw payrollError('Tháng lương không hợp lệ.');
  const start = `${month}-01`;
  const endDate = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0));
  return { start, end: endDate.toISOString().slice(0, 10) };
}

function roundRatio(numerator, denominator) {
  if (denominator <= 0n) throw payrollError('Mẫu số tính lương phải lớn hơn 0.', 500, 'PAYROLL_CONFIG_INVALID');
  // Round half up to the nearest whole VND so fractional daily salary is deterministic.
  return (numerator + denominator / 2n) / denominator;
}

function percentageRate(numerator, denominator) {
  if (!denominator) return null;
  const basisPoints = roundRatio(BigInt(numerator) * 10000n, BigInt(denominator));
  return Math.min(100, Number(basisPoints) / 100);
}

function addLine(lines, lineType, description, amount, details = {}) {
  const value = parseMoney(amount, { allowNegative: true });
  lines.push({
    line_type: lineType,
    description,
    amount: value.toString(),
    order_id: details.orderId || null,
    source_type: details.sourceType || null,
    source_id: details.sourceId || null,
    rule_id: details.ruleId || null,
    detail: details.detail || null,
    affects_net: details.affectsNet !== false
  });
}

function salaryForDate(history, date) {
  const effective = history
    .filter((row) => dateOnly(row.effective_from) <= date
      && (!row.effective_to || dateOnly(row.effective_to) >= date))
    .sort((left, right) => dateOnly(right.effective_from).localeCompare(dateOnly(left.effective_from)));
  return effective[0] || null;
}

function eventContext(event) {
  const isPickup = ['picked_up', 'returning', 'exchange_return_collected'].includes(event.to_status);
  const latitude = isPickup ? event.shop_lat : event.receiver_lat;
  const longitude = isPickup ? event.shop_lng : event.receiver_lng;
  const ward = findGovapWard(latitude, longitude);
  return {
    userId: Number(event.user_id),
    eventType: EVENT_TYPES.get(event.to_status),
    areaCode: ward?.properties?.codeName || event.area_code || 'GOVAP_ALL',
    eventDate: dateOnly(event.created_at),
    eventTime: event.created_at instanceof Date
      ? event.created_at.toTimeString().slice(0, 8)
      : String(event.created_at).slice(11, 19),
    weightKg: event.weight_kg || 0,
    basisAmount: event.item_value || 0
  };
}

function buildPayrollSnapshot({
  employee,
  salaryHistory = [],
  fallbackSalary = null,
  attendanceDates = [],
  events = [],
  rules = [],
  bonusRules = [],
  adjustments = [],
  payrollDeductions = [],
  incidents = [],
  month,
  expectedWorkdays = 26,
  holidayDates = new Set()
}) {
  const { start, end } = rangeForMonth(month);
  const activeSalary = (date) => salaryForDate(salaryHistory, date)
    || (salaryHistory.length === 0 ? fallbackSalary : null);
  const uniqueAttendanceDates = [...new Set(attendanceDates.map(dateOnly))]
    .filter((date) => date >= start && date <= end);
  const lines = [];
  const salaryDayTotals = new Map();

  for (const date of uniqueAttendanceDates) {
    const salary = activeSalary(date);
    if (!salary) continue;
    const salaryAmount = parseMoney(salary.monthly_salary || 0);
    const allowanceAmount = parseMoney(salary.allowance || 0);
    salaryDayTotals.set('salary', (salaryDayTotals.get('salary') || 0n) + salaryAmount);
    salaryDayTotals.set('allowance', (salaryDayTotals.get('allowance') || 0n) + allowanceAmount);
  }
  const expectedDays = BigInt(Number(expectedWorkdays));
  const baseSalary = roundRatio(salaryDayTotals.get('salary') || 0n, expectedDays);
  const baseAllowance = roundRatio(salaryDayTotals.get('allowance') || 0n, expectedDays);
  addLine(lines, 'base_salary', 'Lương cơ bản theo ngày công', baseSalary, {
    detail: { attendance_days: uniqueAttendanceDates.length, expected_workdays: Number(expectedWorkdays) }
  });
  if (baseAllowance > 0n) addLine(lines, 'allowance', 'Phụ cấp theo ngày công', baseAllowance);

  const tenureSalary = activeSalary(end) || fallbackSalary;
  const tenureYears = Number(employee.tenure_years || 0);
  if (tenureSalary && tenureYears > 0) {
    const raisePercent = tenureSalary.tenure_raise_percent || 0;
    const tenureBonus = calculatePercentage(baseSalary, raisePercent, tenureYears);
    if (tenureBonus > 0n) addLine(lines, 'tenure_bonus', 'Phụ trội thâm niên', tenureBonus);
  }

  const completedEvents = events.filter((event) => (
    event.to_status === 'completed' || event.to_status === 'partial_delivery_completed'
  ));
  const failedEvents = events.filter((event) => event.to_status === 'delivery_failed');
  const deliveryCount = completedEvents.length;
  const deliveryAttemptCount = deliveryCount + failedEvents.length;
  const onTimeEvents = completedEvents.filter((event) => event.promised_delivery_at);
  const onTimeCount = onTimeEvents.filter((event) => (
    new Date(event.created_at).getTime() <= new Date(event.promised_delivery_at).getTime()
  )).length;
  const successRate = percentageRate(deliveryCount, deliveryAttemptCount);
  const onTimeRate = percentageRate(onTimeCount, onTimeEvents.length);
  const attendanceRate = percentageRate(uniqueAttendanceDates.length, Number(expectedWorkdays));

  for (const event of events) {
    const salary = activeSalary(dateOnly(event.created_at));
    if (['completed', 'partial_delivery_completed'].includes(event.to_status) && salary) {
      const perDelivery = parseMoney(salary.bonus_per_delivery || 0);
      if (perDelivery > 0n) addLine(lines, 'delivery_bonus', 'Thưởng đơn giao thành công', perDelivery, {
        orderId: event.order_id,
        sourceType: 'order_event',
        sourceId: event.id
      });
      const commission = calculatePercentage(event.item_value || 0, salary.commission_rate || 0);
      if (commission > 0n) addLine(lines, 'commission', 'Hoa hồng theo giá trị đơn', commission, {
        orderId: event.order_id,
        sourceType: 'order_event',
        sourceId: event.id
      });
    }

    const validPaidFailure = event.to_status === 'delivery_failed'
      && Number(event.pay_driver_fail_fee) === 1
      && Boolean(event.photo_url);
    if (event.to_status === 'delivery_failed' && !validPaidFailure) continue;
    const context = eventContext(event);
    const rule = selectPayRule(rules, context);
    if (!rule) continue;
    const amount = calculatePayRuleAmount(rule, context.basisAmount, holidayDates.has(context.eventDate));
    if (amount > 0n) addLine(lines, `event_${context.eventType}`, `Thù lao sự kiện: ${context.eventType}`, amount, {
      orderId: event.order_id,
      sourceType: 'order_event',
      sourceId: event.id,
      ruleId: rule.id,
      detail: { event_date: context.eventDate, reason_code: event.reason_code || null }
    });
  }

  for (const bonusRule of bonusRules) {
    let metricValue = null;
    if (bonusRule.metric_type === 'delivery_success_rate') metricValue = successRate;
    if (bonusRule.metric_type === 'delivery_count') metricValue = deliveryCount;
    if (bonusRule.metric_type === 'on_time_rate') metricValue = onTimeRate;
    if (bonusRule.metric_type === 'attendance_rate') metricValue = attendanceRate;
    if (metricValue === null || metricValue === undefined
      || Number(metricValue) < Number(bonusRule.minimum_value)) continue;
    addLine(lines, 'performance_bonus', bonusRule.description, bonusRule.reward_amount, {
      sourceType: 'payroll_bonus_rule',
      sourceId: bonusRule.id,
      detail: { metric_type: bonusRule.metric_type, metric_value: metricValue }
    });
  }

  for (const adjustment of adjustments) {
    const isDeduction = adjustment.adjustment_type === 'deduction';
    addLine(lines, isDeduction ? 'manual_deduction' : 'manual_bonus',
      adjustment.reason, adjustment.amount, {
        sourceType: 'payroll_adjustment',
        sourceId: adjustment.id,
        detail: { adjustment_type: adjustment.adjustment_type }
      });
  }

  for (const incident of incidents) {
    const chargedFromWallet = Number(incident.wallet_deduction_already_applied) === 1;
    addLine(
      lines,
      chargedFromWallet ? 'wallet_incident_deduction' : 'incident_deduction',
      chargedFromWallet
        ? `Bồi thường sự cố #${incident.id} đã trừ từ ký quỹ`
        : `Khoản phạt sự cố đã xác minh #${incident.id}`,
      incident.claim_amount,
      {
        sourceType: 'driver_incident',
        sourceId: incident.id,
        affectsNet: !chargedFromWallet,
        detail: {
          affects_net: !chargedFromWallet,
          note: chargedFromWallet
            ? 'Đã khấu trừ từ ví ký quỹ; không trừ lương lần hai.'
            : 'Sự cố đã được xác minh; khoản này được khấu trừ trong kỳ lương.'
        }
      }
    );
  }

  const grossAmount = lines.reduce((sum, line) => (
    line.affects_net && !line.line_type.endsWith('_deduction')
      ? addMoney(sum, line.amount)
      : sum
  ), 0n);
  let deductionAmount = lines.reduce((sum, line) => (
    line.affects_net && line.line_type.endsWith('_deduction')
      ? addMoney(sum, line.amount)
      : sum
  ), 0n);
  let availableForRepayment = grossAmount > deductionAmount
    ? subtractMoney(grossAmount, deductionAmount)
    : 0n;
  const deductionsToApply = [];
  for (const deduction of payrollDeductions) {
    if (availableForRepayment <= 0n) break;
    const remaining = parseMoney(deduction.remaining_amount);
    const applied = remaining < availableForRepayment ? remaining : availableForRepayment;
    if (applied <= 0n) continue;
    deductionsToApply.push({ id: Number(deduction.id), deduction_type: deduction.deduction_type, amount: applied });
    addLine(
      lines,
      deduction.deduction_type === 'security_deposit' ? 'security_deposit' : 'advance_repayment',
      deduction.deduction_type === 'security_deposit' ? deduction.reason : `Hoàn ứng: ${deduction.reason}`,
      applied,
      { sourceType: 'payroll_deduction', sourceId: deduction.id }
    );
    deductionAmount = addMoney(deductionAmount, applied);
    availableForRepayment = subtractMoney(availableForRepayment, applied);
  }

  const netAmount = subtractMoney(grossAmount, deductionAmount, { allowNegative: true });
  return {
    user_id: Number(employee.id),
    gross_amount: grossAmount.toString(),
    deduction_amount: deductionAmount.toString(),
    net_amount: netAmount.toString(),
    lines,
    deductions_to_apply: deductionsToApply,
    snapshot: {
      month,
      attendance_days: uniqueAttendanceDates.length,
      expected_workdays: Number(expectedWorkdays),
      delivery_count: deliveryCount,
      delivery_attempt_count: deliveryAttemptCount,
      delivery_success_rate: successRate,
      on_time_delivery_count: onTimeCount,
      on_time_delivery_counted: onTimeEvents.length,
      on_time_rate: onTimeRate,
      attendance_rate: attendanceRate
    }
  };
}

async function getPayrollData(conn, month, { forUpdate = false } = {}) {
  const { start, end } = rangeForMonth(month);
  const lock = forUpdate ? ' FOR UPDATE' : '';
  const employees = await query(conn, `SELECT id, full_name, email, role, created_at FROM users WHERE role <> 'customer' ORDER BY id${lock}`);
  const ids = employees.map((employee) => Number(employee.id));
  if (!ids.length) return { employees, snapshots: [] };
  const placeholders = ids.map(() => '?').join(',');
  const [salaryRows, attendanceRows, events, rules, bonusRules, adjustments, deductions, incidents, settings, holidays] = await Promise.all([
    query(conn, `SELECT * FROM employee_salary_history
      WHERE effective_from <= LAST_DAY(CONCAT(?, '-01'))
        AND (effective_to IS NULL OR effective_to >= CONCAT(?, '-01'))
      ORDER BY user_id, effective_from${lock}`, [month, month]),
    query(conn, `SELECT id, user_id, work_date FROM attendance_records
      WHERE user_id IN (${placeholders}) AND work_date BETWEEN ? AND ?
      ORDER BY user_id, work_date, id${lock}`, [...ids, start, end]),
    query(conn, `SELECT e.id, e.order_id, e.actor_id AS user_id, e.actor_role, e.to_status,
        e.reason_code, e.photo_url, e.created_at,
        CASE
          WHEN e.to_status = 'exchange_return_collected'
            THEN COALESCE((SELECT SUM(i.quantity * i.unit_value)
              FROM order_items i WHERE i.order_id = o.id AND i.direction = 'exchange_in'), 0)
          WHEN e.to_status = 'completed' AND o.partial_delivery_completed = 1
            THEN COALESCE((SELECT SUM(i.delivered_quantity * i.unit_value)
              FROM order_items i WHERE i.order_id = o.id AND i.direction = 'outbound'), 0)
          ELSE o.item_value END AS item_value,
        o.weight_kg,
        o.receiver_lat, o.receiver_lng, o.shop_lat, o.shop_lng,
        o.promised_delivery_at,
        rc.pay_driver_fail_fee, rc.require_evidence
      FROM order_events e
      JOIN orders o ON o.id = e.order_id
      LEFT JOIN reason_codes rc ON rc.code = e.reason_code
      WHERE e.actor_id IN (${placeholders})
        AND e.actor_role IN ('pickup_driver','delivery_driver','driver')
        AND e.created_at >= CONCAT(?, '-01')
        AND e.created_at < DATE_ADD(CONCAT(?, '-01'), INTERVAL 1 MONTH)
        AND e.to_status IN ('completed','partial_delivery_completed','picked_up','delivery_failed','returning','exchange_return_collected')
      ORDER BY e.actor_id, e.created_at, e.id${lock}`, [...ids, month, month]),
    query(conn, `SELECT * FROM pay_rules
      WHERE effective_from <= LAST_DAY(CONCAT(?, '-01'))
        AND (effective_to IS NULL OR effective_to >= CONCAT(?, '-01'))
      ORDER BY effective_from, id${lock}`, [month, month]),
    query(conn, `SELECT * FROM payroll_bonus_rules
      WHERE is_active = 1 AND effective_from <= LAST_DAY(CONCAT(?, '-01'))
        AND (effective_to IS NULL OR effective_to >= CONCAT(?, '-01'))
      ORDER BY metric_type, minimum_value, id${lock}`, [month, month]),
    query(conn, `SELECT * FROM employee_payroll_adjustments
      WHERE user_id IN (${placeholders}) AND payroll_month = ?
      ORDER BY user_id, id${lock}`, [...ids, month]),
    query(conn, `SELECT * FROM payroll_deductions
      WHERE user_id IN (${placeholders}) AND status = 'open' AND remaining_amount > 0
      ORDER BY user_id, id${lock}`, ids),
    query(conn, `SELECT i.id, i.driver_id, i.claim_amount, i.resolved_at,
        EXISTS (
          SELECT 1 FROM driver_wallet_transactions t
          WHERE t.driver_id = i.driver_id AND t.transaction_type = 'deduction'
            AND t.note LIKE CONCAT('%#', i.id, ':%')
        ) AS wallet_deduction_already_applied
      FROM driver_incidents i
      WHERE i.driver_id IN (${placeholders}) AND i.status = 'resolved'
        AND i.claim_amount > 0
        AND i.resolved_at >= CONCAT(?, '-01')
        AND i.resolved_at < DATE_ADD(CONCAT(?, '-01'), INTERVAL 1 MONTH)
      ORDER BY i.driver_id, i.id${lock}`, [...ids, month, month]),
    query(conn, "SELECT setting_key, setting_value FROM system_settings WHERE setting_key = 'PAYROLL_EXPECTED_WORKDAYS'"),
    query(conn, "SELECT setting_value FROM system_settings WHERE setting_key = 'HOLIDAY_DATES'")
  ]);
  const fallbackRows = await query(conn, `SELECT * FROM employee_salaries WHERE user_id IN (${placeholders}) ORDER BY user_id${lock}`, ids);
  let holidayDates = new Set();
  if (holidays.length) {
    let parsed;
    try {
      parsed = JSON.parse(holidays[0].setting_value);
    } catch (error) {
      throw payrollError(`Cấu hình HOLIDAY_DATES không hợp lệ: ${error.message}`, 500, 'PAYROLL_CONFIG_INVALID');
    }
    if (!Array.isArray(parsed) || parsed.some((date) => !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
      throw payrollError('Cấu hình HOLIDAY_DATES không hợp lệ.', 500, 'PAYROLL_CONFIG_INVALID');
    }
    holidayDates = new Set(parsed);
  }
  const expectedWorkdays = Number(settings[0]?.setting_value || 26);
  if (!Number.isSafeInteger(expectedWorkdays) || expectedWorkdays <= 0 || expectedWorkdays > 31) {
    throw payrollError('PAYROLL_EXPECTED_WORKDAYS phải là số nguyên từ 1 đến 31.', 500, 'PAYROLL_CONFIG_INVALID');
  }
  const salaryByUser = new Map();
  for (const salary of salaryRows) {
    const rows = salaryByUser.get(Number(salary.user_id)) || [];
    rows.push(salary);
    salaryByUser.set(Number(salary.user_id), rows);
  }
  const fallbackByUser = new Map(fallbackRows.map((row) => [Number(row.user_id), row]));
  const attendanceByUser = new Map();
  for (const record of attendanceRows) {
    const rows = attendanceByUser.get(Number(record.user_id)) || [];
    rows.push(dateOnly(record.work_date));
    attendanceByUser.set(Number(record.user_id), rows);
  }
  const eventsByUser = new Map();
  for (const event of events) {
    const rows = eventsByUser.get(Number(event.user_id)) || [];
    rows.push(event);
    eventsByUser.set(Number(event.user_id), rows);
  }
  const adjustmentsByUser = new Map();
  for (const adjustment of adjustments) {
    const rows = adjustmentsByUser.get(Number(adjustment.user_id)) || [];
    rows.push(adjustment);
    adjustmentsByUser.set(Number(adjustment.user_id), rows);
  }
  const deductionsByUser = new Map();
  for (const deduction of deductions) {
    const rows = deductionsByUser.get(Number(deduction.user_id)) || [];
    rows.push(deduction);
    deductionsByUser.set(Number(deduction.user_id), rows);
  }
  const incidentsByUser = new Map();
  for (const incident of incidents) {
    const rows = incidentsByUser.get(Number(incident.driver_id)) || [];
    rows.push(incident);
    incidentsByUser.set(Number(incident.driver_id), rows);
  }
  const snapshots = employees.map((employee) => {
    const employeeId = Number(employee.id);
    const years = Math.max(0, new Date(`${end}T00:00:00Z`).getUTCFullYear()
      - new Date(employee.created_at).getUTCFullYear());
    return buildPayrollSnapshot({
      employee: { ...employee, tenure_years: years },
      salaryHistory: salaryByUser.get(employeeId) || [],
      fallbackSalary: fallbackByUser.get(employeeId) || null,
      attendanceDates: attendanceByUser.get(employeeId) || [],
      events: eventsByUser.get(employeeId) || [],
      rules,
      bonusRules: bonusRules.filter((rule) => DRIVER_ROLES.has(employee.role)
        || rule.metric_type === 'attendance_rate'),
      adjustments: adjustmentsByUser.get(employeeId) || [],
      payrollDeductions: DRIVER_ROLES.has(employee.role) ? deductionsByUser.get(employeeId) || [] : [],
      incidents: DRIVER_ROLES.has(employee.role) ? incidentsByUser.get(employeeId) || [] : [],
      month,
      expectedWorkdays,
      holidayDates
    });
  });
  return { employees, snapshots, deductionsByUser };
}

async function closePayrollPeriod(pool, month, actor) {
  const { start, end } = rangeForMonth(month);
  return withTransaction(pool, async (conn) => {
    await query(conn, `INSERT INTO payroll_periods (payroll_month, opened_by)
      VALUES (?, ?) ON DUPLICATE KEY UPDATE payroll_month = VALUES(payroll_month)`, [month, actor.id]);
    const periods = await query(conn, 'SELECT * FROM payroll_periods WHERE payroll_month = ? FOR UPDATE', [month]);
    const period = periods[0];
    if (period.status === 'locked') {
      throw payrollError('Kỳ lương đã chốt, không thể chốt lần nữa.', 409, 'PAYROLL_PERIOD_LOCKED');
    }
    const { snapshots } = await getPayrollData(conn, month, { forUpdate: true });
    if (snapshots.length === 0) {
      throw payrollError('Không có nhân viên để tạo bảng lương.', 409, 'PAYROLL_EMPTY');
    }
    const payrollTotals = snapshots.reduce((totals, snapshot) => ({
      gross: addMoney(totals.gross, snapshot.gross_amount),
      deductions: addMoney(totals.deductions, snapshot.deduction_amount),
      net: addMoney(totals.net, snapshot.net_amount, { allowNegative: true })
    }), { gross: 0n, deductions: 0n, net: 0n });

    for (const snapshot of snapshots) {
      const inserted = await query(conn, `INSERT INTO payslips
        (payroll_period_id, user_id, gross_amount, deduction_amount, net_amount, snapshot_json)
        VALUES (?, ?, ?, ?, ?, ?)`, [
        period.id,
        snapshot.user_id,
        snapshot.gross_amount,
        snapshot.deduction_amount,
        snapshot.net_amount,
        JSON.stringify(snapshot.snapshot)
      ]);
      for (const line of snapshot.lines) {
        await query(conn, `INSERT INTO payslip_lines
          (payslip_id, line_type, description, amount, order_id, source_type, source_id, rule_id, detail_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
          inserted.insertId, line.line_type, line.description, line.amount, line.order_id,
          line.source_type, line.source_id, line.rule_id,
          line.detail ? JSON.stringify(line.detail) : null
        ]);
      }
      for (const deduction of snapshot.deductions_to_apply) {
        const deductionRows = await query(conn,
          'SELECT * FROM payroll_deductions WHERE id = ? FOR UPDATE', [deduction.id]);
        if (!deductionRows.length || deductionRows[0].status !== 'open') {
          throw payrollError('Khoản khấu trừ đã thay đổi trong lúc chốt lương; giao dịch đã hủy.', 409, 'PAYROLL_DEDUCTION_CHANGED');
        }
        const remaining = subtractMoney(deductionRows[0].remaining_amount, deduction.amount);
        await query(conn, `UPDATE payroll_deductions
          SET remaining_amount = ?, status = ?, settled_at = ?
          WHERE id = ? AND status = 'open'`, [
          remaining.toString(),
          remaining === 0n ? 'settled' : 'open',
          remaining === 0n ? new Date() : null,
          deduction.id
        ]);
        if (deduction.deduction_type === 'security_deposit') {
          const walletRows = await query(conn, 'SELECT balance FROM driver_wallets WHERE driver_id = ? FOR UPDATE', [snapshot.user_id]);
          if (!walletRows.length) throw payrollError(`Không tìm thấy ví ký quỹ của tài xế #${snapshot.user_id}.`, 409, 'DRIVER_WALLET_NOT_FOUND');
          const walletBalance = addMoney(walletRows[0].balance, deduction.amount);
          await query(conn, 'UPDATE driver_wallets SET balance = ? WHERE driver_id = ?', [walletBalance.toString(), snapshot.user_id]);
          await query(conn, `INSERT INTO driver_wallet_transactions
            (driver_id, transaction_type, amount, note, created_by)
            VALUES (?, 'deposit', ?, ?, ?)`, [
            snapshot.user_id, deduction.amount.toString(),
            `Khấu trừ ký quỹ từ phiếu lương ${month}`.slice(0, 255), actor.id
          ]);
        }
      }
    }
    await query(conn, `UPDATE payroll_periods
      SET status = 'locked', locked_by = ?, locked_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'open'`, [actor.id, period.id]);
    await query(conn, `INSERT INTO audit_logs
      (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, ip)
      VALUES (?, ?, 'payroll.period.locked', 'payroll_period', ?, ?, ?, ?)`, [
      actor.id,
      actor.role,
      String(period.id),
      JSON.stringify({ status: 'open', payroll_month: month }),
      JSON.stringify({
        status: 'locked',
        payroll_month: month,
        payslip_count: snapshots.length,
        gross_amount: payrollTotals.gross.toString(),
        deduction_amount: payrollTotals.deductions.toString(),
        net_amount: payrollTotals.net.toString()
      }),
      actor.ip || null
    ]);
    return { period_id: period.id, payroll_month: month, status: 'locked', payslip_count: snapshots.length, start, end };
  });
}

module.exports = {
  buildPayrollSnapshot,
  closePayrollPeriod,
  payrollError,
  rangeForMonth,
  validMonth
};
