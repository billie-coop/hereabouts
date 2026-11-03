import { Constants, FNV } from './fnv';

/**
 * Running FNV-1A checksum (mutable container).
 *
 * @public
 */
export interface Checksum {
  v: number;
}

/**
 * @public
 */
export const createChecksum = (): Checksum => ({ v: Constants.FNV1A_BASIS });

/**
 * Add a string to the checksum. Returns the same checksum for chaining.
 *
 * @public
 */
export const checksumUpdate = (c: Checksum, s: string): Checksum => {
  c.v = FNV(c.v, s);
  return c;
};

/**
 * @public
 */
export const checksumGet = (c: Checksum): number => c.v;
