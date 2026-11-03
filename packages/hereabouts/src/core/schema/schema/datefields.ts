import type { DateFieldType, DateFieldWidthType, RelativeTimeFieldType } from '../../../types';
import { keyIndex } from '../instructions';

/**
 * @public
 */
export const DateFieldValues: DateFieldType[] = [
  'era',
  'year',
  'quarter',
  'month',
  'week',
  'weekday',
  'weekdayOfMonth',
  'sun',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'day',
  'dayperiod',
  'hour',
  'minute',
  'second',
  'zone',
];

/**
 * @public
 */
export const DateFieldWidthValues: DateFieldWidthType[] = ['short', 'narrow', 'wide'];

/**
 * @public
 */
export const RelativeTimeFieldValues: RelativeTimeFieldType[] = [
  'year',
  'quarter',
  'month',
  'week',
  'day',
  'sun',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'hour',
  'minute',
  'second',
];

/**
 * @public
 */
export const DateFieldIndex = /*#__PURE__*/ keyIndex(DateFieldValues);

/**
 * @public
 */
export const DateFieldWidthIndex = /*#__PURE__*/ keyIndex(DateFieldWidthValues);

/**
 * @public
 */
export const RelativeTimeFieldIndex = /*#__PURE__*/ keyIndex(RelativeTimeFieldValues);
