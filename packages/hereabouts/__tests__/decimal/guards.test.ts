import {
  DecimalConstants,
  decimal,
  decimalDivide,
  decimalMultiply,
  decimalScientific,
  isDecimal,
  isRational,
  rational,
} from '../../src/decimal';

test('isDecimal accepts decimal values', () => {
  for (const s of [
    '0',
    '-0',
    '1.50',
    '-123e-30',
    '99999999999999.999999',
    'nan',
    'infinity',
    '-infinity',
  ]) {
    expect(isDecimal(decimal(s))).toBe(true);
  }
  for (const d of Object.values(DecimalConstants)) {
    expect(isDecimal(d)).toBe(true);
  }
  // Plain objects with the complete shape are decimals (values are plain data).
  expect(isDecimal(JSON.parse(JSON.stringify(decimal('123.45'))))).toBe(true);
  expect(isDecimal(Object.freeze({ data: [1], sign: -1, exp: 3, flag: 0 }))).toBe(true);

  // Fractional precision / scale / digit arguments produce fractional exponents.
  expect(isDecimal(decimalScientific('123', 1.5)[0])).toBe(true);
  expect(isDecimal(decimalDivide('1', '3', { scale: 2.5 }))).toBe(true);
  expect(isDecimal(decimalMultiply('1.2345', '1.1', { precision: 2.5 }))).toBe(true);
});

test('isDecimal rejects incomplete or invalid objects', () => {
  const bad: any[] = [
    undefined,
    null,
    1,
    '1',
    [],
    {},
    { data: [1], flag: 0 },
    { data: [1], flag: 2 },
    { data: [1], sign: 1, flag: 0 },
    { data: [1], exp: 0, flag: 0 },
    { data: [1], sign: 1, exp: 0 },
    { sign: 1, exp: 0, flag: 0 },
    { data: 'abc', sign: 1, exp: 0, flag: 0 },
    { data: [1], sign: 2, exp: 0, flag: 0 },
    { data: [1], sign: '1', exp: 0, flag: 0 },
    { data: [1], sign: 1, exp: '0', flag: 0 },
    { data: [1], sign: 1, exp: null, flag: 0 },
    { data: [1], sign: 1, exp: 0, flag: 3 },
    { data: [1], sign: 1, exp: 0, flag: '0' },
    { data: [1.5], sign: 1, exp: 0, flag: 0 },
    { data: ['1'], sign: 1, exp: 0, flag: 0 },
    { data: [-1], sign: 1, exp: 0, flag: 0 },
    { data: [1e7], sign: 1, exp: 0, flag: 0 },
    { data: [null], sign: 1, exp: 0, flag: 0 },
  ];
  for (const x of bad) {
    expect(isDecimal(x)).toBe(false);
  }
});

test('isRational', () => {
  expect(isRational(rational(1, 3))).toBe(true);
  expect(isRational(rational('1.5'))).toBe(true);
  expect(isRational({ numerator: decimal(1), denominator: decimal(3) })).toBe(true);
  expect(isRational(null)).toBe(false);
  expect(isRational({ numerator: decimal(1) })).toBe(false);
  expect(isRational({ numerator: { data: [1], flag: 0 }, denominator: decimal(3) })).toBe(false);
  expect(isRational({ numerator: decimal(1), denominator: { data: [3], flag: 0 } })).toBe(false);
});
