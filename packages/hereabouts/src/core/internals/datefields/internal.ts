import {
  type DecimalArg,
  DecimalConstants,
  decimal,
  decimalCompare,
  decimalIsNegative,
  decimalNegate,
} from '../../../decimal';
import { pluralCardinal } from '../../../plurals';
import type { PluralType, RelativeTimeFields, RelativeTimeFieldType } from '../../../types';
import type { RelativeTimeFieldFormatOptions } from '../../common/calendars';
import type { ContextTransformInfo, NumberParams } from '../../common/private';
import type { LocaleData } from '../../locale-data';
import { vectorGet } from '../../schema/schema/arrows';
import { numberingFormatString } from '../../systems/numbering/decimal';
import { contextTransform, formatWrapper } from '../general/internal';
import { adjustNumber } from '../numbers/internal';

// TODO: expose a method to calculate field difference with different options, e.g.
// include weekdays

/**
 * Format a relative time for a single field, e.g. "in 3 days", "yesterday".
 *
 * @internal
 */
export const renderRelativeTimeField = (
  data: LocaleData,
  value: DecimalArg,
  field: RelativeTimeFieldType,
  options: RelativeTimeFieldFormatOptions,
  params: NumberParams,
  transform: ContextTransformInfo,
): string => {
  const width = options.width || 'wide';
  const format: RelativeTimeFields =
    data.schema.DateFields.relativeTimes[width] || data.schema.DateFields.relativeTimes.wide;
  const group = options.group === undefined ? true : options.group;

  let n = decimal(value);
  n = adjustNumber(n, options);
  const negative = decimalIsNegative(n);
  if (negative) {
    n = decimalNegate(n);
  }

  const iszero = decimalCompare(n, DecimalConstants.ZERO) === 0;
  let res = '';

  if (iszero) {
    if (options.alwaysNow || !options.numericOnly) {
      res = vectorGet(format.current, data, field);
    }
  } else if (!options.numericOnly) {
    switch (field) {
      case 'hour':
      case 'minute':
      case 'second':
        break;
      default:
        if (decimalCompare(n, DecimalConstants.TWO) === 0) {
          const p = negative
            ? vectorGet(format.previous2, data, field)
            : vectorGet(format.next2, data, field);
          if (p !== '') {
            res = p;
          }
          // Fall through
        } else if (decimalCompare(n, DecimalConstants.ONE) === 0) {
          res = negative
            ? vectorGet(format.previous, data, field)
            : vectorGet(format.next, data, field);
        }
        break;
    }
  }

  // If we output anything above, return it
  if (res) {
    if (options.context) {
      res = contextTransform(res, transform, options.context, 'relative');
    }
    return res;
  }

  // Format a pluralized future / past.
  const plural = pluralCardinal(data.plurals, n) as PluralType;
  const arrow = negative ? format.past : format.future;
  let raw = vectorGet(arrow, data, plural, field);
  if (options.context) {
    raw = contextTransform(raw, transform, options.context, 'relative');
  }
  const num = numberingFormatString(params.system, n, group, 1);
  return formatWrapper(raw, [num]);
};
