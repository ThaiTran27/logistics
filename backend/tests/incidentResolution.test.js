import { describe, expect, it } from 'vitest';
import db from '../utils/db.js';
import incidentService from '../services/incidentResolution.js';

const { withTransaction } = db;
const { FAILURE_REASON_BY_INCIDENT, resolveIncident } = incidentService;

function createPool(seed = {}, options = {}) {
  const state = {
    incident: {
      id: 4, driver_id: 7, order_id: null, incident_type: 'damaged_goods',
      reason_code: null, fault_party: 'company', declared_value: '10000',
      claim_amount: '0', customer_compensation_amount: '0',
      shop_compensation_amount: '0', driver_deduction_amount: '0',
      salary_penalty_amount: '0', status: 'open', review_note: null,
      evidence_url: null, lat: null, lng: null, ...(seed.incident || {})
    },
    order: seed.order || null,
    reason: seed.reason || {
      code: 'DL_NOT_HOME', group_type: 'DELIVERY', allow_retry: 1,
      counts_attempt: 1, require_evidence: 1, description: 'Khách không có nhà'
    },
    wallet: seed.wallet || { balance: '50000', reserved_balance: '0' },
    walletTransactions: [],
    payrollAdjustments: [],
    orderEvents: [],
    audits: [],
    payrollPeriods: seed.payrollPeriods || []
  };

  const connection = {
    snapshot: null,
    beginTransaction(callback) {
      this.snapshot = structuredClone(state);
      callback(null);
    },
    commit(callback) { callback(null); },
    rollback(callback) {
      Object.keys(state).forEach((key) => delete state[key]);
      Object.assign(state, structuredClone(this.snapshot));
      callback(null);
    },
    release() {},
    query(sql, parameters, callback) {
      const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
      let result;
      if (normalized.startsWith('select * from driver_incidents')) {
        result = state.incident.id === Number(parameters[0]) ? [{ ...state.incident }] : [];
      } else if (normalized.startsWith('select id, status from orders')) {
        result = state.order?.id === Number(parameters[0])
          ? [{ id: state.order.id, status: state.order.status }] : [];
      } else if (normalized.startsWith('select * from orders')) {
        result = state.order?.id === Number(parameters[0]) ? [{ ...state.order }] : [];
      } else if (normalized.startsWith('select code, group_type')) {
        result = [state.reason];
      } else if (normalized.startsWith('select setting_value from system_settings')) {
        result = [{ setting_value: '3' }];
      } else if (normalized.startsWith('update orders set')) {
        const previousStatus = parameters[parameters.length - 1];
        const orderId = Number(parameters[parameters.length - 2]);
        if (!state.order || state.order.id !== orderId || state.order.status !== previousStatus) {
          result = { affectedRows: 0 };
        } else {
          state.order.status = parameters[0];
          if (normalized.includes('delivery_attempts = ?')) {
            const attemptIndex = normalized.includes('fail_reason = ?') ? 2 : 1;
            state.order.delivery_attempts = Number(parameters[attemptIndex]);
          }
          result = { affectedRows: 1 };
        }
      } else if (normalized.startsWith('insert into order_events')) {
        state.orderEvents.push(parameters);
        result = { insertId: state.orderEvents.length };
      } else if (normalized.startsWith('insert into order_status_history')) {
        result = { insertId: 1 };
      } else if (normalized.startsWith('select balance, reserved_balance from driver_wallets')) {
        result = state.wallet ? [{ ...state.wallet }] : [];
      } else if (normalized.startsWith('update driver_wallets set balance = balance -')) {
        state.wallet.balance = String(Number(state.wallet.balance) - Number(parameters[0]));
        result = { affectedRows: 1 };
      } else if (normalized.startsWith('insert into driver_wallet_transactions')) {
        state.walletTransactions.push(parameters);
        result = { insertId: state.walletTransactions.length };
      } else if (normalized.startsWith('select status from payroll_periods')) {
        result = state.payrollPeriods;
      } else if (normalized.startsWith('insert into employee_payroll_adjustments')) {
        state.payrollAdjustments.push(parameters);
        result = { insertId: state.payrollAdjustments.length };
      } else if (normalized.startsWith('update driver_incidents')) {
        state.incident.status = parameters[0];
        state.incident.fault_party = parameters[1];
        state.incident.customer_compensation_amount = parameters[2];
        state.incident.shop_compensation_amount = parameters[3];
        state.incident.driver_deduction_amount = parameters[4];
        state.incident.salary_penalty_amount = parameters[5];
        state.incident.claim_amount = parameters[6];
        state.incident.review_note = parameters[8];
        result = { affectedRows: 1 };
      } else if (normalized.startsWith('insert into audit_logs')) {
        if (options.failAudit) return callback(new Error('audit storage unavailable'));
        state.audits.push(parameters);
        result = { insertId: state.audits.length };
      } else {
        return callback(new Error(`Unexpected SQL in test: ${normalized}`));
      }
      callback(null, result);
    }
  };
  const pool = { getConnection(callback) { callback(null, connection); } };
  return { pool, state };
}

const actor = { id: 21, role: 'fleet_manager' };

describe('incident resolution', () => {
  it('maps absent-customer and wrong-item incidents to delivery reason codes', () => {
    expect(FAILURE_REASON_BY_INCIDENT).toEqual({
      customer_absent: 'DL_NOT_HOME',
      wrong_item: 'DL_GOODS_WRONG'
    });
  });

  it('records customer/shop compensation against declared value for a warehouse incident without a driver', async () => {
    const { pool, state } = createPool({
      incident: { driver_id: null, reported_by: 3, declared_value: '10000' }
    });
    const result = await withTransaction(pool, (conn) => resolveIncident(conn, {
      incidentId: 4, status: 'resolved', faultParty: 'company',
      customerCompensationAmount: '2500', shopCompensationAmount: '7500',
      reviewNote: 'Hư hỏng trong quá trình lưu kho', actor
    }));
    expect(result.customerCompensationAmount).toBe('2500');
    expect(state.incident.status).toBe('resolved');
    expect(state.incident.driver_id).toBeNull();
    expect(state.walletTransactions).toHaveLength(0);
    expect(state.audits).toHaveLength(1);
  });

  it('writes a deposit deduction and a payroll penalty for a driver-at-fault incident', async () => {
    const { pool, state } = createPool({
      incident: { incident_type: 'lost_goods', fault_party: 'company', declared_value: '9000' }
    });
    await withTransaction(pool, (conn) => resolveIncident(conn, {
      incidentId: 4, status: 'resolved', faultParty: 'driver',
      driverDeductionAmount: '5000', salaryPenaltyAmount: '2000',
      reviewNote: 'Tài xế xác nhận làm mất kiện hàng', actor
    }));
    expect(state.wallet.balance).toBe('45000');
    expect(state.walletTransactions).toHaveLength(1);
    expect(state.walletTransactions[0][4]).toBe(4);
    expect(state.payrollAdjustments).toHaveLength(1);
    expect(state.payrollAdjustments[0][2]).toBe('2000');
    expect(state.incident.claim_amount).toBe('5000');
    expect(state.audits).toHaveLength(1);
  });

  it('moves absent-customer delivery incidents through delivery_failed and counts the attempt', async () => {
    const { pool, state } = createPool({
      incident: {
        driver_id: 7, order_id: 12, incident_type: 'customer_absent',
        reason_code: 'DL_NOT_HOME', evidence_url: '/uploads/absent.jpg'
      },
      order: {
        id: 12, status: 'delivering', delivery_attempts: 0,
        delivery_shipper_id: 7, fail_reason: null
      }
    });
    const result = await withTransaction(pool, (conn) => resolveIncident(conn, {
      incidentId: 4, status: 'resolved', faultParty: 'customer',
      reviewNote: 'Khách vắng mặt đã xác minh', actor
    }));
    expect(state.order.status).toBe('at_central_warehouse');
    expect(state.order.delivery_attempts).toBe(1);
    expect(state.orderEvents).toHaveLength(2);
    expect(result.orderTransition.finalStatus).toBe('at_central_warehouse');
  });

  it('sends wrong-item deliveries to return instead of retrying', async () => {
    const { pool, state } = createPool({
      incident: {
        driver_id: 7, order_id: 12, incident_type: 'wrong_item',
        reason_code: 'DL_GOODS_WRONG', evidence_url: '/uploads/wrong-item.jpg'
      },
      reason: {
        code: 'DL_GOODS_WRONG', group_type: 'DELIVERY', allow_retry: 0,
        counts_attempt: 1, require_evidence: 1, description: 'Hàng giao không đúng đơn'
      },
      order: { id: 12, status: 'delivering', delivery_attempts: 1, delivery_shipper_id: 7 }
    });
    const result = await withTransaction(pool, (conn) => resolveIncident(conn, {
      incidentId: 4, status: 'resolved', faultParty: 'shop',
      reviewNote: 'Shop xác nhận giao nhầm hàng', actor
    }));
    expect(state.order.status).toBe('return_pending');
    expect(state.order.delivery_attempts).toBe(2);
    expect(result.orderTransition.finalStatus).toBe('return_pending');
  });

  it('rejects driver charges against non-driver fault and rolls back all writes if audit fails', async () => {
    const invalid = createPool();
    await expect(withTransaction(invalid.pool, (conn) => resolveIncident(conn, {
      incidentId: 4, status: 'resolved', faultParty: 'company',
      driverDeductionAmount: '1000', reviewNote: 'Không được quy lỗi tài xế', actor
    }))).rejects.toMatchObject({ code: 'DRIVER_NOT_LIABLE' });
    expect(invalid.state.walletTransactions).toHaveLength(0);

    const failing = createPool({ incident: { fault_party: 'driver' } }, { failAudit: true });
    await expect(withTransaction(failing.pool, (conn) => resolveIncident(conn, {
      incidentId: 4, status: 'resolved', faultParty: 'driver',
      driverDeductionAmount: '1000', reviewNote: 'Bằng chứng xác nhận lỗi', actor
    }))).rejects.toThrow('audit storage unavailable');
    expect(failing.state.incident.status).toBe('open');
    expect(failing.state.wallet.balance).toBe('50000');
    expect(failing.state.walletTransactions).toHaveLength(0);
  });

  it('does not allow compensation and driver charges together to exceed declared value', async () => {
    const { pool, state } = createPool({ incident: { declared_value: '10000' } });
    await expect(withTransaction(pool, (conn) => resolveIncident(conn, {
      incidentId: 4, status: 'resolved', faultParty: 'driver',
      shopCompensationAmount: '9000', driverDeductionAmount: '2000',
      reviewNote: 'Tổng vượt giá trị khai báo', actor
    }))).rejects.toMatchObject({ code: 'INCIDENT_AMOUNT_EXCEEDS_VALUE' });
    expect(state.walletTransactions).toHaveLength(0);
    expect(state.incident.status).toBe('open');
  });
});
