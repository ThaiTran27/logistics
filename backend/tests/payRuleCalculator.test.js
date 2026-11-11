import { describe, expect, it } from 'vitest';
import calculator from '../services/payRuleCalculator.js';

const { calculatePayRuleAmount, selectPayRule, sumPayRuleEarnings } = calculator;

describe('effective payroll rules', () => {
  it('chooses the ward-specific rule over the general rule on its effective date', () => {
    const rules = [
      {
        id: 1, event_type: 'delivery_success', area_code: 'GOVAP_ALL',
        min_weight_kg: 0, max_weight_kg: null, amount_vnd: '5000',
        effective_from: '2026-01-01', effective_to: null
      },
      {
        id: 2, event_type: 'delivery_success', area_code: 'ward_a',
        min_weight_kg: 0, max_weight_kg: null, amount_vnd: '7000',
        effective_from: '2026-05-01', effective_to: null
      }
    ];
    const selected = selectPayRule(rules, {
      eventType: 'delivery_success',
      areaCode: 'ward_a',
      weightKg: 2,
      eventDate: '2026-05-01',
      eventTime: '10:00:00'
    });
    expect(selected.id).toBe(2);
    expect(calculatePayRuleAmount(selected, '100000')).toBe(7000n);
  });

  it('applies the holiday multiplier with half-up whole-VND rounding', () => {
    expect(calculatePayRuleAmount({
      amount_vnd: '1001',
      holiday_multiplier_milli: 1500
    }, '0', true)).toBe(1502n);
    expect(calculatePayRuleAmount({
      amount_vnd: null,
      percent_rate: '3.75',
      holiday_multiplier_milli: 1000
    }, '100000')).toBe(3750n);
  });

  it('honors effective dates, weight and overnight time windows when totaling pay', () => {
    const events = [
      { userId: 4, eventType: 'pickup', areaCode: 'GOVAP_ALL', weightKg: 1, eventDate: '2026-06-01', eventTime: '23:30:00', basisAmount: '0' },
      { userId: 4, eventType: 'pickup', areaCode: 'GOVAP_ALL', weightKg: 4, eventDate: '2026-06-01', eventTime: '23:30:00', basisAmount: '0' }
    ];
    const rules = [{
      id: 7, event_type: 'pickup', area_code: 'GOVAP_ALL', min_weight_kg: 0, max_weight_kg: 3,
      start_time: '22:00:00', end_time: '02:00:00', amount_vnd: '3000',
      holiday_multiplier_milli: 1000, effective_from: '2026-01-01', effective_to: null
    }];
    expect(sumPayRuleEarnings(events, rules).get(4)).toBe(3000n);
  });
});
