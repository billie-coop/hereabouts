/**
 * Builds the shared decimal test cases in `conformance/decimal.json`.
 *
 * The TypeScript implementation is the reference: each case records a function name, its
 * arguments and what the TypeScript function returned (or the error it threw). Ports to other
 * languages run the same cases and must produce the same results.
 *
 * Inputs are a fixed list plus values from a seeded random generator, so the output is the same
 * on every run.
 */
import {
  coerceRational,
  type Decimal,
  decimal,
  decimalAbs,
  decimalAdd,
  decimalAlignexp,
  decimalCompare,
  decimalDecrement,
  decimalDivide,
  decimalDivmod,
  decimalFormat,
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
  type MathContext,
  partsDecimalFormatter,
  type RoundingModeType,
  rationalAdd,
  rationalCompare,
  rationalDivide,
  rationalInverse,
  rationalMultiply,
  rationalNegate,
  rationalSubtract,
  rationalToDecimal,
  rationalToString,
  stringDecimalFormatter,
} from '../../src/decimal';
import { type ConformanceCase, collector, type Random, random } from './_shared';

const MODES: RoundingModeType[] = [
  'up',
  'down',
  'ceiling',
  'floor',
  'half-up',
  'half-down',
  'half-even',
];

const SPECIALS = ['NaN', 'Infinity', '-Infinity'];
const ZEROS = ['0', '-0', '0.000', '0e5', '-0.0', '0e-3'];

/** Values taken from the decimal unit tests, plus edges around the 10^7 word size. */
const FIXED = [
  '0',
  '1',
  '-1',
  '.1',
  '.000001',
  '1.2345',
  '00001.2',
  '1000000',
  '9999999',
  '10000000',
  '10000001',
  '100000000',
  '999999999',
  '9999999999',
  '99999999999999',
  '100000000000000',
  '+.1',
  '-.1',
  '-10',
  '-10E+5',
  '123.45e9',
  '0.5',
  '1.5',
  '2.5',
  '-2.5',
  '0.05',
  '12345.6789',
  '-0.000123456789',
  '3.141592653589793238462643383279502884197',
  '1e-20',
  '7E+3',
  ...SPECIALS,
  ...ZEROS,
];

/** A random decimal string: varied lengths, carries (all 9s), powers of ten, halves. */
const randomDecimal = (r: Random): string => {
  const x = r.next();
  if (x < 0.03) {
    return r.pick(SPECIALS);
  }
  if (x < 0.07) {
    return r.pick(ZEROS);
  }
  const len = 1 + Math.floor(r.next() ** 2 * 40);
  const style = r.next();
  let digits = '';
  for (let i = 0; i < len; i++) {
    if (style < 0.1) {
      digits += '9';
    } else if (style < 0.2) {
      digits += i === 0 ? '1' : '0';
    } else if (style < 0.3) {
      digits += i === len - 1 ? '5' : String(r.int(0, 9));
    } else {
      digits += String(r.int(0, 9));
    }
  }
  if (r.next() < 0.5) {
    const p = r.int(0, len);
    digits = digits.slice(0, p) + '.' + digits.slice(p);
    if (digits === '.') {
      digits = '0';
    }
  }
  const exp = r.next() < 0.25 ? `e${r.int(-12, 12)}` : '';
  const sign = r.next() < 0.4 ? '-' : r.next() < 0.1 ? '+' : '';
  return sign + digits + exp;
};

const randomContext = (r: Random): MathContext => {
  const ctx: MathContext = r.next() < 0.5 ? { precision: r.int(0, 40) } : { scale: r.int(-3, 12) };
  if (r.next() < 0.7) {
    ctx.round = r.pick(MODES);
  }
  return ctx;
};

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/** decimalFormat settings: separators, grouping and digits used by real locales. */
const FORMATS: [string, string, number, number, number, number, boolean, string[] | null][] = [
  ['.', ',', 1, 1, 3, 3, false, null],
  [',', '.', 1, 2, 3, 3, true, null],
  ['.', ',', 0, 1, 3, 2, false, null],
  ['٫', '٬', 1, 1, 3, 3, true, ARABIC_DIGITS],
  [',', ' ', 4, 1, 3, 0, false, null],
  ['.', '', 2, 1, 3, 3, true, null],
];

const PARSE_INVALID = [
  '',
  '--1',
  '1-',
  '123..45',
  '1.23.45.6',
  '12345e',
  'e10',
  '12345ee1',
  '12345E--1',
  '12345e10000000000000000',
  '1e10000000',
  '1e-10000000',
  '1.23e99999999',
  '123xyz',
  '.',
  '-',
  '+',
  ' 1',
  'nan ',
  'inf',
  '1-2',
  '1.5+3',
  '-1e5-',
  '1e+-2',
  '+-1',
];

const PARSE_VALID = [
  '1e999999',
  '1e1000000',
  '1e1234567',
  '1e9999999',
  '-1e-9999999',
  '1.23e1000000',
  '1.23e-9999999',
  '123.45e99',
  '1.',
  '+1',
  'nan',
  'infinity',
  '+infinity',
  '+Infinity',
  '-infinity',
];

const ROUNDING_VALUES = [
  '0.5',
  '1.5',
  '2.5',
  '-0.5',
  '-2.5',
  '1.25',
  '1.35',
  '-1.25',
  '-1.35',
  '1.250000001',
  '1.249999999',
  '-1.250000001',
  '0.0005',
  '9.995',
  '-9.995',
  '1.05',
  '1.15',
  '0.45',
  '12345678.5',
  '99999999.5',
  '-99999999.5',
  '1.2500000000000000001',
  '3.4999999999999',
];

const ROUNDING_DIVISIONS = [
  ['22.5000000001', '3'],
  ['-22.5000000001', '3'],
  ['25.5000000001', '3'],
  ['0.37035000001', '3'],
  ['0.37035', '3'],
];

/**
 * Divisions from the unit tests that reach the rare branches of long division: trial quotient
 * corrections (D3) and add-back (D6). Random inputs almost never do.
 */
const HARD_DIVISIONS = [
  ['99899999001', '999'],
  ['99799999002', '998'],
  ['10000000000', '99000000'],
  ['99899999001', '1199999999'],
  ['9999999999999', '55555555555'],
  ['9999999999999999999999', '9999999999999999999'],
  ['10000000', '99999999999999'],
  ['1000000000', '1000112808'],
  ['96441598043416655685', '13367828761276'],
  ['35314321308673059375', '16403941393069'],
  ['506806006102288', '46464220541015929'],
  ['88888888888888888888888888888888888', '17721038931014481'],
  ['444444444444444444444', '17721038931014482'],
  ['15555555555555555555555555', '77777777777777814'],
  ['199999999999', '77777777777784000'],
  ['888888888888888888888888888888888888888', '33333333000000420'],
  ['66666666666666666666666666', '69969109701080089'],
];

const RATIONALS = [
  '1/3',
  '2 / 7',
  '-5/6',
  'pi',
  'e / 2',
  '0.5',
  '10',
  '1/0',
  '0/5',
  '355/113',
  'PI / E',
  '-1.25 / 0.5',
];

export const cases = (): ConformanceCase[] => {
  const r = random(20261104);
  const { cases, add } = collector();

  // Parsing
  for (const s of [...PARSE_VALID, ...PARSE_INVALID]) {
    add('decimal', [s], () => decimal(s));
  }

  const values = [...FIXED];
  for (let i = 0; i < 90; i++) {
    values.push(randomDecimal(r));
  }

  // One value at a time
  for (const s of values) {
    const d: Decimal = decimal(s);
    add('decimal', [s], () => d);
    add('decimalToString', [s], () => decimalToString(d));
    add('decimalToParts', [s], () => decimalToParts(d));
    const minInt = r.int(0, 4);
    add('decimalToScientificString', [s, minInt], () => decimalToScientificString(d, minInt));
    add('decimalToScientificParts', [s, minInt], () => decimalToScientificParts(d, minInt));
    add('decimalScientific', [s, minInt], () => decimalScientific(d, minInt));
    add('decimalPrecision', [s], () => decimalPrecision(d));
    add('decimalScale', [s], () => decimalScale(d));
    add('decimalIntegerDigits', [s], () => decimalIntegerDigits(d));
    add('decimalAlignexp', [s], () => decimalAlignexp(d));
    add('decimalTrailingZeros', [s], () => decimalTrailingZeros(d));
    add('decimalIsInteger', [s], () => decimalIsInteger(d));
    add('decimalIsZero', [s], () => decimalIsZero(d));
    add('decimalIsNegative', [s], () => decimalIsNegative(d));
    add('decimalIsNaN', [s], () => decimalIsNaN(d));
    add('decimalIsFinite', [s], () => decimalIsFinite(d));
    add('decimalIsInfinity', [s], () => decimalIsInfinity(d));
    add('decimalSignum', [s], () => decimalSignum(d));
    add('decimalAbs', [s], () => decimalAbs(d));
    add('decimalNegate', [s], () => decimalNegate(d));
    add('decimalStripTrailingZeros', [s], () => decimalStripTrailingZeros(d));
    add('decimalToInteger', [s], () => decimalToInteger(d));
    add('decimalIncrement', [s], () => decimalIncrement(d));
    add('decimalDecrement', [s], () => decimalDecrement(d));
    for (let i = 0; i < 2; i++) {
      const scale = r.int(-3, 8);
      const mode = r.pick(MODES);
      add('decimalSetScale', [s, scale, mode], () => decimalSetScale(d, scale, mode));
      const right = r.int(0, 25);
      const rmode = r.pick(MODES);
      add('decimalShiftright', [s, right, rmode], () => decimalShiftright(d, right, rmode));
    }
    const left = r.int(0, 20);
    add('decimalShiftleft', [s, left], () => decimalShiftleft(d, left));
    const places = r.int(-10, 10);
    add('decimalMovePoint', [s, places], () => decimalMovePoint(d, places));

    if (decimalIsFinite(d)) {
      for (const [dec, group, mi, mg, pg, sg, zs, digits] of FORMATS) {
        const args = [s, dec, group, mi, mg, pg, sg, zs, digits];
        const dg = digits ?? undefined;
        add('decimalFormatString', args, () => {
          const f = stringDecimalFormatter();
          decimalFormat(d, f, dec, group, mi, mg, pg, sg, zs, dg);
          return f.render();
        });
        add('decimalFormatParts', args, () => {
          const f = partsDecimalFormatter(dec, group);
          decimalFormat(d, f, dec, group, mi, mg, pg, sg, zs, dg);
          return f.render();
        });
      }
    }
  }

  // Pairs of values
  for (let i = 0; i < 260; i++) {
    const a = r.next() < 0.2 ? r.pick(FIXED) : randomDecimal(r);
    const b = r.next() < 0.2 ? r.pick(FIXED) : randomDecimal(r);
    const u = decimal(a);
    const v = decimal(b);
    add('decimalAdd', [a, b], () => decimalAdd(u, v));
    add('decimalSubtract', [a, b], () => decimalSubtract(u, v));
    add('decimalMultiply', [a, b], () => decimalMultiply(u, v));
    const mctx = randomContext(r);
    add('decimalMultiply', [a, b, mctx], () => decimalMultiply(u, v, mctx));
    add('decimalDivide', [a, b], () => decimalDivide(u, v));
    const dctx = randomContext(r);
    add('decimalDivide', [a, b, dctx], () => decimalDivide(u, v, dctx));
    add('decimalDivmod', [a, b], () => decimalDivmod(u, v));
    add('decimalMod', [a, b], () => decimalMod(u, v));
    add('decimalCompare', [a, b, false], () => decimalCompare(u, v));
    add('decimalCompare', [a, b, true], () => decimalCompare(u, v, true));
  }

  // Rounding ties, which random values rarely hit: every mode at and around exact halves.
  for (const s of ROUNDING_VALUES) {
    const d = decimal(s);
    for (const scale of [0, 1, 2]) {
      for (const mode of MODES) {
        add('decimalSetScale', [s, scale, mode], () => decimalSetScale(d, scale, mode));
      }
    }
  }
  // Quotients just past a half: the digits kept are exactly ...5 or ...50, and only the
  // remainder shows the true value is above the tie.
  for (const [a, b] of ROUNDING_DIVISIONS) {
    const u = decimal(a);
    const v = decimal(b);
    for (const ctx of [{ precision: 1 }, { precision: 4 }, { scale: 0 }, { scale: 4 }]) {
      for (const round of MODES) {
        const c: MathContext = { ...ctx, round };
        add('decimalDivide', [a, b, c], () => decimalDivide(u, v, c));
      }
    }
  }

  for (const [a, b] of HARD_DIVISIONS) {
    const u = decimal(a);
    const v = decimal(b);
    add('decimalDivide', [a, b], () => decimalDivide(u, v));
    add('decimalDivide', [a, b, { scale: 40 }], () => decimalDivide(u, v, { scale: 40 }));
    add('decimalDivmod', [a, b], () => decimalDivmod(u, v));
  }

  // Rationals
  for (const s of RATIONALS) {
    add('coerceRational', [s], () => coerceRational(s));
    add('rationalNegate', [s], () => rationalNegate(s));
    add('rationalInverse', [s], () => rationalInverse(s));
    add('rationalToString', [s], () => rationalToString(s));
    add('rationalToDecimal', [s], () => rationalToDecimal(s));
    const ctx = randomContext(r);
    add('rationalToDecimal', [s, ctx], () => rationalToDecimal(s, ctx));
  }
  for (let i = 0; i < 40; i++) {
    const a = r.pick(RATIONALS);
    const b = r.pick(RATIONALS);
    const ctx = r.next() < 0.5 ? randomContext(r) : undefined;
    const args = ctx === undefined ? [a, b] : [a, b, ctx];
    add('rationalAdd', args, () => rationalAdd(a, b, ctx));
    add('rationalSubtract', args, () => rationalSubtract(a, b, ctx));
    add('rationalMultiply', args, () => rationalMultiply(a, b, ctx));
    add('rationalDivide', args, () => rationalDivide(a, b, ctx));
    add('rationalCompare', args, () => rationalCompare(a, b, ctx));
  }

  return cases;
};
