import { type DecimalArg, decimal, decimalFormat, stringDecimalFormatter } from '../../../decimal';
import type { NumberingSystem, NumberSymbols } from '../../common/private';

const isInteger = (n: any): boolean => typeof n === 'number' && isFinite(n) && Math.floor(n) === n;

/**
 * @internal
 */
export interface NumberingSystemParams {
  readonly decimal: string;
}

/**
 * @internal
 */
export const decimalNumberingSystem = (
  name: string,
  digits: string[],
  symbols: NumberSymbols,
  minimumGroupingDigits: number,
  primaryGroupingSize: number,
  secondaryGroupingSize: number,
): NumberingSystem => ({
  name,
  digits,
  symbols,
  minimumGroupingDigits,
  primaryGroupingSize,
  secondaryGroupingSize,
});

/**
 * Format a number directly to a string. This is used for things like low-level field
 * formatting for Calendars.
 *
 * @internal
 */
export const numberingFormatString = (
  system: NumberingSystem,
  n: DecimalArg,
  groupDigits: boolean,
  minInt: number,
): string => {
  if (!groupDigits && isInteger(n)) {
    return fastFormatDecimal(String(n), system.digits, minInt);
  }
  const f = stringDecimalFormatter();
  const d = decimal(n);
  const group = groupDigits ? system.symbols.group : '';
  decimalFormat(
    d,
    f,
    system.symbols.decimal || '.',
    group,
    minInt,
    system.minimumGroupingDigits,
    system.primaryGroupingSize,
    system.secondaryGroupingSize,
    true,
    system.digits,
  );
  return f.render();
};

/**
 * Characters used in decimal parsing.
 *
 * @public
 */
const enum Chars {
  PLUS = 43,
  MINUS = 45,
  DOT = 46,
  DIGIT0 = 48,
  DIGIT1 = 49,
  DIGIT2 = 50,
  DIGIT3 = 51,
  DIGIT4 = 52,
  DIGIT5 = 53,
  DIGIT6 = 54,
  DIGIT7 = 55,
  DIGIT8 = 56,
  DIGIT9 = 57,
  ELOWER = 69,
  EUPPER = 101,
}

/**
 * Fast formatter for integers, no grouping, etc.
 *
 * @internal
 */
export const fastFormatDecimal = (n: string, digits: string[], minInt: number): string => {
  let r = '';
  const len = n.length;
  for (let i = 0; i < len; i++) {
    const c = n.charCodeAt(i);
    switch (c) {
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
        r += digits[c - Chars.DIGIT0];
        break;
    }
  }
  // Left pad zeros if minimum integer digits > formatted length
  let diff = minInt - r.length;
  if (diff > 0) {
    let p = '';
    while (diff-- > 0) {
      p += digits[0];
    }
    return p + r;
  }
  return r;
};

const INTERNAL_SYMBOLS: NumberSymbols = {
  approximatelySign: '~',
  currencyDecimal: '.',
  currencyGroup: ',',
  decimal: '.',
  exponential: 'E',
  group: ',',
  infinity: '∞',
  list: ';',
  minusSign: '-',
  nan: 'NaN',
  perMille: '‰',
  percentSign: '%',
  plusSign: '+',
  superscriptingExponent: '×',
  timeSeparator: ':',
};

/**
 * @internal
 */
export const INTERNAL_NUMBERING = /*#__PURE__*/ decimalNumberingSystem(
  'internal',
  '0123456789'.split(''),
  INTERNAL_SYMBOLS,
  1,
  3,
  3,
);
