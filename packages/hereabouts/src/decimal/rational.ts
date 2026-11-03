import {
  type Decimal,
  type DecimalArg,
  DecimalConstants,
  decimal,
  decimalAdd,
  decimalCompare,
  decimalDivide,
  decimalMultiply,
  decimalNegate,
  decimalSubtract,
  decimalToString,
  isDecimal,
} from './decimal';
import type { MathContext } from './types';

/**
 * Arbitrary precision rational value: plain, immutable data. Use the `rational*` functions to
 * operate on it.
 *
 * @public
 */
export interface Rational {
  readonly numerator: Decimal;
  readonly denominator: Decimal;
}

/**
 * Valid argument for constructing a Rational value.
 *
 * @public
 */
export type RationalArg = Rational | Decimal | number | string;

/**
 * Default Rational parser, to identify named constants.
 */
const fromString = (s: string): Decimal => {
  switch (s.toLowerCase()) {
    case 'e':
      return DecimalConstants.E;
    case 'pi':
      return DecimalConstants.PI;
    default:
      return decimal(s);
  }
};

const coerce = (n: DecimalArg): Decimal => (typeof n === 'string' ? fromString(n) : decimal(n));

const make = (numerator: Decimal, denominator: Decimal): Rational => ({ numerator, denominator });

/**
 * Returns true if the argument is a Rational value.
 *
 * @public
 */
export const isRational = (x: any): x is Rational =>
  x !== null && typeof x === 'object' && isDecimal(x.numerator) && isDecimal(x.denominator);

/**
 * Construct a rational. A single string argument is parsed as "numerator / denominator"
 * (either side may be 'e' or 'pi').
 *
 * @public
 */
export const rational = (numerator: DecimalArg, denominator?: DecimalArg): Rational => {
  if (typeof numerator === 'string' && denominator === undefined) {
    const i = numerator.indexOf('/');
    return i === -1
      ? make(fromString(numerator), DecimalConstants.ONE)
      : make(
          fromString(numerator.substring(0, i).trim()),
          fromString(numerator.substring(i + 1).trim()),
        );
  }
  return make(
    coerce(numerator),
    coerce(denominator === undefined ? DecimalConstants.ONE : denominator),
  );
};

/**
 * Converts a valid argument into a Rational value.
 *
 * @public
 */
export const coerceRational = (n: RationalArg): Rational => {
  if (typeof n === 'number') {
    return rational(n, DecimalConstants.ONE);
  } else if (typeof n === 'string') {
    return rational(n);
  } else if (isRational(n)) {
    return n;
  }
  return rational(n, DecimalConstants.ONE);
};

/**
 * Compare u to v, returning -1, 0 or 1.
 *
 * @public
 */
export const rationalCompare = (
  un: RationalArg,
  vn: RationalArg,
  context?: MathContext,
): number => {
  const u = coerceRational(un);
  const v = coerceRational(vn);
  const a = decimalMultiply(u.numerator, v.denominator, context);
  const b = decimalMultiply(v.numerator, u.denominator, context);
  return decimalCompare(a, b);
};

/**
 * Add u and v.
 *
 * @public
 */
export const rationalAdd = (un: RationalArg, vn: RationalArg, context?: MathContext): Rational => {
  const u = coerceRational(un);
  const n = coerceRational(vn);
  return rational(
    decimalAdd(
      decimalMultiply(u.numerator, n.denominator, context),
      decimalMultiply(n.numerator, u.denominator, context),
    ),
    decimalMultiply(u.denominator, n.denominator, context),
  );
};

/**
 * Subtract v from u.
 *
 * @public
 */
export const rationalSubtract = (
  un: RationalArg,
  vn: RationalArg,
  context?: MathContext,
): Rational => {
  const u = coerceRational(un);
  const n = coerceRational(vn);
  return rational(
    decimalSubtract(
      decimalMultiply(u.numerator, n.denominator, context),
      decimalMultiply(n.numerator, u.denominator, context),
    ),
    decimalMultiply(u.denominator, n.denominator, context),
  );
};

/**
 * Invert the sign.
 *
 * @public
 */
export const rationalNegate = (un: RationalArg): Rational => {
  const u = coerceRational(un);
  return rational(decimalNegate(u.numerator), u.denominator);
};

/**
 * Divide u by v.
 *
 * @public
 */
export const rationalDivide = (
  un: RationalArg,
  vn: RationalArg,
  context?: MathContext,
): Rational => {
  const u = coerceRational(un);
  const n = coerceRational(vn);
  return rational(
    decimalMultiply(u.numerator, n.denominator, context),
    decimalMultiply(u.denominator, n.numerator, context),
  );
};

/**
 * Multiply u by v.
 *
 * @public
 */
export const rationalMultiply = (
  un: RationalArg,
  vn: RationalArg,
  context?: MathContext,
): Rational => {
  const u = coerceRational(un);
  const n = coerceRational(vn);
  return rational(
    decimalMultiply(u.numerator, n.numerator, context),
    decimalMultiply(u.denominator, n.denominator, context),
  );
};

/**
 * Swap numerator and denominator.
 *
 * @public
 */
export const rationalInverse = (un: RationalArg): Rational => {
  const u = coerceRational(un);
  return rational(u.denominator, u.numerator);
};

/**
 * Divide the numerator by the denominator.
 *
 * @public
 */
export const rationalToDecimal = (un: RationalArg, context?: MathContext): Decimal => {
  const u = coerceRational(un);
  return decimalDivide(u.numerator, u.denominator, context);
};

/**
 * Format as "numerator / denominator".
 *
 * @public
 */
export const rationalToString = (un: RationalArg): string => {
  const u = coerceRational(un);
  return `${decimalToString(u.numerator)} / ${decimalToString(u.denominator)}`;
};

/**
 * Common Rational values as constants.
 *
 * @public
 */
export const RationalConstants = {
  ZERO: /*#__PURE__*/ rational(0, 1),
  ONE: /*#__PURE__*/ rational(1, 1),
};
