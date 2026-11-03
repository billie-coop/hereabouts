import { type Decimal, DecimalConstants, decimal, decimalToString, isDecimal } from '../../decimal';
import type { MessageArg } from './args';

/**
 * Argument converter: a record of functions that map raw arguments to the
 * types required by the internal tags.
 *
 * @public
 */
export interface MessageArgConverter {
  readonly asString: (arg: MessageArg | undefined) => string;
  readonly asDecimal: (arg: MessageArg | undefined) => Decimal;
}

/**
 * Default argument converter: converts arguments to string or Decimal.
 *
 * @public
 */
export const defaultMessageArgConverter: MessageArgConverter = {
  /**
   * Convert to a string if possible.
   */
  asString: (arg: MessageArg | undefined): string => {
    switch (typeof arg) {
      case 'string':
        return arg;
      case 'number':
      case 'boolean':
        return arg.toString();
      case 'object':
        if (isDecimal(arg)) {
          return decimalToString(arg);
        }
        break;
    }
    return '';
  },

  /**
   * Convert to a Decimal if possible, or zero.
   */
  asDecimal: (arg: MessageArg | undefined): Decimal => {
    switch (typeof arg) {
      case 'string':
        try {
          return decimal(arg);
        } catch {
          return DecimalConstants.NAN;
        }
      case 'number':
        return decimal(arg);
      case 'boolean':
        return arg ? DecimalConstants.ONE : DecimalConstants.ZERO;
      case 'object':
        if (isDecimal(arg)) {
          return arg;
        }
        break;
    }
    return DecimalConstants.NAN;
  },
};
