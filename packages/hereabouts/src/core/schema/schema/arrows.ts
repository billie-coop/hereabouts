import type {
  DigitsArrow,
  FieldArrow,
  KeyIndex,
  PrimitiveBundle,
  ScopeArrow,
  Vector1Arrow,
  Vector2Arrow,
  Vector3Arrow,
  VectorArrowBase,
} from '../../../types';
import { bundleGet } from '../../resource/bundle';
import { keyIndexGet } from '../instructions';

// Schema accessors ("arrows") are plain data describing where a value lives in a bundle's string
// table. The functions below read values through them.

/**
 * @public
 */
export const fieldArrow = (offset: number): FieldArrow => ({ kind: 'field', offset });

const isArrow = (x: any): boolean => x !== null && typeof x === 'object';

const isKeyIndex = (x: any): boolean =>
  isArrow(x) &&
  isArrow(x.index) &&
  Array.isArray(x.keys) &&
  typeof x.size === 'number' &&
  typeof x.last === 'number';

/**
 * @public
 */
export const isFieldArrow = (x: any): x is FieldArrow =>
  isArrow(x) && x.kind === 'field' && typeof x.offset === 'number';

/**
 * Read a single field.
 *
 * @public
 */
export const fieldGet = (arrow: FieldArrow, bundle: PrimitiveBundle): string =>
  bundleGet(bundle, arrow.offset);

/**
 * @public
 */
export const scopeArrow = <T extends string, R>(map: { [P in T]: R }): ScopeArrow<T, R> => ({
  kind: 'scope',
  map,
});

/**
 * @public
 */
export const isScopeArrow = (x: any): x is ScopeArrow<any, any> =>
  isArrow(x) && x.kind === 'scope' && typeof x.map === 'object' && x.map !== null;

/**
 * Select a child scope by key.
 *
 * @public
 */
export const scopeGet = <T extends string, R>(arrow: ScopeArrow<T, R>, key: T): R | undefined =>
  arrow.map[key];

/**
 * Special vector to store a pluralized number pattern and its divisor together.
 *
 * @public
 */
export const digitsArrow = <T extends string>(
  offset: number,
  index: KeyIndex<T>,
  values: number[],
): DigitsArrow<T> => ({
  kind: 'digits',
  offset,
  index,
  values,
  size2: values.length * 2, // store pattern and divisor as a pair
});

/**
 * @public
 */
export const isDigitsArrow = (x: any): x is DigitsArrow<any> =>
  isArrow(x) &&
  x.kind === 'digits' &&
  typeof x.offset === 'number' &&
  isKeyIndex(x.index) &&
  Array.isArray(x.values) &&
  typeof x.size2 === 'number';

const EMPTY_DIGITS: [string, number] = ['', 0];

/**
 * Read the pattern and divisor for a key and number of integer digits.
 *
 * @public
 */
export const digitsGet = <T extends string>(
  arrow: DigitsArrow<T>,
  bundle: PrimitiveBundle,
  key: T,
  digits: number,
): [string, number] => {
  if (digits > arrow.values.length) {
    digits = arrow.values.length;
  }
  if (digits > 0) {
    const i = keyIndexGet(arrow.index, key);
    if (i !== -1) {
      const k = arrow.offset + i * arrow.size2 + (digits - 1) * 2;
      const p = bundleGet(bundle, k);
      const d = bundleGet(bundle, k + 1);
      return [p, Number(d)];
    }
  }
  return EMPTY_DIGITS;
};

/**
 * Generalized multi-dimensional vector accessor. The header field at `offset` marks whether the
 * vector exists in the bundle; values start right after it.
 *
 * @public
 */
export const vectorArrow = (offset: number, keysets: KeyIndex<string>[]): VectorArrowBase => {
  const len = keysets.length;
  // Pre-compute the address factor for each dimension:
  //  1-dim:        [ index0 ]
  //  2-dim:        [ (index0 * size1), index1 ]
  //  3-dim:        [ (index0 * size1 * size2), (index1 * size), index2 ]
  //  ...
  const factors: number[] = new Array(len);
  for (let i = 0; i < len; i++) {
    let k = 1;
    for (let j = i + 1; j < len; j++) {
      k *= keysets[j].size;
    }
    factors[i] = k;
  }
  return { kind: 'vector', offset: offset + 1, len, last: len - 1, factors, keysets };
};

/**
 * @public
 */
export const isVectorArrow = (x: any): x is VectorArrowBase =>
  isArrow(x) &&
  x.kind === 'vector' &&
  typeof x.offset === 'number' &&
  typeof x.len === 'number' &&
  typeof x.last === 'number' &&
  Array.isArray(x.factors) &&
  Array.isArray(x.keysets) &&
  x.keysets.every(isKeyIndex);

type Key = string | string[];

/**
 * True if the keys address a valid field of the vector.
 *
 * @public
 */
export function vectorValid<T extends string>(arrow: Vector1Arrow<T>, key: T | T[]): boolean;
/** @public */
export function vectorValid<T extends string, S extends string>(
  arrow: Vector2Arrow<T, S>,
  key1: T | T[],
  key2: S | S[],
): boolean;
/** @public */
export function vectorValid(arrow: VectorArrowBase, ...keys: Key[]): boolean;
/** @public */
export function vectorValid(arrow: VectorArrowBase, ...keys: Key[]): boolean {
  return vectorIndex(arrow, keys, 0, arrow.offset) !== -1;
}

/**
 * True if the vector has data in this bundle.
 *
 * @public
 */
export const vectorExists = (arrow: VectorArrowBase, bundle: PrimitiveBundle): boolean =>
  bundleGet(bundle, arrow.offset - 1) === 'E';

/**
 * Read a field of the vector. Each key may be an array of fallback keys tried in order.
 *
 * @public
 */
export function vectorGet<T extends string>(
  arrow: Vector1Arrow<T>,
  bundle: PrimitiveBundle,
  key: T | T[],
): string;
/** @public */
export function vectorGet<T extends string, S extends string>(
  arrow: Vector2Arrow<T, S>,
  bundle: PrimitiveBundle,
  key1: T | T[],
  key2: S | S[],
): string;
/** @public */
export function vectorGet<T extends string, S extends string, U extends string>(
  arrow: Vector3Arrow<T, S, U>,
  bundle: PrimitiveBundle,
  key1: T | T[],
  key2: S | S[],
  key3: U | U[],
): string;
/** @public */
export function vectorGet(arrow: VectorArrowBase, bundle: PrimitiveBundle, ...keys: Key[]): string;
/** @public */
export function vectorGet(arrow: VectorArrowBase, bundle: PrimitiveBundle, ...keys: Key[]): string {
  if (keys.length !== arrow.len) {
    // Impossible lookup, will never reach a valid field
    throw new Error(`Warning: impossible vector lookup with keys ${JSON.stringify(keys)}`);
  }
  if (!vectorExists(arrow, bundle)) {
    return '';
  }
  return vectorLookup(arrow, bundle, keys, 0, arrow.offset);
}

/**
 * Read the whole vector into a nested object, omitting empty values.
 *
 * @public
 */
export function vectorMapping<T extends string>(
  arrow: Vector1Arrow<T>,
  bundle: PrimitiveBundle,
): { [P in T]: string };
/** @public */
export function vectorMapping<T extends string, S extends string>(
  arrow: Vector2Arrow<T, S>,
  bundle: PrimitiveBundle,
): { [P in T]: { [Q in S]: string } };
/** @public */
export function vectorMapping<T extends string, S extends string, U extends string>(
  arrow: Vector3Arrow<T, S, U>,
  bundle: PrimitiveBundle,
): { [P in T]: { [Q in S]: { [R in U]: string } } };
/** @public */
export function vectorMapping(arrow: VectorArrowBase, bundle: PrimitiveBundle): any;
/** @public */
export function vectorMapping(arrow: VectorArrowBase, bundle: PrimitiveBundle): any {
  return vectorExists(arrow, bundle) ? mapping(arrow, bundle, 0, 0) : {};
}

const vectorIndex = (arrow: VectorArrowBase, keys: Key[], ix: number, k: number): number => {
  const key = keys[ix];
  const args = typeof key === 'string' ? [key] : key;
  const last = args.length - 1;
  for (let i = 0; i < args.length; i++) {
    const j = keyIndexGet(arrow.keysets[ix], args[i]);
    if (j === -1) {
      if (i !== last) {
        continue;
      }
      return -1;
    }
    const kk = k + j * arrow.factors[ix];
    if (ix === arrow.last) {
      return kk;
    }
    const result = vectorIndex(arrow, keys, ix + 1, kk);
    if (result !== -1) {
      return result;
    }
  }
  return -1;
};

const vectorLookup = (
  arrow: VectorArrowBase,
  bundle: PrimitiveBundle,
  keys: Key[],
  ix: number,
  k: number,
): string => {
  const key = keys[ix];
  const args = typeof key === 'string' ? [key] : key;
  const last = args.length - 1;
  for (let i = 0; i < args.length; i++) {
    const j = keyIndexGet(arrow.keysets[ix], args[i]);
    if (j === -1) {
      if (i !== last) {
        continue;
      }
      return '';
    }
    const kk = k + j * arrow.factors[ix];
    const val =
      ix === arrow.last ? bundleGet(bundle, kk) : vectorLookup(arrow, bundle, keys, ix + 1, kk);
    if (val) {
      return val;
    }
  }
  return '';
};

const mapping = (arrow: VectorArrowBase, bundle: PrimitiveBundle, k: number, ix: number): any => {
  const o: any = {};
  const keys = arrow.keysets[k].keys;
  const last = k === arrow.last;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (last) {
      // We're at the value level of the map, so lookup the corresponding string
      const val = bundleGet(bundle, arrow.offset + i + ix);
      if (val) {
        o[key] = val;
      }
    } else {
      // Drill one level deeper
      o[key] = mapping(arrow, bundle, k + 1, ix + i * arrow.factors[k]);
    }
  }
  return o;
};
