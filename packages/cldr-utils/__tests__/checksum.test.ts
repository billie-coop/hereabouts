import { checksumGet, checksumUpdate, createChecksum } from '../src';

/*

https://tools.ietf.org/html/draft-eastlake-fnv-16#page-114

Appendix C: A Few Test Vectors

   Below are a few test vectors in the form of ASCII strings and their
   FNV32 and FNV64 hashes using the FNV-1a algorithm.

         Strings without null (zero byte) termination:

         String       FNV32
          ""        0x811c9dc5
          "a"       0xe40c292c
          "foobar"  0xbf9cf968

*/

const fnv1a = (s: string): number => checksumGet(checksumUpdate(createChecksum(), s));

test('fnv1a test vectors', () => {
  expect(fnv1a('')).toEqual(0x811c9dc5);
  expect(fnv1a('a')).toEqual(0xe40c292c);
  expect(fnv1a('foobar')).toEqual(0xbf9cf968);
  expect(fnv1a('hello world')).toEqual(0xd58b3fa7);

  // This is a UTF-16 checksum, not UTF-8
  expect(fnv1a('\u2018hello\u2019')).toEqual(0xf92de24c);
});

test('order', () => {
  const c1 = createChecksum();
  ['arab', 'guru', 'deva'].forEach((s) => checksumUpdate(c1, s));
  const c2 = createChecksum();
  ['deva', 'guru', 'arab'].forEach((s) => checksumUpdate(c2, s));
  expect(checksumGet(c1)).not.toEqual(checksumGet(c2));
});
