import {
  type Decimal,
  decimalAdd,
  decimalMultiply,
  type MathContext,
  RationalConstants,
  rationalMultiply,
  rationalToDecimal,
} from '../decimal';
import { type UnitConversion, type UnitFactors, unitFactorsGet } from './factormap';

/**
 * Converts between units. Holds a set of unit factors per category name.
 *
 * @public
 */
export interface UnitConverter {
  readonly storage: { readonly [category: string]: UnitFactors };
}

/**
 * Create a unit converter, optionally with an initial set of categories.
 *
 * @public
 */
export const createUnitConverter = (categories?: {
  readonly [category: string]: UnitFactors;
}): UnitConverter => {
  let c: UnitConverter = { storage: {} };
  if (categories) {
    for (const category of Object.keys(categories)) {
      c = unitConverterAdd(c, category, categories[category]);
    }
  }
  return c;
};

/**
 * Return true if the given category is registered.
 *
 * @public
 */
export const unitConverterHas = (converter: UnitConverter, category: string): boolean =>
  !!converter.storage[category];

/**
 * Return a new converter with the set of conversion factors added under the
 * given category name. Throws an error if the category is already registered.
 *
 * @public
 */
export const unitConverterAdd = (
  converter: UnitConverter,
  category: string,
  map: UnitFactors,
): UnitConverter => {
  if (converter.storage[category]) {
    throw new Error(`this converter has registered factors for category ${category}`);
  }
  return { storage: { ...converter.storage, [category]: map } };
};

/**
 * Returns the unit factors for the given category.
 *
 * @public
 */
export const unitConverterFactors = (
  converter: UnitConverter,
  category: string,
): UnitFactors | undefined => converter.storage[category];

/**
 * Return an array of the categories added to this converter.
 *
 * @public
 */
export const unitConverterCategories = (converter: UnitConverter): string[] =>
  Object.keys(converter.storage).sort();

/**
 * Get the unit conversion factor that converts `src` to `dst` for the given category.
 *
 * @public
 */
export const unitConverterGet = (
  converter: UnitConverter,
  category: string,
  src: string,
  dst: string,
): UnitConversion | undefined => {
  const factors = converter.storage[category];
  if (factors) {
    return unitFactorsGet(factors, src, dst);
  }
  return undefined;
};

/**
 * Convert the decimal value from `src` to `dst` units. Affine
 * conversions (e.g. temperature) apply the combined additive offset
 * after the multiplicative factor.
 *
 * @public
 */
export const convertUnits = (
  converter: UnitConverter,
  category: string,
  n: Decimal,
  src: string,
  dst: string,
  ctx?: MathContext,
): Decimal | undefined => {
  const conv = unitConverterGet(converter, category, src, dst);
  if (conv) {
    const fac = conv.factors.reduce((p, c) => rationalMultiply(p, c, ctx), RationalConstants.ONE);
    const res = decimalMultiply(n, rationalToDecimal(fac, ctx), ctx);
    return conv.offset ? decimalAdd(res, rationalToDecimal(conv.offset, ctx)) : res;
  }
  return undefined;
};
