import {
  type Decimal,
  DecimalConstants,
  decimal,
  decimalAbs,
  decimalAdd,
  decimalAlignexp,
  decimalCompare,
  decimalDecrement,
  decimalDivide,
  decimalIncrement,
  decimalIntegerDigits,
  decimalIsFinite,
  decimalIsInfinity,
  decimalIsInteger,
  decimalIsNaN,
  decimalIsNegative,
  decimalIsZero,
  decimalMod,
  decimalMovePoint,
  decimalMultiply,
  decimalNegate,
  decimalPrecision,
  decimalScale,
  decimalScientific,
  decimalSetScale,
  decimalShiftleft,
  decimalShiftright,
  decimalSignum,
  decimalStripTrailingZeros,
  decimalSubtract,
  decimalToInteger,
  decimalToParts,
  decimalToScientificParts,
  decimalToScientificString,
  decimalToString,
  decimalTrailingZeros,
} from '../src';

const INF_POS = decimal('Infinity');
const INF_NEG = decimal('-Infinity');
const NAN = decimal('NaN');

const POS = decimal('10');
const NEG = decimal('-10');
const ZERO = decimal('0');
const NEG_ZERO = decimal('-0');

test('construction', () => {
  let d: Decimal;

  d = decimal('NaN');
  expect(decimalIsNaN(d)).toBe(true);
  expect(decimalIsFinite(d)).toBe(false);
  expect(decimalIsInfinity(d)).toBe(false);

  d = decimal('nan');
  expect(decimalIsNaN(d)).toBe(true);
  expect(decimalIsFinite(d)).toBe(false);
  expect(decimalIsInfinity(d)).toBe(false);

  d = decimal('infinity');
  expect(decimalIsNaN(d)).toBe(false);
  expect(decimalIsFinite(d)).toBe(false);
  expect(decimalIsInfinity(d)).toBe(true);

  d = decimal('Infinity');
  expect(decimalIsNaN(d)).toBe(false);
  expect(decimalIsFinite(d)).toBe(false);
  expect(decimalIsInfinity(d)).toBe(true);
});

test('absolute value', () => {
  expect(decimalAbs(NAN)).toEqual(decimal('NaN'));

  expect(decimalAbs(INF_POS)).toEqual(INF_POS);
  expect(decimalAbs(INF_NEG)).toEqual(INF_POS);
});

test('negate', () => {
  expect(decimalNegate(NAN)).toEqual(decimal('nan'));
  expect(decimalNegate(INF_POS)).toEqual(INF_NEG);
  expect(decimalNegate(INF_NEG)).toEqual(INF_POS);
});

test('compare', () => {
  // nan
  expect(decimalCompare(NAN, POS)).toBe(-1);
  expect(decimalCompare(NAN, NEG)).toBe(-1);
  expect(decimalCompare(POS, NAN)).toBe(-1);
  expect(decimalCompare(NEG, NAN)).toBe(-1);

  // infinity
  expect(decimalCompare(INF_NEG, INF_NEG)).toBe(0);
  expect(decimalCompare(INF_POS, INF_POS)).toBe(0);
  expect(decimalCompare(INF_NEG, INF_POS)).toBe(-1);
  expect(decimalCompare(INF_POS, INF_NEG)).toBe(1);

  expect(decimalCompare(INF_POS, POS)).toBe(1);
  expect(decimalCompare(INF_POS, POS)).toBe(1);
  expect(decimalCompare(INF_NEG, NEG)).toBe(-1);
  expect(decimalCompare(INF_NEG, NEG)).toBe(-1);

  expect(decimalCompare(POS, INF_POS)).toBe(-1);
  expect(decimalCompare(POS, INF_NEG)).toBe(1);
  expect(decimalCompare(NEG, INF_POS)).toBe(-1);
  expect(decimalCompare(NEG, INF_NEG)).toBe(1);

  expect(decimalCompare(INF_POS, NAN)).toBe(-1);
  expect(decimalCompare(INF_NEG, NAN)).toBe(-1);
  expect(decimalCompare(NAN, INF_POS)).toBe(-1);
  expect(decimalCompare(NAN, INF_NEG)).toBe(-1);
});

test('is negative', () => {
  expect(decimalIsNegative(NAN)).toBe(false);
  expect(decimalIsNegative(INF_POS)).toBe(false);
  expect(decimalIsNegative(INF_NEG)).toBe(true);
});

test('is integer', () => {
  expect(decimalIsInteger(NAN)).toBe(false);
  expect(decimalIsInteger(INF_POS)).toBe(false);
  expect(decimalIsInteger(INF_NEG)).toBe(false);
});

test('addition', () => {
  // Any NaN returns NaN
  expect(decimalAdd(NAN, NAN)).toEqual(NAN);
  expect(decimalAdd(NAN, POS)).toEqual(NAN);
  expect(decimalAdd(POS, NAN)).toEqual(NAN);
  expect(decimalAdd(NAN, INF_POS)).toEqual(NAN);
  expect(decimalAdd(NAN, INF_NEG)).toEqual(NAN);

  // Infinity + Infinity = Infinity
  expect(decimalAdd(INF_POS, INF_POS)).toEqual(INF_POS);

  // Infinity + -Infinity = NaN
  expect(decimalAdd(INF_POS, INF_NEG)).toEqual(NAN);

  // Infinity + 0 = Infinity
  expect(decimalAdd(INF_POS, ZERO)).toEqual(INF_POS);

  // Infinity + 10 = Infinity
  expect(decimalAdd(INF_POS, POS)).toEqual(INF_POS);

  // Infinity + -10 = Infinity
  expect(decimalAdd(INF_POS, NEG)).toEqual(INF_POS);

  // -----

  // -Infinity + Infinity = NaN
  expect(decimalAdd(INF_NEG, INF_POS)).toEqual(NAN);

  // -Infinity + -Infinity = -Infinity
  expect(decimalAdd(INF_NEG, INF_NEG)).toEqual(INF_NEG);

  // -Infinity + 0 = -Infinity
  expect(decimalAdd(INF_NEG, ZERO)).toEqual(INF_NEG);

  // -Infinity + 10 = -Infinity
  expect(decimalAdd(INF_NEG, POS)).toEqual(INF_NEG);

  // -Infinity + -10 = -Infinity
  expect(decimalAdd(INF_NEG, NEG)).toEqual(INF_NEG);

  // -----

  // 0 + Infinity = Infinity
  expect(decimalAdd(ZERO, INF_POS)).toEqual(INF_POS);

  // 0 + -Infinity = -Infinity
  expect(decimalAdd(ZERO, INF_NEG)).toEqual(INF_NEG);

  // 10 + Infinity = Infinity
  expect(decimalAdd(POS, INF_POS)).toEqual(INF_POS);

  // 10 + -Infinity = -Infinity
  expect(decimalAdd(POS, INF_NEG)).toEqual(INF_NEG);

  // -10 + Infinity = Infinity
  expect(decimalAdd(NEG, INF_POS)).toEqual(INF_POS);

  // -10 + -Infinity = -Infinity
  expect(decimalAdd(NEG, INF_NEG)).toEqual(INF_NEG);
});

test('subtraction', () => {
  // Any NaN returns NaN
  expect(decimalSubtract(NAN, NAN)).toEqual(NAN);
  expect(decimalSubtract(NAN, POS)).toEqual(NAN);
  expect(decimalSubtract(POS, NAN)).toEqual(NAN);
  expect(decimalSubtract(NAN, INF_POS)).toEqual(NAN);
  expect(decimalSubtract(NAN, INF_NEG)).toEqual(NAN);

  // -----

  // Infinity - Infinity = NaN
  expect(decimalSubtract(INF_POS, INF_POS)).toEqual(NAN);

  // Infinity - -Infinity = Infinity
  expect(decimalSubtract(INF_POS, INF_NEG)).toEqual(INF_POS);

  // Infinity - 0 = Infinity
  expect(decimalSubtract(INF_POS, ZERO)).toEqual(INF_POS);

  // Infinity - 10 = Infinity
  expect(decimalSubtract(INF_POS, POS)).toEqual(INF_POS);

  // Infinity - -10 = Infinity
  expect(decimalSubtract(INF_POS, NEG)).toEqual(INF_POS);

  // -----

  // -Infinity - Infinity = -Infinity
  expect(decimalSubtract(INF_NEG, INF_POS)).toEqual(INF_NEG);

  // -Infinity - -Infinity = NaN
  expect(decimalSubtract(INF_NEG, INF_NEG)).toEqual(NAN);

  // -Infinity - 0 = -Infinity
  expect(decimalSubtract(INF_NEG, ZERO)).toEqual(INF_NEG);

  // -Infinity - 10 = -Infinity
  expect(decimalSubtract(INF_NEG, POS)).toEqual(INF_NEG);

  // -Infinity - -10 = -Infinity
  expect(decimalSubtract(INF_NEG, NEG)).toEqual(INF_NEG);

  // -----

  // 0 - Infinity = -Infinity
  expect(decimalSubtract(ZERO, INF_POS)).toEqual(INF_NEG);

  // 0 - -Infinity = Infinity
  expect(decimalSubtract(ZERO, INF_NEG)).toEqual(INF_POS);

  // 10 - Infinity = -Infinity
  expect(decimalSubtract(POS, INF_POS)).toEqual(INF_NEG);

  // 10 - -Infinity = Infinity
  expect(decimalSubtract(POS, INF_NEG)).toEqual(INF_POS);

  // -10 - Infinity = -Infinity
  expect(decimalSubtract(NEG, INF_POS)).toEqual(INF_NEG);

  // -10 - -Infinity = Infinity
  expect(decimalSubtract(NEG, INF_NEG)).toEqual(INF_POS);
});

test('multiplication', () => {
  // Any NaN returns NaN
  expect(decimalMultiply(NAN, NAN)).toEqual(NAN);
  expect(decimalMultiply(NAN, POS)).toEqual(NAN);
  expect(decimalMultiply(POS, NAN)).toEqual(NAN);
  expect(decimalMultiply(NAN, INF_POS)).toEqual(NAN);
  expect(decimalMultiply(NAN, INF_NEG)).toEqual(NAN);

  // Infinity * Infinity = Infinity
  expect(decimalMultiply(INF_POS, INF_POS)).toEqual(INF_POS);

  // Infinity * -Infinity = -Infinity
  expect(decimalMultiply(INF_POS, INF_NEG)).toEqual(INF_NEG);

  // Infinity * 0 = NaN
  expect(decimalMultiply(INF_POS, ZERO)).toEqual(NAN);

  // Infinity * 10 = Infinity
  expect(decimalMultiply(INF_POS, POS)).toEqual(INF_POS);

  // Infinity * -10 = -Infinity
  expect(decimalMultiply(INF_POS, NEG)).toEqual(INF_NEG);

  // -----

  // -Infinity * Infinity = -Infinity
  expect(decimalMultiply(INF_NEG, INF_POS)).toEqual(INF_NEG);

  // -Infinity * -Infinity = Infinity
  expect(decimalMultiply(INF_NEG, INF_NEG)).toEqual(INF_POS);

  // -Infinity * 0 = NaN
  expect(decimalMultiply(INF_NEG, ZERO)).toEqual(NAN);

  // -Infinity * 10 = -Infinity
  expect(decimalMultiply(INF_NEG, POS)).toEqual(INF_NEG);

  // -Infinity * -10 = Infinity
  expect(decimalMultiply(INF_NEG, NEG)).toEqual(INF_POS);

  // -----

  // 0 * Infinity = NaN
  expect(decimalMultiply(ZERO, INF_POS)).toEqual(NAN);

  // 0 * -Infinity = NaN
  expect(decimalMultiply(ZERO, INF_NEG)).toEqual(NAN);

  // 10 * Infinity = Infinity
  expect(decimalMultiply(POS, INF_POS)).toEqual(INF_POS);

  // 10 * -Infinity = -Infinity
  expect(decimalMultiply(POS, INF_NEG)).toEqual(INF_NEG);

  // -10 * Infinity = -Infinity
  expect(decimalMultiply(NEG, INF_POS)).toEqual(INF_NEG);

  // -10 * -Infinity = Infinity
  expect(decimalMultiply(NEG, INF_NEG)).toEqual(INF_POS);
});

test('division', () => {
  // Any NaN returns NaN
  expect(decimalDivide(NAN, NAN)).toEqual(NAN);
  expect(decimalDivide(NAN, POS)).toEqual(NAN);
  expect(decimalDivide(POS, NAN)).toEqual(NAN);
  expect(decimalDivide(NAN, INF_POS)).toEqual(NAN);
  expect(decimalDivide(NAN, INF_NEG)).toEqual(NAN);

  // Infinity / Infinity = NaN
  expect(decimalDivide(INF_POS, INF_POS)).toEqual(NAN);

  // Infinity / -Infinity = NaN
  expect(decimalDivide(INF_POS, INF_NEG)).toEqual(NAN);

  // Infinity / 0 = Infinity
  expect(decimalDivide(INF_POS, ZERO)).toEqual(INF_POS);

  // Infinity / 10 = Infinity
  expect(decimalDivide(INF_POS, POS)).toEqual(INF_POS);

  // Infinity / -10 = -Infinity
  expect(decimalDivide(INF_POS, NEG)).toEqual(INF_NEG);

  // -----

  // -Infinity / Infinity = NaN
  expect(decimalDivide(INF_NEG, INF_POS)).toEqual(NAN);

  // -Infinity / -Infinity = NaN
  expect(decimalDivide(INF_NEG, INF_NEG)).toEqual(NAN);

  // -Infinity / 0 = -Infinity
  expect(decimalDivide(INF_NEG, ZERO)).toEqual(INF_NEG);

  // -Infinity / 10 = -Infinity
  expect(decimalDivide(INF_NEG, POS)).toEqual(INF_NEG);

  // -Infinity / -10 = Infinity
  expect(decimalDivide(INF_NEG, NEG)).toEqual(INF_POS);

  // -----

  // 0 / Infinity = +0
  expect(decimalDivide(ZERO, INF_POS)).toEqual(ZERO);

  // 0 / -Infinity = -0
  expect(decimalDivide(ZERO, INF_NEG)).toEqual(NEG_ZERO);

  // 10 / Infinity = +0
  expect(decimalDivide(POS, INF_POS)).toEqual(ZERO);

  // 10 / -Infinity = -0
  expect(decimalDivide(POS, INF_NEG)).toEqual(NEG_ZERO);

  // -10 / Infinity = -0
  expect(decimalDivide(NEG, INF_POS)).toEqual(NEG_ZERO);

  // -10 / -Infinity = +0
  expect(decimalDivide(NEG, INF_NEG)).toEqual(ZERO);

  // -----

  // 10 / 0 = Infinity
  expect(decimalDivide(POS, ZERO)).toEqual(INF_POS);

  // -10 / 0 = -Infinity
  expect(decimalDivide(NEG, ZERO)).toEqual(INF_NEG);
});

test('division by infinity yields signed zero and does not alias the shared ZERO', () => {
  // Result sign matches the ECMAScript div operator, e.g. Object.is(-10 / Infinity, -0)
  expect(decimalIsNegative(decimalDivide(POS, INF_POS))).toBe(false);
  expect(decimalIsNegative(decimalDivide(POS, INF_NEG))).toBe(true);
  expect(decimalIsNegative(decimalDivide(NEG, INF_POS))).toBe(true);
  expect(decimalIsNegative(decimalDivide(NEG, INF_NEG))).toBe(false);
  expect(decimalIsNegative(decimalDivide(ZERO, INF_POS))).toBe(false);
  expect(decimalIsNegative(decimalDivide(ZERO, INF_NEG))).toBe(true);

  // Results are still exactly zero
  const r = decimalDivide(NEG, INF_POS);
  expect(decimalIsZero(r)).toBe(true);
  expect(decimalSignum(r)).toBe(0);
  expect(decimalCompare(r, ZERO)).toBe(0);

  // A fresh instance is returned, not the shared module-level ZERO constant
  expect(decimalDivide(POS, INF_POS)).not.toBe(DecimalConstants.ZERO);
  expect(decimalDivide(NEG, INF_POS)).not.toBe(DecimalConstants.ZERO);
  expect(decimalDivide(ZERO, INF_NEG)).not.toBe(DecimalConstants.ZERO);
});

test('mod', () => {
  // Any NaN returns NaN
  expect(decimalMod(NAN, NAN)).toEqual(NAN);
  expect(decimalMod(NAN, POS)).toEqual(NAN);
  expect(decimalMod(POS, NAN)).toEqual(NAN);
  expect(decimalMod(NAN, INF_POS)).toEqual(NAN);
  expect(decimalMod(NAN, INF_NEG)).toEqual(NAN);

  // Infinity % Infinity = NaN
  expect(decimalMod(INF_POS, INF_POS)).toEqual(NAN);

  // Infinity % -Infinity = NaN
  expect(decimalMod(INF_POS, INF_NEG)).toEqual(NAN);

  // Infinity % 0 = NaN
  expect(decimalMod(INF_POS, ZERO)).toEqual(NAN);

  // Infinity % 10 = NaN
  expect(decimalMod(INF_POS, POS)).toEqual(NAN);

  // Infinity % -10 = NaN
  expect(decimalMod(INF_POS, NEG)).toEqual(NAN);

  // -----

  // -Infinity % Infinity = NaN
  expect(decimalMod(INF_NEG, INF_POS)).toEqual(NAN);

  // -Infinity % -Infinity = NaN
  expect(decimalMod(INF_NEG, INF_NEG)).toEqual(NAN);

  // -Infinity % 0 = NaN
  expect(decimalMod(INF_NEG, ZERO)).toEqual(NAN);

  // -Infinity % 10 = NaN
  expect(decimalMod(INF_NEG, POS)).toEqual(NAN);

  // -Infinity % -10 = NaN
  expect(decimalMod(INF_NEG, NEG)).toEqual(NAN);

  // -----

  // 0 % Infinity = 0
  expect(decimalMod(ZERO, INF_POS)).toEqual(ZERO);

  // 0 % -Infinity = 0
  expect(decimalMod(ZERO, INF_NEG)).toEqual(ZERO);

  // 10 % Infinity = 10
  expect(decimalMod(POS, INF_POS)).toEqual(POS);

  // 10 % -Infinity = 10
  expect(decimalMod(POS, INF_NEG)).toEqual(POS);

  // -10 % Infinity = -10
  expect(decimalMod(NEG, INF_POS)).toEqual(NEG);

  // -10 % -Infinity = -10
  expect(decimalMod(NEG, INF_NEG)).toEqual(NEG);

  // -----

  // 0 % 10 = 0
  expect(decimalMod(ZERO, POS)).toEqual(ZERO);

  // 0 % -10 = 0
  expect(decimalMod(ZERO, NEG)).toEqual(ZERO);

  // 10 % 0 = NaN
  expect(decimalMod(POS, ZERO)).toEqual(NAN);

  // -10 % 0 = NaN
  expect(decimalMod(NEG, ZERO)).toEqual(NAN);
});

test('increment / decrement', () => {
  expect(decimalIncrement(NAN)).toEqual(NAN);
  expect(decimalIncrement(INF_POS)).toEqual(INF_POS);
  expect(decimalIncrement(INF_NEG)).toEqual(INF_NEG);

  expect(decimalDecrement(NAN)).toEqual(NAN);
  expect(decimalDecrement(INF_POS)).toEqual(INF_POS);
  expect(decimalDecrement(INF_NEG)).toEqual(INF_NEG);
});

test('formatting', () => {
  expect(decimalToString(NAN)).toEqual('NaN');
  expect(decimalToString(INF_POS)).toEqual('Infinity');
  expect(decimalToString(INF_NEG)).toEqual('-Infinity');

  expect(decimalToParts(NAN)).toEqual([{ type: 'nan', value: 'NaN' }]);
  expect(decimalToParts(INF_POS)).toEqual([{ type: 'infinity', value: 'Infinity' }]);
  expect(decimalToParts(INF_NEG)).toEqual([{ type: 'infinity', value: '-Infinity' }]);
});

test('signum', () => {
  expect(decimalSignum(NAN)).toEqual(0);
  expect(decimalSignum(INF_POS)).toEqual(1);
  expect(decimalSignum(INF_NEG)).toEqual(-1);
});

test('to integer', () => {
  expect(decimalToInteger(NAN)).toEqual(NAN);
  expect(decimalToInteger(INF_POS)).toEqual(INF_POS);
  expect(decimalToInteger(INF_NEG)).toEqual(INF_NEG);
});

test('trailing zeros', () => {
  expect(decimalTrailingZeros(NAN)).toEqual(0);
  expect(decimalTrailingZeros(INF_POS)).toEqual(0);
  expect(decimalTrailingZeros(INF_NEG)).toEqual(0);
});

test('strip trailing zeros', () => {
  expect(decimalStripTrailingZeros(NAN)).toEqual(NAN);
  expect(decimalStripTrailingZeros(INF_POS)).toEqual(INF_POS);
  expect(decimalStripTrailingZeros(INF_NEG)).toEqual(INF_NEG);
});

test('scientific representation', () => {
  expect(decimalScientific(NAN)).toEqual([NAN, 0]);
  expect(decimalScientific(INF_POS)).toEqual([INF_POS, 0]);
  expect(decimalScientific(INF_NEG)).toEqual([INF_NEG, 0]);
});

test('precision', () => {
  expect(decimalPrecision(NAN)).toEqual(0);
  expect(decimalPrecision(INF_POS)).toEqual(0);
  expect(decimalPrecision(INF_NEG)).toEqual(0);
});

test('scale', () => {
  expect(decimalScale(NAN)).toEqual(0);
  expect(decimalScale(INF_POS)).toEqual(0);
  expect(decimalScale(INF_NEG)).toEqual(0);
});

test('integer digits', () => {
  expect(decimalIntegerDigits(NAN)).toEqual(0);
  expect(decimalIntegerDigits(INF_POS)).toEqual(0);
  expect(decimalIntegerDigits(INF_NEG)).toEqual(0);
});

test('set scale', () => {
  expect(decimalSetScale(NAN, 3)).toEqual(NAN);
  expect(decimalSetScale(INF_POS, 3)).toEqual(INF_POS);
  expect(decimalSetScale(INF_NEG, 3)).toEqual(INF_NEG);
});

test('align exp', () => {
  expect(decimalAlignexp(NAN)).toEqual(0);
  expect(decimalAlignexp(INF_POS)).toEqual(0);
  expect(decimalAlignexp(INF_NEG)).toEqual(0);
});

test('move point', () => {
  expect(decimalMovePoint(NAN, 3)).toEqual(NAN);
  expect(decimalMovePoint(INF_POS, 3)).toEqual(INF_POS);
  expect(decimalMovePoint(INF_NEG, 3)).toEqual(INF_NEG);
});

test('shift left', () => {
  expect(decimalShiftleft(NAN, 3)).toEqual(NAN);
  expect(decimalShiftleft(INF_POS, 3)).toEqual(INF_POS);
  expect(decimalShiftleft(INF_NEG, 3)).toEqual(INF_NEG);
});

test('shift right', () => {
  expect(decimalShiftright(NAN, 3)).toEqual(NAN);
  expect(decimalShiftright(INF_POS, 3)).toEqual(INF_POS);
  expect(decimalShiftright(INF_NEG, 3)).toEqual(INF_NEG);
});

test('scientific string', () => {
  expect(decimalToScientificString(NAN)).toEqual('NaN');
  expect(decimalToScientificString(INF_POS)).toEqual('Infinity');
  expect(decimalToScientificString(INF_NEG)).toEqual('-Infinity');
});

test('parts', () => {
  expect(decimalToParts(NAN)).toEqual([{ type: 'nan', value: 'NaN' }]);
  expect(decimalToParts(INF_POS)).toEqual([{ type: 'infinity', value: 'Infinity' }]);
  expect(decimalToParts(INF_NEG)).toEqual([{ type: 'infinity', value: '-Infinity' }]);
});

test('scientific parts', () => {
  expect(decimalToScientificParts(NAN)).toEqual([{ type: 'nan', value: 'NaN' }]);
  expect(decimalToScientificParts(INF_POS)).toEqual([{ type: 'infinity', value: 'Infinity' }]);
  expect(decimalToScientificParts(INF_NEG)).toEqual([{ type: 'infinity', value: '-Infinity' }]);
});
