import { createLRU, lruGet, lruSet, lruSize, lruToString } from '../../src/utils';

test('basics', () => {
  const cache = createLRU<number>(5);
  lruSet(cache, 'aaa', 1);
  lruSet(cache, 'bbb', 2);
  lruSet(cache, 'ccc', 3);
  expect(lruToString(cache)).toEqual('ccc=3 bbb=2 aaa=1');

  expect(lruGet(cache, 'x')).toEqual(undefined);

  lruSet(cache, 'ddd', 4);
  lruSet(cache, 'eee', 5);
  expect(lruGet(cache, 'ddd')).toEqual(4);
  expect(lruToString(cache)).toEqual('ddd=4 eee=5 ccc=3 bbb=2 aaa=1');

  lruSet(cache, 'fff', 6);
  expect(lruToString(cache)).toEqual('fff=6 ddd=4 eee=5 ccc=3 bbb=2');

  lruSet(cache, 'ccc', 33);
  expect(lruToString(cache)).toEqual('ccc=33 fff=6 ddd=4 eee=5 bbb=2');

  lruSet(cache, 'ggg', 6);
  expect(lruToString(cache)).toEqual('ggg=6 ccc=33 fff=6 ddd=4 eee=5');
});

test('defaults', () => {
  const cache = createLRU<string>();
  for (let i = 0; i < 200; i++) {
    lruSet(cache, i, String(i));
  }
  expect(lruSize(cache)).toEqual(100);
  for (let i = 17; i < 300; i += 3) {
    lruGet(cache, i);
  }
  for (let i = 15; i < 400; i += 3) {
    lruGet(cache, i);
  }
  expect(lruSize(cache)).toEqual(100);
});

test('zero capacity', () => {
  // Special case where nothing is retained in the lru. This is used
  // to performance test code that depends on a cache, in order to
  // factor out the caching itself.
  const cache = createLRU<number>(0);
  lruSet(cache, 'aaa', 1);
  expect(lruSize(cache)).toEqual(0);
  expect(lruGet(cache, 'aaa')).toEqual(undefined);
});
