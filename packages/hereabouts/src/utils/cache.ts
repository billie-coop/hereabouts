import { createLRU, type LRU, lruGet, lruSet, lruSize } from './lru';

/**
 * Bounded cache of values built from a string key on first use (mutable container).
 *
 * @public
 */
export interface Cache<T> {
  readonly builder: (s: string) => T;
  readonly storage: LRU<T>;
}

/**
 * @public
 */
export const createCache = <T>(builder: (s: string) => T, capacity: number): Cache<T> => ({
  builder,
  storage: createLRU<T>(capacity),
});

/**
 * @public
 */
export const cacheSize = <T>(cache: Cache<T>): number => lruSize(cache.storage);

/**
 * Get the value for a key, building and caching it if absent.
 *
 * @public
 */
export const cacheGet = <T>(cache: Cache<T>, raw: string): T => {
  let o = lruGet(cache.storage, raw);
  if (o === undefined) {
    o = cache.builder(raw);
    lruSet(cache.storage, raw, o);
  }
  return o;
};
