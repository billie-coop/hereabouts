import {
  type Decimal,
  decimalAbs,
  decimalDivide,
  decimalIntegerDigits,
  decimalIsNegative,
  decimalIsZero,
  decimalMovePoint,
  decimalMultiply,
  decimalScientific,
  decimalSetScale,
  decimalShiftright,
} from '../../../decimal';
import { pluralCardinal } from '../../../plurals';
import type {
  AltType,
  CurrencyType,
  DigitsArrow,
  NumberSystemInfo,
  PluralType,
} from '../../../types';
import { type Cache, cacheGet, createCache } from '../../../utils';
import type {
  CurrencyFormatOptions,
  DecimalAdjustOptions,
  DecimalFormatOptions,
} from '../../common/numbers';
import type { NumberParams } from '../../common/private';
import type { LocaleData } from '../../locale-data';
import { type NumberPattern, parseNumberPattern } from '../../parsing/number';
import { digitsGet, fieldGet, scopeGet, vectorGet, vectorValid } from '../../schema/schema/arrows';
import { PATTERN_CACHE_SIZE } from '../general/internal';
import type { NumberRenderer } from '../internals';
import {
  type NumberContext,
  numberContext,
  numberContextAdjust,
  numberContextSetCompact,
  numberContextSetPattern,
} from './context';
import { getCurrencyFractions } from './util';

let adjustPattern: NumberPattern | undefined;

let numberPatternCache: Cache<readonly [NumberPattern, NumberPattern]> | undefined;

/**
 * If n is zero check if it is signed and return abs.
 */
const negzero = (n: Decimal, show?: boolean): Decimal =>
  !show && decimalIsZero(n) && decimalIsNegative(n) ? decimalAbs(n) : n;

/**
 * @internal
 */
export const adjustNumber = (num: Decimal, options: DecimalAdjustOptions = {}): Decimal => {
  options = Object.assign({}, { minInt: 0 }, options);
  const ctx = numberContext(options, options.round || 'half-even', false, false);
  numberContextSetPattern(ctx, adjustPattern || (adjustPattern = parseNumberPattern('0')[0]));
  return numberContextAdjust(ctx, num);
};

/**
 * Currency symbol, falling back to the code itself for valid codes without a symbol.
 *
 * @internal
 */
export const currencySymbol = (data: LocaleData, code: CurrencyType, alt: AltType): string => {
  const sym = data.schema.Currencies.symbol;
  return vectorGet(sym, data, [alt, 'none'], code) || (vectorValid(sym, 'none', code) ? code : '');
};

/**
 * @internal
 */
export const currencyDisplayName = (data: LocaleData, code: CurrencyType): string => {
  return vectorGet(data.schema.Currencies.displayName, data, code);
};

/**
 * @internal
 */
export const currencyPluralName = (data: LocaleData, code: string, plural: PluralType): string => {
  return (
    vectorGet(data.schema.Currencies.pluralName, data, plural, code as CurrencyType) ||
    vectorGet(data.schema.Currencies.displayName, data, code as CurrencyType)
  );
};

/**
 * @internal
 */
export const getNumberPattern = (raw: string, negative: boolean): NumberPattern => {
  return cacheGet(
    numberPatternCache ||
      (numberPatternCache = createCache(parseNumberPattern, PATTERN_CACHE_SIZE)),
    raw,
  )[negative ? 1 : 0];
};

/**
 * @internal
 */
export const renderDecimal = <T>(
  data: LocaleData,
  renderer: NumberRenderer<T>,
  n: Decimal,
  options: DecimalFormatOptions,
  params: NumberParams,
): [T, PluralType] => {
  // TODO: abstract away pattern selection defaulting
  const style = options.style === undefined ? 'decimal' : options.style;
  let result: T;
  let plural: PluralType = 'other';
  const round = options.round || 'half-even';

  const latnInfo = scopeGet(data.schema.Numbers.numberSystem, 'latn') as NumberSystemInfo;
  const info = scopeGet(data.schema.Numbers.numberSystem, params.numberSystemName) || latnInfo;

  const decimalFormats = info.decimalFormats;
  const latnDecimalFormats = latnInfo.decimalFormats;
  const standardRaw =
    fieldGet(decimalFormats.standard, data) || fieldGet(latnDecimalFormats.standard, data);

  const plurals = data.plurals;

  switch (style) {
    case 'long':
    case 'short': {
      const isShort = style === 'short';
      const useLatn = digitsGet(decimalFormats.short, data, 'other', 4)[0] === '';
      const patternImpl = isShort
        ? useLatn
          ? latnInfo.decimalFormats.short
          : decimalFormats.short
        : useLatn
          ? latnInfo.decimalFormats.long
          : decimalFormats.long;

      const ctx = numberContext(options, round, true, false);

      // Adjust the number using the compact pattern and divisor.
      // const [q2, ndigits] = setupCompact(data, n, ctx, standardRaw, patternImpl);
      let q2: Decimal;
      let ndigits: number;
      if (options.divisor) {
        [q2, ndigits] = setupCompactDivisor(
          data,
          n,
          ctx,
          standardRaw,
          options.divisor,
          patternImpl,
        );
      } else {
        [q2, ndigits] = setupCompact(data, n, ctx, standardRaw, patternImpl);
      }

      q2 = negzero(q2, options.negativeZero);

      // Compute the plural category for the final q2.
      plural = pluralCardinal(plurals, q2) as PluralType;

      // Select the final pluralized compact pattern based on the integer
      // digits of n and the plural category of the rounded / shifted number q2.
      const raw =
        digitsGet(patternImpl, data, plural, ndigits)[0] ||
        digitsGet(patternImpl, data, 'other', ndigits)[0] ||
        standardRaw;

      // Re-select pattern as number may have changed sign due to rounding.
      const pattern = getNumberPattern(raw, decimalIsNegative(q2));

      result = renderer.render(q2, pattern, '', '', '', ctx.minInt, options.group);
      break;
    }

    case 'percent':
    case 'percent-scaled':
    case 'permille':
    case 'permille-scaled': {
      // Get percent pattern.
      const raw = fieldGet(info.percentFormat, data) || fieldGet(latnInfo.percentFormat, data);
      let pattern = getNumberPattern(raw, decimalIsNegative(n));

      // Scale the number to a percent or permille form as needed.
      if (style === 'percent') {
        n = decimalMovePoint(n, 2);
      } else if (style === 'permille') {
        n = decimalMovePoint(n, 3);
      }

      // Select percent or permille symbol.
      const symbol =
        style === 'percent' || style === 'percent-scaled'
          ? params.symbols.percentSign
          : params.symbols.perMille;

      // Adjust number using pattern and options, then render.
      const ctx = numberContext(options, round, false, false, -1);
      numberContextSetPattern(ctx, pattern);
      n = numberContextAdjust(ctx, n);
      n = negzero(n, options.negativeZero);
      plural = pluralCardinal(plurals, n) as PluralType;

      // Re-select pattern as number may have changed sign due to rounding.
      pattern = getNumberPattern(raw, decimalIsNegative(n));
      result = renderer.render(n, pattern, '', symbol, '', ctx.minInt, options.group);
      break;
    }

    case 'decimal': {
      // Get decimal pattern.
      let pattern = getNumberPattern(standardRaw, decimalIsNegative(n));

      // Adjust number using pattern and options, then render.
      const ctx = numberContext(options, round, false, false, -1);
      numberContextSetPattern(ctx, pattern);
      n = numberContextAdjust(ctx, n);
      n = negzero(n, options.negativeZero);
      plural = pluralCardinal(plurals, n) as PluralType;

      // Re-select pattern as number may have changed sign due to rounding.
      pattern = getNumberPattern(standardRaw, decimalIsNegative(n));
      result = renderer.render(n, pattern, '', '', '', ctx.minInt, options.group);
      break;
    }

    case 'scientific': {
      const sciFormat = info.scientificFormat;

      const ctx = numberContext(options, round, false, true, -1);
      const latnSciFormat = latnInfo.scientificFormat;
      const format = fieldGet(sciFormat, data) || fieldGet(latnSciFormat, data);
      let pattern = getNumberPattern(format, decimalIsNegative(n));

      numberContextSetPattern(ctx, pattern, true);
      n = numberContextAdjust(ctx, n, true);
      n = negzero(n, options.negativeZero !== false);
      pattern = getNumberPattern(format, decimalIsNegative(n));
      // Split number into coeffcient and exponent
      const [coeff, exponent] = decimalScientific(n, ctx.minInt);
      const adjcoeff = numberContextAdjust(ctx, coeff, true);
      result = renderer.render(adjcoeff, pattern, '', '', '', 1, false, exponent);
      break;
    }

    default:
      result = renderer.empty();
      break;
  }

  // No valid style matched
  return [result, plural];
};

/**
 * @internal
 */
export const renderCurrency = <T>(
  data: LocaleData,
  renderer: NumberRenderer<T>,
  n: Decimal,
  code: string,
  options: CurrencyFormatOptions,
  params: NumberParams,
): T => {
  const fractions = getCurrencyFractions(code);
  const round = options.round || 'half-even';

  if (options.cash && fractions.cashRounding > 1) {
    // Simple cash rounding to nearest "cash digits" increment
    n = decimalDivide(n, fractions.cashRounding);
    n = decimalSetScale(n, fractions.cashDigits, round);
    n = decimalMultiply(n, fractions.cashRounding);
  }

  // TODO: display context support
  const width = options.symbolWidth === 'narrow' ? 'narrow' : 'none';
  const style = options.style === undefined ? 'symbol' : options.style;

  const latnInfo = scopeGet(data.schema.Numbers.numberSystem, 'latn') as NumberSystemInfo;
  const info = scopeGet(data.schema.Numbers.numberSystem, params.numberSystemName) || latnInfo;

  const currencyFormats = info.currencyFormats;
  const latnDecimalFormats = latnInfo.decimalFormats;

  const standardRaw =
    fieldGet(currencyFormats.standard, data) || fieldGet(latnDecimalFormats.standard, data);

  // Some locales have a special decimal symbol for certain currencies, e.g. pt-PT and PTE
  const decimal = vectorGet(data.schema.Currencies.decimal, data, code as CurrencyType) || '';

  const plurals = data.plurals;

  switch (style) {
    case 'code':
    case 'name': {
      const raw =
        fieldGet(info.decimalFormats.standard, data) ||
        fieldGet(latnInfo.decimalFormats.standard, data);
      let pattern = getNumberPattern(raw, decimalIsNegative(n));

      // Adjust number using pattern and options, then render.
      const ctx = numberContext(options, round, false, false, fractions.digits);
      numberContextSetPattern(ctx, pattern);
      n = numberContextAdjust(ctx, n);
      n = negzero(n, false);

      // Re-select pattern as number may have changed sign due to rounding.
      pattern = getNumberPattern(raw, decimalIsNegative(n));
      const num = renderer.render(n, pattern, '', '', decimal, ctx.minInt, options.group);

      // Compute plural category and select pluralized unit.
      const plural = pluralCardinal(plurals, n) as PluralType;
      const unit = style === 'code' ? code : currencyPluralName(data, code, plural);

      // Wrap number and unit together.
      // TODO: implement a more concise fallback to 'other' for pluralized lookups
      const unitWrapper =
        vectorGet(currencyFormats.unitPattern, data, [plural, 'other']) ||
        vectorGet(latnInfo.currencyFormats.unitPattern, data, [plural, 'other']);
      return renderer.wrap(unitWrapper, num, renderer.make('unit', unit));
    }

    case 'short': {
      // The extra complexity here is to deal with rounding up and selecting the
      // correct pluralized pattern for the final rounded form.
      const patternImpl = currencyFormats.short;

      const ctx = numberContext(options, round, true, false, fractions.digits);
      const symbol = currencySymbol(data, code as CurrencyType, width);

      // Adjust the number using the compact pattern and divisor.
      let q2: Decimal;
      let ndigits: number;
      if (options.divisor) {
        [q2, ndigits] = setupCompactDivisor(
          data,
          n,
          ctx,
          standardRaw,
          options.divisor,
          patternImpl,
        );
      } else {
        [q2, ndigits] = setupCompact(data, n, ctx, standardRaw, patternImpl);
      }
      q2 = negzero(q2, false);

      // Compute the plural category for the final q2.
      const plural = pluralCardinal(plurals, q2) as PluralType;

      // Select the final pluralized compact pattern based on the integer
      // digits of n and the plural category of the rounded / shifted number q2.
      let raw =
        digitsGet(patternImpl, data, plural, ndigits)[0] ||
        digitsGet(patternImpl, data, 'other', ndigits)[0] ||
        standardRaw;
      if (raw === '0') {
        raw = standardRaw;
      }

      const pattern = getNumberPattern(raw, decimalIsNegative(q2));
      return renderer.render(q2, pattern, symbol, '', decimal, ctx.minInt, options.group);
    }

    case 'accounting':
    case 'symbol': {
      // Select standard or accounting pattern based on style.
      let styleArrow = style === 'symbol' ? currencyFormats.standard : currencyFormats.accounting;
      let raw = fieldGet(styleArrow, data);
      if (!raw) {
        styleArrow =
          style === 'symbol'
            ? latnInfo.currencyFormats.standard
            : latnInfo.currencyFormats.accounting;
        raw = fieldGet(styleArrow, data);
      }
      let pattern = getNumberPattern(raw, decimalIsNegative(n));

      // Adjust number using pattern and options, then render.
      const ctx = numberContext(options, round, false, false, fractions.digits);
      numberContextSetPattern(ctx, pattern);
      n = numberContextAdjust(ctx, n);
      n = negzero(n, false);

      // Re-select pattern as number may have changed sign due to rounding.
      pattern = getNumberPattern(raw, decimalIsNegative(n));
      const symbol = currencySymbol(data, code as CurrencyType, width);
      return renderer.render(n, pattern, symbol, '', decimal, ctx.minInt, options.group);
    }
  }

  // No valid style matched
  return renderer.empty();
};

/**
 * Setup for a compact pattern. Returns the adjusted number and digits for
 * selecting the pluralized pattern.
 *
 * The extra complexity here is to deal with rounding up and selecting the
 * correct pluralized pattern for the final rounded form.
 */
const setupCompact = (
  data: LocaleData,
  n: Decimal,
  ctx: NumberContext,
  standardRaw: string,
  patternImpl: DigitsArrow<PluralType>,
): [Decimal, number] => {
  // Select the correct divisor based on the number of integer digits in n.
  let negative = decimalIsNegative(n);
  let ndigits = decimalIntegerDigits(n);

  // Select the initial compact pattern based on the integer digits of n.
  // The plural category doesn't matter until the final pattern is selected.
  let raw: string;
  let ndivisor = 0;
  [raw, ndivisor] = digitsGet(patternImpl, data, 'other', ndigits);
  let pattern = getCompactPattern(raw, standardRaw, negative);

  const fracDigits = ctx.useSignificant ? -1 : 0;

  // Move the decimal point of n, producing q1. We always strip trailing
  // zeros on compact patterns.
  let q1 = n;
  if (ndivisor > 0) {
    q1 = decimalMovePoint(q1, -ndivisor);
  }

  // Adjust q1 using the compact pattern's parameters, to produce q2.
  const q1digits = decimalIntegerDigits(q1);
  numberContextSetCompact(ctx, pattern, q1digits, ndivisor, fracDigits);

  let q2 = numberContextAdjust(ctx, q1);
  const q2digits = decimalIntegerDigits(q2);
  negative = decimalIsNegative(q2);

  // Check if the number rounded up, adding another integer digit.
  if (q2digits > q1digits) {
    // Select a new divisor and pattern.
    ndigits++;

    let divisor = 0;
    [raw, divisor] = digitsGet(patternImpl, data, 'other', ndigits);
    pattern = getCompactPattern(raw, standardRaw, negative);

    // If divisor changed we need to divide and adjust again. We don't divide,
    // we just move the decimal point, since our Decimal type uses a radix that
    // is a power of 10. Otherwise q2 is ready for formatting.
    if (divisor > ndivisor) {
      // We shift right before we move the decimal point. This triggers rounding
      // of the number at its correct scale. Otherwise we would end up with
      // 999,999 becoming 0.999999 and half-even rounding truncating the
      // number to '0M' instead of '1M'.
      q1 = decimalMovePoint(n, -divisor);
      q1 = decimalShiftright(q1, divisor);
      numberContextSetCompact(ctx, pattern, decimalIntegerDigits(q1), divisor, fracDigits);
      q2 = numberContextAdjust(ctx, q1);
    }
  }

  return [q2, ndigits];
};

const setupCompactDivisor = (
  data: LocaleData,
  n: Decimal,
  ctx: NumberContext,
  standardRaw: string,
  divisor: number,
  patternImpl: DigitsArrow<PluralType>,
): [Decimal, number] => {
  const negative = decimalIsNegative(n);
  const ndigits = Math.log10(divisor) + 1;
  // Select compact patterns based on number of digits in divisor
  const [raw, ndivisor] = digitsGet(patternImpl, data, 'other', ndigits);
  if (ndivisor > 0) {
    n = decimalMovePoint(n, -ndivisor);
  }

  const pattern = getCompactPattern(raw, standardRaw, negative);
  const fracDigits = ctx.useSignificant ? -1 : 0;
  numberContextSetCompact(ctx, pattern, decimalIntegerDigits(n), divisor, fracDigits);

  // Hack to avoid extra leading '0' for certain divisor cases.
  // Unless explicit minimum integers is set in options, we force it to
  // 1 to override the compact pattern.
  const minInt = ctx.options.minimumIntegerDigits;
  const noMinInt = minInt === undefined || minInt < 0;
  if (noMinInt) {
    ctx.minInt = 1;
  }
  return [numberContextAdjust(ctx, n), ndigits];
};

const getCompactPattern = (raw: string, standardRaw: string, negative: boolean): NumberPattern => {
  if (raw) {
    return getNumberPattern(raw, negative);
  }
  // Adjust standard pattern to have same fraction settings as compact
  const pattern = getNumberPattern(standardRaw, negative);
  return { ...pattern, minFrac: 0, maxFrac: 0 };
};
