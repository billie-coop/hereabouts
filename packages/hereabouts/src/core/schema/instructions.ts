import type { KeyIndex } from '../../types';

/**
 * Build the inverse mapping of keys to their index in the array.
 *
 * @public
 */
export const keyIndex = <T extends string>(keys: T[]): KeyIndex<T> => {
  const index = Object.create(null) as { [P in T]: number };
  for (let i = 0; i < keys.length; i++) {
    index[keys[i]] = i;
  }
  return { index, keys, size: keys.length, last: keys.length - 1 };
};

/**
 * Index of a key, or -1 if not present.
 *
 * @public
 */
export const keyIndexGet = <T extends string>(ki: KeyIndex<T>, key: T): number => {
  const i = ki.index[key];
  return i === undefined ? -1 : i;
};

/**
 * @public
 */
export interface Digits {
  readonly type: 'digits';
  readonly name: string;
  readonly dim0: string;
  readonly values: number[];
}

/**
 * @public
 */
export interface Field {
  readonly type: 'field';
  readonly name: string;
}

/**
 * @public
 */
export interface Origin {
  readonly type: 'origin';
  readonly block: Scope[];
  readonly indices: { [x: string]: KeyIndex<any> };
}

const NULL_KEYINDEX = /*#__PURE__*/ keyIndex<string>([]);
const WARNED: { [x: string]: boolean } = {};

/**
 * Look up a key index by name.
 *
 * @public
 */
export const originGetIndex = (o: Origin, name: string): KeyIndex<string> => {
  const r = o.indices[name];
  if (r === undefined) {
    /* istanbul ignore next -- @preserve */
    if (!WARNED[name]) {
      // NOTE: Unless something went horribly wrong, this should only occur during development.
      console.log(`Error: failed to locate index/value set named "${name}"`);
      WARNED[name] = true;
    }
    return NULL_KEYINDEX;
  }
  return r;
};

/**
 * Keys of a key index by name.
 *
 * @public
 */
export const originGetValues = (o: Origin, name: string): string[] => originGetIndex(o, name).keys;

/**
 * @public
 */
export interface Scope {
  readonly type: 'scope';
  readonly name: string;
  readonly identifier: string;
  readonly block: Instruction[];
}

/**
 * @public
 */
export interface ScopeMap {
  readonly type: 'scopemap';
  readonly name: string;
  readonly fields: string;
  readonly block: Instruction[];
}

/**
 * @public
 */
export interface Vector {
  readonly type: 'vector';
  readonly name: string;
  readonly dims: string[];
}

/**
 * @public
 */
export type Instruction = Digits | Field | Origin | Scope | ScopeMap | Vector;

/**
 * @internal
 */
export const digits = (name: string, dim0: string, values: number[]): Digits => ({
  type: 'digits',
  name,
  dim0,
  values,
});

/**
 * @internal
 */
export const field = (name: string): Field => ({ type: 'field', name });

/**
 * @internal
 */
export const origin = (block: Scope[], indices: { [x: string]: KeyIndex<any> }): Origin => ({
  type: 'origin',
  block,
  indices,
});

/**
 * @internal
 */
export const scope = (name: string, identifier: string, block: Instruction[]): Scope => ({
  type: 'scope',
  name,
  identifier,
  block,
});

/**
 * @internal
 */
export const scopemap = (name: string, fields: string, block: Instruction[]): ScopeMap => ({
  type: 'scopemap',
  name,
  fields,
  block,
});

/**
 * @internal
 */
export const vector = (name: string, dims: string[]): Vector => ({ type: 'vector', name, dims });
