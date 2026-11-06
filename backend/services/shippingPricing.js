'use strict';

const { addMoney, parseMoney } = require('../utils/money');

function dateValue(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function isEffectiveOn(rate, effectiveDate) {
  const start = dateValue(rate.effective_from);
  const end = rate.effective_to ? dateValue(rate.effective_to) : null;
  return start <= effectiveDate && (!end || end >= effectiveDate);
}

function selectEffectiveRate(rates, { areaCode, serviceType, weightKg, effectiveDate }) {
  const weight = Number(weightKg);
  const candidates = rates.filter((rate) => (
    rate.service_type === serviceType
    && (rate.area_code === areaCode || rate.area_code === 'GOVAP_ALL')
    && Number(rate.min_weight_kg) <= weight
    && (rate.max_weight_kg === null || rate.max_weight_kg === undefined
      || weight < Number(rate.max_weight_kg))
    && isEffectiveOn(rate, effectiveDate)
  ));
  candidates.sort((left, right) => (
    Number(right.area_code === areaCode) - Number(left.area_code === areaCode)
    || dateValue(right.effective_from).localeCompare(dateValue(left.effective_from))
    || Number(right.id) - Number(left.id)
  ));
  return candidates[0] || null;
}

function scaledWeight(value) {
  return BigInt(Math.max(0, Math.round(Number(value || 0) * 1000)));
}

function calculateShippingPrice(rate, {
  weightKg,
  lengthCm,
  widthCm,
  heightCm,
  distanceKm,
  remoteArea = false,
  fragile = false,
  vehicleType = 'motorbike'
}) {
  if (!rate) {
    const error = new Error('Không tìm thấy bảng giá có hiệu lực cho khu vực, khối lượng và dịch vụ này.');
    error.statusCode = 409;
    throw error;
  }
  const volumeWeight = Number(lengthCm || 0) * Number(widthCm || 0) * Number(heightCm || 0) / 5000;
  const chargeableWeight = Math.max(Number(weightKg), volumeWeight);
  const weight = scaledWeight(chargeableWeight);
  const includedWeight = scaledWeight(rate.included_weight_kg);
  const stepWeight = scaledWeight(rate.weight_step_kg);
  let total = parseMoney(rate.base_fee);

  const distanceMeters = BigInt(Math.max(0, Math.round(Number(distanceKm) * 1000)));
  const includedMeters = BigInt(Math.max(0, Math.round(Number(rate.included_distance_km) * 1000)));
  if (distanceMeters > includedMeters) {
    const excessMeters = distanceMeters - includedMeters;
    const distanceFee = (
      excessMeters * parseMoney(rate.distance_fee_per_km) + 500n
    ) / 1000n;
    total = addMoney(total, distanceFee);
  }

  if (stepWeight > 0n && weight > includedWeight) {
    const excessWeight = weight - includedWeight;
    const steps = (excessWeight + stepWeight - 1n) / stepWeight;
    total = addMoney(total, steps * parseMoney(rate.weight_step_fee));
  }
  if (remoteArea) total = addMoney(total, parseMoney(rate.remote_area_fee));
  if (fragile) total = addMoney(total, parseMoney(rate.fragile_fee));

  const vehicleMultiplier = parseMoney(rate[`${vehicleType}_multiplier_milli`]);
  if (vehicleMultiplier <= 0n) throw new Error('Hệ số phương tiện trong bảng giá không hợp lệ.');
  total = (total * vehicleMultiplier + 500n) / 1000n;

  const roundingIncrement = parseMoney(rate.rounding_increment);
  if (roundingIncrement <= 0n) throw new Error('Bước làm tròn trong bảng giá không hợp lệ.');
  // Apply the configured nearest-increment rounding, with half values rounded upward.
  return ((total + roundingIncrement / 2n) / roundingIncrement) * roundingIncrement;
}

function snapshotRate(rate) {
  return {
    id: Number(rate.id),
    area_code: rate.area_code,
    min_weight_kg: String(rate.min_weight_kg),
    max_weight_kg: rate.max_weight_kg == null ? null : String(rate.max_weight_kg),
    service_type: rate.service_type,
    base_fee: parseMoney(rate.base_fee).toString(),
    included_distance_km: String(rate.included_distance_km),
    distance_fee_per_km: parseMoney(rate.distance_fee_per_km).toString(),
    included_weight_kg: String(rate.included_weight_kg),
    weight_step_kg: String(rate.weight_step_kg),
    weight_step_fee: parseMoney(rate.weight_step_fee).toString(),
    remote_area_fee: parseMoney(rate.remote_area_fee).toString(),
    fragile_fee: parseMoney(rate.fragile_fee).toString(),
    motorbike_multiplier_milli: String(rate.motorbike_multiplier_milli),
    van_multiplier_milli: String(rate.van_multiplier_milli),
    truck_multiplier_milli: String(rate.truck_multiplier_milli),
    rounding_increment: parseMoney(rate.rounding_increment).toString(),
    effective_from: dateValue(rate.effective_from),
    effective_to: rate.effective_to ? dateValue(rate.effective_to) : null
  };
}

module.exports = { calculateShippingPrice, selectEffectiveRate, snapshotRate };
