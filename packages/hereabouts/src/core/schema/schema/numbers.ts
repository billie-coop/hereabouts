import type {
  CurrencySpacingPattern,
  CurrencySpacingPos,
  NumberMiscPatternType,
  NumberSymbolType,
  NumberSystemCategory,
} from '../../../types';

import { keyIndex } from '../instructions';

/**
 * @public
 */
export const PluralDigitValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

/**
 * @public
 */
export const CurrencySpacingPosIndex = /*#__PURE__*/ keyIndex<CurrencySpacingPos>([
  'before',
  'after',
]);

/**
 * @public
 */
export const CurrencySpacingPatternIndex = /*#__PURE__*/ keyIndex<CurrencySpacingPattern>([
  'currencyMatch',
  'surroundingMatch',
  'insertBetween',
]);

/**
 * @public
 */
export const NumberSymbolValues: NumberSymbolType[] = [
  'approximatelySign',
  'currencyDecimal',
  'currencyGroup',
  'decimal',
  'exponential',
  'group',
  'infinity',
  'list',
  'minusSign',
  'nan',
  'perMille',
  'percentSign',
  'plusSign',
  'superscriptingExponent',
  'timeSeparator',
];

/**
 * @public
 */
export const NumberSystemCategoryValues: NumberSystemCategory[] = [
  'default',
  'native',
  'finance',
  'traditional',
];

/**
 * @public
 */
export const NumberMiscPatternValues: NumberMiscPatternType[] = [
  'at-least',
  'at-most',
  'approx',
  'range',
];

/**
 * @public
 */
export const NumberMiscPatternIndex = /*#__PURE__*/ keyIndex(NumberMiscPatternValues);

/**
 * @public
 */
export const NumberSystemsIndex = /*#__PURE__*/ keyIndex(NumberSystemCategoryValues);

/**
 * @public
 */
export const NumberSymbolIndex = /*#__PURE__*/ keyIndex(NumberSymbolValues);
