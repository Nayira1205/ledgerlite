const { LIMITS, isValidPaise, formatInr } = require('../src/utils/money');

describe('why we use integer paise', () => {
  it('floating-point rupees go wrong, whole paise do not', () => {
    expect(0.1 + 0.2).not.toBe(0.3); // the classic floating-point trap
    expect(10 + 20).toBe(30); // 10 paise + 20 paise is exact
  });
});

describe('isValidPaise', () => {
  it('accepts positive whole numbers', () => {
    expect(isValidPaise(1)).toBe(true);
    expect(isValidPaise(100)).toBe(true);
    expect(isValidPaise(10_000_000)).toBe(true);
  });

  it.each([
    ['zero', 0],
    ['a negative number', -100],
    ['a fraction', 10.5],
    ['a numeric string', '100'],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['null', null],
    ['undefined', undefined],
    ['a number too large to be exact', Number.MAX_SAFE_INTEGER + 1],
  ])('rejects %s', (_label, value) => {
    expect(isValidPaise(value)).toBe(false);
  });
});

describe('formatInr', () => {
  it.each([
    [0, '\u20B90.00'],
    [5, '\u20B90.05'],
    [100, '\u20B91.00'],
    [12345, '\u20B9123.45'],
    [10_000_000, '\u20B91,00,000.00'],
    [-2550, '-\u20B925.50'],
  ])('formats %i paise as %s', (paise, expected) => {
    expect(formatInr(paise)).toBe(expected);
  });

  it('refuses non-integer input', () => {
    expect(() => formatInr(10.5)).toThrow(TypeError);
  });
});

describe('LIMITS', () => {
  it('are sensible and cannot be changed at runtime', () => {
    expect(LIMITS.MIN_TRANSFER_PAISE).toBeLessThan(LIMITS.MAX_TRANSFER_PAISE);
    expect(LIMITS.MAX_TRANSFER_PAISE).toBeLessThanOrEqual(LIMITS.MAX_BALANCE_PAISE);
    expect(Object.isFrozen(LIMITS)).toBe(true);
  });
});