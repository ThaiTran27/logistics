import { describe, expect, it } from 'vitest';
import pricing from '../services/shippingPricing.js';

const { calculateShippingPrice, selectEffectiveRate, snapshotRate } = pricing;

const baseRate = {
  id: 1,
  area_code: 'GOVAP_ALL',
  min_weight_kg: '0',
  max_weight_kg: null,
  service_type: 'standard',
  base_fee: '28000',
  included_distance_km: '5',
  distance_fee_per_km: '1700',
  included_weight_kg: '2',
  weight_step_kg: '0.5',
  weight_step_fee: '4500',
  remote_area_fee: '22000',
  fragile_fee: '12000',
  motorbike_multiplier_milli: '1000',
  van_multiplier_milli: '1500',
  truck_multiplier_milli: '2500',
  rounding_increment: '1000',
  effective_from: '2026-01-01',
  effective_to: null
};

describe('database-backed shipping rates', () => {
  it('selects the effective rate for an order date and keeps the prior version for old orders', () => {
    const rates = [
      baseRate,
      { ...baseRate, id: 2, base_fee: '35000', effective_from: '2026-10-15' }
    ];
    const oldRate = selectEffectiveRate(rates, {
      areaCode: 'GOVAP_ALL',
      serviceType: 'standard',
      weightKg: 1,
      effectiveDate: '2026-10-14'
    });
    const newRate = selectEffectiveRate(rates, {
      areaCode: 'GOVAP_ALL',
      serviceType: 'standard',
      weightKg: 1,
      effectiveDate: '2026-10-15'
    });

    expect(oldRate.id).toBe(1);
    expect(newRate.id).toBe(2);
    expect(calculateShippingPrice(oldRate, { weightKg: 1, distanceKm: 5 })).toBe(28000n);
    expect(calculateShippingPrice(newRate, { weightKg: 1, distanceKm: 5 })).toBe(35000n);
    expect(snapshotRate(oldRate).base_fee).toBe('28000');
  });

  it('prefers ward-specific rates and rejects inactive or non-matching rates', () => {
    const rates = [
      baseRate,
      { ...baseRate, id: 2, area_code: 'ward_1', base_fee: '31000' },
      { ...baseRate, id: 3, service_type: 'express' },
      { ...baseRate, id: 4, effective_from: '2027-01-01' }
    ];
    expect(selectEffectiveRate(rates, {
      areaCode: 'ward_1',
      serviceType: 'standard',
      weightKg: 1,
      effectiveDate: '2026-10-20'
    }).id).toBe(2);
    expect(selectEffectiveRate(rates, {
      areaCode: 'ward_1',
      serviceType: 'economy',
      weightKg: 1,
      effectiveDate: '2026-10-20'
    })).toBeNull();
  });

  it('calculates weight, distance, fragile, remote and vehicle amounts as whole VND', () => {
    expect(calculateShippingPrice(baseRate, {
      weightKg: 3,
      distanceKm: 6,
      remoteArea: true,
      fragile: true,
      vehicleType: 'van'
    })).toBe(109000n);
  });
});
