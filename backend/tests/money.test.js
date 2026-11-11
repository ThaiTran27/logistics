import { describe, expect, it } from 'vitest';
import money from '../utils/money.js';

const {
  addMoney,
  calculatePercentage,
  formatMoney,
  multiplyMoney,
  parseMoney,
  subtractMoney
} = money;

describe('integer VND helpers', () => {
  it('parses zero, plain integers, grouped integers and large exact values', () => {
    expect(parseMoney(0)).toBe(0n);
    expect(parseMoney(1234567)).toBe(1234567n);
    expect(parseMoney('1234567')).toBe(1234567n);
    expect(parseMoney('1,234,567')).toBe(1234567n);
    expect(parseMoney('1.234.567')).toBe(1234567n);
    expect(parseMoney('1.234')).toBe(1234n);
    expect(parseMoney('999999999999999')).toBe(999999999999999n);
  });

  it.each([
    '1,5',
    '1.5',
    '12,34',
    '1,23,456',
    '1,234.5',
    '-1',
    '',
    'NaN',
    'abc',
    '1 234',
    '1, 234',
    '  '
  ])('rejects invalid money input %j', (value) => {
    expect(() => parseMoney(value)).toThrow();
  });

  it('rejects non-finite, fractional and unsafe JavaScript numbers', () => {
    expect(() => parseMoney(Number.NaN)).toThrow();
    expect(() => parseMoney(1.5)).toThrow();
    expect(() => parseMoney(Number.MAX_SAFE_INTEGER + 1)).toThrow();
    expect(() => parseMoney('1000000000000000')).toThrow();
  });

  it('allows a negative value only when explicitly requested', () => {
    expect(parseMoney('-1,234', { allowNegative: true })).toBe(-1234n);
    expect(() => parseMoney(-1234)).toThrow();
  });

  it('adds and subtracts without precision loss', () => {
    expect(addMoney('999999999999990', '7')).toBe(999999999999997n);
    expect(subtractMoney('100', '40')).toBe(60n);
    expect(subtractMoney('40', '100', { allowNegative: true })).toBe(-60n);
  });

  it('rounds percentages half up to whole VND', () => {
    expect(calculatePercentage(101, '50')).toBe(51n);
    expect(calculatePercentage(100, '0.5')).toBe(1n);
    expect(calculatePercentage(99, '0.5')).toBe(0n);
    expect(calculatePercentage(-101, '50')).toBe(-51n);
    expect(calculatePercentage(1001, '0.5', 3)).toBe(15n);
    expect(multiplyMoney(123, 3)).toBe(369n);
  });

  it('formats integer values without converting through floating point', () => {
    expect(formatMoney('999999999999999')).toBe('999.999.999.999.999');
  });
});
