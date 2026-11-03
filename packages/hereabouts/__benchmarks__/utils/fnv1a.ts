import { checksumGet, checksumUpdate, createChecksum } from '../../src/utils';
import { makeSuite } from './util';

export const fnv1aSuite = makeSuite('FNV1a');

const makestr = (n: number, base: string) => base.repeat(n);

const N = 1000;
const BYTE1 = makestr(N, 'A');
const BYTE2 = makestr(N, 'Ж');
const BYTE3 = makestr(N, '€');
const BYTE4 = makestr(N, '𝄞');

fnv1aSuite.add('1-byte sequence', () => {
  checksumGet(checksumUpdate(createChecksum(), BYTE1));
});

fnv1aSuite.add('2-byte sequence', () => {
  checksumGet(checksumUpdate(createChecksum(), BYTE2));
});

fnv1aSuite.add('3-byte sequence', () => {
  checksumGet(checksumUpdate(createChecksum(), BYTE3));
});

fnv1aSuite.add('4-byte sequence', () => {
  checksumGet(checksumUpdate(createChecksum(), BYTE4));
});
