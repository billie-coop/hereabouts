/**
 * Very low-level access to the strings of one locale in a resource pack: the string table for the
 * language + script, and an optional per-region exception index that overrides some offsets.
 * Plain data; read it with `bundleGet(bundle, offset)`.
 *
 * @public
 */
export interface PrimitiveBundle {
  readonly id: string;
  readonly language: string;
  readonly region: string;
  readonly strings: readonly string[];
  readonly exceptions: readonly string[];
  readonly index?: { readonly [offset: number]: number };
}
