'use strict';

const MAX_VND = 999999999999999n;

function invalidMoney() {
  const error = new TypeError('Số tiền phải là số nguyên VND hợp lệ.');
  error.code = 'INVALID_MONEY';
  error.statusCode = 400;
  return error;
}

function inRange(amount) {
  return amount <= MAX_VND && amount >= -MAX_VND;
}

function parseMoney(value, { allowNegative = false } = {}) {
  if (typeof value === 'bigint') {
    if ((value < 0n && !allowNegative) || !inRange(value)) throw invalidMoney();
    return value;
  }

  let input;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw invalidMoney();
    input = String(value);
  } else if (typeof value === 'string') {
    input = value.trim();
  } else {
    throw invalidMoney();
  }

  if (!input) throw invalidMoney();
  const negative = input.startsWith('-');
  if (negative && !allowNegative) throw invalidMoney();
  const unsigned = negative ? input.slice(1) : input;
  const isPlainInteger = /^\d+$/.test(unsigned);
  const isCommaGrouped = /^\d{1,3}(?:,\d{3})+$/.test(unsigned);
  const isDotGrouped = /^\d{1,3}(?:\.\d{3})+$/.test(unsigned);
  if (!isPlainInteger && !isCommaGrouped && !isDotGrouped) throw invalidMoney();

  const digits = unsigned.replace(/[,.]/g, '');
  const amount = BigInt(digits);
  const signedAmount = negative ? -amount : amount;
  if (!inRange(signedAmount)) throw invalidMoney();
  return signedAmount;
}

function addMoney(left, right, { allowNegative = false } = {}) {
  const result = parseMoney(left, { allowNegative: true })
    + parseMoney(right, { allowNegative: true });
  if ((result < 0n && !allowNegative) || !inRange(result)) throw invalidMoney();
  return result;
}

function subtractMoney(left, right, { allowNegative = false } = {}) {
  const result = parseMoney(left, { allowNegative: true })
    - parseMoney(right, { allowNegative: true });
  if ((result < 0n && !allowNegative) || !inRange(result)) throw invalidMoney();
  return result;
}

function multiplyMoney(value, multiplier, { allowNegative = false } = {}) {
  if (!Number.isSafeInteger(multiplier) || multiplier < 0) throw invalidMoney();
  const result = parseMoney(value, { allowNegative: true }) * BigInt(multiplier);
  if ((result < 0n && !allowNegative) || !inRange(result)) throw invalidMoney();
  return result;
}

function parsePercentage(value) {
  if (typeof value === 'number' && !Number.isFinite(value)) throw invalidMoney();
  const input = String(value).trim();
  const match = /^(?:\d+)(?:\.(\d{1,2}))?$/.exec(input);
  if (!match) throw invalidMoney();
  const [whole] = input.split('.');
  const basisPoints = BigInt(whole) * 100n + BigInt((match[1] || '').padEnd(2, '0'));
  if (basisPoints > 10000n) throw invalidMoney();
  return basisPoints;
}

function calculatePercentage(amount, percentage, multiplier = 1) {
  if (!Number.isSafeInteger(multiplier) || multiplier < 0) throw invalidMoney();
  const amountVnd = parseMoney(amount, { allowNegative: true });
  const basisPoints = parsePercentage(percentage);
  const sign = amountVnd < 0n ? -1n : 1n;
  const absolute = amountVnd < 0n ? -amountVnd : amountVnd;
  // Round half up (ties away from zero) to the nearest whole VND.
  const result = sign * ((absolute * basisPoints * BigInt(multiplier) + 5000n) / 10000n);
  if (!inRange(result)) throw invalidMoney();
  return result;
}

function formatMoney(value, locale = 'vi-VN') {
  return parseMoney(value, { allowNegative: true }).toLocaleString(locale);
}

module.exports = {
  addMoney,
  calculatePercentage,
  formatMoney,
  multiplyMoney,
  parseMoney,
  subtractMoney
};
