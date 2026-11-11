import { describe, expect, it } from 'vitest';
import payroll from '../services/payroll.js';

const { buildPayrollSnapshot } = payroll;

function attendanceDays(count) {
  return Array.from({ length: count }, (_, index) => `2026-04-${String(index + 1).padStart(2, '0')}`);
}

const employee = { id: 9, role: 'delivery_driver', tenure_years: 0 };
const salary = {
  monthly_salary: '2600000',
  allowance: '260000',
  bonus_per_delivery: '1000',
  commission_rate: '1',
  tenure_raise_percent: '0',
  effective_from: '2026-01-01',
  effective_to: null
};
const rules = [
  { id: 1, event_type: 'delivery_success', area_code: 'GOVAP_ALL', min_weight_kg: 0, amount_vnd: '5000', percent_rate: null, effective_from: '2026-01-01', effective_to: '2026-04-14' },
  { id: 2, event_type: 'delivery_success', area_code: 'GOVAP_ALL', min_weight_kg: 0, amount_vnd: '7000', percent_rate: null, effective_from: '2026-04-15', effective_to: null },
  { id: 3, event_type: 'pickup', area_code: 'GOVAP_ALL', min_weight_kg: 0, amount_vnd: '3000', percent_rate: null, effective_from: '2026-01-01', effective_to: null },
  { id: 4, event_type: 'failed_valid', area_code: 'GOVAP_ALL', min_weight_kg: 0, amount_vnd: '2500', percent_rate: null, effective_from: '2026-01-01', effective_to: null }
];
const events = [
  { id: 10, order_id: 101, user_id: 9, to_status: 'completed', created_at: '2026-04-01 10:00:00', promised_delivery_at: '2026-04-02 18:00:00', item_value: '10000', weight_kg: 1, lat: 10.82, lng: 106.68 },
  { id: 11, order_id: 102, user_id: 9, to_status: 'completed', created_at: '2026-04-30 10:00:00', promised_delivery_at: '2026-04-29 18:00:00', item_value: '10000', weight_kg: 1, lat: 10.82, lng: 106.68 },
  { id: 12, order_id: 103, user_id: 9, to_status: 'picked_up', created_at: '2026-04-01 08:00:00', item_value: '0', weight_kg: 1, lat: 10.82, lng: 106.68 },
  { id: 13, order_id: 104, user_id: 9, to_status: 'delivery_failed', reason_code: 'DL_NO_CONTACT', pay_driver_fail_fee: 1, photo_url: null, signature_image: null, created_at: '2026-04-03 11:00:00', item_value: '0', weight_kg: 1, lat: 10.82, lng: 106.68 }
];
const bonusRules = [
  { id: 1, metric_type: 'delivery_success_rate', minimum_value: '60', reward_amount: '500', description: 'Success rate' },
  { id: 2, metric_type: 'delivery_count', minimum_value: '2', reward_amount: '1000', description: 'Production' },
  { id: 3, metric_type: 'on_time_rate', minimum_value: '50', reward_amount: '200', description: 'On time' },
  { id: 4, metric_type: 'attendance_rate', minimum_value: '50', reward_amount: '300', description: 'Attendance' }
];

function build(extra = {}) {
  return buildPayrollSnapshot({
    employee,
    salaryHistory: [salary],
    attendanceDates: attendanceDays(13),
    events,
    rules,
    bonusRules,
    adjustments: [
      { id: 1, adjustment_type: 'bonus', amount: '10000', reason: 'Special bonus' },
      { id: 2, adjustment_type: 'deduction', amount: '2000', reason: 'Uniform' }
    ],
    payrollDeductions: [
      { id: 1, deduction_type: 'security_deposit', amount: '50000', remaining_amount: '50000', reason: 'Deposit contribution' },
      { id: 2, deduction_type: 'advance', amount: '100000', remaining_amount: '100000', reason: 'Advance' }
    ],
    incidents: [],
    month: '2026-04',
    expectedWorkdays: 26,
    ...extra
  });
}

describe('payroll snapshots', () => {
  it('calculates attendance, effective rules, bonuses and deductions with an auditable total', () => {
    const snapshot = build();

    expect(snapshot.gross_amount).toBe('1459200');
    expect(snapshot.deduction_amount).toBe('152000');
    expect(snapshot.net_amount).toBe('1307200');
    expect(snapshot.snapshot).toMatchObject({
      attendance_days: 13,
      delivery_count: 2,
      delivery_attempt_count: 3,
      delivery_success_rate: 66.67,
      on_time_delivery_count: 1,
      on_time_delivery_counted: 2,
      attendance_rate: 50
    });
    expect(snapshot.lines.filter((line) => line.line_type.startsWith('event_delivery_success')).map((line) => line.amount))
      .toEqual(['5000', '7000']);
    expect(snapshot.lines.some((line) => line.source_id === 13)).toBe(false);
    expect(snapshot.deductions_to_apply).toEqual([
      { id: 1, deduction_type: 'security_deposit', amount: 50000n },
      { id: 2, deduction_type: 'advance', amount: 100000n }
    ]);
  });

  it('pays a valid failed-delivery fee only when evidence is present and the code is eligible', () => {
    const validFailedEvent = {
      ...events[3], id: 20, order_id: 200, photo_url: '/uploads/failure.jpg'
    };
    const withValidFailure = build({ events: [...events, validFailedEvent] });
    const failedLine = withValidFailure.lines.find((line) => line.source_id === 20);
    expect(failedLine?.amount).toBe('2500');

    const ineligibleEvent = {
      ...validFailedEvent, id: 21, order_id: 201, pay_driver_fail_fee: 0
    };
    const withoutEligibleFee = build({ events: [...events, ineligibleEvent] });
    expect(withoutEligibleFee.lines.some((line) => line.source_id === 21)).toBe(false);
  });

  it('records wallet-settled incident compensation without deducting wages twice', () => {
    const snapshot = build({
      incidents: [{ id: 88, claim_amount: '25000', wallet_deduction_already_applied: 1 }]
    });
    const incidentLine = snapshot.lines.find((line) => line.line_type === 'wallet_incident_deduction');
    expect(incidentLine).toMatchObject({ amount: '25000', affects_net: false });
    expect(snapshot.net_amount).toBe('1307200');
  });

  it('deducts a verified incident from wages only when the wallet has not already paid it', () => {
    const snapshot = build({
      incidents: [{ id: 89, claim_amount: '25000', wallet_deduction_already_applied: 0 }]
    });
    expect(snapshot.lines.find((line) => line.line_type === 'incident_deduction')?.amount).toBe('25000');
    expect(snapshot.deduction_amount).toBe('177000');
    expect(snapshot.net_amount).toBe('1282200');
  });

  it('calculates separate pay-rule events for the delivery and exchange return scan', () => {
    const snapshot = build({
      events: [
        {
          ...events[0], id: 41, order_id: 401, to_status: 'partial_delivery_completed',
          created_at: '2026-04-12 12:00:00', item_value: '15000'
        },
        {
          ...events[0], id: 42, order_id: 401, to_status: 'exchange_return_collected',
          created_at: '2026-04-12 12:00:00', item_value: '8000'
        }
      ],
      rules: [
        ...rules,
        { id: 5, event_type: 'return', area_code: 'GOVAP_ALL', min_weight_kg: 0, amount_vnd: '2000', percent_rate: null, effective_from: '2026-01-01', effective_to: null }
      ]
    });
    expect(snapshot.lines.find((line) => line.source_id === 41 && line.line_type === 'event_delivery_success')?.amount)
      .toBe('5000');
    expect(snapshot.lines.find((line) => line.source_id === 41 && line.line_type === 'delivery_bonus')?.amount)
      .toBe('1000');
    expect(snapshot.lines.find((line) => line.source_id === 42 && line.line_type === 'event_return')?.amount)
      .toBe('2000');
  });
});
