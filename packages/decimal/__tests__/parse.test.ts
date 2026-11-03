import { decimal, decimalToScientificString } from '../src';

const parse = (s: string) => decimal(s);

test('parse', () => {
  expect(parse('0')).toEqual({ data: [0], exp: 0, sign: 1, flag: 0 });
  expect(parse('1')).toEqual({ data: [1], exp: 0, sign: 1, flag: 0 });
  expect(parse('.1')).toEqual({ data: [1], exp: -1, sign: 1, flag: 0 });
  expect(parse('.000001')).toEqual({ data: [1], exp: -6, sign: 1, flag: 0 });
  expect(parse('1.2345')).toEqual({ data: [12345], exp: -4, sign: 1, flag: 0 });
  expect(parse('00001.2')).toEqual({ data: [12], exp: -1, sign: 1, flag: 0 });
  expect(parse('1000000')).toEqual({ data: [1000000], exp: 0, sign: 1, flag: 0 });
  expect(parse('10000000')).toEqual({ data: [0, 1], exp: 0, sign: 1, flag: 0 });
  expect(parse('100000000')).toEqual({ data: [0, 10], exp: 0, sign: 1, flag: 0 });
  expect(parse('1000000000')).toEqual({ data: [0, 100], exp: 0, sign: 1, flag: 0 });

  expect(parse('999999999')).toEqual({ data: [9999999, 99], exp: 0, sign: 1, flag: 0 });
  expect(parse('9999999999')).toEqual({ data: [9999999, 999], exp: 0, sign: 1, flag: 0 });

  expect(parse('+.1')).toEqual({ data: [1], exp: -1, sign: 1, flag: 0 });

  expect(parse('-.1')).toEqual({ data: [1], exp: -1, sign: -1, flag: 0 });
  expect(parse('-10')).toEqual({ data: [10], exp: 0, sign: -1, flag: 0 });

  expect(parse('-10E+5')).toEqual({ data: [10], exp: 5, sign: -1, flag: 0 });
  expect(parse('123.45e99')).toEqual({ data: [12345], exp: 97, sign: 1, flag: 0 });

  // Exponents up to Constants.RADIX - 1 (7 digits) are valid.
  expect(parse('1e999999')).toEqual({ data: [1], exp: 999999, sign: 1, flag: 0 });
  expect(parse('1e1000000')).toEqual({ data: [1], exp: 1000000, sign: 1, flag: 0 });
  expect(parse('1e1234567')).toEqual({ data: [1], exp: 1234567, sign: 1, flag: 0 });
  expect(parse('1e9999999')).toEqual({ data: [1], exp: 9999999, sign: 1, flag: 0 });
  expect(parse('-1e-9999999')).toEqual({ data: [1], exp: -9999999, sign: -1, flag: 0 });
  expect(parse('1.23e1000000')).toEqual({ data: [123], exp: 999998, sign: 1, flag: 0 });
  expect(parse('1.23e-9999999')).toEqual({ data: [123], exp: -10000001, sign: 1, flag: 0 });
  expect(decimalToScientificString(parse('1e9999999'))).toEqual('1E+9999999');
  expect(decimalToScientificString(parse('1.23e1000000'))).toEqual('1.23E+1000000');

  expect(parse('NaN')).toEqual({ data: [], exp: 0, sign: 0, flag: 1 });
  expect(parse('Infinity')).toEqual({ data: [], exp: 0, sign: 1, flag: 2 });
  expect(parse('-Infinity')).toEqual({ data: [], exp: 0, sign: -1, flag: 2 });
});

test('parse invalid', () => {
  expect(() => parse('')).toThrowError();
  expect(() => parse('--1')).toThrowError();
  expect(() => parse('1-')).toThrowError();
  expect(() => parse('123..45')).toThrowError();
  expect(() => parse('1.23.45.6')).toThrowError();
  expect(() => parse('12345e')).toThrowError();
  expect(() => parse('e10')).toThrowError();
  expect(() => parse('12345ee1')).toThrowError();
  expect(() => parse('12345E--1')).toThrowError();
  expect(() => parse('12345e10000000000000000')).toThrowError();
  // Exponents of Constants.RADIX (1e7) or greater are rejected.
  expect(() => parse('1e10000000')).toThrowError('Exponent too large');
  expect(() => parse('1e-10000000')).toThrowError('Exponent too large');
  expect(() => parse('1.23e99999999')).toThrowError('Exponent too large');
  expect(() => parse('123xyz')).toThrowError();
});
