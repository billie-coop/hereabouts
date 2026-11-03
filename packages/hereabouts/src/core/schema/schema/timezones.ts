import type { MetaZoneType } from '../../../types';
import { keyIndex } from '../instructions';
import { MetaZoneValues, TimeZoneStableIds } from './autogen.timezones';

/**
 * @public
 */
export const MetaZoneIndex = /*#__PURE__*/ keyIndex<MetaZoneType>(MetaZoneValues);

/**
 * @public
 */
export const TimeZoneTypeIndex = /*#__PURE__*/ keyIndex(['daylight', 'generic', 'standard']);

/**
 * @public
 */
export const TimeZoneStableIdIndex = /*#__PURE__*/ keyIndex(TimeZoneStableIds);
