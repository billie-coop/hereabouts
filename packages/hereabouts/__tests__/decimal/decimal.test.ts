import {
  decimal,
  decimalAbs,
  decimalAlignexp,
  decimalDecrement,
  decimalIncrement,
  decimalIntegerDigits,
  decimalIsInteger,
  decimalIsNegative,
  decimalMovePoint,
  decimalNegate,
  decimalPrecision,
  decimalProperties,
  decimalScale,
  decimalScientific,
  decimalSetScale,
  decimalShiftleft,
  decimalShiftright,
  decimalSignum,
  decimalStripTrailingZeros,
  decimalToInteger,
  decimalToParts,
  decimalToString,
  decimalTrailingZeros,
  type RoundingModeType,
} from '../../src/decimal';
import { divpow10 } from '../../src/decimal/math';

const parse = (s: string) => decimal(s);
const precision = (u: string) => decimalPrecision(parse(u));
const scale = (u: string) => decimalScale(parse(u));
const trailZeros = (u: string) => decimalTrailingZeros(parse(u));
const shr = (u: string, s: number, m: RoundingModeType) => decimalShiftright(parse(u), s, m);

test('negate', () => {
  expect(decimalNegate(parse('1.12'))).toEqual(parse('-1.12'));
  expect(decimalNegate(parse('-1.12'))).toEqual(parse('1.12'));
  expect(decimalNegate(parse('0.00'))).toEqual(parse('-0.00'));
});

test('is negative', () => {
  expect(decimalIsNegative(parse('1'))).toEqual(false);
  expect(decimalIsNegative(parse('0'))).toEqual(false);
  expect(decimalIsNegative(parse('-1'))).toEqual(true);
});

test('exponent', () => {
  expect(parse('100').exp).toEqual(0);
  expect(parse('1e10').exp).toEqual(10);
  expect(parse('1e-10').exp).toEqual(-10);
});

test('properties', () => {
  expect(decimalProperties(parse('-12300'))).toEqual([[12300], -1, 0, 0]);

  expect(decimalProperties(parse('-123e10'))).toEqual([[123], -1, 10, 0]);

  expect(decimalProperties(parse('-123e-10'))).toEqual([[123], -1, -10, 0]);

  expect(decimalProperties(parse('infinity'))).toEqual([[], 1, 0, 2]);

  expect(decimalProperties(parse('-infinity'))).toEqual([[], -1, 0, 2]);

  expect(decimalProperties(parse('nan'))).toEqual([[], 0, 0, 1]);
});

test('signum', () => {
  expect(decimalSignum(parse('0'))).toEqual(0);
  expect(decimalSignum(parse('-0'))).toEqual(0);
  expect(decimalSignum(parse('10'))).toEqual(1);
  expect(decimalSignum(parse('-10'))).toEqual(-1);
});

test('is integer', () => {
  expect(decimalIsInteger(parse('0'))).toEqual(true);
  expect(decimalIsInteger(parse('0.00'))).toEqual(true);
  expect(decimalIsInteger(parse('0.000'))).toEqual(true);
  expect(decimalIsInteger(parse('-0.00'))).toEqual(true);
  expect(decimalIsInteger(parse('0e5'))).toEqual(true);
  expect(decimalIsInteger(parse('0e-10'))).toEqual(true);
  expect(decimalIsInteger(parse('0.1'))).toEqual(false);
  expect(decimalIsInteger(parse('123'))).toEqual(true);
  expect(decimalIsInteger(parse('.123e3'))).toEqual(true);
  expect(decimalIsInteger(parse('123.01'))).toEqual(false);
  expect(decimalIsInteger(parse('123e-3'))).toEqual(false);

  expect(decimalIsInteger(parse('1'))).toEqual(true);
  expect(decimalIsInteger(parse('1001'))).toEqual(true);

  // If decimal is all zeros we count this as an integer since it can
  // be represented as an integer without loss of precision.
  expect(decimalIsInteger(parse('1.0'))).toEqual(true);
  expect(decimalIsInteger(parse('123.0'))).toEqual(true);
  expect(decimalIsInteger(parse('1001.0000000000'))).toEqual(true);

  expect(decimalIsInteger(parse('1.01'))).toEqual(false);
  expect(decimalIsInteger(parse('1001.00000000001'))).toEqual(false);
  expect(decimalIsInteger(parse('10e100'))).toEqual(true);
  expect(decimalIsInteger(parse('10e-100'))).toEqual(false);
});

test('integer digits', () => {
  expect(decimalIntegerDigits(parse('0'))).toEqual(1);
  expect(decimalIntegerDigits(parse('0.0001'))).toEqual(1);
  expect(decimalIntegerDigits(parse('1.1'))).toEqual(1);
  expect(decimalIntegerDigits(parse('1e-5'))).toEqual(1);
  expect(decimalIntegerDigits(parse('1e0'))).toEqual(1);
  expect(decimalIntegerDigits(parse('1e1'))).toEqual(2);
  expect(decimalIntegerDigits(parse('1e2'))).toEqual(3);
  expect(decimalIntegerDigits(parse('1e3'))).toEqual(4);
  expect(decimalIntegerDigits(parse('1e4'))).toEqual(5);
  expect(decimalIntegerDigits(parse('1e5'))).toEqual(6);
  expect(decimalIntegerDigits(parse('12345.999999'))).toEqual(5);
  expect(decimalIntegerDigits(parse('20000'))).toEqual(5);
  expect(decimalIntegerDigits(parse('2e5'))).toEqual(6);
});

test('precision', () => {
  expect(precision('0')).toEqual(1);
  expect(precision('1')).toEqual(1);
  expect(precision('-1')).toEqual(1);
  expect(precision('3.45')).toEqual(3);
  expect(precision('123e10')).toEqual(3);
  expect(precision('1.234')).toEqual(4);
  expect(precision('1000')).toEqual(4);
  expect(precision('10001')).toEqual(5);
  expect(precision('10001.10001')).toEqual(10);

  expect(precision('9')).toEqual(1);
  expect(precision('99')).toEqual(2);
  expect(precision('999')).toEqual(3);
  expect(precision('9999')).toEqual(4);
  expect(precision('99999')).toEqual(5);
  expect(precision('999999')).toEqual(6);
  expect(precision('9999999')).toEqual(7);
  expect(precision('99999999')).toEqual(8);
  expect(precision('999999999')).toEqual(9);
  expect(precision('9999999999')).toEqual(10);
  expect(precision('99999999999')).toEqual(11);

  expect(precision('0.99999999999999999999')).toEqual(20);
  expect(precision('99999999999999999999.99999999999999999999')).toEqual(40);
  expect(precision('0.000000000000000000000000000000000000001')).toEqual(1);
  expect(precision('1.000000000000000000000000000000000000001')).toEqual(40);
});

test('scale', () => {
  expect(scale('1')).toEqual(0);
  expect(scale('1234')).toEqual(0);
  expect(scale('1.234')).toEqual(3);
  expect(scale('1e3')).toEqual(-3);
  expect(scale('1e-3')).toEqual(3);
  expect(scale('0.99999999999999999999')).toEqual(20);
  expect(scale('0.000000000000000000000000000000000000001')).toEqual(39);
  expect(scale('1.000000000000000000000000000000000000001')).toEqual(39);
});

test('set scale', () => {
  expect(decimalSetScale(parse('10.34567'), -4)).toEqual(parse('0e4'));
  expect(decimalSetScale(parse('10.34567'), -3)).toEqual(parse('0e3'));
  expect(decimalSetScale(parse('10.34567'), -2)).toEqual(parse('0e2'));
  expect(decimalSetScale(parse('10.34567'), -1)).toEqual(parse('1e1'));
  expect(decimalSetScale(parse('10.34567'), 0)).toEqual(parse('10'));
  expect(decimalSetScale(parse('10.34567'), 1)).toEqual(parse('10.3'));
  expect(decimalSetScale(parse('10.34567'), 2)).toEqual(parse('10.35'));
  expect(decimalSetScale(parse('10.34567'), 3)).toEqual(parse('10.346'));
  expect(decimalSetScale(parse('10.34567'), 4)).toEqual(parse('10.3457'));
  expect(decimalSetScale(parse('10.34567'), 5)).toEqual(parse('10.34567'));
  expect(decimalSetScale(parse('10.34567'), 6)).toEqual(parse('10.345670'));

  expect(decimalSetScale(parse('1034567'), -6)).toEqual(parse('1e+6'));
  expect(decimalSetScale(parse('1034567'), -5)).toEqual(parse('10e+5'));
  expect(decimalSetScale(parse('1034567'), -4)).toEqual(parse('103e+4'));
  expect(decimalSetScale(parse('1034567'), -3)).toEqual(parse('1035e+3'));
  expect(decimalSetScale(parse('1034567'), -2)).toEqual(parse('10346e+2'));
  expect(decimalSetScale(parse('1034567'), -1)).toEqual(parse('103457e+1'));
  expect(decimalSetScale(parse('1034567'), 0)).toEqual(parse('1034567'));
  expect(decimalSetScale(parse('1034567'), 1)).toEqual(parse('1034567.0'));
  expect(decimalSetScale(parse('1034567'), 2)).toEqual(parse('1034567.00'));
  expect(decimalSetScale(parse('1034567'), 3)).toEqual(parse('1034567.000'));

  expect(decimalSetScale(parse('12345.6'), 1)).toEqual(parse('12345.6'));
  expect(decimalSetScale(parse('12345.67'), 1)).toEqual(parse('12345.7'));
  expect(decimalSetScale(parse('12345.678'), 1)).toEqual(parse('12345.7'));
  expect(decimalSetScale(parse('12345.6781'), 1)).toEqual(parse('12345.7'));
  expect(decimalSetScale(parse('12345.67811'), 1)).toEqual(parse('12345.7'));
  expect(decimalSetScale(parse('12345.678111'), 1)).toEqual(parse('12345.7'));
  expect(decimalSetScale(parse('12345.6781111'), 1)).toEqual(parse('12345.7'));
  expect(decimalSetScale(parse('12345.67811111'), 1)).toEqual(parse('12345.7'));
  expect(decimalSetScale(parse('12345.678111111'), 1)).toEqual(parse('12345.7'));

  expect(decimalSetScale(parse('100599.99'), -3)).toEqual(parse('101e3'));
});

test('abs', () => {
  expect(decimalAbs(parse('0'))).toEqual(parse('0'));
  expect(decimalAbs(parse('2.79'))).toEqual(parse('2.79'));
  expect(decimalAbs(parse('12345.6789'))).toEqual(parse('12345.6789'));
  expect(decimalAbs(parse('-2.79'))).toEqual(parse('2.79'));
  expect(decimalAbs(parse('-12345.6789'))).toEqual(parse('12345.6789'));
});

test('to integer', () => {
  expect(decimalToInteger(parse('0.000'))).toEqual(parse('0'));
  expect(decimalToInteger(parse('0.999'))).toEqual(parse('0'));
  expect(decimalToInteger(parse('-0.999'))).toEqual(parse('-0'));
  expect(decimalToInteger(parse('2.79'))).toEqual(parse('2'));
  expect(decimalToInteger(parse('12345.6789'))).toEqual(parse('12345'));
  expect(decimalToInteger(parse('-2.79'))).toEqual(parse('-2'));
  expect(decimalToInteger(parse('-12345.6789'))).toEqual(parse('-12345'));
});

test('divmod pow10', () => {
  expect(divpow10(1234, 1)).toEqual([123, 4]);
  expect(divpow10(1234, 2)).toEqual([12, 34]);
  expect(divpow10(10001, 1)).toEqual([1000, 1]);
  expect(divpow10(10001, 2)).toEqual([100, 1]);
  expect(divpow10(10001, 3)).toEqual([10, 1]);
});

test('aligned exponent', () => {
  expect(decimalAlignexp(parse('1.234'))).toEqual(0);
  expect(decimalAlignexp(parse('1.234e0'))).toEqual(0);
  expect(decimalAlignexp(parse('1.234e1'))).toEqual(1);
  expect(decimalAlignexp(parse('1.234e2'))).toEqual(2);

  expect(decimalAlignexp(parse('12.34'))).toEqual(1);
  expect(decimalAlignexp(parse('12.34e0'))).toEqual(1);
  expect(decimalAlignexp(parse('12.34e1'))).toEqual(2);
  expect(decimalAlignexp(parse('12.34e2'))).toEqual(3);
  expect(decimalAlignexp(parse('12.3456789'))).toEqual(1);
  expect(decimalAlignexp(parse('.02'))).toEqual(-2);

  expect(decimalAlignexp(parse('0.00012345123e8'))).toEqual(4);
  expect(decimalAlignexp(parse('1.2345123e4'))).toEqual(4);
  expect(decimalAlignexp(parse('12.345123e3'))).toEqual(4);
  expect(decimalAlignexp(parse('12345.123'))).toEqual(4);
});

test('to string', () => {
  // expect(parse('-1.3e-5').toString()).toEqual('-0.000013');
  // expect(parse('-2.9999998e-23').toString()).toEqual('-0.000000000000000000000029999998');

  expect(decimalToString(parse('0'))).toEqual('0');
  expect(decimalToString(parse('0e10'))).toEqual('0');
  expect(decimalToString(parse('0e-10'))).toEqual('0.0000000000');
});

test('to parts', () => {
  expect(decimalToParts(parse('-15.1234e2'))).toEqual([
    { type: 'minus', value: '-' },
    { type: 'integer', value: '1512' },
    { type: 'decimal', value: '.' },
    { type: 'fraction', value: '34' },
  ]);

  expect(decimalToParts(parse('1.3e-5'))).toEqual([
    { type: 'integer', value: '0' },
    { type: 'decimal', value: '.' },
    { type: 'fraction', value: '000013' },
  ]);
});

test('move point', () => {
  expect(decimalMovePoint(parse('1'), 1)).toEqual(parse('1e1'));
  expect(decimalMovePoint(parse('1e5'), 1)).toEqual(parse('1e6'));
  expect(decimalMovePoint(parse('1'), -1)).toEqual(parse('1e-1'));
  expect(decimalMovePoint(parse('1.234'), -2)).toEqual(parse('1.234e-2'));

  expect(decimalToString(decimalMovePoint(parse('1.234'), 0))).toEqual('1.234');
  expect(decimalToString(decimalMovePoint(parse('1.234'), -2))).toEqual('0.01234');
  expect(decimalToString(decimalMovePoint(parse('1.234'), 2))).toEqual('123.4');
  expect(decimalToString(decimalMovePoint(parse('1.234'), -6))).toEqual('0.000001234');
  expect(decimalToString(decimalMovePoint(parse('1.234'), 6))).toEqual('1234000');
});

test('increment', () => {
  expect(decimalIncrement(parse('-1'))).toEqual(parse('-0'));
  expect(decimalIncrement(parse('-0'))).toEqual(parse('1'));
  expect(decimalIncrement(parse('0'))).toEqual(parse('1'));
  expect(decimalIncrement(parse('0.9'))).toEqual(parse('1.9'));
  expect(decimalIncrement(parse('.1111111111111'))).toEqual(parse('1.1111111111111'));

  expect(decimalIncrement(parse('9'))).toEqual(parse('10'));
  expect(decimalIncrement(parse('99'))).toEqual(parse('100'));
  expect(decimalIncrement(parse('999'))).toEqual(parse('1000'));
  expect(decimalIncrement(parse('9999'))).toEqual(parse('10000'));
  expect(decimalIncrement(parse('99999'))).toEqual(parse('100000'));
  expect(decimalIncrement(parse('999999'))).toEqual(parse('1000000'));
  expect(decimalIncrement(parse('9999999'))).toEqual(parse('10000000'));
});

test('decrement', () => {
  expect(decimalDecrement(parse('-1'))).toEqual(parse('-2'));
  expect(decimalDecrement(parse('1'))).toEqual(parse('0'));
  expect(decimalDecrement(parse('1.9'))).toEqual(parse('0.9'));
});

test('scientific', () => {
  expect(decimalScientific(parse('0'))).toEqual([parse('0'), 0]);
  expect(decimalScientific(parse('1'))).toEqual([parse('1'), 0]);
  expect(decimalScientific(parse('-1.2'))).toEqual([parse('-1.2'), 0]);

  expect(decimalScientific(parse('0.0012'))).toEqual([parse('1.2'), -3]);
  expect(decimalScientific(parse('0.0001234'))).toEqual([parse('1.234'), -4]);

  expect(decimalScientific(parse('210'))).toEqual([parse('2.10'), 2]);
  expect(decimalScientific(parse('100000'))).toEqual([parse('1.00000'), 5]);
  expect(decimalScientific(parse('199999'))).toEqual([parse('1.99999'), 5]);

  // alter minimum number of integer digits
  expect(decimalScientific(parse('0'), 1)).toEqual([parse('0'), 0]);
  expect(decimalScientific(parse('0'), 2)).toEqual([parse('0e1'), -1]);
  expect(decimalScientific(parse('0'), 3)).toEqual([parse('0e2'), -2]);
});

test('shift left', () => {
  expect(decimalShiftleft(parse('1.0'), 0)).toEqual(parse('1.0'));
  expect(decimalShiftleft(parse('1.0'), 1)).toEqual(parse('10.0'));
  expect(decimalShiftleft(parse('1.234'), 1)).toEqual(parse('12.340'));

  expect(decimalShiftleft(parse('1234'), 0)).toEqual(parse('1234'));
  expect(decimalShiftleft(parse('1234'), 1)).toEqual(parse('12340'));
  expect(decimalShiftleft(parse('1234'), 2)).toEqual(parse('123400'));
  expect(decimalShiftleft(parse('1234'), 3)).toEqual(parse('1234000'));
  expect(decimalShiftleft(parse('1234'), 4)).toEqual(parse('12340000'));
  expect(decimalShiftleft(parse('1234'), 5)).toEqual(parse('123400000'));
  expect(decimalShiftleft(parse('1234'), 6)).toEqual(parse('1234000000'));
  expect(decimalShiftleft(parse('1234'), 7)).toEqual(parse('12340000000'));
  expect(decimalShiftleft(parse('1234'), 8)).toEqual(parse('123400000000'));
  expect(decimalShiftleft(parse('1234'), 9)).toEqual(parse('1234000000000'));

  expect(decimalShiftleft(parse('12345.234'), 1)).toEqual(parse('123452.340'));
  expect(decimalShiftleft(parse('12345.234'), 2)).toEqual(parse('1234523.400'));
  expect(decimalShiftleft(parse('12345.234'), 3)).toEqual(parse('12345234.000'));
  expect(decimalShiftleft(parse('12345.234'), 4)).toEqual(parse('123452340.000'));

  expect(decimalShiftleft(parse('12345678900000000000'), 10)).toEqual(
    parse('123456789000000000000000000000'),
  );
});

test('shift right', () => {
  const m: RoundingModeType = 'half-even';
  expect(shr('155.578', 1, m)).toEqual(parse('155.58'));
  expect(shr('155.578', 2, m)).toEqual(parse('155.6'));
  expect(shr('155.578', 3, m)).toEqual(parse('156'));
  expect(shr('155.578', 4, m)).toEqual(parse('16e1'));
  expect(shr('155.578', 5, m)).toEqual(parse('2e2'));
  expect(shr('155.578', 6, m)).toEqual(parse('0e3'));
  expect(shr('155.578', 7, m)).toEqual(parse('0e4'));

  expect(shr('1.545', 1, m)).toEqual(parse('1.54'));
  expect(shr('1.545', 2, m)).toEqual(parse('1.5'));
  expect(shr('1.545', 3, m)).toEqual(parse('2'));
  expect(shr('1.545', 4, m)).toEqual(parse('0e1'));
  expect(shr('1.545', 5, m)).toEqual(parse('0e2'));

  expect(shr('1.234', 1, m)).toEqual(parse('1.23'));
  expect(shr('1.234', 2, m)).toEqual(parse('1.2'));

  expect(shr('9999', 1, m)).toEqual(parse('1000e1'));
  expect(shr('9999', 2, m)).toEqual(parse('100e2'));

  expect(shr('999', 1, m)).toEqual(parse('100e1'));
  expect(shr('999', 2, m)).toEqual(parse('10e2'));

  expect(shr('99', 1, m)).toEqual(parse('10e1'));
  expect(shr('99', 2, m)).toEqual(parse('0e2'));

  expect(shr('9', 1, m)).toEqual(parse('0e1'));
  expect(shr('9', 2, m)).toEqual(parse('0e2'));

  expect(shr('1', 1, m)).toEqual(parse('0e1'));
  expect(shr('1', 2, m)).toEqual(parse('0e2'));

  expect(shr('100000000000000', 12, m)).toEqual(parse('100e12'));
  expect(shr('100000000000000', 13, m)).toEqual(parse('10e13'));
  expect(shr('100000000000000', 14, m)).toEqual(parse('1e14'));
  expect(shr('100000000000000', 15, m)).toEqual(parse('0e15'));

  expect(shr('99999', 1, m)).toEqual(parse('10000e1'));
  expect(shr('999999', 1, m)).toEqual(parse('100000e1'));
  expect(shr('9999999', 1, m)).toEqual(parse('1000000e1'));
  expect(shr('99999999', 1, m)).toEqual(parse('10000000e1'));
  expect(shr('999999999', 1, m)).toEqual(parse('100000000e1'));
});

test('shift right rounding modes', () => {
  let m: RoundingModeType = 'up';
  expect(shr('5.5', 1, m)).toEqual(parse('6'));
  expect(shr('2.5', 1, m)).toEqual(parse('3'));
  expect(shr('1.6', 1, m)).toEqual(parse('2'));
  expect(shr('1.1', 1, m)).toEqual(parse('2'));
  expect(shr('1.0', 1, m)).toEqual(parse('1'));
  expect(shr('-1.0', 1, m)).toEqual(parse('-1'));
  expect(shr('-1.1', 1, m)).toEqual(parse('-2'));
  expect(shr('-1.6', 1, m)).toEqual(parse('-2'));
  expect(shr('-2.5', 1, m)).toEqual(parse('-3'));
  expect(shr('-5.5', 1, m)).toEqual(parse('-6'));

  m = 'down';
  expect(shr('5.5', 1, m)).toEqual(parse('5'));
  expect(shr('2.5', 1, m)).toEqual(parse('2'));
  expect(shr('1.6', 1, m)).toEqual(parse('1'));
  expect(shr('1.1', 1, m)).toEqual(parse('1'));
  expect(shr('1.0', 1, m)).toEqual(parse('1'));
  expect(shr('-1.0', 1, m)).toEqual(parse('-1'));
  expect(shr('-1.1', 1, m)).toEqual(parse('-1'));
  expect(shr('-1.6', 1, m)).toEqual(parse('-1'));
  expect(shr('-2.5', 1, m)).toEqual(parse('-2'));
  expect(shr('-5.5', 1, m)).toEqual(parse('-5'));

  m = 'ceiling';
  expect(shr('5.5', 1, m)).toEqual(parse('6'));
  expect(shr('2.5', 1, m)).toEqual(parse('3'));
  expect(shr('1.6', 1, m)).toEqual(parse('2'));
  expect(shr('1.1', 1, m)).toEqual(parse('2'));
  expect(shr('1.0', 1, m)).toEqual(parse('1'));
  expect(shr('-1.0', 1, m)).toEqual(parse('-1'));
  expect(shr('-1.1', 1, m)).toEqual(parse('-1'));
  expect(shr('-1.6', 1, m)).toEqual(parse('-1'));
  expect(shr('-2.5', 1, m)).toEqual(parse('-2'));
  expect(shr('-5.5', 1, m)).toEqual(parse('-5'));

  m = 'floor';
  expect(shr('5.5', 1, m)).toEqual(parse('5'));
  expect(shr('2.5', 1, m)).toEqual(parse('2'));
  expect(shr('1.6', 1, m)).toEqual(parse('1'));
  expect(shr('1.1', 1, m)).toEqual(parse('1'));
  expect(shr('1.0', 1, m)).toEqual(parse('1'));
  expect(shr('-1.0', 1, m)).toEqual(parse('-1'));
  expect(shr('-1.1', 1, m)).toEqual(parse('-2'));
  expect(shr('-1.6', 1, m)).toEqual(parse('-2'));
  expect(shr('-2.5', 1, m)).toEqual(parse('-3'));
  expect(shr('-5.5', 1, m)).toEqual(parse('-6'));

  m = 'half-up';
  expect(shr('5.5', 1, m)).toEqual(parse('6'));
  expect(shr('2.5', 1, m)).toEqual(parse('3'));
  expect(shr('1.6', 1, m)).toEqual(parse('2'));
  expect(shr('1.1', 1, m)).toEqual(parse('1'));
  expect(shr('1.0', 1, m)).toEqual(parse('1'));
  expect(shr('-1.0', 1, m)).toEqual(parse('-1'));
  expect(shr('-1.1', 1, m)).toEqual(parse('-1'));
  expect(shr('-1.6', 1, m)).toEqual(parse('-2'));
  expect(shr('-2.5', 1, m)).toEqual(parse('-3'));
  expect(shr('-5.5', 1, m)).toEqual(parse('-6'));

  m = 'half-down';
  expect(shr('5.5', 1, m)).toEqual(parse('5'));
  expect(shr('2.5', 1, m)).toEqual(parse('2'));
  expect(shr('1.6', 1, m)).toEqual(parse('2'));
  expect(shr('1.1', 1, m)).toEqual(parse('1'));
  expect(shr('1.0', 1, m)).toEqual(parse('1'));
  expect(shr('-1.0', 1, m)).toEqual(parse('-1'));
  expect(shr('-1.1', 1, m)).toEqual(parse('-1'));
  expect(shr('-1.6', 1, m)).toEqual(parse('-2'));
  expect(shr('-2.5', 1, m)).toEqual(parse('-2'));
  expect(shr('-5.5', 1, m)).toEqual(parse('-5'));

  m = 'half-even';
  expect(shr('5.5', 1, m)).toEqual(parse('6'));
  expect(shr('2.5', 1, m)).toEqual(parse('2'));
  expect(shr('1.6', 1, m)).toEqual(parse('2'));
  expect(shr('1.1', 1, m)).toEqual(parse('1'));
  expect(shr('1.0', 1, m)).toEqual(parse('1'));
  expect(shr('-1.0', 1, m)).toEqual(parse('-1'));
  expect(shr('-1.1', 1, m)).toEqual(parse('-1'));
  expect(shr('-1.6', 1, m)).toEqual(parse('-2'));
  expect(shr('-2.5', 1, m)).toEqual(parse('-2'));
  expect(shr('-5.5', 1, m)).toEqual(parse('-6'));
});

test('invalid rounding mode', () => {
  expect(shr('5.5', 1, 'foobar' as RoundingModeType)).toEqual(parse('5'));
});

test('trailing zeros count', () => {
  expect(trailZeros('1')).toEqual(0);
  expect(trailZeros('100')).toEqual(2);
  expect(trailZeros('1.000')).toEqual(3);
  expect(trailZeros('1000000000000000000000')).toEqual(21);
});

test('trailing zeros strip', () => {
  expect(decimalStripTrailingZeros(parse('1.234000'))).toEqual(parse('1.234'));
  expect(decimalStripTrailingZeros(parse('100e10'))).toEqual(parse('1e12'));
  expect(decimalStripTrailingZeros(parse('1.00e-10'))).toEqual(parse('1e-10'));
  expect(decimalStripTrailingZeros(parse('0e-2'))).toEqual(parse('0'));
  expect(decimalStripTrailingZeros(parse('0.000e-2'))).toEqual(parse('0'));
});
