import type { PluralType, UnitInfo } from '@phensley/cldr-types';
import { DecimalConstants, decimal } from '@phensley/decimal';
import { pluralCardinal } from '@phensley/plurals';
import type { NumberParams } from '../../common/private';
import type { Quantity, UnitFormatOptions } from '../../common/units';
import type { LocaleData } from '../../locale-data';
import { fieldGet, vectorGet } from '../../schema/schema/arrows';
import type { NumberRenderer } from '../internals';
import { renderDecimal } from '../numbers/internal';

/**
 * Format a quantity: the number, its pluralized unit pattern, and an optional
 * 'per' or 'times' unit.
 *
 * @internal
 */
export const renderUnit = <T>(
  data: LocaleData,
  renderer: NumberRenderer<T>,
  q: Quantity,
  options: UnitFormatOptions,
  params: NumberParams,
): T => {
  const n = decimal(q.value);
  const [num, plural] = renderDecimal(data, renderer, n, options, params);
  if (q.unit === undefined) {
    return num;
  }

  // Compute plural category for the value '1'
  const singular = pluralCardinal(data.plurals, DecimalConstants.ONE);

  // For default and "per" compound pattern, the {0} will use
  // the plural category and {1} will be singular. Examples:
  //   1 meter per second
  //  10 meters per second
  //
  // For the "times" compound pattern, the {0} will be singular,
  // and the {1} will use the plural category. Examples:
  //   1 newton-meter
  //  10 newton-meters
  const plural0 = q.times ? singular : plural;
  const plural1 = q.times ? plural : singular;

  const info = getUnitInfo(data, options.length || '');
  let pattern = vectorGet(info.unitPattern, data, plural0 as PluralType, q.unit);
  if (!pattern) {
    pattern = vectorGet(info.unitPattern, data, 'other', q.unit);
  }

  const zero = renderer.wrap(pattern, num);
  if (q.per) {
    // Check if the per unit has its own pattern
    const perPattern = vectorGet(info.perUnitPattern, data, q.per);
    if (perPattern) {
      return renderer.wrap(perPattern, zero);
    }
  }

  // Compound pattern to combine the two units, if any
  const compound = q.per
    ? fieldGet(info.perPattern, data)
    : q.times
      ? fieldGet(info.timesPattern, data)
      : '';

  const perunit = q.per || q.times;
  if (perunit) {
    // Fetch the pattern for the denominator unit and strip the placeholder
    let denom = vectorGet(info.unitPattern, data, plural1 as PluralType, perunit);
    denom = denom.replace(/\s*\{0\}\s*/, '');
    const one = renderer.make('per', denom);

    return renderer.wrap(compound, zero, one);
  }

  return zero;
};

/**
 * Unit patterns for a length ('long', 'short' or 'narrow').
 *
 * @internal
 */
export const getUnitInfo = (data: LocaleData, length: string): UnitInfo => {
  const units = data.schema.Units;
  switch (length) {
    case 'narrow':
      return units.narrow;
    case 'short':
      return units.short;
    default:
      return units.long;
  }
};
