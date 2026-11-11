'use strict';

const { calculatePercentage, parseMoney } = require('../utils/money');

function dateOnly(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function timeOnly(value) {
  if (value instanceof Date) return value.toTimeString().slice(0, 8);
  return String(value || '').slice(0, 8);
}

function matchesTime(rule, eventTime) {
  if (!rule.start_time && !rule.end_time) return true;
  if (!rule.start_time || !rule.end_time) return false;
  const start = timeOnly(rule.start_time);
  const end = timeOnly(rule.end_time);
  const time = timeOnly(eventTime);
  return start <= end ? time >= start && time < end : time >= start || time < end;
}

function selectPayRule(rules, event) {
  const applicable = rules.filter((rule) => {
    const effectiveFrom = dateOnly(rule.effective_from);
    const effectiveTo = rule.effective_to ? dateOnly(rule.effective_to) : null;
    return rule.event_type === event.eventType
      && (rule.area_code === event.areaCode || rule.area_code === 'GOVAP_ALL')
      && Number(rule.min_weight_kg) <= Number(event.weightKg)
      && (rule.max_weight_kg == null || Number(event.weightKg) < Number(rule.max_weight_kg))
      && effectiveFrom <= event.eventDate
      && (!effectiveTo || effectiveTo >= event.eventDate)
      && matchesTime(rule, event.eventTime);
  });
  applicable.sort((left, right) => (
    Number(right.area_code === event.areaCode) - Number(left.area_code === event.areaCode)
    || dateOnly(right.effective_from).localeCompare(dateOnly(left.effective_from))
    || Number(right.id) - Number(left.id)
  ));
  return applicable[0] || null;
}

function calculatePayRuleAmount(rule, basisAmount, isHoliday = false) {
  if (!rule) return 0n;
  const amount = rule.amount_vnd !== null && rule.amount_vnd !== undefined
    ? parseMoney(rule.amount_vnd)
    : calculatePercentage(basisAmount, rule.percent_rate);
  if (!isHoliday) return amount;
  const multiplier = BigInt(rule.holiday_multiplier_milli || 1000);
  return (amount * multiplier + 500n) / 1000n;
}

function sumPayRuleEarnings(events, rules, holidayDates = new Set()) {
  const totals = new Map();
  for (const event of events) {
    const rule = selectPayRule(rules, event);
    if (!rule) continue;
    const amount = calculatePayRuleAmount(
      rule,
      event.basisAmount,
      holidayDates.has(event.eventDate)
    );
    const userId = Number(event.userId);
    totals.set(userId, (totals.get(userId) || 0n) + amount);
  }
  return totals;
}

module.exports = {
  calculatePayRuleAmount,
  matchesTime,
  selectPayRule,
  sumPayRuleEarnings
};
