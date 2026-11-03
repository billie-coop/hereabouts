import { getRegionPartition } from '../../src/locale-matcher/partition';

test('sanity check', () => {
  let p: string[];

  // partitions identifiers are auto-generated greek letters so may change as
  // partition composition changes.
  p = getRegionPartition('US');
  expect(p).toEqual(['δ']);

  p = getRegionPartition('ZZ');
  expect(p).toEqual([]);
});
