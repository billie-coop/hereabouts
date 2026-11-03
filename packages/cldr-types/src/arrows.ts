/**
 * Maps a name to a key index.
 *
 * @public
 */
export interface KeyIndexMap {
  [name: string]: KeyIndex<string>;
}

/**
 * Indexes each string in an array to its offset in the array.
 *
 * @public
 */
export interface KeyIndex<T extends string> {
  readonly index: { readonly [P in T]: number };
  readonly keys: T[];
  readonly size: number;
  readonly last: number;
}

/**
 * Accessor for a single field.
 *
 * @public
 */
export interface FieldArrow {
  readonly kind: 'field';
  readonly offset: number;
}

/**
 * Accessor for a map of scopes.
 *
 * @public
 */
export interface ScopeArrow<T extends string, R> {
  readonly kind: 'scope';
  readonly map: { readonly [P in T]: R };
}

/**
 * Accessor for a pluralized number pattern and its divisor, stored together.
 *
 * @public
 */
export interface DigitsArrow<T extends string> {
  readonly kind: 'digits';
  readonly offset: number;
  readonly index: KeyIndex<T>;
  readonly values: number[];
  readonly size2: number;
}

/**
 * Fields shared by all multi-dimensional vector accessors.
 *
 * @public
 */
export interface VectorArrowBase {
  readonly kind: 'vector';
  /** Offset of the first value (the header that marks the vector as present is at offset - 1). */
  readonly offset: number;
  readonly len: number;
  readonly last: number;
  /** Address factor for each dimension. */
  readonly factors: readonly number[];
  readonly keysets: readonly KeyIndex<string>[];
}

/**
 * Accessor for a 1-dimensional vector of fields.
 *
 * @public
 */
export interface Vector1Arrow<T extends string> extends VectorArrowBase {
  readonly keysets: readonly [KeyIndex<T>];
}

/**
 * Accessor for a 2-dimensional vector of fields.
 *
 * @public
 */
export interface Vector2Arrow<T extends string, S extends string> extends VectorArrowBase {
  readonly keysets: readonly [KeyIndex<T>, KeyIndex<S>];
}

/**
 * Accessor for a 3-dimensional vector of fields.
 *
 * @public
 */
export interface Vector3Arrow<T extends string, S extends string, U extends string>
  extends VectorArrowBase {
  readonly keysets: readonly [KeyIndex<T>, KeyIndex<S>, KeyIndex<U>];
}
