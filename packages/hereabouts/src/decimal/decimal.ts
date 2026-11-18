import {
  type DecimalFormatter,
  type Part,
  partsDecimalFormatter,
  stringDecimalFormatter,
} from './format';
import { add, divide, divpow10, divword, multiply, subtract, trimLeadingZeros } from './math';
import { allzero, compare, digitCount } from './operations';
import {
  Chars,
  Constants,
  DecimalFlag,
  type MathContext,
  ParseFlags,
  POWERS10,
  type RoundingModeType,
} from './types';

const { floor } = Math;

/**
 * Arbitrary precision decimal value.
 *
 * This is plain, immutable data: `value = sign * coefficient * 10^exp`, where the coefficient is
 * stored little-endian in base 10^7 words in `data`. Use the `decimal*` functions to operate on it.
 *
 * @public
 */
export interface Decimal {
  /** Coefficient words, least-significant first. Empty for NaN and infinities. */
  readonly data: readonly number[];
  /** 1 or -1 (0 for NaN). */
  readonly sign: number;
  /** Exponent. */
  readonly exp: number;
  /** Special-value flag: 0 = finite, 1 = NaN, 2 = infinity. */
  readonly flag: DecimalFlag;
}

/**
 * Valid argument for constructing a Decimal value.
 *
 * @public
 */
export type DecimalArg = number | string | Decimal;

/**
 * Latin decimal digits.
 *
 * @public
 */
export const DECIMAL_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

const enum Op {
  ADDITION = 0,
  SUBTRACTION = 1,
  MULTIPLICATION = 2,
  DIVISION = 3,
  MOD = 4,
}

const DEFAULT_PRECISION = 28;
const EMPTY: number[] = [];

const NAN_VALUES = ['nan', 'NaN'];
const POS_INFINITY = ['infinity', '+infinity', 'Infinity', '+Infinity'];
const NEG_INFINITY = ['-infinity', '-Infinity'];

/**
 * Working copy of a decimal. Internal helpers mutate drafts in place; a draft is only ever
 * created fresh inside a function and is returned as an immutable `Decimal`.
 */
interface Draft {
  data: number[];
  sign: number;
  exp: number;
  flag: DecimalFlag;
}

/** Create a value. All decimals are created here so they share one object shape. */
const make = (data: number[], sign: number, exp: number, flag: DecimalFlag): Draft => ({
  data,
  sign,
  exp,
  flag,
});

/** Fresh mutable copy of a value (1.x `new Decimal(d)`). */
const copy = (d: Decimal): Draft => make(d.data.slice(), d.sign, d.exp, d.flag);

/**
 * Returns true if the argument is a Decimal value: an object with a coefficient array of integer
 * base 10^7 words, a sign of 1, -1 or 0, a numeric exponent and a valid flag. (The exponent is not
 * required to be an integer: fractional precision or scale arguments produce fractional ones.)
 *
 * @public
 */
export const isDecimal = (x: any): x is Decimal => {
  if (x === null || typeof x !== 'object') {
    return false;
  }
  const { data, sign, exp, flag } = x;
  if (
    !Array.isArray(data) ||
    (sign !== 1 && sign !== -1 && sign !== 0) ||
    typeof exp !== 'number' ||
    (flag !== DecimalFlag.NONE && flag !== DecimalFlag.NAN && flag !== DecimalFlag.INFINITY)
  ) {
    return false;
  }
  for (let i = 0; i < data.length; i++) {
    const w = data[i];
    if (!Number.isInteger(w) || w < 0 || w >= Constants.RADIX) {
      return false;
    }
  }
  return true;
};

/**
 * Construct a Decimal from a number or string. A Decimal argument is returned as-is, since
 * decimals are immutable.
 *
 * @public
 */
export const decimal = (n: DecimalArg): Decimal =>
  typeof n === 'number' || typeof n === 'string' ? parse(n) : n;

/**
 * Parses and interprets a math context argument, with appropriate defaults.
 */
const parseMathContext = (
  rounding: RoundingModeType,
  context?: MathContext,
): [boolean, number, RoundingModeType] => {
  let usePrecision = true;
  let scaleprec = DEFAULT_PRECISION;
  if (context !== undefined) {
    if (context.scale !== undefined) {
      scaleprec = context.scale;
      usePrecision = false;
    } else if (context.precision !== undefined) {
      scaleprec = Math.max(context.precision, 0);
    }
    if (context.round !== undefined) {
      rounding = context.round;
    }
  }
  return [usePrecision, scaleprec, rounding];
};

/**
 * Return the storage space needed to hold a given number of digits.
 */
const size = (n: number): number => {
  const q = (n / Constants.RDIGITS) | 0;
  const r = n - q * Constants.RDIGITS;
  return r === 0 ? q : q + 1;
};

// ---------------------------------------------------------------------------
// Predicates and properties
// ---------------------------------------------------------------------------

/**
 * Return true if the decimal is not a number (NaN).
 *
 * @public
 */
export const decimalIsNaN = (n: DecimalArg): boolean => decimal(n).flag === DecimalFlag.NAN;

/**
 * Return true if the decimal is finite (not infinity or NaN).
 *
 * @public
 */
export const decimalIsFinite = (n: DecimalArg): boolean => decimal(n).flag === 0;

/**
 * Return true if the decimal is positive or negative infinity.
 *
 * @public
 */
export const decimalIsInfinity = (n: DecimalArg): boolean =>
  decimal(n).flag === DecimalFlag.INFINITY;

/**
 * Indicates the number is negative.
 *
 * @public
 */
export const decimalIsNegative = (n: DecimalArg): boolean => decimal(n).sign === -1;

/**
 * Number is exactly zero. Exponent may exist, e.g. "0e-2" is "0.00".
 *
 * @public
 */
export const decimalIsZero = (n: DecimalArg): boolean => isZero(decimal(n));

const isZero = (d: Decimal): boolean => !d.flag && d.data.length === 1 && d.data[0] === 0;

/**
 * Signum.
 *
 * @public
 */
export const decimalSignum = (n: DecimalArg): number => {
  const d = decimal(n);
  return isZero(d) ? 0 : d.sign;
};

/**
 * Check if the number can be represented as an integer without loss of precision.
 * For example, '12.000' is the same number as '12'.
 *
 * @public
 */
export const decimalIsInteger = (n: DecimalArg): boolean => {
  const d = decimal(n);
  if (d.flag) {
    return false;
  }
  // Zero with any scale, e.g. "0.00", is exactly zero, which is an integer.
  // Note: trailingZeros() returns 0 for an all-zero coefficient, so this
  // check must come before the exponent comparison below.
  return isZero(d) || d.exp + trailingZeros(d) >= 0;
};

/**
 * Return the raw internal properties of the number: coefficient words (least-significant first),
 * sign, exponent and flag. The coefficient is a copy; decimals are immutable and may share it.
 *
 * @public
 */
export const decimalProperties = (n: DecimalArg): [readonly number[], number, number, number] => {
  const d = decimal(n);
  return [d.data.slice(), d.sign, d.exp, d.flag];
};

/**
 * Number of digits in the unscaled value.
 *
 * @public
 */
export const decimalPrecision = (n: DecimalArg): number => precision(decimal(n));

const precision = (d: Decimal): number => {
  if (d.flag) {
    return 0;
  }
  const len = d.data.length;
  return (len - 1) * Constants.RDIGITS + digitCount(d.data[len - 1]);
};

/**
 * Scale is the number of digits to the right of the decimal point.
 *
 * @public
 */
export const decimalScale = (n: DecimalArg): number => scale(decimal(n));

const scale = (d: Decimal): number => (d.flag ? 0 : d.exp === 0 ? 0 : -d.exp);

/**
 * Number of integer digits, 1 or higher.
 *
 * @public
 */
export const decimalIntegerDigits = (n: DecimalArg): number => {
  const d = decimal(n);
  return d.flag ? 0 : Math.max(precision(d) + d.exp, 1);
};

/**
 * Adjusted exponent for alignment. Two numbers with the same aligned exponent are
 * aligned for arithmetic operations. If the aligned exponents do not match one
 * number must be shifted.
 *
 * @public
 */
export const decimalAlignexp = (n: DecimalArg): number => alignexp(decimal(n));

const alignexp = (d: Decimal): number => (d.flag ? 0 : d.exp + precision(d) - 1);

/**
 * Number of trailing zeros.
 *
 * @public
 */
export const decimalTrailingZeros = (n: DecimalArg): number => trailingZeros(decimal(n));

const trailingZeros = (d: Decimal): number => {
  if (d.flag) {
    return 0;
  }
  const data = d.data;
  const len = data.length;
  let r = 0;
  for (let i = 0; i < len; i++) {
    if (data[i] !== 0) {
      let n = data[i];
      r = i * Constants.RDIGITS;
      while (n % 10 === 0) {
        n /= 10 | 0;
        r++;
      }
      break;
    }
  }
  return r;
};

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

/**
 * Compare decimal u to v, returning the following:
 *
 *  -1   if  u &lt; v
 *   0   if  u = v
 *   1   if  u &gt; v
 *
 * If the abs flag is true compare the absolute values.
 *
 * Any NAN argument will always return -1.
 *
 * @public
 */
export const decimalCompare = (un: DecimalArg, vn: DecimalArg, abs: boolean = false): number => {
  let u = decimal(un);
  let v = decimal(vn);

  if (u.flag || v.flag) {
    // NAN is never equal to itself or any other value
    if (u.flag === DecimalFlag.NAN || v.flag === DecimalFlag.NAN) {
      return -1;
    }

    // INFINITY

    // Infinities can be equal if their sign matches
    if (u.flag === v.flag) {
      return u.sign === v.sign ? 0 : u.sign === -1 ? -1 : 1;
    }

    // Negative infinity before all other values
    // Positive infinity after all other values
    return u.flag === DecimalFlag.INFINITY ? (u.sign === -1 ? -1 : 1) : v.sign === -1 ? 1 : -1;
  }

  u = stripTrailingZeros(u);
  v = stripTrailingZeros(v);

  const uz = isZero(u);
  const vz = isZero(v);
  if (uz && vz) {
    return 0;
  }

  const us = u.sign;
  const vs = v.sign;
  if (!abs && us !== vs) {
    return us === -1 ? -1 : 1;
  }

  // Opposite signs were handled above, so u and v share a sign: zero is
  // never equal to a non-zero value of the same sign, and for negative
  // values zero sorts after them.
  if (uz || vz) {
    if (abs) {
      return uz ? -1 : 1;
    }
    return us === -1 ? (uz ? 1 : -1) : uz ? -1 : 1;
  }

  const ue = alignexp(u);
  const ve = alignexp(v);
  if (ue !== ve) {
    if (abs) {
      return ue < ve ? -1 : 1;
    }
    return ue < ve ? -1 * us : us;
  }

  if (u.exp !== v.exp) {
    const shift = u.exp - v.exp;
    if (shift > 0) {
      // Data cannot be equal here
      return -compare(v.data, u.data, shift);
    }
    return compare(u.data, v.data, -shift);
  }

  // Same number of radix digits.
  let i = u.data.length - 1;
  while (i >= 0) {
    const a = u.data[i];
    const b = v.data[i];
    if (a !== b) {
      return (a < b ? -1 : 1) * (abs ? 1 : u.sign);
    }
    i--;
  }

  // Equal
  return 0;
};

// ---------------------------------------------------------------------------
// Sign
// ---------------------------------------------------------------------------

/**
 * Return the absolute value of the number.
 *
 * @public
 */
export const decimalAbs = (n: DecimalArg): Decimal => {
  const d = decimal(n);
  return d.sign === -1 ? make(d.data.slice(), -d.sign, d.exp, d.flag) : d;
};

/**
 * Invert the number's sign.
 *
 * @public
 */
export const decimalNegate = (n: DecimalArg): Decimal => negate(decimal(n));

const negate = (d: Decimal): Decimal =>
  d.flag === DecimalFlag.NAN ? d : make(d.data.slice(), -d.sign, d.exp, d.flag);

// ---------------------------------------------------------------------------
// Arithmetic
// ---------------------------------------------------------------------------

/**
 * Adds u and v.
 *
 * @public
 */
export const decimalAdd = (un: DecimalArg, vn: DecimalArg): Decimal => {
  const u = decimal(un);
  const v = decimal(vn);
  const r = handleFlags(Op.ADDITION, u, v);
  if (r === undefined) {
    if (isZero(u)) {
      return v;
    }
    return isZero(v) ? u : addsub(u, v, v.sign);
  }
  return r;
};

/**
 * Subtracts v from u.
 *
 * @public
 */
export const decimalSubtract = (un: DecimalArg, vn: DecimalArg): Decimal => {
  const u = decimal(un);
  const v = decimal(vn);
  const r = handleFlags(Op.SUBTRACTION, u, v);
  if (r === undefined) {
    if (isZero(u)) {
      return negate(v);
    }
    return isZero(v) ? u : addsub(u, v, -v.sign);
  }
  return r;
};

/**
 * Multiplies u by v with optional math context.
 *
 * @public
 */
export const decimalMultiply = (un: DecimalArg, vn: DecimalArg, context?: MathContext): Decimal => {
  const [usePrecision, scaleprec, rounding] = parseMathContext('half-even', context);
  const u = decimal(un);
  const v = decimal(vn);
  const r = handleFlags(Op.MULTIPLICATION, u, v);
  if (r !== undefined) {
    return r;
  }

  const w = make([0], u.sign === v.sign ? 1 : -1, u.exp + v.exp, DecimalFlag.NONE);

  const uz = isZero(u);
  const vz = isZero(v);
  if (uz || vz) {
    if (!usePrecision) {
      _setScale(w, scaleprec);
    }
    return w;
  }

  w.data = multiply(u.data, v.data);
  w.sign = u.sign === v.sign ? 1 : -1;
  trim(w);

  // Adjust coefficient to match precision
  if (usePrecision) {
    const delta = precision(w) - scaleprec;
    if (delta > 0) {
      _shiftright(w, delta, rounding);
    }
  } else {
    _setScale(w, scaleprec, rounding);
  }
  return w;
};

/**
 * Divide u by v with optional math context.
 *
 * @public
 */
export const decimalDivide = (un: DecimalArg, vn: DecimalArg, context?: MathContext): Decimal => {
  let u = decimal(un);
  let v = decimal(vn);
  const r = handleFlags(Op.DIVISION, u, v);
  if (r !== undefined) {
    return r;
  }

  const [usePrecision, scaleprec, rounding] = parseMathContext('half-even', context);

  const sign = u.sign === v.sign ? 1 : -1;

  const shift = usePrecision
    ? precision(v) - precision(u) + scaleprec + 2
    : precision(v) + precision(u) + Math.abs(scaleprec) + 2;

  const exp = u.exp - v.exp - shift;

  if (shift > 0) {
    u = shiftleft(u, shift);
  } else if (shift < 0) {
    v = shiftleft(v, -shift);
  }

  const [q, rem] = divide(u.data, v.data);

  const w = make(q.slice(), sign, exp, 0);
  trim(w);

  const hasrem = rem.length && !allzero(rem, rem.length);
  if (hasrem) {
    const lsd = w.data[0] % 10;
    if (lsd === 0 || lsd === 5) {
      w.data[0]++;
    }
  }

  if (usePrecision) {
    // Adjust precision to match context
    const delta = precision(w) - scaleprec;
    if (delta > 0) {
      _shiftright(w, delta, rounding);
    }
  } else {
    // Adjust scale to match context
    _setScale(w, scaleprec, rounding);
  }
  if (usePrecision) {
    _stripTrailingZeros(w);
  }
  return w;
};

/**
 * Divide u by v and return the quotient and remainder.
 *
 * @public
 */
export const decimalDivmod = (un: DecimalArg, vn: DecimalArg): [Decimal, Decimal] =>
  divmod(decimal(un), decimal(vn));

const divmod = (orig: Decimal, vd: Decimal): [Decimal, Decimal] => {
  let v = vd;
  const rq = handleFlags(Op.DIVISION, orig, v);
  if (rq !== undefined) {
    const rm = handleFlags(Op.MOD, orig, v)!;
    return [rq, rm];
  }

  let u: Decimal = orig;

  const exp = u.exp > v.exp ? v.exp : u.exp;
  if (u.exp !== v.exp) {
    const shift = u.exp - v.exp;
    if (shift > 0) {
      u = shiftleft(u, shift);
    } else {
      v = shiftleft(v, -shift);
    }
  }

  // Ensure u digits are >= v
  const dsize = v.data.length - u.data.length;
  if (dsize > 0) {
    const ud = copy(u);
    for (let i = 0; i < dsize; i++) {
      ud.data.push(0);
    }
    u = ud;
  }

  const [qd, rd] = divide(u.data, v.data);

  const q = make(qd, u.sign === v.sign ? 1 : -1, 0, DecimalFlag.NONE);
  const r = make(rd, u.sign, exp, DecimalFlag.NONE);
  return [trim(q), trim(r)];
};

/**
 * Divide u by v and return the remainder.
 *
 * @public
 */
export const decimalMod = (un: DecimalArg, vn: DecimalArg): Decimal => {
  const u = decimal(un);
  const v = decimal(vn);
  const r = handleFlags(Op.MOD, u, v);
  return r === undefined ? divmod(u, v)[1] : r;
};

/**
 * Return the integer part.
 *
 * @public
 */
export const decimalToInteger = (n: DecimalArg): Decimal => {
  const d = decimal(n);
  return d.flag ? d : setScale(d, 0, 'down');
};

/**
 * Increment the least-significant integer digit.
 *
 * @public
 */
export const decimalIncrement = (n: DecimalArg): Decimal => {
  const d = decimal(n);
  if (d.flag) {
    return d;
  }
  const r = copy(d);
  if (r.sign === -1 || r.exp !== 0) {
    return decimalAdd(r, ONE);
  }
  _increment(r);
  return r;
};

/**
 * Decrement the least-significant integer digit.
 *
 * @public
 */
export const decimalDecrement = (n: DecimalArg): Decimal => {
  const d = decimal(n);
  return d.flag ? d : decimalSubtract(d, ONE);
};

// ---------------------------------------------------------------------------
// Scale, precision and shifting
// ---------------------------------------------------------------------------

/**
 * Strip all trailing zeros.
 *
 * @public
 */
export const decimalStripTrailingZeros = (n: DecimalArg): Decimal => stripTrailingZeros(decimal(n));

const stripTrailingZeros = (d: Decimal): Decimal => {
  if (d.flag) {
    return d;
  }
  const r = copy(d);
  _stripTrailingZeros(r);
  return r;
};

/**
 * Return a scientific representation of the number,
 * Decimal coefficient and adjusted exponent, such that
 * value = coefficient * 10^exponent.
 *
 * @param minIntDigits Minimum number of integer digits in
 *   the coefficient. Must be >= 1; values < 1 are clamped to 1.
 *
 * @public
 */
export const decimalScientific = (n: DecimalArg, minIntDigits: number = 1): [Decimal, number] => {
  const d = decimal(n);
  if (d.flag) {
    return [d, 0];
  }
  minIntDigits = minIntDigits <= 1 ? 1 : minIntDigits;
  const exp = -(precision(d) - 1) + (minIntDigits - 1);
  // ensure exponent is not negative zero
  const coeff = make(d.data.slice(), d.sign, exp === 0 ? 0 : exp, d.flag);
  return [coeff, d.exp - coeff.exp];
};

/**
 * Returns a new number with the given scale, shifting the coefficient as needed.
 *
 * @public
 */
export const decimalSetScale = (
  n: DecimalArg,
  scale: number,
  roundingMode: RoundingModeType = 'half-even',
): Decimal => setScale(decimal(n), scale, roundingMode);

const setScale = (d: Decimal, scale: number, roundingMode: RoundingModeType): Decimal => {
  if (d.flag) {
    return d;
  }
  const r = copy(d);
  _setScale(r, floor(scale), roundingMode);
  return r;
};

/**
 * Move the decimal point -n (left) or +n (right) places. Does not change
 * precision, only affects the exponent.
 *
 * @public
 */
export const decimalMovePoint = (n: DecimalArg, places: number): Decimal => {
  const d = decimal(n);
  if (d.flag) {
    return d;
  }
  const w = copy(d);
  w.exp += floor(places);
  return w;
};

/**
 * Shifts all digits to the left, increasing the precision.
 *
 * @public
 */
export const decimalShiftleft = (n: DecimalArg, shift: number): Decimal =>
  shiftleft(decimal(n), shift);

const shiftleft = (d: Decimal, shift: number): Decimal => {
  if (d.flag) {
    return d;
  }
  const w = copy(d);
  _shiftleft(w, floor(shift));
  return w;
};

/**
 * Shifts all digits to the right, reducing the precision. Result is rounded
 * using the given rounding mode.
 *
 * @public
 */
export const decimalShiftright = (
  n: DecimalArg,
  shift: number,
  mode: RoundingModeType = 'half-even',
): Decimal => {
  const d = decimal(n);
  if (d.flag) {
    return d;
  }
  const w = copy(d);
  _shiftright(w, floor(shift), mode);
  return w;
};

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format the number to a string, using fixed point.
 *
 * @public
 */
export const decimalToString = (n: DecimalArg): string => {
  const d = decimal(n);
  return d.flag ? formatFlags(d) : formatString(d, 1);
};

/**
 * Format the number to scientific notation as a string.
 *
 * @param minIntegers Minimum number of integer digits in the
 *   coefficient. Must be >= 1; values < 1 are clamped to 1.
 *
 * @public
 */
export const decimalToScientificString = (n: DecimalArg, minIntegers: number = 1): string => {
  const d = decimal(n);
  if (d.flag) {
    return formatFlags(d);
  }
  const [coeff, exp] = decimalScientific(d, minIntegers);
  const r = formatString(coeff, minIntegers);
  return isZero(coeff) ? r : exp === 0 ? r : r + `E${exp > 0 ? '+' : ''}${exp}`;
};

/**
 * Format the number to an array of parts.
 *
 * @public
 */
export const decimalToParts = (n: DecimalArg): Part[] => {
  const d = decimal(n);
  return d.flag ? formatFlagsParts(d) : formatParts(d, 1);
};

/**
 * Format the number to scientific notation as an array of parts.
 *
 * @param minIntegers Minimum number of integer digits in the
 *   coefficient. Must be >= 1; values < 1 are clamped to 1.
 *
 * @public
 */
export const decimalToScientificParts = (n: DecimalArg, minIntegers: number = 1): Part[] => {
  const d = decimal(n);
  if (d.flag) {
    return formatFlagsParts(d);
  }
  const [coeff, exp] = decimalScientific(d, minIntegers);
  const r = formatParts(coeff, minIntegers);
  if (isZero(coeff) || exp === 0) {
    return r;
  }
  const sign = exp < 0 ? { type: 'minus', value: '-' } : { type: 'plus', value: '+' };
  return r.concat([
    { type: 'exp', value: 'E' },
    sign,
    { type: 'integer', value: `${Math.abs(exp)}` },
  ]);
};

/**
 * Low-level formatting of string and Part[] forms. Digits are passed to the formatter
 * from least- to most-significant.
 *
 * @public
 */
export const decimalFormat = <R>(
  n: DecimalArg,
  formatter: DecimalFormatter<R>,
  decimalSep: string,
  group: string,
  minInt: number,
  minGroup: number,
  priGroup: number,
  secGroup: number,
  zeroScale: boolean,
  digits: string[] = DECIMAL_DIGITS,
): void => {
  const d = decimal(n);
  const data = d.data;

  // Determine if grouping is enabled, and set the primary and
  // secondary group sizes.
  const grouping = group !== '';
  if (secGroup <= 0) {
    secGroup = priGroup;
  }

  let exp = d.exp;

  // Determine how many integer digits to emit. If integer digits is
  // larger than the integer coefficient we emit leading zeros.
  let int = data.length === 1 && data[0] === 0 ? 1 : precision(d) + exp;

  if (minInt <= 0 && decimalCompare(d, ONE, true) === -1) {
    // If the number is between 0 and 1 and format requested minimum
    // integer digits of zero, don't emit a leading zero digit.
    int = 0;
  } else {
    int = Math.max(int, minInt);
  }

  // Array to append digits in reverse order
  const len = data.length;
  let groupSize = priGroup;
  let emitted = 0;

  // Determine if grouping should be active.
  const groupActive = grouping && priGroup > 0 && int >= minGroup + priGroup;
  const groupFunc = (): void => {
    if (groupActive && emitted > 0 && emitted % groupSize === 0) {
      // Push group character, reset emitted digits, and switch
      // to secondary grouping size.
      formatter.add(group);
      emitted = 0;
      groupSize = secGroup;
    }
  };

  // Push trailing zeros for a positive exponent, only if the number
  // is non-zero
  let zeros = exp;
  if (!(data.length === 1 && data[0] === 0)) {
    while (zeros > 0) {
      formatter.add(digits[0]);
      emitted++;
      groupFunc();
      int--;
      zeros--;
    }
  } else if (zeroScale && exp < 0) {
    // Handle sign of zero which means we have exactly '0'. If we
    // have the 'zeroScale' flag set, a negative exponent here will
    // emit zeros after the decimal point.
    while (exp < 0) {
      exp++;
      formatter.add(digits[0]);
    }
    formatter.add(decimalSep);
  }

  // Scan coefficient from least- to most-significant digit.
  const last = len - 1;
  for (let i = 0; i < len; i++) {
    // Count the decimal digits c in this radix digit d
    let w = data[i];
    const c = i === last ? digitCount(w) : Constants.RDIGITS;

    // Loop over the decimal digits
    for (let j = 0; j < c; j++) {
      // Push decimal digit
      formatter.add(digits[w % 10]);
      w = (w / 10) | 0;

      // When we've reached exponent of 0, push the decimal point.
      exp++;
      if (exp === 0) {
        formatter.add(decimalSep);
      }

      // Decrement integer, increment emitted digits when exponent is positive, to
      // trigger grouping logic. We only do this once exp has become positive to
      // avoid counting emitted digits for decimal part.
      if (exp > 0) {
        emitted++;
        int--;
        if (int > 0) {
          groupFunc();
        }
      }
    }
  }

  // If exponent still negative, emit leading decimal zeros
  while (exp < 0) {
    formatter.add(digits[0]);

    // When we've reached exponent of 0, push the decimal point
    exp++;
    if (exp === 0) {
      formatter.add(decimalSep);
    }
  }

  // Leading integer zeros
  while (int > 0) {
    formatter.add(digits[0]);
    emitted++;
    int--;
    if (int > 0) {
      groupFunc();
    }
  }
};

const formatFlags = (d: Decimal): string => {
  switch (d.flag) {
    case DecimalFlag.NAN:
      return 'NaN';
    case DecimalFlag.INFINITY:
    default:
      return d.sign === 1 ? 'Infinity' : '-Infinity';
  }
};

const formatFlagsParts = (d: Decimal): Part[] => {
  switch (d.flag) {
    case DecimalFlag.NAN:
      return [{ type: 'nan', value: 'NaN' }];
    case DecimalFlag.INFINITY:
    default: {
      const s = d.sign === 1 ? 'Infinity' : '-Infinity';
      return [{ type: 'infinity', value: s }];
    }
  }
};

const formatString = (d: Decimal, minInt: number): string => {
  const f = stringDecimalFormatter();
  decimalFormat(d, f, '.', '', minInt, 1, 3, 3, true);
  const r = f.render();
  return d.sign === -1 ? '-' + r : r;
};

const formatParts = (d: Decimal, minInt: number): Part[] => {
  const f = partsDecimalFormatter('.', '');
  decimalFormat(d, f, '.', '', minInt, 1, 3, 3, true);
  const r = f.render();
  return d.sign === -1 ? [{ type: 'minus', value: '-' }].concat(r) : r;
};

// ---------------------------------------------------------------------------
// Internals (operate on fresh drafts)
// ---------------------------------------------------------------------------

/**
 * Handle setting of flags for operations per the IEEE-754-2008 specification.
 * These rules are also referenced in the EcmaScript specification:
 *
 * 12.7.3.1 - Applying the mul operator:
 * https://tc39.github.io/ecma262/#sec-applying-the-mul-operator
 *
 * 12.7.3.2 - Applying the div operator:
 * https://tc39.github.io/ecma262/#sec-applying-the-div-operator
 *
 * 12.7.3.3 - Applying the mod operator:
 * https://tc39.github.io/ecma262/#sec-applying-the-mod-operator
 *
 * 12.8.5 - Applying the additive operators to numbers:
 * https://tc39.github.io/ecma262/#sec-applying-the-additive-operators-to-numbers
 */
const handleFlags = (op: Op, u: Decimal, v: Decimal): Decimal | undefined => {
  const uflag = u.flag;
  const vflag = v.flag;

  // Any operation involving a NAN returns a NAN
  if (uflag === DecimalFlag.NAN || vflag === DecimalFlag.NAN) {
    return NAN;
  }

  const uinf = uflag === DecimalFlag.INFINITY;
  const vinf = vflag === DecimalFlag.INFINITY;
  const uzero = isZero(u);
  const vzero = isZero(v);

  switch (op) {
    case Op.ADDITION:
      if (uinf && vinf) {
        return u.sign === v.sign ? (u.sign === 1 ? POSITIVE_INFINITY : NEGATIVE_INFINITY) : NAN;
      } else if (uinf || vinf) {
        return uinf ? u : v;
      }
      break;

    case Op.SUBTRACTION:
      if (uinf && vinf) {
        return u.sign === v.sign ? NAN : u.sign === 1 ? POSITIVE_INFINITY : NEGATIVE_INFINITY;
      } else if (uinf || vinf) {
        return uinf
          ? u.sign === 1
            ? POSITIVE_INFINITY
            : NEGATIVE_INFINITY
          : v.sign === 1
            ? NEGATIVE_INFINITY
            : POSITIVE_INFINITY;
      }
      break;

    case Op.MULTIPLICATION:
      if (uinf) {
        return vzero ? NAN : u.sign === v.sign ? POSITIVE_INFINITY : NEGATIVE_INFINITY;
      }
      if (vinf) {
        return uzero ? NAN : u.sign === v.sign ? POSITIVE_INFINITY : NEGATIVE_INFINITY;
      }
      break;

    case Op.DIVISION:
      if (uinf && vinf) {
        return NAN;
      }
      if (uinf) {
        return vzero
          ? u.sign === 1
            ? POSITIVE_INFINITY
            : NEGATIVE_INFINITY
          : u.sign === v.sign
            ? POSITIVE_INFINITY
            : NEGATIVE_INFINITY;
      }
      if (vinf) {
        // x / +/-Infinity is zero with the sign of the quotient (IEEE 754 /
        // ECMAScript div).
        return make([0], u.sign === v.sign ? 1 : -1, 0, DecimalFlag.NONE);
      }
      if (vzero) {
        return uzero ? NAN : u.sign === 1 ? POSITIVE_INFINITY : NEGATIVE_INFINITY;
      }
      break;

    case Op.MOD:
      if (uinf || vzero) {
        return NAN;
      }
      if (!uinf && vinf) {
        return u;
      }
      if (uzero && !vzero && !vinf) {
        return u;
      }
      break;
  }

  return undefined;
};

/**
 * Mutating in-place shift left.
 */
const _shiftleft = (w: Draft, shift: number): void => {
  if (shift <= 0) {
    return;
  }
  const prec = precision(w);
  const data = w.data.slice();

  let m = data.length;

  // Compute the shift in terms of our radix.
  const q = (shift / Constants.RDIGITS) | 0;
  const r = shift - q * Constants.RDIGITS;

  // Expand w to hold shifted result and zero all elements.
  let n = size(prec + shift);
  w.data = new Array(n);
  w.data.fill(0);

  // Trivial case where shift is a multiple of our radix.
  if (r === 0) {
    while (--m >= 0) {
      w.data[m + q] = data[m];
    }
    return;
  }

  // Shift divided by radix leaves a remainder.
  const powlo = POWERS10[r];
  const powhi = POWERS10[Constants.RDIGITS - r];
  let hi = 0;
  let lo = 0;
  let loprev = 0;

  n--;
  m--;
  hi = (data[m] / powhi) | 0;
  loprev = data[m] - hi * powhi;
  if (hi !== 0) {
    w.data[n] = hi;
    n--;
  }
  m--;

  // Divmod each element of u, copying the hi/lo parts to w.
  for (; m >= 0; m--, n--) {
    hi = (data[m] / powhi) | 0;
    lo = data[m] - hi * powhi;
    w.data[n] = powlo * loprev + hi;
    loprev = lo;
  }

  w.data[q] = powlo * loprev;
};

/**
 * Mutating in-place shift right.
 */
const _shiftright = (w: Draft, shift: number, mode: RoundingModeType): void => {
  if (shift <= 0) {
    return;
  }
  if (isZero(w)) {
    w.exp += shift;
    return;
  }

  const prec = precision(w);

  // Check if shift exceeds precision, so all digits are shifted to
  // zero with no rounding possible. Just set zero and bump the exponent.
  if (prec < shift) {
    w.data = [0];
    w.exp += shift;
    return;
  }

  // We only want to round up when there is a free zero integer
  // digit to the left. We do this when the number is < 0 or
  // we're not shifting out all of the digits.
  const round = alignexp(w) < 0 || prec !== shift;
  const [q, r] = divword(shift, Constants.RDIGITS);

  const data = w.data.slice();
  w.data.fill(0);

  // check if we divided evenly
  let i = 0,
    j = 0;
  let rnd = 0,
    rest = 0;

  if (r === 0) {
    // q is always non-zero here, else there would be no shift
    [rnd, rest] = divpow10(data[q - 1], Constants.RDIGITS - 1);
    if (rest === 0) {
      rest = allzero(data, q - 1) === 0 ? 1 : 0;
    }
    for (j = 0; j < data.length - q; j++) {
      w.data[j] = data[q + j];
    }
  } else {
    let hiprev = 0;
    const ph = POWERS10[Constants.RDIGITS - r];
    // q is always < data.length here; otherwise r == 0
    [hiprev, rest] = divpow10(data[q], r);
    [rnd, rest] = divpow10(rest, r - 1);
    if (rest === 0 && q > 0) {
      rest = allzero(data, q) === 0 ? 1 : 0;
    }

    for (j = 0, i = q + 1; i < data.length; i++, j++) {
      const [hi, lo] = divpow10(data[i], r);
      w.data[j] = ph * lo + hiprev;
      hiprev = hi;
    }
    if (hiprev !== 0) {
      w.data[j] = hiprev;
    }
  }

  trim(w);
  w.exp += shift;

  if (round && roundIndicator(w, rnd, rest, mode)) {
    // If precision changes due to rounding, subtract from exponent
    _increment(w);
  }
};

const _setScale = (w: Draft, scale: number, roundingMode: RoundingModeType = 'half-even'): void => {
  const diff = scale - scaleOf(w);
  if (diff > 0) {
    _shiftleft(w, diff);
  } else {
    _shiftright(w, -diff, roundingMode);
  }
  w.exp = scale === 0 ? 0 : -scale;
  trim(w);
};

const scaleOf = scale;

const _stripTrailingZeros = (w: Draft): void => {
  let n = 0;
  // Special case for zero with negative exponent
  if (w.data.length === 1 && w.data[0] === 0 && w.exp < 0) {
    n = -w.exp;
  } else {
    n = trailingZeros(w);
  }
  if (n > 0) {
    _shiftright(w, n, 'down');
  }
};

/**
 * Trim leading zeros from a result.
 */
const trim = (w: Draft): Draft => {
  trimLeadingZeros(w.data);
  return w;
};

/**
 * Increment the least-significant digit of the coefficient.
 */
const _increment = (w: Draft): void => {
  const d = w.data;
  const len = d.length;
  let s = 0;
  let k = 1;
  for (let i = 0; k === 1 && i < len; i++) {
    s = d[i] + k;
    k = s === Constants.RADIX ? 1 : 0;
    d[i] = k ? 0 : s;
  }
  if (k === 1) {
    d.push(1);
  }
};

/**
 * Return a rounding indicator for a given rounding mode,
 */
const roundIndicator = (w: Decimal, rnd: number, rest: number, mode: RoundingModeType): number => {
  if (rest !== 0 && (rnd === 0 || rnd === 5)) {
    rnd++;
  }
  switch (mode) {
    case 'up':
      // round away from zero
      return Number(rnd !== 0);
    case 'down':
      // round towards zero
      return 0;
    case 'ceiling':
      // round towards positive infinity
      return Number(!(rnd === 0 || w.sign === -1));
    case 'floor':
      // round towards negative infinity
      return Number(!(rnd === 0 || w.sign >= 0));
    case 'half-up':
      // if n >= 5 round up; otherwise round down
      return Number(rnd >= 5);
    case 'half-down':
      // if n > 5 round up; otherwise round down
      return Number(rnd > 5);
    case 'half-even':
      // if n = 5 and digit to left of n is odd round up; if even round down
      return Number(rnd > 5 || (rnd === 5 && w.data.length > 0 && w.data[0] % 2 === 1));
    default:
      return 0;
  }
};

/**
 * Addition and subtraction.
 */
const addsub = (u: Decimal, v: Decimal, vsign: number): Decimal => {
  let m = u; // m = bigger
  let n = v; // n = smaller
  let swap = 0;
  if (m.exp < n.exp) {
    [m, n] = [n, m];
    swap++;
  }

  const shift = m.exp - n.exp;
  m = shiftleft(m, shift);

  const w = make([0], 0, n.exp, DecimalFlag.NONE);

  if (m.data.length < n.data.length) {
    [m, n] = [n, m];
    swap++;
  }

  if (u.sign === vsign) {
    w.data = add(m.data, n.data);
    w.sign = vsign;
  } else {
    const ulen = m.data.length;
    const vlen = n.data.length;
    if (ulen === vlen) {
      for (let i = ulen - 1; i >= 0; i--) {
        if (m.data[i] !== n.data[i]) {
          if (m.data[i] < n.data[i]) {
            [m, n] = [n, m];
            swap++;
          }
          break;
        }
      }
    }
    w.data = subtract(m.data, n.data);
    w.sign = (swap & 1) === 1 ? vsign : m.sign;
  }
  return trim(w);
};

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a number or string into a decimal value. Throws on invalid input.
 */
const parse = (arg: string | number): Decimal => {
  if (typeof arg === 'number') {
    if (isNaN(arg)) {
      return make(EMPTY, 0, 0, DecimalFlag.NAN);
    }
    if (!isFinite(arg)) {
      return make(EMPTY, arg === Infinity ? 1 : -1, 0, DecimalFlag.INFINITY);
    }
  }

  const str: string = typeof arg === 'string' ? arg : arg.toString();
  const r = parseString(str);
  if (typeof r === 'string') {
    throw new Error(r);
  }
  return r;
};

/**
 * Parse a string into a Decimal, or return an error message.
 *
 * Expects strings of the form:
 *    "[-+][digits][.][digits][eE][-+][digits]"
 * or:
 *    "[nN]a[nN]"        for a NaN
 *    "[-+]?[iI]nfinity" for positive or negative infinity
 */
const parseString = (str: string): Decimal | string => {
  if (NAN_VALUES.indexOf(str) !== -1) {
    return make(EMPTY, 0, 0, DecimalFlag.NAN);
  }
  if (POS_INFINITY.indexOf(str) !== -1) {
    return make(EMPTY, 1, 0, DecimalFlag.INFINITY);
  }
  if (NEG_INFINITY.indexOf(str) !== -1) {
    return make(EMPTY, -1, 0, DecimalFlag.INFINITY);
  }

  // Local variables to accumulate digits, sign and exponent
  const data: number[] = [];

  // Default sign is 1. Negative sign is -1. NaN sign is 0.
  let sign = 1;
  let exp = 0;

  // Flags to control parsing, raise errors.
  let flags = 0;

  // Current number being parsed.
  let n = 0;

  // Index of power for current digit.
  let z = 0;

  // Pointer to the current character being parsed.
  let i = str.length - 1;

  // Total number of digits parsed.
  let dig = 0;

  // We parse from the end to avoid multiple passes or splitting of the
  // input string.
  while (i >= 0) {
    const code = str.charCodeAt(i);
    switch (code) {
      case Chars.ELOWER:
      case Chars.EUPPER: {
        if (flags & ParseFlags.EXP) {
          return `Extra exponent character at ${i}`;
        }
        if (dig > Constants.RDIGITS) {
          // Exponent is currently limited to the size of Constants.RADIX
          return 'Exponent too large';
        }
        if (dig === 0) {
          return 'Exponent not provided';
        }
        // Indicate we have an exponent, and clear the sign flag.
        flags |= ParseFlags.EXP;
        flags &= ~ParseFlags.SIGN;

        // Copy the parsed number to the exponent and reset the digit count.
        // An exponent of exactly RDIGITS digits has already spilled into
        // `data` as a full limb (n === 0), so take the value from there and
        // clear the limbs so the mantissa starts fresh.
        const expValue = dig === Constants.RDIGITS ? data[0] : n;
        dig = 0;
        exp = sign === -1 ? -expValue : expValue;
        sign = 1;
        n = 0;
        z = 0;
        data.length = 0;
        break;
      }

      case Chars.MINUS:
      case Chars.PLUS:
        if (dig === 0) {
          return 'Found a bare sign symbol';
        }
        if (flags & ParseFlags.SIGN) {
          return `Duplicate sign character at ${i}`;
        }
        // A sign belongs at the start of the number or of the exponent: "1-2" is invalid.
        if (i > 0) {
          const prev = str.charCodeAt(i - 1);
          if (prev !== Chars.ELOWER && prev !== Chars.EUPPER) {
            return `Misplaced sign character at ${i}`;
          }
        }
        sign = code === Chars.MINUS ? -1 : 1;
        flags |= ParseFlags.SIGN;
        break;

      case Chars.DOT:
        if (flags & ParseFlags.POINT) {
          return `Extra radix point seen at ${i}`;
        }
        flags |= ParseFlags.POINT;
        exp -= dig;
        break;

      case Chars.DIGIT0:
      case Chars.DIGIT1:
      case Chars.DIGIT2:
      case Chars.DIGIT3:
      case Chars.DIGIT4:
      case Chars.DIGIT5:
      case Chars.DIGIT6:
      case Chars.DIGIT7:
      case Chars.DIGIT8:
      case Chars.DIGIT9:
        n += (code - Chars.DIGIT0) * POWERS10[z];
        z++;
        dig++;
        if (z === Constants.RDIGITS) {
          data.push(n);
          n = 0;
          z = 0;
        }
        break;

      default:
        return `Unexpected character at ${i}: ${str[i]}`;
    }
    i--;
  }

  if (dig === 0) {
    return 'Number must include at least 1 digit';
  }

  data.push(n);
  return trim(make(data, sign === -1 ? -1 : 1, exp, DecimalFlag.NONE));
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ZERO = /*#__PURE__*/ parse('0');
const ONE = /*#__PURE__*/ parse('1');
const TWO = /*#__PURE__*/ parse('2');

// 105 digits of pi - https://oeis.org/A000796/constant
const PI = /*#__PURE__*/ parse(
  '3.141592653589793238462643383279502884197169399375105' +
    '82097494459230781640628620899862803482534211706798214',
);

// 105 digits of e - https://oeis.org/A001113/constant
const E = /*#__PURE__*/ parse(
  '2.718281828459045235360287471352662497757247093699959' +
    '57496696762772407663035354759457138217852516642742746',
);

const NAN = /*#__PURE__*/ parse(NaN);
const NEGATIVE_INFINITY = /*#__PURE__*/ parse(-Infinity);
const POSITIVE_INFINITY = /*#__PURE__*/ parse(Infinity);

/**
 * Common Decimal values as constants.
 *
 * @public
 */
export const DecimalConstants = {
  ZERO,
  ONE,
  TWO,
  PI,
  E,
  NAN,
  POSITIVE_INFINITY,
  NEGATIVE_INFINITY,
};
