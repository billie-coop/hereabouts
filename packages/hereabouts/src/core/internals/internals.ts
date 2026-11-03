import type { Decimal } from '../../decimal';
import type { NumberPattern } from '../parsing/number';

/**
 * Renders formatted numbers into a string or an array of parts.
 *
 * @internal
 */
export interface NumberRenderer<R> {
  empty(): R;
  make(type: string, value: string): R;
  render(
    n: Decimal,
    pattern: NumberPattern,
    currencySymbol: string,
    percentSymbol: string,
    decimalSymbol: string,
    minInt: number,
    grouping?: boolean,
    exponent?: number,
  ): R;
  /** Fill a wrapper pattern like '{0} {1}' with the given values. */
  wrap(raw: string, ...args: R[]): R;
}
