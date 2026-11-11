import { describe, expect, it } from 'vitest';
import db from '../utils/db.js';
import money from '../utils/money.js';
import finance from '../services/codFinance.js';

const { withTransaction } = db;
const { addMoney, parseMoney, subtractMoney } = money;
const {
  createDriverRemittance,
  receiveDriverRemittance,
  createShopSettlement,
  depositDriverWallet
} = finance;

function createFinancePool(initialState = {}, options = {}) {
  const state = {
    driver: { id: 7 },
    shop: { id: 3 },
    orders: initialState.orders || [],
    remittances: initialState.remittances || [],
    reservations: initialState.reservations || [],
    wallet: initialState.wallet || { driver_id: 7, balance: '100', reserved_balance: '20' },
    settlements: [],
    audits: [],
    cycle: initialState.cycle || 'T+1'
  };
  const dispatch = (sql, values) => {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    if (options.failAudit && normalized.startsWith('insert into audit_logs')) {
      throw new Error('audit write failed');
    }
    if (normalized.startsWith('select id from users')) {
      return (values[1] === 'shop' || normalized.includes("role = 'shop'")) ? (state.shop ? [{ ...state.shop }] : [])
        : (state.driver ? [{ ...state.driver }] : []);
    }
    if (normalized.startsWith('select setting_value from system_settings')) {
      return [{ setting_value: state.cycle }];
    }
    if (normalized.startsWith('select o.id, o.cod_collected_amount')) {
      return state.orders.filter((order) => order.cod_remittance_id == null);
    }
    if (normalized.startsWith('insert into driver_cash_remittances')) {
      const row = {
        id: state.remittances.length + 1,
        driver_id: values[0],
        amount: values[1],
        work_date: values[2],
        expected_amount: values[3],
        variance_amount: values[4],
        variance_reason: values[5],
        status: 'pending'
      };
      state.remittances.push(row);
      return { insertId: row.id };
    }
    if (normalized.startsWith('update orders set cod_remittance_id')) {
      const remittanceId = values[0];
      const ids = values.slice(1).map(Number);
      const orders = state.orders.filter((order) => ids.includes(Number(order.id)) && order.cod_remittance_id == null);
      orders.forEach((order) => { order.cod_remittance_id = remittanceId; });
      return { affectedRows: orders.length };
    }
    if (normalized.startsWith('select o.id, case when o.partial_delivery_completed')) {
      return state.orders.filter((order) => (order.status === 'completed' || order.partial_delivery_completed)
        && order.cod_collected === 1 && !order.is_cod_paid && order.cod_settlement_id == null
        && (order.cod_payment_method === 'bank_transfer' || order.remittance_received))
        .map((order) => ({
          ...order,
          settle_cod_amount: order.partial_delivery_completed
            ? order.items.reduce((sum, item) => sum
              + Number(item.delivered_quantity) * Number(item.unit_cod_amount), 0)
            : order.cod_amount
        }));
    }
    if (normalized.startsWith('insert into cod_settlements')) {
      state.settlements.push(values);
      return { insertId: state.settlements.length };
    }
    if (normalized.startsWith('update orders set is_cod_paid')) {
      const settlementId = values[0];
      const ids = values.slice(1).map(Number);
      const orders = state.orders.filter((order) => ids.includes(Number(order.id))
        && order.cod_settlement_id == null && !order.is_cod_paid);
      orders.forEach((order) => {
        order.cod_settlement_id = settlementId;
        order.is_cod_paid = 1;
      });
      return { affectedRows: orders.length };
    }
    if (normalized.startsWith('select * from driver_cash_remittances')) {
      const row = state.remittances.find((item) => Number(item.id) === Number(values[0]));
      return row ? [{ ...row }] : [];
    }
    if (normalized.startsWith('select id from orders where cod_remittance_id')) {
      return state.orders.filter((order) => Number(order.cod_remittance_id) === Number(values[0]));
    }
    if (normalized.startsWith('select order_id, driver_id, amount from driver_wallet_reservations')) {
      const ids = values.map(Number);
      return state.reservations.filter((item) => ids.includes(Number(item.order_id)) && item.status === 'reserved');
    }
    if (normalized.startsWith('select balance, reserved_balance from driver_wallets')) {
      return state.wallet ? [{ ...state.wallet }] : [];
    }
    if (normalized.startsWith("update driver_wallet_reservations set status = 'released'")) {
      const reservation = state.reservations.find((item) => Number(item.order_id) === Number(values[0])
        && item.status === 'reserved');
      if (!reservation) return { affectedRows: 0 };
      reservation.status = 'released';
      return { affectedRows: 1 };
    }
    if (normalized.startsWith('update driver_wallets set reserved_balance = reserved_balance -')) {
      state.wallet.reserved_balance = subtractMoney(
        parseMoney(state.wallet.reserved_balance), parseMoney(values[0])
      ).toString();
      return { affectedRows: 1 };
    }
    if (normalized.startsWith('update driver_wallets set balance = balance +')) {
      state.wallet.balance = addMoney(
        parseMoney(state.wallet.balance), parseMoney(values[0])
      ).toString();
      return { affectedRows: 1 };
    }
    if (normalized.startsWith('insert into driver_wallets')) return { insertId: 1 };
    if (normalized.startsWith('insert into driver_wallet_transactions')) return { insertId: 1 };
    if (normalized.startsWith("update driver_cash_remittances set status = 'received'")) {
      const remittance = state.remittances.find((item) => Number(item.id) === Number(values[1]));
      if (!remittance || remittance.status !== 'pending') return { affectedRows: 0 };
      remittance.status = 'received';
      remittance.received_by = values[0];
      return { affectedRows: 1 };
    }
    if (normalized.startsWith('insert into audit_logs')) {
      state.audits.push(values);
      return { insertId: state.audits.length };
    }
    throw new Error(`Unexpected SQL in test: ${normalized}`);
  };

  let inUse = false;
  const waiting = [];
  const pool = {
    getConnection(callback) {
      const acquire = () => {
        inUse = true;
        let snapshot;
        const connection = {
          beginTransaction(done) {
            snapshot = JSON.parse(JSON.stringify(state));
            done(null);
          },
          commit(done) { done(null); },
          rollback(done) {
            Object.assign(state, snapshot);
            done(null);
          },
          release() {
            inUse = false;
            const next = waiting.shift();
            if (next) next();
          },
          query(sql, values, done) {
            let parameters = values;
            let completion = done;
            if (typeof values === 'function') {
              completion = values;
              parameters = [];
            }
            try {
              completion(null, dispatch(sql, parameters || []));
            } catch (error) {
              completion(error);
            }
          }
        };
        callback(null, connection);
      };
      if (inUse) waiting.push(acquire);
      else acquire();
    }
  };
  return { pool, state };
}

describe('COD financial transactions', () => {
  it.each([
    ['exact remittance', '140', '0'],
    ['short remittance', '130', '-10'],
    ['overage', '150', '10']
  ])('records expected, actual, and variance for a %s', async (_label, actualAmount, expectedVariance) => {
    const { pool, state } = createFinancePool({
      orders: [
        { id: 11, cod_collected_amount: '100', cod_remittance_id: null },
        { id: 12, cod_collected_amount: '40', cod_remittance_id: null }
      ]
    });
    const result = await withTransaction(pool, (conn) => createDriverRemittance(conn, {
      driverId: 7,
      workDate: '2026-01-12',
      actualAmount,
      varianceReason: expectedVariance === '0' ? '' : 'Chênh tiền đã kiểm đếm',
      actor: { id: 7, role: 'delivery_driver' },
      ip: '127.0.0.1'
    }));

    expect(result.expectedAmount).toBe('140');
    expect(result.varianceAmount).toBe(expectedVariance);
    expect(state.remittances[0]).toMatchObject({
      expected_amount: '140',
      amount: actualAmount,
      variance_amount: expectedVariance,
      status: 'pending'
    });
    expect(state.orders.every((order) => order.cod_remittance_id === result.remittanceId)).toBe(true);
  });

  it('rolls back the remittance and order reservation when a later write fails', async () => {
    const { pool, state } = createFinancePool({
      orders: [      { id: 11, cod_collected_amount: '80', cod_remittance_id: null }]
    }, { failAudit: true });

    await expect(withTransaction(pool, (conn) => createDriverRemittance(conn, {
      driverId: 7,
      workDate: '2026-01-12',
      actualAmount: '80',
      actor: { id: 7, role: 'delivery_driver' }
    }))).rejects.toThrow('audit write failed');

    expect(state.remittances).toHaveLength(0);
    expect(state.orders[0].cod_remittance_id).toBeNull();
  });

  it('requires an explanation for remittance variance', async () => {
    const { pool, state } = createFinancePool({
      orders: [{ id: 13, cod_collected_amount: '90', cod_remittance_id: null }]
    });

    await expect(withTransaction(pool, (conn) => createDriverRemittance(conn, {
      driverId: 7,
      workDate: '2026-01-12',
      actualAmount: '89',
      actor: { id: 7, role: 'delivery_driver' }
    }))).rejects.toMatchObject({ code: 'REMITTANCE_VARIANCE_REASON_REQUIRED' });
    expect(state.remittances).toHaveLength(0);
    expect(state.orders[0].cod_remittance_id).toBeNull();
  });

  it('updates the wallet and writes a matching audit entry when depositing', async () => {
    const { pool, state } = createFinancePool();
    const result = await withTransaction(pool, (conn) => depositDriverWallet(conn, {
      driverId: 7,
      amount: '25',
      note: 'Tiền ký quỹ đầu kỳ',
      actor: { id: 9, role: 'accountant' },
      ip: '127.0.0.1'
    }));

    expect(result).toEqual({
      deposit_balance: '125',
      reserved_balance: '20',
      available_balance: '105'
    });
    expect(state.wallet.balance).toBe('125');
    expect(state.audits).toHaveLength(1);
  });

  it('settles only completed eligible COD using exact cents and deducts recorded failure fees', async () => {
    const { pool, state } = createFinancePool({
      orders: [
        {
          id: 21, status: 'completed', cod_collected: 1, is_cod_paid: 0, cod_settlement_id: null,
          cod_payment_method: 'bank_transfer', cod_amount: '10000', shipping_fee: '1000',
          fee_payer: 'sender', service_fee: '250', insurance_fee: '50', failure_fee: '75',
          completion_date: '2026-01-10'
        },
        {
          id: 22, status: 'completed', cod_collected: 1, is_cod_paid: 0, cod_settlement_id: null,
          cod_payment_method: 'cash', remittance_received: true, cod_amount: '20000',
          shipping_fee: '900', fee_payer: 'receiver', service_fee: '500',
          insurance_fee: '100', failure_fee: '200', completion_date: '2026-01-11'
        },
        {
          id: 23, status: 'returned', cod_collected: 1, is_cod_paid: 0, cod_settlement_id: null,
          cod_payment_method: 'bank_transfer', cod_amount: '50000', shipping_fee: '0',
          fee_payer: 'sender', service_fee: '0', insurance_fee: '0', failure_fee: '0'
        }
      ]
    });
    const result = await withTransaction(pool, (conn) => createShopSettlement(conn, {
      shopId: 3,
      month: '2026-01',
      paymentMethod: 'bank_transfer',
      paymentReference: 'BANK-1',
      accountantId: 9,
      ip: '127.0.0.1'
    }));

    expect(result.orderCount).toBe(2);
    expect(result.totalPaid).toBe('27825');
    expect(result.totalFailureFee).toBe('275');
    expect(state.settlements[0]).toEqual(expect.arrayContaining([
      '30000', '1000', '750', '150', '275', '27825'
    ]));
    expect(state.orders[2].cod_settlement_id).toBeNull();
    expect(state.audits).toHaveLength(1);
  });

  it('keeps a negative Shop payable exact when fees exceed COD', async () => {
    const { pool } = createFinancePool({
      orders: [{
        id: 31, status: 'completed', cod_collected: 1, is_cod_paid: 0, cod_settlement_id: null,
        cod_payment_method: 'bank_transfer', cod_amount: '100', shipping_fee: '0',
        fee_payer: 'receiver', service_fee: '150', insurance_fee: '0', failure_fee: '0',
        completion_date: '2026-01-10'
      }]
    });
    const result = await withTransaction(pool, (conn) => createShopSettlement(conn, {
      shopId: 3,
      month: '2026-01',
      paymentMethod: 'bank_transfer',
      accountantId: 9
    }));

    expect(result.totalPaid).toBe('-50');
  });

  it('settles only the scanned COD for a partially delivered order whose remainder is returning', async () => {
    const { pool, state } = createFinancePool({
      orders: [{
        id: 35, status: 'return_pending', partial_delivery_completed: 1,
        items: [
          { delivered_quantity: 2, unit_cod_amount: '10000' },
          { delivered_quantity: 0, unit_cod_amount: '5000' }
        ],
        cod_collected: 1, is_cod_paid: 0, cod_settlement_id: null,
        cod_payment_method: 'bank_transfer', cod_amount: '30000', shipping_fee: '1000',
        fee_payer: 'sender', service_fee: '0', insurance_fee: '0', failure_fee: '0',
        completion_date: '2026-01-10'
      }]
    });
    const result = await withTransaction(pool, (conn) => createShopSettlement(conn, {
      shopId: 3,
      month: '2026-01',
      paymentMethod: 'bank_transfer',
      accountantId: 9
    }));

    expect(result.totalPaid).toBe('19000');
    expect(state.settlements[0][1]).toBe('20000');
    expect(state.orders[0].cod_settlement_id).toBe(result.settlementId);
  });

  it('allows only one of two concurrent confirmations and releases the reservation once', async () => {
    const { pool, state } = createFinancePool({
      orders: [{ id: 41, cod_remittance_id: 6 }],
      remittances: [{ id: 6, driver_id: 7, amount: '20', status: 'pending' }],
      reservations: [{ order_id: 41, driver_id: 7, amount: '20', status: 'reserved' }]
    });
    const confirm = () => withTransaction(pool, (conn) => receiveDriverRemittance(conn, {
      remittanceId: 6,
      accountantId: 9,
      ip: '127.0.0.1'
    }));
    const results = await Promise.allSettled([confirm(), confirm()]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const failure = results.find((result) => result.status === 'rejected');
    expect(failure.reason.message).toMatch(/Phiếu (nộp đã được xác nhận|vừa được xác nhận)/);
    expect(state.remittances[0].status).toBe('received');
    expect(state.reservations[0].status).toBe('released');
    expect(state.wallet.reserved_balance).toBe('0');
    expect(state.audits).toHaveLength(2);
  });
});
