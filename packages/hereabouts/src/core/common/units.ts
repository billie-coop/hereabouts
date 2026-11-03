import type { Decimal, MathContext } from '../../decimal';
import type { UnitType } from '../../types';

import type { NumberFormatOptions, NumberFormatStyleType } from './numbers';

/**
 * @public
 */
export interface Quantity {
  value: number | string | Decimal;
  unit?: UnitType;
  per?: UnitType;
  times?: UnitType;
}

/**
 * @public
 */
export type UnitFormatStyleType = NumberFormatStyleType;

/**
 * @public
 */
export type UnitLength = 'short' | 'narrow' | 'long';

/**
 * @public
 */
export interface UnitFormatOptions extends NumberFormatOptions {
  divisor?: number;
  style?: UnitFormatStyleType;
  length?: UnitLength;
}

/**
 * @public
 */
export interface UnitConvertOptions {
  ctx?: MathContext;
}
