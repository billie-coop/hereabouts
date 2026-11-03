import type { PluralType } from '../../../types';
import { keyIndex } from '../instructions';

/**
 * @public
 */
export const PluralIndex = /*#__PURE__*/ keyIndex<PluralType>([
  'other',
  'zero',
  'one',
  'two',
  'few',
  'many',
]);

/**
 * @public
 */
export const AltIndex = /*#__PURE__*/ keyIndex([
  'none',
  'short',
  'narrow',
  'variant',
  'stand-alone',
  'long',
  'menu',
]);

/**
 * @public
 */
export const EraAltIndex = /*#__PURE__*/ keyIndex(['none', 'sensitive']);

/**
 * @public
 */
export const DayPeriodAltIndex = /*#__PURE__*/ keyIndex(['none', 'casing']);
