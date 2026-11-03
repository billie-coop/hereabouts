import type { ContextType, CurrencyType, PluralType } from '@phensley/cldr-types';
import {
  type Decimal,
  type DecimalArg,
  decimal,
  decimalIsInfinity,
  decimalIsNaN,
  type Part,
} from '@phensley/decimal';
import { pluralCardinal, pluralOrdinal } from '@phensley/plurals';
import type { CurrencyDisplayNameOptions } from '../common/general';
import type {
  CurrencyFormatOptions,
  CurrencySymbolWidthType,
  DecimalAdjustOptions,
  DecimalFormatOptions,
} from '../common/numbers';
import type { NumberParams } from '../common/private';
import { contextTransform } from '../internals/general/internal';
import type { NumberRenderer } from '../internals/internals';
import {
  adjustNumber,
  currencyDisplayName,
  currencyPluralName,
  currencySymbol,
  renderCurrency,
  renderDecimal,
} from '../internals/numbers/internal';
import { partsRenderer, stringRenderer } from '../internals/numbers/render';
import type { LocaleData } from '../locale-data';
import { getContextTransformInfo } from './private/api';
import { getNumberParams } from './private/numbers';

const DEFAULT_CURRENCY_OPTIONS: CurrencyDisplayNameOptions = { context: 'begin-sentence' };

/**
 * Adjust a decimal number using the given options.
 *
 * @public
 */
export const adjustDecimal = (
  _data: LocaleData,
  n: DecimalArg,
  opts?: DecimalAdjustOptions,
): Decimal => adjustNumber(decimal(n), opts);

/**
 * Get the currency symbol for the given code, e.g. '$' for 'USD' in 'en'.
 *
 * @public
 */
export const getCurrencySymbol = (
  data: LocaleData,
  code: CurrencyType,
  width?: CurrencySymbolWidthType,
): string => currencySymbol(data, code, width === 'narrow' ? 'narrow' : 'none');

/**
 * Get the display name of a currency.
 *
 * @public
 */
export const getCurrencyDisplayName = (
  data: LocaleData,
  code: CurrencyType,
  opts: CurrencyDisplayNameOptions = DEFAULT_CURRENCY_OPTIONS,
): string => {
  const name = currencyDisplayName(data, code);
  return contextTransform(name, getContextTransformInfo(data), _ctx(opts), 'currencyName');
};

/**
 * Get the pluralized name of a currency for the given number.
 *
 * @public
 */
export const getCurrencyPluralName = (
  data: LocaleData,
  n: DecimalArg,
  code: string,
  opts: CurrencyDisplayNameOptions = DEFAULT_CURRENCY_OPTIONS,
): string => {
  const plural = getPluralCardinal(data, n);
  const name = currencyPluralName(data, code, plural as PluralType);
  return contextTransform(name, getContextTransformInfo(data), _ctx(opts), 'currencyName');
};

/**
 * Get the cardinal plural category for the number.
 *
 * @public
 */
export const getPluralCardinal = (
  data: LocaleData,
  n: DecimalArg,
  options?: DecimalAdjustOptions,
): string => {
  const d = options ? adjustDecimal(data, n, options) : decimal(n);
  return pluralCardinal(data.plurals, d);
};

/**
 * Get the ordinal plural category for the number.
 *
 * @public
 */
export const getPluralOrdinal = (
  data: LocaleData,
  n: DecimalArg,
  options?: DecimalAdjustOptions,
): string => {
  const d = options ? adjustDecimal(data, n, options) : decimal(n);
  return pluralOrdinal(data.plurals, d);
};

/**
 * Format a number to a string.
 *
 * @public
 */
export const formatDecimal = (
  data: LocaleData,
  n: DecimalArg,
  options?: DecimalFormatOptions,
): string => {
  options = options || {};
  const params = getNumberParams(data, options.nu);
  return formatDecimalImpl(data, stringRenderer(params), params, n, options);
};

/**
 * Format a number to an array of parts.
 *
 * @public
 */
export const formatDecimalToParts = (
  data: LocaleData,
  n: DecimalArg,
  options?: DecimalFormatOptions,
): Part[] => {
  options = options || {};
  const params = getNumberParams(data, options.nu);
  return formatDecimalImpl(data, partsRenderer(params), params, n, options);
};

/**
 * Format a currency value to a string.
 *
 * @public
 */
export const formatCurrency = (
  data: LocaleData,
  n: DecimalArg,
  code: CurrencyType,
  options?: CurrencyFormatOptions,
): string => {
  options = options || {};
  const params = getNumberParams(data, options.nu, 'finance');
  return formatCurrencyImpl(data, stringRenderer(params), params, n, code, options);
};

/**
 * Format a currency value to an array of parts.
 *
 * @public
 */
export const formatCurrencyToParts = (
  data: LocaleData,
  n: DecimalArg,
  code: CurrencyType,
  options?: CurrencyFormatOptions,
): Part[] => {
  options = options || {};
  const params = getNumberParams(data, options.nu, 'finance');
  return formatCurrencyImpl(data, partsRenderer(params), params, n, code, options);
};

const formatDecimalImpl = <T>(
  data: LocaleData,
  renderer: NumberRenderer<T>,
  params: NumberParams,
  n: DecimalArg,
  options: DecimalFormatOptions,
): T => {
  // A NaN or Infinity value will just return the locale's representation
  const d = decimal(n);
  const v = validate(d, options, renderer, params);
  if (v !== undefined) {
    return v;
  }
  const [result] = renderDecimal(data, renderer, d, options, params);
  return result;
};

const formatCurrencyImpl = <T>(
  data: LocaleData,
  renderer: NumberRenderer<T>,
  params: NumberParams,
  n: DecimalArg,
  code: CurrencyType,
  options: CurrencyFormatOptions,
): T => {
  // Not much to be done with NaN and Infinity with currencies, so we always
  // throw an error.
  const d = decimal(n);
  validate(d, FORCE_ERRORS, renderer, params);
  return renderCurrency(data, renderer, decimal(n), code, options, params);
};

const FORCE_ERRORS: DecimalFormatOptions = { errors: ['nan', 'infinity'] };

/**
 * Check if the number is a NaN or Infinity and whether this should throw
 * an error, or return the locale's string representation.
 */
const validate = <T>(
  n: Decimal,
  opts: DecimalFormatOptions,
  renderer: NumberRenderer<T>,
  params: NumberParams,
): T | undefined => {
  // Check if we have NaN or Infinity
  const isnan = decimalIsNaN(n);
  const isinfinity = decimalIsInfinity(n);

  if (Array.isArray(opts.errors)) {
    // Check if we should throw an error on either of these
    if (isnan && opts.errors.indexOf('nan') !== -1) {
      throw Error(`Invalid argument: NaN`);
    }
    if (isinfinity && opts.errors.indexOf('infinity') !== -1) {
      throw Error(`Invalid argument: Infinity`);
    }
  }

  return isnan
    ? renderer.make('nan', params.symbols.nan)
    : isinfinity
      ? renderer.make('infinity', params.symbols.infinity)
      : undefined;
};

// Default an options context value
const _ctx = (o: CurrencyDisplayNameOptions): ContextType =>
  _def(o, 'context', 'begin-sentence' as ContextType);

// Default an option value
const _def = <O, K extends keyof O, T>(o: O, k: K, t: T): T => (o[k] as unknown as T) || t;
