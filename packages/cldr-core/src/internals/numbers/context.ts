import {
  type Decimal,
  decimalIsInteger,
  decimalPrecision,
  decimalScale,
  decimalSetScale,
  decimalStripTrailingZeros,
  type RoundingModeType,
} from '@phensley/decimal';
import type { NumberFormatOptions } from '../../common/numbers';
import type { NumberPattern } from '../../parsing/number';

/**
 * Number formatting parameters for a single format call, combining user-supplied options with
 * defaults based on modes and the number pattern. A short-lived mutable record: the
 * numberContext* functions update it in place.
 *
 * @internal
 */
export interface NumberContext {
  readonly options: NumberFormatOptions;
  readonly roundingMode: RoundingModeType;
  useSignificant: boolean;
  minInt: number;
  maxFrac: number;
  minFrac: number;
  maxSig: number;
  minSig: number;
  currencyDigits: number;
}

/**
 * @internal
 */
export const numberContext = (
  options: NumberFormatOptions,
  roundingMode: RoundingModeType,
  compact: boolean,
  scientific: boolean,
  currencyDigits: number = -1,
): NumberContext => {
  const o = options;
  // Determine if we should use default or significant digit modes. If we're in compact mode
  // we will use significant digits unless any fraction option is set. Otherwise we use
  // significant digits if any significant digit option is set.
  const optFrac = o.minimumFractionDigits !== undefined || o.maximumFractionDigits !== undefined;
  const optSig =
    o.minimumSignificantDigits !== undefined || o.maximumSignificantDigits !== undefined;
  return {
    options: o,
    roundingMode,
    useSignificant: (scientific && !optFrac) || (compact && !optFrac) || optSig,
    minInt: options.minimumIntegerDigits || -1,
    maxFrac: -1,
    minFrac: -1,
    maxSig: -1,
    minSig: -1,
    currencyDigits,
  };
};

/**
 * Set a pattern. The 'scientific' flag indicates the pattern uses significant
 * digits, which we will copy from the pattern's min/max fractions.
 *
 * @internal
 */
export const numberContextSetPattern = (
  ctx: NumberContext,
  pattern: NumberPattern,
  scientific: boolean = false,
): void => {
  setPatternImpl(ctx, pattern, scientific, -1, -1, -1);
};

/**
 * Set a compact pattern.
 *
 * @internal
 */
export const numberContextSetCompact = (
  ctx: NumberContext,
  pattern: NumberPattern,
  integerDigits: number,
  _divisor: number,
  maxFracDigits: number = -1,
): void => {
  let maxSigDigits = Math.max(pattern.minInt, integerDigits);
  if (integerDigits === 1) {
    maxSigDigits++;
  }
  setPatternImpl(ctx, pattern, false, maxSigDigits, 1, maxFracDigits);
};

/**
 * Adjust the scale of the number using the resolved parameters.
 *
 * @internal
 */
export const numberContextAdjust = (
  ctx: NumberContext,
  n: Decimal,
  scientific: boolean = false,
): Decimal => {
  // TODO: consider moving this logic into Decimal since it could be useful
  // to adjust a number using several options in a single pass. Could be
  // more efficient, making fewer copies.

  if (ctx.useSignificant && scientific) {
    if (ctx.minSig <= 0) {
      ctx.minSig = 1;
    }
    if (ctx.maxSig <= 0) {
      ctx.maxSig = 1;
    }
  }

  if (ctx.useSignificant && ctx.minSig >= 0) {
    // By default we assume maximum significant digits will equal the
    // number's default precision. So if the option's maxSig == -1
    // we ignore reducing the precision.
    if (ctx.maxSig !== -1 && decimalPrecision(n) > ctx.maxSig) {
      // Scale the number to have at most the maximum significant digits.
      const scale = ctx.maxSig - decimalPrecision(n) + decimalScale(n);
      n = decimalSetScale(n, scale, ctx.roundingMode);
    }
    n = decimalStripTrailingZeros(n);

    // scale the number to have at least the minimum significant digits
    const precision = decimalPrecision(n);
    if (precision < ctx.minSig) {
      const scale = ctx.minSig - precision + decimalScale(n);
      n = decimalSetScale(n, scale, ctx.roundingMode);
    }
  } else {
    // Precise control over number of integer and decimal digits to include, e.g. when
    // formatting exact currency values.
    const scale = Math.max(ctx.minFrac, Math.min(decimalScale(n), ctx.maxFrac));

    n = decimalSetScale(n, scale, ctx.roundingMode);
    n = decimalStripTrailingZeros(n);

    // If user hasn't requested minimum fraction digits, and requested to trim zero fractions,
    // and the number is an integer, force it to render as a whole number.
    if (
      ctx.options.trimZeroFractions &&
      !ctx.options.minimumFractionDigits &&
      decimalIsInteger(n)
    ) {
      // Trim zeros when whole number display is possible
      n = decimalSetScale(n, 0, ctx.roundingMode);
    } else if (decimalScale(n) < ctx.minFrac) {
      // Ensure minimum fraction digits is met.
      n = decimalSetScale(n, ctx.minFrac, ctx.roundingMode);
    }
  }

  return n;
};

/**
 * Set context parameters from options, pattern and significant digit arguments.
 */
const setPatternImpl = (
  ctx: NumberContext,
  pattern: NumberPattern,
  scientific: boolean,
  maxSigDigits: number,
  minSigDigits: number,
  maxFracDigits: number,
): void => {
  const o = ctx.options;

  // If minInt is not specified in options, always copy from pattern
  if (ctx.options.minimumIntegerDigits === undefined) {
    ctx.minInt = pattern.minInt;
  }
  ctx.minFrac = ctx.currencyDigits === -1 ? pattern.minFrac : ctx.currencyDigits;
  ctx.maxFrac = ctx.currencyDigits === -1 ? pattern.maxFrac : ctx.currencyDigits;

  const minFrac = o.minimumFractionDigits;
  let maxFrac = o.maximumFractionDigits;
  if (minFrac === undefined && maxFrac === undefined && maxFracDigits > -1) {
    maxFrac = maxFracDigits;
  }

  if (maxFrac !== undefined && maxFrac > -1) {
    ctx.maxFrac = maxFrac;
  }

  if (minFrac !== undefined && minFrac > -1) {
    ctx.minFrac =
      maxFrac !== undefined && maxFrac > -1 ? (maxFrac < minFrac ? maxFrac : minFrac) : minFrac;
    if (ctx.minFrac > ctx.maxFrac) {
      ctx.maxFrac = ctx.minFrac;
    }
  }

  if (maxFrac !== undefined && maxFrac > -1) {
    if (ctx.maxFrac < ctx.minFrac || ctx.minFrac === -1) {
      ctx.minFrac = ctx.maxFrac;
    }
  }

  if (ctx.useSignificant || scientific) {
    const optMinSig = o.minimumSignificantDigits;
    const optMaxSig = o.maximumSignificantDigits;

    let minSig = scientific
      ? orDefault(optMinSig, pattern.minFrac)
      : orDefault(optMinSig, minSigDigits);
    let maxSig = scientific
      ? orDefault(optMaxSig, pattern.maxFrac)
      : orDefault(optMaxSig, maxSigDigits);

    if (minSig !== -1 && maxSig !== -1 && minSig > maxSig) {
      maxSig = minSig;
    }
    if (minSig === -1) {
      minSig = maxSig;
    }
    ctx.minSig = minSig;
    ctx.maxSig = maxSig;
  } else {
    ctx.maxSig = -1;
    ctx.minSig = -1;
  }
};

const orDefault = (n: number | undefined, alt: number): number => (n === undefined ? alt : n);
