import type { UnitType } from '@phensley/cldr-types';
import type { Part } from '@phensley/decimal';
import type { ListPatternType } from '../common/general';
import type { Quantity, UnitFormatOptions, UnitLength } from '../common/units';
import { formatListValue } from '../internals/general/internal';
import { partsRenderer, stringRenderer } from '../internals/numbers/render';
import { getUnitInfo, renderUnit } from '../internals/units/internal';
import type { LocaleData } from '../locale-data';
import { vectorGet } from '../schema/schema/arrows';
import { partsValue } from '../utils/render';
import { formatList } from './general';
import { getNumberParams } from './private/numbers';

const DEFAULT_OPTIONS: UnitFormatOptions = { length: 'long', style: 'decimal' };

/**
 * Units available in the active schema config.
 *
 * @public
 */
export const availableUnits = (data: LocaleData): UnitType[] =>
  data.indices['unit-id'].keys.slice(0) as UnitType[];

/**
 * Get the display name of a unit.
 *
 * @public
 */
export const getUnitDisplayName = (data: LocaleData, name: UnitType, length?: UnitLength): string =>
  vectorGet(getUnitInfo(data, length || 'long').displayName, data, name);

/**
 * Format a quantity to a string.
 *
 * @public
 */
export const formatQuantity = (
  data: LocaleData,
  q: Quantity,
  options?: UnitFormatOptions,
): string => {
  options = options || DEFAULT_OPTIONS;
  const params = getNumberParams(data, options.nu);
  return renderUnit(data, stringRenderer(params), q, options, params);
};

/**
 * Format a quantity to an array of parts.
 *
 * @public
 */
export const formatQuantityToParts = (
  data: LocaleData,
  q: Quantity,
  options?: UnitFormatOptions,
): Part[] => {
  options = options || DEFAULT_OPTIONS;
  const params = getNumberParams(data, options.nu);
  return renderUnit(data, partsRenderer(params), q, options, params);
};

/**
 * Format a sequence of quantities to a string, e.g. "5 feet, 3 inches".
 *
 * @public
 */
export const formatQuantitySequence = (
  data: LocaleData,
  qs: Quantity[],
  options?: UnitFormatOptions,
): string => {
  options = options || DEFAULT_OPTIONS;
  const items = qs.map((q) => formatQuantity(data, q, options));
  const type = selectListType(options);
  return formatList(data, items, type);
};

/**
 * Format a sequence of quantities to an array of parts.
 *
 * @public
 */
export const formatQuantitySequenceToParts = (
  data: LocaleData,
  qs: Quantity[],
  options?: UnitFormatOptions,
): Part[] => {
  options = options || DEFAULT_OPTIONS;
  const parts: Part[][] = qs.map((q) => formatQuantityToParts(data, q, options));
  const type = selectListType(options);
  return formatListValue(data, partsValue(), parts, type);
};

const selectListType = (options: UnitFormatOptions): ListPatternType => {
  switch (options.length) {
    case 'narrow':
      return 'unit-narrow';
    case 'short':
      return 'unit-short';
    default:
      return 'unit-long';
  }
};
